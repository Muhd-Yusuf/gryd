const mongoose = require('mongoose');

const voiceChannelStateSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    hostId: { type: String, default: null },
    speakers: [{ type: String }],
    waveRequests: [{
        userId: { type: String },
        requestedAt: { type: Date, default: Date.now },
    }],
}, {
    timestamps: true,
});

module.exports = mongoose.model('VoiceChannelState', voiceChannelStateSchema);
