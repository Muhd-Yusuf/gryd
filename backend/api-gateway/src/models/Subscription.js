const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    planName: {
        type: String,
        default: 'Starter',
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'canceled'],
        default: 'active',
    },
    currentPeriodStart: {
        type: Date,
        default: Date.now,
    },
    currentPeriodEnd: {
        type: Date,
        default: null,
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

subscriptionSchema.pre('save', function updateTimestamp() {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
