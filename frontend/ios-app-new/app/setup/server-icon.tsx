import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Image,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

const BANNER_COLORS = [
    '#EC4899', // Pink
    '#1F2937', // Dark gray
    '#3B82F6', // Blue
    '#F97316', // Orange
    '#8B5CF6', // Purple
];

export default function ServerIconScreen() {
    const router = useRouter();
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
                                <TouchableOpacity
                                    style={styles.addIconButton}
                                    onPress={handlePickIcon}
                                >
                                    <Text style={styles.addIconText}>Add Icon</Text>
                                </TouchableOpacity>
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

                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleNext}
                            >
                                <Text style={styles.buttonText}>Next</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Right Side - Preview */}
                        <View style={styles.previewContainer}>
                            <View style={styles.previewCard}>
                                <View style={[styles.previewBanner, { backgroundColor: selectedBanner }]} />
                                <View style={styles.previewAvatarContainer}>
                                    {iconUri ? (
                                        <Image source={{ uri: iconUri }} style={styles.previewAvatarImage} />
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: '#000000',
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
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
        backgroundColor: '#E5E7EB',
    },
    stepDotActive: {
        backgroundColor: '#000000',
    },
    stepDotCompleted: {
        backgroundColor: '#22C55E',
    },
    stepLabel: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    stepLabelActive: {
        color: '#000000',
        fontWeight: '500',
    },
    stepLine: {
        width: 24,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    stepLineCompleted: {
        backgroundColor: '#22C55E',
    },
    logoutButton: {
        marginLeft: 'auto',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    logoutText: {
        fontSize: 12,
        color: '#374151',
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
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 4,
    },
    helperText: {
        fontSize: 11,
        color: '#9CA3AF',
        marginBottom: 12,
    },
    addIconButton: {
        backgroundColor: '#000000',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignSelf: 'flex-start',
    },
    addIconText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
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
        borderColor: '#000000',
    },
    button: {
        backgroundColor: '#000000',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        width: 120,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    previewContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewCard: {
        width: 200,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
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
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    previewAvatarImage: {
        width: 48,
        height: 48,
        borderRadius: 10,
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    previewAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
    },
    previewInfo: {
        padding: 12,
        paddingTop: 32,
    },
    previewName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    previewSubtext: {
        fontSize: 11,
        color: '#9CA3AF',
    },
});
