const mongoose = require('mongoose');

const partnershipApplicationSchema = new mongoose.Schema({
    applicantUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    businessName: {
        type: String,
        required: true,
        trim: true,
    },
    contactEmail: {
        type: String,
        required: true,
        trim: true,
    },
    contactName: {
        type: String,
        trim: true,
    },
    website: {
        type: String,
        trim: true,
    },
    businessType: {
        type: String,
        enum: ['vendor', 'partner', 'sponsor', 'investor'],
    },
    pitch: {
        type: String,
    },
    targetCuId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    reviewNote: {
        type: String,
    },
    reviewedAt: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('PartnershipApplication', partnershipApplicationSchema);
