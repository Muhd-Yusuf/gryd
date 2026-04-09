import React, { useRef, useState } from 'react';
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { useTheme } from '../../lib/theme';

interface GlassInputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    error?: string;
    hint?: string;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
    onIconRightPress?: () => void;
    containerStyle?: ViewStyle;
    inputStyle?: ViewStyle;
}

const GlassInput = ({
    label,
    error,
    hint,
    icon,
    iconRight,
    onIconRightPress,
    containerStyle,
    inputStyle,
    onFocus,
    onBlur,
    ...props
}: GlassInputProps) => {
    const { colors, mode } = useTheme();
    const focusAnim = useRef(new Animated.Value(0)).current;
    const [focused, setFocused] = useState(false);

    const handleFocus = (e: any) => {
        setFocused(true);
        Animated.timing(focusAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
        onFocus?.(e);
    };

    const handleBlur = (e: any) => {
        setFocused(false);
        Animated.timing(focusAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
        onBlur?.(e);
    };

    const borderColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            error ? 'rgba(239,68,68,0.55)' : colors.glassBorder,
            error ? 'rgba(239,68,68,0.85)' : 'rgba(100,168,255,0.75)',
        ],
    });

    const bgColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
            mode === 'dark' ? 'rgba(59,130,246,0.10)' : 'rgba(239,246,255,0.90)',
        ],
    });

    return (
        <View style={[styles.wrapper, containerStyle]}>
            {label && (
                <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
            )}
            <Animated.View
                style={[
                    styles.inputContainer,
                    {
                        backgroundColor: bgColor,
                        borderColor,
                    },
                ]}
            >
                {/* Top metallic highlight */}
                <View style={[styles.topHighlight, { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.90)' }]} />

                {icon && <View style={styles.iconLeft}>{icon}</View>}
                <TextInput
                    {...props}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholderTextColor={colors.textSubtle}
                    style={[
                        styles.input,
                        {
                            color: colors.text,
                            flex: 1,
                        },
                        inputStyle,
                    ]}
                />
                {iconRight && (
                    onIconRightPress ? (
                        <TouchableOpacity onPress={onIconRightPress} style={styles.iconRight}>
                            {iconRight}
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.iconRight}>{iconRight}</View>
                    )
                )}
            </Animated.View>
            {error ? (
                <Text style={styles.errorText}>{error}</Text>
            ) : hint ? (
                <Text style={[styles.hint, { color: colors.textSubtle }]}>{hint}</Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        gap: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        minHeight: 50,
        overflow: 'hidden',
        position: 'relative',
    },
    topHighlight: {
        position: 'absolute',
        top: 0,
        left: 10,
        right: 10,
        height: 1,
        borderRadius: 1,
    },
    input: {
        fontSize: 15,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        outlineStyle: 'none',
    } as any,
    iconLeft: {
        marginRight: 10,
    },
    iconRight: {
        marginLeft: 10,
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '500',
    },
    hint: {
        fontSize: 12,
    },
});

export default GlassInput;
