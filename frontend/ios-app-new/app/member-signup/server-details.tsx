import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';

export default function ServerDetailsScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);
    const params = useLocalSearchParams<{
        serverCode: string;
        subgridId: string;
        subgridName: string;
        clientName: string;
        description: string;
        logoUrl: string;
        coverImageUrl: string;
        memberCount: string;
        onlineCount: string;
    }>();

    const [loading, setLoading] = useState(false);

    // Parse member counts from string params
    const memberCount = parseInt(params.memberCount || '0', 10);
    const onlineCount = parseInt(params.onlineCount || '0', 10);

    // Get initials for avatar
    const getInitials = (name: string) => {
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handleSetupProfile = () => {
        router.push({
            pathname: '/member-signup/account-setup',
            params: {
                serverCode: params.serverCode,
                subgridId: params.subgridId,
                subgridName: params.subgridName,
            },
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with theme toggle */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                    {mode === 'dark' ? (
                        <Sun color={colors.text} size={20} />
                    ) : (
                        <Moon color={colors.text} size={20} />
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.welcomeTitle}>
                        Welcome to {params.subgridName || 'Community'}
                    </Text>

                    {/* Server Card */}
                    <View style={styles.serverCard}>
                        {/* Cover Image / Pink Header */}
                        <View style={styles.serverHeader}>
                            {params.coverImageUrl ? (
                                <Image
                                    source={{ uri: params.coverImageUrl }}
                                    style={styles.coverImage}
                                />
                            ) : null}
                        </View>

                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                            {params.logoUrl ? (
                                <Image
                                    source={{ uri: params.logoUrl }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {getInitials(params.subgridName || 'CU')}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Server Info */}
                        <View style={styles.serverInfo}>
                            <Text style={styles.serverName}>
                                {params.subgridName || 'Community'}
                            </Text>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <View style={styles.onlineDot} />
                                    <Text style={styles.statText}>
                                        {onlineCount} Online
                                    </Text>
                                </View>
                                <View style={styles.statItem}>
                                    <View style={styles.memberDot} />
                                    <Text style={styles.statText}>
                                        {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
                                    </Text>
                                </View>
                            </View>
                            {params.description ? (
                                <Text style={styles.serverDescription} numberOfLines={2}>
                                    {params.description}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleSetupProfile}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primaryText} />
                        ) : (
                            <Text style={styles.buttonText}>Setup Profile</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
        },
        logoContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        logoText: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        themeToggle: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: colors.surface,
        },
        content: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        card: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 32,
        },
        welcomeTitle: {
            fontSize: 22,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 24,
        },
        serverCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            marginBottom: 24,
        },
        serverHeader: {
            height: 100,
            backgroundColor: '#EC4899',
        },
        coverImage: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
        },
        avatarContainer: {
            position: 'absolute',
            top: 70,
            left: 16,
            zIndex: 1,
        },
        avatar: {
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 3,
            borderColor: colors.surface,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        avatarImage: {
            width: 56,
            height: 56,
            borderRadius: 12,
            borderWidth: 3,
            borderColor: colors.surface,
        },
        avatarText: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        serverInfo: {
            padding: 16,
            paddingTop: 40,
        },
        serverName: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        statsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginBottom: 8,
        },
        statItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        onlineDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#22C55E',
        },
        memberDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.textMuted,
        },
        statText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        serverDescription: {
            fontSize: 13,
            color: colors.textSubtle,
            lineHeight: 18,
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 30,
            paddingVertical: 16,
            alignItems: 'center',
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        buttonText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },
    });
