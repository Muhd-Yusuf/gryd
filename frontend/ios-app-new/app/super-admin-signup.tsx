import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck, Lock, AlertCircle, Sun, Moon } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { authSignupSuperAdmin, setAuthUser } from '../lib/api';
import { GlassButton, GlassInput } from '../components/glass';

export default function SuperAdminSignupScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [secretKey, setSecretKey] = useState('');

    const handleSignup = async () => {
        setError('');

        // Validation
        if (!firstName.trim() || !lastName.trim()) {
            setError('First and last name are required');
            return;
        }
        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!password || password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Password must contain uppercase, lowercase, and a number');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (!secretKey.trim()) {
            setError('Secret key is required');
            return;
        }

        setLoading(true);
        try {
            const { token, user, redirectTo } = await authSignupSuperAdmin({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
                password,
                secretKey: secretKey.trim(),
            });
            await setAuthUser(token, user);
            router.replace(redirectTo as any);
        } catch (err: any) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

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
                            onPress={() => router.replace('/login')}
                        >
                            <ArrowLeft size={24} color={colors.text} />
                        </TouchableOpacity>

                        {/* Logo */}
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoText}>THE GRYD</Text>
                        </View>

                        {/* Theme Toggle */}
                        <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                            {mode === 'dark' ? (
                                <Sun size={20} color={colors.textMuted} />
                            ) : (
                                <Moon size={20} color={colors.textMuted} />
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.formCard}>
                        <View style={styles.iconContainer}>
                            <ShieldCheck size={48} color={colors.primary} />
                        </View>

                        <Text style={styles.formTitle}>Super Admin Signup</Text>
                        <Text style={styles.formSubtitle}>
                            Create a super admin account to manage the platform
                        </Text>

                        {/* Name Row */}
                        <View style={styles.nameRow}>
                            <View style={styles.nameField}>
                                <GlassInput
                                    label="First Name"
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    placeholder="John"
                                    autoCapitalize="words"
                                />
                            </View>
                            <View style={styles.nameField}>
                                <GlassInput
                                    label="Last Name"
                                    value={lastName}
                                    onChangeText={setLastName}
                                    placeholder="Doe"
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        <GlassInput
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="admin@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            containerStyle={styles.inputSpacing}
                        />

                        <GlassInput
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Create a password"
                            secureTextEntry
                            containerStyle={styles.inputSpacing}
                        />

                        <GlassInput
                            label="Confirm Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm your password"
                            secureTextEntry
                            containerStyle={styles.inputSpacing}
                        />

                        <View style={styles.secretKeySection}>
                            <GlassInput
                                label="Secret Key"
                                value={secretKey}
                                onChangeText={setSecretKey}
                                placeholder="Enter the super admin secret key"
                                secureTextEntry
                                containerStyle={styles.secretKeyInputContainer}
                            />
                            <View style={styles.secretKeyHint}>
                                <Lock size={14} color={colors.textMuted} />
                                <Text style={styles.secretKeyHintText}>
                                    Contact your system administrator for the secret key
                                </Text>
                            </View>
                        </View>

                        {!!error && (
                            <View style={styles.errorBanner}>
                                <AlertCircle size={18} color={colors.error} />
                                <Text style={styles.errorBannerText}>{error}</Text>
                            </View>
                        )}

                        <GlassButton
                            label="Create Super Admin Account"
                            onPress={handleSignup}
                            loading={loading}
                            variant="primary"
                            fullWidth
                            style={styles.submitButton}
                        />

                        <View style={styles.loginInfo}>
                            <Text style={styles.loginInfoText}>
                                Already have an account?{' '}
                                <Text
                                    style={styles.linkText}
                                    onPress={() => router.replace('/login')}
                                >
                                    Login here
                                </Text>
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
            backgroundColor: 'transparent',
        },
        keyboardView: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            padding: 24,
            alignItems: 'center',
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
        themeToggle: {
            position: 'absolute',
            right: 0,
            padding: 8,
        },
        logoContainer: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
        },
        logoText: {
            fontSize: 20,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: 1,
        },
        formCard: {
            width: '100%',
            maxWidth: 440,
            backgroundColor: colors.glassBg,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 32,
        },
        iconContainer: {
            alignItems: 'center',
            marginBottom: 16,
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
        nameRow: {
            flexDirection: 'row',
            gap: 12,
        },
        nameField: {
            flex: 1,
        },
        inputSpacing: {
            marginTop: 16,
        },
        secretKeySection: {
            marginTop: 24,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        secretKeyInputContainer: {
            // amber-tinted border via glassBorder override — keep subtle
        },
        secretKeyHint: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
        },
        secretKeyHintText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        errorBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.dangerBg,
            borderRadius: 12,
            padding: 14,
            marginTop: 16,
        },
        errorBannerText: {
            flex: 1,
            fontSize: 14,
            color: colors.dangerText,
        },
        submitButton: {
            marginTop: 24,
        },
        loginInfo: {
            marginTop: 20,
            alignItems: 'center',
        },
        loginInfoText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        linkText: {
            color: colors.primary,
            fontWeight: '600',
        },
    });
