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

module.exports = router;
