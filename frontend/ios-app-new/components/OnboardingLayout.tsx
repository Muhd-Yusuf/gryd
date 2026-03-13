import React, { useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Image,
    ImageBackground,
    ScrollView,
    TouchableOpacity,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';

// City Background URL (Modern Black & White Architecture)
const CITY_BG =
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2670&auto=format&fit=crop';

interface OnboardingLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    step?: number;
    totalSteps?: number;
}

const OnboardingLayout = ({
    children,
    title,
    subtitle,
    showBack = true,
    onBack,
    step,
    totalSteps,
}: OnboardingLayoutProps) => {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width > 1024;
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const TheGrydLogo = ({ color }: { color: string }) => (
        <View style={styles.logoRow}>
            <Image source={require('../../assets/icon.png')} style={{ width: 32, height: 32, borderRadius: 6 }} />
            <Text style={[styles.brandName, { color }]}>THE GRYD</Text>
        </View>
    );

    return (
        <View style={[styles.container, isDesktop ? styles.containerDesktop : styles.containerMobile]}>
            {/* Left/Top Side - Hero Image (Desktop Only) */}
            {isDesktop && (
                <View style={styles.heroSide}>
                    <ImageBackground
                        source={{ uri: CITY_BG }}
                        style={styles.bgImage}
                        resizeMode="cover"
                    >
                        <View style={styles.overlay}>
                            <View style={styles.heroContent}>
                                <TheGrydLogo color="#FFFFFF" />
                                <View style={styles.heroTextContainer}>
                                    <Text style={styles.heroTitle}>Welcome to The Gryd</Text>
                                    <Text style={styles.heroDesc}>
                                        Connect with your credit union community.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ImageBackground>
                </View>
            )}

            {/* Right/Bottom Side - Form Content */}
            <View style={[styles.contentSide, isDesktop ? styles.contentDesktop : styles.contentMobile]}>
                <SafeAreaView edges={['bottom', 'top']} style={{ flex: 1 }}>
                    {/* Mobile Header Logo when Hero is hidden */}
                    {!isDesktop && (
                        <View style={styles.mobileHeaderLogo}>
                            <TheGrydLogo color={colors.text} />
                        </View>
                    )}

                    <View style={styles.safeAreaContent}>
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.formContainer}>
                                {showBack && (
                                    <TouchableOpacity
                                        style={styles.backButton}
                                        onPress={onBack || (() => router.back())}
                                    >
                                        <ArrowLeft color={colors.textMuted} size={20} />
                                        <Text style={styles.backText}>Back</Text>
                                    </TouchableOpacity>
                                )}

                                {title && <Text style={styles.pageTitle}>{title}</Text>}
                                {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}

                                {/* Progress Bar (if steps provided) */}
                                {step && totalSteps && (
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressBarBg}>
                                            <View
                                                style={[
                                                    styles.progressBarFill,
                                                    { width: `${(step / totalSteps) * 100}%` },
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.progressText}>
                                            Step {step} of {totalSteps}
                                        </Text>
                                    </View>
                                )}

                                {children}
                            </View>
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </View>
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        containerDesktop: {
            flexDirection: 'row',
        },
        containerMobile: {
            flexDirection: 'column',
        },
        // Hero Side (Desktop Only now)
        heroSide: {
            backgroundColor: '#000',
            overflow: 'hidden',
            width: '50%',
            height: '100%',
        },
        bgImage: {
            width: '100%',
            height: '100%',
        },
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: 30,
            justifyContent: 'space-between',
        },
        heroContent: {
            height: '100%',
            justifyContent: 'space-between',
        },
        heroTextContainer: {
            maxWidth: 400,
            marginBottom: 40,
        },
        heroTitle: {
            fontSize: 36,
            fontWeight: 'bold',
            color: '#FFF',
            marginBottom: 16,
        },
        heroDesc: {
            fontSize: 16,
            color: '#D1D5DB',
            lineHeight: 24,
        },

        // Content Side
        contentSide: {
            backgroundColor: colors.appBg,
            flex: 1,
        },
        contentDesktop: {
            width: '50%',
            height: '100%',
        },
        contentMobile: {
            width: '100%',
            height: '100%', // Full height on mobile
        },
        safeAreaContent: {
            flex: 1,
        },
        mobileHeaderLogo: {
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 0,
        },
        scrollContent: {
            flexGrow: 1,
            padding: 24,
            paddingBottom: 40,
            justifyContent: 'center',
        },
        formContainer: {
            maxWidth: 480,
            width: '100%',
            alignSelf: 'center',
        },

        // Header Elements
        backButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            alignSelf: 'flex-start',
        },
        backText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
        },
        pageTitle: {
            fontSize: 28,
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: 8,
        },
        pageSubtitle: {
            fontSize: 16,
            color: colors.textMuted,
            marginBottom: 32,
        },

        // Branding
        logoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        logoContainer: {
            width: 32,
            height: 32,
        },
        logoOuter: {
            flex: 1,
            borderWidth: 2,
            borderColor: colors.text,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            transform: [{ rotate: '45deg' }],
        },
        logoInner: {
            width: 16,
            height: 16,
            borderWidth: 1.5,
            borderColor: colors.text,
            borderRadius: 4,
            justifyContent: 'center',
            alignItems: 'center',
        },
        logoCore: {
            width: 4,
            height: 4,
            backgroundColor: colors.text,
            borderRadius: 2,
        },
        brandName: {
            fontSize: 18,
            fontWeight: '900',
            letterSpacing: 2,
            color: colors.text,
        },

        // Progress
        progressContainer: {
            marginBottom: 32,
        },
        progressBarBg: {
            height: 6,
            backgroundColor: colors.border,
            borderRadius: 3,
            marginBottom: 8,
        },
        progressBarFill: {
            height: '100%',
            backgroundColor: colors.primary,
            borderRadius: 3,
        },
        progressText: {
            fontSize: 12,
            color: colors.textMuted,
            textAlign: 'right',
        },
    });

export default OnboardingLayout;
