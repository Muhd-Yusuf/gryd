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
import { Sun, Moon, ArrowLeft, Plus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../lib/theme';

export default function ProfilePictureScreen() {
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
        firstName: string;
        lastName: string;
        email: string;
        username: string;
        otpVerified: string;
    }>();

    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Get initials for default avatar
    const getInitials = () => {
        const first = params.firstName?.[0] || '';
        const last = params.lastName?.[0] || '';
        return (first + last).toUpperCase() || 'MJ';
    };

    const pickImage = async () => {
        // Request permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Sorry, we need camera roll permissions to upload a photo.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setProfileImage(result.assets[0].uri);
        }
    };

    const handleNext = () => {
        router.push({
            pathname: '/member-signup/profile-summary',
            params: {
                serverCode: params.serverCode,
                subgridId: params.subgridId,
                subgridName: params.subgridName,
                firstName: params.firstName,
                lastName: params.lastName,
                email: params.email,
                username: params.username,
                profileImage: profileImage || '',
            },
        });
    };

    const handleBack = () => {
        router.back();
    };

    // Shared avatar section
    const renderAvatarSection = (styles: any) => (
        <View style={styles.avatarSection}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
                {profileImage ? (
                    <Image
                        source={{ uri: profileImage }}
                        style={styles.avatarImage}
                    />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{getInitials()}</Text>
                    </View>
                )}
            </View>

            {/* Add Photo Button */}
            <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={pickImage}
            >
                <Text style={styles.addPhotoText}>Add photo</Text>
                <Plus size={20} color={colors.primaryText} />
            </TouchableOpacity>
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
                        <Text style={mobileStyles.title}>Customize your Profile Icon</Text>
                        <Text style={mobileStyles.subtitle}>
                            Add a photo so other members can recognize you
                        </Text>
                    </View>

                    <View style={mobileStyles.form}>
                        {renderAvatarSection(mobileStyles)}

                        <TouchableOpacity
                            style={[mobileStyles.submitButton, loading && mobileStyles.buttonDisabled]}
                            onPress={handleNext}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={mobileStyles.submitButtonText}>Next (Step 2/2)</Text>
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
                        <Text style={webStyles.title}>Customize your Profile Icon</Text>
                        <Text style={webStyles.subtitle}>
                            Add a photo so other members can recognize you
                        </Text>

                        {renderAvatarSection(webStyles)}

                        <TouchableOpacity
                            style={[webStyles.button, loading && webStyles.buttonDisabled]}
                            onPress={handleNext}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={webStyles.buttonText}>Next (Step 2/2)</Text>
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
            marginBottom: 24,
            lineHeight: 16,
        },
        avatarSection: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 20,
            marginBottom: 24,
        },
        avatarContainer: {
            width: 64,
            height: 64,
            borderRadius: 32,
            overflow: 'hidden',
        },
        avatarImage: {
            width: '100%',
            height: '100%',
        },
        avatarPlaceholder: {
            width: '100%',
            height: '100%',
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: 32,
        },
        avatarText: {
            fontSize: 22,
            fontWeight: '600',
            color: colors.textMuted,
        },
        addPhotoButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        addPhotoText: {
            color: colors.primaryText,
            fontSize: 12,
            fontFamily: 'Inter_600SemiBold',
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 10,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
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
        avatarSection: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 24,
            marginBottom: 20,
        },
        avatarContainer: {
            width: 80,
            height: 80,
            borderRadius: 40,
            overflow: 'hidden',
        },
        avatarImage: {
            width: '100%',
            height: '100%',
        },
        avatarPlaceholder: {
            width: '100%',
            height: '100%',
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: 40,
        },
        avatarText: {
            fontSize: 28,
            fontWeight: '600',
            color: colors.textMuted,
        },
        addPhotoButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.primary,
            borderRadius: 30,
            paddingHorizontal: 20,
            paddingVertical: 12,
        },
        addPhotoText: {
            color: colors.primaryText,
            fontSize: 14,
            fontWeight: '600',
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
