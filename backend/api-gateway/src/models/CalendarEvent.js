const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    location: {
        type: String,
        default: '',
    },
    notes: {
        type: String,
        default: '',
    },
    startAt: {
        type: Date,
        required: true,
    },
    endAt: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'canceled'],
        default: 'scheduled',
    },
    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
    },
    providerEventId: {
        type: String,
        default: null,
    },
    providerCalendarId: {
        type: String,
        default: null,
    },
    attendees: {
        type: [String],
        default: [],
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

calendarEventSchema.pre('save', function updateTimestamp() {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
