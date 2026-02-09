import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    AlertCircle,
    MessageSquare,
    Award,
    Sun,
    Moon,
    Mic,
    ChevronDown,
    Headphones,
    Settings,
    ArrowLeft,
    UserPlus,
    MoreHorizontal,
    BadgeCheck,
    Mail,
    Calendar,
    Building2,
} from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import {
    communityGet,
    getUserId,
    resolveTenantId,
    StakeholderBadge,
} from '../lib/api';

// Badge colors for stakeholders
const STAKEHOLDER_BADGE_COLORS: Record<StakeholderBadge, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};

// Role badge colors for CU admins and moderators
const ROLE_BADGE_COLORS: Record<string, string> = {
    subgrid_admin: '#EF4444',
    moderator: '#F97316',
};

type Member = {
    _id?: string;
    userId?: string;
    role?: string;
    userRole?: string;
    stakeholderBadge?: StakeholderBadge;
    company?: string;
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        createdAt?: string;
        avatarUrl?: string;
        bannerUrl?: string;
        profilePicture?: string;
        coverImage?: string;
        role?: string;
        stakeholderBadge?: StakeholderBadge;
        company?: string;
    };
};

type Post = {
    _id: string;
    authorId?: string;
};

type Message = {
    _id: string;
    authorId?: string;
};

type ContributorStats = {
    member: Member;
    messageCount: number;
};

type Subgrid = {
    _id: string;
    name?: string;
    logoUrl?: string;
    coverImageUrl?: string;
};

export default function TopContributorsScreen() {
    const { colors, mode, toggleTheme } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 900;
    const [mobileShowContent, setMobileShowContent] = useState(false);

    const [subgrids, setSubgrids] = useState<Subgrid[]>([]);
    const [activeSubgridId, setActiveSubgridId] = useState<string | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [contributors, setContributors] = useState<ContributorStats[]>([]);
    const [selectedContributor, setSelectedContributor] = useState<ContributorStats | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [error, setError] = useState<string>('');

    const activeSubgrid = useMemo(
        () => subgrids.find((s) => s._id === activeSubgridId) || null,
        [subgrids, activeSubgridId]
    );

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            setError('');
            try {
                const tenantId = await resolveTenantId();
                const userId = getUserId();
                setCurrentUserId(userId);

                if (!tenantId) {
                    setError('No community found. Please join a community first.');
                    return;
                }

                const subgridsRes = await communityGet(`/tenants/${tenantId}/subgrids`);
                const subgridsList = subgridsRes?.data || [];
                setSubgrids(subgridsList);
                if (subgridsList.length > 0) {
                    setActiveSubgridId(subgridsList[0]._id);
                }
            } catch (err: any) {
                console.error('[TopContributors] Failed to load data:', err);
                setError(err.message || 'Failed to load data');
            }
        };
        loadData();
    }, []);

    // Load members, posts, and messages
    useEffect(() => {
        if (!activeSubgridId) return;

        Promise.allSettled([
            communityGet(`/subgrids/${activeSubgridId}/members`),
            communityGet(`/subgrids/${activeSubgridId}/posts`),
            communityGet(`/subgrids/${activeSubgridId}/messages`),
        ]).then(([membersRes, postsRes, messagesRes]) => {
            if (membersRes.status === 'fulfilled') {
                const rawMembers = membersRes.value?.data;
                setMembers(Array.isArray(rawMembers) ? rawMembers : []);
            }
            if (postsRes.status === 'fulfilled') {
                const rawPosts = postsRes.value?.data;
                setPosts(Array.isArray(rawPosts) ? rawPosts : []);
            }
            if (messagesRes.status === 'fulfilled') {
                const rawMessages = messagesRes.value?.data;
                setMessages(Array.isArray(rawMessages) ? rawMessages : []);
            }
        });
    }, [activeSubgridId]);

    // Calculate contributor stats
    useEffect(() => {
        if (members.length === 0) return;

        const stats: ContributorStats[] = members.map((member) => {
            const userId = member.user?._id || member.userId;
            const userPosts = posts.filter((p) => p.authorId === userId);
            const userMessages = messages.filter((m) => m.authorId === userId);
            const messageCount = userPosts.length + userMessages.length;

            return {
                member,
                messageCount,
            };
        });

        // Sort by message count
        stats.sort((a, b) => b.messageCount - a.messageCount);

        setContributors(stats);
        if (stats.length > 0 && !selectedContributor) {
            setSelectedContributor(stats[0]);
        }
    }, [members, posts, messages]);

    const getMemberName = (member: Member) => {
        const user = member.user;
        if (user?.firstName || user?.lastName) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim();
        }
        return 'Unknown User';
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getMemberUsername = (member: Member) => {
        const user = member.user;
        if (user?.firstName) {
            return `@${user.firstName.toLowerCase()}${user.lastName?.slice(0, 3).toLowerCase() || ''}`;
        }
        return '@user';
    };

    const formatMemberSince = (dateStr?: string) => {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getMemberAvatarUrl = (member: Member): string | null => {
        const user = member.user;
        return user?.avatarUrl || user?.profilePicture || null;
    };

    const getMemberBannerUrl = (member: Member): string | null => {
        const user = member.user;
        return user?.bannerUrl || user?.coverImage || null;
    };

    const getMemberStakeholderBadge = (member: Member): StakeholderBadge | null => {
        const badge = member.stakeholderBadge || member.user?.stakeholderBadge;
        const role = member.userRole || member.user?.role;
        if (role === 'stakeholder' && badge) {
            return badge;
        }
        return null;
    };

    const getMemberRole = (member: Member): string | null => {
        return member.role || null;
    };

    const getMemberCompany = (member: Member): string | null => {
        return member.company || member.user?.company || null;
    };

    const getMemberEmail = (member: Member): string | null => {
        return member.user?.email || null;
    };

    const formatBadgeLabel = (badge: StakeholderBadge | string): string => {
        if (badge === 'subgrid_admin') return 'Server Admin';
        return badge.charAt(0).toUpperCase() + badge.slice(1).replace('_', ' ');
    };

    const currentUser = members.find(m => String(m.user?._id) === String(currentUserId) || String(m.userId) === String(currentUserId));
    const currentUserName = currentUser?.user?.firstName
        ? `${currentUser.user.firstName}${currentUser.user.lastName ? ' ' + currentUser.user.lastName : ''}`.trim()
        : 'User';

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        topNav: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingHorizontal: 16,
            height: 56,
        },
        logo: {
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: 24,
        },
        logoIcon: {
            fontSize: 20,
            marginRight: 8,
            color: colors.text,
        },
        logoText: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        navTabs: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        navTab: {
            paddingHorizontal: 16,
            paddingVertical: 8,
        },
        navTabActive: {
            borderBottomWidth: 2,
            borderBottomColor: colors.text,
        },
        navTabText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        navTabTextActive: {
            color: colors.text,
            fontWeight: '600',
        },
        mainContent: {
            flex: 1,
            flexDirection: 'row',
        },
        iconRail: {
            width: 72,
            backgroundColor: colors.surface,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            paddingTop: 12,
            alignItems: 'center',
        },
        serverIcon: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#1E3A5F',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        serverIconText: {
            fontSize: 10,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        serverIconImage: {
            width: 48,
            height: 48,
            borderRadius: 24,
        },
        railIconBtn: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        railIconTextActive: {
            color: colors.surface,
        },
        divider: {
            width: 32,
            height: 2,
            backgroundColor: colors.border,
            marginVertical: 8,
        },
        contributorsSidebar: {
            width: 240,
            backgroundColor: colors.surface,
            borderRightWidth: 1,
            borderRightColor: colors.border,
        },
        sidebarHeader: {
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        sidebarTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        contributorsList: {
            flex: 1,
        },
        contributorItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            paddingLeft: 16,
        },
        contributorItemActive: {
            backgroundColor: colors.surfaceMuted,
        },
        contributorAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#FBD8D3',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        contributorAvatarText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#B45D51',
        },
        contributorInfo: {
            flex: 1,
        },
        contributorName: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        contributorMessages: {
            fontSize: 12,
            color: colors.textMuted,
        },
        contributorBadgeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
            flexWrap: 'wrap',
        },
        badge: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
        },
        badgeText: {
            fontSize: 9,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        profileBadgeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
        },
        profileBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
        },
        profileBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        companyText: {
            fontSize: 13,
            color: colors.textMuted,
            fontStyle: 'italic',
            marginTop: 4,
        },
        profileArea: {
            flex: 1,
            backgroundColor: colors.surface,
        },
        profileBanner: {
            height: 200,
            position: 'relative',
            overflow: 'hidden',
        },
        profileHeader: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            padding: 16,
            position: 'absolute',
            top: 0,
            right: 0,
        },
        profileHeaderIcon: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
        },
        profileHeaderIconText: {
            fontSize: 14,
            color: colors.text,
        },
        profileContent: {
            padding: 24,
            marginTop: -50,
        },
        profileAvatar: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: '#E8D4C4',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: colors.surface,
            marginBottom: 16,
            overflow: 'hidden',
        },
        profileAvatarImage: {
            width: 100,
            height: 100,
            borderRadius: 50,
        },
        profileAvatarText: {
            fontSize: 32,
            fontWeight: '600',
            color: '#8B7355',
        },
        bannerImage: {
            width: '100%',
            height: 200,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
        },
        contributorAvatarImage: {
            width: 36,
            height: 36,
            borderRadius: 18,
        },
        profileName: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        profileUsername: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
        },
        aboutCard: {
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            padding: 16,
        },
        aboutSection: {
            marginBottom: 16,
        },
        aboutLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        aboutLabelRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
        },
        aboutValue: {
            fontSize: 14,
            color: colors.textMuted,
        },
        // User Profile (matching Server screen)
        userProfile: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
        },
        userAvatarContainer: {
            position: 'relative',
        },
        userAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        userAvatarText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
        },
        onlineIndicator: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#22C55E',
            borderWidth: 2,
            borderColor: colors.surface,
        },
        userInfo: {
            flex: 1,
        },
        userName: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
        },
        userStatusText: {
            fontSize: 11,
            color: '#22C55E',
        },
        userActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        userActionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 4,
        },
        bottomIcons: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        bottomIcon: {
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
        },
        bottomIconText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        // Mobile responsive styles
        topNavMobile: {
            paddingHorizontal: 8,
            justifyContent: 'center',
        },
        navTabsMobile: {
            marginLeft: 0,
            gap: 16,
            paddingHorizontal: 4,
        },
        contributorsSidebarMobile: {
            width: '100%',
            borderRightWidth: 0,
        },
        profileAreaMobile: {
            width: '100%',
        },
        mobileTopBar: {
            flexDirection: 'column',
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'ios' ? 50 : Platform.OS === 'android' ? 40 : 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            gap: 12,
        },
        mobileHeaderBrandRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        mobileGrydLogo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        mobileGrydLogoIcon: {
            width: 28,
            height: 28,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.primary + '15',
        },
        mobileGrydLogoHash: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.primary,
        },
        mobileGrydLogoText: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
            letterSpacing: 1,
        },
        mobileTopBarLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
        },
        mobileTopBarLogo: {
            width: 32,
            height: 32,
            borderRadius: 8,
        },
        mobileTopBarLogoPlaceholder: {
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        mobileTopBarLogoText: {
            fontSize: 10,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        mobileServerInfoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.surfaceMuted,
            padding: 10,
            borderRadius: 10,
        },
        mobileServerInfoText: {
            flex: 1,
        },
        mobileTopBarTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        mobileServerSubtitle: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        mobileNavTabs: {
            flexDirection: 'row',
            gap: 8,
        },
        mobileNavTab: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: colors.surfaceMuted,
        },
        mobileNavTabActive: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: colors.primary,
        },
        mobileNavTabText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.textMuted,
        },
        mobileNavTabTextActive: {
            fontSize: 14,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        mobileTopBarRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        mobileTopBarBtn: {
            width: 34,
            height: 34,
            borderRadius: 8,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        mobileProfileHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        mobileBackButton: {
            marginRight: 8,
            padding: 4,
        },
        mobileProfileHeaderTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
    });

    if (error) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <AlertCircle size={48} color={colors.textMuted} />
                <Text style={{ color: colors.text, fontSize: 16, marginTop: 12, textAlign: 'center' }}>{error}</Text>
                <TouchableOpacity
                    style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 8 }}
                    onPress={() => router.push('/(main)')}
                >
                    <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Go to Community</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Top Navigation - hidden on mobile, shown in mobileTopBar instead */}
            {!isMobile && (
            <View style={styles.topNav}>
                <View style={styles.logo}>
                    <Text style={styles.logoIcon}>#</Text>
                    <Text style={styles.logoText}>The Gryd</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navTabs}>
                    <TouchableOpacity style={styles.navTab} onPress={() => router.push('/admin')}>
                        <Text style={styles.navTabText}>Server</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navTab} onPress={() => router.push('/admin/messages')}>
                        <Text style={styles.navTabText}>Messages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.navTab, styles.navTabActive]}>
                        <Text style={[styles.navTabText, styles.navTabTextActive]}>Top Contributors</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
            )}

            <View style={styles.mainContent}>
                {/* Icon Rail - hidden on mobile */}
                {!isMobile && (
                    <View style={styles.iconRail}>
                        <TouchableOpacity style={[styles.serverIcon, activeSubgrid?.coverImageUrl && { backgroundColor: activeSubgrid.coverImageUrl }]} onPress={() => router.push('/admin')}>
                            {activeSubgrid ? (
                                activeSubgrid.logoUrl ? (
                                    <Image source={{ uri: activeSubgrid.logoUrl }} style={styles.serverIconImage} />
                                ) : (
                                    <Text style={styles.serverIconText}>
                                        {(activeSubgrid.name || 'SV').substring(0, 4).toUpperCase()}
                                    </Text>
                                )
                            ) : null}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.railIconBtn} onPress={() => router.push('/admin/messages')}>
                            <MessageSquare size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity style={styles.railIconBtn} onPress={() => router.push('/admin/contributors')}>
                            <Award size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.railIconBtn} onPress={toggleTheme}>
                            {mode === 'dark' ? (
                                <Sun size={18} color={colors.textMuted} />
                            ) : (
                                <Moon size={18} color={colors.textMuted} />
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Contributors Sidebar - full width on mobile, hidden when viewing profile */}
                {(!isMobile || !mobileShowContent) && (
                <View style={[styles.contributorsSidebar, isMobile && styles.contributorsSidebarMobile]}>
                    {/* Mobile Top Bar */}
                    {isMobile && (
                        <View style={styles.mobileTopBar}>
                            {/* Gryd Branding Row */}
                            <View style={styles.mobileHeaderBrandRow}>
                                <View style={styles.mobileGrydLogo}>
                                    <View style={styles.mobileGrydLogoIcon}>
                                        <Text style={styles.mobileGrydLogoHash}>#</Text>
                                    </View>
                                    <Text style={styles.mobileGrydLogoText}>THE GRYD</Text>
                                </View>
                                <View style={styles.mobileTopBarRight}>
                                    <TouchableOpacity style={styles.mobileTopBarBtn} onPress={toggleTheme}>
                                        {mode === 'dark' ? <Sun size={16} color={colors.text} /> : <Moon size={16} color={colors.text} />}
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {/* Server Info Row */}
                            <View style={styles.mobileServerInfoRow}>
                                {activeSubgrid?.logoUrl ? (
                                    <Image source={{ uri: activeSubgrid.logoUrl }} style={styles.mobileTopBarLogo} />
                                ) : (
                                    <View style={styles.mobileTopBarLogoPlaceholder}>
                                        <Text style={styles.mobileTopBarLogoText}>
                                            {(activeSubgrid?.name || 'SV').substring(0, 2).toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.mobileServerInfoText}>
                                    <Text style={styles.mobileTopBarTitle} numberOfLines={1}>
                                        {activeSubgrid?.name || 'Server'}
                                    </Text>
                                    <Text style={styles.mobileServerSubtitle}>Top Contributors</Text>
                                </View>
                            </View>
                            {/* Mobile Navigation Tabs */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNavTabs}>
                                <TouchableOpacity style={styles.mobileNavTab} onPress={() => router.push('/admin')}>
                                    <Text style={styles.mobileNavTabText}>Server</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.mobileNavTab} onPress={() => router.push('/admin/messages')}>
                                    <Text style={styles.mobileNavTabText}>Messages</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.mobileNavTabActive}>
                                    <Text style={styles.mobileNavTabTextActive}>Top Contributors</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    )}
                    <View style={styles.sidebarHeader}>
                        <Text style={styles.sidebarTitle}>Top Contributors</Text>
                    </View>
                    <ScrollView style={styles.contributorsList}>
                        {(contributors || []).map((stats) => {
                            const name = getMemberName(stats.member);
                            const avatarUrl = getMemberAvatarUrl(stats.member);
                            const stakeholderBadge = getMemberStakeholderBadge(stats.member);
                            const memberRole = getMemberRole(stats.member);
                            const isActive = selectedContributor?.member._id === stats.member._id;
                            return (
                                <TouchableOpacity
                                    key={stats.member._id}
                                    style={[styles.contributorItem, isActive && styles.contributorItemActive]}
                                    onPress={() => { setSelectedContributor(stats); if (isMobile) setMobileShowContent(true); }}
                                >
                                    <View style={styles.contributorAvatar}>
                                        {avatarUrl ? (
                                            <Image
                                                source={{ uri: avatarUrl }}
                                                style={styles.contributorAvatarImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <Text style={styles.contributorAvatarText}>{getInitials(name)}</Text>
                                        )}
                                    </View>
                                    <View style={styles.contributorInfo}>
                                        <Text style={styles.contributorName}>{name}</Text>
                                        <View style={styles.contributorBadgeRow}>
                                            <Text style={styles.contributorMessages}>{stats.messageCount} messages</Text>
                                            {memberRole && ROLE_BADGE_COLORS[memberRole] && (
                                                <View style={[styles.badge, { backgroundColor: ROLE_BADGE_COLORS[memberRole], flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                                    {memberRole === 'subgrid_admin' && <BadgeCheck size={12} color="#FFFFFF" />}
                                                    <Text style={styles.badgeText}>{formatBadgeLabel(memberRole)}</Text>
                                                </View>
                                            )}
                                            {stakeholderBadge && (
                                                <View style={[styles.badge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[stakeholderBadge] }]}>
                                                    <Text style={styles.badgeText}>{formatBadgeLabel(stakeholderBadge)}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* User Profile */}
                    <View style={styles.userProfile}>
                        <View style={styles.userAvatarContainer}>
                            <View style={styles.userAvatar}>
                                <Text style={styles.userAvatarText}>{currentUserName[0]?.toUpperCase()}</Text>
                            </View>
                            <View style={styles.onlineIndicator} />
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{currentUserName}</Text>
                            <Text style={styles.userStatusText}>Online</Text>
                        </View>
                        <View style={styles.userActions}>
                            <TouchableOpacity style={styles.userActionBtn}>
                                <Mic size={14} color={colors.textMuted} />
                                <ChevronDown size={10} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.userActionBtn}>
                                <Headphones size={14} color={colors.textMuted} />
                                <ChevronDown size={10} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity>
                                <Settings size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                )}

                {/* Profile Area - full width on mobile, shown when viewing content */}
                {(!isMobile || mobileShowContent) && (
                <View style={[styles.profileArea, isMobile && styles.profileAreaMobile]}>
                    {selectedContributor && (
                        <>
                            {/* Mobile Back Button */}
                            {isMobile && (
                                <View style={styles.mobileProfileHeader}>
                                    <TouchableOpacity onPress={() => setMobileShowContent(false)} style={styles.mobileBackButton}>
                                        <ArrowLeft size={20} color={colors.text} />
                                    </TouchableOpacity>
                                    <Text style={styles.mobileProfileHeaderTitle}>{getMemberName(selectedContributor.member)}</Text>
                                </View>
                            )}
                            {/* Profile Banner */}
                            <View style={[styles.profileBanner, { backgroundColor: activeSubgrid?.coverImageUrl || colors.primary }]}>
                                {/* User banner image or subgrid theme color */}
                                {getMemberBannerUrl(selectedContributor.member) ? (
                                    <Image
                                        source={{ uri: getMemberBannerUrl(selectedContributor.member)! }}
                                        style={styles.bannerImage}
                                        resizeMode="cover"
                                    />
                                ) : null}

                                {/* Header Icons */}
                                <View style={styles.profileHeader}>
                                    <TouchableOpacity style={styles.profileHeaderIcon}>
                                        <UserPlus size={18} color={colors.text} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.profileHeaderIcon}>
                                        <MoreHorizontal size={18} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Profile Content */}
                            <View style={styles.profileContent}>
                                <View style={styles.profileAvatar}>
                                    {getMemberAvatarUrl(selectedContributor.member) ? (
                                        <Image
                                            source={{ uri: getMemberAvatarUrl(selectedContributor.member)! }}
                                            style={styles.profileAvatarImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text style={styles.profileAvatarText}>
                                            {getInitials(getMemberName(selectedContributor.member))}
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.profileName}>
                                    {getMemberName(selectedContributor.member)}
                                </Text>
                                <Text style={styles.profileUsername}>
                                    {getMemberUsername(selectedContributor.member)}
                                </Text>

                                {/* Badges and Company */}
                                {(getMemberRole(selectedContributor.member) || getMemberStakeholderBadge(selectedContributor.member) || getMemberCompany(selectedContributor.member)) && (
                                    <View style={styles.profileBadgeRow}>
                                        {getMemberRole(selectedContributor.member) && ROLE_BADGE_COLORS[getMemberRole(selectedContributor.member)!] && (
                                            <View style={[styles.profileBadge, { backgroundColor: ROLE_BADGE_COLORS[getMemberRole(selectedContributor.member)!], flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                                {getMemberRole(selectedContributor.member) === 'subgrid_admin' && <BadgeCheck size={12} color="#FFFFFF" />}
                                                <Text style={styles.profileBadgeText}>{formatBadgeLabel(getMemberRole(selectedContributor.member)!)}</Text>
                                            </View>
                                        )}
                                        {getMemberStakeholderBadge(selectedContributor.member) && (
                                            <View style={[styles.profileBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getMemberStakeholderBadge(selectedContributor.member)!] }]}>
                                                <Text style={styles.profileBadgeText}>{formatBadgeLabel(getMemberStakeholderBadge(selectedContributor.member)!)}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                                {getMemberCompany(selectedContributor.member) && (
                                    <Text style={styles.companyText}>from {getMemberCompany(selectedContributor.member)}</Text>
                                )}

                                <View style={styles.aboutCard}>
                                    {/* About Section */}
                                    <View style={styles.aboutSection}>
                                        <Text style={styles.aboutLabel}>
                                            About {getMemberName(selectedContributor.member)}
                                        </Text>
                                        <Text style={styles.aboutValue}>
                                            {getMemberRole(selectedContributor.member) === 'subgrid_admin' ? 'Server Administrator' :
                                             getMemberRole(selectedContributor.member) === 'moderator' ? 'Community Moderator' :
                                             getMemberStakeholderBadge(selectedContributor.member) ? formatBadgeLabel(getMemberStakeholderBadge(selectedContributor.member)!) :
                                             'Credit Union Member'}
                                        </Text>
                                    </View>

                                    {/* Email */}
                                    {getMemberEmail(selectedContributor.member) && (
                                        <View style={styles.aboutSection}>
                                            <View style={styles.aboutLabelRow}>
                                                <Mail size={14} color={colors.textMuted} />
                                                <Text style={styles.aboutLabel}>Email</Text>
                                            </View>
                                            <Text style={styles.aboutValue}>{getMemberEmail(selectedContributor.member)}</Text>
                                        </View>
                                    )}

                                    {/* Company */}
                                    {getMemberCompany(selectedContributor.member) && (
                                        <View style={styles.aboutSection}>
                                            <View style={styles.aboutLabelRow}>
                                                <Building2 size={14} color={colors.textMuted} />
                                                <Text style={styles.aboutLabel}>Company</Text>
                                            </View>
                                            <Text style={styles.aboutValue}>{getMemberCompany(selectedContributor.member)}</Text>
                                        </View>
                                    )}

                                    {/* Member Since */}
                                    <View style={styles.aboutSection}>
                                        <View style={styles.aboutLabelRow}>
                                            <Calendar size={14} color={colors.textMuted} />
                                            <Text style={styles.aboutLabel}>Member since</Text>
                                        </View>
                                        <Text style={styles.aboutValue}>
                                            {formatMemberSince(selectedContributor.member.user?.createdAt)}
                                        </Text>
                                    </View>

                                    {/* Contribution Stats */}
                                    <View style={styles.aboutSection}>
                                        <View style={styles.aboutLabelRow}>
                                            <MessageSquare size={14} color={colors.textMuted} />
                                            <Text style={styles.aboutLabel}>Contributions</Text>
                                        </View>
                                        <Text style={styles.aboutValue}>{selectedContributor.messageCount} messages</Text>
                                    </View>
                                </View>
                            </View>
                        </>
                    )}
                </View>
                )}
            </View>
        </View>
    );
}
