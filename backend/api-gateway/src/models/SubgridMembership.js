const mongoose = require('mongoose');

const subgridMembershipSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    subgridId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subgrid',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    role: {
        type: String,
        enum: ['subgrid_admin', 'moderator', 'member'],
        default: 'member',
    },
    status: {
        type: String,
        enum: ['active', 'muted', 'suspended'],
        default: 'active',
    },
    mutedUntil: {
        type: Date,
        default: null,
    },
    lastActiveAt: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

subgridMembershipSchema.index({ subgridId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('SubgridMembership', subgridMembershipSchema);
