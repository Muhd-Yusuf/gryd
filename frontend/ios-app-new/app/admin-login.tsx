import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getAdminHomePath } from '../lib/featureFlags';
import { useTheme } from '../lib/theme';

const AdminLoginScreen = () => {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isStacked = width < 960;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const logoText = useMemo(() => 'THE GRYD', []);

    const handleLogin = () => {
        if (!email.trim() || !password.trim()) {
            setError('Enter your email address and password.');
            return;
        }
        setError('');
        router.replace(getAdminHomePath());
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.shell,
                        isStacked && styles.shellStacked,
                    ]}
                >
                    <View style={[styles.leftPanel, isStacked && styles.leftPanelStacked]}>
                        <View style={styles.logoRow}>
                            <View style={styles.logoBox}>
                                <View style={styles.logoOuter}>
                                    <View style={styles.logoInner} />
                                </View>
                            </View>
                            <Text style={styles.logoText}>{logoText}</Text>
                        </View>

                        <View style={styles.cardStack}>
                            <View style={styles.profileCard}>
                                <View style={styles.profileRow}>
                                    <View style={styles.profileAvatar} />
                                    <View>
                                        <Text style={styles.profileName}>Charlie Nicole</Text>
                                        <Text style={styles.profileMeta}>231-040572</Text>
                                    </View>
                                </View>
                                <View style={styles.profileInfoRow}>
                                    <View style={styles.profileIcon} />
                                    <View>
                                        <Text style={styles.profileMeta}>231-040572</Text>
                                        <Text style={styles.profileLabel}>Charlie Nicole</Text>
                                    </View>
                                </View>
                                <View style={styles.profileInfoRow}>
                                    <View style={styles.profileIcon} />
                                    <View>
                                        <Text style={styles.profileMeta}>Gender</Text>
                                        <Text style={styles.profileLabel}>Female</Text>
                                    </View>
                                </View>
                                <View style={styles.profileInfoRow}>
                                    <View style={styles.profileIcon} />
                                    <View>
                                        <Text style={styles.profileMeta}>231-040572</Text>
                                        <Text style={styles.profileLabel}>01.02.2025</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.statCard}>
                                <View style={styles.statRing} />
                                <View>
                                    <Text style={styles.statLabel}>Qualified Leads</Text>
                                    <Text style={styles.statValue}>+4.36%</Text>
                                </View>
                            </View>

                            <View style={styles.badgeCard}>
                                <Text style={styles.badgeTitle}>Community Badge</Text>
                                <Text style={styles.badgeDate}>March 5,2025</Text>
                                <View style={styles.badgeRow}>
                                    <View style={styles.badgePill}>
                                        <Text style={styles.badgePillText}>1 month</Text>
                                    </View>
                                    <View style={styles.badgeIcon} />
                                </View>
                            </View>
                        </View>

                        <View style={styles.welcomeBlock}>
                            <Text style={styles.welcomeTitle}>Welcome to The Gryd!</Text>
                            <Text style={styles.welcomeCopy}>
                                Lorem ipsum dolor sit amet consectetur.{'\n'}
                                Imperdiet urna turpis etiam cras.
                            </Text>
                            <View style={styles.dotsRow}>
                                <View style={[styles.dot, styles.dotActive]} />
                                <View style={styles.dot} />
                                <View style={styles.dot} />
                            </View>
                        </View>
                    </View>

                    <View style={[styles.rightPanel, isStacked && styles.rightPanelStacked]}>
                        <View style={styles.formCard}>
                            <Text style={styles.formTitle}>Admin</Text>
                            <Text style={styles.formSubtitle}>
                                Enter your email address and password
                            </Text>

                            {!!error && <Text style={styles.errorText}>{error}</Text>}

                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your email address"
                                    placeholderTextColor={colors.textSubtle}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Password</Text>
                                <View style={styles.passwordRow}>
                                    <TextInput
                                        style={[styles.input, styles.passwordInput]}
                                        placeholder="Enter your password"
                                        placeholderTextColor={colors.textSubtle}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeButton}
                                    >
                                        {showPassword ? (
                                            <EyeOff size={18} color={colors.textSubtle} />
                                        ) : (
                                            <Eye size={18} color={colors.textSubtle} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.forgotButton}
                                onPress={() => router.push('/forgot-password')}
                            >
                                <Text style={styles.forgotText}>Forgot password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                                <Text style={styles.loginText}>Login</Text>
                            </TouchableOpacity>
                        </View>
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
        backgroundColor: '#000',
        padding: 40,
        justifyContent: 'space-between',
    },
    leftPanelStacked: {
        paddingVertical: 32,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logoBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoOuter: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '45deg' }],
    },
    logoInner: {
        width: 6,
        height: 6,
        borderRadius: 2,
        backgroundColor: '#FFF',
    },
    logoText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 2,
    },
    cardStack: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        marginTop: 24,
        marginBottom: 24,
    },
    profileCard: {
        width: 240,
        backgroundColor: '#FFF',
        borderRadius: 18,
        padding: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    profileAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#A7F3D0',
    },
    profileName: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        color: '#111827',
    },
    profileMeta: {
        fontSize: 10,
        fontFamily: 'Inter_400Regular',
        color: '#6B7280',
    },
    profileInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    profileIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E5E7EB',
    },
    profileLabel: {
        fontSize: 11,
        fontFamily: 'Inter_600SemiBold',
        color: '#111827',
    },
    statCard: {
        position: 'absolute',
        top: 30,
        right: -20,
        backgroundColor: '#FFF',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
    },
    statRing: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 3,
        borderColor: '#E5E7EB',
    },
    statLabel: {
        fontSize: 10,
        fontFamily: 'Inter_500Medium',
        color: '#6B7280',
    },
    statValue: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        color: '#111827',
        marginTop: 2,
    },
    badgeCard: {
        position: 'absolute',
        bottom: 16,
        right: -6,
        width: 150,
        backgroundColor: '#FFF',
        borderRadius: 14,
        padding: 12,
        gap: 6,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
    },
    badgeTitle: {
        fontSize: 11,
        fontFamily: 'Inter_600SemiBold',
        color: '#111827',
    },
    badgeDate: {
        fontSize: 9,
        fontFamily: 'Inter_400Regular',
        color: '#9CA3AF',
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    badgePill: {
        backgroundColor: '#F3F4F6',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgePillText: {
        fontSize: 9,
        fontFamily: 'Inter_500Medium',
        color: '#6B7280',
    },
    badgeIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#E5E7EB',
    },
    welcomeBlock: {
        alignItems: 'center',
        gap: 10,
    },
    welcomeTitle: {
        color: '#FFF',
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
    },
    welcomeCopy: {
        color: '#D1D5DB',
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
        lineHeight: 18,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#374151',
    },
    dotActive: {
        width: 20,
        borderRadius: 999,
        backgroundColor: '#FFF',
    },
    rightPanel: {
        flex: 1,
        backgroundColor: colors.appBg,
        padding: 40,
        justifyContent: 'center',
    },
    rightPanelStacked: {
        paddingTop: 32,
    },
    formCard: {
        maxWidth: 420,
        width: '100%',
        alignSelf: 'center',
        gap: 16,
    },
    formTitle: {
        fontSize: 24,
        fontFamily: 'Inter_700Bold',
        color: colors.text,
    },
    formSubtitle: {
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
        color: colors.textMuted,
        marginBottom: 12,
    },
    fieldGroup: {
        gap: 8,
    },
    label: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        color: colors.text,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
        color: colors.text,
        backgroundColor: colors.surface,
        outlineStyle: 'none',
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    passwordInput: {
        flex: 1,
        paddingRight: 40,
    },
    eyeButton: {
        position: 'absolute',
        right: 12,
        height: 44,
        justifyContent: 'center',
    },
    forgotButton: {
        alignSelf: 'flex-start',
    },
    forgotText: {
        fontSize: 11,
        fontFamily: 'Inter_400Regular',
        color: colors.textMuted,
        textDecorationLine: 'underline',
    },
    loginButton: {
        backgroundColor: colors.primary,
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    loginText: {
        color: colors.primaryText,
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
    },
    errorText: {
        fontSize: 11,
        fontFamily: 'Inter_500Medium',
        color: colors.dangerText,
    },
});

export default AdminLoginScreen;
