import React, { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { communityGet, getTenantId, resolveTenantId } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import UserAvatar from '../../components/UserAvatar';

type Member = {
    _id?: string;
    userId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        username?: string;
        avatarUrl?: string;
    };
};

const getMemberAvatarUrl = (member: Member) => {
    return member.avatarUrl || member.user?.avatarUrl || null;
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
    const [tenantId, setTenantId] = useState(getTenantId());
    const [subgridId, setSubgridId] = useState(initialSubgridId);
    const [members, setMembers] = useState<Member[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [contributors, setContributors] = useState<ContributorData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeRail, setActiveRail] = useState('contributors');

    useEffect(() => {
        let isActive = true;
        resolveTenantId()
            .then((id) => {
                if (isActive) {
                    setTenantId(id || '');
                }
            })
            .catch((err) => {
                if (isActive) {
                    setError(err.message || 'Failed to resolve tenant.');
                }
            });
        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        const loadSubgrids = async () => {
            if (!tenantId) return;
            if (subgridId) return;
            try {
                const response = await communityGet(`/tenants/${tenantId}/subgrids`);
                const list = response?.data || [];
                if (!subgridId && list.length > 0) {
                    setSubgridId(list[0]._id);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load subgrids.');
            }
        };

        loadSubgrids();
    }, [tenantId, subgridId]);

    useEffect(() => {
        const loadData = async () => {
            if (!subgridId) return;
            setLoading(true);
            setError('');
            try {
                const [membersRes, postsRes, messagesRes] = await Promise.allSettled([
                    communityGet(`/subgrids/${subgridId}/members`),
                    communityGet(`/subgrids/${subgridId}/posts`),
                    communityGet(`/subgrids/${subgridId}/messages`),
                ]);

                const loadedMembers = membersRes.status === 'fulfilled' ? (membersRes.value?.data || []) : [];
                const loadedPosts = postsRes.status === 'fulfilled' ? (postsRes.value?.data || []) : [];
                const loadedMessages = messagesRes.status === 'fulfilled' ? (messagesRes.value?.data || []) : [];

                setMembers(loadedMembers);
                setPosts(loadedPosts);
                setMessages(loadedMessages);
            } catch (err: any) {
                setMembers([]);
                setError(err.message || 'Failed to load data.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [subgridId]);

    // Calculate contributor stats from real data
    useEffect(() => {
        if (members.length === 0) {
            setContributors([]);
            return;
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
        setContributors(contributorList);
    }, [members, posts, messages]);

    const handleBack = () => {
        router.push('/(main)');
    };

    const railItems = [
        {
            id: 'messages',
            icon: 'chat-bubble-outline' as const,
            onPress: () =>
                router.push({
                    pathname: '/(main)/direct-messages',
                    params: { subgridId },
                }),
        },
        {
            id: 'contributors',
            icon: 'emoji-events' as const,
        },
        {
            id: 'profile',
            icon: 'person-outline' as const,
            onPress: () => router.push('/(main)/profile'),
        },
    ];

    return (
        <SafeAreaView style={styles.safe}>
            <View style={[styles.page, isMobile && styles.pageMobile]}>
                <View style={[styles.grid, isMobile && styles.gridMobile]}>
                    <View style={[styles.leftPanel, isCompact && styles.panelCompact]}>
                        <View style={styles.leftRail}>
                            <TouchableOpacity style={styles.railLogo} onPress={handleBack}>
                                <MaterialIcons name="grid-view" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                            {railItems.map((item) => {
                                const isActive = activeRail === item.id;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.railButton, isActive && styles.railButtonActive]}
                                        onPress={() => {
                                            setActiveRail(item.id);
                                            item.onPress?.();
                                        }}
                                    >
                                        <MaterialIcons name={item.icon} size={20} color={isActive ? colors.text : colors.textMuted} />
                                    </TouchableOpacity>
                                );
                            })}
                            <View style={styles.railDivider} />
                            <TouchableOpacity style={styles.railButton} onPress={toggleTheme}>
                                <MaterialIcons
                                    name={mode === 'dark' ? 'light-mode' : 'dark-mode'}
                                    size={20}
                                    color={colors.textMuted}
                                />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity style={styles.exitButton} onPress={handleBack}>
                                <MaterialIcons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.mainPanel}>
                            <Text style={styles.panelTitle}>Top Contributors</Text>

                            {!!error && <Text style={styles.errorText}>{error}</Text>}

                            <ScrollView contentContainerStyle={styles.contributorList} showsVerticalScrollIndicator={false}>
                                {contributors.length === 0 ? (
                                    <Text style={styles.emptyText}>No contributors yet</Text>
                                ) : (
                                    contributors.map((contributor, index) => (
                                        <View key={contributor.member._id || index} style={styles.contributorRow}>
                                            <UserAvatar
                                                uri={getMemberAvatarUrl(contributor.member)}
                                                name={contributor.name}
                                                style={styles.contributorAvatar}
                                            />
                                            <View style={styles.contributorInfo}>
                                                <Text style={styles.contributorName}>{contributor.name}</Text>
                                                <Text style={styles.contributorUsername}>@{contributor.username}</Text>
                                            </View>
                                            <Text style={styles.contributorMessages}>{contributor.messageCount} messages</Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </View>
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
        contributorMessages: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
    });

export default TopContributorsScreen;
