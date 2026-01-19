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
import { Lock, Eye, EyeOff } from 'lucide-react-native';
import OnboardingLayout from '../components/OnboardingLayout';
import { useTheme } from '../lib/theme';

const ResetPasswordScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();
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
            <View style={styles.formContainer}>
                {/* OTP Input - Simplified for demo */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Verification Code</Text>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={[styles.input, { letterSpacing: 4, fontWeight: 'bold' }]}
                            placeholder="0000"
                            placeholderTextColor={colors.textSubtle}
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                            maxLength={4}
                        />
                    </View>
                </View>

                {/* New Password */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>New password</Text>
                    <View style={styles.inputWrapper}>
                        <Lock size={20} color={colors.textSubtle} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter new password"
                            placeholderTextColor={colors.textSubtle}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            {showPassword ? (
                                <EyeOff size={20} color={colors.textSubtle} />
                            ) : (
                                <Eye size={20} color={colors.textSubtle} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm password</Text>
                    <View style={styles.inputWrapper}>
                        <Lock size={20} color={colors.textSubtle} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm new password"
                            placeholderTextColor={colors.textSubtle}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showPassword}
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleReset}>
                    <Text style={styles.submitBtnText}>Reset password</Text>
                </TouchableOpacity>
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
        gap: 20,
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
        marginTop: 12,
    },
    submitBtnText: {
        color: colors.primaryText,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ResetPasswordScreen;
