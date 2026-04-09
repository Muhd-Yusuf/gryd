import React from 'react';
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { SafeBlurView as BlurView } from '../SafeBlurView';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';

interface GlassHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    rightSlot?: React.ReactNode;
    style?: ViewStyle;
}

const GlassHeader = ({ title, subtitle, onBack, rightSlot, style }: GlassHeaderProps) => {
    const { colors, mode } = useTheme();

    const HeaderWrapper = ({ children }: { children: React.ReactNode }) => {
        if (Platform.OS === 'web') {
            return (
                <View style={[styles.container, {
                    backgroundColor: colors.glassNavBg,
                    borderBottomColor: colors.glassBorder,
                    // @ts-ignore
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                }, style]}>
                    {children}
                </View>
            );
        }
        return (
            <BlurView
                intensity={colors.glassBlurIntensity}
                tint={mode === 'dark' ? 'dark' : 'light'}
                style={[styles.container, { borderBottomColor: colors.glassBorder }, style]}
            >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassNavBg }]} />
                {children}
            </BlurView>
        );
    };

    return (
        <HeaderWrapper>
            {/* Bottom edge highlight */}
            <View style={[styles.bottomHighlight, { backgroundColor: colors.glassBorder }]} />

            <View style={styles.inner}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
                        <ArrowLeft size={20} color={colors.text} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.backPlaceholder} />
                )}

                <View style={styles.titleBlock}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                    {subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>}
                </View>

                <View style={styles.right}>
                    {rightSlot ?? <View style={styles.backPlaceholder} />}
                </View>
            </View>
        </HeaderWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        borderBottomWidth: 1,
        overflow: 'hidden',
    },
    bottomHighlight: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backPlaceholder: {
        width: 36,
    },
    titleBlock: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    subtitle: {
        fontSize: 12,
        marginTop: 1,
    },
    right: {
        width: 36,
        alignItems: 'flex-end',
    },
});

export default GlassHeader;
