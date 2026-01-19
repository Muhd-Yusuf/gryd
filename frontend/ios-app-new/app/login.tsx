import React, { useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getAppHomePath } from '../lib/featureFlags';
import { useTheme } from '../lib/theme';

const LoginScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = () => {
        // Port logical flow: navigate to dashboard regardless of backend for now
        router.replace(getAppHomePath());
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <ArrowLeft color={colors.text} size={24} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Text style={styles.title}>Login</Text>
                        <Text style={styles.subtitle}>Enter your email address and password</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="john@example.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={formData.email}
                                onChangeText={(val) => setFormData({ ...formData, email: val })}
                                placeholderTextColor={colors.textSubtle}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.passwordWrapper}>
                                <TextInput
                                    style={[styles.input, { flex: 1, borderWidth: 0 }]}
                                    placeholder="********"
                                    secureTextEntry={!showPassword}
                                    value={formData.password}
                                    onChangeText={(val) => setFormData({ ...formData, password: val })}
                                    placeholderTextColor={colors.textSubtle}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                >
                                    {showPassword ? (
                                        <EyeOff size={20} color={colors.textSubtle} />
                                    ) : (
                                        <Eye size={20} color={colors.textSubtle} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.forgotPassword}
                            onPress={() => router.push('/forgot-password')}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleLogin}
                        >
                            <Text style={styles.submitButtonText}>Login</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            New members join via invite from their Credit Union
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        scrollContent: {
            padding: 30,
            flexGrow: 1,
        },
        backButton: {
            marginBottom: 40,
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
        passwordWrapper: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            alignItems: 'center',
            paddingRight: 10,
        },
        eyeIcon: {
            padding: 10,
        },
        forgotPassword: {
            alignSelf: 'flex-end',
        },
        forgotPasswordText: {
            color: colors.textMuted,
            fontSize: 14,
            textDecorationLine: 'underline',
        },
        submitButton: {
            backgroundColor: colors.primary,
            borderRadius: 30,
            height: 56,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 10,
        },
        submitButtonText: {
            color: colors.primaryText,
            fontSize: 18,
            fontWeight: 'bold',
        },
        footer: {
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 40,
        },
        footerText: {
            color: colors.textMuted,
            fontSize: 14,
        },
        footerLink: {
            color: colors.text,
            fontSize: 14,
            fontWeight: 'bold',
        },
    });

export default LoginScreen;
