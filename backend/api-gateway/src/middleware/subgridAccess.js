const Subgrid = require('../models/Subgrid');
const {
    getSubgridMembership,
    requireSubgridRole,
    isMembershipActive,
    canWriteInSubgrid,
} = require('../services/permissionService');

const loadSubgrid = async (req, res, next) => {
    const { subgridId } = req.params;
    try {
        const subgrid = await Subgrid.findById(subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        req.subgrid = subgrid;
        return next();
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load subgrid', error: error.message });
    }
};

const requireSubgridRead = async (req, res, next) => {
    try {
        if (!req.subgrid) {
            await loadSubgrid(req, res, () => {});
            if (!req.subgrid) {
                return;
            }
        }

        const subgridId = String(req.subgrid._id);
        if (req.embed) {
            if (req.embed.subgridId !== subgridId) {
                return res.status(403).json({ message: 'Embed token subgrid mismatch' });
            }
            if (!req.embed.scopes || !req.embed.scopes.includes('read')) {
                return res.status(403).json({ message: 'Embed token missing read scope' });
            }
            if (req.subgrid.status !== 'active') {
                return res.status(403).json({ message: 'Subgrid is not active' });
            }
            return next();
        }

        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const membership = await getSubgridMembership(req.subgrid.tenantId, subgridId, String(req.user.id));
        if (!membership || !isMembershipActive(membership)) {
            return res.status(403).json({ message: 'Subgrid access denied' });
        }
        if (req.subgrid.status !== 'active' && !requireSubgridRole(membership, ['subgrid_admin'])) {
            return res.status(403).json({ message: 'Subgrid is not active' });
        }
        return next();
    } catch (error) {
        console.error('[requireSubgridRead] error:', error);
        return res.status(500).json({ message: 'Failed to check subgrid access', error: error.message });
    }
};

const requireSubgridWrite = async (req, res, next) => {
    if (!req.subgrid) {
        await loadSubgrid(req, res, () => {});
        if (!req.subgrid) {
            return;
        }
    }

    const subgridId = String(req.subgrid._id);
    if (req.embed) {
        if (req.embed.subgridId !== subgridId) {
            return res.status(403).json({ message: 'Embed token subgrid mismatch' });
        }
        if (!req.embed.scopes || !req.embed.scopes.includes('write')) {
            return res.status(403).json({ message: 'Embed token missing write scope' });
        }
        if (req.subgrid.status !== 'active') {
            return res.status(403).json({ message: 'Subgrid is not active' });
        }
        return next();
    }

    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const membership = await getSubgridMembership(req.subgrid.tenantId, subgridId, req.user.id);
    if (!membership || !canWriteInSubgrid(membership)) {
        return res.status(403).json({ message: 'Subgrid access denied' });
    }
    if (req.subgrid.status !== 'active' && !requireSubgridRole(membership, ['subgrid_admin'])) {
        return res.status(403).json({ message: 'Subgrid is not active' });
    }
    return next();
};

const requireSubgridModeration = async (req, res, next) => {
    if (!req.subgrid) {
        await loadSubgrid(req, res, () => {});
        if (!req.subgrid) {
            return;
        }
    }

    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const membership = await getSubgridMembership(req.subgrid.tenantId, req.subgrid._id, req.user.id);
    if (!membership || !isMembershipActive(membership) || !requireSubgridRole(membership, ['subgrid_admin', 'moderator'])) {
        return res.status(403).json({ message: 'Moderation access denied' });
    }
    return next();
};

const requireSubgridAdmin = async (req, res, next) => {
    console.log('[requireSubgridAdmin] Checking admin access...');
    if (!req.subgrid) {
        await loadSubgrid(req, res, () => {});
        if (!req.subgrid) {
            console.log('[requireSubgridAdmin] No subgrid found');
            return;
        }
    }

    if (!req.user) {
        console.log('[requireSubgridAdmin] No user found');
        return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('[requireSubgridAdmin] User:', req.user.id, 'Subgrid:', req.subgrid._id);
    const membership = await getSubgridMembership(req.subgrid.tenantId, req.subgrid._id, req.user.id);
    console.log('[requireSubgridAdmin] Membership:', membership);
    if (!membership || !isMembershipActive(membership) || !requireSubgridRole(membership, ['subgrid_admin'])) {
        console.log('[requireSubgridAdmin] Admin access denied - membership:', !!membership, 'active:', membership ? isMembershipActive(membership) : false, 'isAdmin:', membership ? requireSubgridRole(membership, ['subgrid_admin']) : false);
        return res.status(403).json({ message: 'Admin access denied' });
    }
    console.log('[requireSubgridAdmin] Access granted');
    return next();
};

module.exports = {
    loadSubgrid,
    requireSubgridRead,
    requireSubgridWrite,
    requireSubgridModeration,
    requireSubgridAdmin,
};
