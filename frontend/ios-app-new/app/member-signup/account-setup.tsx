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
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon, ArrowLeft } from 'lucide-react-native';
import { authSendOtp } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function AccountSetupScreen() {
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
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

    const handleBack = () => {
        router.back();
    };

    // Shared form content
    const renderFormInputs = (styles: any) => (
        <>
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
        </>
    );

    // Mobile view
    if (isMobileView) {
        return (
            <SafeAreaView style={mobileStyles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={mobileStyles.container}
                >
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
                            <Text style={mobileStyles.title}>How Would You Like to be addressed?</Text>
                            <Text style={mobileStyles.subtitle}>
                                Set up your profile to get started with {params.subgridName || 'the community'}
                            </Text>
                        </View>

                        <View style={mobileStyles.form}>
                            {renderFormInputs(mobileStyles)}

                            {!!error && (
                                <Text style={mobileStyles.errorText}>{error}</Text>
                            )}

                            <TouchableOpacity
                                style={[mobileStyles.submitButton, loading && mobileStyles.buttonDisabled]}
                                onPress={handleNext}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={mobileStyles.submitButtonText}>Next (Step 1/2)</Text>
                                )}
                            </TouchableOpacity>
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
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // Web view
    return (
        <SafeAreaView style={webStyles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={webStyles.container}
            >
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
                            <Text style={webStyles.title}>How Would You Like to be addressed?</Text>
                            <Text style={webStyles.subtitle}>
                                Set up your profile for {params.subgridName || 'the community'}
                            </Text>

                            {!!error && <Text style={webStyles.errorText}>{error}</Text>}

                            {renderFormInputs(webStyles)}

                            <TouchableOpacity
                                style={[webStyles.button, loading && webStyles.buttonDisabled]}
                                onPress={handleNext}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={webStyles.buttonText}>Next (Step 1/2)</Text>
                                )}
                            </TouchableOpacity>

                            <View style={webStyles.signupContainer}>
                                <Text style={webStyles.signupText}>Already have an account? </Text>
                                <TouchableOpacity onPress={() => router.push('/login')}>
                                    <Text style={webStyles.signupLink}>Login</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
            maxWidth: 360,
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
        inputGroup: {
            marginBottom: 16,
        },
        label: {
            fontSize: 12,
            fontFamily: 'Inter_600SemiBold',
            color: colors.text,
            marginBottom: 8,
        },
        input: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            height: 40,
            paddingHorizontal: 12,
            fontSize: 12,
            fontFamily: 'Inter_400Regular',
            color: colors.text,
            outlineStyle: 'none',
        },
        errorText: {
            color: '#DC2626',
            fontSize: 11,
            fontFamily: 'Inter_500Medium',
            marginBottom: 12,
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 10,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        buttonText: {
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
        inputGroup: {
            gap: 8,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        input: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            height: 56,
            paddingHorizontal: 16,
            fontSize: 16,
            color: colors.text,
        },
        errorText: {
            color: colors.error,
            fontSize: 14,
            textAlign: 'center',
        },
        submitButton: {
            backgroundColor: colors.primary,
            borderRadius: 30,
            height: 56,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 10,
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        submitButtonText: {
            color: colors.primaryText,
            fontSize: 18,
            fontWeight: 'bold',
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
    });
