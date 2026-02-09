const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Subgrid = require('../models/Subgrid');
const User = require('../models/User');
const Notification = require('../models/Notification');
const TenantMembership = require('../models/TenantMembership');
const SubgridMembership = require('../models/SubgridMembership');
const CustomRole = require('../models/CustomRole');
const InviteLink = require('../models/InviteLink');
const FriendRequest = require('../models/FriendRequest');
const Friendship = require('../models/Friendship');
const FriendBlock = require('../models/FriendBlock');
const UserPresence = require('../models/UserPresence');
const { getTenantConnection } = require('../services/tenantDb');
const { defineModels } = require('../services/tenantModels');
const { generateInviteToken, hashInviteToken, signEmbedToken } = require('../utils/tokenUtils');
const { sendInviteEmail, sendChannelInviteEmail } = require('../services/emailService');
const websocketService = require('../services/websocketService');
const pushNotificationService = require('../services/pushNotificationService');
const logger = require('../utils/logger');
const {
    getTenantMembership,
    getSubgridMembership,
    requireTenantRole,
    requireSubgridRole,
    isMembershipActive,
    canWriteInSubgrid,
} = require('../services/permissionService');
const { filterContent } = require('../services/contentFilterService');

const slugify = (value) => {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};

const buildDbName = (slug, id) => `tenant_${slug}_${id}`;

const resolveSubgridContext = async (subgridId) => {
    if (!mongoose.Types.ObjectId.isValid(subgridId)) {
        return null;
    }
    return Subgrid.findById(subgridId);
};

const getSubgrid = async (req, subgridId) => {
    if (req.subgrid) {
        return req.subgrid;
    }
    return resolveSubgridContext(subgridId);
};

const resolveScopesForRole = (role) => {
    if (role === 'subgrid_admin') {
        return ['read', 'write', 'moderate', 'analytics'];
    }
    if (role === 'moderator') {
        return ['read', 'write', 'moderate'];
    }
    if (role === 'member' || role === 'stakeholder') {
        return ['read', 'write'];
    }
    return ['read'];
};

const getTenantModels = async (subgrid) => {
    const connection = await getTenantConnection(subgrid.tenantId);
    return defineModels(connection);
};

const touchMemberActivity = async (tenantId, subgridId, userId) => {
    if (!userId) {
        return;
    }
    await SubgridMembership.findOneAndUpdate(
        { tenantId, subgridId, userId },
        { $set: { lastActiveAt: new Date() } },
        { new: true }
    );
};

/**
 * Send push notification to user if they're offline
 * Also creates an in-app notification for the user's notification inbox
 * Checks user's notification preferences and push tokens
 */
const sendPushToOfflineUser = async (userId, notificationType, notificationData) => {
    try {
        // Get user with push tokens and preferences
        const user = await User.findById(userId).select('pushTokens notificationPreferences firstName lastName');
        if (!user) {
            console.log(`[Push] User ${userId} not found`);
            return;
        }

        // Check notification preferences
        const prefs = user.notificationPreferences || {};
        if (notificationType === 'message' && prefs.messages === false) return;
        if (notificationType === 'dm' && prefs.dms === false) return;
        if (notificationType === 'call' && prefs.calls === false) return;
        if (notificationType === 'mention' && prefs.mentions === false) return;
        if (notificationType === 'invite' && prefs.invites === false) return;

        // Always create an in-app notification (regardless of online status)
        try {
            await Notification.create({
                userId,
                type: notificationType,
                title: notificationData.title,
                body: notificationData.body,
                data: notificationData.data || {},
                imageUrl: notificationData.imageUrl || null,
            });
            console.log(`[Notification] Created in-app notification for user ${userId}`);
        } catch (notifError) {
            console.error(`[Notification] Failed to create in-app notification:`, notifError.message);
        }

        // Check if user is online via WebSocket - if so, skip push notification
        if (websocketService.isUserOnline(userId)) {
            console.log(`[Push] User ${userId} is online, skipping push notification`);
            return;
        }

        // Check if user has push tokens
        if (!user.pushTokens || user.pushTokens.length === 0) {
            console.log(`[Push] User ${userId} has no push tokens`);
            return;
        }

        // Send to all registered tokens
        const notifications = user.pushTokens.map((tokenInfo) => ({
            to: tokenInfo.token,
            ...notificationData,
        }));

        const results = await pushNotificationService.sendBulkNotifications(notifications);
        console.log(`[Push] Sent ${results.length} push notifications to user ${userId}:`, results.map(r => r.status));

        // Clean up invalid tokens
        const invalidTokens = results
            .filter(r => r.status === 'error' && (r.message?.includes('DeviceNotRegistered') || r.message?.includes('InvalidCredentials')))
            .map(r => r.token);

        if (invalidTokens.length > 0) {
            console.log(`[Push] Removing ${invalidTokens.length} invalid tokens for user ${userId}`);
            await User.findByIdAndUpdate(userId, {
                $pull: { pushTokens: { token: { $in: invalidTokens } } }
            });
        }
    } catch (error) {
        console.error(`[Push] Failed to send push notification to user ${userId}:`, error.message);
    }
};

const isBlockedPair = async (subgridId, userId, peerId) => {
    if (!userId || !peerId) {
        return false;
    }
    const block = await FriendBlock.findOne({
        subgridId,
        $or: [
            { blockerId: userId, blockedId: peerId },
            { blockerId: peerId, blockedId: userId },
        ],
    });
    return Boolean(block);
};

const hasFriendship = async (subgridId, userId, peerId) => {
    if (!userId || !peerId) {
        return false;
    }
    const friendship = await Friendship.findOne({ subgridId, userId, friendId: peerId });
    return Boolean(friendship);
};

const resolveInvite = async (inviteToken, subgridId, kind) => {
    const tokenHash = hashInviteToken(inviteToken);
    const invite = await InviteLink.findOne({ tokenHash, subgridId, ...(kind ? { kind } : {}) });
    if (!invite) {
        return { error: 'Invalid invite token' };
    }
    if (invite.revokedAt) {
        return { error: 'Invite token revoked' };
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
        return { error: 'Invite token expired' };
    }
    if (invite.maxUses && invite.uses >= invite.maxUses) {
        return { error: 'Invite token exhausted' };
    }
    return { invite };
};

const incrementInviteUse = async (invite) => {
    invite.uses += 1;
    await invite.save();
};

const resolveChannelAccess = async (Channel, subgridId, channelId, membership, embed) => {
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        return { error: 'Invalid channel id' };
    }
    const channel = await Channel.findOne({ _id: channelId, subgridId: String(subgridId) });
    if (!channel || channel.status !== 'active') {
        return { error: 'Channel not found for this subgrid' };
    }
    if (channel.visibility === 'admin') {
        if (embed && embed.role !== 'subgrid_admin') {
            return { error: 'Channel restricted to admins' };
        }
        if (membership && !requireSubgridRole(membership, ['subgrid_admin'])) {
            return { error: 'Channel restricted to admins' };
        }
    }
    return { channel };
};

const recordAudit = async (AuditLog, subgridId, actorId, action, detail) => {
    if (!actorId) {
        return;
    }
    await AuditLog.create({
        subgridId: String(subgridId),
        actorId: String(actorId),
        action,
        targetType: detail?.targetType || '',
        targetId: detail?.targetId || '',
        detail: detail || {},
    });
};

// @desc    Get current user profile
// @route   GET /api/community/users/me
// @access  Private
exports.getUserProfile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
                bannerUrl: user.bannerUrl,
                stakeholderBadge: user.stakeholderBadge,
                company: user.company,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to get user profile', error: error.message });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { username, firstName, lastName } = req.body;
        const updateData = {};

        // Validate and set username if provided
        if (username !== undefined) {
            const trimmedUsername = String(username).trim().toLowerCase();

            // Validate username format
            if (trimmedUsername && !/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
                return res.status(400).json({
                    message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
                });
            }

            // Check if username is already taken (if not empty)
            if (trimmedUsername) {
                const existingUser = await User.findOne({
                    username: trimmedUsername,
                    _id: { $ne: req.user.id }
                });
                if (existingUser) {
                    return res.status(400).json({ message: 'Username is already taken' });
                }
            }

            updateData.username = trimmedUsername || null;
        }

        // Update firstName if provided
        if (firstName !== undefined) {
            updateData.firstName = String(firstName).trim();
        }

        // Update lastName if provided
        if (lastName !== undefined) {
            updateData.lastName = String(lastName).trim();
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateData },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
                bannerUrl: user.bannerUrl,
                stakeholderBadge: user.stakeholderBadge,
                company: user.company,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update user profile', error: error.message });
    }
};

exports.listTenants = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Get all tenant memberships for this user
        const memberships = await TenantMembership.find({ userId: req.user.id });
        const tenantIds = memberships.map(m => m.tenantId);

        // Get all tenants
        const tenants = await Tenant.find({ _id: { $in: tenantIds } });

        // Add role to each tenant
        const tenantsWithRole = tenants.map(tenant => {
            const membership = memberships.find(m => String(m.tenantId) === String(tenant._id));
            return {
                ...tenant.toObject(),
                userRole: membership?.role || 'member',
            };
        });

        return res.status(200).json({ success: true, data: tenantsWithRole });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list tenants', error: error.message });
    }
};

exports.createTenant = async (req, res) => {
    try {
        const { name, slug } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Tenant name is required' });
        }

        const normalizedSlug = slugify(slug || name);
        if (!normalizedSlug) {
            return res.status(400).json({ message: 'Tenant slug is required' });
        }

        const exists = await Tenant.findOne({ slug: normalizedSlug });
        if (exists) {
            return res.status(409).json({ message: 'Tenant slug already exists' });
        }

        const tenant = new Tenant({
            name,
            slug: normalizedSlug,
            dbName: '',
        });
        tenant.dbName = buildDbName(normalizedSlug, tenant._id.toString());
        await tenant.save();

        if (req.user) {
            await TenantMembership.create({
                tenantId: tenant._id,
                userId: req.user.id,
                role: 'owner',
            });
        }

        return res.status(201).json({ success: true, data: tenant });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create tenant', error: error.message });
    }
};

exports.addTenantMember = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { userId, role } = req.body;

        if (!mongoose.Types.ObjectId.isValid(tenantId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid tenant or user id' });
        }

        const membership = await getTenantMembership(tenantId, req.user.id);
        if (!requireTenantRole(membership, ['owner', 'admin'])) {
            return res.status(403).json({ message: 'Insufficient tenant permissions' });
        }

        const newMembership = await TenantMembership.findOneAndUpdate(
            { tenantId, userId },
            { tenantId, userId, role: role || 'member' },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, data: newMembership });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to add tenant member', error: error.message });
    }
};

exports.createSubgrid = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const {
            name,
            slug,
            description,
            clientName,
            logoUrl,
            coverImageUrl,
            visibility,
            status,
            settings,
            joinSettings,
            moderationRules,
            embedSettings,
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(tenantId)) {
            return res.status(400).json({ message: 'Invalid tenant id' });
        }

        const membership = await getTenantMembership(tenantId, req.user.id);
        if (!requireTenantRole(membership, ['owner', 'admin'])) {
            return res.status(403).json({ message: 'Insufficient tenant permissions' });
        }

        const normalizedSlug = slugify(slug || name);
        if (!normalizedSlug) {
            return res.status(400).json({ message: 'Subgrid name is required' });
        }

        const existing = await Subgrid.findOne({ tenantId, slug: normalizedSlug });
        if (existing) {
            return res.status(409).json({ message: 'Subgrid slug already exists for this tenant' });
        }

        const subgrid = await Subgrid.create({
            tenantId,
            name,
            slug: normalizedSlug,
            description: description || '',
            clientName: clientName || '',
            logoUrl: logoUrl || '',
            coverImageUrl: coverImageUrl || '',
            visibility: visibility || 'private',
            status: status || 'active',
            settings: {
                postsEnabled: settings?.postsEnabled !== undefined ? settings.postsEnabled : true,
                commentsEnabled: settings?.commentsEnabled !== undefined ? settings.commentsEnabled : true,
                directMessagesEnabled: settings?.directMessagesEnabled !== undefined ? settings.directMessagesEnabled : true,
            },
            joinSettings: {
                method: joinSettings?.method || 'invite_only',
                autoJoinEnabled: joinSettings?.autoJoinEnabled || false,
            },
            moderationRules: Array.isArray(moderationRules) ? moderationRules : [],
            embedSettings: {
                enabled: embedSettings?.enabled !== undefined ? embedSettings.enabled : true,
                allowedOrigins: Array.isArray(embedSettings?.allowedOrigins) ? embedSettings.allowedOrigins : [],
                mode: embedSettings?.mode || 'full',
                defaultChannelId: embedSettings?.defaultChannelId || '',
            },
        });

        await SubgridMembership.create({
            tenantId,
            subgridId: subgrid._id,
            userId: req.user.id,
            role: 'subgrid_admin',
            status: 'active',
        });

        const { Channel } = await getTenantModels(subgrid);
        await Channel.create({
            subgridId: String(subgrid._id),
            name: 'general',
            type: 'text',
            visibility: 'public',
        });

        return res.status(201).json({ success: true, data: subgrid });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create subgrid', error: error.message });
    }
};

exports.listTenantSubgrids = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { status } = req.query;

        if (!mongoose.Types.ObjectId.isValid(tenantId)) {
            return res.status(400).json({ message: 'Invalid tenant id' });
        }

        const membership = await getTenantMembership(tenantId, req.user.id);
        if (!membership) {
            return res.status(403).json({ message: 'Insufficient tenant permissions' });
        }

        const filter = { tenantId };
        if (status) {
            filter.status = status;
        }

        const subgrids = await Subgrid.find(filter).sort({ createdAt: -1 });

        // Generate invite codes for any subgrids that don't have them
        for (const subgrid of subgrids) {
            if (!subgrid.inviteCode) {
                const newCode = Subgrid.generateInviteCode();
                await Subgrid.findByIdAndUpdate(subgrid._id, { inviteCode: newCode });
                subgrid.inviteCode = newCode;
            }
        }

        return res.status(200).json({ success: true, data: subgrids });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load subgrids', error: error.message });
    }
};

exports.getSubgridDetails = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        return res.status(200).json({ success: true, data: subgrid });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load subgrid', error: error.message });
    }
};

exports.updateSubgrid = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const {
            name,
            slug,
            description,
            clientName,
            logoUrl,
            coverImageUrl,
            visibility,
            status,
            settings,
            joinSettings,
            moderationRules,
            embedSettings,
            engagementSettings,
        } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const updates = {};
        if (name) {
            updates.name = name;
        }
        if (slug) {
            updates.slug = slugify(slug);
        }
        if (description !== undefined) {
            updates.description = description;
        }
        if (clientName !== undefined) {
            updates.clientName = clientName;
        }
        if (logoUrl !== undefined) {
            updates.logoUrl = logoUrl;
        }
        if (coverImageUrl !== undefined) {
            updates.coverImageUrl = coverImageUrl;
        }
        if (visibility) {
            updates.visibility = visibility;
        }
        if (status) {
            updates.status = status;
        }
        if (settings) {
            updates.settings = {
                postsEnabled: settings.postsEnabled !== undefined ? settings.postsEnabled : subgrid.settings.postsEnabled,
                commentsEnabled: settings.commentsEnabled !== undefined ? settings.commentsEnabled : subgrid.settings.commentsEnabled,
                directMessagesEnabled: settings.directMessagesEnabled !== undefined
                    ? settings.directMessagesEnabled
                    : subgrid.settings.directMessagesEnabled,
            };
        }
        if (joinSettings) {
            updates.joinSettings = {
                method: joinSettings.method || subgrid.joinSettings.method,
                autoJoinEnabled: joinSettings.autoJoinEnabled !== undefined
                    ? joinSettings.autoJoinEnabled
                    : subgrid.joinSettings.autoJoinEnabled,
            };
        }
        if (moderationRules) {
            updates.moderationRules = Array.isArray(moderationRules) ? moderationRules : subgrid.moderationRules;
        }
        if (embedSettings) {
            updates.embedSettings = {
                enabled: embedSettings.enabled !== undefined ? embedSettings.enabled : subgrid.embedSettings.enabled,
                allowedOrigins: Array.isArray(embedSettings.allowedOrigins)
                    ? embedSettings.allowedOrigins
                    : subgrid.embedSettings.allowedOrigins,
                mode: embedSettings.mode || subgrid.embedSettings.mode,
                defaultChannelId: embedSettings.defaultChannelId || subgrid.embedSettings.defaultChannelId,
            };
        }
        if (engagementSettings) {
            const currentEngagement = subgrid.engagementSettings || {};
            updates.engagementSettings = {
                joinMessage: engagementSettings.joinMessage !== undefined
                    ? engagementSettings.joinMessage
                    : currentEngagement.joinMessage ?? true,
                uploadNotice: engagementSettings.uploadNotice !== undefined
                    ? engagementSettings.uploadNotice
                    : currentEngagement.uploadNotice ?? true,
                emojiReactions: engagementSettings.emojiReactions !== undefined
                    ? engagementSettings.emojiReactions
                    : currentEngagement.emojiReactions ?? true,
                autoEmoji: engagementSettings.autoEmoji !== undefined
                    ? engagementSettings.autoEmoji
                    : currentEngagement.autoEmoji ?? false,
                stickersAutocomplete: engagementSettings.stickersAutocomplete !== undefined
                    ? engagementSettings.stickersAutocomplete
                    : currentEngagement.stickersAutocomplete ?? true,
            };
        }

        if (updates.slug) {
            const exists = await Subgrid.findOne({
                tenantId: subgrid.tenantId,
                slug: updates.slug,
                _id: { $ne: subgridId },
            });
            if (exists) {
                return res.status(409).json({ message: 'Subgrid slug already exists for this tenant' });
            }
        }

        const updated = await Subgrid.findByIdAndUpdate(subgridId, updates, { new: true });
        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update subgrid', error: error.message });
    }
};

exports.addSubgridMember = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { userId, role } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const membership = await getSubgridMembership(subgrid.tenantId, subgridId, req.user.id);
        if (!requireSubgridRole(membership, ['subgrid_admin'])) {
            return res.status(403).json({ message: 'Insufficient subgrid permissions' });
        }

        const newMembership = await SubgridMembership.findOneAndUpdate(
            { tenantId: subgrid.tenantId, subgridId, userId },
            { tenantId: subgrid.tenantId, subgridId, userId, role: role || 'member', status: 'active' },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, data: newMembership });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to add subgrid member', error: error.message });
    }
};

exports.getMySubgridRole = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const userId = req.user?.id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const membership = await SubgridMembership.findOne({
            subgridId,
            userId,
            status: 'active',
        });

        if (!membership) {
            return res.status(404).json({ message: 'Not a member of this subgrid' });
        }

        return res.status(200).json({
            success: true,
            data: {
                role: membership.role,
                status: membership.status,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to get role', error: error.message });
    }
};

exports.listSubgridMembers = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { role, status, q, limit = 50, offset = 0 } = req.query;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const filter = { tenantId: subgrid.tenantId, subgridId };
        if (role) {
            filter.role = role;
        }
        if (status) {
            filter.status = status;
        }
        if (q && mongoose.Types.ObjectId.isValid(q)) {
            filter.userId = q;
        }

        // Populate customRoleId if the field exists, otherwise just get plain members
        const members = await SubgridMembership.find(filter)
            .sort({ createdAt: -1 })
            .skip(Number(offset))
            .limit(Math.min(Number(limit), 200))
            .populate({ path: 'customRoleId', model: 'CustomRole' })
            .lean();

        // Populate user profile data for each member
        const userIds = members.map(m => m.userId);
        const users = await User.find({ _id: { $in: userIds } })
            .select('_id firstName lastName email username avatarUrl bannerUrl createdAt role stakeholderBadge company')
            .lean();

        const userMap = {};
        users.forEach(u => {
            userMap[u._id.toString()] = u;
        });

        // Merge user data into members - nest user data for frontend compatibility
        const enrichedMembers = members.map(m => {
            const user = userMap[m.userId.toString()] || {};
            return {
                ...m,
                // Nested user object for TopContributorsScreen compatibility
                user: {
                    _id: user._id || m.userId,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    email: user.email || '',
                    username: user.username || '',
                    avatarUrl: user.avatarUrl || '',
                    bannerUrl: user.bannerUrl || '',
                    createdAt: user.createdAt || m.createdAt,
                    role: user.role || 'member',
                    stakeholderBadge: user.stakeholderBadge || null,
                    company: user.company || null,
                },
                // Keep flat fields for backward compatibility
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                username: user.username || '',
                avatarUrl: user.avatarUrl || '',
                userRole: user.role || 'member',
                stakeholderBadge: user.stakeholderBadge || null,
                company: user.company || null,
                // Custom role assigned by CU Admin
                customRole: m.customRoleId || null,
            };
        });

        return res.status(200).json({ success: true, data: enrichedMembers });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load members', error: error.message });
    }
};

exports.updateSubgridMember = async (req, res) => {
    try {
        const { subgridId, userId } = req.params;
        const { role, status, mutedUntil } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const updates = {};
        if (role) {
            updates.role = role;
        }
        if (status) {
            updates.status = status;
            if (status !== 'muted') {
                updates.mutedUntil = null;
            }
        }
        if (mutedUntil) {
            updates.mutedUntil = new Date(mutedUntil);
        }

        const updated = await SubgridMembership.findOneAndUpdate(
            { tenantId: subgrid.tenantId, subgridId, userId },
            { $set: updates },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Emit WebSocket event for real-time sync
        websocketService.emitMemberUpdated(subgridId, {
            userId,
            role: updated.role,
            status: updated.status,
            mutedUntil: updated.mutedUntil,
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update member', error: error.message });
    }
};

exports.removeSubgridMember = async (req, res) => {
    try {
        const { subgridId, userId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        await SubgridMembership.findOneAndDelete({ tenantId: subgrid.tenantId, subgridId, userId });

        // Emit WebSocket event for real-time sync
        websocketService.emitMemberLeft(subgridId, userId);

        // Emit dashboard update for admin dashboards
        websocketService.emitDashboardUpdate(subgrid.tenantId, {
            type: 'member_left',
            subgridId,
            userId,
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to remove member', error: error.message });
    }
};

exports.createInviteLink = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { expiresInHours, maxUses, kind, role, scopes, memberRole, channelId } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const membership = await getSubgridMembership(subgrid.tenantId, subgridId, req.user.id);
        if (!requireSubgridRole(membership, ['subgrid_admin'])) {
            return res.status(403).json({ message: 'Insufficient subgrid permissions' });
        }

        const rawToken = generateInviteToken();
        const tokenHash = hashInviteToken(rawToken);
        const expiresAt = expiresInHours ? new Date(Date.now() + Number(expiresInHours) * 3600 * 1000) : null;
        const normalizedKind = kind === 'member' ? 'member' : 'embed';

        await InviteLink.create({
            tenantId: subgrid.tenantId,
            subgridId,
            tokenHash,
            kind: normalizedKind,
            role: normalizedKind === 'member' ? 'member' : role || 'guest',
            scopes: Array.isArray(scopes) ? scopes : ['read'],
            memberRole: memberRole || 'member',
            channelId: channelId || '',
            maxUses: maxUses || 0,
            expiresAt,
            createdBy: req.user.id,
        });

        const baseUrl = process.env.PUBLIC_COMMUNITY_BASE_URL || '';
        const inviteUrl = baseUrl ? `${baseUrl}/invite/${rawToken}?subgrid=${subgridId}` : null;

        return res.status(201).json({
            success: true,
            data: {
                inviteToken: rawToken,
                inviteUrl,
                expiresAt,
                maxUses: maxUses || 0,
                kind: normalizedKind,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create invite link', error: error.message });
    }
};

/**
 * Invite a user by email
 * POST /subgrids/:subgridId/invites/email
 * Creates an invite link and sends an email to the user
 */
exports.inviteByEmail = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { email, memberRole = 'member' } = req.body;

        logger.debug('inviteByEmail', 'Request received', { subgridId, email, memberRole });

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const membership = await getSubgridMembership(subgrid.tenantId, subgridId, req.user.id);
        if (!requireSubgridRole(membership, ['subgrid_admin'])) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        // Check if user already exists and is a member
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            const existingMembership = await SubgridMembership.findOne({
                subgridId,
                userId: existingUser._id,
            });
            if (existingMembership) {
                return res.status(400).json({ message: 'User is already a member of this community' });
            }
        }

        // Check for existing pending invite to this email - revoke old one and create new
        const existingInvite = await InviteLink.findOne({
            subgridId,
            inviteeEmail: email.toLowerCase(),
            kind: 'email',
            acceptedAt: null,
            revokedAt: null,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } },
            ],
        });

        if (existingInvite) {
            // Revoke the old invite so we can create a new one
            logger.debug('inviteByEmail', 'Revoking existing invite', { email });
            existingInvite.revokedAt = new Date();
            await existingInvite.save();
            // Continue to create a new invite below
        }

        // Generate invite token
        const rawToken = generateInviteToken();
        const tokenHash = hashInviteToken(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

        // Create invite record
        const invite = await InviteLink.create({
            tenantId: subgrid.tenantId,
            subgridId,
            tokenHash,
            kind: 'email',
            role: 'member',
            scopes: ['read', 'write'],
            memberRole: memberRole || 'member',
            maxUses: 1,
            expiresAt,
            createdBy: req.user.id,
            inviteeEmail: email.toLowerCase(),
        });

        // Get inviter info
        const inviter = await User.findById(req.user.id);
        const inviterName = inviter
            ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || 'A team member'
            : 'A team member';

        // Send invite email
        try {
            await sendInviteEmail({
                email: email.toLowerCase(),
                inviteToken: rawToken,
                subgridId,
                subgridName: subgrid.name || 'Credit Union Community',
                inviterName,
            });

            // Update invite with email sent timestamp
            invite.emailSentAt = new Date();
            await invite.save();
        } catch (emailError) {
            logger.error('inviteByEmail', 'Failed to send invite email', { error: emailError.message });
            // Don't fail the request, just log the error
            // The invite is still created and can be resent
        }

        const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:8081';
        const inviteUrl = `${baseUrl}/join/${rawToken}?subgrid=${subgridId}`;

        return res.status(201).json({
            success: true,
            data: {
                inviteId: invite._id,
                email: email.toLowerCase(),
                inviteUrl,
                expiresAt,
                emailSent: !!invite.emailSentAt,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to send invite', error: error.message });
    }
};

/**
 * Resend an invite email
 * POST /subgrids/:subgridId/invites/:inviteId/resend
 */
exports.resendInviteEmail = async (req, res) => {
    try {
        const { subgridId, inviteId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const invite = await InviteLink.findOne({
            _id: inviteId,
            subgridId,
            kind: 'email',
            acceptedAt: null,
            revokedAt: null,
        });

        if (!invite) {
            return res.status(404).json({ message: 'Invite not found or already used' });
        }

        if (!invite.inviteeEmail) {
            return res.status(400).json({ message: 'This invite does not have an email address' });
        }

        // Check if expired
        if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
            return res.status(400).json({ message: 'This invite has expired' });
        }

        // Generate new token (invalidates old link)
        const rawToken = generateInviteToken();
        invite.tokenHash = hashInviteToken(rawToken);
        invite.expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // Reset to 7 days

        // Get inviter info
        const inviter = await User.findById(req.user.id);
        const inviterName = inviter
            ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || 'A team member'
            : 'A team member';

        // Resend email
        await sendInviteEmail({
            email: invite.inviteeEmail,
            inviteToken: rawToken,
            subgridId,
            subgridName: subgrid.name || 'Credit Union Community',
            inviterName,
        });

        invite.emailSentAt = new Date();
        await invite.save();

        const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:8081';
        const inviteUrl = `${baseUrl}/join/${rawToken}?subgrid=${subgridId}`;

        return res.status(200).json({
            success: true,
            data: {
                inviteId: invite._id,
                email: invite.inviteeEmail,
                inviteUrl,
                expiresAt: invite.expiresAt,
                emailSent: true,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to resend invite', error: error.message });
    }
};

/**
 * Validate an invite token (public endpoint for join flow)
 * GET /subgrids/:subgridId/invites/validate?token=xxx
 */
exports.validateInviteToken = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { token: inviteToken } = req.query;

        if (!inviteToken) {
            return res.status(400).json({ message: 'Invite token is required' });
        }

        const subgrid = await resolveSubgridContext(subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Community not found' });
        }

        const { invite, error } = await resolveInvite(inviteToken, subgridId);
        if (error || !invite) {
            return res.status(404).json({ message: error || 'Invalid or expired invite' });
        }

        // Get inviter info
        let inviterName = null;
        if (invite.createdBy) {
            const inviter = await User.findById(invite.createdBy);
            if (inviter) {
                inviterName = `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || null;
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                subgridId: String(subgrid._id),
                subgridName: subgrid.name,
                inviterName,
                memberRole: invite.memberRole || 'member',
                expiresAt: invite.expiresAt,
                inviteeEmail: invite.inviteeEmail || null,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to validate invite', error: error.message });
    }
};

/**
 * Get pending email invites
 * GET /subgrids/:subgridId/invites/pending
 */
exports.listPendingInvites = async (req, res) => {
    try {
        const { subgridId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const invites = await InviteLink.find({
            subgridId,
            kind: 'email',
            acceptedAt: null,
            revokedAt: null,
        }).sort({ createdAt: -1 });

        // Filter out expired invites
        const pendingInvites = invites.filter((invite) => {
            return !invite.expiresAt || new Date(invite.expiresAt) > new Date();
        });

        return res.status(200).json({
            success: true,
            data: pendingInvites.map((invite) => ({
                id: invite._id,
                email: invite.inviteeEmail,
                memberRole: invite.memberRole,
                emailSentAt: invite.emailSentAt,
                expiresAt: invite.expiresAt,
                createdAt: invite.createdAt,
            })),
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list pending invites', error: error.message });
    }
};

exports.listInviteLinks = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const invites = await InviteLink.find({ subgridId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: invites });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list invites', error: error.message });
    }
};

exports.revokeInviteLink = async (req, res) => {
    try {
        const { subgridId, inviteId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const updated = await InviteLink.findOneAndUpdate(
            { _id: inviteId, subgridId },
            { revokedAt: new Date() },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ message: 'Invite not found' });
        }
        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to revoke invite', error: error.message });
    }
};

exports.acceptInviteLink = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { inviteToken } = req.body;

        if (!inviteToken) {
            return res.status(400).json({ message: 'Invite token is required' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        // Accept both 'member' and 'email' kind invites
        let result = await resolveInvite(inviteToken, subgrid._id, 'email');
        if (result.error) {
            // Try 'member' kind as fallback
            result = await resolveInvite(inviteToken, subgrid._id, 'member');
        }
        const { invite, error } = result;
        if (error) {
            return res.status(401).json({ message: error });
        }

        const membership = await SubgridMembership.findOneAndUpdate(
            { tenantId: subgrid.tenantId, subgridId, userId: req.user.id },
            { tenantId: subgrid.tenantId, subgridId, userId: req.user.id, role: invite.memberRole || 'member', status: 'active' },
            { upsert: true, new: true }
        );

        // Also add to tenant if not already a member
        const existingTenantMembership = await TenantMembership.findOne({
            tenantId: subgrid.tenantId,
            userId: req.user.id,
        });
        if (!existingTenantMembership) {
            await TenantMembership.create({
                tenantId: subgrid.tenantId,
                userId: req.user.id,
                role: 'member',
            });
        }

        // Update user's default tenant if not set
        const user = await User.findById(req.user.id);
        if (user && !user.defaultTenantId) {
            user.defaultTenantId = subgrid.tenantId;
            await user.save();
        }

        await incrementInviteUse(invite);

        // Emit WebSocket event for real-time sync
        websocketService.emitMemberJoined(subgridId, {
            userId: req.user.id,
            role: membership.role,
            status: membership.status,
            joinedAt: membership.createdAt || new Date(),
        });

        // Emit dashboard update for admin dashboards
        websocketService.emitDashboardUpdate(subgrid.tenantId, {
            type: 'member_joined',
            subgridId,
        });

        return res.status(200).json({ success: true, data: membership });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to accept invite', error: error.message });
    }
};

exports.issueEmbedToken = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { inviteToken } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        if (subgrid.status !== 'active') {
            return res.status(403).json({ message: 'Subgrid is not active' });
        }

        if (!subgrid.embedSettings?.enabled) {
            return res.status(403).json({ message: 'Embedding disabled for this subgrid' });
        }

        const allowedOrigins = subgrid.embedSettings?.allowedOrigins || [];
        if (allowedOrigins.length > 0) {
            const origin = req.headers.origin;
            if (!origin || !allowedOrigins.includes(origin)) {
                return res.status(403).json({ message: 'Origin not allowed for embedding' });
            }
        }

        const embedChannelId = subgrid.embedSettings?.mode === 'channel' ? subgrid.embedSettings?.defaultChannelId : '';

        if (inviteToken) {
            const { invite, error } = await resolveInvite(inviteToken, subgrid._id, 'embed');
            if (error) {
                return res.status(401).json({ message: error });
            }

            await incrementInviteUse(invite);
            const token = signEmbedToken({
                tenantId: String(subgrid.tenantId),
                subgridId: String(subgrid._id),
                userId: 'guest',
                role: invite.role || 'guest',
                scopes: invite.scopes || ['read'],
                channelId: invite.channelId || embedChannelId,
                embedMode: subgrid.embedSettings?.mode || 'full',
            });

            return res.status(200).json({ success: true, token });
        }

        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        let membership = await getSubgridMembership(subgrid.tenantId, subgridId, req.user.id);
        if (!membership && subgrid.joinSettings?.method === 'auto_join') {
            membership = await SubgridMembership.create({
                tenantId: subgrid.tenantId,
                subgridId,
                userId: req.user.id,
                role: 'member',
                status: 'active',
            });
        }
        if (!membership || !isMembershipActive(membership)) {
            return res.status(403).json({ message: 'Not a member of this subgrid' });
        }

        const token = signEmbedToken({
            tenantId: String(subgrid.tenantId),
            subgridId: String(subgrid._id),
            userId: String(req.user.id),
            role: membership.role,
            scopes: resolveScopesForRole(membership.role),
            channelId: embedChannelId,
            embedMode: subgrid.embedSettings?.mode || 'full',
        });

        return res.status(200).json({ success: true, token });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to issue embed token', error: error.message });
    }
};

exports.listChannels = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { includeArchived, visibility } = req.query;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Channel } = await getTenantModels(subgrid);
        const filter = { subgridId: String(subgridId) };
        if (!includeArchived) {
            filter.status = 'active';
        }
        if (req.embed?.channelId) {
            filter._id = req.embed.channelId;
        }

        // Determine user identity and role for private channel filtering
        const userId = req.user?.id || req.embed?.userId;
        let isAdmin = false;
        if (req.user?.id) {
            const membership = await getSubgridMembership(subgrid.tenantId, subgridId, req.user.id);
            isAdmin = membership && ['subgrid_admin'].includes(membership.role);
        }

        let channels;
        if (isAdmin || req.embed?.role === 'subgrid_admin') {
            // Admins see all channels
            if (visibility) {
                filter.visibility = visibility;
            }
            channels = await Channel.find(filter).sort({ createdAt: 1 });
        } else if (visibility) {
            // Explicit visibility filter requested
            filter.visibility = visibility;
            channels = await Channel.find(filter).sort({ createdAt: 1 });
        } else {
            // Non-admins: see public channels + private channels they're members of
            channels = await Channel.find({
                ...filter,
                $or: [
                    { visibility: 'public' },
                    { visibility: 'admin', allowedMembers: String(userId || '') },
                ],
            }).sort({ createdAt: 1 });
        }

        return res.status(200).json({ success: true, data: channels });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list channels', error: error.message });
    }
};

exports.createChannel = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { name, type, visibility, categoryId } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        if (!name) {
            return res.status(400).json({ message: 'Channel name is required' });
        }

        const { Channel } = await getTenantModels(subgrid);
        const channelData = {
            subgridId: String(subgridId),
            name,
            type: type || 'text',
            visibility: visibility || 'public',
            categoryId: categoryId || null,
        };

        // If private channel, auto-add the creating admin
        if (visibility === 'admin' && req.user?.id) {
            channelData.allowedMembers = [String(req.user.id)];
            channelData.createdBy = String(req.user.id);
        }

        const channel = await Channel.create(channelData);

        // Emit WebSocket event for real-time sync
        websocketService.emitChannelCreated(subgridId, channel);

        return res.status(201).json({ success: true, data: channel });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create channel', error: error.message });
    }
};

exports.updateChannel = async (req, res) => {
    try {
        const { subgridId, channelId } = req.params;
        const { name, type, visibility, status, categoryId } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const updates = {};
        if (name) {
            updates.name = name;
        }
        if (type) {
            updates.type = type;
        }
        if (visibility) {
            updates.visibility = visibility;
        }
        if (status) {
            updates.status = status;
        }
        if (categoryId !== undefined) {
            updates.categoryId = categoryId || null;
        }

        const { Channel } = await getTenantModels(subgrid);

        const updateOps = { $set: updates };
        // When switching to private, ensure the admin is in allowedMembers
        if (visibility === 'admin' && req.user?.id) {
            updateOps.$addToSet = { allowedMembers: String(req.user.id) };
        }
        // When switching to public, clear allowedMembers
        if (visibility === 'public') {
            updates.allowedMembers = [];
        }

        const channel = await Channel.findOneAndUpdate(
            { _id: channelId, subgridId: String(subgridId) },
            updateOps,
            { new: true }
        );
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        // Emit WebSocket event for real-time sync
        websocketService.emitChannelUpdated(subgridId, channel);

        // If channel was archived/deleted, also emit channel_deleted
        if (status === 'archived' || status === 'deleted') {
            websocketService.emitChannelDeleted(subgridId, channelId);
        }

        return res.status(200).json({ success: true, data: channel });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update channel', error: error.message });
    }
};

/**
 * Delete a channel
 * DELETE /subgrids/:subgridId/channels/:channelId
 */
exports.deleteChannel = async (req, res) => {
    try {
        const { subgridId, channelId } = req.params;
        console.log('[deleteChannel] Deleting channel:', channelId, 'in subgrid:', subgridId);

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            console.log('[deleteChannel] Subgrid not found:', subgridId);
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Channel, Message, Post } = await getTenantModels(subgrid);

        const channel = await Channel.findOne({ _id: channelId, subgridId: String(subgridId) });
        if (!channel) {
            console.log('[deleteChannel] Channel not found:', channelId);
            return res.status(404).json({ message: 'Channel not found' });
        }

        console.log('[deleteChannel] Found channel:', channel.name);

        // Delete all messages in the channel
        const deletedMessages = await Message.deleteMany({ channelId: String(channelId) });
        console.log('[deleteChannel] Deleted messages:', deletedMessages.deletedCount);

        // Delete all posts in the channel
        const deletedPosts = await Post.deleteMany({ channelId: String(channelId) });
        console.log('[deleteChannel] Deleted posts:', deletedPosts.deletedCount);

        // Delete the channel
        await Channel.findByIdAndDelete(channelId);
        console.log('[deleteChannel] Channel deleted successfully');

        // Emit WebSocket event for real-time sync
        websocketService.emitChannelDeleted(subgridId, channelId);

        return res.status(200).json({ success: true, message: 'Channel deleted' });
    } catch (error) {
        console.error('[deleteChannel] Error:', error.message);
        return res.status(500).json({ message: 'Failed to delete channel', error: error.message });
    }
};

// =====================
// CHANNEL MEMBER MANAGEMENT
// =====================

/**
 * List members of a private channel
 * GET /subgrids/:subgridId/channels/:channelId/members
 */
exports.listChannelMembers = async (req, res) => {
    try {
        const { subgridId, channelId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Channel } = await getTenantModels(subgrid);
        const channel = await Channel.findOne({ _id: channelId, subgridId: String(subgridId) });
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        const memberIds = channel.allowedMembers || [];
        if (memberIds.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Resolve user details for allowedMembers
        const users = await User.find({ _id: { $in: memberIds } })
            .select('_id firstName lastName email username avatarUrl role stakeholderBadge company')
            .lean();

        // Also get their subgrid membership role
        const memberships = await SubgridMembership.find({
            subgridId,
            userId: { $in: memberIds },
        }).lean();
        const membershipMap = {};
        memberships.forEach(m => {
            membershipMap[String(m.userId)] = m.role;
        });

        const enriched = users.map(u => ({
            ...u,
            memberRole: membershipMap[String(u._id)] || 'member',
        }));

        return res.status(200).json({ success: true, data: enriched });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list channel members', error: error.message });
    }
};

/**
 * Add members to a private channel
 * POST /subgrids/:subgridId/channels/:channelId/members
 * Body: { userIds: [string] }
 */
exports.addChannelMembers = async (req, res) => {
    try {
        const { subgridId, channelId } = req.params;
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: 'userIds array is required' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Channel, DirectMessage } = await getTenantModels(subgrid);
        const channel = await Channel.findOne({ _id: channelId, subgridId: String(subgridId) });
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }
        if (channel.visibility !== 'admin') {
            return res.status(400).json({ message: 'Can only manage members of private channels' });
        }

        // Validate that all userIds are actual subgrid members
        const validMembers = await SubgridMembership.find({
            subgridId,
            userId: { $in: userIds },
            status: 'active',
        });
        const validUserIds = validMembers.map(m => String(m.userId));

        if (validUserIds.length === 0) {
            return res.status(400).json({ message: 'No valid subgrid members found in the provided userIds' });
        }

        // Determine which users are actually new (not already in allowedMembers)
        const existingMembers = new Set((channel.allowedMembers || []).map(String));
        const newUserIds = validUserIds.filter(uid => !existingMembers.has(uid));

        // Add new members (avoid duplicates with $addToSet)
        const updatedChannel = await Channel.findByIdAndUpdate(
            channelId,
            { $addToSet: { allowedMembers: { $each: validUserIds } } },
            { new: true }
        );

        // Send DM and email notifications to newly added members
        if (newUserIds.length > 0) {
            const adminId = String(req.user.id);
            const inviter = await User.findById(adminId);
            const inviterName = inviter
                ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || 'An admin'
                : 'An admin';
            const subgridName = subgrid.name || 'your community';
            const channelName = channel.name || 'a private channel';

            // Look up user emails for email notifications
            const addedUsers = await User.find({ _id: { $in: newUserIds } })
                .select('_id email firstName lastName')
                .lean();

            for (const addedUser of addedUsers) {
                const userId = String(addedUser._id);

                // Send a DM notification
                try {
                    const dmBody = `You've been invited to the private channel "${channelName}". You now have access to view and participate in this channel.`;
                    await DirectMessage.create({
                        subgridId: String(subgridId),
                        senderId: adminId,
                        recipientId: userId,
                        body: dmBody,
                        kind: 'text',
                    });

                    // Emit WebSocket event so they see the DM in real-time
                    const dmRoomId = [adminId, userId].sort().join('_');
                    websocketService.sendToUser(userId, 'new_message', {
                        roomType: 'dm',
                        roomId: dmRoomId,
                        message: { senderId: adminId, recipientId: userId, body: dmBody, kind: 'text' },
                        timestamp: new Date().toISOString(),
                    });
                } catch (dmErr) {
                    logger.error('addChannelMembers', 'Failed to send DM notification', { userId, error: dmErr.message });
                }

                // Send an email notification
                if (addedUser.email) {
                    try {
                        await sendChannelInviteEmail({
                            email: addedUser.email,
                            channelName,
                            subgridName,
                            inviterName,
                        });
                    } catch (emailErr) {
                        logger.error('addChannelMembers', 'Failed to send email notification', { email: addedUser.email, error: emailErr.message });
                    }
                }
            }
        }

        return res.status(200).json({ success: true, data: updatedChannel });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to add channel members', error: error.message });
    }
};

/**
 * Remove a member from a private channel
 * DELETE /subgrids/:subgridId/channels/:channelId/members/:userId
 */
exports.removeChannelMember = async (req, res) => {
    try {
        const { subgridId, channelId, userId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Channel } = await getTenantModels(subgrid);
        const channel = await Channel.findOne({ _id: channelId, subgridId: String(subgridId) });
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        const updatedChannel = await Channel.findByIdAndUpdate(
            channelId,
            { $pull: { allowedMembers: String(userId) } },
            { new: true }
        );

        return res.status(200).json({ success: true, data: updatedChannel });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to remove channel member', error: error.message });
    }
};

// =====================
// CATEGORY CRUD
// =====================

exports.listCategories = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Category } = await getTenantModels(subgrid);
        const categories = await Category.find({ subgridId: String(subgridId) }).sort({ order: 1, createdAt: 1 });
        return res.status(200).json({ success: true, data: categories });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list categories', error: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { name, visibility } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        const { Category } = await getTenantModels(subgrid);

        // Get the highest order value to put new category at the end
        const lastCategory = await Category.findOne({ subgridId: String(subgridId) }).sort({ order: -1 });
        const order = lastCategory ? lastCategory.order + 1 : 0;

        const category = await Category.create({
            subgridId: String(subgridId),
            name,
            visibility: visibility || 'public',
            order,
        });

        return res.status(201).json({ success: true, data: category });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create category', error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { subgridId, categoryId } = req.params;
        const { name, visibility, order } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const updates = {};
        if (name) updates.name = name;
        if (visibility) updates.visibility = visibility;
        if (order !== undefined) updates.order = order;

        const { Category } = await getTenantModels(subgrid);
        const category = await Category.findOneAndUpdate(
            { _id: categoryId, subgridId: String(subgridId) },
            { $set: updates },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        return res.status(200).json({ success: true, data: category });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update category', error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { subgridId, categoryId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Category, Channel } = await getTenantModels(subgrid);
        const result = await Category.deleteOne({ _id: categoryId, subgridId: String(subgridId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Unlink all channels from this deleted category
        await Channel.updateMany(
            { subgridId: String(subgridId), categoryId: String(categoryId) },
            { $set: { categoryId: null } }
        );

        return res.status(200).json({ success: true, message: 'Category deleted' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete category', error: error.message });
    }
};

// =====================
// EVENT CRUD
// =====================

exports.listEvents = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { status, upcoming } = req.query;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Event } = await getTenantModels(subgrid);
        const filter = { subgridId: String(subgridId) };

        if (status) {
            filter.status = status;
        }
        if (upcoming === 'true') {
            filter.startDate = { $gte: new Date() };
        }

        const events = await Event.find(filter).sort({ startDate: 1 });
        return res.status(200).json({ success: true, data: events });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list events', error: error.message });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { title, description, startDate, endDate, location, eventType } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        if (!title) {
            return res.status(400).json({ message: 'Event title is required' });
        }
        // startDate is required for events but optional for announcements
        if (eventType !== 'announcement' && !startDate) {
            return res.status(400).json({ message: 'Event start date is required' });
        }

        const { Event } = await getTenantModels(subgrid);
        const event = await Event.create({
            subgridId: String(subgridId),
            title,
            description: description || '',
            eventType: eventType || 'event',
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            location: location || '',
            createdBy: req.user.id,
        });

        return res.status(201).json({ success: true, data: event });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create event', error: error.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { subgridId, eventId } = req.params;
        const { title, description, startDate, endDate, location, status } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const updates = {};
        if (title) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (startDate) updates.startDate = new Date(startDate);
        if (endDate) updates.endDate = new Date(endDate);
        if (location !== undefined) updates.location = location;
        if (status) updates.status = status;

        const { Event } = await getTenantModels(subgrid);
        const event = await Event.findOneAndUpdate(
            { _id: eventId, subgridId: String(subgridId) },
            { $set: updates },
            { new: true }
        );

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        return res.status(200).json({ success: true, data: event });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update event', error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { subgridId, eventId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Event } = await getTenantModels(subgrid);
        const result = await Event.deleteOne({ _id: eventId, subgridId: String(subgridId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        return res.status(200).json({ success: true, message: 'Event deleted' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete event', error: error.message });
    }
};

exports.listMessages = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { channelId, limit = 50 } = req.query;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Channel, Message, MessageLike, MessageReshare } = await getTenantModels(subgrid);
        const filter = { subgridId: String(subgridId), status: 'active' };
        if (req.embed?.channelId) {
            if (channelId && channelId !== req.embed.channelId) {
                return res.status(403).json({ message: 'Embed token restricted to a different channel' });
            }
            filter.channelId = req.embed.channelId;
        } else if (channelId) {
            // Check private channel access
            const channel = await Channel.findOne({ _id: channelId, subgridId: String(subgridId) });
            if (channel && channel.visibility === 'admin') {
                const userId = req.user?.id;
                let isAdmin = false;
                if (userId) {
                    const membership = await getSubgridMembership(subgrid.tenantId, subgridId, userId);
                    isAdmin = membership && ['subgrid_admin'].includes(membership.role);
                }
                if (!isAdmin && (!userId || !channel.allowedMembers || !channel.allowedMembers.includes(String(userId)))) {
                    return res.status(403).json({ message: 'Access denied to this channel' });
                }
            }
            filter.channelId = channelId;
        }

        const messages = await Message.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 200));

        // Add userLiked and userReshared flags if user is authenticated
        const userId = req.user?.id;
        let messagesWithUserFlags = messages.map(m => m.toObject());

        if (userId && messages.length > 0) {
            const messageIds = messages.map(m => String(m._id));
            const [userLikes, userReshares] = await Promise.all([
                MessageLike.find({
                    subgridId: String(subgridId),
                    messageId: { $in: messageIds },
                    userId: String(userId),
                }),
                MessageReshare.find({
                    subgridId: String(subgridId),
                    messageId: { $in: messageIds },
                    userId: String(userId),
                }),
            ]);

            const likedMessageIds = new Set(userLikes.map(l => l.messageId));
            const resharedMessageIds = new Set(userReshares.map(r => r.messageId));

            messagesWithUserFlags = messagesWithUserFlags.map(m => ({
                ...m,
                userLiked: likedMessageIds.has(String(m._id)),
                userReshared: resharedMessageIds.has(String(m._id)),
            }));
        }

        return res.status(200).json({ success: true, data: messagesWithUserFlags });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list messages', error: error.message });
    }
};

exports.createMessage = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { channelId, body, kind, attachments } = req.body;

        const normalizedBody = typeof body === 'string' ? body.trim() : '';
        const normalizedAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

        if (!channelId || (!normalizedBody && normalizedAttachments.length === 0)) {
            return res.status(400).json({ message: 'channelId and body or attachments are required' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const authorId = req.embed?.userId || req.user?.id;
        if (!authorId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (req.embed?.channelId && req.embed.channelId !== channelId) {
            return res.status(403).json({ message: 'Embed token restricted to a different channel' });
        }

        const { Channel, Message } = await getTenantModels(subgrid);
        const membership = req.user
            ? await getSubgridMembership(subgrid.tenantId, subgridId, req.user.id)
            : null;
        if (req.user && !canWriteInSubgrid(membership)) {
            return res.status(403).json({ message: 'Subgrid access denied' });
        }

        const { error } = await resolveChannelAccess(Channel, subgridId, channelId, membership, req.embed);
        if (error) {
            return res.status(403).json({ message: error });
        }

        // Apply content moderation filter
        let filteredBody = normalizedBody;
        let flagForReview = false;
        if (normalizedBody) {
            const filterResult = await filterContent(normalizedBody, subgridId);
            if (!filterResult.allowed) {
                return res.status(400).json({
                    message: filterResult.message,
                    code: 'CONTENT_BLOCKED',
                    matchedWords: filterResult.matches,
                });
            }
            filteredBody = filterResult.censoredContent || normalizedBody;
            flagForReview = filterResult.flagged || false;
        }

        const message = await Message.create({
            subgridId: String(subgridId),
            channelId,
            authorId: String(authorId),
            body: filteredBody,
            kind: kind || (normalizedAttachments.length > 0 ? 'audio' : 'text'),
            attachments: normalizedAttachments,
            flagged: flagForReview,
        });

        if (req.user) {
            await touchMemberActivity(subgrid.tenantId, subgridId, req.user.id);
        }

        // Emit WebSocket event for real-time sync
        websocketService.emitNewMessage('channel', channelId, message);

        // Emit dashboard update for admin dashboards (activity increment)
        websocketService.emitDashboardUpdate(subgrid.tenantId, {
            type: 'new_message',
            subgridId,
            channelId,
        });

        // Send push notifications to offline members in the channel (async, don't block response)
        (async () => {
            try {
                // Get channel info for notification
                const channel = await Channel.findById(channelId);
                if (!channel) return;

                // Get sender info
                const sender = await User.findById(authorId);
                const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Someone';

                // Get all members of the subgrid who might be in this channel
                const members = await SubgridMembership.find({
                    subgridId,
                    status: 'active',
                    userId: { $ne: authorId }, // Exclude sender
                }).select('userId');

                // Send push notification to each offline member
                for (const member of members) {
                    sendPushToOfflineUser(member.userId, 'message', {
                        title: `${senderName} in #${channel.name}`,
                        body: filteredBody.length > 100 ? filteredBody.substring(0, 100) + '...' : filteredBody,
                        data: {
                            type: 'message',
                            subgridId,
                            channelId,
                            messageId: String(message._id),
                            senderId: String(authorId),
                            senderName,
                        },
                        channelId: 'messages',
                    });
                }
            } catch (err) {
                console.error('[createMessage] Push notification error:', err.message);
            }
        })();

        return res.status(201).json({ success: true, data: message });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create message', error: error.message });
    }
};

exports.flagMessage = async (req, res) => {
    console.log('[flagMessage] Called with params:', req.params);
    try {
        const { subgridId, messageId } = req.params;
        const { reason } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            console.log('[flagMessage] Subgrid not found:', subgridId);
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const actorId = req.embed?.userId || req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Message, ModerationFlag } = await getTenantModels(subgrid);

        // Debug: check if message exists
        const existingMessage = await Message.findById(messageId);
        console.log('[flagMessage] Debug:', {
            messageId,
            subgridId,
            existingMessage: existingMessage ? {
                _id: existingMessage._id,
                subgridId: existingMessage.subgridId,
                channelId: existingMessage.channelId,
            } : null,
        });

        // Use findByIdAndUpdate instead of findOneAndUpdate for more reliable matching
        const updated = await Message.findByIdAndUpdate(
            messageId,
            { flagged: true },
            { new: true }
        );
        if (!updated) {
            console.log('[flagMessage] Message not found with ID:', messageId);
            return res.status(404).json({ message: 'Message not found' });
        }

        // Store a snapshot of the content for moderation review
        const contentSnapshot = {
            body: updated.body || '',
            text: updated.text || '',
            authorId: updated.authorId?.toString() || '',
            senderId: updated.senderId?.toString() || '',
            attachments: updated.attachments || [],
            createdAt: updated.createdAt,
        };

        await ModerationFlag.create({
            subgridId: String(subgridId),
            contentType: 'message',
            contentId: String(messageId),
            flaggedBy: String(actorId),
            reason: reason || '',
            contentSnapshot,
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to flag message', error: error.message });
    }
};

exports.listPosts = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { channelId, limit = 50 } = req.query;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        if (!subgrid.settings?.postsEnabled) {
            return res.status(403).json({ message: 'Posts disabled for this subgrid' });
        }

        const { Post, Like, Reshare } = await getTenantModels(subgrid);
        const filter = { subgridId: String(subgridId), status: 'active' };
        if (req.embed?.channelId) {
            if (channelId && channelId !== req.embed.channelId) {
                return res.status(403).json({ message: 'Embed token restricted to a different channel' });
            }
            filter.channelId = req.embed.channelId;
        } else if (channelId) {
            filter.channelId = channelId;
        }

        const posts = await Post.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 200));

        // Get current user's likes and reshares for these posts
        const userId = req.user?.id || req.embed?.userId;
        let userLikes = [];
        let userReshares = [];

        if (userId && posts.length > 0) {
            const postIds = posts.map(p => p._id.toString());
            const [likes, reshares] = await Promise.all([
                Like.find({ subgridId: String(subgridId), postId: { $in: postIds }, userId: String(userId) }),
                Reshare.find({ subgridId: String(subgridId), postId: { $in: postIds }, userId: String(userId) }),
            ]);
            userLikes = likes.map(l => l.postId);
            userReshares = reshares.map(r => r.postId);
        }

        // Add userLiked and userReshared flags to each post
        const postsWithFlags = posts.map(post => {
            const postObj = post.toObject();
            postObj.userLiked = userLikes.includes(post._id.toString());
            postObj.userReshared = userReshares.includes(post._id.toString());
            return postObj;
        });

        return res.status(200).json({ success: true, data: postsWithFlags });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list posts', error: error.message });
    }
};

exports.createPost = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { channelId, title, body, attachments } = req.body;

        if (!channelId || !body) {
            return res.status(400).json({ message: 'channelId and body are required' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        if (!subgrid.settings?.postsEnabled) {
            return res.status(403).json({ message: 'Posts disabled for this subgrid' });
        }

        const authorId = req.user?.id;
        if (!authorId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Channel, Post } = await getTenantModels(subgrid);
        const membership = await getSubgridMembership(subgrid.tenantId, subgridId, req.user.id);
        if (!canWriteInSubgrid(membership)) {
            return res.status(403).json({ message: 'Subgrid access denied' });
        }

        const { error } = await resolveChannelAccess(Channel, subgridId, channelId, membership, null);
        if (error) {
            return res.status(403).json({ message: error });
        }

        // Apply content moderation filter to title and body
        let filteredTitle = title || '';
        let filteredBody = body;
        let flagForReview = false;

        // Check title
        if (filteredTitle) {
            const titleFilterResult = await filterContent(filteredTitle, subgridId);
            if (!titleFilterResult.allowed) {
                return res.status(400).json({
                    message: titleFilterResult.message,
                    code: 'CONTENT_BLOCKED',
                    matchedWords: titleFilterResult.matches,
                });
            }
            filteredTitle = titleFilterResult.censoredContent || filteredTitle;
            flagForReview = flagForReview || titleFilterResult.flagged || false;
        }

        // Check body
        if (filteredBody) {
            const bodyFilterResult = await filterContent(filteredBody, subgridId);
            if (!bodyFilterResult.allowed) {
                return res.status(400).json({
                    message: bodyFilterResult.message,
                    code: 'CONTENT_BLOCKED',
                    matchedWords: bodyFilterResult.matches,
                });
            }
            filteredBody = bodyFilterResult.censoredContent || filteredBody;
            flagForReview = flagForReview || bodyFilterResult.flagged || false;
        }

        const post = await Post.create({
            subgridId: String(subgridId),
            channelId,
            authorId: String(authorId),
            title: filteredTitle,
            body: filteredBody,
            attachments: Array.isArray(attachments) ? attachments : [],
            flagged: flagForReview,
        });

        await touchMemberActivity(subgrid.tenantId, subgridId, req.user.id);

        // Emit WebSocket event for real-time sync
        websocketService.emitPostCreated(subgridId, post);

        // Emit dashboard update for admin dashboards
        websocketService.emitDashboardUpdate(subgrid.tenantId, {
            type: 'new_post',
            subgridId,
        });

        return res.status(201).json({ success: true, data: post });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create post', error: error.message });
    }
};

exports.listComments = async (req, res) => {
    try {
        const { subgridId, postId } = req.params;
        const { limit = 50 } = req.query;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        if (!subgrid.settings?.commentsEnabled) {
            return res.status(403).json({ message: 'Comments disabled for this subgrid' });
        }

        const { Comment } = await getTenantModels(subgrid);
        const comments = await Comment.find({ subgridId: String(subgridId), postId, status: 'active' })
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 200));

        return res.status(200).json({ success: true, data: comments });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list comments', error: error.message });
    }
};

exports.createComment = async (req, res) => {
    try {
        const { subgridId, postId } = req.params;
        const { body } = req.body;

        console.log('[createComment] Attempting to create comment:', { subgridId, postId });

        if (!body) {
            return res.status(400).json({ message: 'body is required' });
        }

        // Validate postId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            console.log('[createComment] Invalid postId format:', postId);
            return res.status(400).json({ message: 'Invalid post ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            console.log('[createComment] Subgrid not found:', subgridId);
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        if (!subgrid.settings?.commentsEnabled) {
            return res.status(403).json({ message: 'Comments disabled for this subgrid' });
        }

        const authorId = req.user?.id;
        if (!authorId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Post, Comment } = await getTenantModels(subgrid);
        const post = await Post.findOne({ _id: postId, subgridId: String(subgridId), status: 'active' });
        console.log('[createComment] Post lookup result:', {
            found: !!post,
            postId,
            subgridId: String(subgridId),
        });
        if (!post) {
            console.log('[createComment] Post not found');
            return res.status(404).json({ message: 'Post not found' });
        }

        // Apply content moderation filter
        let filteredBody = body;
        let flagForReview = false;
        if (body) {
            const filterResult = await filterContent(body, subgridId);
            if (!filterResult.allowed) {
                return res.status(400).json({
                    message: filterResult.message,
                    code: 'CONTENT_BLOCKED',
                    matchedWords: filterResult.matches,
                });
            }
            filteredBody = filterResult.censoredContent || body;
            flagForReview = filterResult.flagged || false;
        }

        const comment = await Comment.create({
            subgridId: String(subgridId),
            postId,
            authorId: String(authorId),
            body: filteredBody,
            flagged: flagForReview,
        });

        // Increment comment count on the post
        await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

        await touchMemberActivity(subgrid.tenantId, subgridId, req.user.id);

        // Emit WebSocket event for real-time sync
        websocketService.emitCommentCreated(subgridId, postId, comment);

        // Emit dashboard update for admin dashboards
        websocketService.emitDashboardUpdate(subgrid.tenantId, {
            type: 'new_comment',
            subgridId,
            postId,
        });

        return res.status(201).json({ success: true, data: comment });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create comment', error: error.message });
    }
};

exports.flagPost = async (req, res) => {
    console.log('[flagPost] Called with params:', req.params);
    try {
        const { subgridId, postId } = req.params;
        const { reason } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            console.log('[flagPost] Subgrid not found:', subgridId);
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const actorId = req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Post, ModerationFlag } = await getTenantModels(subgrid);

        // First try to find the post by ID only to debug
        const existingPost = await Post.findById(postId);
        console.log('[flagPost] Debug:', {
            postId,
            subgridId,
            existingPost: existingPost ? {
                _id: existingPost._id,
                subgridId: existingPost.subgridId,
                subgridIdType: typeof existingPost.subgridId,
            } : null,
        });

        // Try to match by _id only since subgridId might be stored differently
        const updated = await Post.findByIdAndUpdate(
            postId,
            { flagged: true },
            { new: true }
        );
        if (!updated) {
            console.log('[flagPost] Post not found with ID:', postId);
            return res.status(404).json({ message: 'Post not found' });
        }

        // Store a snapshot of the content for moderation review
        const contentSnapshot = {
            body: updated.body || '',
            title: updated.title || '',
            authorId: updated.authorId?.toString() || '',
            attachments: updated.attachments || [],
            createdAt: updated.createdAt,
        };

        await ModerationFlag.create({
            subgridId: String(subgridId),
            contentType: 'post',
            contentId: String(postId),
            flaggedBy: String(actorId),
            reason: reason || '',
            contentSnapshot,
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to flag post', error: error.message });
    }
};

exports.flagComment = async (req, res) => {
    try {
        const { subgridId, commentId } = req.params;
        const { reason } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const actorId = req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Comment, ModerationFlag } = await getTenantModels(subgrid);
        const updated = await Comment.findOneAndUpdate(
            { _id: commentId, subgridId: String(subgridId) },
            { flagged: true },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Store a snapshot of the content for moderation review
        const contentSnapshot = {
            body: updated.body || '',
            text: updated.text || '',
            authorId: updated.authorId?.toString() || '',
            postId: updated.postId?.toString() || '',
            createdAt: updated.createdAt,
        };

        await ModerationFlag.create({
            subgridId: String(subgridId),
            contentType: 'comment',
            contentId: String(commentId),
            flaggedBy: String(actorId),
            reason: reason || '',
            contentSnapshot,
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to flag comment', error: error.message });
    }
};

exports.addReaction = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { targetType, targetId, emoji } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!targetType || !targetId || !emoji) {
            return res.status(400).json({ message: 'targetType, targetId, and emoji are required' });
        }

        const { Reaction, Message, Post, Comment } = await getTenantModels(subgrid);
        const lookup = {
            message: Message,
            post: Post,
            comment: Comment,
        };
        const Model = lookup[targetType];
        if (!Model) {
            return res.status(400).json({ message: 'Invalid target type' });
        }

        const target = await Model.findOne({ _id: targetId, subgridId: String(subgridId), status: 'active' });
        if (!target) {
            return res.status(404).json({ message: 'Target not found' });
        }

        const reaction = await Reaction.findOneAndUpdate(
            { subgridId: String(subgridId), targetType, targetId, userId: String(userId), emoji },
            { subgridId: String(subgridId), targetType, targetId, userId: String(userId), emoji },
            { upsert: true, new: true }
        );

        return res.status(201).json({ success: true, data: reaction });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to add reaction', error: error.message });
    }
};

exports.removeReaction = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { targetType, targetId, emoji } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        await (await getTenantModels(subgrid)).Reaction.findOneAndDelete({
            subgridId: String(subgridId),
            targetType,
            targetId,
            userId: String(userId),
            emoji,
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to remove reaction', error: error.message });
    }
};

exports.likePost = async (req, res) => {
    try {
        const { subgridId, postId } = req.params;

        console.log('[likePost] Attempting to like post:', { subgridId, postId });

        // Validate postId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            console.log('[likePost] Invalid postId format:', postId);
            return res.status(400).json({ message: 'Invalid post ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            console.log('[likePost] Subgrid not found:', subgridId);
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Post, Like } = await getTenantModels(subgrid);
        // Use findById for more reliable ObjectId matching, then verify subgridId and status
        const post = await Post.findById(postId);
        console.log('[likePost] Post lookup result:', {
            found: !!post,
            postSubgridId: post?.subgridId,
            paramSubgridId: String(subgridId),
            postStatus: post?.status,
            subgridMatch: post ? post.subgridId === String(subgridId) : false,
        });
        if (!post || post.subgridId !== String(subgridId) || post.status !== 'active') {
            console.log('[likePost] Post not found or validation failed');
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if already liked - use String(postId) for consistent comparison
        const existingLike = await Like.findOne({
            subgridId: String(subgridId),
            postId: String(postId),
            userId: String(userId),
        });

        if (existingLike) {
            return res.status(400).json({ message: 'Already liked this post' });
        }

        // Create like and increment count atomically - store postId as string
        await Like.create({
            subgridId: String(subgridId),
            postId: String(postId),
            userId: String(userId),
        });

        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $inc: { likeCount: 1 } },
            { new: true }
        );

        // Emit WebSocket event for real-time sync
        websocketService.sendToRoom('subgrid', subgridId, 'post_liked', {
            subgridId,
            postId,
            userId,
            likeCount: updatedPost.likeCount,
            timestamp: new Date().toISOString(),
        });

        return res.status(201).json({
            success: true,
            data: {
                postId,
                likeCount: updatedPost.likeCount,
                liked: true,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to like post', error: error.message });
    }
};

exports.unlikePost = async (req, res) => {
    try {
        const { subgridId, postId } = req.params;

        // Validate postId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ message: 'Invalid post ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Post, Like } = await getTenantModels(subgrid);

        // Check if like exists - use String(postId) for consistent comparison
        const existingLike = await Like.findOne({
            subgridId: String(subgridId),
            postId: String(postId),
            userId: String(userId),
        });

        if (!existingLike) {
            return res.status(400).json({ message: 'Post not liked' });
        }

        // Remove like and decrement count
        await Like.findByIdAndDelete(existingLike._id);

        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $inc: { likeCount: -1 } },
            { new: true }
        );

        // Emit WebSocket event for real-time sync
        websocketService.sendToRoom('subgrid', subgridId, 'post_unliked', {
            subgridId,
            postId,
            userId,
            likeCount: Math.max(0, updatedPost?.likeCount || 0),
            timestamp: new Date().toISOString(),
        });

        return res.status(200).json({
            success: true,
            data: {
                postId,
                likeCount: Math.max(0, updatedPost?.likeCount || 0),
                liked: false,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to unlike post', error: error.message });
    }
};

exports.resharePost = async (req, res) => {
    try {
        const { subgridId, postId } = req.params;
        const { comment } = req.body;

        console.log('[resharePost] Attempting to reshare post:', { subgridId, postId });

        // Validate postId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            console.log('[resharePost] Invalid postId format:', postId);
            return res.status(400).json({ message: 'Invalid post ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            console.log('[resharePost] Subgrid not found:', subgridId);
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Post, Reshare } = await getTenantModels(subgrid);
        // Use findById for more reliable ObjectId matching, then verify subgridId and status
        const post = await Post.findById(postId);
        console.log('[resharePost] Post lookup result:', {
            found: !!post,
            postSubgridId: post?.subgridId,
            paramSubgridId: String(subgridId),
            postStatus: post?.status,
            subgridMatch: post ? post.subgridId === String(subgridId) : false,
        });
        if (!post || post.subgridId !== String(subgridId) || post.status !== 'active') {
            console.log('[resharePost] Post not found or validation failed');
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if already reshared - use String(postId) for consistent comparison
        const existingReshare = await Reshare.findOne({
            subgridId: String(subgridId),
            postId: String(postId),
            userId: String(userId),
        });

        if (existingReshare) {
            return res.status(400).json({ message: 'Already reshared this post' });
        }

        // Create reshare and increment count - store postId as string
        const reshare = await Reshare.create({
            subgridId: String(subgridId),
            postId: String(postId),
            userId: String(userId),
            comment: comment || '',
        });

        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $inc: { reshareCount: 1 } },
            { new: true }
        );

        // Emit WebSocket event for real-time sync
        websocketService.sendToRoom('subgrid', subgridId, 'post_reshared', {
            subgridId,
            postId,
            userId,
            reshareCount: updatedPost.reshareCount,
            reshare,
            timestamp: new Date().toISOString(),
        });

        // Emit dashboard update
        websocketService.emitDashboardUpdate(subgrid.tenantId, {
            type: 'post_reshared',
            subgridId,
            postId,
        });

        return res.status(201).json({
            success: true,
            data: {
                postId,
                reshareCount: updatedPost.reshareCount,
                reshare,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to reshare post', error: error.message });
    }
};

exports.unresharePost = async (req, res) => {
    try {
        const { subgridId, postId } = req.params;

        // Validate postId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ message: 'Invalid post ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Post, Reshare } = await getTenantModels(subgrid);

        // Check if reshare exists - use String(postId) for consistent comparison
        const existingReshare = await Reshare.findOne({
            subgridId: String(subgridId),
            postId: String(postId),
            userId: String(userId),
        });

        if (!existingReshare) {
            return res.status(400).json({ message: 'Post not reshared' });
        }

        // Remove reshare and decrement count
        await Reshare.findByIdAndDelete(existingReshare._id);

        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $inc: { reshareCount: -1 } },
            { new: true }
        );

        // Emit WebSocket event for real-time sync
        websocketService.sendToRoom('subgrid', subgridId, 'post_unreshared', {
            subgridId,
            postId,
            userId,
            reshareCount: Math.max(0, updatedPost?.reshareCount || 0),
            timestamp: new Date().toISOString(),
        });

        return res.status(200).json({
            success: true,
            data: {
                postId,
                reshareCount: Math.max(0, updatedPost?.reshareCount || 0),
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to unreshare post', error: error.message });
    }
};

exports.getPostEngagement = async (req, res) => {
    try {
        const { subgridId, postId } = req.params;

        // Validate postId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ message: 'Invalid post ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        const { Post, Like, Reshare, Comment } = await getTenantModels(subgrid);

        // Use findById for more reliable ObjectId matching
        const post = await Post.findById(postId);
        if (!post || post.subgridId !== String(subgridId) || post.status !== 'active') {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if current user has liked/reshared - use String(postId) for consistent comparison
        let userLiked = false;
        let userReshared = false;

        if (userId) {
            const [like, reshare] = await Promise.all([
                Like.findOne({ subgridId: String(subgridId), postId: String(postId), userId: String(userId) }),
                Reshare.findOne({ subgridId: String(subgridId), postId: String(postId), userId: String(userId) }),
            ]);
            userLiked = Boolean(like);
            userReshared = Boolean(reshare);
        }

        // Get actual counts - use String(postId) for consistent comparison
        const [likeCount, reshareCount, commentCount] = await Promise.all([
            Like.countDocuments({ subgridId: String(subgridId), postId: String(postId) }),
            Reshare.countDocuments({ subgridId: String(subgridId), postId: String(postId) }),
            Comment.countDocuments({ subgridId: String(subgridId), postId: String(postId), status: 'active' }),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                postId,
                likeCount,
                reshareCount,
                commentCount,
                userLiked,
                userReshared,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to get post engagement', error: error.message });
    }
};

exports.listDirectMessages = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { peerId, limit = 50 } = req.query;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        if (!subgrid.settings?.directMessagesEnabled) {
            return res.status(403).json({ message: 'Direct messages disabled for this subgrid' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!peerId) {
            return res.status(400).json({ message: 'peerId is required' });
        }

        if (await isBlockedPair(subgridId, userId, peerId)) {
            return res.status(403).json({ message: 'Direct messages blocked' });
        }

        const isFriend = await hasFriendship(subgridId, userId, peerId);
        if (!isFriend) {
            return res.status(403).json({ message: 'Friendship required to view messages' });
        }

        const { DirectMessage } = await getTenantModels(subgrid);
        const messages = await DirectMessage.find({
            subgridId: String(subgridId),
            status: 'active',
            $or: [
                { senderId: String(userId), recipientId: String(peerId) },
                { senderId: String(peerId), recipientId: String(userId) },
            ],
        })
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 200));

        // Fetch call history between these two users and merge with messages
        const Call = require('../models/Call');
        const callHistory = await Call.find({
            callContext: 'dm',
            status: { $in: ['ended', 'missed', 'declined'] },
            $or: [
                { 'dmPeers.callerId': userId, 'dmPeers.calleeId': peerId },
                { 'dmPeers.callerId': peerId, 'dmPeers.calleeId': userId },
            ],
        })
            .sort({ initiatedAt: -1 })
            .limit(Math.min(Number(limit), 50));

        // Convert calls to message-like format for display in chat
        const callMessages = callHistory.map(call => ({
            _id: `call_${call.callId}`,
            senderId: call.dmPeers.callerId.toString(),
            recipientId: call.dmPeers.calleeId.toString(),
            kind: 'call',
            callType: call.callType === 'audio' ? 'voice' : 'video',
            callStatus: call.status,
            callDuration: call.duration || 0,
            createdAt: call.initiatedAt,
            // For UI: determine if this was incoming or outgoing for current user
            isOutgoing: call.dmPeers.callerId.toString() === userId,
            isMissed: call.status === 'missed',
            isDeclined: call.status === 'declined',
        }));

        // Merge messages and calls, sort by date descending
        const allItems = [...messages.map(m => m.toObject()), ...callMessages];
        allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply limit to combined results
        const limitedItems = allItems.slice(0, Math.min(Number(limit), 200));

        return res.status(200).json({ success: true, data: limitedItems });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list direct messages', error: error.message });
    }
};

exports.createDirectMessage = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { recipientId, body, kind, attachments } = req.body;
        const normalizedBody = typeof body === 'string' ? body.trim() : '';
        const normalizedAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

        if (!recipientId || (!normalizedBody && normalizedAttachments.length === 0)) {
            return res.status(400).json({ message: 'recipientId and body or attachments are required' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        if (!subgrid.settings?.directMessagesEnabled) {
            return res.status(403).json({ message: 'Direct messages disabled for this subgrid' });
        }

        const senderId = req.user?.id;
        if (!senderId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { DirectMessage } = await getTenantModels(subgrid);
        if (await isBlockedPair(subgridId, senderId, recipientId)) {
            return res.status(403).json({ message: 'Direct messages blocked' });
        }

        const isFriend = await hasFriendship(subgridId, senderId, recipientId);
        if (!isFriend) {
            return res.status(403).json({ message: 'Friendship required to send messages' });
        }

        // Apply content moderation filter
        let filteredBody = normalizedBody;
        let flagForReview = false;
        if (normalizedBody) {
            const filterResult = await filterContent(normalizedBody, subgridId);
            if (!filterResult.allowed) {
                return res.status(400).json({
                    message: filterResult.message,
                    code: 'CONTENT_BLOCKED',
                    matchedWords: filterResult.matches,
                });
            }
            filteredBody = filterResult.censoredContent || normalizedBody;
            flagForReview = filterResult.flagged || false;
        }

        const message = await DirectMessage.create({
            subgridId: String(subgridId),
            senderId: String(senderId),
            recipientId: String(recipientId),
            body: filteredBody,
            kind: kind || (normalizedAttachments.length > 0 ? 'audio' : 'text'),
            attachments: normalizedAttachments,
            flagged: flagForReview,
        });

        await touchMemberActivity(subgrid.tenantId, subgridId, senderId);

        // Emit WebSocket event for real-time sync to both sender and recipient
        // IMPORTANT: Use String() to ensure consistent room ID format across web and mobile
        const dmRoomId = [String(senderId), String(recipientId)].sort().join('_');

        // Convert Mongoose document to plain object with stringified IDs for WebSocket
        const messageForWs = {
            ...message.toObject(),
            _id: String(message._id),
            senderId: String(message.senderId),
            recipientId: String(message.recipientId),
            subgridId: String(message.subgridId),
        };

        console.log('[createDirectMessage] Emitting to DM room:', dmRoomId, 'messageForWs:', JSON.stringify({ senderId: messageForWs.senderId, recipientId: messageForWs.recipientId }));
        websocketService.emitNewMessage('dm', dmRoomId, messageForWs);
        // Also send directly to BOTH sender and recipient for immediate notification
        // This ensures both parties see the message even if they haven't joined the DM room yet
        const dmEventData = {
            roomType: 'dm',
            roomId: dmRoomId,
            message: messageForWs,
            timestamp: new Date().toISOString(),
        };
        console.log('[createDirectMessage] Sending to user rooms: user:', String(senderId), 'and user:', String(recipientId));
        websocketService.sendToUser(String(recipientId), 'new_message', dmEventData);
        websocketService.sendToUser(String(senderId), 'new_message', dmEventData);

        // Send push notification to recipient if offline (async, don't block response)
        (async () => {
            try {
                const sender = await User.findById(senderId);
                const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Someone';

                sendPushToOfflineUser(recipientId, 'dm', {
                    title: senderName,
                    body: filteredBody.length > 100 ? filteredBody.substring(0, 100) + '...' : filteredBody,
                    data: {
                        type: 'dm',
                        subgridId,
                        senderId: String(senderId),
                        senderName,
                        messageId: String(message._id),
                    },
                    channelId: 'messages',
                });
            } catch (err) {
                console.error('[createDirectMessage] Push notification error:', err.message);
            }
        })();

        return res.status(201).json({ success: true, data: message });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create direct message', error: error.message });
    }
};

exports.flagDirectMessage = async (req, res) => {
    try {
        const { subgridId, directMessageId } = req.params;
        const { reason } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const actorId = req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { DirectMessage, ModerationFlag } = await getTenantModels(subgrid);
        const updated = await DirectMessage.findOneAndUpdate(
            { _id: directMessageId, subgridId: String(subgridId) },
            { flagged: true },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ message: 'Direct message not found' });
        }

        await ModerationFlag.create({
            subgridId: String(subgridId),
            contentType: 'direct_message',
            contentId: String(directMessageId),
            flaggedBy: String(actorId),
            reason: reason || '',
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to flag direct message', error: error.message });
    }
};

exports.deleteDirectMessage = async (req, res) => {
    try {
        const { subgridId, directMessageId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        if (!subgrid.settings?.directMessagesEnabled) {
            return res.status(403).json({ message: 'Direct messages disabled for this subgrid' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { DirectMessage } = await getTenantModels(subgrid);
        const message = await DirectMessage.findOne({
            _id: directMessageId,
            subgridId: String(subgridId),
        });
        if (!message) {
            return res.status(404).json({ message: 'Direct message not found' });
        }

        const isSender = String(message.senderId) === String(userId);
        if (!isSender) {
            return res.status(403).json({ message: 'You can only delete your own messages' });
        }

        await DirectMessage.findByIdAndUpdate(directMessageId, { status: 'removed' });

        const dmRoomId = [message.senderId, message.recipientId].sort().join('_');
        websocketService.emitMessageDeleted('dm', dmRoomId, String(directMessageId));

        return res.status(200).json({ success: true, message: 'Direct message deleted' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete direct message', error: error.message });
    }
};

const mapUsersById = async (ids) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean).map((id) => String(id))));
    if (uniqueIds.length === 0) {
        return {};
    }
    const users = await User.find({ _id: { $in: uniqueIds } });
    return users.reduce((acc, user) => {
        acc[String(user._id)] = {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            username: user.username,
            avatarUrl: user.avatarUrl,
            bannerUrl: user.bannerUrl,
            role: user.role || 'member',
            stakeholderBadge: user.stakeholderBadge || null,
            company: user.company || null,
        };
        return acc;
    }, {});
};

exports.listFriends = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const friendships = await Friendship.find({ subgridId, userId });
        const friendIds = friendships.map((friend) => String(friend.friendId));
        const users = await mapUsersById(friendIds);

        return res.status(200).json({ success: true, data: { friends: friendIds, users } });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list friends', error: error.message });
    }
};

exports.listMutualFriends = async (req, res) => {
    try {
        const { subgridId, peerId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (!peerId) {
            return res.status(400).json({ message: 'peerId is required' });
        }

        const isFriend = await hasFriendship(subgridId, userId, peerId);
        if (!isFriend) {
            return res.status(403).json({ message: 'Friendship required to view mutual friends' });
        }

        const [myFriendships, peerFriendships] = await Promise.all([
            Friendship.find({ subgridId, userId }).select('friendId').lean(),
            Friendship.find({ subgridId, userId: peerId }).select('friendId').lean(),
        ]);

        const myFriendSet = new Set(myFriendships.map((friend) => String(friend.friendId)));
        const mutualIds = peerFriendships
            .map((friend) => String(friend.friendId))
            .filter((id) => myFriendSet.has(id));

        const uniqueMutualIds = [...new Set(mutualIds)];
        const users = await mapUsersById(uniqueMutualIds);

        return res.status(200).json({ success: true, data: { friends: uniqueMutualIds, users } });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list mutual friends', error: error.message });
    }
};

exports.listBlockedFriends = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const blocks = await FriendBlock.find({ subgridId, blockerId: userId });
        const blockedIds = blocks.map((block) => String(block.blockedId));
        const users = await mapUsersById(blockedIds);

        return res.status(200).json({ success: true, data: { blocked: blockedIds, users } });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list blocked users', error: error.message });
    }
};

exports.listFriendRequests = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const userId = req.user?.id;
        const direction = req.query.direction || 'incoming';
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const baseFilter = { subgridId, status: 'pending' };
        let filter = baseFilter;
        if (direction === 'outgoing') {
            filter = { ...baseFilter, requesterId: userId };
        } else if (direction === 'all') {
            filter = {
                ...baseFilter,
                $or: [{ requesterId: userId }, { recipientId: userId }],
            };
        } else {
            filter = { ...baseFilter, recipientId: userId };
        }

        const requests = await FriendRequest.find(filter).sort({ createdAt: -1 });
        const userIds = requests.flatMap((request) => [String(request.requesterId), String(request.recipientId)]);
        const users = await mapUsersById(userIds);

        return res.status(200).json({
            success: true,
            data: requests.map((request) => ({
                id: String(request._id),
                requesterId: String(request.requesterId),
                recipientId: String(request.recipientId),
                status: request.status,
                createdAt: request.createdAt,
                requester: users[String(request.requesterId)] || null,
                recipient: users[String(request.recipientId)] || null,
            })),
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list friend requests', error: error.message });
    }
};

exports.createFriendRequest = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { recipientId } = req.body;
        const requesterId = req.user?.id;

        if (!requesterId) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (!recipientId) {
            return res.status(400).json({ message: 'recipientId is required' });
        }
        if (String(recipientId) === String(requesterId)) {
            return res.status(400).json({ message: 'Cannot friend yourself' });
        }

        if (await isBlockedPair(subgridId, requesterId, recipientId)) {
            return res.status(403).json({ message: 'Friend request blocked' });
        }

        const existingFriendship = await Friendship.findOne({
            subgridId,
            userId: requesterId,
            friendId: recipientId,
        });
        if (existingFriendship) {
            return res.status(200).json({ success: true, data: existingFriendship });
        }

        // Auto-accept: create friendship for both users immediately
        await Friendship.findOneAndUpdate(
            { subgridId, userId: requesterId, friendId: recipientId },
            { subgridId, userId: requesterId, friendId: recipientId },
            { upsert: true, new: true }
        );
        await Friendship.findOneAndUpdate(
            { subgridId, userId: recipientId, friendId: requesterId },
            { subgridId, userId: recipientId, friendId: requesterId },
            { upsert: true, new: true }
        );

        return res.status(201).json({ success: true, message: 'Friend added' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to add friend', error: error.message });
    }
};

exports.acceptFriendRequest = async (req, res) => {
    try {
        const { subgridId, requestId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: 'Invalid request ID format' });
        }

        const request = await FriendRequest.findOne({ _id: requestId, subgridId, status: 'pending' });

        if (!request) {
            return res.status(404).json({ message: 'Friend request not found' });
        }
        if (String(request.recipientId) !== String(userId)) {
            return res.status(403).json({ message: 'Not allowed to accept this request' });
        }

        request.status = 'accepted';
        await request.save();

        await Friendship.findOneAndUpdate(
            { subgridId, userId: request.requesterId, friendId: request.recipientId },
            { subgridId, userId: request.requesterId, friendId: request.recipientId },
            { upsert: true, new: true }
        );
        await Friendship.findOneAndUpdate(
            { subgridId, userId: request.recipientId, friendId: request.requesterId },
            { subgridId, userId: request.recipientId, friendId: request.requesterId },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        logger.error('acceptFriendRequest', 'Failed to accept friend request', { error: error.message });
        return res.status(500).json({ message: 'Failed to accept friend request', error: error.message });
    }
};

exports.declineFriendRequest = async (req, res) => {
    try {
        const { subgridId, requestId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const request = await FriendRequest.findOne({ _id: requestId, subgridId, status: 'pending' });
        if (!request) {
            return res.status(404).json({ message: 'Friend request not found' });
        }
        if (String(request.recipientId) !== String(userId)) {
            return res.status(403).json({ message: 'Not allowed to decline this request' });
        }

        request.status = 'declined';
        await request.save();

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to decline friend request', error: error.message });
    }
};

exports.removeFriend = async (req, res) => {
    try {
        const { subgridId, friendId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        await Friendship.deleteMany({
            subgridId,
            $or: [
                { userId, friendId },
                { userId: friendId, friendId: userId },
            ],
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to remove friend', error: error.message });
    }
};

exports.blockFriend = async (req, res) => {
    try {
        const { subgridId, friendId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        await Friendship.deleteMany({
            subgridId,
            $or: [
                { userId, friendId },
                { userId: friendId, friendId: userId },
            ],
        });
        await FriendRequest.deleteMany({
            subgridId,
            $or: [
                { requesterId: userId, recipientId: friendId },
                { requesterId: friendId, recipientId: userId },
            ],
        });

        await FriendBlock.findOneAndUpdate(
            { subgridId, blockerId: userId, blockedId: friendId },
            { subgridId, blockerId: userId, blockedId: friendId },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to block friend', error: error.message });
    }
};

exports.unblockFriend = async (req, res) => {
    try {
        const { subgridId, friendId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        await FriendBlock.deleteMany({ subgridId, blockerId: userId, blockedId: friendId });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to unblock friend', error: error.message });
    }
};

exports.listModerationQueue = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { ModerationFlag, Message, Post, Comment, DirectMessage } = await getTenantModels(subgrid);
        const flags = await ModerationFlag.find({ subgridId: String(subgridId), status: 'open' })
            .sort({ createdAt: -1 });

        console.log('[listModerationQueue] Found flags:', flags.length);

        const contentMap = {
            message: Message,
            post: Post,
            comment: Comment,
            direct_message: DirectMessage,
        };

        const enriched = await Promise.all(flags.map(async (flag) => {
            const Model = contentMap[flag.contentType];
            console.log('[listModerationQueue] Processing flag:', {
                flagId: flag._id,
                contentType: flag.contentType,
                contentId: flag.contentId,
                hasModel: !!Model,
            });

            let content = null;
            if (Model) {
                try {
                    // Try to find by _id first
                    content = await Model.findById(flag.contentId);
                    console.log('[listModerationQueue] Content lookup result:', {
                        contentId: flag.contentId,
                        found: !!content,
                        contentBody: content?.body?.substring(0, 50) || content?.text?.substring(0, 50) || null,
                    });
                } catch (lookupErr) {
                    console.error('[listModerationQueue] Content lookup error:', lookupErr.message);
                }
            }

            // If content was deleted, use the stored snapshot
            if (!content && flag.contentSnapshot) {
                console.log('[listModerationQueue] Using contentSnapshot for deleted content:', flag.contentId);
                content = {
                    ...flag.contentSnapshot,
                    _deleted: true, // Mark as deleted for frontend display
                };
            }

            return { ...flag.toObject(), content };
        }));

        return res.status(200).json({ success: true, data: enriched });
    } catch (error) {
        console.error('[listModerationQueue] Error:', error);
        return res.status(500).json({ message: 'Failed to load moderation queue', error: error.message });
    }
};

exports.moderateFlag = async (req, res) => {
    try {
        const { subgridId, flagId } = req.params;
        const { action, reason, mutedUntil } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { ModerationFlag, Message, Post, Comment, DirectMessage, Notification, AuditLog } = await getTenantModels(subgrid);
        const flag = await ModerationFlag.findOne({ _id: flagId, subgridId: String(subgridId) });
        if (!flag) {
            return res.status(404).json({ message: 'Flag not found' });
        }

        const modelMap = {
            message: Message,
            post: Post,
            comment: Comment,
            direct_message: DirectMessage,
        };
        const Model = modelMap[flag.contentType];
        const content = Model ? await Model.findById(flag.contentId) : null;
        const targetUserId = content ? (content.authorId || content.senderId) : '';

        const now = new Date();
        if (action === 'approve' && content) {
            content.flagged = false;
            await content.save();
        }
        if (action === 'remove' && content) {
            content.status = 'removed';
            content.flagged = false;
            await content.save();
        }
        if (action === 'warn' && targetUserId) {
            await Notification.create({
                subgridId: String(subgridId),
                userId: String(targetUserId),
                type: 'moderation_warning',
                payload: { reason: reason || 'Content warning' },
            });
        }
        if (action === 'mute' && targetUserId) {
            await SubgridMembership.findOneAndUpdate(
                { tenantId: subgrid.tenantId, subgridId, userId: targetUserId },
                { status: 'muted', mutedUntil: mutedUntil ? new Date(mutedUntil) : new Date(now.getTime() + 24 * 3600 * 1000) },
                { new: true }
            );
        }
        if (action === 'ban' && targetUserId) {
            await SubgridMembership.findOneAndUpdate(
                { tenantId: subgrid.tenantId, subgridId, userId: targetUserId },
                { status: 'suspended', mutedUntil: null },
                { new: true }
            );
        }

        flag.status = 'reviewed';
        flag.resolvedBy = String(req.user.id);
        flag.resolvedAt = now;
        await flag.save();

        await recordAudit(AuditLog, subgridId, req.user.id, `moderation_${action}`, {
            targetType: flag.contentType,
            targetId: String(flag.contentId),
            reason: reason || '',
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to moderate content', error: error.message });
    }
};

exports.listAuditLog = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { limit = 50 } = req.query;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { AuditLog } = await getTenantModels(subgrid);
        const logs = await AuditLog.find({ subgridId: String(subgridId) })
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 200));

        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load audit log', error: error.message });
    }
};

exports.getSubgridAnalytics = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Channel, Message, Post, Comment, ModerationFlag } = await getTenantModels(subgrid);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [memberCount, activeMembers, channelCount, messageCount, postCount, commentCount, flaggedCount] = await Promise.all([
            SubgridMembership.countDocuments({ subgridId }),
            SubgridMembership.countDocuments({ subgridId, lastActiveAt: { $gte: sevenDaysAgo } }),
            Channel.countDocuments({ subgridId: String(subgridId), status: 'active' }),
            Message.countDocuments({ subgridId: String(subgridId), status: 'active' }),
            Post.countDocuments({ subgridId: String(subgridId), status: 'active' }),
            Comment.countDocuments({ subgridId: String(subgridId), status: 'active' }),
            ModerationFlag.countDocuments({ subgridId: String(subgridId), status: 'open' }),
        ]);

        const activityStart = new Date();
        activityStart.setDate(activityStart.getDate() - 6);
        activityStart.setHours(0, 0, 0, 0);

        const [messageActivity, postActivity] = await Promise.all([
            Message.aggregate([
                { $match: { subgridId: String(subgridId), status: 'active', createdAt: { $gte: activityStart } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Post.aggregate([
                { $match: { subgridId: String(subgridId), status: 'active', createdAt: { $gte: activityStart } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const activityMap = {};
        messageActivity.forEach((entry) => {
            activityMap[entry._id] = (activityMap[entry._id] || 0) + entry.count;
        });
        postActivity.forEach((entry) => {
            activityMap[entry._id] = (activityMap[entry._id] || 0) + entry.count;
        });
        const activity = Object.keys(activityMap)
            .sort()
            .map((date) => ({ date, count: activityMap[date] }));

        const topContributors = await Message.aggregate([
            { $match: { subgridId: String(subgridId), status: 'active' } },
            { $group: { _id: '$authorId', messages: { $sum: 1 } } },
            { $sort: { messages: -1 } },
            { $limit: 5 },
        ]);

        return res.status(200).json({
            success: true,
            data: {
                members: memberCount,
                activeMembers,
                channels: channelCount,
                messages: messageCount,
                posts: postCount,
                comments: commentCount,
                flagged: flaggedCount,
                activity,
                topContributors,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load analytics', error: error.message });
    }
};

exports.listNotifications = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { limit = 50 } = req.query;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Notification } = await getTenantModels(subgrid);
        const notifications = await Notification.find({ subgridId: String(subgridId), userId: String(userId) })
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 200));

        return res.status(200).json({ success: true, data: notifications });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load notifications', error: error.message });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const { subgridId, notificationId } = req.params;
        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Notification } = await getTenantModels(subgrid);
        const updated = await Notification.findOneAndUpdate(
            { _id: notificationId, subgridId: String(subgridId), userId: String(userId) },
            { readAt: new Date() },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update notification', error: error.message });
    }
};

// ==================== PRESENCE / ONLINE STATUS ====================

/**
 * Update user presence (heartbeat)
 * POST /subgrids/:subgridId/presence
 */
exports.updatePresence = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { online = true, status = 'online', statusMessage = '', device = 'web' } = req.body;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Update or create presence record
        const presence = await UserPresence.findOneAndUpdate(
            { userId, subgridId },
            {
                $set: {
                    online,
                    status: online ? status : 'offline',
                    statusMessage,
                    device,
                    lastHeartbeat: new Date(),
                    lastSeen: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        // Also update SubgridMembership lastActiveAt
        await touchMemberActivity(subgrid.tenantId, subgridId, userId);

        return res.status(200).json({ success: true, data: presence });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update presence', error: error.message });
    }
};

/**
 * Get online status for multiple users
 * GET /subgrids/:subgridId/presence?userIds=id1,id2,id3
 */
exports.getPresence = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { userIds } = req.query;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        if (!userIds) {
            return res.status(400).json({ message: 'userIds query parameter required' });
        }

        const userIdList = userIds.split(',').filter(Boolean);
        if (userIdList.length === 0) {
            return res.status(200).json({ success: true, data: {} });
        }

        // Fetch presence records
        const presenceRecords = await UserPresence.find({
            subgridId,
            userId: { $in: userIdList },
        });

        // Build response object
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const result = {};

        userIdList.forEach((id) => {
            const presence = presenceRecords.find((p) => String(p.userId) === id);
            if (presence) {
                // User is online if heartbeat is within last 5 minutes
                result[id] = presence.online && new Date(presence.lastHeartbeat) > fiveMinutesAgo;
            } else {
                result[id] = false;
            }
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to get presence', error: error.message });
    }
};

/**
 * Get detailed presence info for a single user
 * GET /subgrids/:subgridId/presence/:userId
 */
exports.getUserPresence = async (req, res) => {
    try {
        const { subgridId, userId: targetUserId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const presence = await UserPresence.findOne({ subgridId, userId: targetUserId });
        if (!presence) {
            return res.status(200).json({
                success: true,
                data: {
                    userId: targetUserId,
                    online: false,
                    status: 'offline',
                    lastSeen: null,
                },
            });
        }

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isOnline = presence.online && new Date(presence.lastHeartbeat) > fiveMinutesAgo;

        return res.status(200).json({
            success: true,
            data: {
                userId: presence.userId,
                online: isOnline,
                status: isOnline ? presence.status : 'offline',
                statusMessage: presence.statusMessage,
                lastSeen: presence.lastSeen,
                device: presence.device,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to get user presence', error: error.message });
    }
};

/**
 * Set user offline (disconnect)
 * DELETE /subgrids/:subgridId/presence
 */
exports.setOffline = async (req, res) => {
    try {
        const { subgridId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        await UserPresence.findOneAndUpdate(
            { userId, subgridId },
            {
                $set: {
                    online: false,
                    status: 'offline',
                    lastSeen: new Date(),
                },
            }
        );

        return res.status(200).json({ success: true, message: 'User set offline' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to set offline', error: error.message });
    }
};

/**
 * Delete a post
 * DELETE /subgrids/:subgridId/posts/:postId
 * Allowed: post author or subgrid admin/moderator
 */
exports.deletePost = async (req, res) => {
    console.log('[deletePost] Called with params:', req.params);
    try {
        const { subgridId, postId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            console.log('[deletePost] Subgrid not found:', subgridId);
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Post } = await getTenantModels(subgrid);
        const post = await Post.findById(postId);
        console.log('[deletePost] Debug:', {
            postId,
            subgridId,
            userId,
            post: post ? {
                _id: post._id,
                authorId: post.authorId,
                subgridId: post.subgridId,
            } : null,
        });
        if (!post) {
            console.log('[deletePost] Post not found with ID:', postId);
            return res.status(404).json({ message: 'Post not found' });
        }

        const membership = await getSubgridMembership(subgrid.tenantId, subgridId, userId);
        const isAuthor = String(post.authorId) === String(userId);
        const isAdminOrMod = membership && ['subgrid_admin', 'moderator'].includes(membership.role);

        if (!isAuthor && !isAdminOrMod) {
            return res.status(403).json({ message: 'You can only delete your own posts' });
        }

        await Post.findByIdAndDelete(postId);

        return res.status(200).json({ success: true, message: 'Post deleted' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete post', error: error.message });
    }
};

/**
 * Delete a message
 * DELETE /subgrids/:subgridId/messages/:messageId
 * Allowed: message sender or subgrid admin/moderator
 */
exports.deleteMessage = async (req, res) => {
    console.log('[deleteMessage] Called with params:', req.params);
    console.log('[deleteMessage] req.user:', req.user);
    console.log('[deleteMessage] x-user-id header:', req.header('x-user-id'));
    try {
        const { subgridId, messageId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Message } = await getTenantModels(subgrid);
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const membership = await getSubgridMembership(subgrid.tenantId, subgridId, userId);
        // Channel messages use authorId, direct messages use senderId
        const messageAuthorId = message.authorId || message.senderId;
        const isAuthor = String(messageAuthorId) === String(userId);
        const isAdminOrMod = membership && ['subgrid_admin', 'moderator'].includes(membership.role);

        console.log('[deleteMessage] Debug:', {
            messageId,
            userId,
            userIdType: typeof userId,
            messageAuthorId: message.authorId,
            messageAuthorIdType: typeof message.authorId,
            messageSenderId: message.senderId,
            resolvedAuthorId: messageAuthorId,
            resolvedAuthorIdType: typeof messageAuthorId,
            isAuthor,
            stringComparison: `"${String(messageAuthorId)}" === "${String(userId)}"`,
            membershipRole: membership?.role,
            isAdminOrMod,
        });

        if (!isAuthor && !isAdminOrMod) {
            return res.status(403).json({ message: 'You can only delete your own messages' });
        }

        await Message.findByIdAndDelete(messageId);

        return res.status(200).json({ success: true, message: 'Message deleted' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete message', error: error.message });
    }
};

/**
 * Delete a comment
 * DELETE /subgrids/:subgridId/comments/:commentId
 * Allowed: comment author or subgrid admin/moderator
 */
exports.deleteComment = async (req, res) => {
    try {
        const { subgridId, commentId } = req.params;

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Comment } = await getTenantModels(subgrid);
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        const membership = await getSubgridMembership(subgrid.tenantId, subgridId, userId);
        const isAuthor = String(comment.authorId) === String(userId);
        const isAdminOrMod = membership && ['subgrid_admin', 'moderator'].includes(membership.role);

        if (!isAuthor && !isAdminOrMod) {
            return res.status(403).json({ message: 'You can only delete your own comments' });
        }

        await Comment.findByIdAndDelete(commentId);

        return res.status(200).json({ success: true, message: 'Comment deleted' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete comment', error: error.message });
    }
};

// ===================
// CONTENT MODERATION
// ===================

const contentFilterService = require('../services/contentFilterService');

// @desc    Get content moderation settings
// @route   GET /api/community/subgrids/:subgridId/content-moderation
// @access  Admin
exports.getContentModerationSettings = async (req, res) => {
    try {
        const { subgridId } = req.params;

        const settings = await contentFilterService.getModerationSettings(subgridId);
        if (!settings) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        return res.status(200).json({
            success: true,
            data: settings,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to get moderation settings', error: error.message });
    }
};

// @desc    Update content moderation settings
// @route   PATCH /api/community/subgrids/:subgridId/content-moderation
// @access  Admin
exports.updateContentModerationSettings = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { enabled, prohibitedWords, action, blockedMessage } = req.body;

        const settings = await contentFilterService.updateModerationSettings(subgridId, {
            enabled,
            prohibitedWords,
            action,
            blockedMessage,
        });

        return res.status(200).json({
            success: true,
            data: settings,
            message: 'Content moderation settings updated',
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update moderation settings', error: error.message });
    }
};

// @desc    Add prohibited words
// @route   POST /api/community/subgrids/:subgridId/content-moderation/words
// @access  Admin
exports.addProhibitedWords = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { words } = req.body;

        console.log('[addProhibitedWords] Request received:', { subgridId, words, body: req.body });

        if (!words || !Array.isArray(words) || words.length === 0) {
            console.log('[addProhibitedWords] Invalid words array');
            return res.status(400).json({ message: 'Words array is required' });
        }

        console.log('[addProhibitedWords] Calling contentFilterService.addProhibitedWords...');
        const updatedWords = await contentFilterService.addProhibitedWords(subgridId, words);
        console.log('[addProhibitedWords] Updated words:', updatedWords);

        return res.status(200).json({
            success: true,
            data: { prohibitedWords: updatedWords },
            message: `Added ${words.length} word(s) to prohibited list`,
        });
    } catch (error) {
        console.error('[addProhibitedWords] Error:', error);
        return res.status(500).json({ message: 'Failed to add prohibited words', error: error.message });
    }
};

// @desc    Remove prohibited words
// @route   DELETE /api/community/subgrids/:subgridId/content-moderation/words
// @access  Admin
exports.removeProhibitedWords = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { words } = req.body;

        if (!words || !Array.isArray(words) || words.length === 0) {
            return res.status(400).json({ message: 'Words array is required' });
        }

        const updatedWords = await contentFilterService.removeProhibitedWords(subgridId, words);

        return res.status(200).json({
            success: true,
            data: { prohibitedWords: updatedWords },
            message: `Removed ${words.length} word(s) from prohibited list`,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to remove prohibited words', error: error.message });
    }
};

// @desc    Test content against moderation filter
// @route   POST /api/community/subgrids/:subgridId/content-moderation/test
// @access  Admin
exports.testContentFilter = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Content is required' });
        }

        const result = await contentFilterService.filterContent(content, subgridId);

        // Transform to match frontend expected format
        // Frontend expects: { isProhibited, matchedWords, filteredContent }
        // Backend returns: { allowed, matches, censoredContent }
        const transformedResult = {
            isProhibited: !result.allowed,
            matchedWords: result.matches || [],
            filteredContent: result.censoredContent || content,
        };

        return res.status(200).json({
            success: true,
            data: transformedResult,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to test content filter', error: error.message });
    }
};

// ===================
// MESSAGE INTERACTIONS (Like/Reshare/Comment)
// ===================

// @desc    Like a message
// @route   POST /api/community/subgrids/:subgridId/messages/:messageId/like
// @access  Member
exports.likeMessage = async (req, res) => {
    try {
        const { subgridId, messageId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Message, MessageLike } = await getTenantModels(subgrid);
        const message = await Message.findById(messageId);
        if (!message || message.subgridId !== String(subgridId) || message.status !== 'active') {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if already liked
        const existingLike = await MessageLike.findOne({
            subgridId: String(subgridId),
            messageId: String(messageId),
            userId: String(userId),
        });

        if (existingLike) {
            return res.status(400).json({ message: 'Already liked this message' });
        }

        // Create like and increment count
        await MessageLike.create({
            subgridId: String(subgridId),
            messageId: String(messageId),
            userId: String(userId),
        });

        const updatedMessage = await Message.findByIdAndUpdate(
            messageId,
            { $inc: { likeCount: 1 } },
            { new: true }
        );

        // Emit WebSocket event
        websocketService.sendToRoom('subgrid', subgridId, 'message_liked', {
            subgridId,
            messageId,
            userId,
            likeCount: updatedMessage.likeCount,
            timestamp: new Date().toISOString(),
        });

        return res.status(201).json({
            success: true,
            data: {
                messageId,
                likeCount: updatedMessage.likeCount,
                liked: true,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to like message', error: error.message });
    }
};

// @desc    Unlike a message
// @route   DELETE /api/community/subgrids/:subgridId/messages/:messageId/like
// @access  Member
exports.unlikeMessage = async (req, res) => {
    try {
        const { subgridId, messageId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Message, MessageLike } = await getTenantModels(subgrid);

        const existingLike = await MessageLike.findOne({
            subgridId: String(subgridId),
            messageId: String(messageId),
            userId: String(userId),
        });

        if (!existingLike) {
            return res.status(400).json({ message: 'Message not liked' });
        }

        await MessageLike.findByIdAndDelete(existingLike._id);

        const updatedMessage = await Message.findByIdAndUpdate(
            messageId,
            { $inc: { likeCount: -1 } },
            { new: true }
        );

        websocketService.sendToRoom('subgrid', subgridId, 'message_unliked', {
            subgridId,
            messageId,
            userId,
            likeCount: Math.max(0, updatedMessage?.likeCount || 0),
            timestamp: new Date().toISOString(),
        });

        return res.status(200).json({
            success: true,
            data: {
                messageId,
                likeCount: Math.max(0, updatedMessage?.likeCount || 0),
                liked: false,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to unlike message', error: error.message });
    }
};

// @desc    Reshare a message
// @route   POST /api/community/subgrids/:subgridId/messages/:messageId/reshare
// @access  Member
exports.reshareMessage = async (req, res) => {
    try {
        const { subgridId, messageId } = req.params;
        const { comment } = req.body;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Message, MessageReshare } = await getTenantModels(subgrid);
        const originalMessage = await Message.findById(messageId);
        if (!originalMessage || originalMessage.subgridId !== String(subgridId) || originalMessage.status !== 'active') {
            return res.status(404).json({ message: 'Message not found' });
        }

        const existingReshare = await MessageReshare.findOne({
            subgridId: String(subgridId),
            messageId: String(messageId),
            userId: String(userId),
        });

        if (existingReshare) {
            return res.status(400).json({ message: 'Already reshared this message' });
        }

        // Create the reshare record
        const reshare = await MessageReshare.create({
            subgridId: String(subgridId),
            messageId: String(messageId),
            userId: String(userId),
            comment: comment || '',
        });

        // Increment reshare count on original message
        const updatedOriginal = await Message.findByIdAndUpdate(
            messageId,
            { $inc: { reshareCount: 1 } },
            { new: true }
        );

        // Create a new message that represents the reshare (appears in the channel feed)
        const resharedMessage = await Message.create({
            subgridId: String(subgridId),
            channelId: originalMessage.channelId,
            authorId: String(userId),
            body: comment || '',
            kind: 'reshare',
            attachments: [{
                type: 'reshare',
                originalMessageId: String(messageId),
                originalAuthorId: originalMessage.authorId,
                originalBody: originalMessage.body,
                originalAttachments: originalMessage.attachments || [],
                originalCreatedAt: originalMessage.createdAt,
            }],
        });

        // Emit WebSocket event for the new reshared message
        websocketService.emitNewMessage('channel', originalMessage.channelId, resharedMessage);

        websocketService.sendToRoom('subgrid', subgridId, 'message_reshared', {
            subgridId,
            messageId,
            userId,
            reshareCount: updatedOriginal.reshareCount,
            reshare,
            resharedMessage,
            timestamp: new Date().toISOString(),
        });

        return res.status(201).json({
            success: true,
            data: {
                messageId,
                reshareCount: updatedOriginal.reshareCount,
                reshare,
                resharedMessage,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to reshare message', error: error.message });
    }
};

// @desc    Unreshare a message
// @route   DELETE /api/community/subgrids/:subgridId/messages/:messageId/reshare
// @access  Member
exports.unreshareMessage = async (req, res) => {
    try {
        const { subgridId, messageId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Message, MessageReshare } = await getTenantModels(subgrid);

        const existingReshare = await MessageReshare.findOne({
            subgridId: String(subgridId),
            messageId: String(messageId),
            userId: String(userId),
        });

        if (!existingReshare) {
            return res.status(400).json({ message: 'Message not reshared' });
        }

        await MessageReshare.findByIdAndDelete(existingReshare._id);

        const updatedMessage = await Message.findByIdAndUpdate(
            messageId,
            { $inc: { reshareCount: -1 } },
            { new: true }
        );

        websocketService.sendToRoom('subgrid', subgridId, 'message_unreshared', {
            subgridId,
            messageId,
            userId,
            reshareCount: Math.max(0, updatedMessage?.reshareCount || 0),
            timestamp: new Date().toISOString(),
        });

        return res.status(200).json({
            success: true,
            data: {
                messageId,
                reshareCount: Math.max(0, updatedMessage?.reshareCount || 0),
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to unreshare message', error: error.message });
    }
};

// @desc    Get message comments
// @route   GET /api/community/subgrids/:subgridId/messages/:messageId/comments
// @access  Member
exports.listMessageComments = async (req, res) => {
    try {
        const { subgridId, messageId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message ID format' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const { Message, MessageComment } = await getTenantModels(subgrid);
        const message = await Message.findById(messageId);
        if (!message || message.subgridId !== String(subgridId) || message.status !== 'active') {
            return res.status(404).json({ message: 'Message not found' });
        }

        const comments = await MessageComment.find({
            subgridId: String(subgridId),
            messageId: String(messageId),
            status: 'active',
        }).sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            data: comments,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch comments', error: error.message });
    }
};

// @desc    Create message comment
// @route   POST /api/community/subgrids/:subgridId/messages/:messageId/comments
// @access  Member
exports.createMessageComment = async (req, res) => {
    try {
        const { subgridId, messageId } = req.params;
        const { body } = req.body;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Invalid message ID format' });
        }

        if (!body || !body.trim()) {
            return res.status(400).json({ message: 'Comment body is required' });
        }

        const subgrid = await getSubgrid(req, subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { Message, MessageComment } = await getTenantModels(subgrid);
        const message = await Message.findById(messageId);
        if (!message || message.subgridId !== String(subgridId) || message.status !== 'active') {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Apply content moderation
        const filterResult = await filterContent(body, subgridId);
        if (!filterResult.allowed) {
            return res.status(400).json({
                message: filterResult.message,
                code: 'CONTENT_BLOCKED',
                matchedWords: filterResult.matches,
            });
        }

        const comment = await MessageComment.create({
            subgridId: String(subgridId),
            messageId: String(messageId),
            authorId: String(userId),
            body: filterResult.censoredContent || body.trim(),
            flagged: filterResult.flagged || false,
        });

        const updatedMessage = await Message.findByIdAndUpdate(
            messageId,
            { $inc: { commentCount: 1 } },
            { new: true }
        );

        websocketService.sendToRoom('subgrid', subgridId, 'message_comment_created', {
            subgridId,
            messageId,
            comment,
            commentCount: updatedMessage.commentCount,
            timestamp: new Date().toISOString(),
        });

        return res.status(201).json({
            success: true,
            data: comment,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create comment', error: error.message });
    }
};
