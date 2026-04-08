/**
 * SafeBlurView — wraps expo-blur's BlurView with a graceful fallback.
 * In Expo Go (where ExpoBlurView native module isn't available) it renders
 * a plain semi-transparent View so the app doesn't crash.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';

interface SafeBlurViewProps {
    intensity?: number;
    tint?: 'light' | 'dark' | 'default';
    style?: ViewStyle | ViewStyle[];
    children?: React.ReactNode;
}

let BlurViewNative: React.ComponentType<any> | null = null;
let blurAvailable = false;

try {
    const mod = require('expo-blur');
    if (mod?.BlurView) {
        BlurViewNative = mod.BlurView;
        blurAvailable = true;
    }
} catch {
    blurAvailable = false;
}

export const SafeBlurView: React.FC<SafeBlurViewProps> = ({
    intensity = 20,
    tint = 'default',
    style,
    children,
}) => {
    if (blurAvailable && BlurViewNative && Platform.OS !== 'web') {
        return (
            <BlurViewNative intensity={intensity} tint={tint} style={style}>
                {children}
            </BlurViewNative>
        );
    }

    // Fallback: semi-transparent overlay — glass look without native blur
    return (
        <View style={[styles.fallback, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    fallback: {
        overflow: 'hidden',
    },
});

export default SafeBlurView;
