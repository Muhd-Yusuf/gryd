const mongoose = require('mongoose');

const usageEventSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    feature: {
        type: String,
        default: '',
    },
    units: {
        type: Number,
        default: 0,
    },
    cost: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('UsageEvent', usageEventSchema);
