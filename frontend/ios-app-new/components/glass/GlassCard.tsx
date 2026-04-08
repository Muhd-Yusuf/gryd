import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../lib/theme';

interface GlassCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    intensity?: number;
    /** Pass true for nav-style glass (slightly different bg) */
    variant?: 'card' | 'nav' | 'modal';
}

const GlassCard = ({ children, style, intensity, variant = 'card' }: GlassCardProps) => {
    const { colors, mode } = useTheme();

    const blurIntensity = intensity ?? colors.glassBlurIntensity;

    const bgColor = variant === 'nav'
        ? colors.glassNavBg
        : variant === 'modal'
            ? (mode === 'dark' ? 'rgba(20,20,45,0.75)' : 'rgba(255,255,255,0.82)')
            : colors.glassBg;

    const borderColor = variant === 'nav' ? colors.glassNavBorder : colors.glassBorder;

    return (
        <BlurView
            intensity={blurIntensity}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={[styles.blur, style]}
        >
            <View
                style={[
                    styles.inner,
                    {
                        backgroundColor: bgColor,
                        borderColor,
                        shadowColor: colors.glassShadow,
                    },
                    style,
                ]}
            >
                {children}
            </View>
        </BlurView>
    );
};

const styles = StyleSheet.create({
    blur: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    inner: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 16,
        elevation: 8,
    },
});

export default GlassCard;
