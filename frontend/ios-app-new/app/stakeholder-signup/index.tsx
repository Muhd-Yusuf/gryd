import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon } from 'lucide-react-native';
import { validateStakeholderInvite, StakeholderBadge } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function StakeholderServerDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ token?: string; subgrid?: string }>();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [serverData, setServerData] = useState<{
        email: string;
        subgridId: string;
        subgridName: string;
        clientName?: string;
        logoUrl?: string;
        stakeholderBadge: StakeholderBadge;
    } | null>(null);
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (params.token) {
            validateInvite();
        } else {
            setError('No invitation token provided');
            setLoading(false);
        }
    }, [params.token]);

    const validateInvite = async () => {
        try {
            const data = await validateStakeholderInvite(params.token!);
            setServerData(data);
            setEmail(data.email);
        } catch (err: any) {
            setError(err.message || 'Invalid or expired invitation');
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string) => {
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const getBadgeLabel = (badge: StakeholderBadge) => {
        return badge.charAt(0).toUpperCase() + badge.slice(1);
    };

    const handleSetupProfile = () => {
        if (!serverData) return;

        router.push({
            pathname: '/stakeholder-signup/account-setup',
            params: {
                token: params.token,
                email: serverData.email,
                subgridId: serverData.subgridId,
                subgridName: serverData.subgridName,
                stakeholderBadge: serverData.stakeholderBadge,
            },
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Validating invitation...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !serverData) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.card}>
                        <Text style={styles.errorTitle}>Invalid Invitation</Text>
                        <Text style={styles.errorMessage}>{error || 'Unable to validate invitation'}</Text>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => router.replace('/login')}
                        >
                            <Text style={styles.buttonText}>Go to Login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                        {mode === 'dark' ? (
                            <Sun color={colors.text} size={20} />
                        ) : (
                            <Moon color={colors.text} size={20} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={() => router.replace('/login')}
                    >
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.content}>
                <Text style={styles.welcomeTitle}>
                    Welcome to {serverData.subgridName}
                </Text>

                {/* Server Card */}
                <View style={styles.serverCard}>
                    {/* Pink Header */}
                    <View style={styles.serverHeader}>
                        {serverData.logoUrl ? (
                            <Image
                                source={{ uri: serverData.logoUrl }}
                                style={styles.serverLogo}
                                cachePolicy="memory-disk"
                            />
                        ) : null}
                    </View>

                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {getInitials(serverData.subgridName || 'RB')}
                            </Text>
                        </View>
                    </View>

                    {/* Server Info */}
                    <View style={styles.serverInfo}>
                        <Text style={styles.serverName}>
                            {serverData.subgridName || 'Server'}
                        </Text>
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <View style={styles.onlineDot} />
                                <Text style={styles.statText}>1 Online</Text>
                            </View>
                            <View style={styles.statItem}>
                                <View style={styles.offlineDot} />
                                <Text style={styles.statText}>Members</Text>
                            </View>
                        </View>
                        <Text style={styles.serverDescription} numberOfLines={2}>
                            You are being invited as a {getBadgeLabel(serverData.stakeholderBadge)}
                        </Text>
                    </View>
                </View>

                {/* Email Display */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[styles.input, styles.inputDisabled]}
                        value={email}
                        editable={false}
                    />
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleSetupProfile}
                >
                    <Text style={styles.buttonText}>Setup Profile</Text>
                </TouchableOpacity>
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
        headerRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        themeToggle: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: colors.surface,
        },
        logoContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        logoText: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        logoutButton: {
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
        },
        logoutText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '500',
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        loadingText: {
            color: colors.textMuted,
            fontSize: 16,
        },
        content: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            maxWidth: 500,
            alignSelf: 'center',
            width: '100%',
        },
        card: {
            width: '100%',
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 32,
            alignItems: 'center',
        },
        welcomeTitle: {
            fontSize: 24,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 24,
            textAlign: 'center',
        },
        serverCard: {
            width: '100%',
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
        serverLogo: {
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
        offlineDot: {
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
            color: colors.primary,
            fontWeight: '500',
            lineHeight: 18,
        },
        inputGroup: {
            width: '100%',
            marginBottom: 20,
        },
        label: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
        },
        input: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 16,
            fontSize: 16,
            color: colors.text,
        },
        inputDisabled: {
            backgroundColor: colors.appBg,
            color: colors.textMuted,
        },
        button: {
            width: '100%',
            backgroundColor: colors.primary,
            borderRadius: 30,
            paddingVertical: 16,
            alignItems: 'center',
        },
        buttonText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },
        errorTitle: {
            fontSize: 22,
            fontWeight: '600',
            color: colors.error,
            marginBottom: 12,
        },
        errorMessage: {
            fontSize: 16,
            color: colors.textMuted,
            marginBottom: 24,
            textAlign: 'center',
        },
    });
