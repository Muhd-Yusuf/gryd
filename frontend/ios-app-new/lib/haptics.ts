/**
 * Haptic feedback utility
 * Wraps expo-haptics with Platform checks (no-op on web)
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const hapticLight = () => {
    if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
};

export const hapticMedium = () => {
    if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
};

export const hapticSuccess = () => {
    if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
};

export const hapticError = () => {
    if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
};

export const hapticSelection = () => {
    if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
    }
};
