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
    useWindowDimensions,
    TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Sun, Moon, Camera, X, Check, AtSign, User, UserCircle, Mail, BadgeCheck, Building2, Users, LogOut, Edit2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { resolveTenantId, logout, updateAuthUser, StakeholderBadge } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import UserAvatar from '../../components/UserAvatar';
import { useUserProfile, useUserMemberships, useUploadAvatar, useUploadBanner, useUpdateUsername } from '../../hooks/queries';

type UserProfile = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string;
    bannerUrl?: string;
    stakeholderBadge?: StakeholderBadge;
    company?: string;
    username?: string;
};

type SubgridMembership = {
    subgridId: string;
    subgridName: string;
    role: string;
};

const ProfileScreen = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const { width } = useWindowDimensions();
    const styles = useMemo(() => createStyles(colors, width), [colors, width]);
    const router = useRouter();
    const navigation = useNavigation();

    // React Query hooks
    const profileQuery = useUserProfile();
    const uploadAvatarMutation = useUploadAvatar();
    const uploadBannerMutation = useUploadBanner();
    const updateUsernameMutation = useUpdateUsername();

    // Tenant ID for memberships
    const [tenantId, setTenantId] = useState('');
    const membershipsQuery = useUserMemberships(tenantId);

    // Local UI state
    const [error, setError] = useState('');
    const [stagedImage, setStagedImage] = useState<{ uri: string; name: string; type: string } | null>(null);
    const [stagedBanner, setStagedBanner] = useState<{ uri: string; name: string; type: string } | null>(null);
    const [username, setUsername] = useState('');
    const [editingUsername, setEditingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');

    // Derived data from React Query
    const user: UserProfile | null = profileQuery.data ? {
        userId: profileQuery.data.userId,
        email: profileQuery.data.email,
        firstName: profileQuery.data.firstName,
        lastName: profileQuery.data.lastName,
        role: profileQuery.data.role,
        avatarUrl: profileQuery.data.avatarUrl,
        bannerUrl: profileQuery.data.bannerUrl,
        stakeholderBadge: profileQuery.data.stakeholderBadge,
        company: profileQuery.data.company,
        username: profileQuery.data.username,
    } : null;

    const memberships: SubgridMembership[] = membershipsQuery.data || [];
    const saving = uploadAvatarMutation.isPending;
    const savingBanner = uploadBannerMutation.isPending;
    const savingUsername = updateUsernameMutation.isPending;
    const profileImage = user?.avatarUrl || null;
    const bannerImage = user?.bannerUrl || null;

    // Load tenant ID on mount
    useEffect(() => {
        resolveTenantId().then(id => {
            if (id) setTenantId(id);
        });
    }, []);

    // Sync username from profile data
    useEffect(() => {
        if (user?.username && !editingUsername) {
            setUsername(user.username);
        }
    }, [user?.username, editingUsername]);

    // Redirect to login if no profile
    useEffect(() => {
        if (!profileQuery.isLoading && !profileQuery.data) {
            router.replace('/login');
        }
    }, [profileQuery.isLoading, profileQuery.data]);

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

    const pickBanner = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Please allow access to your photo library to change your banner.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 1], // Twitter-style banner aspect ratio
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;
                const filename = uri.split('/').pop() || 'banner.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : 'image/jpeg';

                setStagedBanner({ uri, name: filename, type });
                setError('');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to pick banner image');
        }
    };

    const handleSaveBanner = async () => {
        if (!stagedBanner) return;

        setError('');
        try {
            await uploadBannerMutation.mutateAsync(stagedBanner);
            setStagedBanner(null);

            if (Platform.OS === 'web') {
                window.alert('Banner updated successfully!');
            } else {
                Alert.alert('Success', 'Banner updated successfully!');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save banner');
        }
    };

    const handleCancelBanner = () => {
        setStagedBanner(null);
        setError('');
    };

    const handleSaveAvatar = async () => {
        if (!stagedImage) return;

        setError('');
        try {
            await uploadAvatarMutation.mutateAsync(stagedImage);
            setStagedImage(null);

            if (Platform.OS === 'web') {
                window.alert('Profile picture updated successfully!');
            } else {
                Alert.alert('Success', 'Profile picture updated successfully!');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save profile picture');
        }
    };

    const handleCancelAvatar = () => {
        setStagedImage(null);
        setError('');
    };

    const handleSaveUsername = async () => {
        if (!username.trim()) {
            setUsernameError('Username cannot be empty');
            return;
        }

        const trimmedUsername = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
            setUsernameError('Username must be 3-20 characters with only letters, numbers, and underscores');
            return;
        }

        setUsernameError('');
        try {
            await updateUsernameMutation.mutateAsync(trimmedUsername);
            setEditingUsername(false);
            if (Platform.OS === 'web') {
                window.alert('Username updated successfully!');
            } else {
                Alert.alert('Success', 'Username updated successfully!');
            }
        } catch (err: any) {
            setUsernameError(err.message || 'Failed to save username');
        }
    };

    const handleCancelUsername = () => {
        setUsername(user?.username || '');
        setEditingUsername(false);
        setUsernameError('');
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
            router.replace('/login');
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

    const getStakeholderBadgeColor = (badge: StakeholderBadge) => {
        const badgeColors: Record<StakeholderBadge, { bg: string; text: string }> = {
            stakeholder: { bg: '#3B82F6', text: '#FFFFFF' },
            vendor: { bg: '#8B5CF6', text: '#FFFFFF' },
            partner: { bg: '#10B981', text: '#FFFFFF' },
            sponsor: { bg: '#F59E0B', text: '#FFFFFF' },
            investor: { bg: '#EC4899', text: '#FFFFFF' },
        };
        return badgeColors[badge] || { bg: '#3B82F6', text: '#FFFFFF' };
    };

    const formatStakeholderBadge = (badge: StakeholderBadge) => {
        return badge.charAt(0).toUpperCase() + badge.slice(1);
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
    const bannerUri = stagedBanner?.uri || bannerImage || user?.bannerUrl || null;

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <ArrowLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <TouchableOpacity style={styles.themeButton} onPress={toggleTheme}>
                        {mode === 'dark' ? (
                            <Sun size={24} color={colors.text} />
                        ) : (
                            <Moon size={24} color={colors.text} />
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Profile Card with Banner and Avatar */}
                    <View style={styles.profileCard}>
                        {/* Banner Section */}
                        <TouchableOpacity
                            style={styles.bannerContainer}
                            onPress={pickBanner}
                            disabled={savingBanner}
                            activeOpacity={0.8}
                        >
                            {bannerUri ? (
                                <Image source={{ uri: bannerUri }} style={styles.bannerImage} cachePolicy="memory-disk" />
                            ) : (
                                <View style={[styles.bannerPlaceholder, { backgroundColor: mode === 'dark' ? '#1a1a2e' : '#667eea' }]} />
                            )}
                            <View style={styles.bannerOverlay}>
                                {savingBanner ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Camera size={20} color="#FFFFFF" />
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Avatar Section - Positioned over banner */}
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
                                        <Camera size={20} color="#FFFFFF" />
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
                                        <X size={16} color={colors.text} />
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
                                                <Check size={16} color="#FFFFFF" />
                                                <Text style={styles.saveAvatarText}>Save</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={styles.avatarHint}>Tap to change photo</Text>
                            )}
                        </View>

                        {/* Banner Actions - Moved below avatar to prevent overlap */}
                        {stagedBanner && (
                            <View style={styles.bannerActions}>
                                <TouchableOpacity
                                    style={styles.cancelBannerButton}
                                    onPress={handleCancelBanner}
                                    disabled={savingBanner}
                                >
                                    <X size={14} color={colors.text} />
                                    <Text style={styles.cancelBannerText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveBannerButton}
                                    onPress={handleSaveBanner}
                                    disabled={savingBanner}
                                >
                                    {savingBanner ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Check size={14} color="#FFFFFF" />
                                            <Text style={styles.saveBannerText}>Save Banner</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.profileInfo}>
                            <Text style={styles.fullName}>{fullName}</Text>
                            {user?.username && (
                                <Text style={styles.usernameDisplay}>@{user.username}</Text>
                            )}
                            <Text style={styles.email}>{user?.email}</Text>
                            <View style={styles.badgesContainer}>
                                {/* Show stakeholder badge if user is a stakeholder */}
                                {user?.role === 'stakeholder' && user?.stakeholderBadge && (
                                    <View style={[styles.roleBadge, { backgroundColor: getStakeholderBadgeColor(user.stakeholderBadge).bg }]}>
                                        <Text style={[styles.roleBadgeText, { color: getStakeholderBadgeColor(user.stakeholderBadge).text }]}>
                                            {formatStakeholderBadge(user.stakeholderBadge)}
                                        </Text>
                                    </View>
                                )}
                                {/* Show role badge for non-stakeholders or as secondary badge */}
                                {user?.role !== 'stakeholder' && (
                                    <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
                                        <Text style={[styles.roleBadgeText, { color: roleBadge.text }]}>
                                            {formatRole(effectiveRole)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Account Info Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account Information</Text>
                        <View style={styles.infoCard}>
                            {/* Username Field */}
                            <View style={styles.infoRow}>
                                <AtSign size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Username</Text>
                                    {editingUsername ? (
                                        <View style={styles.usernameEditContainer}>
                                            <TextInput
                                                style={styles.usernameInput}
                                                value={username}
                                                onChangeText={(text) => {
                                                    setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                                                    setUsernameError('');
                                                }}
                                                placeholder="Choose a username"
                                                placeholderTextColor={colors.textMuted}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                maxLength={20}
                                            />
                                            {usernameError ? (
                                                <Text style={styles.usernameErrorText}>{usernameError}</Text>
                                            ) : null}
                                            <View style={styles.usernameActions}>
                                                <TouchableOpacity
                                                    style={styles.cancelUsernameButton}
                                                    onPress={handleCancelUsername}
                                                    disabled={savingUsername}
                                                >
                                                    <Text style={styles.cancelUsernameText}>Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.saveUsernameButton}
                                                    onPress={handleSaveUsername}
                                                    disabled={savingUsername}
                                                >
                                                    {savingUsername ? (
                                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                                    ) : (
                                                        <Text style={styles.saveUsernameText}>Save</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.usernameValueContainer}
                                            onPress={() => setEditingUsername(true)}
                                        >
                                            <Text style={styles.infoValue}>
                                                {user?.username ? `@${user.username}` : 'Not set - tap to add'}
                                            </Text>
                                            <Edit2 size={16} color={colors.primary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <User size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>First Name</Text>
                                    <Text style={styles.infoValue}>{user?.firstName || 'Not set'}</Text>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <UserCircle size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Last Name</Text>
                                    <Text style={styles.infoValue}>{user?.lastName || 'Not set'}</Text>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <Mail size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Email</Text>
                                    <Text style={styles.infoValue}>{user?.email}</Text>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <BadgeCheck size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>User ID</Text>
                                    <Text style={styles.infoValueMono}>{user?.userId}</Text>
                                </View>
                            </View>
                            {user?.company && (
                                <>
                                    <View style={styles.divider} />
                                    <View style={styles.infoRow}>
                                        <Building2 size={20} color={colors.textMuted} />
                                        <View style={styles.infoContent}>
                                            <Text style={styles.infoLabel}>Company</Text>
                                            <Text style={styles.infoValue}>{user.company}</Text>
                                        </View>
                                    </View>
                                </>
                            )}
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
                                                    <Users size={20} color={colors.primary} />
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
                            <LogOut size={20} color="#EF4444" />
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

const createStyles = (colors: ReturnType<typeof useTheme>['colors'], width: number) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        container: {
            flex: 1,
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
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        // Banner Styles
        bannerContainer: {
            width: '100%',
            height: width > 600 ? 180 : 140,
            position: 'relative',
        },
        bannerImage: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
        },
        bannerPlaceholder: {
            width: '100%',
            height: '100%',
        },
        bannerOverlay: {
            position: 'absolute',
            bottom: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            // Ensure the overlay doesn't block parent touch (it's inside TouchableOpacity)
            pointerEvents: 'none',
        },
        bannerActions: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: colors.surfaceMuted,
        },
        cancelBannerButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        cancelBannerText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        saveBannerButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: '#22C55E',
        },
        saveBannerText: {
            fontSize: 13,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        // Avatar Section - Positioned to overlap banner
        avatarSection: {
            alignItems: 'center',
            marginTop: -50,
            paddingHorizontal: 24,
            paddingBottom: 16,
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
            borderWidth: 4,
            borderColor: colors.surface,
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
            paddingHorizontal: 24,
            paddingBottom: 24,
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
        badgesContainer: {
            flexDirection: 'row',
            gap: 8,
            marginTop: 8,
            flexWrap: 'wrap',
            justifyContent: 'center',
        },
        roleBadge: {
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
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
        usernameDisplay: {
            fontSize: 15,
            color: colors.primary,
            fontWeight: '500',
        },
        usernameEditContainer: {
            flex: 1,
            gap: 8,
        },
        usernameInput: {
            fontSize: 15,
            fontWeight: '500',
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: colors.surfaceMuted,
        },
        usernameValueContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        usernameActions: {
            flexDirection: 'row',
            gap: 8,
            marginTop: 4,
        },
        cancelUsernameButton: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        cancelUsernameText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        saveUsernameButton: {
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 6,
            backgroundColor: colors.primary,
            minWidth: 60,
            alignItems: 'center',
        },
        saveUsernameText: {
            fontSize: 13,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        usernameErrorText: {
            fontSize: 12,
            color: colors.error,
        },
    });

export default ProfileScreen;
