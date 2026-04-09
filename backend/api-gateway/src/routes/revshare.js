const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const RevShareTransaction = require('../models/RevShareTransaction');
const RevShareConfig = require('../models/RevShareConfig');

// ---------------------------------------------------------------------------
// Helper: resolve effective percentages for a transaction.
// Priority: partner-scope > cu-scope > global > hardcoded fallback (80/15/5)
// ---------------------------------------------------------------------------
async function resolveRevSharePercents(cuId, partnerId) {
    const FALLBACK = { partnerCutPercent: 80, cuCutPercent: 15, platformCutPercent: 5 };

    const orClauses = [{ scope: 'global', cuId: null, partnerId: null }];
    if (cuId && mongoose.Types.ObjectId.isValid(cuId)) {
        orClauses.push({ scope: 'cu', cuId: new mongoose.Types.ObjectId(cuId), partnerId: null });
    }
    if (partnerId && mongoose.Types.ObjectId.isValid(partnerId)) {
        const partnerQuery = { scope: 'partner', partnerId: new mongoose.Types.ObjectId(partnerId) };
        if (cuId && mongoose.Types.ObjectId.isValid(cuId)) {
            partnerQuery.cuId = new mongoose.Types.ObjectId(cuId);
        }
        orClauses.push(partnerQuery);
    }

    const configs = await RevShareConfig.find({ isActive: true, $or: orClauses }).lean();
    if (!configs.length) return FALLBACK;

    // Pick highest-priority match
    const byScope = { partner: 3, cu: 2, global: 1 };
    configs.sort((a, b) => byScope[b.scope] - byScope[a.scope]);
    const best = configs[0];
    return {
        partnerCutPercent: best.partnerCutPercent,
        cuCutPercent: best.cuCutPercent,
        platformCutPercent: best.platformCutPercent,
    };
}

// GET /partner/summary — partner's total earnings grouped by month
router.get('/partner/summary', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const summary = await RevShareTransaction.aggregate([
            { $match: { partnerId: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                    },
                    totalGross: { $sum: '$grossAmount' },
                    totalPartnerAmount: { $sum: '$partnerAmount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
        ]);
        return res.json({ success: true, data: summary });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /partner/transactions — partner's transaction list
router.get('/partner/transactions', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const transactions = await RevShareTransaction.find({ partnerId: userId })
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, data: transactions });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /cu/summary — CU admin's total RevShare received grouped by partner
router.get('/cu/summary', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        const { cuId } = req.query;
        if (userRole !== 'cu_admin' && userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'CU admin access required' });
        }
        const matchFilter = {};
        if (cuId && mongoose.Types.ObjectId.isValid(cuId)) {
            matchFilter.cuId = new mongoose.Types.ObjectId(cuId);
        }
        const summary = await RevShareTransaction.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: '$partnerId',
                    totalGross: { $sum: '$grossAmount' },
                    totalCuAmount: { $sum: '$cuAmount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { totalCuAmount: -1 } },
        ]);
        return res.json({ success: true, data: summary });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /cu/transactions — CU admin transaction list
router.get('/cu/transactions', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        const { cuId } = req.query;
        if (userRole !== 'cu_admin' && userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'CU admin access required' });
        }
        const filter = {};
        if (cuId && mongoose.Types.ObjectId.isValid(cuId)) {
            filter.cuId = new mongoose.Types.ObjectId(cuId);
        }
        const transactions = await RevShareTransaction.find(filter)
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, data: transactions });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /admin/summary — super admin: platform total + per-CU breakdown
router.get('/admin/summary', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const [totals, byCu] = await Promise.all([
            RevShareTransaction.aggregate([
                {
                    $group: {
                        _id: null,
                        totalGross: { $sum: '$grossAmount' },
                        totalPlatformAmount: { $sum: '$platformAmount' },
                        totalCuAmount: { $sum: '$cuAmount' },
                        totalPartnerAmount: { $sum: '$partnerAmount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            RevShareTransaction.aggregate([
                {
                    $group: {
                        _id: '$cuId',
                        totalGross: { $sum: '$grossAmount' },
                        totalCuAmount: { $sum: '$cuAmount' },
                        totalPlatformAmount: { $sum: '$platformAmount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { totalGross: -1 } },
            ]),
        ]);
        return res.json({
            success: true,
            data: {
                totals: totals[0] || { totalGross: 0, totalPlatformAmount: 0, totalCuAmount: 0, totalPartnerAmount: 0, count: 0 },
                byCu,
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /admin/by-client — super admin: per-CU revenue sorted by total
router.get('/admin/by-client', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const byCu = await RevShareTransaction.aggregate([
            {
                $group: {
                    _id: '$cuId',
                    totalGross: { $sum: '$grossAmount' },
                    totalCuAmount: { $sum: '$cuAmount' },
                    totalPlatformAmount: { $sum: '$platformAmount' },
                    totalPartnerAmount: { $sum: '$partnerAmount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { totalGross: -1 } },
        ]);
        return res.json({ success: true, data: byCu });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /admin/by-partner — super admin: per-partner revenue
router.get('/admin/by-partner', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const byPartner = await RevShareTransaction.aggregate([
            {
                $group: {
                    _id: '$partnerId',
                    totalGross: { $sum: '$grossAmount' },
                    totalPartnerAmount: { $sum: '$partnerAmount' },
                    totalCuAmount: { $sum: '$cuAmount' },
                    totalPlatformAmount: { $sum: '$platformAmount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { totalGross: -1 } },
        ]);
        return res.json({ success: true, data: byPartner });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST /record — internal: record a new RevShare transaction (admin only)
// Percentages are resolved automatically from RevShareConfig unless explicitly overridden.
router.post('/record', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const { type, partnerId, cuId, grossAmount, description } = req.body;

        // Allow caller to hard-override percentages; otherwise resolve from config
        let { partnerCutPercent, cuCutPercent, platformCutPercent } = req.body;
        if (partnerCutPercent === undefined || cuCutPercent === undefined || platformCutPercent === undefined) {
            const resolved = await resolveRevSharePercents(cuId, partnerId);
            partnerCutPercent = partnerCutPercent ?? resolved.partnerCutPercent;
            cuCutPercent = cuCutPercent ?? resolved.cuCutPercent;
            platformCutPercent = platformCutPercent ?? resolved.platformCutPercent;
        }

        if (!type || grossAmount === undefined) {
            return res.status(400).json({ success: false, error: 'type and grossAmount are required' });
        }

        const partnerAmount = Math.round(grossAmount * partnerCutPercent / 100);
        const cuAmount = Math.round(grossAmount * cuCutPercent / 100);
        const platformAmount = Math.round(grossAmount * platformCutPercent / 100);

        const transaction = new RevShareTransaction({
            type,
            partnerId: partnerId || null,
            cuId: cuId || null,
            grossAmount,
            partnerCutPercent,
            cuCutPercent,
            platformCutPercent,
            partnerAmount,
            cuAmount,
            platformAmount,
            description,
        });
        await transaction.save();
        return res.status(201).json({ success: true, data: transaction });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ===========================================================================
// RevShare Config — super admin only
// ===========================================================================

// GET /config — list all configs (optionally filter by scope/cuId/partnerId)
router.get('/config', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Super admin access required' });
        }
        const { scope, cuId, partnerId, activeOnly } = req.query;
        const filter = {};
        if (scope) filter.scope = scope;
        if (cuId && mongoose.Types.ObjectId.isValid(cuId)) filter.cuId = new mongoose.Types.ObjectId(cuId);
        if (partnerId && mongoose.Types.ObjectId.isValid(partnerId)) filter.partnerId = new mongoose.Types.ObjectId(partnerId);
        if (activeOnly === 'true') filter.isActive = true;

        const configs = await RevShareConfig.find(filter)
            .populate('cuId', 'name clientName')
            .populate('partnerId', 'name email company')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, data: configs });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /config/resolve — preview which percentages would apply for a given cuId/partnerId
router.get('/config/resolve', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const { cuId, partnerId } = req.query;
        const resolved = await resolveRevSharePercents(cuId, partnerId);
        return res.json({ success: true, data: resolved });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST /config — create or update a rev share config
// Body: { scope, cuId?, partnerId?, partnerCutPercent, cuCutPercent, platformCutPercent, label? }
router.post('/config', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        const userId = req.headers['x-user-id'];
        if (userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Super admin access required' });
        }
        const { scope, cuId, partnerId, partnerCutPercent, cuCutPercent, platformCutPercent, label } = req.body;

        if (!scope || partnerCutPercent === undefined || cuCutPercent === undefined || platformCutPercent === undefined) {
            return res.status(400).json({ success: false, error: 'scope, partnerCutPercent, cuCutPercent, and platformCutPercent are required' });
        }
        if (!['global', 'cu', 'partner'].includes(scope)) {
            return res.status(400).json({ success: false, error: "scope must be 'global', 'cu', or 'partner'" });
        }
        if (scope === 'cu' && !cuId) {
            return res.status(400).json({ success: false, error: 'cuId is required for scope=cu' });
        }
        if (scope === 'partner' && !partnerId) {
            return res.status(400).json({ success: false, error: 'partnerId is required for scope=partner' });
        }

        // Upsert: find existing config for this exact scope/cuId/partnerId and update it,
        // or create a new one.
        const query = { scope };
        if (scope === 'cu' || scope === 'partner') query.cuId = cuId ? new mongoose.Types.ObjectId(cuId) : null;
        if (scope === 'partner') query.partnerId = new mongoose.Types.ObjectId(partnerId);
        if (scope === 'global') { query.cuId = null; query.partnerId = null; }

        const update = {
            partnerCutPercent,
            cuCutPercent,
            platformCutPercent,
            isActive: true,
            label: label || undefined,
            createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        };

        // Use findOneAndUpdate with upsert so we don't accidentally create duplicates
        const config = await RevShareConfig.findOneAndUpdate(query, update, {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
        });
        return res.status(200).json({ success: true, data: config });
    } catch (err) {
        if (err.message && err.message.includes('Percentages must add up to 100')) {
            return res.status(400).json({ success: false, error: err.message });
        }
        return res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH /config/:id/deactivate — deactivate a config without deleting it
router.patch('/config/:id/deactivate', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Super admin access required' });
        }
        const config = await RevShareConfig.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!config) return res.status(404).json({ success: false, error: 'Config not found' });
        return res.json({ success: true, data: config });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /config/:id — permanently remove a config
router.delete('/config/:id', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Super admin access required' });
        }
        const config = await RevShareConfig.findByIdAndDelete(req.params.id);
        if (!config) return res.status(404).json({ success: false, error: 'Config not found' });
        return res.json({ success: true, message: 'Config deleted' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
