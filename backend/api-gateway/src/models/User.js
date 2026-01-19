const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        unique: true,
        sparse: true, // Allows null values while maintaining uniqueness
        trim: true,
        lowercase: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String, // Will be hashed later (if using password auth)
        required: false, // Optional if using OAuth
    },
    googleId: {
        type: String,
    },
    microsoftId: {
        type: String,
    },
    role: {
        type: String,
        enum: ['member', 'admin', 'super_admin'],
        default: 'member',
    },
    avatarUrl: {
        type: String,
        default: null,
    },
    pushTokens: [{
        token: { type: String, required: true },
        platform: { type: String, enum: ['ios', 'android', 'web', 'unknown'], default: 'unknown' },
        deviceId: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
    }],
    notificationPreferences: {
        messages: { type: Boolean, default: true },
        dms: { type: Boolean, default: true },
        calls: { type: Boolean, default: true },
        mentions: { type: Boolean, default: true },
        invites: { type: Boolean, default: true },
    },
    defaultTenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('User', userSchema);
