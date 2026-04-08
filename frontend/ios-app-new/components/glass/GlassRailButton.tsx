/**
 * GlassRailButton — compact icon-only glass button for vertical nav rails.
 * Has spring bounce, haptic feedback, metallic shimmer, and liquid glass style.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeBlurView as BlurView } from '../SafeBlurView';
import ShimmerOverlay from './ShimmerOverlay';
import { useTheme } from '../../lib/theme';

interface GlassRailButtonProps {
    icon: React.ReactNode;
    isActive?: boolean;
    isLoading?: boolean;
    onPress: () => void;
    /** Optional tooltip / a11y label */
    label?: string;
}

const GlassRailButton = ({
    icon,
    isActive = false,
    isLoading = false,
    onPress,
    label,
}: GlassRailButtonProps) => {
    const { colors, mode } = useTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const [size, setSize] = useState(48);

    const handlePressIn = useCallback(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 0.92,
                useNativeDriver: true,
                tension: 400,
                friction: 10,
            }),
            Animated.timing(glowAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handlePressOut = useCallback(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 300,
                friction: 10,
            }),
            Animated.timing(glowAnim, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handlePress = useCallback(() => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        // Spring bounce on tap
        Animated.sequence([
            Animated.spring(scaleAnim, {
                toValue: 1.12,
                useNativeDriver: true,
                tension: 500,
                friction: 7,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 300,
                friction: 10,
            }),
        ]).start();
        onPress();
    }, [onPress]);

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.25],
    });

    const content = (
        <Animated.View
            onLayout={(e) => setSize(e.nativeEvent.layout.width)}
            style={[
                styles.btn,
                {
                    borderColor: isActive ? colors.glassBorder : 'rgba(255,255,255,0.06)',
                    transform: [{ scale: scaleAnim }],
                },
            ]}
            accessibilityLabel={label}
            accessibilityRole="button"
        >
            {/* Active indicator — left edge glow bar */}
            {isActive && (
                <View style={[styles.activeBar, { backgroundColor: colors.primary }]} />
            )}

            {/* Press glow */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    styles.glowOverlay,
                    { backgroundColor: colors.primary, opacity: glowOpacity },
                ]}
            />

            {/* Metallic shimmer when loading */}
            <ShimmerOverlay width={size} height={size} isActive={isLoading} loop />

            {/* Active shimmer sweep on mount */}
            {isActive && (
                <ShimmerOverlay width={size} height={size} isActive loop />
            )}

            {/* Icon */}
            <View style={styles.iconWrap}>{icon}</View>
        </Animated.View>
    );

    const inner = Platform.OS !== 'web' ? (
        <BlurView
            intensity={isActive ? 30 : 20}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={[
                styles.blur,
                {
                    backgroundColor: isActive
                        ? colors.glassActiveBg
                        : colors.glassBg,
                },
            ]}
        >
            {content}
        </BlurView>
    ) : (
        <View
            style={[
                styles.blur,
                {
                    backgroundColor: isActive ? colors.glassActiveBg : colors.glassBg,
                    // @ts-ignore
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                },
            ]}
        >
            {content}
        </View>
    );

    return (
        <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.pressable}
        >
            {inner}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    pressable: {
        width: 48,
        height: 48,
    },
    blur: {
        width: 48,
        height: 48,
        borderRadius: 14,
        overflow: 'hidden',
    },
    btn: {
        width: 48,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    activeBar: {
        position: 'absolute',
        left: 0,
        top: 10,
        bottom: 10,
        width: 3,
        borderRadius: 2,
    },
    glowOverlay: {
        borderRadius: 14,
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default GlassRailButton;
