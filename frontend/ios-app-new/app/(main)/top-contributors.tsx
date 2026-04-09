import React, { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    useWindowDimensions,
    Modal,
    Pressable,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Trophy, User, Sun, Moon, X, BadgeCheck, Mail, Calendar, Building2, ArrowLeft, UserPlus, MoreHorizontal, LucideIcon } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTenantId, getUserId, StakeholderBadge } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import UserAvatar from '../../components/UserAvatar';
import { useSubgrids, useMembers, usePosts, useSubgridMessages, useTenantId, useCurrentUser } from '../../hooks/queries';
import { GlassIconButton, GlassRail } from '../../components/glass';

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
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
    userRole?: string;
    stakeholderBadge?: StakeholderBadge;
    company?: string;
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        username?: string;
        avatarUrl?: string;
        bannerUrl?: string;
        profilePicture?: string;
        coverImage?: string;
        createdAt?: string;
        role?: string;
        stakeholderBadge?: StakeholderBadge;
        company?: string;
        isPrivate?: boolean;
    };
    isPrivate?: boolean;
};

const getMemberAvatarUrl = (member: Member) => {
    return member.avatarUrl || member.user?.avatarUrl || member.user?.profilePicture || null;
};

const getMemberBannerUrl = (member: Member): string | null => {
    return member.user?.bannerUrl || member.user?.coverImage || null;
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
    return member.user?.email || member.email || null;
};

const isMemberPrivate = (member: Member): boolean => {
    return member.isPrivate === true || member.user?.isPrivate === true;
};

const formatBadgeLabel = (badge: StakeholderBadge | string): string => {
    if (badge === 'subgrid_admin') return 'Server Admin';
    return badge.charAt(0).toUpperCase() + badge.slice(1).replace('_', ' ');
};

const formatMemberSince = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

type Post = {
    _id: string;
    authorId?: string;
};

type Message = {
    _id: string;
    authorId?: string;
};

type ContributorData = {
    member: Member;
    name: string;
    username: string;
    messageCount: number;
};

type Subgrid = {
    _id: string;
    name?: string;
    logoUrl?: string;
    coverImageUrl?: string;
};

const normalizeParam = (value?: string | string[]) => {
    if (Array.isArray(value)) {
        return value[0] || '';
    }
    return value || '';
};

const TopContributorsScreen = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { width } = useWindowDimensions();
    const isCompact = width < 1200;
    const isMobile = width < 900;
    const router = useRouter();
    const params = useLocalSearchParams();
    const initialSubgridId = normalizeParam(params.subgridId);
    const [subgridId, setSubgridId] = useState(initialSubgridId);
    const [error, setError] = useState('');
    const [activeRail, setActiveRail] = useState('contributors');
    const [selectedContributor, setSelectedContributor] = useState<ContributorData | null>(null);
    const [mobileShowProfile, setMobileShowProfile] = useState(false);

    // React Query hooks
    const tenantIdQuery = useTenantId();
    const tenantId = tenantIdQuery.data || '';
    const subgridsQuery = useSubgrids(tenantId);
    const membersQuery = useMembers(subgridId);
    const postsQuery = usePosts(subgridId);
    const messagesQuery = useSubgridMessages(subgridId);

    // Derived data from React Query
    const subgrids: Subgrid[] = subgridsQuery.data || [];
    const members: Member[] = membersQuery.data || [];
    const posts: Post[] = postsQuery.data || [];
    const messages: Message[] = messagesQuery.data || [];
    const loading = membersQuery.isLoading || postsQuery.isLoading || messagesQuery.isLoading;

    // Set default subgrid when subgrids load
    useEffect(() => {
        if (subgrids.length > 0) {
            setSubgridId((current) => {
                if (!current) return subgrids[0]._id;
                return current;
            });
        }
    }, [subgrids]);

    const activeSubgrid = useMemo(
        () => subgrids.find((s) => s._id === subgridId) || null,
        [subgrids, subgridId]
    );

    // Calculate contributor stats from real data
    const contributors = useMemo(() => {
        if (members.length === 0) {
            return [];
        }

        const contributorList: ContributorData[] = members.map((member) => {
            const userId = member.user?._id || member.userId;
            const userPosts = posts.filter((p) => p.authorId === userId);
            const userMessages = messages.filter((m) => m.authorId === userId);
            const messageCount = userPosts.length + userMessages.length;

            // Check both direct fields (from enriched API) and nested user object
            const firstName = member.firstName || member.user?.firstName;
            const lastName = member.lastName || member.user?.lastName;
            const email = member.email || member.user?.email;
            const existingUsername = member.username || member.user?.username;

            const name = firstName && lastName
                ? `${firstName} ${lastName}`.trim()
                : firstName || email || 'Unknown User';
            const username = existingUsername
                || (firstName ? `${firstName.toLowerCase()}${(lastName || '').slice(0, 3).toLowerCase()}` : `user${(userId || '').slice(-6)}`);

            return {
                member,
                name,
                username,
                messageCount,
            };
        });

        // Sort by message count descending
        contributorList.sort((a, b) => b.messageCount - a.messageCount);
        return contributorList;
    }, [members, posts, messages]);

    const handleBack = () => {
        router.push('/(main)');
    };

    const railItems: { id: string; Icon: LucideIcon; onPress?: () => void }[] = [
        {
            id: 'messages',
            Icon: MessageCircle,
            onPress: () =>
                router.push({
                    pathname: '/(main)/direct-messages',
                    params: { subgridId },
                }),
        },
        {
            id: 'contributors',
            Icon: Trophy,
        },
        {
            id: 'profile',
            Icon: User,
            onPress: () => router.push('/(main)/profile'),
        },
    ];

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <View style={[styles.page, isMobile && styles.pageMobile]}>
                <View style={[styles.grid, isMobile && styles.gridMobile]}>
                    <View style={[styles.leftPanel, isCompact && styles.panelCompact]}>
                        <GlassRail
                            serverLogo={{
                                uri: activeSubgrid?.logoUrl,
                                name: activeSubgrid?.name,
                                onPress: handleBack,
                            }}
                            items={railItems.map((item) => {
                                const isActive = activeRail === item.id;
                                return {
                                    id: item.id,
                                    icon: <item.Icon size={20} color={colors.textMuted} />,
                                    activeIcon: <item.Icon size={20} color={colors.glassActiveText} />,
                                    onPress: () => {
                                        setActiveRail(item.id);
                                        item.onPress?.();
                                    },
                                    isActive,
                                };
                            })}
                            onToggleTheme={toggleTheme}
                            onLogout={handleBack}
                        />

                        <View style={styles.mainPanel}>
                            <Text style={styles.panelTitle}>Leaderboard</Text>

                            {!!error && <Text style={styles.errorText}>{error}</Text>}

                            <ScrollView contentContainerStyle={styles.contributorList} showsVerticalScrollIndicator={false}>
                                {contributors.length === 0 ? (
                                    <Text style={styles.emptyText}>No contributors yet</Text>
                                ) : (
                                    contributors.map((contributor, index) => {
                                        const memberRole = getMemberRole(contributor.member);
                                        const stakeholderBadge = getMemberStakeholderBadge(contributor.member);
                                        const isSelected = selectedContributor?.member._id === contributor.member._id;
                                        return (
                                            <TouchableOpacity
                                                key={contributor.member._id || index}
                                                style={[styles.contributorRow, isSelected && styles.contributorRowSelected]}
                                                onPress={() => {
                                                    setSelectedContributor(contributor);
                                                    if (isMobile) setMobileShowProfile(true);
                                                }}
                                            >
                                                <UserAvatar
                                                    uri={getMemberAvatarUrl(contributor.member)}
                                                    name={contributor.name}
                                                    style={styles.contributorAvatar}
                                                />
                                                <View style={styles.contributorInfo}>
                                                    <Text style={styles.contributorName}>{contributor.name}</Text>
                                                    <View style={styles.contributorBadgeRow}>
                                                        <Text style={styles.contributorUsername}>@{contributor.username}</Text>
                                                        {memberRole && ROLE_BADGE_COLORS[memberRole] && (
                                                            <View style={[styles.badge, { backgroundColor: ROLE_BADGE_COLORS[memberRole] }]}>
                                                                {memberRole === 'subgrid_admin' && <BadgeCheck size={10} color="#FFFFFF" style={{ marginRight: 3 }} />}
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
                                                <Text style={styles.contributorMessages}>{contributor.messageCount} messages</Text>
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </ScrollView>
                        </View>
                    </View>

                    {/* Profile Detail Panel - shown on larger screens or as modal on mobile */}
                    {!isMobile && selectedContributor && (
                        <View style={styles.profilePanel}>
                            {/* Profile Banner */}
                            <View style={[styles.profileBanner, { backgroundColor: colors.primary }]}>
                                {getMemberBannerUrl(selectedContributor.member) ? (
                                    <Image
                                        source={{ uri: getMemberBannerUrl(selectedContributor.member)! }}
                                        style={styles.bannerImage}
                                        resizeMode="cover"
                                        cachePolicy="memory-disk"
                                    />
                                ) : null}
                                <View style={styles.profileHeaderActions}>
                                    <GlassIconButton
                                        icon={<UserPlus size={18} color={colors.text} />}
                                        onPress={() => {}}
                                        variant="default"
                                        size="sm"
                                        accessibilityLabel="Add friend"
                                    />
                                    <GlassIconButton
                                        icon={<MoreHorizontal size={18} color={colors.text} />}
                                        onPress={() => {}}
                                        variant="default"
                                        size="sm"
                                        accessibilityLabel="More options"
                                    />
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
                                            cachePolicy="memory-disk"
                                        />
                                    ) : (
                                        <Text style={styles.profileAvatarText}>
                                            {getInitials(selectedContributor.name)}
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.profileName}>{selectedContributor.name}</Text>
                                <Text style={styles.profileUsername}>@{selectedContributor.username}</Text>

                                {/* Badges */}
                                <View style={styles.profileBadges}>
                                    {getMemberRole(selectedContributor.member) && ROLE_BADGE_COLORS[getMemberRole(selectedContributor.member)!] && (
                                        <View style={[styles.profileBadge, { backgroundColor: ROLE_BADGE_COLORS[getMemberRole(selectedContributor.member)!] }]}>
                                            {getMemberRole(selectedContributor.member) === 'subgrid_admin' && <BadgeCheck size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                                            <Text style={styles.profileBadgeText}>{formatBadgeLabel(getMemberRole(selectedContributor.member)!)}</Text>
                                        </View>
                                    )}
                                    {getMemberStakeholderBadge(selectedContributor.member) && (
                                        <View style={[styles.profileBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getMemberStakeholderBadge(selectedContributor.member)!] }]}>
                                            <Text style={styles.profileBadgeText}>{formatBadgeLabel(getMemberStakeholderBadge(selectedContributor.member)!)}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* About Card */}
                                <View style={styles.aboutCard}>
                                    {isMemberPrivate(selectedContributor.member) ? (
                                        <View style={styles.aboutSection}>
                                            <Text style={[styles.aboutValue, { textAlign: 'center', fontStyle: 'italic' }]}>
                                                This member's profile is private. Send a friend request to see their details.
                                            </Text>
                                        </View>
                                    ) : (
                                    <>
                                    <View style={styles.aboutSection}>
                                        <Text style={styles.aboutLabel}>About {selectedContributor.name}</Text>
                                        <Text style={styles.aboutValue}>
                                            {getMemberRole(selectedContributor.member) === 'subgrid_admin' ? 'Server Administrator' :
                                             getMemberRole(selectedContributor.member) === 'moderator' ? 'Community Moderator' :
                                             getMemberStakeholderBadge(selectedContributor.member) ? formatBadgeLabel(getMemberStakeholderBadge(selectedContributor.member)!) :
                                             'Community Member'}
                                        </Text>
                                    </View>

                                    {getMemberEmail(selectedContributor.member) && (
                                        <View style={styles.aboutSection}>
                                            <View style={styles.aboutLabelRow}>
                                                <Mail size={14} color={colors.textMuted} />
                                                <Text style={styles.aboutLabel}>Email</Text>
                                            </View>
                                            <Text style={styles.aboutValue}>{getMemberEmail(selectedContributor.member)}</Text>
                                        </View>
                                    )}

                                    {getMemberCompany(selectedContributor.member) && (
                                        <View style={styles.aboutSection}>
                                            <View style={styles.aboutLabelRow}>
                                                <Building2 size={14} color={colors.textMuted} />
                                                <Text style={styles.aboutLabel}>Company</Text>
                                            </View>
                                            <Text style={styles.aboutValue}>{getMemberCompany(selectedContributor.member)}</Text>
                                        </View>
                                    )}
                                    </>
                                    )}

                                    <View style={styles.aboutSection}>
                                        <View style={styles.aboutLabelRow}>
                                            <Calendar size={14} color={colors.textMuted} />
                                            <Text style={styles.aboutLabel}>Member since</Text>
                                        </View>
                                        <Text style={styles.aboutValue}>{formatMemberSince(selectedContributor.member.user?.createdAt)}</Text>
                                    </View>

                                    <View style={styles.aboutSection}>
                                        <View style={styles.aboutLabelRow}>
                                            <MessageCircle size={14} color={colors.textMuted} />
                                            <Text style={styles.aboutLabel}>Contributions</Text>
                                        </View>
                                        <Text style={styles.aboutValue}>{selectedContributor.messageCount} messages</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Mobile Profile Modal */}
                {isMobile && mobileShowProfile && selectedContributor && (
                    <Modal visible={mobileShowProfile} animationType="slide" presentationStyle="pageSheet">
                        <SafeAreaView style={[styles.modalContainer, { backgroundColor: mode === 'dark' ? '#05050E' : '#F4F6FF' }]}>
                            <View style={styles.modalHeader}>
                                <GlassIconButton
                                    icon={<ArrowLeft size={20} color={colors.text} />}
                                    onPress={() => setMobileShowProfile(false)}
                                    variant="default"
                                    size="sm"
                                    accessibilityLabel="Go back"
                                />
                                <Text style={styles.modalTitle}>{selectedContributor.name}</Text>
                                <View style={{ width: 32 }} />
                            </View>

                            <ScrollView style={styles.modalContent}>
                                {/* Profile Banner */}
                                <View style={[styles.profileBanner, { backgroundColor: colors.primary }]}>
                                    {getMemberBannerUrl(selectedContributor.member) ? (
                                        <Image
                                            source={{ uri: getMemberBannerUrl(selectedContributor.member)! }}
                                            style={styles.bannerImage}
                                            resizeMode="cover"
                                            cachePolicy="memory-disk"
                                        />
                                    ) : null}
                                </View>

                                {/* Profile Content */}
                                <View style={styles.profileContent}>
                                    <View style={styles.profileAvatar}>
                                        {getMemberAvatarUrl(selectedContributor.member) ? (
                                            <Image
                                                source={{ uri: getMemberAvatarUrl(selectedContributor.member)! }}
                                                style={styles.profileAvatarImage}
                                                resizeMode="cover"
                                                cachePolicy="memory-disk"
                                            />
                                        ) : (
                                            <Text style={styles.profileAvatarText}>
                                                {getInitials(selectedContributor.name)}
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={styles.profileName}>{selectedContributor.name}</Text>
                                    <Text style={styles.profileUsername}>@{selectedContributor.username}</Text>

                                    {/* Badges */}
                                    <View style={styles.profileBadges}>
                                        {getMemberRole(selectedContributor.member) && ROLE_BADGE_COLORS[getMemberRole(selectedContributor.member)!] && (
                                            <View style={[styles.profileBadge, { backgroundColor: ROLE_BADGE_COLORS[getMemberRole(selectedContributor.member)!] }]}>
                                                {getMemberRole(selectedContributor.member) === 'subgrid_admin' && <BadgeCheck size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
                                                <Text style={styles.profileBadgeText}>{formatBadgeLabel(getMemberRole(selectedContributor.member)!)}</Text>
                                            </View>
                                        )}
                                        {getMemberStakeholderBadge(selectedContributor.member) && (
                                            <View style={[styles.profileBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getMemberStakeholderBadge(selectedContributor.member)!] }]}>
                                                <Text style={styles.profileBadgeText}>{formatBadgeLabel(getMemberStakeholderBadge(selectedContributor.member)!)}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* About Card */}
                                    <View style={styles.aboutCard}>
                                        <View style={styles.aboutSection}>
                                            <Text style={styles.aboutLabel}>About {selectedContributor.name}</Text>
                                            <Text style={styles.aboutValue}>
                                                {getMemberRole(selectedContributor.member) === 'subgrid_admin' ? 'Server Administrator' :
                                                 getMemberRole(selectedContributor.member) === 'moderator' ? 'Community Moderator' :
                                                 getMemberStakeholderBadge(selectedContributor.member) ? formatBadgeLabel(getMemberStakeholderBadge(selectedContributor.member)!) :
                                                 'Community Member'}
                                            </Text>
                                        </View>

                                        {getMemberEmail(selectedContributor.member) && (
                                            <View style={styles.aboutSection}>
                                                <View style={styles.aboutLabelRow}>
                                                    <Mail size={14} color={colors.textMuted} />
                                                    <Text style={styles.aboutLabel}>Email</Text>
                                                </View>
                                                <Text style={styles.aboutValue}>{getMemberEmail(selectedContributor.member)}</Text>
                                            </View>
                                        )}

                                        {getMemberCompany(selectedContributor.member) && (
                                            <View style={styles.aboutSection}>
                                                <View style={styles.aboutLabelRow}>
                                                    <Building2 size={14} color={colors.textMuted} />
                                                    <Text style={styles.aboutLabel}>Company</Text>
                                                </View>
                                                <Text style={styles.aboutValue}>{getMemberCompany(selectedContributor.member)}</Text>
                                            </View>
                                        )}

                                        <View style={styles.aboutSection}>
                                            <View style={styles.aboutLabelRow}>
                                                <Calendar size={14} color={colors.textMuted} />
                                                <Text style={styles.aboutLabel}>Member since</Text>
                                            </View>
                                            <Text style={styles.aboutValue}>{formatMemberSince(selectedContributor.member.user?.createdAt)}</Text>
                                        </View>

                                        <View style={styles.aboutSection}>
                                            <View style={styles.aboutLabelRow}>
                                                <MessageCircle size={14} color={colors.textMuted} />
                                                <Text style={styles.aboutLabel}>Contributions</Text>
                                            </View>
                                            <Text style={styles.aboutValue}>{selectedContributor.messageCount} messages</Text>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>
                        </SafeAreaView>
                    </Modal>
                )}
            </View>
        </SafeAreaView>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        page: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        pageMobile: {
            padding: 0,
        },
        grid: {
            flex: 1,
            flexDirection: 'row',
        },
        gridMobile: {
            flexDirection: 'column',
        },
        leftPanel: {
            flexDirection: 'row',
            width: 420,
            backgroundColor: 'transparent',
        },
        panelCompact: {
            width: '100%',
        },
        mainPanel: {
            flex: 1,
            paddingVertical: 20,
            paddingLeft: 16,
            paddingRight: 20,
            gap: 20,
        },
        panelTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        errorText: {
            fontSize: 11,
            color: colors.dangerText,
        },
        contributorList: {
            gap: 16,
            paddingBottom: 24,
        },
        emptyText: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            padding: 20,
        },
        contributorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 8,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        contributorRowSelected: {
            backgroundColor: colors.glassActiveBg,
        },
        contributorAvatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
        },
        contributorInfo: {
            flex: 1,
            gap: 2,
        },
        contributorName: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        contributorUsername: {
            fontSize: 13,
            color: colors.textMuted,
        },
        contributorBadgeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
        },
        badge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
        },
        badgeText: {
            fontSize: 9,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        contributorMessages: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        // Profile Panel styles
        profilePanel: {
            flex: 1,
            backgroundColor: colors.glassBg,
            borderLeftWidth: 1,
            borderLeftColor: colors.glassBorder,
        },
        profileBanner: {
            height: 180,
            backgroundColor: '#F8E8E8',
            position: 'relative',
            overflow: 'hidden',
        },
        bannerImage: {
            width: '100%',
            height: '100%',
        },
        profileHeaderActions: {
            position: 'absolute',
            top: 16,
            right: 16,
            flexDirection: 'row',
            gap: 8,
        },
        profileHeaderIcon: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            alignItems: 'center',
            justifyContent: 'center',
        },
        profileContent: {
            padding: 24,
            marginTop: -50,
        },
        profileAvatar: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: colors.glassBorder,
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
            color: colors.text,
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
            marginBottom: 16,
        },
        profileBadges: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
            flexWrap: 'wrap',
        },
        profileBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
        },
        profileBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        aboutCard: {
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
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
        // Mobile Modal styles
        modalContainer: {
            flex: 1,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        modalBackButton: {
            padding: 4,
        },
        modalTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        modalContent: {
            flex: 1,
        },
    });

export default TopContributorsScreen;
