const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Subgrid = require('../models/Subgrid');
const SubgridMembership = require('../models/SubgridMembership');
const { defineModels } = require('../services/tenantModels');
const { getTenantConnection } = require('../services/tenantDb');

const getTenantModels = async (subgrid) => {
    const connection = await getTenantConnection(subgrid.tenantId);
    return defineModels(connection);
};

const slugify = (value) => {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};

// MongoDB has a 38-byte limit for database names
const buildDbName = (id) => `tenant_${id.toString().slice(0, 8)}`;

const bootstrapEnabled = () => {
    // Bootstrap is DISABLED by default - must explicitly enable with ALLOW_BOOTSTRAP=true
    // This prevents auto-creation of "Syphor Demo Community" tenants
    return process.env.ALLOW_BOOTSTRAP === 'true';
};

exports.bootstrap = async (req, res) => {
    if (!bootstrapEnabled()) {
        return res.status(403).json({ message: 'Bootstrap disabled' });
    }

    try {
        const email = req.body?.email || 'dev@syphor.local';
        const firstName = req.body?.firstName || 'Dev';
        const lastName = req.body?.lastName || 'User';
        const tenantName = req.body?.tenantName || 'Syphor Demo';

        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({
                firstName,
                lastName,
                email,
                role: 'member',
            });
        }

        let membership = await TenantMembership.findOne({ userId: user._id });
        let tenant = membership ? await Tenant.findById(membership.tenantId) : null;

        if (!tenant) {
            const slug = slugify(tenantName);
            const tenantId = new mongoose.Types.ObjectId();
            tenant = await Tenant.create({
                _id: tenantId,
                name: tenantName,
                slug,
                dbName: buildDbName(tenantId),
            });
            membership = await TenantMembership.create({
                tenantId: tenant._id,
                userId: user._id,
                role: 'owner',
            });
        }

        // Check if user has a subgrid, create one if not
        let subgridMembership = await SubgridMembership.findOne({ userId: user._id });
        let subgrid = subgridMembership ? await Subgrid.findById(subgridMembership.subgridId) : null;

        if (!subgrid) {
            const subgridSlug = slugify(tenantName + ' Community');
            subgrid = await Subgrid.create({
                tenantId: tenant._id,
                name: tenantName + ' Community',
                slug: subgridSlug,
                description: 'Welcome to your Credit Union community!',
                visibility: 'private',
                status: 'active',
                settings: {
                    postsEnabled: true,
                    commentsEnabled: true,
                    directMessagesEnabled: true,
                },
                joinSettings: {
                    method: 'invite_only',
                    autoJoinEnabled: false,
                },
                embedSettings: {
                    enabled: true,
                    allowedOrigins: [],
                    mode: 'full',
                },
            });

            // Make the user a subgrid admin
            subgridMembership = await SubgridMembership.create({
                tenantId: tenant._id,
                subgridId: subgrid._id,
                userId: user._id,
                role: 'subgrid_admin',
                status: 'active',
            });

            // Create a default general channel
            try {
                const { Channel } = await getTenantModels(subgrid);
                await Channel.create({
                    subgridId: String(subgrid._id),
                    name: 'general',
                    type: 'text',
                    visibility: 'public',
                });
            } catch (channelErr) {
                console.error('[bootstrap] Failed to create default channel:', channelErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                userId: String(user._id),
                tenantId: String(tenant._id),
                subgridId: String(subgrid._id),
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to bootstrap' });
    }
};
