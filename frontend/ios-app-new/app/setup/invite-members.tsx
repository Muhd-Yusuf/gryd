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

export default function InviteMembersScreen() {
    const router = useRouter();
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
                                />
                                <TouchableOpacity
                                    style={styles.copyButton}
                                    onPress={handleCopyLink}
                                >
                                    <Text style={styles.copyButtonText}>
                                        {copied ? 'Copied!' : 'Copy Link'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {!!error && (
                            <Text style={styles.errorText}>{error}</Text>
                        )}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleContinue}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Continue</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: '#000000',
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
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
        backgroundColor: '#E5E7EB',
    },
    stepDotActive: {
        backgroundColor: '#000000',
    },
    stepDotCompleted: {
        backgroundColor: '#22C55E',
    },
    stepLabel: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    stepLabelActive: {
        color: '#000000',
        fontWeight: '500',
    },
    stepLine: {
        width: 24,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    stepLineCompleted: {
        backgroundColor: '#22C55E',
    },
    logoutButton: {
        marginLeft: 'auto',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    logoutText: {
        fontSize: 12,
        color: '#374151',
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
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userIconText: {
        fontSize: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 12,
    },
    linkRow: {
        flexDirection: 'row',
        gap: 8,
    },
    linkInput: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: '#6B7280',
    },
    copyButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    copyButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 13,
        marginBottom: 16,
    },
    button: {
        backgroundColor: '#000000',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        width: 140,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
