const express = require('express');
const router = express.Router();

const {
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    listConnections,
    connectGoogle,
    googleCallback,
    syncGoogleCalendar,
    disconnectGoogle,
} = require('../controllers/calendarController');
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');
const { loadTenant, requireTenantMember } = require('../middleware/tenantAccess');

router.use(attachUserContext);

router.get('/tenants/:tenantId/events', requireUser, loadTenant, requireTenantMember, listEvents);
router.post('/tenants/:tenantId/events', requireUser, loadTenant, requireTenantMember, createEvent);
router.patch('/tenants/:tenantId/events/:eventId', requireUser, loadTenant, requireTenantMember, updateEvent);
router.delete('/tenants/:tenantId/events/:eventId', requireUser, loadTenant, requireTenantMember, deleteEvent);

router.get('/tenants/:tenantId/connections', requireUser, loadTenant, requireTenantMember, listConnections);
router.post('/tenants/:tenantId/google/connect', requireUser, loadTenant, requireTenantMember, connectGoogle);
router.post('/tenants/:tenantId/google/sync', requireUser, loadTenant, requireTenantMember, syncGoogleCalendar);
router.post('/tenants/:tenantId/google/disconnect', requireUser, loadTenant, requireTenantMember, disconnectGoogle);

router.get('/oauth/google/callback', googleCallback);

module.exports = router;
