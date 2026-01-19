const mongoose = require('mongoose');

const tenantMembershipSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
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
        enum: ['owner', 'admin', 'member'],
        default: 'member',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

tenantMembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TenantMembership', tenantMembershipSchema);
