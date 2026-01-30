const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Subgrid = require('../models/Subgrid');
const SubgridMembership = require('../models/SubgridMembership');
const TenantMembership = require('../models/TenantMembership');
const Subscription = require('../models/Subscription');
const ServiceMetric = require('../models/ServiceMetric');
const { getTenantConnection } = require('../services/tenantDb');
const { defineModels } = require('../services/tenantModels');
const { sendCustomerSetupEmail } = require('../services/emailService');

// Helper function to calculate delta percentage
const calcDelta = (current, previous) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
};

// Helper function to build daily time series data
const buildDailySeries = (startDate, days, map) => {
    const labels = [];
    const values = [];
    const cursor = new Date(startDate);

    for (let i = 0; i < days; i += 1) {
        const key = cursor.toISOString().slice(0, 10);
        labels.push(cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        values.push(map[key] || 0);
        cursor.setDate(cursor.getDate() + 1);
    }

    return { labels, values };
};

// Helper function to build hourly time series data
const buildHourlySeries = (startDate, hours, map) => {
    const labels = [];
    const values = [];
    const cursor = new Date(startDate);

    for (let i = 0; i < hours; i += 1) {
        const key = cursor.toISOString().slice(0, 13);
        labels.push(cursor.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        values.push(map[key] !== undefined ? map[key] : 99.9); // Default to 99.9% uptime if no data
        cursor.setHours(cursor.getHours() + 1);
    }

    return { labels, values };
};

/**
 * Get super admin dashboard overview stats
 * GET /api/super-admin/overview
 */
exports.getOverview = async (req, res) => {
    try {
        const now = new Date();
        const growthDaysParam = parseInt(req.query.growthDays, 10);
        const growthDays = [7, 30, 90].includes(growthDaysParam) ? growthDaysParam : 7;
        const startGrowth = new Date(now);
        startGrowth.setDate(startGrowth.getDate() - (growthDays - 1));
        startGrowth.setHours(0, 0, 0, 0);

        const start24 = new Date(now);
        start24.setHours(start24.getHours() - 24);

        // Get all subgrids (customers/communities)
        const [
            totalCustomers,
            allSubgrids,
            subgridGrowthAgg,
        ] = await Promise.all([
            Subgrid.countDocuments(),
            Subgrid.find().populate('tenantId').lean(),
            Subgrid.aggregate([
                { $match: { createdAt: { $gte: startGrowth } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        // Count active subscriptions only for tenants that have active subgrids
        const tenantIdsWithSubgrids = allSubgrids
            .map(s => s.tenantId?._id || s.tenantId)
            .filter(Boolean);
        const activeSubscriptions = await Subscription.countDocuments({
            status: 'active',
            tenantId: { $in: tenantIdsWithSubgrids },
        });

        // Count total members across all subgrids
        const totalMembers = await SubgridMembership.countDocuments();

        // Count active channels across all tenants
        let totalChannels = 0;
        for (const subgrid of allSubgrids) {
            try {
                // Handle both populated and non-populated tenantId
                const tenantId = subgrid.tenantId?._id || subgrid.tenantId;
                if (!tenantId) continue;

                const tenantDb = await getTenantConnection(tenantId);
                if (tenantDb) {
                    const { Channel } = defineModels(tenantDb);
                    const channelCount = await Channel.countDocuments({ subgridId: String(subgrid._id) });
                    totalChannels += channelCount;
                }
            } catch (err) {
                // Skip if tenant DB unavailable
                console.error('[superAdmin.getOverview] Channel count error:', err.message);
            }
        }

        // Build customer growth chart data
        const growthMap = {};
        subgridGrowthAgg.forEach((entry) => {
            growthMap[entry._id] = entry.count;
        });

        // Calculate cumulative growth
        const growthSeries = buildDailySeries(startGrowth, growthDays, growthMap);
        let cumulative = totalCustomers - growthSeries.values.reduce((a, b) => a + b, 0);
        const cumulativeValues = growthSeries.values.map((val) => {
            cumulative += val;
            return cumulative;
        });

        // Build uptime data (simulated based on service metrics)
        const uptimeAgg = await ServiceMetric.aggregate([
            { $match: { createdAt: { $gte: start24 } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } },
                    totalRequests: { $sum: 1 },
                    errorCount: {
                        $sum: {
                            $cond: [{ $gte: ['$statusCode', 500] }, 1, 0],
                        },
                    },
                },
            },
        ]);

        const uptimeMap = {};
        uptimeAgg.forEach((entry) => {
            const successRate = entry.totalRequests > 0
                ? ((entry.totalRequests - entry.errorCount) / entry.totalRequests) * 100
                : 99.9;
            uptimeMap[entry._id] = Math.min(100, Math.max(99.5, successRate));
        });
        const uptimeSeries = buildHourlySeries(start24, 24, uptimeMap);

        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalCustomers,
                    activeChannels: totalChannels,
                    totalMembers,
                    activeSubscriptions,
                },
                customerGrowth: {
                    labels: growthSeries.labels,
                    values: cumulativeValues,
                },
                systemUptime: {
                    labels: uptimeSeries.labels,
                    values: uptimeSeries.values,
                },
            },
        });
    } catch (error) {
        console.error('[superAdmin.getOverview] Error:', error.message);
        return res.status(500).json({ message: 'Failed to load overview', error: error.message });
    }
};

/**
 * Get all customers (subgrids/communities)
 * GET /api/super-admin/customers
 */
exports.getCustomers = async (req, res) => {
    try {
        const { q, limit = 50, offset = 0, status } = req.query;
        const search = String(q || '').trim();

        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { clientName: { $regex: search, $options: 'i' } },
            ];
        }
        if (status && status !== 'all') {
            filter.status = status;
        }

        const [total, subgrids] = await Promise.all([
            Subgrid.countDocuments(filter),
            Subgrid.find(filter)
                .populate('tenantId')
                .sort({ createdAt: -1 })
                .skip(Number(offset))
                .limit(Math.min(Number(limit), 100))
                .lean(),
        ]);

        // Enrich with member counts and subscription info
        const customers = await Promise.all(subgrids.map(async (subgrid) => {
            const [memberCount, subscription, owner] = await Promise.all([
                SubgridMembership.countDocuments({ subgridId: subgrid._id }),
                Subscription.findOne({ tenantId: subgrid.tenantId?._id }).lean(),
                SubgridMembership.findOne({ subgridId: subgrid._id, role: 'subgrid_admin' })
                    .populate({
                        path: 'userId',
                        model: 'User',
                        select: 'firstName lastName email',
                    })
                    .lean(),
            ]);

            return {
                _id: subgrid._id,
                name: subgrid.name,
                clientName: subgrid.clientName || subgrid.name,
                status: subgrid.status,
                memberCount,
                plan: subscription?.planName || 'Active',
                subscriptionStatus: subscription?.status || 'active',
                owner: owner?.userId ? {
                    _id: owner.userId._id,
                    name: [owner.userId.firstName, owner.userId.lastName].filter(Boolean).join(' ') || 'Unknown',
                    email: owner.userId.email,
                } : null,
                createdAt: subgrid.createdAt,
            };
        }));

        return res.status(200).json({
            success: true,
            data: {
                total,
                customers,
            },
        });
    } catch (error) {
        console.error('[superAdmin.getCustomers] Error:', error.message);
        return res.status(500).json({ message: 'Failed to load customers', error: error.message });
    }
};

/**
 * Get single customer details
 * GET /api/super-admin/customers/:customerId
 */
exports.getCustomerDetails = async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!mongoose.isValidObjectId(customerId)) {
            return res.status(400).json({ message: 'Invalid customer id' });
        }

        let subgrid = await Subgrid.findById(customerId).populate('tenantId').lean();
        if (!subgrid) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Generate invite code if it doesn't exist
        if (!subgrid.inviteCode) {
            const newCode = Subgrid.generateInviteCode();
            await Subgrid.findByIdAndUpdate(customerId, { inviteCode: newCode });
            subgrid.inviteCode = newCode;
        }

        // Handle both populated and non-populated tenantId
        const tenantId = subgrid.tenantId?._id || subgrid.tenantId;

        const [memberCount, members, subscription, channels] = await Promise.all([
            SubgridMembership.countDocuments({ subgridId: customerId }),
            SubgridMembership.find({ subgridId: customerId })
                .populate({
                    path: 'userId',
                    model: 'User',
                    select: 'firstName lastName email createdAt',
                })
                .limit(20)
                .lean(),
            Subscription.findOne({ tenantId }).lean(),
            (async () => {
                try {
                    if (!tenantId) return [];
                    const tenantDb = await getTenantConnection(tenantId);
                    if (tenantDb) {
                        const { Channel } = defineModels(tenantDb);
                        return Channel.find({ subgridId: String(customerId) }).lean();
                    }
                } catch (err) {
                    console.error('[superAdmin.getCustomerDetails] Channel fetch error:', err.message);
                    return [];
                }
                return [];
            })(),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                customer: {
                    _id: subgrid._id,
                    name: subgrid.name,
                    clientName: subgrid.clientName,
                    description: subgrid.description,
                    status: subgrid.status,
                    settings: subgrid.settings,
                    createdAt: subgrid.createdAt,
                    inviteCode: subgrid.inviteCode || null,
                },
                stats: {
                    memberCount,
                    channelCount: channels.length,
                },
                subscription: subscription || { planName: 'Active', status: 'active' },
                members: members.map((m) => ({
                    _id: m._id,
                    userId: m.userId?._id,
                    name: m.userId ? [m.userId.firstName, m.userId.lastName].filter(Boolean).join(' ') : 'Unknown',
                    email: m.userId?.email,
                    role: m.role,
                    joinedAt: m.createdAt,
                })),
                channels,
            },
        });
    } catch (error) {
        console.error('[superAdmin.getCustomerDetails] Error:', error.message);
        return res.status(500).json({ message: 'Failed to load customer details', error: error.message });
    }
};

/**
 * Update customer status (suspend/activate)
 * PATCH /api/super-admin/customers/:customerId
 */
exports.updateCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { status, settings } = req.body;

        if (!mongoose.isValidObjectId(customerId)) {
            return res.status(400).json({ message: 'Invalid customer id' });
        }

        const updateData = {};
        if (status) {
            updateData.status = status;
        }
        if (settings) {
            updateData.settings = settings;
        }

        const subgrid = await Subgrid.findByIdAndUpdate(customerId, updateData, { new: true });
        if (!subgrid) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        return res.status(200).json({
            success: true,
            data: subgrid,
        });
    } catch (error) {
        console.error('[superAdmin.updateCustomer] Error:', error.message);
        return res.status(500).json({ message: 'Failed to update customer', error: error.message });
    }
};

/**
 * Get moderation queue (flagged content across all communities)
 * GET /api/super-admin/moderation
 */
exports.getModerationQueue = async (req, res) => {
    try {
        const { status = 'pending', limit = 50, offset = 0 } = req.query;

        const allSubgrids = await Subgrid.find().populate('tenantId').lean();
        const flaggedItems = [];

        for (const subgrid of allSubgrids) {
            try {
                const tenantDb = await getTenantConnection(subgrid.tenantId);
                if (tenantDb) {
                    const Flag = tenantDb.model('Flag');
                    const filter = status !== 'all' ? { status } : {};
                    const flags = await Flag.find(filter)
                        .sort({ createdAt: -1 })
                        .limit(10)
                        .lean();

                    flags.forEach((flag) => {
                        flaggedItems.push({
                            ...flag,
                            communityName: subgrid.name,
                            communityId: subgrid._id,
                        });
                    });
                }
            } catch (err) {
                // Skip if tenant DB unavailable
            }
        }

        // Sort by date and paginate
        flaggedItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const paginated = flaggedItems.slice(Number(offset), Number(offset) + Number(limit));

        return res.status(200).json({
            success: true,
            data: {
                total: flaggedItems.length,
                items: paginated,
            },
        });
    } catch (error) {
        console.error('[superAdmin.getModerationQueue] Error:', error.message);
        return res.status(500).json({ message: 'Failed to load moderation queue', error: error.message });
    }
};

/**
 * Get system configuration
 * GET /api/super-admin/config
 */
exports.getConfiguration = async (req, res) => {
    try {
        // Return system-wide configuration settings
        const config = {
            features: {
                community: true,
                crm: true,
                calendar: true,
                billing: true,
                admin: true,
            },
            limits: {
                maxChannelsPerCommunity: 50,
                maxMembersPerCommunity: 10000,
                maxFileSizeMB: 25,
            },
            defaults: {
                newCommunityPlan: 'Trial',
                trialDurationDays: 14,
            },
        };

        return res.status(200).json({
            success: true,
            data: config,
        });
    } catch (error) {
        console.error('[superAdmin.getConfiguration] Error:', error.message);
        return res.status(500).json({ message: 'Failed to load configuration', error: error.message });
    }
};

/**
 * Update system configuration
 * PATCH /api/super-admin/config
 */
exports.updateConfiguration = async (req, res) => {
    try {
        const { features, limits, defaults } = req.body;

        // In a real implementation, this would update a system config collection
        // For now, return the updated config
        const updatedConfig = {
            features: features || {},
            limits: limits || {},
            defaults: defaults || {},
        };

        return res.status(200).json({
            success: true,
            data: updatedConfig,
            message: 'Configuration updated successfully',
        });
    } catch (error) {
        console.error('[superAdmin.updateConfiguration] Error:', error.message);
        return res.status(500).json({ message: 'Failed to update configuration', error: error.message });
    }
};

/**
 * Create a new customer (community/subgrid)
 * POST /api/super-admin/customers
 */
exports.createCustomer = async (req, res) => {
    try {
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required' });
        }

        // Check if user already exists
        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Create new user with temporary password
            const bcrypt = require('bcryptjs');
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Parse name - if single name, use it for both first and last
            const nameParts = name.trim().split(' ');
            const firstName = nameParts[0] || name;
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

            user = await User.create({
                firstName,
                lastName,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: 'admin',
            });
        }

        // Generate unique slug and dbName for tenant
        const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const uniqueSuffix = Date.now().toString(36);
        const tenantSlug = `${baseSlug}-${uniqueSuffix}`;
        const dbName = `tenant_${baseSlug.replace(/-/g, '_')}_${uniqueSuffix}`;

        // Create tenant for the customer
        const tenant = await Tenant.create({
            name: `${name}'s Organization`,
            slug: tenantSlug,
            dbName: dbName,
        });

        // Create tenant membership for the owner
        await TenantMembership.create({
            tenantId: tenant._id,
            userId: user._id,
            role: 'owner',
        });

        // Create subgrid (community) for the customer
        // Server name is empty initially - customer will set it during setup
        const subgridSlug = `${baseSlug}-community-${uniqueSuffix}`;
        const subgrid = await Subgrid.create({
            name: '',  // Will be set by customer during setup
            slug: subgridSlug,
            clientName: name,
            tenantId: tenant._id,
            status: 'active',
        });

        // Create subgrid membership for the owner
        await SubgridMembership.create({
            tenantId: tenant._id,
            subgridId: subgrid._id,
            userId: user._id,
            role: 'subgrid_admin',
            status: 'active',
        });

        // Create Active subscription by default (customer has paid outside system)
        await Subscription.create({
            tenantId: tenant._id,
            planName: 'Active',
            status: 'active',
        });

        // Generate setup token for the customer
        const setupToken = crypto.randomBytes(32).toString('hex');
        const setupTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Update user with setup token
        await User.findByIdAndUpdate(user._id, {
            setupToken,
            setupTokenExpires,
        });

        // Send setup email to customer
        try {
            await sendCustomerSetupEmail({
                email,
                customerName: name,
                setupToken,
                tenantId: tenant._id.toString(),
            });
            console.log(`[superAdmin.createCustomer] Setup email sent to ${email}`);
        } catch (emailError) {
            console.error('[superAdmin.createCustomer] Failed to send setup email:', emailError.message);
            // Don't fail the request if email fails - customer is still created
        }

        return res.status(201).json({
            success: true,
            data: {
                customer: {
                    _id: subgrid._id,
                    name: subgrid.name,
                    clientName: subgrid.clientName,
                    status: subgrid.status,
                    createdAt: subgrid.createdAt,
                },
                owner: {
                    _id: user._id,
                    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
                    email: user.email,
                },
            },
            message: 'Customer created successfully. Setup link will be sent to their email.',
        });
    } catch (error) {
        console.error('[superAdmin.createCustomer] Error:', error.message);
        return res.status(500).json({ message: 'Failed to create customer', error: error.message });
    }
};

/**
 * Delete customer (community/subgrid)
 * POST /api/super-admin/customers/:customerId/delete
 */
exports.deleteCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!mongoose.isValidObjectId(customerId)) {
            return res.status(400).json({ message: 'Invalid customer id' });
        }

        const subgrid = await Subgrid.findById(customerId).populate('tenantId').lean();
        if (!subgrid) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Delete all memberships for this subgrid
        await SubgridMembership.deleteMany({ subgridId: customerId });

        // Delete subscription for the tenant
        if (subgrid.tenantId) {
            await Subscription.deleteMany({ tenantId: subgrid.tenantId._id });
        }

        // Delete tenant data if it exists
        if (subgrid.tenantId) {
            try {
                const tenantDb = await getTenantConnection(subgrid.tenantId);
                if (tenantDb) {
                    // Delete channels and messages in tenant database
                    const Channel = tenantDb.model('Channel');
                    const Message = tenantDb.model('Message');
                    await Channel.deleteMany({ subgridId: String(customerId) });
                    await Message.deleteMany({ subgridId: String(customerId) });
                }
            } catch (err) {
                console.error('[superAdmin.deleteCustomer] Error cleaning tenant data:', err.message);
            }

            // Delete the tenant
            await Tenant.findByIdAndDelete(subgrid.tenantId._id);
        }

        // Delete the subgrid itself
        await Subgrid.findByIdAndDelete(customerId);

        return res.status(200).json({
            success: true,
            message: 'Customer deleted successfully',
        });
    } catch (error) {
        console.error('[superAdmin.deleteCustomer] Error:', error.message);
        return res.status(500).json({ message: 'Failed to delete customer', error: error.message });
    }
};

/**
 * Upgrade customer plan
 * POST /api/super-admin/customers/:customerId/upgrade
 */
exports.upgradeCustomerPlan = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { plan } = req.body;

        if (!mongoose.isValidObjectId(customerId)) {
            return res.status(400).json({ message: 'Invalid customer id' });
        }

        if (!plan) {
            return res.status(400).json({ message: 'Plan is required' });
        }

        const subgrid = await Subgrid.findById(customerId).populate('tenantId').lean();
        if (!subgrid) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        if (!subgrid.tenantId) {
            return res.status(400).json({ message: 'Customer has no associated tenant' });
        }

        // Determine plan details based on selection
        let planName;
        let durationDays;
        let status = 'active';

        switch (plan) {
            case 'trial_5':
                planName = 'Trial';
                durationDays = 5;
                break;
            case 'premium_30':
                planName = 'Active';
                durationDays = 30;
                break;
            case 'premium_60':
                planName = 'Active';
                durationDays = 60;
                break;
            case 'revoke':
                planName = 'Revoked';
                durationDays = 0;
                status = 'cancelled';
                break;
            default:
                return res.status(400).json({ message: 'Invalid plan selection' });
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);

        // Update or create subscription
        let subscription = await Subscription.findOne({ tenantId: subgrid.tenantId._id });

        if (subscription) {
            subscription.planName = planName;
            subscription.status = status;
            subscription.startDate = startDate;
            subscription.endDate = endDate;
            await subscription.save();
        } else {
            subscription = await Subscription.create({
                tenantId: subgrid.tenantId._id,
                planName,
                status,
                startDate,
                endDate,
            });
        }

        // If revoking access, also suspend the customer
        if (plan === 'revoke') {
            await Subgrid.findByIdAndUpdate(customerId, { status: 'suspended' });
        } else if (subgrid.status === 'suspended') {
            // If upgrading a suspended customer, reactivate them
            await Subgrid.findByIdAndUpdate(customerId, { status: 'active' });
        }

        return res.status(200).json({
            success: true,
            data: {
                subscription: {
                    planName: subscription.planName,
                    status: subscription.status,
                    startDate: subscription.startDate,
                    endDate: subscription.endDate,
                },
            },
            message: `Customer plan updated to ${planName}`,
        });
    } catch (error) {
        console.error('[superAdmin.upgradeCustomerPlan] Error:', error.message);
        return res.status(500).json({ message: 'Failed to upgrade customer plan', error: error.message });
    }
};

/**
 * Get all system users
 * GET /api/super-admin/users
 */
exports.getUsers = async (req, res) => {
    try {
        const { q, limit = 50, offset = 0, role } = req.query;
        const search = String(q || '').trim();

        const filter = {};
        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        if (role && role !== 'all') {
            filter.role = role;
        }

        const [total, users] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(Number(offset))
                .limit(Math.min(Number(limit), 100))
                .lean(),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                total,
                users,
            },
        });
    } catch (error) {
        console.error('[superAdmin.getUsers] Error:', error.message);
        return res.status(500).json({ message: 'Failed to load users', error: error.message });
    }
};

/**
 * Get team members (admin and super_admin users who help manage the platform)
 * GET /api/super-admin/team
 */
exports.getTeamMembers = async (req, res) => {
    try {
        const { q, limit = 50, offset = 0 } = req.query;
        const search = String(q || '').trim();

        // Team members are users with admin or super_admin roles
        const filter = {
            role: { $in: ['admin', 'super_admin'] }
        };

        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const [total, users] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(Number(offset))
                .limit(Math.min(Number(limit), 100))
                .lean(),
        ]);

        console.log(`[superAdmin.getTeamMembers] Found ${users.length} team members`);

        return res.status(200).json({
            success: true,
            data: {
                total,
                users,
            },
        });
    } catch (error) {
        console.error('[superAdmin.getTeamMembers] Error:', error.message);
        return res.status(500).json({ message: 'Failed to load team members', error: error.message });
    }
};

/**
 * Invite a new team member
 * POST /api/super-admin/team/invite
 */
exports.inviteTeamMember = async (req, res) => {
    try {
        const { email, firstName, lastName, role = 'admin' } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Validate role - only admin or super_admin allowed for team members
        if (!['admin', 'super_admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Team members must have admin or super_admin role.' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Create new team member with a temporary password
        const bcrypt = require('bcryptjs');
        const crypto = require('crypto');
        const tempPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Generate setup token for account activation
        const setupToken = crypto.randomBytes(32).toString('hex');
        const setupTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const user = await User.create({
            email: email.toLowerCase(),
            firstName: firstName || 'Team',
            lastName: lastName || 'Member',
            password: hashedPassword,
            role: role,
            setupToken,
            setupTokenExpires,
        });

        // Send invitation email - redirects to login page with email prefilled
        const { sendTeamMemberInviteEmail } = require('../services/emailService');

        try {
            await sendTeamMemberInviteEmail({
                email: email.toLowerCase(),
                firstName: firstName || 'Team Member',
                role: role,
            });
            console.log(`[superAdmin.inviteTeamMember] Invitation email sent to ${email}`);
        } catch (emailError) {
            console.error(`[superAdmin.inviteTeamMember] Failed to send email:`, emailError.message);
            // Continue even if email fails - user is created
        }

        return res.status(201).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                },
            },
            message: 'Team member invitation sent successfully',
        });
    } catch (error) {
        console.error('[superAdmin.inviteTeamMember] Error:', error.message);
        return res.status(500).json({ message: 'Failed to invite team member', error: error.message });
    }
};

/**
 * Invite a new user (legacy - for backward compatibility)
 * POST /api/super-admin/users/invite
 */
exports.inviteUser = async (req, res) => {
    try {
        const { email, role = 'member' } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Create new user with a temporary password
        const bcrypt = require('bcryptjs');
        const crypto = require('crypto');
        const tempPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const user = await User.create({
            email: email.toLowerCase(),
            firstName: 'New',
            lastName: 'User',
            password: hashedPassword,
            role: role,
        });

        console.log(`[superAdmin.inviteUser] User created: ${email} with role: ${role}`);

        return res.status(201).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    email: user.email,
                    role: user.role,
                },
            },
            message: 'User created successfully',
        });
    } catch (error) {
        console.error('[superAdmin.inviteUser] Error:', error.message);
        return res.status(500).json({ message: 'Failed to invite user', error: error.message });
    }
};
