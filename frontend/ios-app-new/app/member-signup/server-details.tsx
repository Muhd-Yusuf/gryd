import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Platform,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';

export default function ServerDetailsScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isMobileView = !isWeb || width < 768;

    const mobileStyles = createMobileStyles(colors);
    const webStyles = createWebStyles(colors);

    const params = useLocalSearchParams<{
        serverCode: string;
        subgridId: string;
        subgridName: string;
        clientName: string;
        description: string;
        logoUrl: string;
        coverImageUrl: string;
        memberCount: string;
        onlineCount: string;
    }>();

    const [loading, setLoading] = useState(false);

    // Parse member counts from string params
    const memberCount = parseInt(params.memberCount || '0', 10);
    const onlineCount = parseInt(params.onlineCount || '0', 10);

    // Get initials for avatar
    const getInitials = (name: string) => {
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handleSetupProfile = () => {
        router.push({
            pathname: '/member-signup/account-setup',
            params: {
                serverCode: params.serverCode,
                subgridId: params.subgridId,
                subgridName: params.subgridName,
            },
        });
    };

    const handleBack = () => {
        router.back();
    };

    // Server card component (shared between mobile and web)
    const renderServerCard = (styles: any) => (
        <View style={styles.serverCard}>
            {/* Cover Image / Pink Header */}
            <View style={styles.serverHeader}>
                {params.coverImageUrl ? (
                    <Image
                        source={{ uri: params.coverImageUrl }}
                        style={styles.coverImage}
                    />
                ) : null}
            </View>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
                {params.logoUrl ? (
                    <Image
                        source={{ uri: params.logoUrl }}
                        style={styles.avatarImage}
                    />
                ) : (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {getInitials(params.subgridName || 'CU')}
                        </Text>
                    </View>
                )}
            </View>

            {/* Server Info */}
            <View style={styles.serverInfo}>
                <Text style={styles.serverName}>
                    {params.subgridName || 'Community'}
                </Text>
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.statText}>
                            {onlineCount} Online
                        </Text>
                    </View>
                    <View style={styles.statItem}>
                        <View style={styles.memberDot} />
                        <Text style={styles.statText}>
                            {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
                        </Text>
                    </View>
                </View>
                {params.description ? (
                    <Text style={styles.serverDescription} numberOfLines={2}>
                        {params.description}
                    </Text>
                ) : null}
            </View>
        </View>
    );

    // Mobile view
    if (isMobileView) {
        return (
            <SafeAreaView style={mobileStyles.container}>
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

                    <View style={mobileStyles.header}>
                        <Text style={mobileStyles.title}>
                            Welcome to {params.subgridName || 'Community'}
                        </Text>
                        <Text style={mobileStyles.subtitle}>
                            You're about to join this community. Let's set up your profile.
                        </Text>
                    </View>

                    <View style={mobileStyles.form}>
                        {renderServerCard(mobileStyles)}

                        <TouchableOpacity
                            style={[mobileStyles.submitButton, loading && mobileStyles.buttonDisabled]}
                            onPress={handleSetupProfile}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={mobileStyles.submitButtonText}>Setup Profile</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={mobileStyles.footer}>
                        <Text style={mobileStyles.footerText}>
                            Already have an account?{' '}
                        </Text>
                        <TouchableOpacity onPress={() => router.push('/login')}>
                            <Text style={mobileStyles.loginLink}>Login</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Web view
    return (
        <SafeAreaView style={webStyles.container}>
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
                        <Text style={webStyles.title}>
                            Welcome to {params.subgridName || 'Community'}
                        </Text>
                        <Text style={webStyles.subtitle}>
                            You're about to join this community. Let's set up your profile.
                        </Text>

                        {renderServerCard(webStyles)}

                        <TouchableOpacity
                            style={[webStyles.button, loading && webStyles.buttonDisabled]}
                            onPress={handleSetupProfile}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={webStyles.buttonText}>Setup Profile</Text>
                            )}
                        </TouchableOpacity>

                        <View style={webStyles.signupContainer}>
                            <Text style={webStyles.signupText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/login')}>
                                <Text style={webStyles.signupLink}>Login</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
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
        themeToggle: {
            position: 'absolute',
            top: 20,
            right: 20,
            padding: 10,
            borderRadius: 20,
            backgroundColor: colors.surface,
        },
        formCard: {
            maxWidth: 400,
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
        serverCard: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            marginBottom: 20,
        },
        serverHeader: {
            height: 80,
            backgroundColor: '#EC4899',
        },
        coverImage: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
        },
        avatarContainer: {
            position: 'absolute',
            top: 55,
            left: 12,
            zIndex: 1,
        },
        avatar: {
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 3,
            borderColor: colors.surface,
        },
        avatarImage: {
            width: 48,
            height: 48,
            borderRadius: 10,
            borderWidth: 3,
            borderColor: colors.surface,
        },
        avatarText: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        serverInfo: {
            padding: 12,
            paddingTop: 32,
        },
        serverName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 6,
        },
        statsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 6,
        },
        statItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        onlineDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#22C55E',
        },
        memberDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.textMuted,
        },
        statText: {
            fontSize: 11,
            color: colors.textMuted,
        },
        serverDescription: {
            fontSize: 11,
            color: colors.textSubtle,
            lineHeight: 16,
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
        form: {
            gap: 20,
        },
        serverCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        serverHeader: {
            height: 100,
            backgroundColor: '#EC4899',
        },
        coverImage: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
        },
        avatarContainer: {
            position: 'absolute',
            top: 70,
            left: 16,
            zIndex: 1,
        },
        avatar: {
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 3,
            borderColor: colors.surface,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        avatarImage: {
            width: 56,
            height: 56,
            borderRadius: 12,
            borderWidth: 3,
            borderColor: colors.surface,
        },
        avatarText: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        serverInfo: {
            padding: 16,
            paddingTop: 40,
        },
        serverName: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        statsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginBottom: 8,
        },
        statItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        onlineDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#22C55E',
        },
        memberDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.textMuted,
        },
        statText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        serverDescription: {
            fontSize: 13,
            color: colors.textSubtle,
            lineHeight: 18,
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
        loginLink: {
            color: colors.primary,
            fontSize: 14,
            fontWeight: '600',
        },
    });
