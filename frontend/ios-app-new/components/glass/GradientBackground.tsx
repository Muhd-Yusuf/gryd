import React from 'react';
import { Platform, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/theme';

interface GradientBackgroundProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

const GradientBackground = ({ children, style }: GradientBackgroundProps) => {
    const { colors, mode } = useTheme();

    const gradients: [string, string, ...string[]] = mode === 'dark'
        ? ['#000000', '#03030A', '#000000']
        : ['#EEF0F8', '#F5F7FF', '#EDF1FA'];

    return (
        <LinearGradient
            colors={gradients}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fill, style]}
        >
            {children}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    fill: {
        flex: 1,
        ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
    },
});

export default GradientBackground;
