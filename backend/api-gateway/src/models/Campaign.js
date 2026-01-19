const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    channel: {
        type: String,
        enum: ['email', 'sms', 'mixed'],
        default: 'email',
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'paused', 'completed'],
        default: 'draft',
    },
    audienceCount: {
        type: Number,
        default: 0,
    },
    scheduledAt: {
        type: Date,
        default: null,
    },
    metrics: {
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        replied: { type: Number, default: 0 },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

campaignSchema.pre('save', function updateTimestamp() {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Campaign', campaignSchema);
