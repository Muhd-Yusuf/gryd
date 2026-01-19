const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    name: {
        type: String,
        default: '',
        trim: true,
    },
    email: {
        type: String,
        default: '',
        trim: true,
    },
    phone: {
        type: String,
        default: '',
        trim: true,
    },
    status: {
        type: String,
        enum: ['new', 'qualified', 'nurturing', 'active_buyer', 'closed'],
        default: 'new',
        index: true,
    },
    score: {
        type: Number,
        default: 0,
    },
    source: {
        type: String,
        default: '',
    },
    tags: {
        type: [String],
        default: [],
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    lastContactedAt: {
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

leadSchema.pre('save', function updateTimestamp() {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Lead', leadSchema);
