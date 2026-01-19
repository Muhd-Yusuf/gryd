import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { authLoginWithRole, setAuthUser, validateInviteCode, authSignupWithCode } from '../lib/api';

export default function WelcomeScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const [mode, setMode] = useState<'welcome' | 'login' | 'join'>('welcome');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Login form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Join with code form fields
    const [inviteCode, setInviteCode] = useState('');
    const [communityInfo, setCommunityInfo] = useState<{ subgridName: string; clientName?: string } | null>(null);
    const [codeValidated, setCodeValidated] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleValidateCode = async () => {
        setError('');
        if (!inviteCode.trim() || inviteCode.trim().length < 4) {
            setError('Please enter a valid invite code');
            return;
        }

        setLoading(true);
        try {
            const info = await validateInviteCode(inviteCode.trim().toUpperCase());
            setCommunityInfo({ subgridName: info.subgridName, clientName: info.clientName });
            setCodeValidated(true);
        } catch (err: any) {
            setError(err.message || 'Invalid invite code');
        } finally {
            setLoading(false);
        }
    };

    const handleSignupWithCode = async () => {
        setError('');
        if (!firstName.trim() || !lastName.trim()) {
            setError('First and last name are required');
            return;
        }
        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { token, user, message } = await authSignupWithCode({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
                password,
                inviteCode: inviteCode.trim().toUpperCase(),
            });
            await setAuthUser(token, user);
            Alert.alert('Welcome!', message, [
                { text: 'Continue', onPress: () => router.replace('/(main)') }
            ]);
        } catch (err: any) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        setError('');
        if (!email.trim() || !password) {
            setError('Email and password are required');
            return;
        }

        setLoading(true);
        try {
            const { token, user, redirectTo } = await authLoginWithRole({
                email: email.trim().toLowerCase(),
                password,
            });
            await setAuthUser(token, user);

            // Route based on user role
            router.replace(redirectTo as any);
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'welcome') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.welcomeContent}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoText}>THE GRYD</Text>
                    </View>

                    <Text style={styles.welcomeTitle}>Welcome to The GRYD</Text>
                    <Text style={styles.welcomeSubtitle}>
                        Connect, collaborate, and grow with your credit union community
                    </Text>

                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => setMode('login')}
                        >
                            <Text style={styles.primaryButtonText}>Login</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => setMode('join')}
                        >
                            <Text style={styles.secondaryButtonText}>Join with Invite Code</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoBox}>
                        <MaterialIcons name="info-outline" size={20} color={colors.textMuted} />
                        <Text style={styles.infoText}>
                            New member? Ask your Credit Union for an invite code to create your account.
                        </Text>
                    </View>

                    <Text style={styles.footerText}>
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </Text>

                    <TouchableOpacity
                        style={styles.adminLink}
                        onPress={() => router.push('/super-admin-signup')}
                    >
                        <MaterialIcons name="admin-panel-settings" size={16} color={colors.textMuted} />
                        <Text style={styles.adminLinkText}>Super Admin Signup</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Join with invite code mode
    if (mode === 'join') {
        return (
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.header}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => {
                                    setMode('welcome');
                                    setCodeValidated(false);
                                    setCommunityInfo(null);
                                    setInviteCode('');
                                    setError('');
                                }}
                            >
                                <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <View style={styles.logoContainer}>
                                <Text style={styles.logoText}>THE GRYD</Text>
                            </View>
                        </View>

                        {!codeValidated ? (
                            <View style={styles.formCard}>
                                <Text style={styles.formTitle}>Join Your Credit Union</Text>
                                <Text style={styles.formSubtitle}>
                                    Enter the invite code provided by your Credit Union
                                </Text>

                                <Text style={styles.label}>Invite Code</Text>
                                <TextInput
                                    style={[styles.input, styles.codeInput]}
                                    placeholder="ABC123"
                                    placeholderTextColor={colors.textSubtle}
                                    value={inviteCode}
                                    onChangeText={(text) => setInviteCode(text.toUpperCase())}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    maxLength={8}
                                />

                                {!!error && (
                                    <View style={styles.errorBanner}>
                                        <MaterialIcons name="error" size={18} color="#EF4444" />
                                        <Text style={styles.errorBannerText}>{error}</Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                                    onPress={handleValidateCode}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Verify Code</Text>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.signupInfo}>
                                    <MaterialIcons name="help-outline" size={16} color={colors.textMuted} />
                                    <Text style={styles.signupInfoText}>
                                        Already have an account? <Text style={styles.linkText} onPress={() => setMode('login')}>Login here</Text>
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.formCard}>
                                <View style={styles.communityBadge}>
                                    <MaterialIcons name="business" size={24} color="#3B82F6" />
                                    <Text style={styles.communityName}>{communityInfo?.subgridName}</Text>
                                </View>

                                <Text style={styles.formTitle}>Create Your Account</Text>
                                <Text style={styles.formSubtitle}>
                                    Join {communityInfo?.clientName || communityInfo?.subgridName}
                                </Text>

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
                                    placeholder="Create a password"
                                    placeholderTextColor={colors.textSubtle}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />

                                <Text style={styles.label}>Confirm Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm your password"
                                    placeholderTextColor={colors.textSubtle}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />

                                {!!error && (
                                    <View style={styles.errorBanner}>
                                        <MaterialIcons name="error" size={18} color="#EF4444" />
                                        <Text style={styles.errorBannerText}>{error}</Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                                    onPress={handleSignupWithCode}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Create Account & Join</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
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
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => setMode('welcome')}
                        >
                            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoText}>THE GRYD</Text>
                        </View>
                    </View>

                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Welcome Back</Text>
                        <Text style={styles.formSubtitle}>
                            Sign in to access your credit union community
                        </Text>

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
                            placeholder="Enter your password"
                            placeholderTextColor={colors.textSubtle}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            onSubmitEditing={handleLogin}
                        />

                        {!!error && (
                            <View style={styles.errorBanner}>
                                <MaterialIcons name="error" size={18} color="#EF4444" />
                                <Text style={styles.errorBannerText}>{error}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>Login</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.signupInfo}>
                            <MaterialIcons name="help-outline" size={16} color={colors.textMuted} />
                            <Text style={styles.signupInfoText}>
                                Don't have an account? Contact your Credit Union admin to receive an invite link.
                            </Text>
                        </View>
                    </View>
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
        welcomeContent: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        header: {
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            position: 'relative',
        },
        backButton: {
            position: 'absolute',
            left: 0,
            padding: 8,
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
        welcomeTitle: {
            fontSize: 32,
            fontWeight: '700',
            color: colors.text,
            marginTop: 32,
            marginBottom: 12,
            textAlign: 'center',
        },
        welcomeSubtitle: {
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
            maxWidth: 300,
            marginBottom: 48,
        },
        buttonGroup: {
            width: '100%',
            maxWidth: 320,
            gap: 16,
        },
        primaryButton: {
            backgroundColor: '#3B82F6',
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
        },
        primaryButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        secondaryButton: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
        },
        secondaryButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        infoBox: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            padding: 16,
            marginTop: 32,
            maxWidth: 360,
        },
        infoText: {
            flex: 1,
            fontSize: 14,
            color: colors.textMuted,
            lineHeight: 20,
        },
        footerText: {
            fontSize: 12,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 32,
            maxWidth: 300,
        },
        formCard: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 32,
        },
        formTitle: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 8,
        },
        formSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 24,
        },
        label: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
            marginTop: 16,
        },
        input: {
            backgroundColor: colors.appBg,
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
        signupInfo: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            marginTop: 24,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        signupInfoText: {
            flex: 1,
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
        },
        linkText: {
            color: '#3B82F6',
            fontWeight: '600',
        },
        codeInput: {
            textAlign: 'center',
            fontSize: 24,
            fontWeight: '700',
            letterSpacing: 8,
        },
        communityBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.surfaceMuted,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            marginBottom: 16,
        },
        communityName: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
        },
        nameRow: {
            flexDirection: 'row',
            gap: 12,
        },
        nameField: {
            flex: 1,
        },
        adminLink: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 24,
            paddingVertical: 8,
        },
        adminLinkText: {
            fontSize: 13,
            color: colors.textMuted,
        },
    });
