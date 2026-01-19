const TenantMembership = require('../models/TenantMembership');
const SubgridMembership = require('../models/SubgridMembership');

const getTenantMembership = async (tenantId, userId) => {
    return TenantMembership.findOne({ tenantId, userId });
};

const getSubgridMembership = async (tenantId, subgridId, userId) => {
    return SubgridMembership.findOne({ tenantId, subgridId, userId });
};

const requireTenantRole = (membership, allowedRoles) => {
    if (!membership) {
        return false;
    }
    return allowedRoles.includes(membership.role);
};

const requireSubgridRole = (membership, allowedRoles) => {
    if (!membership) {
        return false;
    }
    return allowedRoles.includes(membership.role);
};

const isMembershipSuspended = (membership) => {
    return Boolean(membership && membership.status === 'suspended');
};

const isMembershipMuted = (membership) => {
    if (!membership || membership.status !== 'muted') {
        return false;
    }
    if (!membership.mutedUntil) {
        return true;
    }
    return membership.mutedUntil > new Date();
};

const isMembershipActive = (membership) => {
    return Boolean(membership) && !isMembershipSuspended(membership);
};

const canWriteInSubgrid = (membership) => {
    return isMembershipActive(membership) && !isMembershipMuted(membership);
};

module.exports = {
    getTenantMembership,
    getSubgridMembership,
    requireTenantRole,
    requireSubgridRole,
    isMembershipSuspended,
    isMembershipMuted,
    isMembershipActive,
    canWriteInSubgrid,
};
