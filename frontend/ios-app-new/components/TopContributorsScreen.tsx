import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import {
    communityGet,
    getUserId,
    resolveTenantId,
} from '../lib/api';

type Member = {
    _id?: string;
    userId?: string;
    role?: string;
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        createdAt?: string;
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

export default function TopContributorsScreen() {
    const { colors, mode, toggleTheme } = useTheme();
    const router = useRouter();

    const [activeSubgridId, setActiveSubgridId] = useState<string | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [contributors, setContributors] = useState<ContributorStats[]>([]);
    const [selectedContributor, setSelectedContributor] = useState<ContributorStats | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError('');
            try {
                const tenantId = await resolveTenantId();
                const userId = getUserId();
                setCurrentUserId(userId);

                if (!tenantId) {
                    setError('No community found. Please join a community first.');
                    setLoading(false);
                    return;
                }

                const subgridsRes = await communityGet(`/tenants/${tenantId}/subgrids`);
                const subgrids = subgridsRes?.data || [];
                if (subgrids.length > 0) {
                    setActiveSubgridId(subgrids[0]._id);
                }
            } catch (err: any) {
                console.error('[TopContributors] Failed to load data:', err);
                setError(err.message || 'Failed to load data');
            } finally {
                setLoading(false);
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

    const currentUser = members.find(m => m.user?._id === currentUserId || m.userId === currentUserId);
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
        profileArea: {
            flex: 1,
            backgroundColor: colors.surface,
        },
        profileBanner: {
            height: 140,
            backgroundColor: '#F8E8E8',
            position: 'relative',
            overflow: 'hidden',
        },
        bannerPattern: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'row',
        },
        bannerShape1: {
            position: 'absolute',
            top: 20,
            left: 40,
            width: 80,
            height: 100,
            backgroundColor: '#2D4A5E',
            transform: [{ rotate: '15deg' }],
        },
        bannerShape2: {
            position: 'absolute',
            top: -20,
            left: 100,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: '#E8B4B4',
        },
        bannerShape3: {
            position: 'absolute',
            top: 30,
            right: 100,
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: '#D4847C',
        },
        bannerShape4: {
            position: 'absolute',
            top: 60,
            right: 40,
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#FAD4D4',
        },
        bannerStripes: {
            position: 'absolute',
            bottom: 20,
            left: 20,
            width: 40,
            height: 60,
        },
        stripe: {
            width: 40,
            height: 4,
            backgroundColor: '#2D4A5E',
            marginBottom: 4,
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
    });

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>Loading...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <MaterialIcons name="error-outline" size={48} color={colors.textMuted} />
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
            {/* Top Navigation */}
            <View style={styles.topNav}>
                <View style={styles.logo}>
                    <Text style={styles.logoIcon}>#</Text>
                    <Text style={styles.logoText}>The Gryd</Text>
                </View>
                <View style={styles.navTabs}>
                    <TouchableOpacity style={styles.navTab} onPress={() => router.push('/admin')}>
                        <Text style={styles.navTabText}>Server</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navTab} onPress={() => router.push('/admin/messages')}>
                        <Text style={styles.navTabText}>Messages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.navTab, styles.navTabActive]}>
                        <Text style={[styles.navTabText, styles.navTabTextActive]}>Top Contributors</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.mainContent}>
                {/* Icon Rail */}
                <View style={styles.iconRail}>
                    <TouchableOpacity style={styles.serverIcon} onPress={() => router.push('/admin')}>
                        <Text style={styles.serverIconText}>RBFCU</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.railIconBtn} onPress={() => router.push('/admin/messages')}>
                        <MaterialIcons name="message" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.railIconBtn}>
                        <MaterialIcons name="settings" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={styles.railIconBtn}>
                        <MaterialIcons name="star" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.railIconBtn} onPress={toggleTheme}>
                        {mode === 'dark' ? (
                            <MaterialIcons name="light-mode" size={18} color={colors.textMuted} />
                        ) : (
                            <MaterialIcons name="dark-mode" size={18} color={colors.textMuted} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Contributors Sidebar */}
                <View style={styles.contributorsSidebar}>
                    <View style={styles.sidebarHeader}>
                        <Text style={styles.sidebarTitle}>Top Contributors</Text>
                    </View>
                    <ScrollView style={styles.contributorsList}>
                        {(contributors || []).map((stats) => {
                            const name = getMemberName(stats.member);
                            const isActive = selectedContributor?.member._id === stats.member._id;
                            return (
                                <TouchableOpacity
                                    key={stats.member._id}
                                    style={[styles.contributorItem, isActive && styles.contributorItemActive]}
                                    onPress={() => setSelectedContributor(stats)}
                                >
                                    <View style={styles.contributorAvatar}>
                                        <Text style={styles.contributorAvatarText}>{getInitials(name)}</Text>
                                    </View>
                                    <View style={styles.contributorInfo}>
                                        <Text style={styles.contributorName}>{name}</Text>
                                        <Text style={styles.contributorMessages}>{stats.messageCount} messages</Text>
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
                                <MaterialIcons name="mic" size={14} color={colors.textMuted} />
                                <MaterialIcons name="expand-more" size={10} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.userActionBtn}>
                                <MaterialIcons name="headphones" size={14} color={colors.textMuted} />
                                <MaterialIcons name="expand-more" size={10} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity>
                                <MaterialIcons name="settings" size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Profile Area */}
                <View style={styles.profileArea}>
                    {selectedContributor && (
                        <>
                            {/* Profile Banner */}
                            <View style={styles.profileBanner}>
                                {/* Decorative shapes */}
                                <View style={styles.bannerShape1} />
                                <View style={styles.bannerShape2} />
                                <View style={styles.bannerShape3} />
                                <View style={styles.bannerShape4} />
                                <View style={styles.bannerStripes}>
                                    <View style={styles.stripe} />
                                    <View style={styles.stripe} />
                                    <View style={styles.stripe} />
                                    <View style={styles.stripe} />
                                    <View style={styles.stripe} />
                                </View>

                                {/* Header Icons */}
                                <View style={styles.profileHeader}>
                                    <TouchableOpacity style={styles.profileHeaderIcon}>
                                        <MaterialIcons name="person-add" size={18} color={colors.text} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.profileHeaderIcon}>
                                        <MaterialIcons name="more-horiz" size={18} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Profile Content */}
                            <View style={styles.profileContent}>
                                <View style={styles.profileAvatar}>
                                    <Text style={styles.profileAvatarText}>
                                        {getInitials(getMemberName(selectedContributor.member))}
                                    </Text>
                                </View>
                                <Text style={styles.profileName}>
                                    {getMemberName(selectedContributor.member)}
                                </Text>
                                <Text style={styles.profileUsername}>
                                    {getMemberUsername(selectedContributor.member)}
                                </Text>

                                <View style={styles.aboutCard}>
                                    <View style={styles.aboutSection}>
                                        <Text style={styles.aboutLabel}>
                                            About {getMemberName(selectedContributor.member)}
                                        </Text>
                                        <Text style={styles.aboutValue}>
                                            Credit Union Member
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.aboutLabel}>Member since</Text>
                                        <Text style={styles.aboutValue}>
                                            {formatMemberSince(selectedContributor.member.user?.createdAt)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </View>
    );
}
