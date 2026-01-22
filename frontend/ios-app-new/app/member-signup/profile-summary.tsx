import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon, CheckCircle } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { authSignupMember, setAuthUser, uploadFile } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function ProfileSummaryScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);
    const params = useLocalSearchParams<{
        serverCode: string;
        subgridId: string;
        subgridName: string;
        firstName: string;
        lastName: string;
        email: string;
        username: string;
        profileImage: string;
    }>();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Get initials for default avatar
    const getInitials = () => {
        const first = params.firstName?.[0] || '';
        const last = params.lastName?.[0] || '';
        return (first + last).toUpperCase() || 'MJ';
    };

    const handleComplete = async () => {
        setError('');
        setLoading(true);

        try {
            let avatarUrl = '';

            // Upload profile image if provided
            if (params.profileImage) {
                try {
                    // Extract filename from URI or generate one
                    const uriParts = params.profileImage.split('/');
                    const filename = uriParts[uriParts.length - 1] || `avatar_${Date.now()}.jpg`;

                    const uploadResult = await uploadFile(
                        { uri: params.profileImage, name: filename, type: 'image/jpeg' },
                        { type: 'avatar' }
                    );
                    avatarUrl = uploadResult.data?.url || uploadResult.url || '';
                } catch (uploadErr) {
                    console.warn('Failed to upload profile image:', uploadErr);
                    // Continue without avatar
                }
            }

            // Create account
            const result = await authSignupMember({
                firstName: params.firstName,
                lastName: params.lastName,
                email: params.email,
                username: params.username,
                inviteCode: params.serverCode,
                avatarUrl,
            });

            // Store auth data
            await setAuthUser(result.token, result.user);

            // Show success state
            setSuccess(true);
            setLoading(false);

            // Auto-navigate after a short delay
            setTimeout(() => {
                router.replace('/(main)');
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
            setLoading(false);
        }
    };

    const handleEdit = () => {
        // Go back to edit profile details
        router.back();
    };

    // Success screen
    if (success) {
        return (
            <SafeAreaView style={styles.container}>
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
                        <View style={styles.successContainer}>
                            <View style={styles.successIcon}>
                                <CheckCircle color={colors.success || '#22C55E'} size={64} />
                            </View>
                            <Text style={styles.successTitle}>Welcome to The GRYD!</Text>
                            <Text style={styles.successMessage}>
                                Your account has been created and you've joined {params.subgridName}!
                            </Text>
                            <Text style={styles.redirectText}>
                                Redirecting to your dashboard...
                            </Text>
                            <TouchableOpacity
                                style={styles.getStartedButton}
                                onPress={() => router.replace('/(main)')}
                            >
                                <Text style={styles.getStartedButtonText}>Get Started Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

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
                    <Text style={styles.title}>Profile Summary</Text>
                    <Text style={styles.subtitle}>Review your profile before completing signup</Text>

                    {/* Profile Preview */}
                    <View style={styles.profilePreview}>
                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                            {params.profileImage ? (
                                <Image
                                    source={{ uri: params.profileImage }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarText}>{getInitials()}</Text>
                                </View>
                            )}
                        </View>

                        {/* User Info */}
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>
                                {params.firstName} {params.lastName}
                            </Text>
                            <Text style={styles.userUsername}>@{params.username}</Text>
                        </View>
                    </View>

                    {/* Info Rows */}
                    <View style={styles.infoSection}>
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <MaterialIcons name="email" size={20} color={colors.textMuted} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Email</Text>
                                <Text style={styles.infoValue}>{params.email}</Text>
                            </View>
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <MaterialIcons name="business" size={20} color={colors.textMuted} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Server</Text>
                                <Text style={styles.infoValue}>{params.subgridName}</Text>
                            </View>
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <MaterialIcons name="vpn-key" size={20} color={colors.textMuted} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Server Code</Text>
                                <Text style={styles.infoValue}>{params.serverCode}</Text>
                            </View>
                        </View>
                    </View>

                    {!!error && (
                        <View style={styles.errorContainer}>
                            <MaterialIcons name="error" size={18} color={colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={handleEdit}
                            disabled={loading}
                        >
                            <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.completeButton, loading && styles.buttonDisabled]}
                            onPress={handleComplete}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={styles.completeButtonText}>Complete Signup</Text>
                            )}
                        </TouchableOpacity>
                    </View>
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
        title: {
            fontSize: 22,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 32,
        },
        profilePreview: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
            paddingBottom: 24,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        avatarContainer: {
            width: 72,
            height: 72,
            borderRadius: 36,
            overflow: 'hidden',
        },
        avatarImage: {
            width: '100%',
            height: '100%',
        },
        avatarPlaceholder: {
            width: '100%',
            height: '100%',
            backgroundColor: colors.appBg,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: 36,
        },
        avatarText: {
            fontSize: 24,
            fontWeight: '600',
            color: colors.textMuted,
        },
        userInfo: {
            flex: 1,
        },
        userName: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        userUsername: {
            fontSize: 15,
            color: colors.textMuted,
        },
        infoSection: {
            marginBottom: 24,
        },
        infoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.appBg,
        },
        infoIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.appBg,
            justifyContent: 'center',
            alignItems: 'center',
        },
        infoContent: {
            flex: 1,
        },
        infoLabel: {
            fontSize: 12,
            color: colors.textSubtle,
            marginBottom: 2,
        },
        infoValue: {
            fontSize: 15,
            color: colors.text,
            fontWeight: '500',
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.appBg,
            borderWidth: 1,
            borderColor: colors.error,
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
        },
        errorText: {
            flex: 1,
            color: colors.error,
            fontSize: 14,
        },
        buttonGroup: {
            flexDirection: 'row',
            gap: 12,
        },
        editButton: {
            flex: 1,
            backgroundColor: colors.appBg,
            borderRadius: 30,
            paddingVertical: 16,
            alignItems: 'center',
        },
        editButtonText: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
        },
        completeButton: {
            flex: 2,
            backgroundColor: colors.primary,
            borderRadius: 30,
            paddingVertical: 16,
            alignItems: 'center',
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        completeButtonText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },
        successContainer: {
            alignItems: 'center',
            paddingVertical: 24,
        },
        successIcon: {
            marginBottom: 24,
        },
        successTitle: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 12,
            textAlign: 'center',
        },
        successMessage: {
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 24,
        },
        redirectText: {
            fontSize: 14,
            color: colors.textSubtle,
            marginBottom: 24,
        },
        getStartedButton: {
            backgroundColor: colors.primary,
            borderRadius: 30,
            paddingVertical: 16,
            paddingHorizontal: 48,
            alignItems: 'center',
        },
        getStartedButtonText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },
    });
