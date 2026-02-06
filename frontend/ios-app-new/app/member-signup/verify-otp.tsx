import React, { useState, useRef, useEffect } from 'react';
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
import { authVerifyOtp, authSendOtp } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function VerifyOtpScreen() {
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
    }>();

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [countdown]);

    const handleOtpChange = (value: string, index: number) => {
        // Only allow numbers
        const numericValue = value.replace(/[^0-9]/g, '');

        if (numericValue.length <= 1) {
            const newOtp = [...otp];
            newOtp[index] = numericValue;
            setOtp(newOtp);
            setError('');

            // Auto-focus next input
            if (numericValue && index < 5) {
                inputRefs.current[index + 1]?.focus();
            }

            // Auto-verify when all digits are entered
            if (numericValue && index === 5) {
                const fullOtp = newOtp.join('');
                if (fullOtp.length === 6) {
                    handleVerify(fullOtp);
                }
            }
        } else if (numericValue.length === 6) {
            // Handle paste
            const digits = numericValue.split('');
            setOtp(digits);
            inputRefs.current[5]?.focus();
            handleVerify(numericValue);
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpCode?: string) => {
        const code = otpCode || otp.join('');

        if (code.length !== 6) {
            setError('Please enter the complete 6-digit code');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await authVerifyOtp({
                email: params.email,
                otp: code,
            });

            // Navigate to profile picture screen
            router.push({
                pathname: '/member-signup/profile-picture',
                params: {
                    serverCode: params.serverCode,
                    subgridId: params.subgridId,
                    subgridName: params.subgridName,
                    firstName: params.firstName,
                    lastName: params.lastName,
                    email: params.email,
                    username: params.username,
                    otpVerified: 'true',
                },
            });
        } catch (err: any) {
            setError(err.message || 'Invalid verification code');
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;

        setResending(true);
        setError('');

        try {
            await authSendOtp({ email: params.email });
            setCountdown(60);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (err: any) {
            setError(err.message || 'Failed to resend code');
        } finally {
            setResending(false);
        }
    };

    const handleBack = () => {
        router.back();
    };

    // Shared OTP inputs
    const renderOtpInputs = (styles: any) => (
        <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
                <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled,
                        error && styles.otpInputError,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    autoFocus={index === 0}
                />
            ))}
        </View>
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
                            <Text style={mobileStyles.title}>Verify Your Email</Text>
                            <Text style={mobileStyles.subtitle}>
                                We sent a 6-digit code to{'\n'}
                                <Text style={mobileStyles.emailHighlight}>{params.email}</Text>
                            </Text>
                        </View>

                        <View style={mobileStyles.form}>
                            {renderOtpInputs(mobileStyles)}

                            {!!error && (
                                <Text style={mobileStyles.errorText}>{error}</Text>
                            )}

                            <TouchableOpacity
                                style={[mobileStyles.submitButton, loading && mobileStyles.buttonDisabled]}
                                onPress={() => handleVerify()}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={mobileStyles.submitButtonText}>Verify Code</Text>
                                )}
                            </TouchableOpacity>

                            <View style={mobileStyles.resendContainer}>
                                <Text style={mobileStyles.resendText}>Didn't receive the code? </Text>
                                {canResend ? (
                                    <TouchableOpacity onPress={handleResend} disabled={resending}>
                                        <Text style={mobileStyles.resendLink}>
                                            {resending ? 'Sending...' : 'Resend'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={mobileStyles.countdownText}>
                                        Resend in {countdown}s
                                    </Text>
                                )}
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
                            <Text style={webStyles.title}>Verify Your Email</Text>
                            <Text style={webStyles.subtitle}>
                                We sent a 6-digit code to{'\n'}
                                <Text style={webStyles.emailHighlight}>{params.email}</Text>
                            </Text>

                            {!!error && <Text style={webStyles.errorText}>{error}</Text>}

                            {renderOtpInputs(webStyles)}

                            <TouchableOpacity
                                style={[webStyles.button, loading && webStyles.buttonDisabled]}
                                onPress={() => handleVerify()}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={webStyles.buttonText}>Verify Code</Text>
                                )}
                            </TouchableOpacity>

                            <View style={webStyles.resendContainer}>
                                <Text style={webStyles.resendText}>Didn't receive the code? </Text>
                                {canResend ? (
                                    <TouchableOpacity onPress={handleResend} disabled={resending}>
                                        <Text style={webStyles.resendLink}>
                                            {resending ? 'Sending...' : 'Resend'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={webStyles.countdownText}>
                                        Resend in {countdown}s
                                    </Text>
                                )}
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
        emailHighlight: {
            fontFamily: 'Inter_600SemiBold',
            color: colors.text,
        },
        otpContainer: {
            flexDirection: 'row',
            gap: 10,
            marginBottom: 18,
        },
        otpInput: {
            width: 36,
            height: 40,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.surface,
            fontSize: 12,
            fontFamily: 'Inter_600SemiBold',
            textAlign: 'center',
            color: colors.text,
        },
        otpInputFilled: {
            borderColor: colors.text,
        },
        otpInputError: {
            borderColor: '#DC2626',
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
        resendContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
        },
        resendText: {
            fontSize: 11,
            fontFamily: 'Inter_400Regular',
            color: colors.textMuted,
        },
        resendLink: {
            fontSize: 11,
            fontFamily: 'Inter_600SemiBold',
            color: colors.text,
        },
        countdownText: {
            fontSize: 11,
            fontFamily: 'Inter_400Regular',
            color: colors.textMuted,
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
        emailHighlight: {
            fontWeight: '600',
            color: colors.text,
        },
        form: {
            gap: 20,
        },
        otpContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 10,
        },
        otpInput: {
            width: 48,
            height: 56,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.surface,
            fontSize: 24,
            fontWeight: '600',
            textAlign: 'center',
            color: colors.text,
        },
        otpInputFilled: {
            borderColor: colors.primary,
            backgroundColor: colors.appBg,
        },
        otpInputError: {
            borderColor: colors.error,
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
        resendContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
        },
        resendText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        resendLink: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary,
        },
        countdownText: {
            fontSize: 14,
            color: colors.textSubtle,
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
