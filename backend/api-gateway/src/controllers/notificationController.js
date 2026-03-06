/**
 * Notification Controller
 * Handles push notification registration, sending, and in-app notification history
 */

const pushService = require('../services/pushNotificationService');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Register push token for a user
 * POST /api/notifications/register
 */
const registerPushToken = async (req, res) => {
    try {
        const { pushToken, platform, deviceId } = req.body;
        const userId = req.user._id;

        if (!pushToken) {
            return res.status(400).json({
                success: false,
                error: 'pushToken is required'
            });
        }

        // Store push token on user document
        // Using $addToSet to avoid duplicates
        await User.findByIdAndUpdate(userId, {
            $addToSet: {
                pushTokens: {
                    token: pushToken,
                    platform: platform || 'unknown',
                    deviceId: deviceId || null,
                    createdAt: new Date(),
                }
            }
        });

        res.json({
            success: true,
            message: 'Push token registered successfully'
        });
    } catch (error) {
        console.error('Register push token error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Unregister push token
 * DELETE /api/notifications/unregister
 */
const unregisterPushToken = async (req, res) => {
    try {
        const { pushToken } = req.body;
        const userId = req.user._id;

        if (!pushToken) {
            return res.status(400).json({
                success: false,
                error: 'pushToken is required'
            });
        }

        await User.findByIdAndUpdate(userId, {
            $pull: {
                pushTokens: { token: pushToken }
            }
        });

        res.json({
            success: true,
            message: 'Push token unregistered successfully'
        });
    } catch (error) {
        console.error('Unregister push token error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Send test notification to current user
 * POST /api/notifications/test
 */
const sendTestNotification = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user.pushTokens || user.pushTokens.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No push tokens registered for this user'
            });
        }

        const results = await pushService.sendBulkNotifications(
            user.pushTokens.map(t => ({
                to: t.token,
                title: 'Test Notification',
                body: 'This is a test notification from The GRYD',
                data: { type: 'test' },
            }))
        );

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Send test notification error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Get user's registered push tokens
 * GET /api/notifications/tokens
 */
const getPushTokens = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).select('pushTokens');

        res.json({
            success: true,
            data: user.pushTokens || []
        });
    } catch (error) {
        console.error('Get push tokens error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Update notification preferences
 * PATCH /api/notifications/preferences
 */
const updatePreferences = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            messages, dms, calls, mentions, invites,
            // Super Admin email notification preferences
            systemAlerts, securityEvents, dailyReports, weeklyReports
        } = req.body;

        const update = {};
        if (messages !== undefined) update['notificationPreferences.messages'] = messages;
        if (dms !== undefined) update['notificationPreferences.dms'] = dms;
        if (calls !== undefined) update['notificationPreferences.calls'] = calls;
        if (mentions !== undefined) update['notificationPreferences.mentions'] = mentions;
        if (invites !== undefined) update['notificationPreferences.invites'] = invites;
        // Super Admin email notification preferences
        if (systemAlerts !== undefined) update['notificationPreferences.systemAlerts'] = systemAlerts;
        if (securityEvents !== undefined) update['notificationPreferences.securityEvents'] = securityEvents;
        if (dailyReports !== undefined) update['notificationPreferences.dailyReports'] = dailyReports;
        if (weeklyReports !== undefined) update['notificationPreferences.weeklyReports'] = weeklyReports;

        await User.findByIdAndUpdate(userId, { $set: update });

        res.json({
            success: true,
            message: 'Notification preferences updated'
        });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Get notification preferences
 * GET /api/notifications/preferences
 */
const getPreferences = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).select('notificationPreferences');

        res.json({
            success: true,
            data: user.notificationPreferences || {
                messages: true,
                dms: true,
                calls: true,
                mentions: true,
                invites: true,
                // Super Admin email notification defaults
                systemAlerts: true,
                securityEvents: true,
                dailyReports: true,
                weeklyReports: true,
            }
        });
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Get in-app notifications for user
 * GET /api/notifications/inbox
 */
const getInboxNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const { limit = 50, offset = 0, type, unreadOnly } = req.query;

        const query = { userId };
        if (type) query.type = type;
        if (unreadOnly === 'true') query.read = false;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(parseInt(offset))
                .limit(parseInt(limit))
                .lean(),
            Notification.countDocuments(query),
            Notification.countDocuments({ userId, read: false }),
        ]);

        res.json({
            success: true,
            data: {
                notifications,
                total,
                unreadCount,
                hasMore: parseInt(offset) + notifications.length < total,
            }
        });
    } catch (error) {
        console.error('Get inbox notifications error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Mark notification(s) as read
 * PATCH /api/notifications/read
 */
const markAsRead = async (req, res) => {
    try {
        const userId = req.user._id;
        const { notificationIds, markAll } = req.body;

        if (markAll) {
            await Notification.updateMany(
                { userId, read: false },
                { $set: { read: true, readAt: new Date() } }
            );
        } else if (notificationIds && notificationIds.length > 0) {
            await Notification.updateMany(
                { _id: { $in: notificationIds }, userId },
                { $set: { read: true, readAt: new Date() } }
            );
        } else {
            return res.status(400).json({
                success: false,
                error: 'notificationIds or markAll is required'
            });
        }

        res.json({
            success: true,
            message: 'Notifications marked as read'
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Delete notification(s)
 * DELETE /api/notifications/inbox
 */
const deleteNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const { notificationIds, deleteAll } = req.body;

        if (deleteAll) {
            await Notification.deleteMany({ userId });
        } else if (notificationIds && notificationIds.length > 0) {
            await Notification.deleteMany({
                _id: { $in: notificationIds },
                userId
            });
        } else {
            return res.status(400).json({
                success: false,
                error: 'notificationIds or deleteAll is required'
            });
        }

        res.json({
            success: true,
            message: 'Notifications deleted'
        });
    } catch (error) {
        console.error('Delete notifications error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Create in-app notification (internal use / admin)
 * This is typically called by other parts of the system, not directly by users
 */
const createNotification = async (userId, type, title, body, data = {}, imageUrl = null) => {
    try {
        const notification = await Notification.create({
            userId,
            type,
            title,
            body,
            data,
            imageUrl,
        });
        return notification;
    } catch (error) {
        console.error('Create notification error:', error);
        return null;
    }
};

/**
 * Create notifications for multiple users
 */
const createBulkNotifications = async (userIds, type, title, body, data = {}, imageUrl = null) => {
    try {
        const notifications = userIds.map(userId => ({
            userId,
            type,
            title,
            body,
            data,
            imageUrl,
        }));
        await Notification.insertMany(notifications);
        return true;
    } catch (error) {
        console.error('Create bulk notifications error:', error);
        return false;
    }
};

/**
 * Get unread count for user
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = await Notification.countDocuments({ userId, read: false });

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ success: false });
    }
};

module.exports = {
    registerPushToken,
    unregisterPushToken,
    sendTestNotification,
    getPushTokens,
    updatePreferences,
    getPreferences,
    // In-app notification endpoints
    getInboxNotifications,
    markAsRead,
    deleteNotifications,
    getUnreadCount,
    // Internal helper functions
    createNotification,
    createBulkNotifications,
};
