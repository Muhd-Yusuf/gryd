const Tenant = require('../models/Tenant');
const { getTenantMembership, requireTenantRole } = require('../services/permissionService');

const loadTenant = async (req, res, next) => {
    const { tenantId } = req.params;
    if (!tenantId) {
        return res.status(400).json({ message: 'Tenant id is required' });
    }
    try {
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }
        req.tenant = tenant;
        return next();
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load tenant' });
    }
};

const requireTenantMember = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    const tenantId = req.params.tenantId;
    const membership = await getTenantMembership(tenantId, req.user.id);
    if (!membership) {
        return res.status(403).json({ message: 'Tenant access denied' });
    }
    req.tenantMembership = membership;
    return next();
};

const requireTenantAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    const tenantId = req.params.tenantId;
    const membership = await getTenantMembership(tenantId, req.user.id);
    if (!requireTenantRole(membership, ['owner', 'admin'])) {
        return res.status(403).json({ message: 'Tenant admin access denied' });
    }
    req.tenantMembership = membership;
    return next();
};

module.exports = {
    loadTenant,
    requireTenantMember,
    requireTenantAdmin,
};
