import React, { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Image,
    useWindowDimensions,
    Modal,
    Pressable,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Trophy, User, Sun, Moon, X, BadgeCheck, Mail, Calendar, Building2, ArrowLeft, UserPlus, MoreHorizontal } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTenantId, getUserId, StakeholderBadge } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import UserAvatar from '../../components/UserAvatar';
import { useSubgrids, useMembers, usePosts, useSubgridMessages, useTenantId, useCurrentUser } from '../../hooks/queries';

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
    };
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

    const railItems = [
        {
            id: 'messages',
            icon: MessageCircle,
            onPress: () =>
                router.push({
                    pathname: '/(main)/direct-messages',
                    params: { subgridId },
                }),
        },
        {
            id: 'contributors',
            icon: Trophy,
        },
        {
            id: 'profile',
            icon: User,
            onPress: () => router.push('/(main)/profile'),
        },
    ];

    return (
        <SafeAreaView style={styles.safe}>
            <View style={[styles.page, isMobile && styles.pageMobile]}>
                <View style={[styles.grid, isMobile && styles.gridMobile]}>
                    <View style={[styles.leftPanel, isCompact && styles.panelCompact]}>
                        <View style={styles.leftRail}>
                            <TouchableOpacity
                                style={[
                                    styles.railLogo,
                                    activeSubgrid?.coverImageUrl && { backgroundColor: activeSubgrid.coverImageUrl }
                                ]}
                                onPress={handleBack}
                            >
                                {activeSubgrid ? (
                                    activeSubgrid.logoUrl ? (
                                        <Image source={{ uri: activeSubgrid.logoUrl }} style={styles.railLogoImage} />
                                    ) : (
                                        <Text style={styles.railLogoText}>
                                            {(activeSubgrid.name || 'SV').substring(0, 4).toUpperCase()}
                                        </Text>
                                    )
                                ) : null}
                            </TouchableOpacity>
                            {railItems.map((item) => {
                                const isActive = activeRail === item.id;
                                const IconComponent = item.icon;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.railButton, isActive && styles.railButtonActive]}
                                        onPress={() => {
                                            setActiveRail(item.id);
                                            item.onPress?.();
                                        }}
                                    >
                                        <IconComponent size={20} color={isActive ? colors.text : colors.textMuted} />
                                    </TouchableOpacity>
                                );
                            })}
                            <View style={styles.railDivider} />
                            <TouchableOpacity style={styles.railButton} onPress={toggleTheme}>
                                {mode === 'dark' ? (
                                    <Sun size={20} color={colors.textMuted} />
                                ) : (
                                    <Moon size={20} color={colors.textMuted} />
                                )}
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity style={styles.exitButton} onPress={handleBack}>
                                <X size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.mainPanel}>
                            <Text style={styles.panelTitle}>Top Contributors</Text>

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
                            <View style={[styles.profileBanner, { backgroundColor: activeSubgrid?.coverImageUrl || colors.primary }]}>
                                {getMemberBannerUrl(selectedContributor.member) ? (
                                    <Image
                                        source={{ uri: getMemberBannerUrl(selectedContributor.member)! }}
                                        style={styles.bannerImage}
                                        resizeMode="cover"
                                    />
                                ) : null}
                                <View style={styles.profileHeaderActions}>
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
                        </View>
                    )}
                </View>

                {/* Mobile Profile Modal */}
                {isMobile && mobileShowProfile && selectedContributor && (
                    <Modal visible={mobileShowProfile} animationType="slide" presentationStyle="pageSheet">
                        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setMobileShowProfile(false)} style={styles.modalBackButton}>
                                    <ArrowLeft size={20} color={colors.text} />
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>{selectedContributor.name}</Text>
                                <View style={{ width: 28 }} />
                            </View>

                            <ScrollView style={styles.modalContent}>
                                {/* Profile Banner */}
                                <View style={[styles.profileBanner, { backgroundColor: activeSubgrid?.coverImageUrl || colors.primary }]}>
                                    {getMemberBannerUrl(selectedContributor.member) ? (
                                        <Image
                                            source={{ uri: getMemberBannerUrl(selectedContributor.member)! }}
                                            style={styles.bannerImage}
                                            resizeMode="cover"
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
            backgroundColor: colors.appBg,
        },
        page: {
            flex: 1,
            backgroundColor: colors.appBg,
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
            backgroundColor: colors.appBg,
        },
        panelCompact: {
            width: '100%',
        },
        leftRail: {
            width: 72,
            paddingVertical: 20,
            paddingHorizontal: 12,
            alignItems: 'center',
            gap: 12,
            backgroundColor: colors.appBg,
        },
        railLogo: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: '#1E3A8A',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        railLogoImage: {
            width: 48,
            height: 48,
            borderRadius: 12,
        },
        railLogoText: {
            fontSize: 10,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        railButton: {
            width: 48,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        railButtonActive: {
            backgroundColor: colors.surface,
        },
        railDivider: {
            width: 32,
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 8,
        },
        exitButton: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#7F1D1D',
        },
        mainPanel: {
            flex: 1,
            paddingVertical: 20,
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
        },
        contributorRowSelected: {
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surface,
            borderLeftWidth: 1,
            borderLeftColor: colors.border,
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
            backgroundColor: colors.surface,
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
            borderBottomColor: colors.border,
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
