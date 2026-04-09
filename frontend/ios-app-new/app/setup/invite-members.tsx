import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { completeSetup, setAuthUser, getApiBaseUrl } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { GlassButton } from '../../components/glass';

export default function InviteMembersScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const params = useLocalSearchParams<{
        token: string;
        tenant: string;
        email: string;
        tenantId: string;
        subgridId: string;
        serverName: string;
        description: string;
        iconUri: string;
        bannerColor: string;
    }>();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [inviteCode, setInviteCode] = useState<string | null>(null);

    // Generate the invite URL with actual code or placeholder
    // Derive from API base URL or window origin — avoid hardcoded domain
    const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : getApiBaseUrl().replace(/\/api$/, '');
    const inviteUrl = inviteCode
        ? `${baseUrl}/join/${inviteCode}`
        : `${baseUrl}/join/XXXXXX`;

    const handleCopyLink = async () => {
        try {
            await Clipboard.setStringAsync(inviteUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleContinue = async () => {
        setError('');
        setLoading(true);

        try {
            // Complete the setup with server customization data
            const result = await completeSetup({
                setupToken: params.token,
                tenantId: params.tenantId,
                // Server customization
                serverName: params.serverName,
                serverDescription: params.description,
                serverLogoUrl: params.iconUri || undefined,
                serverBannerColor: params.bannerColor,
            });

            // Get invite code from result if available
            if (result.subgrid?.inviteCode) {
                setInviteCode(result.subgrid.inviteCode);
            }

            // Store auth data
            await setAuthUser(result.token, result.user);

            // Navigate to admin dashboard
            router.replace(result.redirectTo || '/admin');
        } catch (err: any) {
            setError(err.message || 'Failed to complete setup');
        } finally {
            setLoading(false);
        }
    };

    const styles = createStyles(colors);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>The Gryd Onboarding</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    {/* Step Indicator */}
                    <View style={styles.stepRow}>
                        <View style={styles.stepItem}>
                            <View style={[styles.stepDot, styles.stepDotCompleted]} />
                            <Text style={styles.stepLabel}>Server Setup</Text>
                        </View>
                        <View style={[styles.stepLine, styles.stepLineCompleted]} />
                        <View style={styles.stepItem}>
                            <View style={[styles.stepDot, styles.stepDotCompleted]} />
                            <Text style={styles.stepLabel}>Server Icon</Text>
                        </View>
                        <View style={[styles.stepLine, styles.stepLineCompleted]} />
                        <View style={styles.stepItem}>
                            <View style={[styles.stepDot, styles.stepDotActive]} />
                            <Text style={[styles.stepLabel, styles.stepLabelActive]}>Invite members</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={() => router.replace('/login')}
                        >
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View style={styles.formContainer}>
                        {/* User Icon */}
                        <View style={styles.userIconContainer}>
                            <View style={styles.userIcon}>
                                <Text style={styles.userIconText}>👤</Text>
                            </View>
                        </View>

                        <Text style={styles.title}>Invite members to {params.serverName} Server</Text>
                        <Text style={styles.subtitle}>Recipients will be added in the server</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Copy and send server invite link to a friend</Text>
                            <View style={styles.linkRow}>
                                <TextInput
                                    style={styles.linkInput}
                                    value={inviteUrl}
                                    editable={false}
                                    selectTextOnFocus
                                    placeholderTextColor={colors.textSubtle}
                                />
                                <GlassButton
                                    label={copied ? 'Copied!' : 'Copy Link'}
                                    onPress={handleCopyLink}
                                    variant="secondary"
                                    size="sm"
                                />
                            </View>
                        </View>

                        {!!error && (
                            <Text style={styles.errorText}>{error}</Text>
                        )}

                        <GlassButton
                            label="Continue"
                            onPress={handleContinue}
                            variant="primary"
                            size="md"
                            loading={loading}
                            disabled={loading}
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        header: {
            backgroundColor: colors.glassBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        headerTitle: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '500',
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
        },
        card: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 24,
            maxWidth: 500,
            width: '100%',
            alignSelf: 'center',
        },
        stepRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 32,
            flexWrap: 'wrap',
            gap: 8,
        },
        stepItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        stepDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.glassBorder,
        },
        stepDotActive: {
            backgroundColor: colors.primary,
        },
        stepDotCompleted: {
            backgroundColor: colors.successText,
        },
        stepLabel: {
            fontSize: 12,
            color: colors.textMuted,
        },
        stepLabelActive: {
            color: colors.text,
            fontWeight: '500',
        },
        stepLine: {
            width: 24,
            height: 1,
            backgroundColor: colors.glassBorder,
        },
        stepLineCompleted: {
            backgroundColor: colors.successText,
        },
        logoutButton: {
            marginLeft: 'auto',
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 6,
            paddingVertical: 6,
            paddingHorizontal: 12,
        },
        logoutText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        formContainer: {
            maxWidth: 400,
        },
        userIconContainer: {
            marginBottom: 20,
        },
        userIcon: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            justifyContent: 'center',
            alignItems: 'center',
        },
        userIconText: {
            fontSize: 24,
        },
        title: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        subtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 24,
        },
        inputGroup: {
            marginBottom: 24,
        },
        label: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 12,
        },
        linkRow: {
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
        },
        linkInput: {
            flex: 1,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 13,
            color: colors.textMuted,
        },
        errorText: {
            color: colors.error,
            fontSize: 13,
            marginBottom: 16,
        },
    });
