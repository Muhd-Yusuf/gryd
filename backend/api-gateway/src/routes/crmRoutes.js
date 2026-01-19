const express = require('express');
const router = express.Router();
const {
    listLeads,
    createLead,
    getLead,
    updateLead,
    deleteLead,
    listPipelineStages,
    createPipelineStage,
    updatePipelineStage,
    deletePipelineStage,
    listTasks,
    createTask,
    updateTask,
    deleteTask,
    listActivities,
    createActivity,
    listCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    listReports,
    createReport,
    updateReport,
    deleteReport,
} = require('../controllers/crmController');
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');
const { loadTenant, requireTenantMember } = require('../middleware/tenantAccess');

router.use(attachUserContext);

router.get('/tenants/:tenantId/leads', requireUser, loadTenant, requireTenantMember, listLeads);
router.post('/tenants/:tenantId/leads', requireUser, loadTenant, requireTenantMember, createLead);
router.get('/tenants/:tenantId/leads/:leadId', requireUser, loadTenant, requireTenantMember, getLead);
router.patch('/tenants/:tenantId/leads/:leadId', requireUser, loadTenant, requireTenantMember, updateLead);
router.delete('/tenants/:tenantId/leads/:leadId', requireUser, loadTenant, requireTenantMember, deleteLead);

router.get('/tenants/:tenantId/pipeline-stages', requireUser, loadTenant, requireTenantMember, listPipelineStages);
router.post('/tenants/:tenantId/pipeline-stages', requireUser, loadTenant, requireTenantMember, createPipelineStage);
router.patch('/tenants/:tenantId/pipeline-stages/:stageId', requireUser, loadTenant, requireTenantMember, updatePipelineStage);
router.delete('/tenants/:tenantId/pipeline-stages/:stageId', requireUser, loadTenant, requireTenantMember, deletePipelineStage);

router.get('/tenants/:tenantId/tasks', requireUser, loadTenant, requireTenantMember, listTasks);
router.post('/tenants/:tenantId/tasks', requireUser, loadTenant, requireTenantMember, createTask);
router.patch('/tenants/:tenantId/tasks/:taskId', requireUser, loadTenant, requireTenantMember, updateTask);
router.delete('/tenants/:tenantId/tasks/:taskId', requireUser, loadTenant, requireTenantMember, deleteTask);

router.get('/tenants/:tenantId/leads/:leadId/activities', requireUser, loadTenant, requireTenantMember, listActivities);
router.post('/tenants/:tenantId/leads/:leadId/activities', requireUser, loadTenant, requireTenantMember, createActivity);

router.get('/tenants/:tenantId/campaigns', requireUser, loadTenant, requireTenantMember, listCampaigns);
router.post('/tenants/:tenantId/campaigns', requireUser, loadTenant, requireTenantMember, createCampaign);
router.patch('/tenants/:tenantId/campaigns/:campaignId', requireUser, loadTenant, requireTenantMember, updateCampaign);
router.delete('/tenants/:tenantId/campaigns/:campaignId', requireUser, loadTenant, requireTenantMember, deleteCampaign);

router.get('/tenants/:tenantId/reports', requireUser, loadTenant, requireTenantMember, listReports);
router.post('/tenants/:tenantId/reports', requireUser, loadTenant, requireTenantMember, createReport);
router.patch('/tenants/:tenantId/reports/:reportId', requireUser, loadTenant, requireTenantMember, updateReport);
router.delete('/tenants/:tenantId/reports/:reportId', requireUser, loadTenant, requireTenantMember, deleteReport);

module.exports = router;
