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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, X, Check, AtSign, User, UserCircle, Mail, BadgeCheck, Building2, Users, LogOut, Edit2, Shield, ChevronRight, Sun, Moon, Wallet, Copy, Link, CheckCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { resolveTenantId, logout, StakeholderBadge } from '../../lib/api';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../lib/theme';
import UserAvatar from '../../components/UserAvatar';
import { useUserProfile, useUserMemberships, useUploadAvatar, useUploadBanner, useUpdateUsername, useWalletMutation, useEnsMutation } from '../../hooks/queries';
import { GlassCard, GlassIconButton, GlassButton, GlassInput } from '../../components/glass';

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
    walletAddress?: string;
    ensDomain?: string;
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
    const walletMutation = useWalletMutation();
    const ensMutation = useEnsMutation();

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

    // Web3 & Crypto inline state
    const [walletInput, setWalletInput] = useState('');
    const [ensInput, setEnsInput] = useState('');
    const [walletError, setWalletError] = useState('');
    const [ensError, setEnsError] = useState('');
    const walletSaving = walletMutation.isPending;
    const ensSaving = ensMutation.isPending;

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
        walletAddress: profileQuery.data.walletAddress,
        ensDomain: profileQuery.data.ensDomain,
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

    // Sync wallet / ENS inputs from saved profile data
    useEffect(() => {
        if (user?.walletAddress !== undefined) {
            setWalletInput(user.walletAddress ?? '');
        }
    }, [user?.walletAddress]);

    useEffect(() => {
        if (user?.ensDomain !== undefined) {
            setEnsInput(user.ensDomain ?? '');
        }
    }, [user?.ensDomain]);

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

    const truncateAddress = (addr: string) =>
        `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const handleConnectWallet = async () => {
        const address = walletInput.trim();
        if (!address.startsWith('0x') || address.length !== 42) {
            setWalletError('Enter a valid Ethereum address (0x… 42 chars)');
            return;
        }
        setWalletError('');
        try {
            await walletMutation.mutateAsync(address);
            setWalletInput('');
        } catch (err: any) {
            setWalletError(err.message || 'Failed to connect wallet');
        }
    };

    const handleDisconnectWallet = async () => {
        try {
            await walletMutation.mutateAsync(null);
        } catch (err: any) {
            setError(err.message || 'Failed to disconnect wallet');
        }
    };

    const handleLinkEns = async () => {
        const domain = ensInput.trim();
        if (!domain.endsWith('.eth') || domain.length < 7) {
            setEnsError('Enter a valid ENS domain (e.g. yourname.eth, min 7 chars)');
            return;
        }
        setEnsError('');
        try {
            await ensMutation.mutateAsync(domain);
            setEnsInput('');
        } catch (err: any) {
            setEnsError(err.message || 'Failed to link ENS domain');
        }
    };

    const handleUnlinkEns = async () => {
        try {
            await ensMutation.mutateAsync(null);
        } catch (err: any) {
            setError(err.message || 'Failed to unlink ENS domain');
        }
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
                return { bg: colors.glassBg, text: colors.text };
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
                    <GlassIconButton
                        icon={<ArrowLeft size={22} color={colors.text} />}
                        onPress={handleBack}
                        variant="default"
                        size="md"
                        accessibilityLabel="Go back"
                    />
                    <Text style={styles.headerTitle}>Profile</Text>
                    <GlassIconButton
                        icon={mode === 'dark' ? <Sun size={20} color={colors.text} /> : <Moon size={20} color={colors.text} />}
                        onPress={toggleTheme}
                        variant="default"
                        size="md"
                        accessibilityLabel="Toggle theme"
                    />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Profile Card with Banner and Avatar */}
                    <GlassCard style={styles.profileCard}>
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
                                <View style={[styles.bannerPlaceholder, { backgroundColor: 'rgba(59,130,246,0.15)' }]} />
                            )}
                            <LinearGradient
                                colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={styles.bannerOverlay}
                            >
                                {savingBanner ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Camera size={20} color="#FFFFFF" />
                                )}
                            </LinearGradient>
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
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 0, y: 1 }}
                                    style={styles.avatarOverlay}
                                >
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Camera size={20} color="#FFFFFF" />
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                            {stagedImage ? (
                                <View style={styles.avatarActions}>
                                    <GlassButton
                                        label="Cancel"
                                        onPress={handleCancelAvatar}
                                        variant="secondary"
                                        size="sm"
                                        disabled={saving}
                                        icon={<X size={14} color={colors.text} />}
                                    />
                                    <GlassButton
                                        label="Save"
                                        onPress={handleSaveAvatar}
                                        variant="primary"
                                        size="sm"
                                        loading={saving}
                                        disabled={saving}
                                        icon={<Check size={14} color="#FFFFFF" />}
                                    />
                                </View>
                            ) : (
                                <Text style={styles.avatarHint}>Tap to change photo</Text>
                            )}
                        </View>

                        {/* Banner Actions - Moved below avatar to prevent overlap */}
                        {stagedBanner && (
                            <View style={styles.bannerActions}>
                                <GlassButton
                                    label="Cancel"
                                    onPress={handleCancelBanner}
                                    variant="secondary"
                                    size="sm"
                                    disabled={savingBanner}
                                    icon={<X size={14} color={colors.text} />}
                                />
                                <GlassButton
                                    label="Save Banner"
                                    onPress={handleSaveBanner}
                                    variant="primary"
                                    size="sm"
                                    loading={savingBanner}
                                    disabled={savingBanner}
                                    icon={<Check size={14} color="#FFFFFF" />}
                                />
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
                                {/* ETH badge — shown when wallet is connected */}
                                {user?.walletAddress && (
                                    <View style={styles.ethBadge}>
                                        <Wallet size={11} color="#F59E0B" />
                                        <Text style={styles.ethBadgeText}>ETH</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </GlassCard>

                    {/* Account Info Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account Information</Text>
                        <GlassCard style={styles.infoCard}>
                            {/* Username Field */}
                            <View style={styles.infoRow}>
                                <AtSign size={20} color={colors.textMuted} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Username</Text>
                                    {editingUsername ? (
                                        <View style={styles.usernameEditContainer}>
                                            <GlassInput
                                                value={username}
                                                onChangeText={(text: string) => {
                                                    setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                                                    setUsernameError('');
                                                }}
                                                placeholder="Choose a username"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                maxLength={20}
                                                error={usernameError || undefined}
                                                icon={<AtSign size={15} color={colors.textMuted} />}
                                            />
                                            <View style={styles.usernameActions}>
                                                <GlassButton
                                                    label="Cancel"
                                                    onPress={handleCancelUsername}
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={savingUsername}
                                                />
                                                <GlassButton
                                                    label="Save"
                                                    onPress={handleSaveUsername}
                                                    variant="primary"
                                                    size="sm"
                                                    loading={savingUsername}
                                                    disabled={savingUsername}
                                                />
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
                        </GlassCard>
                    </View>

                    {/* Community Memberships Section */}
                    {memberships.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Community Memberships</Text>
                            <GlassCard style={styles.infoCard}>
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
                            </GlassCard>
                        </View>
                    )}

                    {/* Privacy & Safety Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Settings</Text>
                        <GlassCard style={styles.infoCard}>
                            <TouchableOpacity
                                style={styles.infoRow}
                                onPress={() => router.push('/(main)/privacy-settings')}
                                activeOpacity={0.7}
                            >
                                <Shield size={20} color={colors.primary} />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Privacy &amp; Safety</Text>
                                    <Text style={styles.infoValue}>Control who can see your profile</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </GlassCard>
                    </View>

                    {/* Web3 & Crypto Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Web3 &amp; Crypto</Text>
                        <GlassCard style={styles.web3Card}>
                            {/* Section header row */}
                            <View style={styles.web3HeaderRow}>
                                <View style={styles.web3IconWrap}>
                                    <Wallet size={18} color="#F59E0B" />
                                </View>
                                <Text style={styles.web3CardTitle}>Web3 &amp; Crypto</Text>
                            </View>

                            {/* ETH Wallet Address */}
                            <View style={styles.web3FieldBlock}>
                                <Text style={styles.web3FieldLabel}>ETH Wallet Address</Text>
                                <View style={styles.web3InputRow}>
                                    <View style={styles.web3InputFlex}>
                                        <GlassInput
                                            value={walletInput}
                                            onChangeText={(t: string) => { setWalletInput(t); setWalletError(''); }}
                                            placeholder="0x…"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            error={walletError || undefined}
                                            icon={<Wallet size={15} color="#F59E0B" />}
                                        />
                                    </View>
                                    {user?.walletAddress ? (
                                        <GlassButton
                                            label="Remove"
                                            onPress={handleDisconnectWallet}
                                            variant="danger"
                                            size="sm"
                                            loading={walletSaving}
                                            disabled={walletSaving}
                                        />
                                    ) : (
                                        <GlassButton
                                            label="Save"
                                            onPress={handleConnectWallet}
                                            variant="primary"
                                            size="sm"
                                            loading={walletSaving}
                                            disabled={walletSaving || !walletInput.trim()}
                                            icon={<Check size={13} color="#fff" />}
                                        />
                                    )}
                                </View>
                                {user?.walletAddress && (
                                    <View style={styles.web3SavedRow}>
                                        <CheckCircle size={13} color="#22C55E" />
                                        <Text style={styles.web3SavedText}>{truncateAddress(user.walletAddress)}</Text>
                                        <TouchableOpacity onPress={() => Clipboard.setStringAsync(user.walletAddress!)} style={styles.web3CopyBtn}>
                                            <Copy size={13} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <View style={styles.web3Divider} />

                            {/* ENS Domain */}
                            <View style={styles.web3FieldBlock}>
                                <Text style={styles.web3FieldLabel}>ENS Domain</Text>
                                <View style={styles.web3InputRow}>
                                    <View style={styles.web3InputFlex}>
                                        <GlassInput
                                            value={ensInput}
                                            onChangeText={(t: string) => { setEnsInput(t.toLowerCase()); setEnsError(''); }}
                                            placeholder="yourname.eth"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            error={ensError || undefined}
                                            icon={<Link size={15} color="#8B5CF6" />}
                                        />
                                    </View>
                                    {user?.ensDomain ? (
                                        <GlassButton
                                            label="Unlink"
                                            onPress={handleUnlinkEns}
                                            variant="danger"
                                            size="sm"
                                            loading={ensSaving}
                                            disabled={ensSaving}
                                        />
                                    ) : (
                                        <GlassButton
                                            label="Link"
                                            onPress={handleLinkEns}
                                            variant="secondary"
                                            size="sm"
                                            loading={ensSaving}
                                            disabled={ensSaving || !ensInput.trim()}
                                            icon={<Link size={13} color={colors.primary} />}
                                        />
                                    )}
                                </View>
                                {user?.ensDomain && (
                                    <View style={styles.web3SavedRow}>
                                        <CheckCircle size={13} color="#22C55E" />
                                        <Text style={styles.web3SavedText}>{user.ensDomain}</Text>
                                    </View>
                                )}
                            </View>
                        </GlassCard>
                    </View>

                    {/* Logout Section */}
                    <View style={styles.section}>
                        <GlassButton
                            label="Log Out"
                            onPress={handleLogout}
                            variant="danger"
                            size="md"
                            fullWidth
                            icon={<LogOut size={18} color={mode === 'dark' ? '#FCA5A5' : '#DC2626'} />}
                        />
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
            backgroundColor: 'transparent',
        },
        container: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
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
        // Aliases used in JSX
        scroll: {
            flex: 1,
        },
        scrollContent: {
            padding: 16,
            paddingBottom: 40,
            gap: 24,
        },
        profileCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
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
            backgroundColor: colors.glassBg,
        },
        cancelBannerButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
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
            backgroundColor: colors.glassBg,
            borderWidth: 4,
            borderColor: colors.glassBorder,
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
            borderColor: colors.glassBorder,
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
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
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
        // GlassCard wraps with its own border/bg — pass overflow + padding 0
        infoCard: {
            overflow: 'hidden',
            padding: 0,
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
            backgroundColor: colors.glassBorder,
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
            backgroundColor: 'rgba(59,130,246,0.10)',
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
            gap: 10,
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
        // Web3 & Crypto — inline card
        web3IconWrap: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
            borderColor: colors.glassBorder,
            alignItems: 'center',
            justifyContent: 'center',
        },
        web3ActionGroup: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        ensValueRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        ethBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
            backgroundColor: 'rgba(245,158,11,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.35)',
        },
        ethBadgeText: {
            fontSize: 11,
            fontWeight: '700',
            color: '#F59E0B',
            letterSpacing: 0.5,
        },
        web3Card: {
            overflow: 'hidden',
            padding: 0,
        },
        web3HeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        web3CardTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
        },
        web3FieldBlock: {
            paddingHorizontal: 16,
            paddingVertical: 14,
            gap: 8,
        },
        web3FieldLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 2,
        },
        web3InputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        web3InputFlex: {
            flex: 1,
        },
        web3SavedRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
        },
        web3SavedText: {
            fontSize: 13,
            color: colors.textMuted,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        web3CopyBtn: {
            padding: 4,
        },
        web3Divider: {
            height: 1,
            backgroundColor: colors.glassBorder,
            marginHorizontal: 16,
        },
    });

export default ProfileScreen;
