/**
 * GlassRail — centralized vertical icon rail for all dashboard screens.
 * Used by: Server (index), Messages (DirectMessagesScreen), Leaderboard (top-contributors).
 * Ensures identical appearance everywhere — one component, zero inconsistency.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Sun, Moon, X } from 'lucide-react-native';
import { SafeBlurView as BlurView } from '../SafeBlurView';
import GlassRailButton from './GlassRailButton';
import { useTheme } from '../../lib/theme';

export interface GlassRailItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    activeIcon?: React.ReactNode;
    onPress: () => void;
    isActive?: boolean;
}

export interface GlassRailServerLogo {
    uri?: string | null;
    name?: string | null;
    onPress: () => void;
}

interface GlassRailProps {
    items: GlassRailItem[];
    serverLogo?: GlassRailServerLogo;
    onToggleTheme: () => void;
    onLogout?: () => void;
}

const GlassRail: React.FC<GlassRailProps> = ({
    items,
    serverLogo,
    onToggleTheme,
    onLogout,
}) => {
    const { colors, mode } = useTheme();

    const railContent = (
        <View style={styles.inner}>
            {/* Server logo */}
            {serverLogo && (
                <TouchableOpacity style={styles.serverLogo} onPress={serverLogo.onPress} activeOpacity={0.8}>
                    <LinearGradient
                        colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />
                    {serverLogo.uri ? (
                        <Image source={{ uri: serverLogo.uri }} style={styles.serverLogoImage} cachePolicy="memory-disk" />
                    ) : (
                        <Text style={[styles.serverLogoText, { color: colors.text }]}>
                            {(serverLogo.name || 'SV').substring(0, 4).toUpperCase()}
                        </Text>
                    )}
                </TouchableOpacity>
            )}

            {/* Nav items */}
            {items.map((item) => (
                <GlassRailButton
                    key={item.id}
                    icon={item.isActive ? (item.activeIcon ?? item.icon) : item.icon}
                    isActive={item.isActive}
                    onPress={item.onPress}
                    label={item.label}
                />
            ))}

            {/* Spacer */}
            <View style={{ flex: 1 }} />

            {/* Theme toggle */}
            <GlassRailButton
                icon={mode === 'dark'
                    ? <Sun size={20} color={colors.textMuted} />
                    : <Moon size={20} color={colors.textMuted} />
                }
                isActive={false}
                onPress={onToggleTheme}
                label="theme"
            />

            {/* Logout / close */}
            {onLogout && (
                <GlassRailButton
                    icon={<X size={18} color="#FFFFFF" />}
                    isActive={false}
                    onPress={onLogout}
                    label="logout"
                />
            )}
        </View>
    );

    return (
        <View style={[styles.rail, { borderRightColor: colors.glassBorder }]}>
            {Platform.OS !== 'web' ? (
                <BlurView
                    intensity={colors.glassBlurIntensity}
                    tint={mode === 'dark' ? 'dark' : 'light'}
                    style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassNavBg }]}
                />
            ) : (
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: colors.glassNavBg,
                            // @ts-ignore
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                        },
                    ]}
                />
            )}
            {railContent}
        </View>
    );
};

const styles = StyleSheet.create({
    rail: {
        width: 72,
        alignSelf: 'stretch',
        borderRightWidth: 1,
        overflow: 'hidden',
    },
    inner: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 12,
        gap: 12,
    },
    serverLogo: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 4,
    },
    serverLogoImage: {
        width: 48,
        height: 48,
        borderRadius: 12,
    },
    serverLogoText: {
        fontSize: 10,
        fontWeight: '700',
    },
});

export default GlassRail;
