const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
    subgridId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subgrid',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    friendId: {
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

friendshipSchema.index({ subgridId: 1, userId: 1, friendId: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);
