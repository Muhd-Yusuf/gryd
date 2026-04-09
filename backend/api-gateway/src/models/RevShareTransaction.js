const mongoose = require('mongoose');

const revShareTransactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['marketplace', 'marketing'],
        required: true,
    },
    partnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    cuId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
    },
    grossAmount: {
        type: Number,
    },
    partnerCutPercent: {
        type: Number,
        default: 80,
    },
    cuCutPercent: {
        type: Number,
        default: 15,
    },
    platformCutPercent: {
        type: Number,
        default: 5,
    },
    partnerAmount: {
        type: Number,
    },
    cuAmount: {
        type: Number,
    },
    platformAmount: {
        type: Number,
    },
    description: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

module.exports = mongoose.model('RevShareTransaction', revShareTransactionSchema);
