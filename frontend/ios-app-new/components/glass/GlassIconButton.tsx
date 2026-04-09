/**
 * GlassIconButton — liquid metallic icon button for nav/action icons.
 * Use this anywhere a TouchableOpacity wraps an icon that navigates or
 * triggers an action (back buttons, header actions, FABs, rail icons, etc.)
 */
import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ShimmerOverlay from './ShimmerOverlay';
import { useTheme } from '../../lib/theme';

type IconButtonVariant = 'default' | 'active' | 'danger' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface GlassIconButtonProps {
    icon: React.ReactNode;
    onPress: () => void;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    style?: ViewStyle;
    disabled?: boolean;
    /** Show shimmer sweep */
    shimmer?: boolean;
    accessibilityLabel?: string;
}

const SIZE_MAP: Record<IconButtonSize, number> = { sm: 32, md: 40, lg: 48 };
const RADIUS_MAP: Record<IconButtonSize, number> = { sm: 10, md: 12, lg: 14 };

const GlassIconButton = ({
    icon,
    onPress,
    variant = 'default',
    size = 'md',
    style,
    disabled = false,
    shimmer = false,
    accessibilityLabel,
}: GlassIconButtonProps) => {
    const { colors, mode } = useTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const dim = SIZE_MAP[size];
    const radius = RADIUS_MAP[size];

    const handlePressIn = useCallback(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 0.90, useNativeDriver: true, tension: 300, friction: 10 }),
            Animated.timing(glowAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
    }, []);

    const handlePressOut = useCallback(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
            Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
    }, []);

    const handlePress = useCallback(() => {
        if (disabled) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true, tension: 400, friction: 8 }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
        ]).start();
        onPress();
    }, [disabled, onPress]);

    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.30] });

    // Metallic gradients per variant
    const gradients: Record<IconButtonVariant, [string, string, ...string[]]> = {
        default: mode === 'dark'
            ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
            : ['rgba(255,255,255,0.95)', 'rgba(249,250,251,0.80)'],
        active: ['rgba(99,155,255,0.35)', 'rgba(59,130,246,0.25)', 'rgba(37,99,235,0.20)'],
        danger: ['rgba(239,68,68,0.28)', 'rgba(220,38,38,0.18)'],
        ghost: ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)'],
    };

    const borderColors: Record<IconButtonVariant, string> = {
        default: mode === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.10)',
        active: 'rgba(100,168,255,0.60)',
        danger: 'rgba(239,68,68,0.45)',
        ghost: 'rgba(255,255,255,0.08)',
    };

    return (
        <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
            style={style}
        >
            <Animated.View
                style={[
                    styles.btn,
                    {
                        width: dim,
                        height: dim,
                        borderRadius: radius,
                        borderColor: borderColors[variant],
                        opacity: disabled ? 0.4 : 1,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                {/* Metallic gradient */}
                <LinearGradient
                    colors={gradients[variant]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                {/* Top metallic gleam */}
                <View style={[styles.topHighlight, { borderRadius: radius }]} />

                {/* Glow overlay */}
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: colors.primary, opacity: glowOpacity, borderRadius: radius },
                    ]}
                />

                {/* Shimmer sweep */}
                {shimmer && (
                    <ShimmerOverlay width={dim} height={dim} isActive loop />
                )}

                {/* Icon */}
                <View style={styles.iconWrap}>{icon}</View>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    btn: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    topHighlight: {
        position: 'absolute',
        top: 0,
        left: 4,
        right: 4,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default GlassIconButton;
