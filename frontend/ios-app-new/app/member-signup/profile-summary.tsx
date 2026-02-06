import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Platform,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon, CheckCircle, ArrowLeft } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { authSignupMember, setAuthUser, uploadFile } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function ProfileSummaryScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isMobileView = !isWeb || width < 768;

    const mobileStyles = createMobileStyles(colors);
    const webStyles = createWebStyles(colors);

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

    const handleBack = () => {
        router.back();
    };

    // Success screen component
    const renderSuccessScreen = (styles: any) => (
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
    );

    // Profile preview section
    const renderProfilePreview = (styles: any) => (
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
    );

    // Info rows section
    const renderInfoRows = (styles: any) => (
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
    );

    // Mobile success screen
    if (success && isMobileView) {
        return (
            <SafeAreaView style={mobileStyles.container}>
                <View style={mobileStyles.topRow}>
                    <View />
                    <TouchableOpacity style={mobileStyles.themeToggle} onPress={toggleTheme}>
                        {mode === 'dark' ? (
                            <Sun color={colors.text} size={22} />
                        ) : (
                            <Moon color={colors.text} size={22} />
                        )}
                    </TouchableOpacity>
                </View>
                <View style={mobileStyles.successWrapper}>
                    {renderSuccessScreen(mobileStyles)}
                </View>
            </SafeAreaView>
        );
    }

    // Web success screen
    if (success && !isMobileView) {
        return (
            <SafeAreaView style={webStyles.container}>
                <ScrollView
                    contentContainerStyle={webStyles.shell}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={webStyles.leftPanel}>
                        <View style={webStyles.logoRow}>
                            <View style={webStyles.logoMark}>
                                <View style={[webStyles.hashLine, webStyles.hashLineVerticalLeft]} />
                                <View style={[webStyles.hashLine, webStyles.hashLineVerticalRight]} />
                                <View style={[webStyles.hashLine, webStyles.hashLineHorizontalTop]} />
                                <View style={[webStyles.hashLine, webStyles.hashLineHorizontalBottom]} />
                            </View>
                            <Text style={webStyles.logoText}>THE GRYD</Text>
                        </View>

                        <View style={webStyles.welcomeBlock}>
                            <Text style={webStyles.welcomeTitle}>Welcome to The Gryd</Text>
                        </View>
                    </View>

                    <View style={webStyles.rightPanel}>
                        <TouchableOpacity style={webStyles.themeToggle} onPress={toggleTheme}>
                            {mode === 'dark' ? (
                                <Sun color={colors.text} size={20} />
                            ) : (
                                <Moon color={colors.text} size={20} />
                            )}
                        </TouchableOpacity>
                        <View style={webStyles.formCard}>
                            {renderSuccessScreen(webStyles)}
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Mobile view
    if (isMobileView) {
        return (
            <SafeAreaView style={mobileStyles.container}>
                <ScrollView contentContainerStyle={mobileStyles.scrollContent}>
                    <View style={mobileStyles.topRow}>
                        <TouchableOpacity style={mobileStyles.backButton} onPress={handleBack}>
                            <ArrowLeft color={colors.text} size={24} />
                        </TouchableOpacity>
                        <TouchableOpacity style={mobileStyles.themeToggle} onPress={toggleTheme}>
                            {mode === 'dark' ? (
                                <Sun color={colors.text} size={22} />
                            ) : (
                                <Moon color={colors.text} size={22} />
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={mobileStyles.header}>
                        <Text style={mobileStyles.title}>Profile Summary</Text>
                        <Text style={mobileStyles.subtitle}>
                            Review your profile before completing signup
                        </Text>
                    </View>

                    <View style={mobileStyles.form}>
                        {renderProfilePreview(mobileStyles)}
                        {renderInfoRows(mobileStyles)}

                        {!!error && (
                            <View style={mobileStyles.errorContainer}>
                                <MaterialIcons name="error" size={18} color={colors.error} />
                                <Text style={mobileStyles.errorText}>{error}</Text>
                            </View>
                        )}

                        <View style={mobileStyles.buttonGroup}>
                            <TouchableOpacity
                                style={mobileStyles.editButton}
                                onPress={handleEdit}
                                disabled={loading}
                            >
                                <Text style={mobileStyles.editButtonText}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[mobileStyles.completeButton, loading && mobileStyles.buttonDisabled]}
                                onPress={handleComplete}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={mobileStyles.completeButtonText}>Complete Signup</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={mobileStyles.footer}>
                        <Text style={mobileStyles.footerText}>
                            Already have an account?{' '}
                        </Text>
                        <TouchableOpacity onPress={() => router.push('/login')}>
                            <Text style={mobileStyles.loginLink}>Login</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Web view
    return (
        <SafeAreaView style={webStyles.container}>
            <ScrollView
                contentContainerStyle={webStyles.shell}
                showsVerticalScrollIndicator={false}
            >
                <View style={webStyles.leftPanel}>
                    <View style={webStyles.logoRow}>
                        <View style={webStyles.logoMark}>
                            <View style={[webStyles.hashLine, webStyles.hashLineVerticalLeft]} />
                            <View style={[webStyles.hashLine, webStyles.hashLineVerticalRight]} />
                            <View style={[webStyles.hashLine, webStyles.hashLineHorizontalTop]} />
                            <View style={[webStyles.hashLine, webStyles.hashLineHorizontalBottom]} />
                        </View>
                        <Text style={webStyles.logoText}>THE GRYD</Text>
                    </View>

                    <View style={webStyles.welcomeBlock}>
                        <Text style={webStyles.welcomeTitle}>Welcome to The Gryd</Text>
                    </View>
                </View>

                <View style={webStyles.rightPanel}>
                    <TouchableOpacity style={webStyles.themeToggle} onPress={toggleTheme}>
                        {mode === 'dark' ? (
                            <Sun color={colors.text} size={20} />
                        ) : (
                            <Moon color={colors.text} size={20} />
                        )}
                    </TouchableOpacity>
                    <View style={webStyles.formCard}>
                        <Text style={webStyles.title}>Profile Summary</Text>
                        <Text style={webStyles.subtitle}>
                            Review your profile before completing signup
                        </Text>

                        {renderProfilePreview(webStyles)}
                        {renderInfoRows(webStyles)}

                        {!!error && (
                            <View style={webStyles.errorContainer}>
                                <MaterialIcons name="error" size={16} color={colors.error} />
                                <Text style={webStyles.errorText}>{error}</Text>
                            </View>
                        )}

                        <View style={webStyles.buttonGroup}>
                            <TouchableOpacity
                                style={webStyles.editButton}
                                onPress={handleEdit}
                                disabled={loading}
                            >
                                <Text style={webStyles.editButtonText}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[webStyles.completeButton, loading && webStyles.buttonDisabled]}
                                onPress={handleComplete}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={webStyles.completeButtonText}>Complete</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={webStyles.signupContainer}>
                            <Text style={webStyles.signupText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/login')}>
                                <Text style={webStyles.signupLink}>Login</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const createWebStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        shell: {
            flexGrow: 1,
            flexDirection: 'row',
            alignItems: 'stretch',
        },
        leftPanel: {
            flex: 1,
            backgroundColor: '#000000',
            paddingHorizontal: 32,
            paddingTop: 26,
            paddingBottom: 80,
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        logoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'center',
        },
        logoMark: {
            width: 18,
            height: 18,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transform: [{ rotate: '-12deg' }],
        },
        hashLine: {
            position: 'absolute',
            backgroundColor: '#FFFFFF',
            borderRadius: 1,
        },
        hashLineVerticalLeft: {
            width: 2,
            height: 16,
            left: 4,
        },
        hashLineVerticalRight: {
            width: 2,
            height: 16,
            right: 4,
        },
        hashLineHorizontalTop: {
            height: 2,
            width: 16,
            top: 4,
        },
        hashLineHorizontalBottom: {
            height: 2,
            width: 16,
            bottom: 4,
        },
        logoText: {
            fontSize: 12,
            fontFamily: 'Inter_700Bold',
            letterSpacing: 1.4,
            color: '#FFFFFF',
        },
        welcomeBlock: {
            alignSelf: 'center',
            alignItems: 'center',
            marginBottom: 12,
        },
        welcomeTitle: {
            fontSize: 16,
            fontFamily: 'Inter_600SemiBold',
            color: '#FFFFFF',
            letterSpacing: 0.2,
            textAlign: 'center',
        },
        rightPanel: {
            flex: 1,
            backgroundColor: colors.appBg,
            padding: 48,
            justifyContent: 'center',
            borderLeftWidth: 1,
            borderLeftColor: colors.border,
        },
        themeToggle: {
            position: 'absolute',
            top: 20,
            right: 20,
            padding: 10,
            borderRadius: 20,
            backgroundColor: colors.surface,
        },
        formCard: {
            maxWidth: 400,
            width: '100%',
            alignSelf: 'center',
        },
        title: {
            fontSize: 20,
            fontFamily: 'Inter_700Bold',
            color: colors.text,
            marginBottom: 6,
        },
        subtitle: {
            fontSize: 12,
            fontFamily: 'Inter_400Regular',
            color: colors.textMuted,
            marginBottom: 20,
            lineHeight: 16,
        },
        profilePreview: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        avatarContainer: {
            width: 56,
            height: 56,
            borderRadius: 28,
            overflow: 'hidden',
        },
        avatarImage: {
            width: '100%',
            height: '100%',
        },
        avatarPlaceholder: {
            width: '100%',
            height: '100%',
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: 28,
        },
        avatarText: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.textMuted,
        },
        userInfo: {
            flex: 1,
        },
        userName: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 2,
        },
        userUsername: {
            fontSize: 12,
            color: colors.textMuted,
        },
        infoSection: {
            marginBottom: 16,
        },
        infoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.surface,
        },
        infoIcon: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
        },
        infoContent: {
            flex: 1,
        },
        infoLabel: {
            fontSize: 10,
            color: colors.textSubtle,
            marginBottom: 1,
        },
        infoValue: {
            fontSize: 12,
            color: colors.text,
            fontWeight: '500',
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.error,
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
        },
        errorText: {
            flex: 1,
            color: colors.error,
            fontSize: 11,
        },
        buttonGroup: {
            flexDirection: 'row',
            gap: 10,
        },
        editButton: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 10,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
        },
        editButtonText: {
            color: colors.text,
            fontSize: 12,
            fontFamily: 'Inter_600SemiBold',
        },
        completeButton: {
            flex: 2,
            backgroundColor: colors.primary,
            borderRadius: 10,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        completeButtonText: {
            color: colors.primaryText,
            fontSize: 12,
            fontFamily: 'Inter_600SemiBold',
        },
        signupContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 20,
        },
        signupText: {
            fontSize: 11,
            fontFamily: 'Inter_400Regular',
            color: colors.textMuted,
        },
        signupLink: {
            fontSize: 11,
            fontFamily: 'Inter_600SemiBold',
            color: colors.primary,
        },
        successContainer: {
            alignItems: 'center',
            paddingVertical: 20,
        },
        successIcon: {
            marginBottom: 20,
        },
        successTitle: {
            fontSize: 20,
            fontFamily: 'Inter_700Bold',
            color: colors.text,
            marginBottom: 10,
            textAlign: 'center',
        },
        successMessage: {
            fontSize: 12,
            fontFamily: 'Inter_400Regular',
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 12,
            lineHeight: 18,
        },
        redirectText: {
            fontSize: 11,
            color: colors.textSubtle,
            marginBottom: 16,
        },
        getStartedButton: {
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingVertical: 12,
            paddingHorizontal: 32,
            alignItems: 'center',
        },
        getStartedButtonText: {
            color: colors.primaryText,
            fontSize: 12,
            fontFamily: 'Inter_600SemiBold',
        },
    });

const createMobileStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        scrollContent: {
            padding: 30,
            flexGrow: 1,
        },
        topRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 40,
            paddingHorizontal: 30,
            paddingTop: 20,
        },
        backButton: {
        },
        themeToggle: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: colors.surface,
        },
        header: {
            marginBottom: 40,
        },
        title: {
            fontSize: 32,
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 16,
            color: colors.textMuted,
            lineHeight: 24,
        },
        form: {
            gap: 20,
        },
        profilePreview: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginBottom: 20,
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
            backgroundColor: colors.surface,
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
            borderBottomColor: colors.surface,
        },
        infoIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.error,
            padding: 12,
            borderRadius: 12,
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
            backgroundColor: colors.surface,
            borderRadius: 30,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
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
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        completeButtonText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },
        footer: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 40,
            flexWrap: 'wrap',
        },
        footerText: {
            color: colors.textMuted,
            fontSize: 14,
            textAlign: 'center',
        },
        loginLink: {
            color: colors.primary,
            fontSize: 14,
            fontWeight: '600',
        },
        successWrapper: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 30,
        },
        successContainer: {
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 32,
            width: '100%',
            maxWidth: 400,
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
