const mongoose = require('mongoose');

const walletConnectionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    address: {
        type: String,
        required: true,
        trim: true,
    },
    chainId: {
        type: Number,
        default: 1,
    },
    ensName: {
        type: String,
        trim: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    verifiedAt: {
        type: Date,
    },
    nonce: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('WalletConnection', walletConnectionSchema);
