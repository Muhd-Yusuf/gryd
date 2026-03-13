import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, UserPlus, Building2 } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { communityGet, communityPost, authSignup, authLogin, setAuthUser } from '../../lib/api';

interface InviteDetails {
    subgridId: string;
    subgridName: string;
    inviterName?: string;
    memberRole: string;
    expiresAt: string;
}

export default function JoinInviteScreen() {
    const { token, subgrid: subgridIdParam } = useLocalSearchParams<{ token: string; subgrid?: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const styles = createStyles(colors);

    // State
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
    const [inviteValid, setInviteValid] = useState(false);

    // Form state
    const [mode, setMode] = useState<'signup' | 'login'>('signup');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Validate invite on mount
    useEffect(() => {
        validateInvite();
    }, [token, subgridIdParam]);

    const validateInvite = async () => {
        if (!token) {
            setError('Invalid invite link');
            setLoading(false);
            return;
        }

        try {
            // Get invite details
            const subgridId = subgridIdParam || '';
            const response = await communityGet(`/subgrids/${subgridId}/invites/validate?token=${token}`);

            if (response?.data) {
                setInviteDetails({
                    subgridId: response.data.subgridId || subgridId,
                    subgridName: response.data.subgridName || 'Credit Union Community',
                    inviterName: response.data.inviterName,
                    memberRole: response.data.memberRole || 'member',
                    expiresAt: response.data.expiresAt,
                });
                setInviteValid(true);
                if (response.data.inviteeEmail) {
                    setEmail(response.data.inviteeEmail);
                }
            } else {
                // If validation endpoint doesn't exist, try to get subgrid details
                const subgridResponse = await communityGet(`/subgrids/${subgridId}`);
                if (subgridResponse?.data) {
                    setInviteDetails({
                        subgridId: subgridId,
                        subgridName: subgridResponse.data.name || 'Credit Union Community',
                        memberRole: 'member',
                        expiresAt: '',
                    });
                    setInviteValid(true);
                } else {
                    setError('Invalid or expired invite');
                }
            }
        } catch (err: any) {
            // If API fails, show a generic invite screen
            if (subgridIdParam) {
                setInviteDetails({
                    subgridId: subgridIdParam,
                    subgridName: 'Credit Union Community',
                    memberRole: 'member',
                    expiresAt: '',
                });
                setInviteValid(true);
            } else {
                setError('This invite link is invalid or has expired');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        setError('');

        // Validate fields
        if (!firstName.trim()) {
            setError('First name is required');
            return;
        }
        if (!lastName.trim()) {
            setError('Last name is required');
            return;
        }
        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!password) {
            setError('Password is required');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setSubmitting(true);
        try {
            // Step 1: Create account using auth API
            const { token: authTokenResult, user } = await authSignup({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
                password,
            });

            // Step 2: Accept invite before storing auth (avoid inconsistent state)
            await communityPost(`/subgrids/${inviteDetails?.subgridId}/invites/accept`, {
                inviteToken: token,
            });

            // Step 3: Store auth data only after invite is accepted
            await setAuthUser(authTokenResult, user);

            Alert.alert(
                'Welcome!',
                `Your account has been created and you've joined ${inviteDetails?.subgridName}!`,
                [
                    {
                        text: 'Continue',
                        onPress: () => router.replace('/(main)'),
                    },
                ]
            );
        } catch (err: any) {
            const message = err.message || 'Failed to create account';
            if (message.includes('already exists') || message.includes('duplicate')) {
                setError('An account with this email already exists. Please login instead.');
                setMode('login');
            } else {
                setError(message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogin = async () => {
        setError('');

        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!password) {
            setError('Password is required');
            return;
        }

        setSubmitting(true);
        try {
            // Step 1: Login using auth API
            const { token: authTokenResult, user } = await authLogin({
                email: email.trim().toLowerCase(),
                password,
            });

            // Step 2: Accept invite before storing auth (avoid inconsistent state)
            await communityPost(`/subgrids/${inviteDetails?.subgridId}/invites/accept`, {
                inviteToken: token,
            });

            // Step 3: Store auth data only after invite is accepted
            await setAuthUser(authTokenResult, user);

            Alert.alert(
                'Welcome!',
                `You've successfully joined ${inviteDetails?.subgridName}!`,
                [
                    {
                        text: 'Continue',
                        onPress: () => router.replace('/(main)'),
                    },
                ]
            );
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.text} />
                    <Text style={styles.loadingText}>Validating invite...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!inviteValid) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <AlertCircle size={64} color="#EF4444" />
                    <Text style={styles.errorTitle}>Invalid Invite</Text>
                    <Text style={styles.errorMessage}>{error || 'This invite link is invalid or has expired.'}</Text>
                    <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/')}>
                        <Text style={styles.homeButtonText}>Go to Home</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoText}>THE GRYD</Text>
                        </View>
                    </View>

                    {/* Invite Card */}
                    <View style={styles.inviteCard}>
                        <View style={styles.inviteIconWrap}>
                            <UserPlus size={40} color="#3B82F6" />
                        </View>
                        <Text style={styles.inviteTitle}>You're Invited!</Text>
                        <Text style={styles.inviteSubtitle}>
                            {inviteDetails?.inviterName
                                ? `${inviteDetails.inviterName} has invited you to join`
                                : 'You have been invited to join'}
                        </Text>
                        <View style={styles.communityBadge}>
                            <Building2 size={20} color="#3B82F6" />
                            <Text style={styles.communityName}>{inviteDetails?.subgridName}</Text>
                        </View>
                    </View>

                    {/* Mode Toggle */}
                    <View style={styles.modeToggle}>
                        <TouchableOpacity
                            style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
                            onPress={() => setMode('signup')}
                        >
                            <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>
                                Create Account
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
                            onPress={() => setMode('login')}
                        >
                            <Text style={[styles.modeButtonText, mode === 'login' && styles.modeButtonTextActive]}>
                                Login
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {mode === 'signup' && (
                            <>
                                <View style={styles.nameRow}>
                                    <View style={styles.nameField}>
                                        <Text style={styles.label}>First Name</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="John"
                                            placeholderTextColor={colors.textSubtle}
                                            value={firstName}
                                            onChangeText={setFirstName}
                                            autoCapitalize="words"
                                        />
                                    </View>
                                    <View style={styles.nameField}>
                                        <Text style={styles.label}>Last Name</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Doe"
                                            placeholderTextColor={colors.textSubtle}
                                            value={lastName}
                                            onChangeText={setLastName}
                                            autoCapitalize="words"
                                        />
                                    </View>
                                </View>
                            </>
                        )}

                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="john@example.com"
                            placeholderTextColor={colors.textSubtle}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'}
                            placeholderTextColor={colors.textSubtle}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        {mode === 'signup' && (
                            <>
                                <Text style={styles.label}>Confirm Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm your password"
                                    placeholderTextColor={colors.textSubtle}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />
                            </>
                        )}

                        {!!error && (
                            <View style={styles.errorBanner}>
                                <AlertCircle size={18} color="#EF4444" />
                                <Text style={styles.errorBannerText}>{error}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                            onPress={mode === 'signup' ? handleSignup : handleLogin}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>
                                    {mode === 'signup' ? 'Create Account & Join' : 'Login & Join'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <Text style={styles.footerText}>
                        By joining, you agree to our Terms of Service and Privacy Policy.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        keyboardView: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            padding: 24,
            alignItems: 'center',
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        loadingText: {
            fontSize: 16,
            color: colors.textMuted,
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            gap: 16,
        },
        errorTitle: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
        },
        errorMessage: {
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
        },
        homeButton: {
            backgroundColor: '#3B82F6',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            marginTop: 16,
        },
        homeButtonText: {
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
        },
        header: {
            alignItems: 'center',
            marginBottom: 24,
        },
        logoContainer: {
            backgroundColor: '#1E3A8A',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
        },
        logoText: {
            fontSize: 20,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: 1,
        },
        inviteCard: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 32,
            alignItems: 'center',
            marginBottom: 24,
        },
        inviteIconWrap: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        inviteTitle: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 8,
        },
        inviteSubtitle: {
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 16,
        },
        communityBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surfaceMuted,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
        },
        communityName: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
        },
        modeToggle: {
            flexDirection: 'row',
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            padding: 4,
            marginBottom: 24,
        },
        modeButton: {
            flex: 1,
            paddingVertical: 12,
            alignItems: 'center',
            borderRadius: 10,
        },
        modeButtonActive: {
            backgroundColor: colors.surface,
        },
        modeButtonText: {
            fontSize: 15,
            fontWeight: '500',
            color: colors.textMuted,
        },
        modeButtonTextActive: {
            color: colors.text,
            fontWeight: '600',
        },
        form: {
            width: '100%',
            maxWidth: 400,
        },
        nameRow: {
            flexDirection: 'row',
            gap: 12,
        },
        nameField: {
            flex: 1,
        },
        label: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
            marginTop: 16,
        },
        input: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.text,
        },
        errorBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#FEE2E2',
            borderRadius: 12,
            padding: 14,
            marginTop: 16,
        },
        errorBannerText: {
            flex: 1,
            fontSize: 14,
            color: '#991B1B',
        },
        submitButton: {
            backgroundColor: '#3B82F6',
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 24,
        },
        submitButtonDisabled: {
            opacity: 0.7,
        },
        submitButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        footerText: {
            fontSize: 12,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 24,
            maxWidth: 400,
        },
    });
