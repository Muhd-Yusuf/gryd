const mongoose = require('mongoose');

const calendarConnectionSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    provider: {
        type: String,
        enum: ['google'],
        required: true,
    },
    accessToken: {
        type: String,
        default: '',
    },
    refreshToken: {
        type: String,
        default: '',
    },
    tokenType: {
        type: String,
        default: '',
    },
    scope: {
        type: String,
        default: '',
    },
    expiryDate: {
        type: Number,
        default: null,
    },
    email: {
        type: String,
        default: '',
    },
    calendarId: {
        type: String,
        default: 'primary',
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

calendarConnectionSchema.index({ tenantId: 1, userId: 1, provider: 1 }, { unique: true });

calendarConnectionSchema.pre('save', function updateTimestamp() {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('CalendarConnection', calendarConnectionSchema);
