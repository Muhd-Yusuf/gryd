import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/theme';

interface GradientBackgroundProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

const GradientBackground = ({ children, style }: GradientBackgroundProps) => {
    const { colors, mode } = useTheme();

    const gradients: [string, string, ...string[]] = mode === 'dark'
        ? ['#0A0A1A', '#0D0D2E', '#0A0F1E']
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
    },
});

export default GradientBackground;
