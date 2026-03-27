/**
 * Notification Context
 * Handles push notification setup, permissions, and token registration
 * Works for all user roles: super admin, CU admin, and members
 *
 * Call notifications use a dedicated channel with MAX importance and system ringtone.
 * The 'calls' channel must be deleted and recreated if settings change (Android caches channels).
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
    registerPushToken,
    unregisterPushToken,
    getAuthUser,
    getUserId,
} from '../lib/api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data;
        if (data?.type === 'call') {
            return {
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
            };
        }
        return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        };
    },
});

// Set up notification categories with action buttons (native only)
async function setupNotificationCategories() {
    if (Platform.OS === 'web') return;
    await Notifications.setNotificationCategoryAsync('incoming_call', [
        {
            identifier: 'answer',
            buttonTitle: 'Answer',
            options: { opensAppToForeground: true },
        },
        {
            identifier: 'decline',
            buttonTitle: 'Decline',
            options: { opensAppToForeground: false, isDestructive: true },
        },
    ]);
}
setupNotificationCategories();

/**
 * Delete and recreate notification channels to pick up new settings.
 * Android caches channel config after first creation — the only way
 * to change importance/sound/vibration is to delete + recreate.
 */
async function setupAndroidChannels() {
    if (Platform.OS !== 'android') return;

    // Delete old channels so updated settings take effect
    const channelIds = ['calls', 'messages', 'mentions', 'invites'];
    for (const id of channelIds) {
        try {
            await Notifications.deleteNotificationChannelAsync(id);
        } catch (_) {}
    }

    // Calls channel — MAX importance, system ringtone, heads-up, lock screen
    await Notifications.setNotificationChannelAsync('calls', {
        name: 'Incoming Calls',
        description: 'Incoming voice and video call alerts with ringtone',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default', // uses system default notification sound
        vibrationPattern: [0, 500, 200, 500, 200, 500, 200, 500],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: false,
        enableLights: true,
        lightColor: '#22c55e',
        enableVibrate: true,
    });

    // Messages channel
    await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        description: 'Direct messages and channel messages',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22c55e',
        enableLights: true,
        enableVibrate: true,
    });

    // Mentions channel
    await Notifications.setNotificationChannelAsync('mentions', {
        name: 'Mentions',
        description: 'When someone mentions you',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f59e0b',
        enableLights: true,
        enableVibrate: true,
    });

    // Invites channel
    await Notifications.setNotificationChannelAsync('invites', {
        name: 'Invitations',
        description: 'Community and group invitations',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
    });
}

export interface NotificationData {
    type: 'message' | 'dm' | 'call' | 'mention' | 'invite';
    subgridId?: string;
    channelId?: string;
    messageId?: string;
    senderId?: string;
    peerId?: string;
    callId?: string;
    callerId?: string;
    callerName?: string;
    callerAvatar?: string;
    callType?: 'audio' | 'video';
    channelName?: string;
    token?: string;
    uid?: number;
    appId?: string;
}

// Callback for handling call actions from notification buttons
let onCallAnswered: ((data: NotificationData) => void) | null = null;
let onCallDeclined: ((data: NotificationData) => void) | null = null;

export const setCallNotificationHandlers = (
    answerHandler: (data: NotificationData) => void,
    declineHandler: (data: NotificationData) => void,
) => {
    onCallAnswered = answerHandler;
    onCallDeclined = declineHandler;
};

interface NotificationContextValue {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    permissionStatus: Notifications.PermissionStatus | null;
    isRegistered: boolean;
    requestPermissions: () => Promise<boolean>;
    registerToken: () => Promise<void>;
    unregisterToken: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const isRegisteringRef = useRef(false);
    const router = useRouter();

    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();

    /**
     * Get the Expo push token for this device
     */
    const getExpoPushToken = async (): Promise<string | null> => {
        if (!Device.isDevice) return null;

        try {
            const projectId =
                Constants.expoConfig?.extra?.eas?.projectId ||
                Constants.easConfig?.projectId ||
                Constants.expoConfig?.extra?.expoProjectId;

            if (!projectId || projectId === 'your-project-id-here') {
                if (__DEV__) {
                    try {
                        const tokenData = await Notifications.getExpoPushTokenAsync();
                        return tokenData.data;
                    } catch { return null; }
                }
                return null;
            }

            try {
                const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
                return tokenData.data;
            } catch (projectIdError: any) {
                if (__DEV__) {
                    try {
                        const tokenData = await Notifications.getExpoPushTokenAsync();
                        return tokenData.data;
                    } catch {}
                }
                throw projectIdError;
            }
        } catch {
            return null;
        }
    };

    /**
     * Request notification permissions and set up Android channels
     */
    const requestPermissions = useCallback(async (): Promise<boolean> => {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync({
                android: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                    allowAnnouncements: true,
                },
            });
            finalStatus = status;
        }

        setPermissionStatus(finalStatus);

        if (finalStatus !== 'granted') return false;

        // Set up Android notification channels (deletes + recreates to pick up changes)
        await setupAndroidChannels();

        return true;
    }, []);

    /**
     * Register the push token with the backend
     */
    const registerToken = useCallback(async (): Promise<void> => {
        if (Platform.OS === 'web') return;
        if (isRegisteringRef.current) return;
        isRegisteringRef.current = true;

        try {
            const userId = getUserId();
            if (!userId) return;

            const hasPermission = await requestPermissions();
            if (!hasPermission) return;

            const token = await getExpoPushToken();
            if (!token) return;

            setExpoPushToken(token);

            const platform = Platform.OS === 'ios' ? 'ios' : 'android';
            const deviceId = Device.deviceName || undefined;

            await registerPushToken(token, platform, deviceId);
            setIsRegistered(true);
            console.log('[Notification] Token registered successfully');
        } catch (err: any) {
            console.error('[Notification] Token registration failed:', err?.message);
        } finally {
            isRegisteringRef.current = false;
        }
    }, [requestPermissions]);

    /**
     * Unregister the push token from the backend
     */
    const unregisterToken = useCallback(async (): Promise<void> => {
        if (!expoPushToken) return;
        try {
            await unregisterPushToken(expoPushToken);
            setIsRegistered(false);
            setExpoPushToken(null);
        } catch {}
    }, [expoPushToken]);

    /**
     * Handle notification tap/response
     */
    const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data as NotificationData;
        if (!data?.type) return;

        // Check if this is a button action (Answer/Decline)
        const actionId = response.actionIdentifier;
        if (data.type === 'call' && actionId && actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
            if (actionId === 'answer') {
                onCallAnswered?.(data);
            } else if (actionId === 'decline') {
                onCallDeclined?.(data);
            }
            return;
        }

        switch (data.type) {
            case 'message':
            case 'mention':
                if (data.subgridId && data.channelId) {
                    router.push(`/(main)/sub-channel?subgridId=${data.subgridId}&channelId=${data.channelId}`);
                }
                break;

            case 'dm':
                {
                    const peerId = data.senderId ?? data.peerId;
                    if (!peerId) break;
                    router.push({
                        pathname: '/(main)/direct-messages/[peerId]',
                        params: data.subgridId ? { peerId, subgridId: data.subgridId } : { peerId },
                    });
                }
                break;

            case 'call':
                if (data.callerId) {
                    onCallAnswered?.(data);
                }
                break;

            case 'invite':
                router.push('/(main)/notifications');
                break;
        }
    }, [router]);

    // Set up notification listeners on mount
    useEffect(() => {
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, [handleNotificationResponse]);

    // Auto-register token when user is logged in (with retry)
    useEffect(() => {
        let retryCount = 0;
        let timer: ReturnType<typeof setTimeout>;

        const checkAndRegister = async () => {
            try {
                const user = await getAuthUser();
                if (user?.userId) {
                    await registerToken();
                }
            } catch {
                if (retryCount < 3) {
                    retryCount++;
                    timer = setTimeout(checkAndRegister, 2000 * Math.pow(2, retryCount));
                }
            }
        };

        timer = setTimeout(checkAndRegister, 1000);
        return () => clearTimeout(timer);
    }, [registerToken]);

    const value: NotificationContextValue = {
        expoPushToken,
        notification,
        permissionStatus,
        isRegistered,
        requestPermissions,
        registerToken,
        unregisterToken,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = (): NotificationContextValue | null => {
    return useContext(NotificationContext);
};

export default NotificationContext;
