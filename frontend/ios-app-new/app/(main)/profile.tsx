import React, { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { getAuthUser, communityGet, resolveTenantId, logout, uploadAvatar, updateAuthUser } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import UserAvatar from '../../components/UserAvatar';

type UserProfile = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string;
};

type SubgridMembership = {
    subgridId: string;
    subgridName: string;
    role: string;
};

const ProfileScreen = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const navigation = useNavigation();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [memberships, setMemberships] = useState<SubgridMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [stagedImage, setStagedImage] = useState<{ uri: string; name: string; type: string } | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        setError('');
        try {
            const authUser = await getAuthUser();
            if (!authUser) {
                router.replace('/welcome');
                return;
            }

            // Load full user profile from API (includes avatar)
            try {
                const profileRes = await communityGet('/users/me');
                if (profileRes?.data) {
                    const profileData = {
                        userId: profileRes.data.userId,
                        email: profileRes.data.email,
                        firstName: profileRes.data.firstName,
                        lastName: profileRes.data.lastName,
                        role: profileRes.data.role,
                        avatarUrl: profileRes.data.avatarUrl,
                    };
                    setUser(profileData);
                    await updateAuthUser(profileData);
                    if (profileRes.data.avatarUrl) {
                        setProfileImage(profileRes.data.avatarUrl);
                    }
                } else {
                    // Fall back to auth user data
                    setUser({
                        userId: authUser.userId,
                        email: authUser.email,
                        firstName: authUser.firstName,
                        lastName: authUser.lastName,
                        role: authUser.role,
                    });
                }
            } catch {
                // Fall back to auth user data
                setUser({
                    userId: authUser.userId,
                    email: authUser.email,
                    firstName: authUser.firstName,
                    lastName: authUser.lastName,
                    role: authUser.role,
                });
            }

            // Load subgrid memberships
            const tenantId = await resolveTenantId();
            if (tenantId) {
                try {
                    const subgridsRes = await communityGet(`/tenants/${tenantId}/subgrids`);
                    const subgrids = subgridsRes?.data || [];

                    const membershipPromises = subgrids.map(async (subgrid: any) => {
                        try {
                            const roleRes = await communityGet(`/subgrids/${subgrid._id}/my-role`);
                            return {
                                subgridId: subgrid._id,
                                subgridName: subgrid.name || 'Community',
                                role: roleRes?.data?.role || 'member',
                            };
                        } catch {
                            return {
                                subgridId: subgrid._id,
                                subgridName: subgrid.name || 'Community',
                                role: 'member',
                            };
                        }
                    });

                    const membershipResults = await Promise.all(membershipPromises);
                    setMemberships(membershipResults);
                } catch (err) {
                    console.log('Failed to load memberships');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        try {
            // Request permission
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile picture.');
                return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;
                const filename = uri.split('/').pop() || 'profile.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : 'image/jpeg';

                // Stage the image for preview (don't upload yet)
                setStagedImage({ uri, name: filename, type });
                setError('');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to pick image');
        }
    };

    const handleSaveAvatar = async () => {
        if (!stagedImage) return;

        setSaving(true);
        setError('');
        try {
            // Upload using the proper avatar upload endpoint
            const response = await uploadAvatar(stagedImage);

            // Get the avatar URL from response
            const avatarUrl = response?.avatarUrl || response?.url || response?.secureUrl || response?.secure_url;
            if (avatarUrl) {
                setProfileImage(avatarUrl);
                await updateAuthUser({ avatarUrl });

                // Clear staged image after successful save
                setStagedImage(null);

                // Show success message
                if (Platform.OS === 'web') {
                    window.alert('Profile picture updated successfully!');
                } else {
                    Alert.alert('Success', 'Profile picture updated successfully!');
                }
            } else {
                throw new Error('No avatar URL returned from server');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save profile picture');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelAvatar = () => {
        setStagedImage(null);
        setError('');
    };

    const handleLogout = async () => {
        const confirmLogout = Platform.OS === 'web'
            ? window.confirm('Are you sure you want to log out?')
            : await new Promise<boolean>((resolve) => {
                Alert.alert(
                    'Log Out',
                    'Are you sure you want to log out?',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Log Out', style: 'destructive', onPress: () => resolve(true) },
                    ]
                );
            });

        if (!confirmLogout) return;

        try {
            await logout();
            router.replace('/welcome');
        } catch (err: any) {
            setError(err.message || 'Failed to log out');
        }
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            router.back();
        } else {
            router.push('/(main)');
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'super_admin':
                return { bg: '#7C3AED', text: '#FFFFFF' };
            case 'admin':
                return { bg: '#3B82F6', text: '#FFFFFF' };
            case 'subgrid_admin':
                return { bg: '#10B981', text: '#FFFFFF' };
            case 'moderator':
                return { bg: '#F59E0B', text: '#FFFFFF' };
            default:
                return { bg: colors.surfaceMuted, text: colors.text };
        }
    };

    const formatRole = (role: string) => {
        // Display "Member" for regular member roles
        const memberRoles = ['member', 'agent', 'user'];
        if (memberRoles.includes(role.toLowerCase())) {
            return 'Member';
        }
        return role.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';

    // Determine effective role: use highest role from memberships or global role
    const getEffectiveRole = () => {
        // Priority order: super_admin > admin > subgrid_admin > moderator > member
        if (user?.role === 'super_admin') return 'super_admin';
        if (user?.role === 'admin') return 'admin';

        // Check if user has a higher role in any community membership
        const highestMembershipRole = memberships.reduce((highest, m) => {
            const roleOrder: Record<string, number> = {
                'subgrid_admin': 3,
                'owner': 3,
                'moderator': 2,
                'member': 1,
            };
            const currentOrder = roleOrder[m.role] || 1;
            const highestOrder = roleOrder[highest] || 1;
            return currentOrder > highestOrder ? m.role : highest;
        }, 'member');

        // Map 'owner' to 'subgrid_admin' for display
        if (highestMembershipRole === 'owner') return 'subgrid_admin';
        if (highestMembershipRole === 'subgrid_admin') return 'subgrid_admin';
        if (highestMembershipRole === 'moderator') return 'moderator';

        return user?.role || 'member';
    };

    const effectiveRole = getEffectiveRole();
    const roleBadge = getRoleBadgeColor(effectiveRole);
    // Show staged image if user selected a new one, otherwise show saved avatar
    const avatarUri = stagedImage?.uri || profileImage || user?.avatarUrl || null;

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <TouchableOpacity style={styles.themeButton} onPress={toggleTheme}>
                        <MaterialIcons
                            name={mode === 'dark' ? 'light-mode' : 'dark-mode'}
                            size={24}
                            color={colors.text}
                        />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Profile Card with Avatar */}
                    <View style={styles.profileCard}>
                        <View style={styles.avatarSection}>
                            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={saving}>
                                <UserAvatar
                                    uri={avatarUri}
                                    name={fullName}
                                    style={styles.avatar}
                                    accessibilityLabel={`${fullName} avatar`}
                                />
                                <View style={styles.avatarOverlay}>
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
                                    )}
                                </View>
                            </TouchableOpacity>
                            {stagedImage ? (
                                <View style={styles.avatarActions}>
                                    <TouchableOpacity
                                        style={styles.cancelAvatarButton}
                                        onPress={handleCancelAvatar}
                                        disabled={saving}
                                    >
                                        <MaterialIcons name="close" size={16} color={colors.text} />
                                        <Text style={styles.cancelAvatarText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.saveAvatarButton}
                                        onPress={handleSaveAvatar}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <MaterialIcons name="check" size={16} color="#FFFFFF" />
                                                <Text style={styles.saveAvatarText}>Save</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={styles.avatarHint}>Tap to change photo</Text>
                            )}
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.fullName}>{fullName}</Text>
                            <Text style={styles.email}>{user?.email}</Text>
                            <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
                                <Text style={[styles.roleBadgeText, { color: roleBadge.text }]}>
                                    {formatRole(effectiveRole)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Account Info Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account Information</Text>
                        <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <MaterialIcons name="person" size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>First Name</Text>
                                    <Text style={styles.infoValue}>{user?.firstName || 'Not set'}</Text>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <MaterialIcons name="person-outline" size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Last Name</Text>
                                    <Text style={styles.infoValue}>{user?.lastName || 'Not set'}</Text>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <MaterialIcons name="email" size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Email</Text>
                                    <Text style={styles.infoValue}>{user?.email}</Text>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <MaterialIcons name="badge" size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>User ID</Text>
                                    <Text style={styles.infoValueMono}>{user?.userId}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Community Memberships Section */}
                    {memberships.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Community Memberships</Text>
                            <View style={styles.infoCard}>
                                {memberships.map((membership, index) => {
                                    const memberRoleBadge = getRoleBadgeColor(membership.role);
                                    return (
                                        <React.Fragment key={membership.subgridId}>
                                            {index > 0 && <View style={styles.divider} />}
                                            <View style={styles.membershipRow}>
                                                <View style={styles.membershipIcon}>
                                                    <MaterialIcons name="groups" size={20} color={colors.primary} />
                                                </View>
                                                <View style={styles.membershipInfo}>
                                                    <Text style={styles.membershipName}>{membership.subgridName}</Text>
                                                    <View style={[styles.memberRoleBadge, { backgroundColor: memberRoleBadge.bg }]}>
                                                        <Text style={[styles.memberRoleBadgeText, { color: memberRoleBadge.text }]}>
                                                            {formatRole(membership.role)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </React.Fragment>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Logout Section */}
                    <View style={styles.section}>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <MaterialIcons name="logout" size={20} color="#EF4444" />
                            <Text style={styles.logoutText}>Log Out</Text>
                        </TouchableOpacity>
                    </View>

                    {!!error && (
                        <Text style={styles.errorText}>{error}</Text>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        container: {
            flex: 1,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        loadingText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        themeButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
        },
        content: {
            flex: 1,
        },
        contentContainer: {
            padding: 16,
            paddingBottom: 40,
            gap: 24,
        },
        profileCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
        },
        avatarSection: {
            alignItems: 'center',
            marginBottom: 16,
        },
        avatarContainer: {
            position: 'relative',
            width: 100,
            height: 100,
        },
        avatar: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.surfaceMuted,
        },
        avatarOverlay: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: colors.surface,
        },
        avatarHint: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 8,
        },
        avatarActions: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 12,
        },
        cancelAvatarButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
        },
        cancelAvatarText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        saveAvatarButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: '#22C55E',
            minWidth: 80,
            justifyContent: 'center',
        },
        saveAvatarText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        profileInfo: {
            alignItems: 'center',
            gap: 4,
        },
        fullName: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
        },
        email: {
            fontSize: 14,
            color: colors.textMuted,
        },
        roleBadge: {
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
            marginTop: 8,
        },
        roleBadgeText: {
            fontSize: 12,
            fontWeight: '600',
        },
        section: {
            gap: 12,
        },
        sectionTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginLeft: 4,
        },
        infoCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        infoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            gap: 12,
        },
        infoContent: {
            flex: 1,
        },
        infoLabel: {
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: 2,
        },
        infoValue: {
            fontSize: 15,
            fontWeight: '500',
            color: colors.text,
        },
        infoValueMono: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        divider: {
            height: 1,
            backgroundColor: colors.border,
            marginLeft: 48,
        },
        membershipRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            gap: 12,
        },
        membershipIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        membershipInfo: {
            flex: 1,
            gap: 4,
        },
        membershipName: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        memberRoleBadge: {
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 8,
        },
        memberRoleBadgeText: {
            fontSize: 11,
            fontWeight: '600',
        },
        logoutButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.dangerBg,
            borderRadius: 12,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: colors.error,
        },
        logoutText: {
            fontSize: 15,
            fontWeight: '600',
            color: '#EF4444',
        },
        errorText: {
            fontSize: 13,
            color: colors.error,
            textAlign: 'center',
        },
    });

export default ProfileScreen;
