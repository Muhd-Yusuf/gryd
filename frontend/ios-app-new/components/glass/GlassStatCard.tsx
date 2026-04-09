import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeBlurView as BlurView } from '../SafeBlurView';
import { useTheme } from '../../lib/theme';

interface GlassStatCardProps {
    label: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    /** Accent color for the icon bg and value */
    accent?: string;
    style?: ViewStyle;
    trend?: { value: string; positive: boolean };
}

const GlassStatCard = ({
    label,
    value,
    subtitle,
    icon,
    accent = 'rgba(59,130,246,0.85)',
    style,
    trend,
}: GlassStatCardProps) => {
    const { colors, mode } = useTheme();

    return (
        <BlurView
            intensity={colors.glassBlurIntensity}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={[styles.blur, style]}
        >
            <View style={[styles.inner, { borderColor: colors.glassBorder }]}>
                {/* Background */}
                <LinearGradient
                    colors={mode === 'dark'
                        ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
                        : ['rgba(255,255,255,0.90)', 'rgba(255,255,255,0.70)']
                    }
                    style={StyleSheet.absoluteFill}
                />
                {/* Top highlight */}
                <View style={styles.topHighlight} />

                <View style={styles.row}>
                    {icon && (
                        <View style={[styles.iconWrap, { backgroundColor: accent + '25' }]}>
                            {icon}
                        </View>
                    )}
                    <View style={styles.textBlock}>
                        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
                        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
                        {subtitle && <Text style={[styles.subtitle, { color: colors.textSubtle }]}>{subtitle}</Text>}
                        {trend && (
                            <View style={styles.trendRow}>
                                <View style={[styles.trendBadge, { backgroundColor: trend.positive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                                    <Text style={[styles.trendText, { color: trend.positive ? '#22C55E' : '#EF4444' }]}>
                                        {trend.positive ? '+' : ''}{trend.value}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
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
        borderWidth: 1,
        borderRadius: 16,
        padding: 18,
        overflow: 'hidden',
    },
    topHighlight: {
        position: 'absolute',
        top: 0,
        left: 12,
        right: 12,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.45)',
        borderRadius: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textBlock: {
        flex: 1,
        gap: 3,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    value: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 12,
    },
    trendRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    trendBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    trendText: {
        fontSize: 12,
        fontWeight: '700',
    },
});

export default GlassStatCard;
