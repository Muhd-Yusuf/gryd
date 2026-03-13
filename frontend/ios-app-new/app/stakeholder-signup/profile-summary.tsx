import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    TextInput,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon, CheckCircle } from 'lucide-react-native';
import { authSignupStakeholder, setAuthUser, uploadFile, StakeholderBadge } from '../../lib/api';
import { useTheme } from '../../lib/theme';

const BADGE_COLORS: Record<StakeholderBadge, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};

export default function StakeholderProfileSummaryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        token: string;
        email: string;
        firstName: string;
        lastName: string;
        username: string;
        company: string;
        subgridId: string;
        subgridName: string;
        stakeholderBadge: string;
        profileImage: string;
    }>();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const getInitials = () => {
        const first = params.firstName?.[0] || '';
        const last = params.lastName?.[0] || '';
        return (first + last).toUpperCase() || 'MJ';
    };

    const getBadgeLabel = (badge: string) => {
        return badge.charAt(0).toUpperCase() + badge.slice(1);
    };

    const getBadgeColor = (badge: string) => {
        return BADGE_COLORS[badge as StakeholderBadge] || '#3B82F6';
    };

    const handleComplete = async () => {
        setError('');
        setLoading(true);

        try {
            let avatarUrl = '';

            // Upload profile image if provided
            if (params.profileImage) {
                try {
                    const uriParts = params.profileImage.split('/');
                    const filename = uriParts[uriParts.length - 1] || `avatar_${Date.now()}.jpg`;

                    const uploadResult = await uploadFile(
                        { uri: params.profileImage, name: filename, type: 'image/jpeg' },
                        { type: 'avatar' }
                    );
                    avatarUrl = uploadResult.data?.url || uploadResult.url || '';
                } catch (uploadErr) {
                    console.warn('Failed to upload profile image:', uploadErr);
                    // Continue without avatar - user can update it later
                }
            }

            // Create account
            const result = await authSignupStakeholder({
                inviteToken: params.token,
                firstName: params.firstName,
                lastName: params.lastName,
                email: params.email,
                username: params.username,
                company: params.company,
                avatarUrl,
                stakeholderBadge: params.stakeholderBadge as StakeholderBadge,
            });

            // Store auth data
            await setAuthUser(result.token, result.user);

            // Show success state
            setSuccess(true);
            setLoading(false);

            // Navigate after auth state is stored
            router.replace('/(main)');
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
            setLoading(false);
        }
    };

    const handleEdit = () => {
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

                <View style={styles.successContent}>
                    <View style={styles.card}>
                        <View style={styles.successContainer}>
                            <View style={styles.successIcon}>
                                <CheckCircle color={colors.success || '#22C55E'} size={64} />
                            </View>
                            <Text style={styles.successTitle}>Welcome to The GRYD!</Text>
                            <Text style={styles.successMessage}>
                                Your account has been created and you've joined {params.subgridName} as a {getBadgeLabel(params.stakeholderBadge)}!
                            </Text>
                            <View style={[styles.successBadge, { backgroundColor: getBadgeColor(params.stakeholderBadge) }]}>
                                <Text style={styles.successBadgeText}>
                                    {getBadgeLabel(params.stakeholderBadge)}
                                </Text>
                            </View>
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
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                {/* Step indicator */}
                <View style={styles.stepIndicator}>
                    <View style={[styles.step, styles.stepCompleted]} />
                    <View style={[styles.stepLine, styles.stepLineCompleted]} />
                    <View style={[styles.step, styles.stepCompleted]} />
                    <View style={[styles.stepLine, styles.stepLineCompleted]} />
                    <View style={[styles.step, styles.stepCompleted]} />
                    <View style={[styles.stepLine, styles.stepLineCompleted]} />
                    <View style={[styles.step, styles.stepActive]} />
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

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <Text style={styles.title}>Profile Info</Text>
                    <Text style={styles.subtitle}>Review your profile to join now</Text>

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

                        {/* Edit Image Button */}
                        <TouchableOpacity
                            style={styles.editImageButton}
                            onPress={handleEdit}
                        >
                            <Text style={styles.editImageText}>Edit Image</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Info Fields */}
                    <View style={styles.fieldsSection}>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Full Name</Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={`${params.firstName} ${params.lastName}`}
                                editable={false}
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Username</Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={`@${params.username}`}
                                editable={false}
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Email</Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={params.email}
                                editable={false}
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Company</Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={params.company || '-'}
                                editable={false}
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Badge</Text>
                            <View style={styles.badgeContainer}>
                                <View style={[styles.badge, { backgroundColor: getBadgeColor(params.stakeholderBadge) }]}>
                                    <Text style={styles.badgeText}>
                                        {getBadgeLabel(params.stakeholderBadge)}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Server</Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={params.subgridName}
                                editable={false}
                            />
                        </View>
                    </View>

                    {!!error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleComplete}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primaryText} />
                        ) : (
                            <Text style={styles.buttonText}>Continue</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
        },
        logoText: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        stepIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        step: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.border,
        },
        stepActive: {
            backgroundColor: colors.primary,
        },
        stepCompleted: {
            backgroundColor: '#22C55E',
        },
        stepLine: {
            width: 20,
            height: 2,
            backgroundColor: colors.border,
        },
        stepLineCompleted: {
            backgroundColor: '#22C55E',
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
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        card: {
            width: '100%',
            maxWidth: 500,
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
            alignItems: 'center',
            marginBottom: 32,
        },
        avatarContainer: {
            width: 100,
            height: 100,
            borderRadius: 50,
            overflow: 'hidden',
            marginBottom: 16,
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
            borderRadius: 50,
        },
        avatarText: {
            fontSize: 32,
            fontWeight: '600',
            color: colors.textMuted,
        },
        editImageButton: {
            backgroundColor: colors.text,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        editImageText: {
            color: colors.appBg,
            fontSize: 14,
            fontWeight: '600',
        },
        fieldsSection: {
            marginBottom: 24,
        },
        fieldGroup: {
            marginBottom: 16,
        },
        fieldLabel: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
        },
        fieldInput: {
            backgroundColor: colors.appBg,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.textMuted,
        },
        badgeContainer: {
            flexDirection: 'row',
        },
        badge: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
        },
        badgeText: {
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: '600',
        },
        errorContainer: {
            backgroundColor: colors.appBg,
            borderWidth: 1,
            borderColor: colors.error,
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
        },
        errorText: {
            color: colors.error,
            fontSize: 14,
            textAlign: 'center',
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
        successContent: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
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
        successBadge: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
            marginBottom: 24,
        },
        successBadgeText: {
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: '600',
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
