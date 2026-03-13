import React, { useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Sun, Moon } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../lib/theme';
import { authLoginOtpRequest, authLoginOtpVerify, setAuthUser } from '../lib/api';

type LoginStep = 'email' | 'otp';

const LoginScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams<{ email?: string; team?: string }>();
    const { colors, mode, toggleTheme } = useTheme();
    const mobileStyles = createMobileStyles(colors);
    const { width } = useWindowDimensions();
    const webStyles = createWebStyles(colors);
    const isWeb = Platform.OS === 'web';
    // Show mobile view for native apps OR when screen width is below 768px (mobile responsive)
    const isMobileView = !isWeb || width < 768;

    const [step, setStep] = useState<LoginStep>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [isTeamInvite, setIsTeamInvite] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);

    // Prefill email from URL params (for team member invites)
    useEffect(() => {
        if (params.email) {
            setEmail(decodeURIComponent(params.email));
        }
        if (params.team === 'true') {
            setIsTeamInvite(true);
        }
    }, [params.email, params.team]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendOtp = async () => {
        if (!email.trim()) {
            setError('Please enter your email');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(email.trim())) {
            setError('Please enter a valid email address');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await authLoginOtpRequest({ email: email.trim().toLowerCase() });
            setStep('otp');
            setCountdown(60);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        } catch (err: any) {
            setError(err.message || 'Failed to send verification code');
        } finally {
            setLoading(false);
        }
    };

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
                    handleVerifyOtp(fullOtp);
                }
            }
        } else if (numericValue.length === 6) {
            const digits = numericValue.split('');
            setOtp(digits);
            inputRefs.current[5]?.focus();
            handleVerifyOtp(numericValue);
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async (otpCode?: string) => {
        const code = otpCode || otp.join('');

        if (code.length !== 6) {
            setError('Please enter the complete 6-digit code');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const result = await authLoginOtpVerify({
                email: email.trim().toLowerCase(),
                otp: code,
            });

            if (!result?.token) {
                throw new Error('Authentication failed. Please try again.');
            }

            await setAuthUser(result.token, result.user);

            // Verify auth was persisted before redirecting
            const { getAuthUser, getAuthToken } = await import('../lib/api');
            const savedUser = await getAuthUser();
            if (!savedUser?.userId || !getAuthToken()) {
                throw new Error('Failed to save authentication. Please try again.');
            }

            router.replace(result.redirectTo as any);
        } catch (err: any) {
            setError(err.message || 'Invalid verification code');
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (countdown > 0) return;

        setLoading(true);
        setError('');

        try {
            await authLoginOtpRequest({ email: email.trim().toLowerCase() });
            setCountdown(60);
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (err: any) {
            setError(err.message || 'Failed to resend code');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (step === 'otp') {
            setStep('email');
            setOtp(['', '', '', '', '', '']);
            setError('');
        } else {
            router.back();
        }
    };

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

                        {step === 'email' ? (
                            <>
                                <View style={mobileStyles.header}>
                                    <Text style={mobileStyles.title}>
                                        {isTeamInvite ? 'Welcome to the Team' : 'Login'}
                                    </Text>
                                    <Text style={mobileStyles.subtitle}>
                                        {isTeamInvite
                                            ? 'You\'ve been invited to join The GRYD team. Click below to receive your verification code.'
                                            : 'Enter your email address to receive a verification code'}
                                    </Text>
                                </View>

                                <View style={mobileStyles.form}>
                                    <View style={mobileStyles.inputGroup}>
                                        <Text style={mobileStyles.label}>Email</Text>
                                        <TextInput
                                            style={[mobileStyles.input, isTeamInvite && mobileStyles.inputReadOnly]}
                                            placeholder="john@example.com"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            value={email}
                                            onChangeText={(val) => {
                                                if (!isTeamInvite) {
                                                    setEmail(val);
                                                    setError('');
                                                }
                                            }}
                                            placeholderTextColor={colors.textSubtle}
                                            editable={!loading && !isTeamInvite}
                                        />
                                    </View>

                                    {!!error && (
                                        <Text style={mobileStyles.errorText}>{error}</Text>
                                    )}

                                    <TouchableOpacity
                                        style={[
                                            mobileStyles.submitButton,
                                            loading && mobileStyles.buttonDisabled,
                                        ]}
                                        onPress={handleSendOtp}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={colors.primaryText} />
                                        ) : (
                                            <Text style={mobileStyles.submitButtonText}>Send Code</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={mobileStyles.header}>
                                    <Text style={mobileStyles.title}>Verify Code</Text>
                                    <Text style={mobileStyles.subtitle}>
                                        We sent a 6-digit code to{'\n'}
                                        <Text style={mobileStyles.emailHighlight}>{email}</Text>
                                    </Text>
                                </View>

                                <View style={mobileStyles.form}>
                                    <View style={mobileStyles.otpContainer}>
                                        {otp.map((digit, index) => (
                                            <TextInput
                                                key={index}
                                                ref={(ref) => (inputRefs.current[index] = ref)}
                                                style={[
                                                    mobileStyles.otpInput,
                                                    digit && mobileStyles.otpInputFilled,
                                                    error && mobileStyles.otpInputError,
                                                ]}
                                                value={digit}
                                                onChangeText={(value) => handleOtpChange(value, index)}
                                                onKeyPress={(e) => handleKeyPress(e, index)}
                                                keyboardType="number-pad"
                                                maxLength={1}
                                                selectTextOnFocus
                                                editable={!loading}
                                            />
                                        ))}
                                    </View>

                                    {!!error && (
                                        <Text style={mobileStyles.errorText}>{error}</Text>
                                    )}

                                    <TouchableOpacity
                                        style={[
                                            mobileStyles.submitButton,
                                            loading && mobileStyles.buttonDisabled,
                                        ]}
                                        onPress={() => handleVerifyOtp()}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={colors.primaryText} />
                                        ) : (
                                            <Text style={mobileStyles.submitButtonText}>Verify & Login</Text>
                                        )}
                                    </TouchableOpacity>

                                    <View style={mobileStyles.resendContainer}>
                                        <Text style={mobileStyles.resendText}>
                                            Didn't receive the code?{' '}
                                        </Text>
                                        {countdown > 0 ? (
                                            <Text style={mobileStyles.countdownText}>
                                                Resend in {countdown}s
                                            </Text>
                                        ) : (
                                            <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                                                <Text style={mobileStyles.resendLink}>Resend</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </>
                        )}

                        <View style={mobileStyles.footer}>
                            <Text style={mobileStyles.footerText}>
                                New member?{' '}
                            </Text>
                            <TouchableOpacity onPress={() => router.push('/member-signup')}>
                                <Text style={mobileStyles.signupLink}>Join with invite code</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

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
                            {step === 'email' ? (
                                <>
                                    <Text style={webStyles.title}>
                                        {isTeamInvite ? 'Welcome to the Team' : 'Login'}
                                    </Text>
                                    <Text style={webStyles.subtitle}>
                                        {isTeamInvite
                                            ? 'You\'ve been invited to join The GRYD team. Click below to receive your verification code.'
                                            : 'Enter your email address'}
                                    </Text>

                                    {!!error && <Text style={webStyles.errorText}>{error}</Text>}

                                    <View style={webStyles.inputGroup}>
                                        <Text style={webStyles.label}>Email</Text>
                                        <TextInput
                                            style={[webStyles.input, isTeamInvite && webStyles.inputReadOnly]}
                                            placeholder="Enter your email address"
                                            placeholderTextColor={colors.textSubtle}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            value={email}
                                            onChangeText={(val) => {
                                                if (!isTeamInvite) {
                                                    setEmail(val);
                                                    setError('');
                                                }
                                            }}
                                            editable={!loading && !isTeamInvite}
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={[webStyles.button, loading && webStyles.buttonDisabled]}
                                        onPress={handleSendOtp}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={colors.primaryText} />
                                        ) : (
                                            <Text style={webStyles.buttonText}>Login</Text>
                                        )}
                                    </TouchableOpacity>

                                    <View style={webStyles.signupContainer}>
                                        <Text style={webStyles.signupText}>New member? </Text>
                                        <TouchableOpacity onPress={() => router.push('/member-signup')}>
                                            <Text style={webStyles.signupLink}>Join with invite code</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={webStyles.title}>Verify Code</Text>
                                    <Text style={webStyles.subtitle}>
                                        We sent a 6-digit code to{'\n'}
                                        <Text style={webStyles.emailHighlight}>{email}</Text>
                                    </Text>

                                    {!!error && <Text style={webStyles.errorText}>{error}</Text>}

                                    <View style={webStyles.otpContainer}>
                                        {otp.map((digit, index) => (
                                            <TextInput
                                                key={index}
                                                ref={(ref) => (inputRefs.current[index] = ref)}
                                                style={[
                                                    webStyles.otpInput,
                                                    digit && webStyles.otpInputFilled,
                                                    error && webStyles.otpInputError,
                                                ]}
                                                value={digit}
                                                onChangeText={(value) => handleOtpChange(value, index)}
                                                onKeyPress={(e) => handleKeyPress(e, index)}
                                                keyboardType="number-pad"
                                                maxLength={1}
                                                selectTextOnFocus
                                                editable={!loading}
                                            />
                                        ))}
                                    </View>

                                    <TouchableOpacity
                                        style={[webStyles.button, loading && webStyles.buttonDisabled]}
                                        onPress={() => handleVerifyOtp()}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={colors.primaryText} />
                                        ) : (
                                            <Text style={webStyles.buttonText}>Verify & Login</Text>
                                        )}
                                    </TouchableOpacity>

                                    <View style={webStyles.resendContainer}>
                                        <Text style={webStyles.resendText}>Didn't receive the code? </Text>
                                        {countdown > 0 ? (
                                            <Text style={webStyles.countdownText}>
                                                Resend in {countdown}s
                                            </Text>
                                        ) : (
                                            <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                                                <Text style={webStyles.resendLink}>Resend</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={webStyles.signupContainer}>
                                        <Text style={webStyles.signupText}>New member? </Text>
                                        <TouchableOpacity onPress={() => router.push('/member-signup')}>
                                            <Text style={webStyles.signupLink}>Join with invite code</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

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
        shellStacked: {
            flexDirection: 'column',
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
        leftPanelStacked: {
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 32,
            minHeight: 220,
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
        rightPanelStacked: {
            paddingTop: 32,
            borderLeftWidth: 0,
            borderTopWidth: 1,
            borderTopColor: colors.border,
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
        inputReadOnly: {
            backgroundColor: colors.surfaceMuted,
            color: colors.textMuted,
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
        inputReadOnly: {
            backgroundColor: colors.surfaceMuted,
            color: colors.textMuted,
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
        signupLink: {
            color: colors.primary,
            fontSize: 14,
            fontWeight: '600',
        },
    });

export default LoginScreen;
