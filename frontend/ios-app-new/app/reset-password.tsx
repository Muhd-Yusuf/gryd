import React, { useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Eye, EyeOff, Sun, Moon } from 'lucide-react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { useTheme } from '../lib/theme';
import { GlassButton, GlassInput } from '../components/glass';

const ResetPasswordScreen = () => {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleReset = () => {
        if (!otp || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        // Mock Success
        Alert.alert('Success', 'Password reset successfully!');
        router.push('/login');
    };

    return (
        <OnboardingLayout
            title="Reset password"
            subtitle="Please enter the 4-digit code sent to your email and set a new password."
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
                {/* OTP Input */}
                <GlassInput
                    label="Verification Code"
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="0000"
                    keyboardType="number-pad"
                    maxLength={4}
                    inputStyle={{ letterSpacing: 4, fontWeight: 'bold' } as any}
                />

                {/* New Password */}
                <GlassInput
                    label="New password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter new password"
                    secureTextEntry={!showPassword}
                    icon={<Lock size={18} color={colors.textSubtle} />}
                    iconRight={
                        showPassword
                            ? <EyeOff size={18} color={colors.textSubtle} />
                            : <Eye size={18} color={colors.textSubtle} />
                    }
                    onIconRightPress={() => setShowPassword(!showPassword)}
                />

                {/* Confirm Password */}
                <GlassInput
                    label="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    secureTextEntry={!showPassword}
                    icon={<Lock size={18} color={colors.textSubtle} />}
                />

                <GlassButton
                    label="Reset password"
                    onPress={handleReset}
                    variant="primary"
                    fullWidth
                />
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
        gap: 20,
    },
});

export default ResetPasswordScreen;
