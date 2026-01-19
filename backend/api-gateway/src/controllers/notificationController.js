/**
 * Notification Controller
 * Handles push notification registration and sending
 */

const pushService = require('../services/pushNotificationService');
const User = require('../models/User');

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
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Update notification preferences
 * PATCH /api/notifications/preferences
 */
const updatePreferences = async (req, res) => {
    try {
        const userId = req.user._id;
        const { messages, dms, calls, mentions, invites } = req.body;

        const update = {};
        if (messages !== undefined) update['notificationPreferences.messages'] = messages;
        if (dms !== undefined) update['notificationPreferences.dms'] = dms;
        if (calls !== undefined) update['notificationPreferences.calls'] = calls;
        if (mentions !== undefined) update['notificationPreferences.mentions'] = mentions;
        if (invites !== undefined) update['notificationPreferences.invites'] = invites;

        await User.findByIdAndUpdate(userId, { $set: update });

        res.json({
            success: true,
            message: 'Notification preferences updated'
        });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ success: false, error: error.message });
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
            }
        });
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    registerPushToken,
    unregisterPushToken,
    sendTestNotification,
    getPushTokens,
    updatePreferences,
    getPreferences,
};
