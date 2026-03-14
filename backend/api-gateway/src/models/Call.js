/**
 * Call Model
 * Tracks voice and video calls for history and analytics
 */

const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    agoraUid: {
        type: Number,
        required: true,
    },
    role: {
        type: String,
        enum: ['caller', 'callee', 'participant'],
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'ringing', 'joined', 'left', 'declined', 'missed', 'busy'],
        default: 'pending',
    },
    joinedAt: {
        type: Date,
    },
    leftAt: {
        type: Date,
    },
}, { _id: false });

const callSchema = new mongoose.Schema({
    // Call identification
    callId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    channelName: {
        type: String,
        required: true,
        index: true,
    },

    // Call type and context
    callType: {
        type: String,
        enum: ['audio', 'video'],
        required: true,
    },
    callContext: {
        type: String,
        enum: ['dm', 'channel', 'group'],
        required: true,
    },

    // Context references
    dmPeers: {
        callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        calleeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    channelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Channel',
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subgrid',
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
    },
    subgridId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subgrid',
    },

    // Participants
    participants: [participantSchema],

    // Call status
    status: {
        type: String,
        enum: ['initiating', 'ringing', 'active', 'ended', 'missed', 'declined', 'failed'],
        default: 'initiating',
        index: true,
    },

    // Timing
    initiatedAt: {
        type: Date,
        default: Date.now,
    },
    answeredAt: {
        type: Date,
    },
    endedAt: {
        type: Date,
    },
    duration: {
        type: Number, // Duration in seconds
        default: 0,
    },

    // End reason
    endReason: {
        type: String,
        enum: ['completed', 'caller_ended', 'callee_ended', 'declined', 'missed', 'busy', 'failed', 'timeout'],
    },

    // Metadata
    metadata: {
        appId: String,
        screenSharing: { type: Boolean, default: false },
        recording: { type: Boolean, default: false },
    },
});

// Compound indexes
callSchema.index({ 'dmPeers.callerId': 1, 'dmPeers.calleeId': 1, initiatedAt: -1 });
callSchema.index({ 'participants.userId': 1, initiatedAt: -1 });
callSchema.index({ status: 1, initiatedAt: -1 });
callSchema.index({ tenantId: 1, subgridId: 1, initiatedAt: -1 });

// Virtual for formatted duration
callSchema.virtual('formattedDuration').get(function() {
    if (!this.duration) return '0:00';
    const mins = Math.floor(this.duration / 60);
    const secs = this.duration % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
});

// Instance methods

/**
 * Update participant status
 */
callSchema.methods.updateParticipant = async function(userId, updates) {
    const participant = this.participants.find(
        p => p.userId.toString() === userId.toString()
    );
    if (participant) {
        Object.assign(participant, updates);
        await this.save();
    }
    return this;
};

/**
 * Mark call as answered
 */
callSchema.methods.answer = async function(userId) {
    this.status = 'active';
    this.answeredAt = new Date();
    await this.updateParticipant(userId, {
        status: 'joined',
        joinedAt: new Date()
    });
    return this;
};

/**
 * End the call
 */
callSchema.methods.end = async function(endReason = 'completed') {
    this.status = 'ended';
    this.endedAt = new Date();
    this.endReason = endReason;

    if (this.answeredAt) {
        this.duration = Math.floor((this.endedAt - this.answeredAt) / 1000);
    }

    // Mark all active participants as left
    this.participants.forEach(p => {
        if (p.status === 'joined' || p.status === 'ringing') {
            p.status = 'left';
            p.leftAt = new Date();
        }
    });

    await this.save();
    return this;
};

/**
 * Decline the call
 */
callSchema.methods.decline = async function(userId) {
    const participant = this.participants.find(
        p => p.userId.toString() === userId.toString()
    );
    if (participant) {
        participant.status = 'declined';
    }

    // If all callees declined, mark call as declined
    const callees = this.participants.filter(p => p.role === 'callee');
    const allDeclined = callees.every(p => p.status === 'declined');
    if (allDeclined) {
        this.status = 'declined';
        this.endedAt = new Date();
        this.endReason = 'declined';
    }

    await this.save();
    return this;
};

// Static methods

/**
 * Get call history for a user
 */
callSchema.statics.getUserCallHistory = async function(userId, options = {}) {
    const { limit = 50, offset = 0, callType, status } = options;

    const query = {
        'participants.userId': userId,
        status: { $in: ['ended', 'missed', 'declined'] },
    };

    if (callType) query.callType = callType;
    if (status) query.status = status;

    return this.find(query)
        .sort({ initiatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('participants.userId', 'firstName lastName email avatarUrl');
};

/**
 * Get DM call history between two users
 */
callSchema.statics.getDMCallHistory = async function(userId1, userId2, limit = 20) {
    return this.find({
        callContext: 'dm',
        $or: [
            { 'dmPeers.callerId': userId1, 'dmPeers.calleeId': userId2 },
            { 'dmPeers.callerId': userId2, 'dmPeers.calleeId': userId1 },
        ],
        status: { $in: ['ended', 'missed', 'declined'] },
    })
    .sort({ initiatedAt: -1 })
    .limit(limit);
};

/**
 * Get active call for a user
 * Only returns calls that are still within the timeout window (not stale)
 */
callSchema.statics.getActiveCall = async function(userId) {
    // Stale threshold: calls older than 2 minutes in ringing/initiating status should be ignored
    const staleThreshold = new Date(Date.now() - 2 * 60 * 1000);
    // Active calls older than 30 minutes are likely stale (ended but not cleaned up)
    const activeStaleThreshold = new Date(Date.now() - 30 * 60 * 1000);

    return this.findOne({
        'participants.userId': userId,
        $or: [
            // Active calls are valid only if reasonably recent
            {
                status: 'active',
                $or: [
                    { answeredAt: { $gte: activeStaleThreshold } },
                    { initiatedAt: { $gte: activeStaleThreshold } }
                ]
            },
            // Ringing/initiating calls are only valid if recent
            {
                status: { $in: ['initiating', 'ringing'] },
                initiatedAt: { $gte: staleThreshold }
            }
        ]
    });
};

/**
 * Find call by callId
 */
callSchema.statics.findByCallId = async function(callId) {
    return this.findOne({ callId });
};

/**
 * Check if user is busy (already in a call)
 */
callSchema.statics.isUserBusy = async function(userId) {
    const activeCall = await this.getActiveCall(userId);
    return !!activeCall;
};

/**
 * Clean up stale calls (mark old ringing/initiating calls as failed)
 * This can be called periodically or before checking if a user is busy
 */
callSchema.statics.cleanupStaleCalls = async function(userId) {
    const staleThreshold = new Date(Date.now() - 2 * 60 * 1000);
    const activeStaleThreshold = new Date(Date.now() - 30 * 60 * 1000);

    // Clean up stale ringing/initiating calls (older than 2 minutes)
    const result1 = await this.updateMany(
        {
            'participants.userId': userId,
            status: { $in: ['initiating', 'ringing'] },
            initiatedAt: { $lt: staleThreshold }
        },
        {
            $set: {
                status: 'failed',
                endedAt: new Date(),
                endReason: 'timeout'
            }
        }
    );

    // Clean up stale active calls (older than 2 hours - call ended but status wasn't updated)
    const result2 = await this.updateMany(
        {
            'participants.userId': userId,
            status: 'active',
            initiatedAt: { $lt: activeStaleThreshold }
        },
        {
            $set: {
                status: 'ended',
                endedAt: new Date(),
                endReason: 'timeout'
            }
        }
    );

    const totalCleaned = result1.modifiedCount + result2.modifiedCount;
    if (totalCleaned > 0) {
        console.log(`[Call] Cleaned up ${result1.modifiedCount} stale ringing + ${result2.modifiedCount} stale active calls for user ${userId}`);
    }

    return totalCleaned;
};

/**
 * Force-end all active/ringing/initiating calls for a user
 * Used when a user initiates a new call - any existing calls are clearly stale
 */
callSchema.statics.forceEndActiveCalls = async function(userId) {
    const result = await this.updateMany(
        {
            'participants.userId': userId,
            status: { $in: ['active', 'initiating', 'ringing'] }
        },
        {
            $set: {
                status: 'ended',
                endedAt: new Date(),
                endReason: 'timeout'
            }
        }
    );

    if (result.modifiedCount > 0) {
        console.log(`[Call] Force-ended ${result.modifiedCount} stale calls for caller ${userId}`);
    }

    return result.modifiedCount;
};

module.exports = mongoose.model('Call', callSchema);
