import React, { useMemo } from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
    ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../lib/theme';

type UserAvatarProps = {
    uri?: string | null;
    name?: string | null;
    size?: number;
    style?: StyleProp<ViewStyle>;
    imageStyle?: StyleProp<any>;
    textStyle?: StyleProp<TextStyle>;
    accessibilityLabel?: string;
};

const getInitials = (value?: string | null) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '?';
    const withoutDomain = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
    const parts = withoutDomain.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const resolveNumber = (value: unknown) => (typeof value === 'number' ? value : undefined);

const UserAvatar = ({
    uri,
    name,
    size = 40,
    style,
    imageStyle,
    textStyle,
    accessibilityLabel,
}: UserAvatarProps) => {
    const { colors } = useTheme();
    const initials = useMemo(() => getInitials(name), [name]);
    const flattened = StyleSheet.flatten(style) || {};
    const width = resolveNumber(flattened.width) || size;
    const height = resolveNumber(flattened.height) || size;
    const radius = resolveNumber(flattened.borderRadius) || Math.min(width, height) / 2;
    const fontSize = Math.max(12, Math.floor(Math.min(width, height) * 0.4));

    return (
        <View
            accessibilityLabel={accessibilityLabel}
            style={[
                styles.container,
                {
                    width,
                    height,
                    borderRadius: radius,
                    backgroundColor: colors.surfaceMuted,
                },
                style,
            ]}
        >
            {uri ? (
                <Image
                    source={{ uri }}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: radius }, imageStyle]}
                    cachePolicy="memory-disk"
                />
            ) : (
                <Text style={[styles.initials, { color: colors.textMuted, fontSize }, textStyle]}>
                    {initials}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    initials: {
        fontWeight: '600',
        textTransform: 'uppercase',
    },
});

export default UserAvatar;
