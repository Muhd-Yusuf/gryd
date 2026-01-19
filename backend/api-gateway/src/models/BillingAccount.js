const mongoose = require('mongoose');

const billingAccountSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    billingEmail: {
        type: String,
        default: '',
        trim: true,
    },
    status: {
        type: String,
        enum: ['active', 'past_due', 'suspended'],
        default: 'active',
    },
    plaidCustomerId: {
        type: String,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

billingAccountSchema.pre('save', function updateTimestamp() {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('BillingAccount', billingAccountSchema);
