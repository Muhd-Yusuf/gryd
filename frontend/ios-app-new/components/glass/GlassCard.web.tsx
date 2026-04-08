import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme';

interface GlassCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    intensity?: number;
    variant?: 'card' | 'nav' | 'modal';
}

const GlassCard = ({ children, style, variant = 'card' }: GlassCardProps) => {
    const { colors, mode } = useTheme();

    const bgColor = variant === 'nav'
        ? colors.glassNavBg
        : variant === 'modal'
            ? (mode === 'dark' ? 'rgba(20,20,45,0.75)' : 'rgba(255,255,255,0.82)')
            : colors.glassBg;

    const borderColor = variant === 'nav' ? colors.glassNavBorder : colors.glassBorder;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: bgColor,
                    borderColor,
                    shadowColor: colors.glassShadow,
                    // @ts-ignore — react-native-web passes these to CSS
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                },
                style,
            ]}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 16,
        overflow: 'hidden',
    },
});

export default GlassCard;
