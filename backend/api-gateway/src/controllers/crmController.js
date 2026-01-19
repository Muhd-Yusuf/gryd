const Lead = require('../models/Lead');
const PipelineStage = require('../models/PipelineStage');
const LeadActivity = require('../models/LeadActivity');
const Task = require('../models/Task');
const Campaign = require('../models/Campaign');
const Report = require('../models/Report');

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
};

const parsePagination = (query = {}) => {
    const hasPage = query.page !== undefined || query.limit !== undefined;
    if (!hasPage) {
        return { enabled: false, page: 1, limit: 0, skip: 0 };
    }
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 200);
    const skip = (page - 1) * limit;
    return { enabled: true, page, limit, skip };
};

const buildMeta = (total, page, limit, enabled) => {
    const safeLimit = enabled ? limit : total || 0;
    const safePage = enabled ? page : 1;
    const pages = safeLimit ? Math.max(Math.ceil(total / safeLimit), 1) : 1;
    return { total, page: safePage, limit: safeLimit, pages };
};

const ensureDefaultStages = async (tenantId) => {
    const count = await PipelineStage.countDocuments({ tenantId });
    if (count > 0) {
        return;
    }
    const defaults = [
        { name: 'New Lead', order: 0, isDefault: true },
        { name: 'Qualification', order: 1, isDefault: true },
        { name: 'Nurturing', order: 2, isDefault: true },
        { name: 'Active Buyer', order: 3, isDefault: true },
        { name: 'Closed', order: 4, isDefault: true },
    ];
    await PipelineStage.insertMany(defaults.map((stage) => ({ tenantId, ...stage })));
};

exports.listLeads = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const leads = await Lead.find({ tenantId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: leads });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list leads', error: error.message });
    }
};

exports.createLead = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        const lead = await Lead.create({
            tenantId,
            name: payload.name || '',
            email: payload.email || '',
            phone: payload.phone || '',
            status: payload.status || 'new',
            score: payload.score || 0,
            source: payload.source || '',
            tags: payload.tags || [],
            assignedTo: payload.assignedTo || null,
        });
        return res.status(201).json({ success: true, data: lead });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create lead', error: error.message });
    }
};

exports.getLead = async (req, res) => {
    try {
        const { tenantId, leadId } = req.params;
        const lead = await Lead.findOne({ tenantId, _id: leadId });
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load lead', error: error.message });
    }
};

exports.updateLead = async (req, res) => {
    try {
        const { tenantId, leadId } = req.params;
        const lead = await Lead.findOneAndUpdate(
            { tenantId, _id: leadId },
            { $set: req.body || {} },
            { new: true }
        );
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update lead', error: error.message });
    }
};

exports.deleteLead = async (req, res) => {
    try {
        const { tenantId, leadId } = req.params;
        await Lead.findOneAndDelete({ tenantId, _id: leadId });
        await Task.deleteMany({ tenantId, leadId });
        await LeadActivity.deleteMany({ tenantId, leadId });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete lead', error: error.message });
    }
};

exports.listPipelineStages = async (req, res) => {
    try {
        const { tenantId } = req.params;
        await ensureDefaultStages(tenantId);
        const stages = await PipelineStage.find({ tenantId }).sort({ order: 1 });
        return res.status(200).json({ success: true, data: stages });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list pipeline stages', error: error.message });
    }
};

exports.createPipelineStage = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        if (!payload.name) {
            return res.status(400).json({ message: 'Stage name is required' });
        }
        const stage = await PipelineStage.create({
            tenantId,
            name: payload.name,
            order: payload.order || 0,
            isDefault: false,
        });
        return res.status(201).json({ success: true, data: stage });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create pipeline stage', error: error.message });
    }
};

exports.updatePipelineStage = async (req, res) => {
    try {
        const { tenantId, stageId } = req.params;
        const stage = await PipelineStage.findOneAndUpdate(
            { tenantId, _id: stageId },
            { $set: req.body || {} },
            { new: true }
        );
        if (!stage) {
            return res.status(404).json({ message: 'Stage not found' });
        }
        return res.status(200).json({ success: true, data: stage });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update pipeline stage', error: error.message });
    }
};

exports.deletePipelineStage = async (req, res) => {
    try {
        const { tenantId, stageId } = req.params;
        const stage = await PipelineStage.findOneAndDelete({ tenantId, _id: stageId });
        if (!stage) {
            return res.status(404).json({ message: 'Stage not found' });
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete pipeline stage', error: error.message });
    }
};

exports.listTasks = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const tasks = await Task.find({ tenantId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list tasks', error: error.message });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        if (!payload.title) {
            return res.status(400).json({ message: 'Task title is required' });
        }
        const task = await Task.create({
            tenantId,
            leadId: payload.leadId || null,
            title: payload.title,
            type: payload.type || 'to-do',
            priority: payload.priority || 'normal',
            status: payload.status || 'todo',
            dueDate: payload.dueDate || null,
            reminderAt: payload.reminderAt || null,
            createdBy: req.user?.id || null,
        });
        return res.status(201).json({ success: true, data: task });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create task', error: error.message });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const { tenantId, taskId } = req.params;
        const task = await Task.findOneAndUpdate(
            { tenantId, _id: taskId },
            { $set: req.body || {} },
            { new: true }
        );
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        return res.status(200).json({ success: true, data: task });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update task', error: error.message });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const { tenantId, taskId } = req.params;
        await Task.findOneAndDelete({ tenantId, _id: taskId });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete task', error: error.message });
    }
};

exports.listActivities = async (req, res) => {
    try {
        const { tenantId, leadId } = req.params;
        const activities = await LeadActivity.find({ tenantId, leadId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: activities });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list activities', error: error.message });
    }
};

exports.createActivity = async (req, res) => {
    try {
        const { tenantId, leadId } = req.params;
        const payload = req.body || {};
        const activity = await LeadActivity.create({
            tenantId,
            leadId,
            type: payload.type || 'note',
            note: payload.note || '',
            createdBy: req.user?.id || null,
        });
        return res.status(201).json({ success: true, data: activity });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create activity', error: error.message });
    }
};

exports.listCampaigns = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { status, channel, q, from, to } = req.query || {};
        const filter = { tenantId };

        if (status) {
            filter.status = status;
        }
        if (channel) {
            filter.channel = channel;
        }
        const andConditions = [];
        if (q) {
            const regex = new RegExp(String(q), 'i');
            andConditions.push({ $or: [{ name: regex }] });
        }

        const fromDate = parseDate(from);
        const toDate = parseDate(to);
        if (fromDate || toDate) {
            const range = {};
            if (fromDate) {
                range.$gte = fromDate;
            }
            if (toDate) {
                range.$lte = toDate;
            }
            andConditions.push({
                $or: [
                    { scheduledAt: range },
                    { scheduledAt: null, createdAt: range },
                ],
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        const pagination = parsePagination(req.query);
        const total = await Campaign.countDocuments(filter);
        let queryBuilder = Campaign.find(filter).sort({ scheduledAt: -1, createdAt: -1 });
        if (pagination.enabled) {
            queryBuilder = queryBuilder.skip(pagination.skip).limit(pagination.limit);
        }
        const campaigns = await queryBuilder;
        return res.status(200).json({
            success: true,
            data: campaigns,
            meta: buildMeta(total, pagination.page, pagination.limit, pagination.enabled),
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list campaigns', error: error.message });
    }
};

exports.createCampaign = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        if (!payload.name) {
            return res.status(400).json({ message: 'Campaign name is required' });
        }
        const campaign = await Campaign.create({
            tenantId,
            name: payload.name,
            channel: payload.channel || 'email',
            status: payload.status || 'draft',
            audienceCount: payload.audienceCount || 0,
            scheduledAt: payload.scheduledAt || null,
        });
        return res.status(201).json({ success: true, data: campaign });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create campaign', error: error.message });
    }
};

exports.updateCampaign = async (req, res) => {
    try {
        const { tenantId, campaignId } = req.params;
        const campaign = await Campaign.findOneAndUpdate(
            { tenantId, _id: campaignId },
            { $set: req.body || {} },
            { new: true }
        );
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }
        return res.status(200).json({ success: true, data: campaign });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update campaign', error: error.message });
    }
};

exports.deleteCampaign = async (req, res) => {
    try {
        const { tenantId, campaignId } = req.params;
        await Campaign.findOneAndDelete({ tenantId, _id: campaignId });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete campaign', error: error.message });
    }
};

exports.listReports = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { status, q, from, to } = req.query || {};
        const filter = { tenantId };

        if (status) {
            filter.status = status;
        }
        const andConditions = [];
        if (q) {
            const regex = new RegExp(String(q), 'i');
            andConditions.push({ $or: [{ name: regex }, { description: regex }] });
        }

        const fromDate = parseDate(from);
        const toDate = parseDate(to);
        if (fromDate || toDate) {
            const range = {};
            if (fromDate) {
                range.$gte = fromDate;
            }
            if (toDate) {
                range.$lte = toDate;
            }
            andConditions.push({
                $or: [
                    { generatedAt: range },
                    { generatedAt: null, createdAt: range },
                ],
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        const pagination = parsePagination(req.query);
        const total = await Report.countDocuments(filter);
        let queryBuilder = Report.find(filter).sort({ generatedAt: -1, createdAt: -1 });
        if (pagination.enabled) {
            queryBuilder = queryBuilder.skip(pagination.skip).limit(pagination.limit);
        }
        const reports = await queryBuilder;
        return res.status(200).json({
            success: true,
            data: reports,
            meta: buildMeta(total, pagination.page, pagination.limit, pagination.enabled),
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list reports', error: error.message });
    }
};

exports.createReport = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        if (!payload.name) {
            return res.status(400).json({ message: 'Report name is required' });
        }
        const report = await Report.create({
            tenantId,
            name: payload.name,
            description: payload.description || '',
            status: 'generated',
            generatedAt: new Date(),
        });
        return res.status(201).json({ success: true, data: report });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create report', error: error.message });
    }
};

exports.updateReport = async (req, res) => {
    try {
        const { tenantId, reportId } = req.params;
        const report = await Report.findOneAndUpdate(
            { tenantId, _id: reportId },
            { $set: req.body || {} },
            { new: true }
        );
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        return res.status(200).json({ success: true, data: report });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update report', error: error.message });
    }
};

exports.deleteReport = async (req, res) => {
    try {
        const { tenantId, reportId } = req.params;
        const report = await Report.findOneAndDelete({ tenantId, _id: reportId });
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete report', error: error.message });
    }
};
