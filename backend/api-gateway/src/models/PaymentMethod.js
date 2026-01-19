const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    provider: {
        type: String,
        default: 'plaid',
    },
    type: {
        type: String,
        enum: ['ach'],
        default: 'ach',
    },
    last4: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
