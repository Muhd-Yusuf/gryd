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
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { authSignupSuperAdmin, setAuthUser } from '../lib/api';

export default function SuperAdminSignupScreen() {
    const router = useRouter();
    const { colors } = useTheme();
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
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters');
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
                            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoText}>THE GRYD</Text>
                        </View>
                    </View>

                    <View style={styles.formCard}>
                        <View style={styles.iconContainer}>
                            <MaterialIcons name="admin-panel-settings" size={48} color="#3B82F6" />
                        </View>

                        <Text style={styles.formTitle}>Super Admin Signup</Text>
                        <Text style={styles.formSubtitle}>
                            Create a super admin account to manage the platform
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
                            placeholder="admin@example.com"
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

                        <View style={styles.secretKeySection}>
                            <Text style={styles.label}>Secret Key</Text>
                            <TextInput
                                style={[styles.input, styles.secretKeyInput]}
                                placeholder="Enter the super admin secret key"
                                placeholderTextColor={colors.textSubtle}
                                value={secretKey}
                                onChangeText={setSecretKey}
                                secureTextEntry
                            />
                            <View style={styles.secretKeyHint}>
                                <MaterialIcons name="lock" size={14} color={colors.textMuted} />
                                <Text style={styles.secretKeyHintText}>
                                    Contact your system administrator for the secret key
                                </Text>
                            </View>
                        </View>

                        {!!error && (
                            <View style={styles.errorBanner}>
                                <MaterialIcons name="error" size={18} color="#EF4444" />
                                <Text style={styles.errorBannerText}>{error}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleSignup}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>Create Super Admin Account</Text>
                            )}
                        </TouchableOpacity>

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
        formCard: {
            width: '100%',
            maxWidth: 440,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
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
        nameRow: {
            flexDirection: 'row',
            gap: 12,
        },
        nameField: {
            flex: 1,
        },
        secretKeySection: {
            marginTop: 8,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        secretKeyInput: {
            borderColor: '#F59E0B',
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
        loginInfo: {
            marginTop: 20,
            alignItems: 'center',
        },
        loginInfoText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        linkText: {
            color: '#3B82F6',
            fontWeight: '600',
        },
    });
