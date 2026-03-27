const express = require('express');
const router = express.Router();
const {
    getBillingAccount,
    updateBillingAccount,
    getSubscription,
    updateSubscription,
    listUsageEvents,
    createUsageEvent,
    listInvoices,
    createInvoice,
    listPaymentMethods,
    addPaymentMethod,
} = require('../controllers/billingController');
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');
const { loadTenant, requireTenantMember, requireTenantAdmin } = require('../middleware/tenantAccess');

router.use(attachUserContext);

// Read endpoints — any tenant member can view
router.get('/tenants/:tenantId/account', requireUser, loadTenant, requireTenantMember, getBillingAccount);
router.get('/tenants/:tenantId/subscription', requireUser, loadTenant, requireTenantMember, getSubscription);
router.get('/tenants/:tenantId/usage', requireUser, loadTenant, requireTenantMember, listUsageEvents);
router.get('/tenants/:tenantId/invoices', requireUser, loadTenant, requireTenantMember, listInvoices);
router.get('/tenants/:tenantId/payment-methods', requireUser, loadTenant, requireTenantMember, listPaymentMethods);

// Write endpoints — only tenant admin/owner can modify
router.patch('/tenants/:tenantId/account', requireUser, loadTenant, requireTenantAdmin, updateBillingAccount);
router.patch('/tenants/:tenantId/subscription', requireUser, loadTenant, requireTenantAdmin, updateSubscription);
router.post('/tenants/:tenantId/usage', requireUser, loadTenant, requireTenantAdmin, createUsageEvent);
router.post('/tenants/:tenantId/invoices', requireUser, loadTenant, requireTenantAdmin, createInvoice);
router.post('/tenants/:tenantId/payment-methods', requireUser, loadTenant, requireTenantAdmin, addPaymentMethod);

module.exports = router;
