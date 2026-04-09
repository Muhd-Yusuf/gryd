import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

interface GlassBadgeProps {
    label: string;
    variant?: BadgeVariant;
    dot?: boolean;
    style?: ViewStyle;
}

const GlassBadge = ({ label, variant = 'default', dot = false, style }: GlassBadgeProps) => {
    const { colors, mode } = useTheme();

    const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
        default: { bg: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', color: colors.text },
        success: { bg: mode === 'dark' ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)', color: mode === 'dark' ? '#86EFAC' : '#16A34A' },
        warning: { bg: mode === 'dark' ? 'rgba(250,204,21,0.15)' : 'rgba(250,204,21,0.12)', color: mode === 'dark' ? '#FCD34D' : '#D97706' },
        danger: { bg: mode === 'dark' ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.12)', color: mode === 'dark' ? '#FCA5A5' : '#DC2626' },
        info: { bg: mode === 'dark' ? 'rgba(59,130,246,0.20)' : 'rgba(59,130,246,0.12)', color: mode === 'dark' ? '#93C5FD' : '#2563EB' },
        muted: { bg: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: colors.textSubtle },
    };

    const { bg, color } = variantStyles[variant];

    return (
        <View style={[styles.badge, { backgroundColor: bg }, style]}>
            {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
            <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});

export default GlassBadge;
