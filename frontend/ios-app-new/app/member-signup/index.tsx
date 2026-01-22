import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Sun, Moon } from 'lucide-react-native';
import { validateInviteCode } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function ServerCodeScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const [serverCode, setServerCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    // Show mobile view for native apps OR when screen width is below 768px (mobile responsive)
    const isMobileView = !isWeb || width < 768;
    const webStyles = createWebStyles(colors);
    const mobileStyles = createMobileStyles(colors);

    const handleContinue = async () => {
        if (!serverCode.trim()) {
            setError('Please enter a server code');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const serverDetails = await validateInviteCode(serverCode.trim().toUpperCase());

            // Navigate to server details screen with the data
            router.push({
                pathname: '/member-signup/server-details',
                params: {
                    serverCode: serverCode.trim().toUpperCase(),
                    subgridId: serverDetails.subgridId,
                    subgridName: serverDetails.subgridName,
                    clientName: serverDetails.clientName || '',
                    description: serverDetails.description || '',
                    logoUrl: serverDetails.logoUrl || '',
                    coverImageUrl: serverDetails.coverImageUrl || '',
                    memberCount: String(serverDetails.memberCount || 0),
                    onlineCount: String(serverDetails.onlineCount || 0),
                },
            });
        } catch (err: any) {
            setError(err.message || 'Invalid server code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (isMobileView) {
        return (
            <SafeAreaView style={mobileStyles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={mobileStyles.container}
                >
                    <ScrollView
                        contentContainerStyle={mobileStyles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={mobileStyles.topRow}>
                            <TouchableOpacity style={mobileStyles.themeToggle} onPress={toggleTheme}>
                                {mode === 'dark' ? (
                                    <Sun color={colors.text} size={22} />
                                ) : (
                                    <Moon color={colors.text} size={22} />
                                )}
                            </TouchableOpacity>
                        </View>
                        <View style={mobileStyles.formCard}>
                            <Text style={mobileStyles.title}>Server Code</Text>
                            <Text style={mobileStyles.subtitle}>
                                Enter your server code to join
                            </Text>

                            {!!error && <Text style={mobileStyles.errorText}>{error}</Text>}

                            <View style={mobileStyles.inputGroup}>
                                <Text style={mobileStyles.label}>Server Code</Text>
                                <TextInput
                                    style={mobileStyles.input}
                                    placeholder="BPJURQ"
                                    placeholderTextColor={colors.textSubtle}
                                    value={serverCode}
                                    onChangeText={(text) => {
                                        setServerCode(text.toUpperCase());
                                        setError('');
                                    }}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    maxLength={10}
                                    editable={!loading}
                                />
                            </View>

                            <TouchableOpacity
                                style={[mobileStyles.button, loading && mobileStyles.buttonDisabled]}
                                onPress={handleContinue}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={mobileStyles.buttonText}>Continue to Server</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={mobileStyles.loginLink}
                                onPress={() => router.push('/login')}
                            >
                                <Text style={mobileStyles.loginLinkText}>
                                    Already have an account? <Text style={mobileStyles.loginLinkBold}>Login</Text>
                                </Text>
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
                            <Text style={webStyles.title}>Server Code</Text>
                            <Text style={webStyles.subtitle}>
                                Enter your server code to join
                            </Text>

                            {!!error && <Text style={webStyles.errorText}>{error}</Text>}

                            <View style={webStyles.inputGroup}>
                                <Text style={webStyles.label}>Server Code</Text>
                                <TextInput
                                    style={webStyles.input}
                                    placeholder="BPJURQ"
                                    placeholderTextColor={colors.textSubtle}
                                    value={serverCode}
                                    onChangeText={(text) => {
                                        setServerCode(text.toUpperCase());
                                        setError('');
                                    }}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    maxLength={10}
                                    editable={!loading}
                                />
                            </View>

                            <TouchableOpacity
                                style={[webStyles.button, loading && webStyles.buttonDisabled]}
                                onPress={handleContinue}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={webStyles.buttonText}>Continue to Server</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={webStyles.loginLink}
                                onPress={() => router.push('/login')}
                            >
                                <Text style={webStyles.loginLinkText}>
                                    Already have an account? <Text style={webStyles.loginLinkBold}>Login</Text>
                                </Text>
                            </TouchableOpacity>
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
        } as any,
        errorText: {
            color: colors.error,
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
        loginLink: {
            marginTop: 16,
            alignItems: 'center',
        },
        loginLinkText: {
            fontSize: 11,
            fontFamily: 'Inter_400Regular',
            color: colors.textMuted,
        },
        loginLinkBold: {
            fontFamily: 'Inter_600SemiBold',
            color: colors.text,
        },
    });

const createMobileStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
        },
        topRow: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginBottom: 20,
        },
        themeToggle: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: colors.surface,
        },
        formCard: {
            width: '100%',
            maxWidth: 420,
            alignSelf: 'center',
        },
        title: {
            fontSize: 22,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
            lineHeight: 20,
        },
        inputGroup: {
            marginBottom: 20,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
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
        errorText: {
            color: colors.error,
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 16,
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 28,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        buttonText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },
        loginLink: {
            marginTop: 16,
            alignItems: 'center',
        },
        loginLinkText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        loginLinkBold: {
            fontWeight: '600',
            color: colors.text,
        },
    });
