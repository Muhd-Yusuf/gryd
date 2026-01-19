const mongoose = require('mongoose');

const pipelineStageSchema = new mongoose.Schema({
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
    order: {
        type: Number,
        default: 0,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

pipelineStageSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PipelineStage', pipelineStageSchema);
