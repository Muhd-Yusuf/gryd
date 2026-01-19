const mongoose = require('mongoose');

const inviteLinkSchema = new mongoose.Schema({
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
    tokenHash: {
        type: String,
        required: true,
        unique: true,
    },
    kind: {
        type: String,
        enum: ['embed', 'member', 'email'],
        default: 'embed',
    },
    // Email invite specific fields
    inviteeEmail: {
        type: String,
        default: null,
        lowercase: true,
        trim: true,
    },
    emailSentAt: {
        type: Date,
        default: null,
    },
    acceptedAt: {
        type: Date,
        default: null,
    },
    acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    role: {
        type: String,
        enum: ['guest', 'member'],
        default: 'guest',
    },
    scopes: {
        type: [String],
        default: ['read'],
    },
    memberRole: {
        type: String,
        enum: ['subgrid_admin', 'moderator', 'member'],
        default: 'member',
    },
    channelId: {
        type: String,
        default: '',
    },
    maxUses: {
        type: Number,
        default: 0,
    },
    uses: {
        type: Number,
        default: 0,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
    revokedAt: {
        type: Date,
        default: null,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('InviteLink', inviteLinkSchema);
