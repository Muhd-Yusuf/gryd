import React, { useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Sun, Moon } from 'lucide-react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { useTheme } from '../lib/theme';
import { GlassButton, GlassInput } from '../components/glass';

const ForgotPasswordScreen = () => {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
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
            {/* Theme Toggle */}
            <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                {mode === 'dark' ? (
                    <Sun size={20} color={colors.textMuted} />
                ) : (
                    <Moon size={20} color={colors.textMuted} />
                )}
            </TouchableOpacity>

            <View style={styles.formContainer}>
                <GlassInput
                    label="Email address"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    icon={<Mail size={18} color={colors.textSubtle} />}
                />

                <GlassButton
                    label="Send code"
                    onPress={handleSendCode}
                    variant="primary"
                    fullWidth
                />

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
    themeToggle: {
        position: 'absolute',
        top: 0,
        right: 0,
        padding: 8,
        zIndex: 10,
    },
    formContainer: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        gap: 24,
    },
    loginRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 8,
    },
    loginText: {
        color: colors.textMuted,
        fontSize: 14,
    },
    loginLink: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
});

export default ForgotPasswordScreen;
