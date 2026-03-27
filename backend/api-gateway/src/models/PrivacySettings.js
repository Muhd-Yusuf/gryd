const mongoose = require('mongoose');

const privacySettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    profileVisibility: {
        type: String,
        enum: ['hidden', 'friends_only', 'public'],
        default: 'hidden',
    },
    allowDMsFrom: {
        type: String,
        enum: ['nobody', 'friends_only', 'everyone'],
        default: 'friends_only',
    },
    allowFriendRequestsFrom: {
        type: String,
        enum: ['nobody', 'members_only', 'everyone'],
        default: 'everyone',
    },
    showOnlineStatus: {
        type: Boolean,
        default: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

privacySettingsSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('PrivacySettings', privacySettingsSchema);
