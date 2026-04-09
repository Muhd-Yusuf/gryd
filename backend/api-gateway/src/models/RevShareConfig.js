const mongoose = require('mongoose');

// Priority order when resolving percentages for a transaction:
//   1. partner scope  (most specific — overrides everything for a specific vendor)
//   2. cu scope       (overrides global for a specific community unit)
//   3. global scope   (platform-wide default set by super admin)
//   4. hardcoded fallback (80/15/5) — only when no config exists at all

const revShareConfigSchema = new mongoose.Schema(
    {
        scope: {
            type: String,
            enum: ['global', 'cu', 'partner'],
            required: true,
        },
        // Set when scope = 'cu' or 'partner'
        cuId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subgrid',
            default: null,
            index: true,
        },
        // Set when scope = 'partner'
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        partnerCutPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        cuCutPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        platformCutPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        label: {
            type: String,
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// Enforce: percentages must add up to 100 (works for save and findOneAndUpdate)
function validatePercentages(doc, next) {
    const total = (doc.partnerCutPercent || 0) + (doc.cuCutPercent || 0) + (doc.platformCutPercent || 0);
    if (Math.round(total) !== 100) {
        return next(new Error(`Percentages must add up to 100 (got ${total})`));
    }
    next();
}

revShareConfigSchema.pre('save', function (next) {
    validatePercentages(this, next);
});

revShareConfigSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    validatePercentages(update, next);
});

// Only one active global config at a time
revShareConfigSchema.index(
    { scope: 1, cuId: 1, partnerId: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('RevShareConfig', revShareConfigSchema);
