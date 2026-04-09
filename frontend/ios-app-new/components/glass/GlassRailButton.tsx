/**
 * GlassRailButton — liquid-metal nav button with vault-door open animation.
 *
 * On tap:
 *   1. Front face (icon) rotates out on Y-axis — door swings open
 *   2. Button expands in width
 *   3. Inner face reveals the tab name with metallic glow
 *   4. Door swings shut, width contracts back
 *   5. onPress fires as door fully closes
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
    label: string;
    isActive?: boolean;
    onPress: () => void;
}

const CLOSED_WIDTH = 48;
const OPEN_WIDTH = 116;
const HEIGHT = 48;

const GlassRailButton = ({
    icon,
    label,
    isActive = false,
    onPress,
}: GlassRailButtonProps) => {
    const { colors, mode } = useTheme();
    const [shimmerW, setShimmerW] = useState(CLOSED_WIDTH);

    // Door rotation — front: 0°→90°, back: -90°→0°
    const doorAnim = useRef(new Animated.Value(0)).current;
    // Width expansion
    const widthAnim = useRef(new Animated.Value(CLOSED_WIDTH)).current;
    // Inner label opacity
    const labelOpacity = useRef(new Animated.Value(0)).current;
    // Overall glow on press
    const glowAnim = useRef(new Animated.Value(0)).current;

    const frontRotateY = doorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '90deg'],
    });

    const backRotateY = doorAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['-90deg', '0deg'],
    });

    const handlePressIn = useCallback(() => {
        Animated.timing(glowAnim, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
        }).start();
    }, []);

    const handlePressOut = useCallback(() => {
        Animated.timing(glowAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, []);

    const handlePress = useCallback(() => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        // ── Phase 1: swing door open (200ms) + expand width ──────────────
        Animated.timing(doorAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();

        Animated.spring(widthAnim, {
            toValue: OPEN_WIDTH,
            tension: 220,
            friction: 18,
            useNativeDriver: false,
        }).start();

        // ── Phase 2: fade in label once door is open ──────────────────────
        setTimeout(() => {
            Animated.timing(labelOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
            }).start();

            // Fire navigation as inner face becomes visible
            onPress();
        }, 200);

        // ── Phase 3: hold open, then close ───────────────────────────────
        setTimeout(() => {
            // Fade out label
            Animated.timing(labelOpacity, {
                toValue: 0,
                duration: 100,
                useNativeDriver: true,
            }).start();

            setTimeout(() => {
                // Swing door shut
                Animated.timing(doorAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start();

                // Contract width
                Animated.spring(widthAnim, {
                    toValue: CLOSED_WIDTH,
                    tension: 220,
                    friction: 18,
                    useNativeDriver: false,
                }).start();
            }, 100);
        }, 820);
    }, [onPress, doorAnim, widthAnim, labelOpacity]);

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.35],
    });

    const metallicGradientActive = 'rgba(59,130,246,0.45)';
    const metallicGradientIdle = 'rgba(255,255,255,0.10)';

    return (
        <Animated.View
            style={[styles.pressable, { width: widthAnim }]}
            onLayout={(e) => setShimmerW(e.nativeEvent.layout.width)}
        >
            <Pressable
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.fill}
            >
                <BlurView
                    intensity={isActive ? 35 : 22}
                    tint={mode === 'dark' ? 'dark' : 'light'}
                    style={styles.fill}
                >
                    {/* Base metallic surface */}
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            styles.surface,
                            {
                                backgroundColor: isActive
                                    ? metallicGradientActive
                                    : metallicGradientIdle,
                                borderColor: isActive
                                    ? 'rgba(100,168,255,0.55)'
                                    : 'rgba(255,255,255,0.28)',
                            },
                        ]}
                    />

                    {/* Top-edge metallic highlight */}
                    <View style={styles.topHighlight} />
                    {/* Bottom reflection */}
                    <View style={styles.bottomReflection} />

                    {/* Active left bar */}
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

                    {/* Metallic shimmer sweep */}
                    <ShimmerOverlay
                        width={shimmerW}
                        height={HEIGHT}
                        isActive
                        loop
                    />

                    {/* ── FRONT FACE: icon ────────────────────────────────── */}
                    <Animated.View
                        style={[
                            styles.face,
                            {
                                transform: [
                                    { perspective: 600 },
                                    { rotateY: frontRotateY },
                                ],
                            },
                        ]}
                        pointerEvents="none"
                    >
                        {icon}
                    </Animated.View>

                    {/* ── INNER FACE: label ───────────────────────────────── */}
                    <Animated.View
                        style={[
                            styles.face,
                            {
                                transform: [
                                    { perspective: 600 },
                                    { rotateY: backRotateY },
                                ],
                            },
                        ]}
                        pointerEvents="none"
                    >
                        {/* Inner glow background */}
                        <View style={[styles.innerGlow, { shadowColor: colors.primary }]} />

                        <Animated.Text
                            style={[
                                styles.labelText,
                                {
                                    color: colors.glassActiveText,
                                    opacity: labelOpacity,
                                },
                            ]}
                            numberOfLines={1}
                        >
                            {label}
                        </Animated.Text>
                    </Animated.View>
                </BlurView>
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    pressable: {
        height: HEIGHT,
        minWidth: CLOSED_WIDTH,
        borderRadius: 14,
        overflow: 'hidden',
    },
    fill: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
    },
    surface: {
        borderRadius: 14,
        borderWidth: 1,
    },
    face: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topHighlight: {
        position: 'absolute',
        top: 0,
        left: 6,
        right: 6,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.55)',
        borderRadius: 1,
    },
    bottomReflection: {
        position: 'absolute',
        bottom: 0,
        left: 8,
        right: 8,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 1,
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
    innerGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(59,130,246,0.18)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 16,
        elevation: 8,
    },
    labelText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        textShadowColor: 'rgba(59,130,246,0.9)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
});

export default GlassRailButton;
