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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon } from 'lucide-react-native';
import { authVerifyOtp, authSendOtp } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function VerifyOtpScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);
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
                <View style={styles.content}>
                    <View style={styles.card}>
                        <Text style={styles.title}>Verify Your Email</Text>
                        <Text style={styles.subtitle}>
                            We sent a 6-digit code to{'\n'}
                            <Text style={styles.emailText}>{params.email}</Text>
                        </Text>

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

                        {!!error && (
                            <Text style={styles.errorText}>{error}</Text>
                        )}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={() => handleVerify()}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={styles.buttonText}>Verify Code</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.resendContainer}>
                            <Text style={styles.resendText}>Didn't receive the code? </Text>
                            {canResend ? (
                                <TouchableOpacity onPress={handleResend} disabled={resending}>
                                    <Text style={styles.resendLink}>
                                        {resending ? 'Sending...' : 'Resend'}
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.countdownText}>
                                    Resend in {countdown}s
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
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
        content: {
            flex: 1,
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
            alignItems: 'center',
        },
        title: {
            fontSize: 22,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 12,
            textAlign: 'center',
        },
        subtitle: {
            fontSize: 15,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: 22,
        },
        emailText: {
            fontWeight: '600',
            color: colors.text,
        },
        otpContainer: {
            flexDirection: 'row',
            gap: 10,
            marginBottom: 24,
        },
        otpInput: {
            width: 48,
            height: 56,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.appBg,
            fontSize: 24,
            fontWeight: '600',
            textAlign: 'center',
            color: colors.text,
        },
        otpInputFilled: {
            borderColor: colors.primary,
            backgroundColor: colors.surface,
        },
        otpInputError: {
            borderColor: colors.error,
        },
        errorText: {
            color: colors.error,
            fontSize: 14,
            marginBottom: 16,
            textAlign: 'center',
        },
        button: {
            width: '100%',
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
        resendContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 24,
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
    });
