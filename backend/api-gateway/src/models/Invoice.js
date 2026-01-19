const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    number: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['draft', 'open', 'paid', 'void'],
        default: 'open',
    },
    amountDue: {
        type: Number,
        default: 0,
    },
    amountPaid: {
        type: Number,
        default: 0,
    },
    dueDate: {
        type: Date,
        default: null,
    },
    issuedAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Invoice', invoiceSchema);
