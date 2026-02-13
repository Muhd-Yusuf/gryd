const TenantMembership = require('../models/TenantMembership');
const SubgridMembership = require('../models/SubgridMembership');

// Simple in-memory cache for membership queries (TTL: 30 seconds)
const membershipCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

const getTenantMembership = async (tenantId, userId) => {
    return TenantMembership.findOne({ tenantId, userId });
};

const getSubgridMembership = async (tenantId, subgridId, userId) => {
    const cacheKey = `${tenantId}:${subgridId}:${userId}`;
    const cached = membershipCache.get(cacheKey);

    // Return cached result if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.membership;
    }

    const membership = await SubgridMembership.findOne({ tenantId, subgridId, userId });

    // Cache the result
    membershipCache.set(cacheKey, {
        membership,
        timestamp: Date.now()
    });

    // Cleanup old entries periodically (every 100 cache sets)
    if (membershipCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of membershipCache.entries()) {
            if (now - value.timestamp > CACHE_TTL) {
                membershipCache.delete(key);
            }
        }
    }

    return membership;
};

// Function to invalidate cache for a specific user's membership
const invalidateMembershipCache = (tenantId, subgridId, userId) => {
    const cacheKey = `${tenantId}:${subgridId}:${userId}`;
    membershipCache.delete(cacheKey);
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
    invalidateMembershipCache,
    requireTenantRole,
    requireSubgridRole,
    isMembershipSuspended,
    isMembershipMuted,
    isMembershipActive,
    canWriteInSubgrid,
};
