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

export default function AccountSetupScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);
    const params = useLocalSearchParams<{
        serverCode: string;
        subgridId: string;
        subgridName: string;
    }>();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Parse first and last name from full name
    const parseFullName = (name: string) => {
        const parts = name.trim().split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        return { firstName, lastName };
    };

    const handleNext = async () => {
        // Validate fields
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

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError('Please enter a valid email address');
            return;
        }

        // Validate username format (alphanumeric, no spaces)
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

            // Navigate to OTP verification screen
            router.push({
                pathname: '/member-signup/verify-otp',
                params: {
                    serverCode: params.serverCode,
                    subgridId: params.subgridId,
                    subgridName: params.subgridName,
                    firstName,
                    lastName,
                    email: email.trim().toLowerCase(),
                    username: username.trim().toLowerCase(),
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
                        <Text style={styles.title}>How Would You Like to be addressed?</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Enter Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Michael John"
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
                                style={styles.input}
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
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Username</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="@michaelj34"
                                placeholderTextColor={colors.textSubtle}
                                value={username.startsWith('@') ? username : username ? `@${username}` : ''}
                                onChangeText={(text) => {
                                    // Remove @ if user types it
                                    const cleaned = text.replace(/^@/, '').toLowerCase();
                                    setUsername(cleaned);
                                    setError('');
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
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
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 32,
        },
        title: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.text,
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
