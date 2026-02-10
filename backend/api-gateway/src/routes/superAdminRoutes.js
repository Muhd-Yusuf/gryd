const express = require('express');
const router = express.Router();
const {
    getOverview,
    getCustomers,
    getCustomerDetails,
    updateCustomer,
    createCustomer,
    deleteCustomer,
    upgradeCustomerPlan,
    getModerationQueue,
    getConfiguration,
    updateConfiguration,
    getUsers,
    inviteUser,
    getTeamMembers,
    inviteTeamMember,
    deleteTeamMember,
    suspendTeamMember,
} = require('../controllers/superAdminController');
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');

// Middleware to check if user is admin or super_admin (can manage customers)
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    return next();
};

// Middleware to check if user is super_admin only (full platform access)
const requireSuperAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Super admin access required' });
    }
    return next();
};

router.use(attachUserContext);
router.use(requireUser);

// ============================================
// ADMIN ROUTES (admin + super_admin can access)
// These are for managing customers and moderation
// ============================================

// Overview / Dashboard - both roles can see
router.get('/overview', requireAdmin, getOverview);

// Customers (Communities/Subgrids) - both roles can manage
router.get('/customers', requireAdmin, getCustomers);
router.post('/customers', requireAdmin, createCustomer);
router.get('/customers/:customerId', requireAdmin, getCustomerDetails);
router.patch('/customers/:customerId', requireAdmin, updateCustomer);

// Moderation - both roles can manage
router.get('/moderation', requireAdmin, getModerationQueue);

// ============================================
// SUPER ADMIN ONLY ROUTES (full platform access)
// These are sensitive operations
// ============================================

// Customer deletion and plan changes - super_admin only
router.post('/customers/:customerId/delete', requireSuperAdmin, deleteCustomer);
router.post('/customers/:customerId/upgrade', requireSuperAdmin, upgradeCustomerPlan);

// Configuration - super_admin only
router.get('/config', requireSuperAdmin, getConfiguration);
router.patch('/config', requireSuperAdmin, updateConfiguration);

// Users management - super_admin only
router.get('/users', requireSuperAdmin, getUsers);
router.post('/users/invite', requireSuperAdmin, inviteUser);

// Team Members management - super_admin only
router.get('/team', requireAdmin, getTeamMembers); // Both can view team
router.post('/team/invite', requireSuperAdmin, inviteTeamMember);
router.post('/team/:userId/delete', requireSuperAdmin, deleteTeamMember);
router.post('/team/:userId/suspend', requireSuperAdmin, suspendTeamMember);

module.exports = router;
