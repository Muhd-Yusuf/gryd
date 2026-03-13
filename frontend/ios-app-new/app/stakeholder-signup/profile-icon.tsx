import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { StakeholderBadge } from '../../lib/api';
import { useTheme } from '../../lib/theme';

const BADGE_OPTIONS: { value: StakeholderBadge; label: string; color: string }[] = [
    { value: 'stakeholder', label: 'Stakeholder', color: '#3B82F6' },
    { value: 'vendor', label: 'Vendor', color: '#8B5CF6' },
    { value: 'partner', label: 'Partner', color: '#10B981' },
    { value: 'sponsor', label: 'Sponsor', color: '#F59E0B' },
    { value: 'investor', label: 'Investor', color: '#EC4899' },
];

export default function StakeholderProfileIconScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        token: string;
        email: string;
        firstName: string;
        lastName: string;
        username: string;
        company: string;
        subgridId: string;
        subgridName: string;
        stakeholderBadge: string;
    }>();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);

    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [selectedBadge, setSelectedBadge] = useState<StakeholderBadge>(
        (params.stakeholderBadge as StakeholderBadge) || 'stakeholder'
    );
    const [loading, setLoading] = useState(false);

    const getInitials = () => {
        const first = params.firstName?.[0] || '';
        const last = params.lastName?.[0] || '';
        return (first + last).toUpperCase() || 'MJ';
    };

    const pickImage = async () => {
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

    const getBadgeColor = (badge: StakeholderBadge) => {
        return BADGE_OPTIONS.find(b => b.value === badge)?.color || '#3B82F6';
    };

    const handleNext = () => {
        router.push({
            pathname: '/stakeholder-signup/profile-summary',
            params: {
                token: params.token,
                email: params.email,
                firstName: params.firstName,
                lastName: params.lastName,
                username: params.username,
                company: params.company,
                subgridId: params.subgridId,
                subgridName: params.subgridName,
                stakeholderBadge: selectedBadge,
                profileImage: profileImage || '',
            },
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                {/* Step indicator */}
                <View style={styles.stepIndicator}>
                    <View style={[styles.step, styles.stepCompleted]} />
                    <View style={[styles.stepLine, styles.stepLineCompleted]} />
                    <View style={[styles.step, styles.stepCompleted]} />
                    <View style={[styles.stepLine, styles.stepLineCompleted]} />
                    <View style={[styles.step, styles.stepActive]} />
                    <View style={styles.stepLine} />
                    <View style={styles.step} />
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                        {mode === 'dark' ? (
                            <Sun color={colors.text} size={20} />
                        ) : (
                            <Moon color={colors.text} size={20} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={() => router.replace('/login')}
                    >
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <Text style={styles.title}>Set your Profile Icon</Text>
                    <Text style={styles.subtitle}>Upload profile image</Text>

                    <View style={styles.avatarSection}>
                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                            {profileImage ? (
                                <Image
                                    source={{ uri: profileImage }}
                                    style={styles.avatarImage}
                                    cachePolicy="memory-disk"
                                />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarText}>{getInitials()}</Text>
                                </View>
                            )}
                        </View>

                        {/* Image info and button */}
                        <View style={styles.imageInfoContainer}>
                            <Text style={styles.imageInfoTitle}>Image size</Text>
                            <Text style={styles.imageInfoText}>
                                We recommend an image of at least 50x50px
                            </Text>
                            <TouchableOpacity
                                style={styles.addImageButton}
                                onPress={pickImage}
                            >
                                <Text style={styles.addImageText}>Add Image</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Badge Selection */}
                    <View style={styles.badgeSection}>
                        <Text style={styles.badgeTitle}>Select your badge</Text>
                        <Text style={styles.badgeSubtitle}>
                            This badge will appear next to your name
                        </Text>

                        <View style={styles.badgeOptions}>
                            {BADGE_OPTIONS.map((badge) => (
                                <TouchableOpacity
                                    key={badge.value}
                                    style={[
                                        styles.badgeOption,
                                        selectedBadge === badge.value && styles.badgeOptionSelected,
                                        { borderColor: selectedBadge === badge.value ? badge.color : colors.border },
                                    ]}
                                    onPress={() => setSelectedBadge(badge.value)}
                                >
                                    <View style={[styles.badgePreview, { backgroundColor: badge.color }]}>
                                        <Text style={styles.badgePreviewText}>{badge.label}</Text>
                                    </View>
                                    {selectedBadge === badge.value && (
                                        <View style={[styles.checkmark, { backgroundColor: badge.color }]}>
                                            <Text style={styles.checkmarkText}>✓</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Preview */}
                    <View style={styles.previewSection}>
                        <Text style={styles.previewTitle}>Preview</Text>
                        <View style={styles.previewCard}>
                            <View style={styles.previewAvatarContainer}>
                                {profileImage ? (
                                    <Image
                                        source={{ uri: profileImage }}
                                        style={styles.previewAvatar}
                                        cachePolicy="memory-disk"
                                    />
                                ) : (
                                    <View style={styles.previewAvatarPlaceholder}>
                                        <Text style={styles.previewAvatarText}>{getInitials()}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.previewInfo}>
                                <View style={styles.previewNameRow}>
                                    <Text style={styles.previewName}>
                                        {params.firstName} {params.lastName}
                                    </Text>
                                    <View style={[styles.previewBadge, { backgroundColor: getBadgeColor(selectedBadge) }]}>
                                        <Text style={styles.previewBadgeText}>
                                            {BADGE_OPTIONS.find(b => b.value === selectedBadge)?.label}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.previewUsername}>
                                    @{params.username}{params.company ? ` from ${params.company}` : ''}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleNext}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primaryText} />
                        ) : (
                            <Text style={styles.buttonText}>Next (Step 2/2)</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
        },
        headerRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        themeToggle: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: colors.surface,
        },
        logoContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        logoText: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        stepIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        step: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.border,
        },
        stepActive: {
            backgroundColor: colors.primary,
        },
        stepCompleted: {
            backgroundColor: '#22C55E',
        },
        stepLine: {
            width: 20,
            height: 2,
            backgroundColor: colors.border,
        },
        stepLineCompleted: {
            backgroundColor: '#22C55E',
        },
        logoutButton: {
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
        },
        logoutText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '500',
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        card: {
            width: '100%',
            maxWidth: 500,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 32,
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
        },
        avatarSection: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 24,
            marginBottom: 32,
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
            backgroundColor: colors.appBg,
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
        imageInfoContainer: {
            flex: 1,
        },
        imageInfoTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        imageInfoText: {
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: 12,
        },
        addImageButton: {
            backgroundColor: colors.text,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            alignSelf: 'flex-start',
        },
        addImageText: {
            color: colors.appBg,
            fontSize: 14,
            fontWeight: '600',
        },
        badgeSection: {
            marginBottom: 24,
        },
        badgeTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        badgeSubtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 16,
        },
        badgeOptions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        badgeOption: {
            borderWidth: 2,
            borderRadius: 12,
            padding: 8,
            position: 'relative',
        },
        badgeOptionSelected: {
            backgroundColor: colors.appBg,
        },
        badgePreview: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
        },
        badgePreviewText: {
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '600',
        },
        checkmark: {
            position: 'absolute',
            top: -6,
            right: -6,
            width: 20,
            height: 20,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        checkmarkText: {
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '700',
        },
        previewSection: {
            marginBottom: 24,
            padding: 16,
            backgroundColor: colors.appBg,
            borderRadius: 12,
        },
        previewTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 12,
        },
        previewCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        previewAvatarContainer: {
            width: 48,
            height: 48,
            borderRadius: 24,
            overflow: 'hidden',
        },
        previewAvatar: {
            width: '100%',
            height: '100%',
        },
        previewAvatarPlaceholder: {
            width: '100%',
            height: '100%',
            backgroundColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 24,
        },
        previewAvatarText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.textMuted,
        },
        previewInfo: {
            flex: 1,
        },
        previewNameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
        },
        previewName: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        previewBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 12,
        },
        previewBadgeText: {
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: '600',
        },
        previewUsername: {
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 2,
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 30,
            paddingVertical: 16,
            alignItems: 'center',
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        buttonText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '600',
        },
    });
