import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ShimmerOverlay from './ShimmerOverlay';
import { useTheme } from '../../lib/theme';

interface GlassNavButtonProps {
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    isLoading?: boolean;
    onPress: () => void;
    style?: ViewStyle;
    hasSubmenu?: boolean;
    submenuOpen?: boolean;
    badge?: string;
}

const GlassNavButton = ({
    icon,
    label,
    isActive = false,
    isLoading = false,
    onPress,
    style,
    badge,
}: GlassNavButtonProps) => {
    const { colors } = useTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const [btnWidth, setBtnWidth] = useState(240);

    const handlePressIn = useCallback(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 0.96,
                useNativeDriver: true,
                tension: 300,
                friction: 10,
            }),
            Animated.timing(glowAnim, {
                toValue: 1,
                duration: 120,
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
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handlePress = useCallback(() => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        // Spring bounce on tap
        Animated.sequence([
            Animated.spring(scaleAnim, {
                toValue: 1.06,
                useNativeDriver: true,
                tension: 400,
                friction: 8,
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

    const activeBg = colors.glassActiveBg;
    const inactiveBg = 'rgba(255,255,255,0.06)';
    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.20] });

    return (
        <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={({ pressed }) => [style]}
        >
            <Animated.View
                onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
                style={[
                    styles.btn,
                    {
                        backgroundColor: isActive ? activeBg : inactiveBg,
                        borderColor: isActive ? 'rgba(100,168,255,0.50)' : 'rgba(255,255,255,0.10)',
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                {/* Metallic gradient background */}
                {isActive && (
                    <LinearGradient
                        colors={['rgba(99,155,255,0.22)', 'rgba(59,130,246,0.15)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                )}

                {/* Top edge metallic highlight */}
                <View style={styles.topHighlight} />

                {/* Glow overlay on press */}
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        styles.glowOverlay,
                        { backgroundColor: colors.primary, opacity: glowOpacity },
                    ]}
                />

                {/* Shimmer — always active for liquid metal feel */}
                <ShimmerOverlay
                    width={btnWidth}
                    height={44}
                    isActive={true}
                    loop={true}
                />

                {/* Icon + Label */}
                <View style={styles.content}>
                    <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                        {icon}
                    </View>
                    <Text
                        style={[
                            styles.label,
                            {
                                color: isActive ? colors.glassActiveText : colors.textMuted,
                                fontWeight: isActive ? '700' : '500',
                            },
                        ]}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                </View>

                {/* Badge */}
                {badge && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                )}
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 4,
        overflow: 'hidden',
        minHeight: 44,
    },
    glowOverlay: {
        borderRadius: 14,
    },
    topHighlight: {
        position: 'absolute',
        top: 0,
        left: 10,
        right: 10,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.40)',
        borderRadius: 1,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapActive: {
        // subtle scale handled by parent spring
    },
    label: {
        fontSize: 14,
        flex: 1,
    },
    badge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default GlassNavButton;
