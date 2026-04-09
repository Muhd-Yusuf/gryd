import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewStyle,
    TextStyle,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ShimmerOverlay from './ShimmerOverlay';
import { useTheme } from '../../lib/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
    fullWidth?: boolean;
}

const GlassButton = ({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    iconRight,
    style,
    textStyle,
    fullWidth = false,
}: GlassButtonProps) => {
    const { colors, mode } = useTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const [btnWidth, setBtnWidth] = useState(200);

    const handlePressIn = useCallback(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, tension: 300, friction: 10 }),
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
        if (disabled || loading) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 1.04, useNativeDriver: true, tension: 400, friction: 8 }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
        ]).start();
        onPress();
    }, [disabled, loading, onPress]);

    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.30] });

    // Gradient colors per variant
    const gradients: Record<ButtonVariant, [string, string, ...string[]]> = {
        primary: mode === 'dark'
            ? ['rgba(120,175,255,0.45)', 'rgba(59,130,246,0.35)', 'rgba(37,99,235,0.28)', 'rgba(59,130,246,0.20)']
            : ['rgba(96,165,250,1.0)', 'rgba(59,130,246,0.95)', 'rgba(37,99,235,0.90)'],
        secondary: mode === 'dark'
            ? ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.04)']
            : ['rgba(255,255,255,0.95)', 'rgba(249,250,251,0.85)', 'rgba(243,244,246,0.75)'],
        danger: ['rgba(252,100,100,0.40)', 'rgba(239,68,68,0.30)', 'rgba(220,38,38,0.22)', 'rgba(185,28,28,0.18)'],
        ghost: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)'],
    };

    const borderColors: Record<ButtonVariant, string> = {
        primary: 'rgba(100,168,255,0.55)',
        secondary: mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)',
        danger: 'rgba(239,68,68,0.45)',
        ghost: 'rgba(255,255,255,0.10)',
    };

    const textColors: Record<ButtonVariant, string> = {
        primary: '#FFFFFF',
        secondary: colors.text,
        danger: mode === 'dark' ? '#FCA5A5' : '#DC2626',
        ghost: colors.textMuted,
    };

    const paddingMap: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number }> = {
        sm: { paddingVertical: 8, paddingHorizontal: 14 },
        md: { paddingVertical: 13, paddingHorizontal: 20 },
        lg: { paddingVertical: 16, paddingHorizontal: 28 },
    };

    const fontSizeMap: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 16 };

    const isDisabled = disabled || loading;

    return (
        <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isDisabled}
            style={[fullWidth && { width: '100%' }, style]}
        >
            <Animated.View
                onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
                style={[
                    styles.btn,
                    paddingMap[size],
                    {
                        borderColor: borderColors[variant],
                        opacity: isDisabled ? 0.5 : 1,
                        transform: [{ scale: scaleAnim }],
                    },
                    fullWidth && styles.fullWidth,
                ]}
            >
                {/* Metallic gradient background */}
                <LinearGradient
                    colors={gradients[variant]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                {/* Top metallic highlight */}
                <View style={styles.topHighlight} />

                {/* Glow overlay on press */}
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        styles.glowOverlay,
                        { backgroundColor: colors.primary, opacity: glowOpacity },
                    ]}
                />

                {/* Shimmer — always on for metallic liquid feel */}
                <ShimmerOverlay width={btnWidth} height={size === 'sm' ? 36 : size === 'lg' ? 56 : 46} isActive={variant === 'primary' || loading} loop />

                {/* Content */}
                <View style={styles.content}>
                    {icon && <View style={styles.iconLeft}>{icon}</View>}
                    {loading ? (
                        <ActivityIndicator size="small" color={textColors[variant]} />
                    ) : (
                        <Text
                            style={[
                                styles.label,
                                {
                                    fontSize: fontSizeMap[size],
                                    color: textColors[variant],
                                    fontWeight: variant === 'primary' ? '700' : '600',
                                },
                                textStyle,
                            ]}
                        >
                            {label}
                        </Text>
                    )}
                    {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
                </View>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    btn: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    fullWidth: {
        width: '100%',
    },
    glowOverlay: {
        borderRadius: 14,
    },
    topHighlight: {
        position: 'absolute',
        top: 0,
        left: 8,
        right: 8,
        height: 1.5,
        backgroundColor: 'rgba(255,255,255,0.65)',
        borderRadius: 1,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    label: {
        letterSpacing: 0.2,
    },
    iconLeft: {
        marginRight: 2,
    },
    iconRight: {
        marginLeft: 2,
    },
});

export default GlassButton;
