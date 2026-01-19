const mongoose = require('mongoose');

const serviceMetricSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true,
        index: true,
    },
    path: {
        type: String,
        default: '',
    },
    method: {
        type: String,
        default: 'GET',
    },
    statusCode: {
        type: Number,
        default: 200,
    },
    durationMs: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

serviceMetricSchema.index({ service: 1, createdAt: -1 });

module.exports = mongoose.model('ServiceMetric', serviceMetricSchema);
