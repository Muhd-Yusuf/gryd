const mongoose = require('mongoose');

const marketplaceOrderSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketplaceListing',
        required: true,
    },
    cuId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    status: {
        type: String,
        enum: ['pending', 'redeemed', 'expired'],
        default: 'pending',
    },
    redemptionCode: {
        type: String,
    },
    redeemedAt: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('MarketplaceOrder', marketplaceOrderSchema);
