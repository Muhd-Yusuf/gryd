/**
 * Push Notification Service
 *
 * Supports:
 * - Expo Push Notifications (for Expo apps)
 * - Firebase Cloud Messaging (FCM) for native iOS/Android
 *
 * Configuration:
 * - For Expo: No API key needed, just use expo-notifications in the app
 * - For FCM: Set FIREBASE_SERVICE_ACCOUNT_JSON or individual FIREBASE_* env vars
 */

const { Expo } = require('expo-server-sdk');

// Initialize Expo SDK
const expo = new Expo();

// Firebase Admin SDK (lazy loaded)
let firebaseAdmin = null;

/**
 * Initialize Firebase Admin SDK
 */
const initFirebase = () => {
    if (firebaseAdmin) return firebaseAdmin;

    try {
        const admin = require('firebase-admin');

        // Check for service account JSON
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            firebaseAdmin = admin;
            console.log('Firebase Admin initialized with service account');
        } else if (process.env.FIREBASE_PROJECT_ID) {
            // Use individual environment variables
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }),
            });
            firebaseAdmin = admin;
            console.log('Firebase Admin initialized with env vars');
        }
    } catch (error) {
        console.warn('Firebase Admin not initialized:', error.message);
    }

    return firebaseAdmin;
};

/**
 * Check if a push token is an Expo token
 * @param {string} token - Push token
 * @returns {boolean}
 */
const isExpoToken = (token) => {
    return Expo.isExpoPushToken(token);
};

/**
 * Send push notification via Expo
 * @param {Object} options - Notification options
 * @param {string} options.to - Expo push token
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Additional data payload
 * @param {string} options.sound - Sound to play ('default' or null)
 * @param {number} options.badge - Badge count (iOS)
 * @param {string} options.channelId - Android notification channel
 * @returns {Promise<Object>} - Send result
 */
const sendExpoNotification = async ({ to, title, body, data = {}, sound = 'default', badge, channelId }) => {
    if (!Expo.isExpoPushToken(to)) {
        throw new Error(`Invalid Expo push token: ${to}`);
    }

    const message = {
        to,
        title,
        body,
        data,
        sound,
        ...(badge !== undefined && { badge }),
        ...(channelId && { channelId }),
    };

    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
        try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        } catch (error) {
            console.error('Expo push error:', error);
            throw error;
        }
    }

    return tickets[0];
};

/**
 * Send push notification via Firebase (FCM)
 * @param {Object} options - Notification options
 * @param {string} options.to - FCM device token
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Additional data payload
 * @param {string} options.imageUrl - Image URL for rich notification
 * @param {string} options.channelId - Android notification channel
 * @returns {Promise<Object>} - Send result
 */
const sendFCMNotification = async ({ to, title, body, data = {}, imageUrl, channelId }) => {
    const admin = initFirebase();
    if (!admin) {
        throw new Error('Firebase not configured');
    }

    const message = {
        token: to,
        notification: {
            title,
            body,
            ...(imageUrl && { imageUrl }),
        },
        data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: {
            notification: {
                ...(channelId && { channelId }),
                priority: 'high',
            },
        },
        apns: {
            payload: {
                aps: {
                    alert: { title, body },
                    sound: 'default',
                },
            },
        },
    };

    const response = await admin.messaging().send(message);
    return { messageId: response };
};

/**
 * Send push notification (auto-detects token type)
 * @param {Object} options - Notification options
 * @returns {Promise<Object>} - Send result
 */
const sendPushNotification = async (options) => {
    const { to } = options;

    if (isExpoToken(to)) {
        return sendExpoNotification(options);
    }

    // Assume FCM token
    return sendFCMNotification(options);
};

/**
 * Send push notifications to multiple devices
 * @param {Array<Object>} notifications - Array of notification options
 * @returns {Promise<Array<Object>>} - Send results
 */
const sendBulkNotifications = async (notifications) => {
    const expoMessages = [];
    const fcmMessages = [];

    // Separate by token type
    for (const notification of notifications) {
        if (isExpoToken(notification.to)) {
            expoMessages.push({
                to: notification.to,
                title: notification.title,
                body: notification.body,
                data: notification.data || {},
                sound: notification.sound || 'default',
                ...(notification.badge !== undefined && { badge: notification.badge }),
                ...(notification.channelId && { channelId: notification.channelId }),
            });
        } else {
            fcmMessages.push(notification);
        }
    }

    const results = [];

    // Send Expo notifications in bulk
    if (expoMessages.length > 0) {
        const chunks = expo.chunkPushNotifications(expoMessages);
        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                results.push(...ticketChunk.map((ticket, i) => ({
                    token: chunk[i].to,
                    ...ticket,
                    provider: 'expo',
                })));
            } catch (error) {
                console.error('Expo bulk push error:', error);
                results.push(...chunk.map(msg => ({
                    token: msg.to,
                    status: 'error',
                    message: error.message,
                    provider: 'expo',
                })));
            }
        }
    }

    // Send FCM notifications
    for (const notification of fcmMessages) {
        try {
            const result = await sendFCMNotification(notification);
            results.push({
                token: notification.to,
                status: 'ok',
                ...result,
                provider: 'fcm',
            });
        } catch (error) {
            results.push({
                token: notification.to,
                status: 'error',
                message: error.message,
                provider: 'fcm',
            });
        }
    }

    return results;
};

/**
 * Check receipt status for Expo notifications
 * @param {Array<string>} receiptIds - Receipt IDs from send response
 * @returns {Promise<Object>} - Receipt statuses
 */
const checkExpoReceipts = async (receiptIds) => {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    const receipts = {};

    for (const chunk of receiptIdChunks) {
        try {
            const chunkReceipts = await expo.getPushNotificationReceiptsAsync(chunk);
            Object.assign(receipts, chunkReceipts);
        } catch (error) {
            console.error('Error fetching receipts:', error);
        }
    }

    return receipts;
};

// ===================
// NOTIFICATION TYPES
// ===================

/**
 * Send new message notification
 */
const sendMessageNotification = async ({ pushToken, senderName, messagePreview, channelName, data }) => {
    return sendPushNotification({
        to: pushToken,
        title: channelName ? `${senderName} in #${channelName}` : senderName,
        body: messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview,
        data: {
            type: 'message',
            ...data,
        },
        channelId: 'messages',
    });
};

/**
 * Send DM notification
 */
const sendDMNotification = async ({ pushToken, senderName, messagePreview, data }) => {
    return sendPushNotification({
        to: pushToken,
        title: senderName,
        body: messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview,
        data: {
            type: 'dm',
            ...data,
        },
        channelId: 'messages',
    });
};

/**
 * Send incoming call notification
 */
const sendCallNotification = async ({ pushToken, callerName, callType, data }) => {
    return sendPushNotification({
        to: pushToken,
        title: `Incoming ${callType} call`,
        body: `${callerName} is calling you`,
        data: {
            type: 'call',
            callType,
            ...data,
        },
        channelId: 'calls',
        sound: 'default',
    });
};

/**
 * Send mention notification
 */
const sendMentionNotification = async ({ pushToken, senderName, channelName, messagePreview, data }) => {
    return sendPushNotification({
        to: pushToken,
        title: `${senderName} mentioned you in #${channelName}`,
        body: messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview,
        data: {
            type: 'mention',
            ...data,
        },
        channelId: 'mentions',
    });
};

/**
 * Send invite notification
 */
const sendInviteNotification = async ({ pushToken, inviterName, communityName, data }) => {
    return sendPushNotification({
        to: pushToken,
        title: 'New Invitation',
        body: `${inviterName} invited you to join ${communityName}`,
        data: {
            type: 'invite',
            ...data,
        },
        channelId: 'invites',
    });
};

/**
 * Check if push notifications are configured
 */
const isPushConfigured = () => {
    // Expo is always available (no config needed)
    // FCM needs Firebase config
    return true;
};

module.exports = {
    sendPushNotification,
    sendExpoNotification,
    sendFCMNotification,
    sendBulkNotifications,
    checkExpoReceipts,
    isExpoToken,
    isPushConfigured,
    // Typed notifications
    sendMessageNotification,
    sendDMNotification,
    sendCallNotification,
    sendMentionNotification,
    sendInviteNotification,
};
