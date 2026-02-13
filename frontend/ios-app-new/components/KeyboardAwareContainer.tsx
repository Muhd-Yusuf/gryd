/**
 * Centralized Keyboard-Aware Container Component
 * Handles keyboard avoidance consistently across the platform
 * Use this to wrap any screen with text input that needs keyboard handling
 */

import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    ViewStyle,
    StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardAwareContainerProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Additional offset to add to keyboard height (default: 0) */
    extraOffset?: number;
    /** Whether to enable keyboard avoidance (default: true on mobile) */
    enabled?: boolean;
}

export const KeyboardAwareContainer: React.FC<KeyboardAwareContainerProps> = ({
    children,
    style,
    extraOffset = 0,
    enabled,
}) => {
    const insets = useSafeAreaInsets();

    // Default to enabled on iOS/Android, disabled on web
    const isEnabled = enabled ?? Platform.OS !== 'web';

    // iOS uses 'padding' behavior, Android uses 'height'
    const behavior = Platform.OS === 'ios' ? 'padding' : 'height';

    // Calculate keyboard vertical offset
    // On iOS, we need to account for the bottom safe area
    const keyboardVerticalOffset = Platform.OS === 'ios'
        ? insets.bottom + extraOffset
        : extraOffset;

    return (
        <KeyboardAvoidingView
            style={[styles.container, style]}
            behavior={behavior}
            enabled={isEnabled}
            keyboardVerticalOffset={keyboardVerticalOffset}
        >
            {children}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default KeyboardAwareContainer;
