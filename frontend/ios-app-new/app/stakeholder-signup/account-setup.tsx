import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon } from 'lucide-react-native';
import { authSendOtp } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function StakeholderAccountSetupScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        token: string;
        email: string;
        subgridId: string;
        subgridName: string;
        stakeholderBadge: string;
    }>();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState(params.email || '');
    const [username, setUsername] = useState('');
    const [company, setCompany] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const parseFullName = (name: string) => {
        const parts = name.trim().split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        return { firstName, lastName };
    };

    const handleNext = async () => {
        if (!fullName.trim()) {
            setError('Please enter your full name');
            return;
        }
        if (!email.trim()) {
            setError('Please enter your email');
            return;
        }
        if (!username.trim()) {
            setError('Please enter a username');
            return;
        }
        if (!company.trim()) {
            setError('Please enter your company name');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError('Please enter a valid email address');
            return;
        }

        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username.trim())) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const { firstName, lastName } = parseFullName(fullName);

            // Send OTP to email
            await authSendOtp({ email: email.trim().toLowerCase() });

            router.push({
                pathname: '/stakeholder-signup/verify-otp',
                params: {
                    token: params.token,
                    email: email.trim().toLowerCase(),
                    firstName,
                    lastName,
                    username: username.trim().toLowerCase(),
                    company: company.trim(),
                    subgridId: params.subgridId,
                    subgridName: params.subgridName,
                    stakeholderBadge: params.stakeholderBadge,
                },
            });
        } catch (err: any) {
            setError(err.message || 'Failed to send verification code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                {/* Step indicator */}
                <View style={styles.stepIndicator}>
                    <View style={[styles.step, styles.stepActive]} />
                    <View style={styles.stepLine} />
                    <View style={styles.step} />
                    <View style={styles.stepLine} />
                    <View style={styles.step} />
                    <View style={styles.stepLine} />
                    <View style={styles.step} />
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

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.card}>
                        <Text style={styles.title}>Add your name</Text>
                        <Text style={styles.subtitle}>How will you like to be addressed?</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Michael Jones"
                                placeholderTextColor={colors.textSubtle}
                                value={fullName}
                                onChangeText={(text) => {
                                    setFullName(text);
                                    setError('');
                                }}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={[styles.input, params.email ? styles.inputDisabled : null]}
                                placeholder="michael@example.com"
                                placeholderTextColor={colors.textSubtle}
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    setError('');
                                }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!params.email}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Username</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="@username"
                                placeholderTextColor={colors.textSubtle}
                                value={username.startsWith('@') ? username : username ? `@${username}` : ''}
                                onChangeText={(text) => {
                                    const cleaned = text.replace(/^@/, '').toLowerCase();
                                    setUsername(cleaned);
                                    setError('');
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Company</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. UBA Bank"
                                placeholderTextColor={colors.textSubtle}
                                value={company}
                                onChangeText={(text) => {
                                    setCompany(text);
                                    setError('');
                                }}
                                autoCapitalize="words"
                            />
                        </View>

                        {!!error && (
                            <Text style={styles.errorText}>{error}</Text>
                        )}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleNext}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={styles.buttonText}>Next (Step 1/2)</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        stepLine: {
            width: 20,
            height: 2,
            backgroundColor: colors.border,
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
        keyboardView: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        card: {
            width: '100%',
            maxWidth: 450,
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
            marginBottom: 24,
        },
        inputGroup: {
            marginBottom: 20,
        },
        label: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
        },
        input: {
            backgroundColor: colors.appBg,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 16,
            fontSize: 16,
            color: colors.text,
        },
        inputDisabled: {
            backgroundColor: colors.border,
            color: colors.textMuted,
        },
        errorText: {
            color: colors.error,
            fontSize: 14,
            marginBottom: 16,
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 30,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 8,
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        buttonText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },
    });
