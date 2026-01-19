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
const { loadTenant, requireTenantMember } = require('../middleware/tenantAccess');

router.use(attachUserContext);

router.get('/tenants/:tenantId/account', requireUser, loadTenant, requireTenantMember, getBillingAccount);
router.patch('/tenants/:tenantId/account', requireUser, loadTenant, requireTenantMember, updateBillingAccount);

router.get('/tenants/:tenantId/subscription', requireUser, loadTenant, requireTenantMember, getSubscription);
router.patch('/tenants/:tenantId/subscription', requireUser, loadTenant, requireTenantMember, updateSubscription);

router.get('/tenants/:tenantId/usage', requireUser, loadTenant, requireTenantMember, listUsageEvents);
router.post('/tenants/:tenantId/usage', requireUser, loadTenant, requireTenantMember, createUsageEvent);

router.get('/tenants/:tenantId/invoices', requireUser, loadTenant, requireTenantMember, listInvoices);
router.post('/tenants/:tenantId/invoices', requireUser, loadTenant, requireTenantMember, createInvoice);

router.get('/tenants/:tenantId/payment-methods', requireUser, loadTenant, requireTenantMember, listPaymentMethods);
router.post('/tenants/:tenantId/payment-methods', requireUser, loadTenant, requireTenantMember, addPaymentMethod);

module.exports = router;
