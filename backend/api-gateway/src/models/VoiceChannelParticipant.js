const mongoose = require('mongoose');

const voiceChannelParticipantSchema = new mongoose.Schema({
    channelId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    agoraUid: { type: Number, required: true },
    subgridId: { type: String, default: null },
    role: { type: String, enum: ['host', 'speaker', 'listener'], default: 'listener' },
    isMuted: { type: Boolean, default: false },
    isHandRaised: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
}, {
    timestamps: true,
});

// Compound index for fast lookups
voiceChannelParticipantSchema.index({ channelId: 1, userId: 1 }, { unique: true });
voiceChannelParticipantSchema.index({ channelId: 1, agoraUid: 1 }, { unique: true });

// Auto-expire stale participants after 4 hours (safety net)
voiceChannelParticipantSchema.index({ joinedAt: 1 }, { expireAfterSeconds: 4 * 60 * 60 });

module.exports = mongoose.model('VoiceChannelParticipant', voiceChannelParticipantSchema);
