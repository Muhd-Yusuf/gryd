/**
 * Notification Context
 * Handles push notification setup, permissions, and token registration
 * Works for all user roles: super admin, CU admin, and members
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
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface NotificationData {
    type: 'message' | 'dm' | 'call' | 'mention' | 'invite';
    subgridId?: string;
    channelId?: string;
    messageId?: string;
    senderId?: string;
    peerId?: string;
    callId?: string;
    callType?: 'audio' | 'video';
}

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
    const router = useRouter();

    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();

    /**
     * Get the Expo push token for this device
     */
    const getExpoPushToken = async (): Promise<string | null> => {
        // Push notifications require a physical device (not simulator)
        if (!Device.isDevice) {
            return null;
        }

        try {
            // Get project ID for Expo - check multiple sources
            const projectId =
                Constants.expoConfig?.extra?.eas?.projectId ||
                Constants.easConfig?.projectId ||
                Constants.expoConfig?.extra?.expoProjectId;

            // Check if projectId is a placeholder
            if (!projectId || projectId === 'your-project-id-here') {
                // In Expo Go, try without projectId (uses the Expo Go's project)
                if (__DEV__) {
                    try {
                        const tokenData = await Notifications.getExpoPushTokenAsync();
                        return tokenData.data;
                    } catch {
                        return null;
                    }
                }
                return null;
            }

            // Try with projectId first
            try {
                const tokenData = await Notifications.getExpoPushTokenAsync({
                    projectId,
                });
                return tokenData.data;
            } catch (projectIdError: any) {
                // In development, try without projectId as a fallback
                if (__DEV__) {
                    try {
                        const tokenData = await Notifications.getExpoPushTokenAsync();
                        return tokenData.data;
                    } catch {
                        // Silently fail in dev mode
                    }
                }
                throw projectIdError;
            }
        } catch {
            return null;
        }
    };

    /**
     * Request notification permissions
     */
    const requestPermissions = useCallback(async (): Promise<boolean> => {
        // Check current permission status
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Request permissions if not already granted
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        setPermissionStatus(finalStatus);

        if (finalStatus !== 'granted') {
            return false;
        }

        // Set up Android notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('messages', {
                name: 'Messages',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#22c55e',
                sound: 'default',
            });

            await Notifications.setNotificationChannelAsync('calls', {
                name: 'Calls',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 500, 500],
                lightColor: '#22c55e',
                sound: 'default',
            });

            await Notifications.setNotificationChannelAsync('mentions', {
                name: 'Mentions',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#f59e0b',
                sound: 'default',
            });

            await Notifications.setNotificationChannelAsync('invites', {
                name: 'Invitations',
                importance: Notifications.AndroidImportance.DEFAULT,
                sound: 'default',
            });
        }

        return true;
    }, []);

    /**
     * Register the push token with the backend
     */
    const registerToken = useCallback(async (): Promise<void> => {
        const userId = getUserId();
        if (!userId) {
            return;
        }

        // Check if we have permission
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
            return;
        }

        // Get push token
        const token = await getExpoPushToken();
        if (!token) {
            return;
        }

        setExpoPushToken(token);

        // Register with backend
        try {
            const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
            const deviceId = Device.deviceName || undefined;

            await registerPushToken(token, platform, deviceId);
            setIsRegistered(true);
        } catch {
            // Silently fail - token registration is best-effort
        }
    }, [requestPermissions]);

    /**
     * Unregister the push token from the backend
     */
    const unregisterToken = useCallback(async (): Promise<void> => {
        if (!expoPushToken) {
            return;
        }

        try {
            await unregisterPushToken(expoPushToken);
            setIsRegistered(false);
            setExpoPushToken(null);
        } catch {
            // Silently fail - token unregistration is best-effort
        }
    }, [expoPushToken]);

    /**
     * Handle notification tap/response
     */
    const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data as NotificationData;

        if (!data?.type) return;

        switch (data.type) {
            case 'message':
            case 'mention':
                // Navigate to channel
                if (data.subgridId && data.channelId) {
                    router.push(`/(main)/sub-channel?subgridId=${data.subgridId}&channelId=${data.channelId}`);
                }
                break;

            case 'dm':
                // Navigate to DM
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
                // Call handling is done by CallContext, just bring app to foreground
                break;

            case 'invite':
                // Navigate to notifications/invites screen
                router.push('/(main)/notifications');
                break;
        }
    }, [router]);

    // Set up notification listeners on mount
    useEffect(() => {
        // Listen for notifications received while app is foregrounded
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
        });

        // Listen for user interaction with notifications
        responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [handleNotificationResponse]);

    // Auto-register token when user is logged in
    useEffect(() => {
        const checkAndRegister = async () => {
            try {
                const user = await getAuthUser();
                if (user?.userId) {
                    await registerToken();
                }
            } catch {
                // Silently fail - notification registration is best-effort
            }
        };

        // Small delay to ensure auth is initialized
        const timer = setTimeout(checkAndRegister, 1000);
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

export const useNotifications = (): NotificationContextValue => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export default NotificationContext;
