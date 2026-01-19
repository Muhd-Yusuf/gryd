const mongoose = require('mongoose');

const friendBlockSchema = new mongoose.Schema({
    subgridId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subgrid',
        required: true,
        index: true,
    },
    blockerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    blockedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

friendBlockSchema.index({ subgridId: 1, blockerId: 1, blockedId: 1 }, { unique: true });

module.exports = mongoose.model('FriendBlock', friendBlockSchema);
