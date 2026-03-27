const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 }, // MongoDB TTL — auto-delete after JWT expiry
    },
}, { timestamps: true });

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
