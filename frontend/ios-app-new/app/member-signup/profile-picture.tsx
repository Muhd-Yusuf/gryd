import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sun, Moon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';

export default function ProfilePictureScreen() {
    const router = useRouter();
    const { colors, mode, toggleTheme } = useTheme();
    const styles = createStyles(colors);
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

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with theme toggle */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                    {mode === 'dark' ? (
                        <Sun color={colors.text} size={20} />
                    ) : (
                        <Moon color={colors.text} size={20} />
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.title}>Customize your Profile Icon</Text>

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
                            <MaterialIcons name="add" size={20} color={colors.primaryText} />
                        </TouchableOpacity>
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
            </View>
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
        logoContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        logoText: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        themeToggle: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: colors.surface,
        },
        content: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        card: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 32,
        },
        title: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 32,
        },
        avatarSection: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 24,
            marginBottom: 40,
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
