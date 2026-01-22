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
import { authLoginOtpVerify, authLoginOtpRequest, setAuthUser } from '../../lib/api';

export default function StakeholderVerifyOtpScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        email: string;
    }>();

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [countdown]);

    const handleOtpChange = (value: string, index: number) => {
        const numericValue = value.replace(/[^0-9]/g, '');

        if (numericValue.length <= 1) {
            const newOtp = [...otp];
            newOtp[index] = numericValue;
            setOtp(newOtp);
            setError('');

            if (numericValue && index < 5) {
                inputRefs.current[index + 1]?.focus();
            }

            if (numericValue && index === 5) {
                const fullOtp = newOtp.join('');
                if (fullOtp.length === 6) {
                    handleVerify(fullOtp);
                }
            }
        } else if (numericValue.length === 6) {
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
            const result = await authLoginOtpVerify({
                email: params.email,
                otp: code,
            });

            // Store auth data
            await setAuthUser(result.token, result.user);

            // Navigate to welcome screen with user info
            router.push({
                pathname: '/stakeholder-login/welcome',
                params: {
                    userId: result.user.id,
                    firstName: result.user.firstName || '',
                    lastName: result.user.lastName || '',
                    email: result.user.email,
                    stakeholderBadge: result.user.stakeholderBadge || '',
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
            await authLoginOtpRequest({ email: params.email });
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
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                {/* Step indicator - step 2 of 3 */}
                <View style={styles.stepIndicator}>
                    <View style={[styles.step, styles.stepCompleted]} />
                    <View style={[styles.stepLine, styles.stepLineCompleted]} />
                    <View style={[styles.step, styles.stepActive]} />
                    <View style={styles.stepLine} />
                    <View style={styles.step} />
                </View>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.replace('/login')}
                >
                    <Text style={styles.backText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.card}>
                        {/* Back Button */}
                        <TouchableOpacity
                            style={styles.cardBackButton}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.cardBackText}>← Back</Text>
                        </TouchableOpacity>

                        <Text style={styles.title}>Enter OTP</Text>
                        <Text style={styles.subtitle}>
                            Enter the security code sent to{'\n'}
                            <Text style={styles.emailText}>{params.email}</Text> to proceed
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

                        <View style={styles.resendContainer}>
                            <Text style={styles.resendText}>Didn't get the code? </Text>
                            {canResend ? (
                                <TouchableOpacity onPress={handleResend} disabled={resending}>
                                    <Text style={styles.resendLink}>
                                        {resending ? 'Sending...' : 'Resend code'}
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.countdownText}>
                                    Resend in {countdown}s
                                </Text>
                            )}
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
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Verify</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1F2937',
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
        color: '#FFFFFF',
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
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    stepActive: {
        backgroundColor: '#3B82F6',
    },
    stepCompleted: {
        backgroundColor: '#22C55E',
    },
    stepLine: {
        width: 20,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    stepLineCompleted: {
        backgroundColor: '#22C55E',
    },
    backButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    backText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
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
        maxWidth: 450,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 32,
    },
    cardBackButton: {
        marginBottom: 16,
    },
    cardBackText: {
        color: '#6B7280',
        fontSize: 14,
    },
    title: {
        fontSize: 22,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        marginBottom: 32,
        lineHeight: 22,
    },
    emailText: {
        fontWeight: '600',
        color: '#111827',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 24,
    },
    otpInput: {
        width: 48,
        height: 56,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        fontSize: 24,
        fontWeight: '600',
        textAlign: 'center',
        color: '#111827',
    },
    otpInputFilled: {
        borderColor: '#3B82F6',
        backgroundColor: '#FFFFFF',
    },
    otpInputError: {
        borderColor: '#EF4444',
    },
    resendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    resendText: {
        fontSize: 14,
        color: '#6B7280',
    },
    resendLink: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
    },
    countdownText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#3B82F6',
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
