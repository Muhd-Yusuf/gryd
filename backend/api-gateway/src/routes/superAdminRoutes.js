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
} = require('../controllers/superAdminController');
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');

// Middleware to check if user is super admin
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
router.use(requireSuperAdmin);

// Overview / Dashboard
router.get('/overview', getOverview);

// Customers (Communities/Subgrids)
router.get('/customers', getCustomers);
router.post('/customers', createCustomer);
router.get('/customers/:customerId', getCustomerDetails);
router.patch('/customers/:customerId', updateCustomer);
router.post('/customers/:customerId/delete', deleteCustomer);
router.post('/customers/:customerId/upgrade', upgradeCustomerPlan);

// Moderation
router.get('/moderation', getModerationQueue);

// Configuration
router.get('/config', getConfiguration);
router.patch('/config', updateConfiguration);

// Users (all users)
router.get('/users', getUsers);
router.post('/users/invite', inviteUser);

// Team Members (admin and super_admin users who help manage the platform)
router.get('/team', getTeamMembers);
router.post('/team/invite', inviteTeamMember);
router.post('/team/:userId/delete', require('../controllers/superAdminController').deleteTeamMember);

module.exports = router;
