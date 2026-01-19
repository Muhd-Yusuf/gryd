const mongoose = require('mongoose');

const userPresenceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    subgridId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subgrid',
        required: true,
        index: true,
    },
    online: {
        type: Boolean,
        default: false,
    },
    lastSeen: {
        type: Date,
        default: Date.now,
    },
    lastHeartbeat: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        enum: ['online', 'away', 'busy', 'offline'],
        default: 'offline',
    },
    statusMessage: {
        type: String,
        default: '',
        maxlength: 128,
    },
    device: {
        type: String,
        enum: ['web', 'mobile', 'desktop'],
        default: 'web',
    },
});

// Compound index for quick lookups
userPresenceSchema.index({ subgridId: 1, userId: 1 }, { unique: true });

// TTL index to auto-cleanup stale presence records after 24 hours of inactivity
userPresenceSchema.index({ lastHeartbeat: 1 }, { expireAfterSeconds: 86400 });

// Static method to check if user is online (heartbeat within last 5 minutes)
userPresenceSchema.statics.isOnline = function(lastHeartbeat) {
    if (!lastHeartbeat) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastHeartbeat) > fiveMinutesAgo;
};

module.exports = mongoose.model('UserPresence', userPresenceSchema);
