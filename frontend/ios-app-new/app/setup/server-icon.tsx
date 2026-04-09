import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../lib/theme';
import { GlassButton } from '../../components/glass';

const BANNER_COLORS = [
    '#EC4899', // Pink
    '#1F2937', // Dark gray
    '#3B82F6', // Blue
    '#F97316', // Orange
    '#8B5CF6', // Purple
];

export default function ServerIconScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const params = useLocalSearchParams<{
        token: string;
        tenant: string;
        email: string;
        tenantId: string;
        subgridId: string;
        serverName: string;
        description: string;
    }>();

    const [iconUri, setIconUri] = useState<string | null>(null);
    const [selectedBanner, setSelectedBanner] = useState(BANNER_COLORS[0]);

    const getInitials = (name: string) => {
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handlePickIcon = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
            alert('Permission to access photos is required!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setIconUri(result.assets[0].uri);
        }
    };

    const handleNext = () => {
        router.push({
            pathname: '/setup/invite-members',
            params: {
                token: params.token,
                tenant: params.tenant,
                email: params.email,
                tenantId: params.tenantId,
                subgridId: params.subgridId,
                serverName: params.serverName,
                description: params.description,
                iconUri: iconUri || '',
                bannerColor: selectedBanner,
            },
        });
    };

    const styles = createStyles(colors);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>The Gryd Onboarding</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    {/* Step Indicator */}
                    <View style={styles.stepRow}>
                        <View style={styles.stepItem}>
                            <View style={[styles.stepDot, styles.stepDotCompleted]} />
                            <Text style={styles.stepLabel}>Server Setup</Text>
                        </View>
                        <View style={[styles.stepLine, styles.stepLineCompleted]} />
                        <View style={styles.stepItem}>
                            <View style={[styles.stepDot, styles.stepDotActive]} />
                            <Text style={[styles.stepLabel, styles.stepLabelActive]}>Server Icon</Text>
                        </View>
                        <View style={styles.stepLine} />
                        <View style={styles.stepItem}>
                            <View style={styles.stepDot} />
                            <Text style={styles.stepLabel}>Preview Profile</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={() => router.replace('/login')}
                        >
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.contentRow}>
                        {/* Left Side - Form */}
                        <View style={styles.formContainer}>
                            <Text style={styles.title}>Choose your Server Icon</Text>
                            <Text style={styles.subtitle}>Upload server image</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Icon</Text>
                                <Text style={styles.helperText}>We recommend an image of at least 512x512</Text>
                                <View style={styles.addIconArea}>
                                    {iconUri ? (
                                        <Image
                                            source={{ uri: iconUri }}
                                            style={styles.addIconPreview}
                                            cachePolicy="memory-disk"
                                        />
                                    ) : null}
                                    <GlassButton
                                        label={iconUri ? 'Change Icon' : 'Add Icon'}
                                        onPress={handlePickIcon}
                                        variant="secondary"
                                        size="sm"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Banner</Text>
                                <View style={styles.bannerRow}>
                                    {BANNER_COLORS.map((color) => (
                                        <TouchableOpacity
                                            key={color}
                                            style={[
                                                styles.bannerOption,
                                                { backgroundColor: color },
                                                selectedBanner === color && styles.bannerOptionSelected,
                                            ]}
                                            onPress={() => setSelectedBanner(color)}
                                        />
                                    ))}
                                </View>
                            </View>

                            <GlassButton
                                label="Next"
                                onPress={handleNext}
                                variant="primary"
                                size="md"
                            />
                        </View>

                        {/* Right Side - Preview */}
                        <View style={styles.previewContainer}>
                            <View style={styles.previewCard}>
                                <View style={[styles.previewBanner, { backgroundColor: selectedBanner }]} />
                                <View style={styles.previewAvatarContainer}>
                                    {iconUri ? (
                                        <Image source={{ uri: iconUri }} style={styles.previewAvatarImage} cachePolicy="memory-disk" />
                                    ) : (
                                        <View style={styles.previewAvatar}>
                                            <Text style={styles.previewAvatarText}>
                                                {getInitials(params.serverName || 'SV')}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.previewInfo}>
                                    <Text style={styles.previewName}>{params.serverName || 'Server'} Server</Text>
                                    <Text style={styles.previewSubtext}>Your description</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        header: {
            backgroundColor: colors.glassBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        headerTitle: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '500',
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
        },
        card: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 24,
            maxWidth: 700,
            width: '100%',
            alignSelf: 'center',
        },
        stepRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 32,
            flexWrap: 'wrap',
            gap: 8,
        },
        stepItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        stepDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.glassBorder,
        },
        stepDotActive: {
            backgroundColor: colors.primary,
        },
        stepDotCompleted: {
            backgroundColor: colors.successText,
        },
        stepLabel: {
            fontSize: 12,
            color: colors.textMuted,
        },
        stepLabelActive: {
            color: colors.text,
            fontWeight: '500',
        },
        stepLine: {
            width: 24,
            height: 1,
            backgroundColor: colors.glassBorder,
        },
        stepLineCompleted: {
            backgroundColor: colors.successText,
        },
        logoutButton: {
            marginLeft: 'auto',
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 6,
            paddingVertical: 6,
            paddingHorizontal: 12,
        },
        logoutText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        contentRow: {
            flexDirection: Platform.OS === 'web' ? 'row' : 'column',
            gap: 32,
        },
        formContainer: {
            flex: 1,
            maxWidth: 320,
        },
        title: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        subtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 24,
        },
        inputGroup: {
            marginBottom: 24,
        },
        label: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 4,
        },
        helperText: {
            fontSize: 11,
            color: colors.textSubtle,
            marginBottom: 12,
        },
        addIconArea: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        addIconPreview: {
            width: 48,
            height: 48,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        bannerRow: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 8,
        },
        bannerOption: {
            width: 48,
            height: 32,
            borderRadius: 6,
        },
        bannerOptionSelected: {
            borderWidth: 3,
            borderColor: colors.primary,
        },
        previewContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        previewCard: {
            width: 200,
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            overflow: 'hidden',
        },
        previewBanner: {
            height: 60,
        },
        previewAvatarContainer: {
            position: 'absolute',
            top: 35,
            left: 12,
            zIndex: 1,
        },
        previewAvatar: {
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: colors.glassBg,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 3,
            borderColor: colors.glassBorder,
        },
        previewAvatarImage: {
            width: 48,
            height: 48,
            borderRadius: 10,
            borderWidth: 3,
            borderColor: colors.glassBorder,
        },
        previewAvatarText: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
        },
        previewInfo: {
            padding: 12,
            paddingTop: 32,
        },
        previewName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 2,
        },
        previewSubtext: {
            fontSize: 11,
            color: colors.textSubtle,
        },
    });
