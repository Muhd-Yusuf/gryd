/**
 * Notification Routes
 * Push notification registration and management
 */

const express = require('express');
const router = express.Router();
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

// Attach user context to all routes
router.use(attachUserContext);

// Register push token
router.post('/register',
    requireUser,
    notificationController.registerPushToken
);

// Unregister push token
router.delete('/unregister',
    requireUser,
    notificationController.unregisterPushToken
);

// Send test notification
router.post('/test',
    requireUser,
    notificationController.sendTestNotification
);

// Get registered push tokens
router.get('/tokens',
    requireUser,
    notificationController.getPushTokens
);

// Get notification preferences
router.get('/preferences',
    requireUser,
    notificationController.getPreferences
);

// Update notification preferences
router.patch('/preferences',
    requireUser,
    notificationController.updatePreferences
);

// ===== In-app Notification Inbox =====

// Get in-app notifications (inbox)
router.get('/inbox',
    requireUser,
    notificationController.getInboxNotifications
);

// Get unread notification count
router.get('/unread-count',
    requireUser,
    notificationController.getUnreadCount
);

// Mark notification(s) as read
router.patch('/read',
    requireUser,
    notificationController.markAsRead
);

// Delete notification(s)
router.delete('/inbox',
    requireUser,
    notificationController.deleteNotifications
);

module.exports = router;
