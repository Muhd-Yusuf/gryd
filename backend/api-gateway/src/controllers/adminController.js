const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const UsageEvent = require('../models/UsageEvent');
const Invoice = require('../models/Invoice');
const BillingAccount = require('../models/BillingAccount');
const ServiceMetric = require('../models/ServiceMetric');
const { monitoredServices } = require('../middleware/metricsMiddleware');

const calcDelta = (current, previous) => {
    if (!previous) {
        return 0;
    }
    return ((current - previous) / previous) * 100;
};

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

const buildHourlySeries = (startDate, hours, map) => {
    const labels = [];
    const values = [];
    const cursor = new Date(startDate);

    for (let i = 0; i < hours; i += 1) {
        const key = cursor.toISOString().slice(0, 13);
        labels.push(cursor.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        values.push(map[key] || 0);
        cursor.setHours(cursor.getHours() + 1);
    }

    return { labels, values };
};

exports.getDashboard = async (req, res) => {
    try {
        const now = new Date();
        const start30 = new Date(now);
        start30.setDate(start30.getDate() - 30);
        const start60 = new Date(now);
        start60.setDate(start60.getDate() - 60);

        const start7 = new Date(now);
        start7.setDate(start7.getDate() - 6);
        start7.setHours(0, 0, 0, 0);

        const start24 = new Date(now);
        start24.setHours(start24.getHours() - 24);

        const prev24 = new Date(start24);
        prev24.setHours(prev24.getHours() - 24);

        const [
            activeUsers,
            prevUsers,
            responseAgg,
            prevResponseAgg,
            pastDueBilling,
            newLeadsWeek,
        ] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: start30 } }),
            User.countDocuments({ createdAt: { $gte: start60, $lt: start30 } }),
            ServiceMetric.aggregate([
                { $match: { createdAt: { $gte: start24 } } },
                { $group: { _id: null, avg: { $avg: '$durationMs' } } },
            ]),
            ServiceMetric.aggregate([
                { $match: { createdAt: { $gte: prev24, $lt: start24 } } },
                { $group: { _id: null, avg: { $avg: '$durationMs' } } },
            ]),
            BillingAccount.countDocuments({ status: { $in: ['past_due', 'suspended'] } }),
            Lead.countDocuments({ createdAt: { $gte: start7 } }),
        ]);

        const responseTime = responseAgg[0]?.avg || 0;
        const prevResponseTime = prevResponseAgg[0]?.avg || 0;

        const [userSeries, revenueSeries, costAgg, leadAgg, serviceAgg, updateAgg] = await Promise.all([
            User.aggregate([
                { $match: { createdAt: { $gte: start7 } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Invoice.aggregate([
                { $match: { issuedAt: { $gte: start7 } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$issuedAt' } },
                        amount: { $sum: { $ifNull: ['$amountPaid', 0] } },
                    },
                },
            ]),
            UsageEvent.aggregate([
                { $match: { createdAt: { $gte: start30 } } },
                {
                    $group: {
                        _id: '$feature',
                        cost: { $sum: { $ifNull: ['$cost', 0] } },
                    },
                },
                { $sort: { cost: -1 } },
            ]),
            Lead.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]),
            ServiceMetric.aggregate([
                {
                    $match: {
                        createdAt: { $gte: start24 },
                        service: { $in: monitoredServices.map((service) => service.name) },
                    },
                },
                {
                    $group: {
                        _id: '$service',
                        requests: { $sum: 1 },
                        avgResponseMs: { $avg: '$durationMs' },
                        errorCount: {
                            $sum: {
                                $cond: [{ $gte: ['$statusCode', 500] }, 1, 0],
                            },
                        },
                    },
                },
            ]),
            ServiceMetric.aggregate([
                { $match: { createdAt: { $gte: start24 } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%dT%H', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const userMap = {};
        userSeries.forEach((entry) => {
            userMap[entry._id] = entry.count;
        });
        const revenueMap = {};
        revenueSeries.forEach((entry) => {
            revenueMap[entry._id] = entry.amount;
        });

        const growth = buildDailySeries(start7, 7, userMap);
        const revenue = buildDailySeries(start7, 7, revenueMap);

        const costTotal = costAgg.reduce((sum, item) => sum + (item.cost || 0), 0);
        const costBreakdown = costAgg.map((item) => ({
            label: item._id || 'Other',
            value: item.cost || 0,
        }));

        const leadStages = ['new', 'qualified', 'nurturing', 'active_buyer', 'closed'];
        const leadMap = {};
        leadAgg.forEach((entry) => {
            leadMap[entry._id || 'new'] = entry.count;
        });
        const leadPipeline = {
            labels: leadStages.map((stage) => stage.replace('_', ' ')),
            values: leadStages.map((stage) => leadMap[stage] || 0),
        };

        const serviceStats = monitoredServices.map((service) => {
            const match = serviceAgg.find((entry) => entry._id === service.name);
            const requests = match?.requests || 0;
            const avgResponseMs = match?.avgResponseMs || 0;
            const errorRate = requests > 0 ? (match?.errorCount || 0) / requests : 0;
            let status = 'Idle';
            if (requests > 0) {
                if (errorRate >= 0.1 || avgResponseMs >= 900) {
                    status = 'Degraded';
                } else {
                    status = 'Healthy';
                }
            }
            return {
                name: service.name,
                requests,
                avgResponseMs,
                errorRate,
                status,
            };
        });

        const updateMap = {};
        updateAgg.forEach((entry) => {
            updateMap[entry._id] = entry.count;
        });
        const updates = buildHourlySeries(start24, 24, updateMap);

        const alerts = [];
        serviceStats.forEach((service) => {
            if (service.status === 'Degraded') {
                alerts.push({
                    id: `service-${service.name}`,
                    title: `${service.name} performance degraded`,
                    detail: `${Math.round(service.avgResponseMs)}ms avg response time`,
                    severity: 'warning',
                });
            }
            if (service.errorRate >= 0.1) {
                alerts.push({
                    id: `error-${service.name}`,
                    title: `${service.name} error rate elevated`,
                    detail: `${Math.round(service.errorRate * 100)}% of requests failing`,
                    severity: 'critical',
                });
            }
        });
        if (pastDueBilling > 0) {
            alerts.push({
                id: 'billing-past-due',
                title: 'Billing accounts past due',
                detail: `${pastDueBilling} accounts require attention`,
                severity: 'warning',
            });
        }
        if (newLeadsWeek === 0) {
            alerts.push({
                id: 'leads-zero',
                title: 'No new leads this week',
                detail: 'Lead capture is inactive in the last 7 days',
                severity: 'info',
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                kpis: {
                    activeUsers: {
                        value: activeUsers,
                        delta: calcDelta(activeUsers, prevUsers),
                    },
                    responseTimeMs: {
                        value: responseTime,
                        delta: calcDelta(responseTime, prevResponseTime),
                    },
                },
                userGrowth: {
                    labels: growth.labels,
                    users: growth.values,
                    revenue: revenue.values,
                },
                aiCost: {
                    total: costTotal,
                    breakdown: costBreakdown,
                },
                leadPipeline,
                services: serviceStats,
                systemUpdates: {
                    labels: updates.labels,
                    values: updates.values,
                },
                alerts,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load admin dashboard', error: error.message });
    }
};

exports.listUsers = async (req, res) => {
    try {
        const { q, limit = 10, offset = 0 } = req.query;
        const search = String(q || '').trim();
        const filter = {};
        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const now = new Date();
        const start30 = new Date(now);
        start30.setDate(start30.getDate() - 30);
        const start7 = new Date(now);
        start7.setDate(start7.getDate() - 7);

        const [totalUsers, activeUsers, trialUsers, users] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: start30 } }),
            User.countDocuments({ createdAt: { $gte: start7 } }),
            User.find(filter)
                .sort({ createdAt: -1 })
                .skip(Number(offset))
                .limit(Math.min(Number(limit), 100)),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    activeUsers,
                    trialUsers,
                    churnUsers: 0,
                },
                users,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load users', error: error.message });
    }
};

exports.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }

        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const [
            totalLeads,
            firstLead,
            latestLead,
            leadSamples,
        ] = await Promise.all([
            Lead.countDocuments({ assignedTo: userId }),
            Lead.findOne({ assignedTo: userId }).sort({ createdAt: 1 }).select('createdAt').lean(),
            Lead.findOne({ assignedTo: userId }).sort({ createdAt: -1 }).select('createdAt').lean(),
            Lead.find({ assignedTo: userId }).sort({ createdAt: -1 }).limit(4).select('name createdAt').lean(),
        ]);

        const userCreatedAt = new Date(user.createdAt).getTime();
        const firstActivityTimes = [
            firstLead?.createdAt,
        ]
            .filter(Boolean)
            .map((value) => new Date(value).getTime());

        const onboardingMinutes = Number.isNaN(userCreatedAt) || firstActivityTimes.length === 0
            ? 0
            : Math.max(0, Math.round((Math.min(...firstActivityTimes) - userCreatedAt) / 60000));

        const lastActivityTimes = [
            latestLead?.createdAt,
        ]
            .filter(Boolean)
            .map((value) => new Date(value).getTime());

        const lastActiveAt = lastActivityTimes.length
            ? new Date(Math.max(...lastActivityTimes)).toISOString()
            : null;

        const recentActivity = leadSamples.map((lead) => ({
            id: `lead-${lead._id}`,
            title: 'New lead capture',
            detail: lead.name || 'Lead captured',
            timestamp: lead.createdAt,
        }))
            .filter((item) => item.timestamp)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 4);

        return res.status(200).json({
            success: true,
            data: {
                user,
                stats: {
                    totalLeads,
                    rewardsEarned: 0,
                    onboardingMinutes,
                },
                recentActivity,
                lastActiveAt,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load user details', error: error.message });
    }
};
