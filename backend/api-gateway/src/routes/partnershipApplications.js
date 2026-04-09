const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PartnershipApplication = require('../models/PartnershipApplication');

// GET / — list applications for a CU (CU admin, filter by targetCuId)
router.get('/', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'cu_admin' && userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'CU admin access required' });
        }
        const { targetCuId, status } = req.query;
        const filter = {};
        if (targetCuId && mongoose.Types.ObjectId.isValid(targetCuId)) {
            filter.targetCuId = new mongoose.Types.ObjectId(targetCuId);
        }
        if (status) {
            filter.status = status;
        }
        const applications = await PartnershipApplication.find(filter)
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, data: applications });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST / — submit new application (anyone)
router.post('/', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const {
            businessName,
            contactEmail,
            contactName,
            website,
            businessType,
            pitch,
            targetCuId,
        } = req.body;

        if (!businessName || !contactEmail) {
            return res.status(400).json({ success: false, error: 'businessName and contactEmail are required' });
        }

        const application = new PartnershipApplication({
            applicantUserId: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
            businessName,
            contactEmail,
            contactName,
            website,
            businessType,
            pitch,
            targetCuId: targetCuId && mongoose.Types.ObjectId.isValid(targetCuId) ? targetCuId : null,
        });
        await application.save();
        return res.status(201).json({ success: true, data: application });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /my — applicant's own applications
router.get('/my', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const applications = await PartnershipApplication.find({ applicantUserId: userId })
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, data: applications });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /:id/review — CU admin approves/rejects
router.put('/:id/review', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'cu_admin' && userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'CU admin access required' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid application id' });
        }
        const { status, reviewNote } = req.body;
        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'status must be "approved" or "rejected"' });
        }
        const application = await PartnershipApplication.findById(req.params.id);
        if (!application) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        application.status = status;
        application.reviewNote = reviewNote || '';
        application.reviewedBy = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null;
        application.reviewedAt = new Date();
        await application.save();
        return res.json({ success: true, data: application });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
