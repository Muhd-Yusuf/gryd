import React, { useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { useTheme } from '../lib/theme';

const ForgotPasswordScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [email, setEmail] = useState('');

    const handleSendCode = () => {
        // Mock API call
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }
        // Redirect to Reset Password (OTP) page
        router.push('/reset-password');
    };

    return (
        <OnboardingLayout
            title="Forgot password?"
            subtitle="Don't worry! It happens. Please enter the email associated with your account."
            showBack
            onBack={() => router.back()}
        >
            <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email address</Text>
                    <View style={styles.inputWrapper}>
                        <Mail size={20} color={colors.textSubtle} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor={colors.textSubtle}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleSendCode}>
                    <Text style={styles.submitBtnText}>Send code</Text>
                </TouchableOpacity>

                <View style={styles.loginRow}>
                    <Text style={styles.loginText}>Remember password? </Text>
                    <TouchableOpacity onPress={() => router.push('/login')}>
                        <Text style={styles.loginLink}>Log in</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </OnboardingLayout>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
    formContainer: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        backgroundColor: colors.surfaceMuted,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
        height: '100%',
    },
    submitBtn: {
        backgroundColor: colors.primary,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    submitBtnText: {
        color: colors.primaryText,
        fontSize: 16,
        fontWeight: '600',
    },
    loginRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
    },
    loginText: {
        color: colors.textMuted,
        fontSize: 14,
    },
    loginLink: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
    },
});

export default ForgotPasswordScreen;
