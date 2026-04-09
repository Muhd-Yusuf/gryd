const mongoose = require('mongoose');

const marketplaceListingSchema = new mongoose.Schema({
    partnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    cuIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    category: {
        type: String,
        enum: ['discount', 'service', 'product', 'event', 'Discounts', 'Services', 'Products', 'Events'],
    },
    discountPercent: {
        type: Number,
        min: 0,
        max: 100,
    },
    originalPrice: {
        type: Number,
    },
    discountedPrice: {
        type: Number,
    },
    images: {
        type: [String],
        default: [],
    },
    redemptionType: {
        type: String,
        enum: ['code', 'link', 'in-store'],
    },
    redemptionValue: {
        type: String,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    expiresAt: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('MarketplaceListing', marketplaceListingSchema);
