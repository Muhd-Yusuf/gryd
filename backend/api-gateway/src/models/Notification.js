const mongoose = require('mongoose');

/**
 * In-app Notification Schema
 * Stores notification history for users to view in their notification center
 */
const notificationSchema = new mongoose.Schema({
    // The user who receives this notification
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // Notification type for categorization and display
    type: {
        type: String,
        enum: [
            'message',      // New channel message
            'dm',           // Direct message
            'mention',      // User was mentioned
            'call',         // Incoming/missed call
            'invite',       // Community/channel invite
            'member_join',  // New member joined
            'member_leave', // Member left
            'event',        // Event reminder/update
            'announcement', // Announcement from admin
            'system',       // System notification
        ],
        required: true,
        index: true,
    },
    // Display title
    title: {
        type: String,
        required: true,
    },
    // Display body/message
    body: {
        type: String,
        required: true,
    },
    // Optional image URL (avatar, thumbnail, etc.)
    imageUrl: {
        type: String,
        default: null,
    },
    // Additional data for navigation/context
    data: {
        subgridId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subgrid' },
        channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
        messageId: { type: mongoose.Schema.Types.ObjectId },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        senderName: { type: String },
        callId: { type: String },
        callType: { type: String, enum: ['audio', 'video'] },
        inviteToken: { type: String },
        eventId: { type: mongoose.Schema.Types.ObjectId },
    },
    // Read status
    read: {
        type: Boolean,
        default: false,
        index: true,
    },
    // When the notification was read
    readAt: {
        type: Date,
        default: null,
    },
    // Expiration (optional - for time-sensitive notifications)
    expiresAt: {
        type: Date,
        default: null,
        index: true,
    },
}, {
    timestamps: true, // createdAt, updatedAt
});

// Compound index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// TTL index to auto-delete old notifications (optional - 30 days)
// notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
