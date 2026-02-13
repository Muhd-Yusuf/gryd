const mongoose = require('mongoose');

const subgridBanSchema = new mongoose.Schema({
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
    },
    bannedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    reason: {
        type: String,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index for unique ban per user per subgrid
subgridBanSchema.index({ subgridId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('SubgridBan', subgridBanSchema);
