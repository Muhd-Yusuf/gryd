
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    useWindowDimensions,
    Platform,
    Modal,
    Animated,
    Alert,
    Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ChevronDown,
    Hash,
    MoreHorizontal,
    Search,
    Send,
    UserPlus,
    Lock,
    Heart,
    MessageCircle,
    Volume2,
    Repeat2,
    Sun,
    Moon,
    X,
    Calendar,
    Megaphone,
    Clock,
    MapPin,
    BadgeCheck,
    File,
    Trash2,
    PlusCircle,
    Paperclip,
    Smile,
    Mic,
    Flag,
    Trophy,
    User,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { communityGet, communityPost, communityDelete, getTenantId, getUserId, resolveTenantId, resolveUserId, initiateChannelCall, uploadFile, logout } from '../../lib/api';
import { cacheUsers, getCachedSubgrids, cacheSubgrids, cacheFriends } from '../../lib/userCache';
import { useTheme } from '../../lib/theme';
import { Attachment, formatDuration, formatRelativeTime, formatMessageDate, twemojiUrl } from '../../lib/chatMedia';
import UserAvatar from '../../components/UserAvatar';
import VoiceMessagePlayer from '../../components/VoiceMessagePlayer';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import {
    useSubgrids,
    useChannels,
    usePosts,
    useMembers,
    useFriends,
    useEvents,
    useCategories,
    useChannelMessages,
    useDirectMessages,
    useSendChannelMessage,
} from '../../hooks/queries';
import { queryKeys } from '../../lib/queryClient';

type Channel = {
    _id: string;
    name?: string;
    unreadCount?: number;
    messageCount?: number;
    messagesCount?: number;
    count?: number;
    isPrivate?: boolean;
    visibility?: string;
    type?: 'text' | 'video' | 'voice';
    categoryId?: string | null;
    allowedMembers?: string[];
};

type Category = {
    _id: string;
    name?: string;
    visibility?: 'public' | 'private';
    order?: number;
    createdAt?: string;
};

type ChannelGroup = {
    groupId: string;
    groupName: string;
    order: number;
    channels: Channel[];
};

type Subgrid = {
    _id: string;
    name?: string;
    logoUrl?: string;
    coverImageUrl?: string;
};

type Post = {
    _id: string;
    authorId?: string;
    body?: string;
    createdAt?: string;
    attachments?: Array<Attachment | string>;
    likeCount?: number;
    reshareCount?: number;
    commentCount?: number;
    userLiked?: boolean;
    userReshared?: boolean;
};

type Message = {
    _id: string;
    senderId?: string;
    body?: string;
    kind?: string;
    attachments?: Array<Attachment | string>;
    createdAt?: string;
};

type StakeholderBadge = 'stakeholder' | 'vendor' | 'partner' | 'sponsor' | 'investor';

type Member = {
    userId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    avatarUrl?: string;
    username?: string;
    userRole?: string;
    stakeholderBadge?: StakeholderBadge;
    company?: string;
};

type Event = {
    _id: string;
    title?: string;
    description?: string;
    eventType?: 'event' | 'announcement';
    startDate?: string;
    endDate?: string;
    location?: string;
    createdBy?: string;
    status?: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
    createdAt?: string;
};

const STAKEHOLDER_BADGE_COLORS: Record<StakeholderBadge, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};

// Mapping icon names to Lucide components for rail buttons
const RAIL_ICONS: Record<string, any> = {
    'chat-bubble-outline': MessageCircle,
    'emoji-events': Trophy,
    'person-outline': User,
};

type UserProfile = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
};

const labelFromId = (value?: string) => {
    if (!value) return 'Member';
    return `Member ${String(value).slice(-6)}`;
};

const formatTime = (value?: string) => {
    return formatMessageDate(value);
};

const getChannelIcon = (channel: Channel) => {
    const name = String(channel.name || '').toLowerCase();
    if (channel.isPrivate || channel.visibility === 'admin' || name.includes('private')) return 'lock';
    if (channel.type === 'video' || channel.type === 'voice' || name.includes('video')) return 'video';
    return 'hash';
};

const buildName = (value?: string, user?: UserProfile) => {
    if (user) {
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        return name || user.email || labelFromId(value);
    }
    return labelFromId(value);
};

const normalizeAttachments = (attachments?: Array<Attachment | string>) => {
    const raw = Array.isArray(attachments) ? attachments : [];
    return raw
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') {
                // Detect if string is an image URL
                const lowerItem = item.toLowerCase();
                if (lowerItem.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || lowerItem.includes('cloudinary') || lowerItem.includes('/image/')) {
                    return {
                        type: 'image' as const,
                        value: item,
                        uri: item,
                    };
                }
                return {
                    type: 'sticker' as const,
                    value: item,
                    uri: item,
                };
            }
            const typed = item as Attachment & { uri?: string };
            // Reshare attachments don't have uri/value - pass them through as-is
            if (typed.type === 'reshare') {
                return typed;
            }
            const uri = typed.uri || (typed.type === 'emoji' ? twemojiUrl(typed.value) : typed.value);
            return { ...typed, uri };
        })
        .filter(Boolean) as Array<Attachment & { uri?: string }>;
};

const REPORT_REASONS = ['Spam', 'Harassment', 'Hate speech', 'Scam', 'Nudity', 'Other'];

const TenantCommunityScreen = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const { width } = useWindowDimensions();
    const isCompact = width < 1200;
    const isMobile = width < 900;
    const insets = useSafeAreaInsets();
    // Calculate safe area values for mobile
    const bottomInset = Platform.OS !== 'web' && isMobile ? Math.max(insets.bottom, 12) : 0;
    const styles = useMemo(() => createStyles(colors, bottomInset), [colors, bottomInset]);
    const showCenterPanel = !isMobile;
    const showRightPanel = !isCompact;
    const [userId, setUserId] = useState(getUserId());
    const queryClient = useQueryClient();
    const { subscribe, joinRoom, leaveRoom, isConnected } = useWebSocketContext();
    const [tenantId, setTenantId] = useState(getTenantId());
    const [activeSubgridId, setActiveSubgridId] = useState(() => {
        const tid = getTenantId();
        const cached = tid ? getCachedSubgrids(tid) : null;
        return cached && cached.length > 0 ? cached[0]._id : '';
    });
    const [activeChannelId, setActiveChannelId] = useState('');
    const activeChannelIdRef = useRef(activeChannelId);
    activeChannelIdRef.current = activeChannelId;
    const [channelDraft, setChannelDraft] = useState('');
    const [showEventsView, setShowEventsView] = useState(false);
    const [directMessagePeers, setDirectMessagePeers] = useState<string[]>([]);
    const [activeDmId, setActiveDmId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [activeRail, setActiveRail] = useState('home');
    const [error, setError] = useState('');
    const [feedMenuOpen, setFeedMenuOpen] = useState<string | null>(null);
    const [feedMenuPosition, setFeedMenuPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const [feedMenuItem, setFeedMenuItem] = useState<any>(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
    const [reportNotes, setReportNotes] = useState('');
    const [reportTarget, setReportTarget] = useState<{ id: string; type: 'post' | 'message' } | null>(null);
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'post' | 'message' } | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const router = useRouter();

    // React Query hooks for data fetching with caching
    const subgridsQuery = useSubgrids(tenantId);
    const channelsQuery = useChannels(activeSubgridId);
    const postsQuery = usePosts(activeSubgridId);
    const membersQuery = useMembers(activeSubgridId);
    const friendsQuery = useFriends(activeSubgridId);
    const eventsQuery = useEvents(activeSubgridId);
    const categoriesQuery = useCategories(activeSubgridId);
    const messagesQuery = useChannelMessages(activeSubgridId, activeChannelId);
    const dmMessagesQuery = useDirectMessages(activeSubgridId, activeDmId);

    // Mutations for sending messages
    const sendChannelMessage = useSendChannelMessage(activeSubgridId, activeChannelId);
    // Derive data from queries (memoize fallbacks to prevent infinite loops)
    const subgrids = subgridsQuery.data || [];
    const channels = channelsQuery.data || [];
    const posts = postsQuery.data || [];
    const members = membersQuery.data || [];
    const memberCount = members.length;
    const friendsData = friendsQuery.data;
    const friends = useMemo(() => friendsData?.friends || [], [friendsData?.friends]);
    const friendUsers = useMemo(() => friendsData?.users || {}, [friendsData?.users]);
    const events = eventsQuery.data || [];
    const categories = categoriesQuery.data || [];
    const messages = messagesQuery.data || [];
    const dmMessages = dmMessagesQuery.data || [];

    const handleLogout = async () => {
        try {
            await logout();
            router.replace('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    // Attachment and recording state
    const [attachments, setAttachments] = useState<Array<{ uri: string; name: string; type: string }>>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [likeLoading, setLikeLoading] = useState<string | null>(null);
    const [reshareLoading, setReshareLoading] = useState<string | null>(null);
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [commentTarget, setCommentTarget] = useState<{ id: string; isPost: boolean } | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);
    const recordingInterval = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<any | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStartRef = useRef<number>(0);
    const activeAudioStreamRef = useRef<any | null>(null);
    const waveformAnim = useRef(new Animated.Value(0)).current;
    const feedScrollRef = useRef<ScrollView>(null);

    // expo-audio recorder hook (for native platforms)
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

    const EMOJI_GRID = [
        ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊'],
        ['😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝'],
        ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🤚', '🖐️', '✋'],
        ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💖'],
    ];

    // Resolve tenant ID and user ID on mount
    useEffect(() => {
        let isActive = true;
        // Resolve tenant ID
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
        // Resolve user ID (important for mobile where async bootstrap is needed)
        resolveUserId()
            .then((id) => {
                if (isActive && id) {
                    setUserId(id);
                    console.log('[MemberDashboard] Resolved userId:', id);
                }
            })
            .catch((err) => {
                console.error('[MemberDashboard] Failed to resolve userId:', err);
            });
        return () => {
            isActive = false;
        };
    }, []);

    // Set active subgrid when subgrids load
    useEffect(() => {
        if (subgrids.length > 0) {
            // Use functional update to avoid infinite loop
            setActiveSubgridId((current) => {
                if (!current) return subgrids[0]._id;
                return current;
            });
            // Cache subgrids for offline/instant loading
            if (tenantId) {
                cacheSubgrids(tenantId, subgrids);
            }
        }
    }, [subgrids, tenantId]);

    // Cache members for DM loading (backward compatibility)
    useEffect(() => {
        if (members.length > 0) {
            const memberProfiles: Record<string, any> = {};
            members.forEach((m: any) => {
                if (m.userId) {
                    memberProfiles[m.userId] = {
                        id: m.userId,
                        firstName: m.firstName,
                        lastName: m.lastName,
                        email: m.email,
                        avatarUrl: m.avatarUrl,
                        role: m.role || m.userRole,
                    };
                }
            });
            cacheUsers(memberProfiles);
        }
    }, [members]);

    // Cache friends data
    useEffect(() => {
        if (activeSubgridId && friends.length > 0) {
            cacheFriends(activeSubgridId, friends, friendUsers);
        }
    }, [activeSubgridId, friends, friendUsers]);

    // Set active channel when channels load
    useEffect(() => {
        if (!channels.length) {
            setActiveChannelId('');
            return;
        }
        // Only set if current channel is not in the list (avoid infinite loop)
        setActiveChannelId((current) => {
            if (!current || !channels.some((channel) => channel._id === current)) {
                return channels[0]._id;
            }
            return current;
        });
    }, [channels]);

    // WebSocket: Join channel room and subscribe to new messages
    useEffect(() => {
        if (!activeChannelId || !activeSubgridId || !isConnected) return;

        const channelId = String(activeChannelId);

        // Join the channel room
        joinRoom('channel', channelId);

        // Subscribe to new messages - update React Query cache
        const unsubscribeNewMessage = subscribe('new_message', (data) => {
            if (data.roomType === 'channel' && String(data.roomId) === channelId && data.message) {
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, channelId),
                    (old: any[] | undefined) => {
                        if (!old) return [data.message];
                        if (old.some(m => m._id === data.message._id)) return old;
                        return [...old, data.message];
                    }
                );
            }
        });

        // Subscribe to message updates
        const unsubscribeMessageUpdated = subscribe('message_updated', (data) => {
            if (data.roomType === 'channel' && String(data.roomId) === channelId && data.message) {
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, channelId),
                    (old: any[] | undefined) => {
                        if (!old) return [data.message];
                        return old.map(m => m._id === data.message._id ? data.message : m);
                    }
                );
            }
        });

        // Subscribe to message deletions
        const unsubscribeMessageDeleted = subscribe('message_deleted', (data) => {
            if (data.roomType === 'channel' && String(data.roomId) === channelId) {
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, channelId),
                    (old: any[] | undefined) => {
                        if (!old) return [];
                        return old.filter(m => m._id !== data.messageId);
                    }
                );
            }
        });

        return () => {
            leaveRoom('channel', channelId);
            unsubscribeNewMessage();
            unsubscribeMessageUpdated();
            unsubscribeMessageDeleted();
        };
    }, [activeChannelId, activeSubgridId, isConnected, subscribe, joinRoom, leaveRoom, queryClient]);

    // Set DM peers from friends
    useEffect(() => {
        const peers = friends.filter((friendId) => friendId && friendId !== userId);
        setDirectMessagePeers(peers);
        // Only set activeDmId if needed (avoid infinite loop by using functional update)
        setActiveDmId((current) => {
            if (peers.length > 0 && !peers.includes(current)) {
                return peers[0];
            }
            if (!peers.length) {
                return '';
            }
            return current;
        });
    }, [friends, userId]);

    // WebSocket: Subscribe to DM messages - update React Query cache
    useEffect(() => {
        if (!activeDmId || !userId || !activeSubgridId || !isConnected) return;

        // Create DM room ID (consistent ordering)
        const sortedIds = [String(userId), String(activeDmId)].sort();
        const dmRoomId = `${sortedIds[0]}_${sortedIds[1]}`;

        // Join the DM room
        joinRoom('dm', dmRoomId);

        // Subscribe to new DM messages
        const unsubscribeNewMessage = subscribe('new_message', (data) => {
            if (data.roomType === 'dm' && String(data.roomId) === dmRoomId && data.message) {
                queryClient.setQueryData(
                    queryKeys.messages.dm(activeSubgridId, activeDmId),
                    (old: any[] | undefined) => {
                        if (!old) return [data.message];
                        if (old.some(m => m._id === data.message._id)) return old;
                        return [...old, data.message];
                    }
                );
            }
        });

        // Subscribe to DM message updates
        const unsubscribeMessageUpdated = subscribe('message_updated', (data) => {
            if (data.roomType === 'dm' && String(data.roomId) === dmRoomId && data.message) {
                queryClient.setQueryData(
                    queryKeys.messages.dm(activeSubgridId, activeDmId),
                    (old: any[] | undefined) => {
                        if (!old) return [data.message];
                        return old.map(m => m._id === data.message._id ? data.message : m);
                    }
                );
            }
        });

        // Subscribe to DM message deletions
        const unsubscribeMessageDeleted = subscribe('message_deleted', (data) => {
            if (data.roomType === 'dm' && String(data.roomId) === dmRoomId) {
                queryClient.setQueryData(
                    queryKeys.messages.dm(activeSubgridId, activeDmId),
                    (old: any[] | undefined) => {
                        if (!old) return [];
                        return old.filter(m => m._id !== data.messageId);
                    }
                );
            }
        });

        return () => {
            leaveRoom('dm', dmRoomId);
            unsubscribeNewMessage();
            unsubscribeMessageUpdated();
            unsubscribeMessageDeleted();
        };
    }, [activeDmId, userId, activeSubgridId, isConnected, subscribe, joinRoom, leaveRoom, queryClient]);

    // WebSocket: Join subgrid room for channel/post/member updates - update React Query cache
    useEffect(() => {
        if (!activeSubgridId || !isConnected) return;

        // Join the subgrid room
        joinRoom('subgrid', activeSubgridId);

        // Subscribe to channel events
        const unsubscribeChannelCreated = subscribe('channel_created', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.channels(activeSubgridId),
                    (old: any[] | undefined) => old ? [...old, data.channel] : [data.channel]
                );
            }
        });

        const unsubscribeChannelUpdated = subscribe('channel_updated', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.channels(activeSubgridId),
                    (old: any[] | undefined) => old ? old.map(c => c._id === data.channel._id ? data.channel : c) : []
                );
            }
        });

        const unsubscribeChannelDeleted = subscribe('channel_deleted', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.channels(activeSubgridId),
                    (old: any[] | undefined) => old ? old.filter(c => c._id !== data.channelId) : []
                );
            }
        });

        // Subscribe to post events
        const unsubscribePostCreated = subscribe('post_created', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? [data.post, ...old] : [data.post]
                );
            }
        });

        const unsubscribePostUpdated = subscribe('post_updated', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? old.map(p => p._id === data.post._id ? data.post : p) : []
                );
            }
        });

        const unsubscribePostDeleted = subscribe('post_deleted', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? old.filter(p => p._id !== data.postId) : []
                );
            }
        });

        // Subscribe to member events
        const unsubscribeMemberJoined = subscribe('member_joined', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.members(activeSubgridId),
                    (old: any[] | undefined) => old ? [...old, data.member] : [data.member]
                );
            }
        });

        const unsubscribeMemberLeft = subscribe('member_left', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.members(activeSubgridId),
                    (old: any[] | undefined) => old ? old.filter(m => m.userId !== data.userId) : []
                );
            }
        });

        return () => {
            leaveRoom('subgrid', activeSubgridId);
            unsubscribeChannelCreated();
            unsubscribeChannelUpdated();
            unsubscribeChannelDeleted();
            unsubscribePostCreated();
            unsubscribePostUpdated();
            unsubscribePostDeleted();
            unsubscribeMemberJoined();
            unsubscribeMemberLeft();
        };
    }, [activeSubgridId, isConnected, subscribe, joinRoom, leaveRoom, queryClient]);

    const activeSubgrid = useMemo(
        () => subgrids.find((item) => item._id === activeSubgridId) || null,
        [subgrids, activeSubgridId]
    );

    const activeChannel = useMemo(
        () => channels.find((item) => item._id === activeChannelId) || null,
        [channels, activeChannelId]
    );

    const filteredChannels = useMemo(() => {
        if (!searchQuery.trim()) return channels;
        const query = searchQuery.trim().toLowerCase();
        return channels.filter((channel) => String(channel.name || '').toLowerCase().includes(query));
    }, [channels, searchQuery]);

    // Group channels by category (or fall back to text/voice for uncategorized)
    const groupedChannels = useMemo(() => {
        const categoryMap = new Map<string, Category>();
        categories.forEach((cat) => categoryMap.set(cat._id, cat));

        // Group channels by categoryId
        const groupMap = new Map<string | 'null', Channel[]>();
        filteredChannels.forEach((channel) => {
            const catId = channel.categoryId || 'null';
            if (!groupMap.has(catId)) {
                groupMap.set(catId, []);
            }
            groupMap.get(catId)!.push(channel);
        });

        const groups: ChannelGroup[] = [];

        // Uncategorized channels: split into text and voice for backward compat
        const uncategorized = groupMap.get('null') || [];
        if (uncategorized.length > 0) {
            const uncatText = uncategorized.filter((c) => c.type !== 'voice');
            const uncatVoice = uncategorized.filter((c) => c.type === 'voice');
            if (uncatText.length > 0) {
                groups.push({
                    groupId: '__uncategorized_text',
                    groupName: 'TEXT CHANNELS',
                    order: -2,
                    channels: uncatText,
                });
            }
            if (uncatVoice.length > 0) {
                groups.push({
                    groupId: '__uncategorized_voice',
                    groupName: 'VOICE CHANNELS',
                    order: -1,
                    channels: uncatVoice,
                });
            }
        }

        // Categorized channels sorted by category order
        groupMap.forEach((chans, catId) => {
            if (catId === 'null') return;
            const cat = categoryMap.get(catId);
            groups.push({
                groupId: catId,
                groupName: cat?.name?.toUpperCase() || 'UNKNOWN',
                order: cat?.order ?? 999,
                channels: chans,
            });
        });

        // Sort by order
        groups.sort((a, b) => a.order - b.order);
        return groups;
    }, [filteredChannels, categories]);

    // Create a lookup map for member profiles by userId and _id
    const memberMap = useMemo(() => {
        const map: Record<string, Member> = {};
        members.forEach((member: any) => {
            // Map by userId (primary key for user lookup)
            if (member.userId) {
                map[member.userId] = member;
            }
            // Also map by _id in case authorId references the membership record
            if (member._id) {
                map[member._id] = member;
            }
        });
        return map;
    }, [members]);

    // Helper to get display name for a user
    const getDisplayName = (id?: string) => {
        if (!id) return 'Member';
        const member = memberMap[id];
        if (member) {
            const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
            if (name) return name;
            if (member.email) return member.email;
        }
        // Check if it's the current user
        if (id === userId) {
            return 'You';
        }
        return labelFromId(id);
    };

    const getAvatarUrl = (id?: string) => {
        if (!id) return null;
        const member = memberMap[id];
        if (member?.avatarUrl) return member.avatarUrl;
        const friend = friendUsers[id];
        if (friend?.avatarUrl) return friend.avatarUrl;
        return null;
    };

    const getUsername = (id?: string) => {
        if (!id) return null;
        const member = memberMap[id];
        return member?.username || null;
    };

    const isMemberAdmin = (id?: string): boolean => {
        if (!id) return false;
        const member = memberMap[id];
        if (!member) return false;
        const role = member.role || member.userRole || '';
        return ['owner', 'admin', 'subgrid_admin', 'super_admin'].includes(role.toLowerCase());
    };

    const getMemberDisplayUsername = (id?: string): string | null => {
        if (!id) return null;
        const member = memberMap[id];
        if (!member) return null;
        // If admin, show "Server Admin" unless they have a custom username
        if (isMemberAdmin(id)) {
            return member.username || 'Server Admin';
        }
        return member.username || null;
    };

    const getStakeholderBadge = (id?: string): StakeholderBadge | null => {
        if (!id) return null;
        const member = memberMap[id];
        if (member?.userRole === 'stakeholder' && member?.stakeholderBadge) {
            return member.stakeholderBadge;
        }
        return null;
    };

    const getCompany = (id?: string): string | null => {
        if (!id) return null;
        const member = memberMap[id];
        return member?.company || null;
    };

    const formatStakeholderBadgeLabel = (badge: StakeholderBadge) => {
        return badge.charAt(0).toUpperCase() + badge.slice(1);
    };

    const railItems = [
        {
            id: 'messages',
            icon: 'chat-bubble-outline' as const,
            onPress: () => {
                if (!activeSubgridId) {
                    setError('Please select a community first.');
                    return;
                }
                router.push({
                    pathname: '/(main)/direct-messages',
                    params: { subgridId: activeSubgridId },
                });
            },
        },
        {
            id: 'contributors',
            icon: 'emoji-events' as const,
            onPress: () =>
                router.push({
                    pathname: '/(main)/top-contributors',
                    params: { subgridId: activeSubgridId },
                }),
        },
        {
            id: 'profile',
            icon: 'person-outline' as const,
            onPress: () =>
                router.push({
                    pathname: '/(main)/profile',
                }),
        },
    ];

    const handleChannelPress = async (channel: Channel) => {
        setActiveChannelId(channel._id);

        // Handle voice channels differently
        if (channel.type === 'voice') {
            try {
                const response = await initiateChannelCall(channel._id, 'audio');
                if (response.success) {
                    // Navigate to voice channel screen with call session data
                    router.push({
                        pathname: '/(main)/voice-channel',
                        params: {
                            subgridId: activeSubgridId,
                            channelId: channel._id,
                            displayName: channel.name || '',
                            agoraChannelName: response.data?.channelName || '',
                            callId: response.data?.callId || '',
                            token: response.data?.token || '',
                            uid: String(response.data?.uid || ''),
                            appId: response.data?.appId || '',
                        },
                    });
                } else {
                    alert(response.error || 'Failed to join voice channel');
                }
            } catch (err: any) {
                alert(err.message || 'Failed to join voice channel');
            }
            return;
        }

        // Handle text channels
        if (isMobile) {
            router.push({
                pathname: '/(main)/sub-channel',
                params: {
                    subgridId: activeSubgridId,
                    channelId: channel._id,
                    channelName: channel.name || '',
                },
            });
        }
    };

    const getCount = (channel: Channel) => {
        const raw = channel.unreadCount ?? channel.messageCount ?? channel.messagesCount ?? channel.count ?? 0;
        const count = Number(raw);
        return Number.isFinite(count) ? count : 0;
    };

    const handleSendChannelMessage = async () => {
        if ((!channelDraft.trim() && attachments.length === 0) || !activeSubgridId || !activeChannelId) {
            return;
        }
        const body = channelDraft.trim();
        setChannelDraft('');

        try {
            // Upload attachments first if any
            const uploadedAttachments: string[] = [];
            if (attachments.length > 0) {
                setUploading(true);
                for (const file of attachments) {
                    try {
                        const result = await uploadFile(file, { type: 'attachment', subgridId: activeSubgridId });
                        if (result?.success && result?.data) {
                            uploadedAttachments.push(result.data.url || result.data.secure_url);
                        }
                    } catch (uploadErr: any) {
                        console.error('Failed to upload attachment:', uploadErr.message);
                    }
                }
                setAttachments([]);
                setUploading(false);
            }

            // Use React Query mutation to send message and update cache
            // Pass subgridId and channelId explicitly to ensure correct values are used
            await sendChannelMessage.mutateAsync({
                content: body,
                mediaUrls: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
                subgridId: activeSubgridId,
                channelId: activeChannelId,
            });
        } catch (err: any) {
            setError(err.message || 'Failed to send message.');
            setUploading(false);
        }
    };

    // File/Image picker handlers
    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const image = result.assets[0];
                setAttachments(prev => [...prev, {
                    uri: image.uri,
                    name: image.fileName || `image_${Date.now()}.jpg`,
                    type: image.mimeType || 'image/jpeg',
                }]);
            }
        } catch (err) {
            console.error('Error picking image:', err);
        }
    };

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                setAttachments(prev => [...prev, {
                    uri: file.uri,
                    name: file.name || 'file',
                    type: file.mimeType || 'application/octet-stream',
                }]);
            }
        } catch (err) {
            console.error('Error picking file:', err);
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleEmojiSelect = (emoji: string) => {
        setChannelDraft(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    // Voice recording handlers
    const handleStartRecording = async () => {
        if (isRecording) return;
        setRecordingDuration(0);
        recordingStartRef.current = Date.now();

        // Web recording using MediaRecorder
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                activeAudioStreamRef.current = stream;
                const recorder = new MediaRecorder(stream);
                audioChunksRef.current = [];
                recorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
                };
                recorder.onstop = async () => {
                    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                    const durationMs = Date.now() - recordingStartRef.current;

                    try {
                        const blobUrl = URL.createObjectURL(blob);
                        const result = await uploadFile(
                            { uri: blobUrl, name: `voice_${Date.now()}.webm`, type: blob.type || 'audio/webm' },
                            { type: 'voice-note', subgridId: activeSubgridId || '' }
                        );
                        URL.revokeObjectURL(blobUrl);

                        if (result?.success && result?.data && activeSubgridId && activeChannelId) {
                            // Send voice message and update cache
                            await sendChannelMessage.mutateAsync({
                                content: '',
                                mediaUrls: [result.data.url || result.data.secure_url],
                                subgridId: activeSubgridId,
                                channelId: activeChannelId,
                            });
                        }
                    } catch (uploadErr: any) {
                        console.error('Failed to upload voice note:', uploadErr);
                    }

                    stream.getTracks().forEach((track) => track.stop());
                    activeAudioStreamRef.current = null;
                };
                mediaRecorderRef.current = recorder;
                recorder.start();
                setIsRecording(true);
                recordingInterval.current = setInterval(() => {
                    setRecordingDuration((prev) => prev + 1);
                }, 1000);
            } catch (err: any) {
                console.error('Unable to start recording:', err.message);
            }
            return;
        }

        // Native recording using expo-audio
        try {
            const permission = await AudioModule.requestRecordingPermissionsAsync();
            if (!permission.granted) {
                console.error('Microphone permission denied');
                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            setIsRecording(true);
            recordingInterval.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (err: any) {
            console.error('Unable to start recording:', err.message);
        }
    };

    const handleStopRecording = async () => {
        setIsRecording(false);
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }

        // Web recording
        if (Platform.OS === 'web' && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
            return;
        }

        // Native recording using expo-audio
        if (audioRecorder.isRecording) {
            try {
                await audioRecorder.stop();
                const uri = audioRecorder.uri;

                if (uri && activeSubgridId && activeChannelId) {
                    let result;
                    try {
                        result = await uploadFile(
                            { uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' },
                            { type: 'voice-note', subgridId: activeSubgridId }
                        );
                    } catch (uploadErr: any) {
                        console.error('Voice message upload failed:', uploadErr?.message || uploadErr);
                        setError('Failed to upload voice message. Please try again.');
                        return;
                    }

                    if (result?.success && result?.data) {
                        // Send voice message and update cache
                        await sendChannelMessage.mutateAsync({
                            content: '',
                            mediaUrls: [result.data.url || result.data.secure_url],
                            subgridId: activeSubgridId,
                            channelId: activeChannelId,
                        });
                    } else {
                        setError('Voice message upload failed. Please try again.');
                    }
                }
            } catch (err: any) {
                console.error('Failed to save recording:', err.message);
                setError(err.message || 'Failed to send voice message.');
            } finally {
                try {
                    await setAudioModeAsync({ allowsRecording: false });
                } catch (audioModeErr) {
                    console.warn('Failed to reset audio mode:', audioModeErr);
                }
            }
        }
    };

    const handleCancelRecording = async () => {
        setIsRecording(false);
        setRecordingDuration(0);
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }

        if (Platform.OS === 'web') {
            const recorder = mediaRecorderRef.current;
            if (recorder) {
                recorder.ondataavailable = null;
                recorder.onstop = null;
                recorder.stop();
            }
            if (activeAudioStreamRef.current) {
                activeAudioStreamRef.current.getTracks().forEach((track: any) => track.stop());
                activeAudioStreamRef.current = null;
            }
            mediaRecorderRef.current = null;
            return;
        }

        // Native recording using expo-audio
        if (audioRecorder.isRecording) {
            try {
                await audioRecorder.stop();
            } catch (err) {
                // Ignore errors during cancel
            }
            await setAudioModeAsync({ allowsRecording: false });
        }
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayAudio = async (source?: string) => {
        if (!source) {
            return;
        }
        // Web playback using HTML5 Audio
        if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).Audio) {
            const audio = new (window as any).Audio(source);
            audio.play();
            return;
        }
        // Native playback using expo-audio
        try {
            const player = createAudioPlayer(source);
            player.play();
        } catch (err) {
            console.error('Failed to play audio:', err);
        }
    };

    // Sort ascending (oldest first) so newest messages appear at the bottom like WhatsApp
    // Mark items with _isPost flag so we can determine the correct API endpoint
    const feedItems = useMemo(() => {
        const markedMessages = messages.map(m => ({ ...m, _isPost: false }));
        const markedPosts = posts.map(p => ({ ...p, _isPost: true }));
        const merged = [...markedMessages, ...markedPosts];
        return merged.sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return aTime - bTime; // Ascending: oldest first, newest at bottom
        });
    }, [messages, posts]);

    // Scroll to bottom only on initial load of channel (WhatsApp-style)
    const lastChannelIdRef = useRef<string | null>(null);
    const initialScrollDoneRef = useRef<boolean>(false);

    useEffect(() => {
        // Reset scroll flag when channel changes
        if (activeChannelId !== lastChannelIdRef.current) {
            initialScrollDoneRef.current = false;
            lastChannelIdRef.current = activeChannelId;
        }

        // Only scroll once on initial load of channel content
        if (feedItems.length > 0 && feedScrollRef.current && !initialScrollDoneRef.current) {
            setTimeout(() => {
                feedScrollRef.current?.scrollToEnd({ animated: false });
                initialScrollDoneRef.current = true;
            }, 150);
        }
    }, [feedItems.length, activeChannelId]);

    const openReportModal = (id: string, type: 'post' | 'message') => {
        setReportTarget({ id, type });
        setReportReason(REPORT_REASONS[0]);
        setReportNotes('');
        setReportModalOpen(true);
    };

    // Handle opening feed action menu with floating position
    const handleOpenFeedMenu = (event: any, item: any, isPost: boolean) => {
        if (feedMenuOpen === item._id) {
            setFeedMenuOpen(null);
            setFeedMenuItem(null);
            return;
        }
        const target = event.currentTarget || event.target;
        if (target && target.getBoundingClientRect) {
            const rect = target.getBoundingClientRect();
            const screenWidth = Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : width;
            setFeedMenuPosition({
                top: rect.bottom + 5,
                right: screenWidth - rect.right,
            });
        }
        setFeedMenuItem({ ...item, isPost });
        setFeedMenuOpen(item._id);
    };

    const closeFeedMenu = () => {
        setFeedMenuOpen(null);
        setFeedMenuItem(null);
    };

    const submitReport = async () => {
        if (!activeSubgridId || !reportTarget) return;
        const reason = reportReason === 'Other' ? reportNotes.trim() : reportReason;
        if (!reason) {
            if (Platform.OS === 'web') {
                window.alert('Please select a report reason.');
            } else {
                Alert.alert('Missing reason', 'Please select a report reason.');
            }
            return;
        }
        setReportSubmitting(true);
        try {
            const path =
                reportTarget.type === 'post'
                    ? `/subgrids/${activeSubgridId}/posts/${reportTarget.id}/flag`
                    : `/subgrids/${activeSubgridId}/messages/${reportTarget.id}/flag`;
            await communityPost(path, { reason });
            setReportModalOpen(false);
            setReportTarget(null);
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to submit report.');
            } else {
                Alert.alert('Error', err.message || 'Failed to submit report.');
            }
        } finally {
            setReportSubmitting(false);
        }
    };

    // Delete handler for posts/messages (only own content)
    const openDeleteModal = (id: string, type: 'post' | 'message') => {
        setDeleteTarget({ id, type });
        setDeleteModalOpen(true);
    };

    const submitDelete = async () => {
        if (!activeSubgridId || !deleteTarget) return;
        setDeleteSubmitting(true);
        try {
            const path =
                deleteTarget.type === 'post'
                    ? `/subgrids/${activeSubgridId}/posts/${deleteTarget.id}`
                    : `/subgrids/${activeSubgridId}/messages/${deleteTarget.id}`;
            await communityDelete(path);
            // Update cache
            if (deleteTarget.type === 'post') {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? old.filter((p) => p._id !== deleteTarget.id) : []
                );
            } else {
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, activeChannelId),
                    (old: any[] | undefined) => old ? old.filter((m) => m._id !== deleteTarget.id) : []
                );
            }
            setDeleteModalOpen(false);
            setDeleteTarget(null);
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to delete content.');
            } else {
                Alert.alert('Error', err.message || 'Failed to delete content.');
            }
        } finally {
            setDeleteSubmitting(false);
        }
    };

    // Like handler for feed items (posts and messages)
    const handleLikeItem = async (itemId: string, isLiked: boolean, isPost: boolean) => {
        console.log('[Like] handleLikeItem called:', { itemId, isLiked, isPost, activeSubgridId, likeLoading });
        if (!activeSubgridId) {
            console.log('[Like] Early return: no activeSubgridId');
            return;
        }
        if (likeLoading) {
            console.log('[Like] Early return: likeLoading in progress');
            return;
        }
        setLikeLoading(itemId);
        const endpoint = isPost ? 'posts' : 'messages';
        try {
            if (isLiked) {
                console.log(`[Like] Unliking ${endpoint}:`, `/subgrids/${activeSubgridId}/${endpoint}/${itemId}/like`);
                await communityDelete(`/subgrids/${activeSubgridId}/${endpoint}/${itemId}/like`);
            } else {
                console.log(`[Like] Liking ${endpoint}:`, `/subgrids/${activeSubgridId}/${endpoint}/${itemId}/like`);
                await communityPost(`/subgrids/${activeSubgridId}/${endpoint}/${itemId}/like`, {});
            }
            console.log('[Like] API call successful');
            // Update cache optimistically
            if (isPost) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? old.map((p) =>
                        p._id === itemId
                            ? { ...p, userLiked: !isLiked, likeCount: (p.likeCount || 0) + (isLiked ? -1 : 1) }
                            : p
                    ) : []
                );
            } else if (activeChannelIdRef.current) {
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, activeChannelIdRef.current),
                    (old: any[] | undefined) => old ? old.map((m) =>
                        m._id === itemId
                            ? { ...m, userLiked: !isLiked, likeCount: (m.likeCount || 0) + (isLiked ? -1 : 1) }
                            : m
                    ) : []
                );
            }
        } catch (err: any) {
            console.error('[Like] Error:', err.message, err);
            setError(err.message || 'Failed to update like.');
        } finally {
            setLikeLoading(null);
        }
    };

    // Reshare handler for feed items (posts and messages)
    const handleReshareItem = async (itemId: string, isReshared: boolean, isPost: boolean) => {
        console.log('[Reshare] handleReshareItem called:', { itemId, isReshared, isPost, activeSubgridId, reshareLoading });
        if (!activeSubgridId) {
            console.log('[Reshare] Early return: no activeSubgridId');
            return;
        }
        if (reshareLoading) {
            console.log('[Reshare] Early return: reshareLoading in progress');
            return;
        }
        setReshareLoading(itemId);
        const endpoint = isPost ? 'posts' : 'messages';
        try {
            if (isReshared) {
                console.log(`[Reshare] Unresharing ${endpoint}:`, `/subgrids/${activeSubgridId}/${endpoint}/${itemId}/reshare`);
                await communityDelete(`/subgrids/${activeSubgridId}/${endpoint}/${itemId}/reshare`);
            } else {
                console.log(`[Reshare] Resharing ${endpoint}:`, `/subgrids/${activeSubgridId}/${endpoint}/${itemId}/reshare`);
                await communityPost(`/subgrids/${activeSubgridId}/${endpoint}/${itemId}/reshare`, {});
            }
            console.log('[Reshare] API call successful');
            // Update cache optimistically
            if (isPost) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? old.map((p) =>
                        p._id === itemId
                            ? { ...p, userReshared: !isReshared, reshareCount: (p.reshareCount || 0) + (isReshared ? -1 : 1) }
                            : p
                    ) : []
                );
            } else if (activeChannelIdRef.current) {
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, activeChannelIdRef.current),
                    (old: any[] | undefined) => old ? old.map((m) =>
                        m._id === itemId
                            ? { ...m, userReshared: !isReshared, reshareCount: (m.reshareCount || 0) + (isReshared ? -1 : 1) }
                            : m
                    ) : []
                );
            }
        } catch (err: any) {
            console.error('[Reshare] Error:', err.message, err);
            setError(err.message || 'Failed to update reshare.');
        } finally {
            setReshareLoading(null);
        }
    };

    // Comment handler - open modal and fetch comments
    const handleCommentPress = async (itemId: string, isPost: boolean) => {
        console.log('[Comment] handleCommentPress called:', { itemId, isPost, activeSubgridId });
        if (!activeSubgridId) {
            console.log('[Comment] Early return: missing activeSubgridId');
            return;
        }

        setCommentTarget({ id: itemId, isPost });
        setCommentModalOpen(true);
        setComments([]);

        try {
            const endpoint = isPost
                ? `/subgrids/${activeSubgridId}/posts/${itemId}/comments`
                : `/subgrids/${activeSubgridId}/messages/${itemId}/comments`;

            const res = await communityGet(endpoint);
            console.log('[Comment] Fetched comments:', res);
            // Backend returns { success: true, data: comments } structure
            setComments(res.data || res.comments || []);
        } catch (err: any) {
            console.error('[Comment] Error fetching comments:', err);
            setError('Failed to load comments');
        }
    };

    // Submit a new comment
    const handleSubmitComment = async () => {
        if (!commentTarget || !commentText.trim() || !activeSubgridId) return;

        setCommentLoading(true);
        try {
            const endpoint = commentTarget.isPost
                ? `/subgrids/${activeSubgridId}/posts/${commentTarget.id}/comments`
                : `/subgrids/${activeSubgridId}/messages/${commentTarget.id}/comments`;

            const res = await communityPost(endpoint, { body: commentText.trim() });
            console.log('[Comment] Created comment:', res);

            // Add the new comment to the list
            setComments(prev => [...prev, res.comment || res]);
            setCommentText('');

            // Update cache for comment count
            if (commentTarget.isPost) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? old.map(p =>
                        p._id === commentTarget.id
                            ? { ...p, commentCount: (p.commentCount || 0) + 1 }
                            : p
                    ) : []
                );
            } else if (activeChannelIdRef.current) {
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, activeChannelIdRef.current),
                    (old: any[] | undefined) => old ? old.map(m =>
                        m._id === commentTarget.id
                            ? { ...m, commentCount: (m.commentCount || 0) + 1 }
                            : m
                    ) : []
                );
            }
        } catch (err: any) {
            console.error('[Comment] Error creating comment:', err);
            setError('Failed to post comment');
        } finally {
            setCommentLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={[styles.page, isMobile && styles.pageMobile]}>
                <View style={[
                    styles.grid,
                    isCompact && styles.gridCompact,
                    isMobile && styles.gridMobile,
                ]}>
                    <View style={[styles.leftPanel, isCompact && styles.panelCompact]}>
                        <View style={styles.leftRail}>
                            <TouchableOpacity
                                style={[
                                    styles.railLogo,
                                    activeSubgrid?.coverImageUrl && { backgroundColor: activeSubgrid.coverImageUrl }
                                ]}
                                onPress={() => router.push('/(main)')}
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
                                const IconComponent = RAIL_ICONS[item.icon] || MessageCircle;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.railButton, isActive && styles.railButtonActive]}
                                        onPress={() => {
                                            setActiveRail(item.id);
                                            item.onPress?.();
                                        }}
                                    >
                                        <IconComponent
                                            size={20}
                                            color={isActive ? colors.text : colors.textMuted}
                                        />
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
                            <TouchableOpacity style={styles.exitButton} onPress={handleLogout}>
                                <X size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.channelPanel}>
                            <View style={styles.panelHeader}>
                                <View>
                                    <Text style={styles.panelTitle}>{activeSubgrid?.name || 'RBFCU Channel'}</Text>
                                    <View style={styles.memberPill}>
                                        <Text style={styles.memberText}>
                                            {memberCount.toLocaleString()} Members
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.moreBtn}>
                                    <MoreHorizontal size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.searchRow}>
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Browse channel"
                                    placeholderTextColor={colors.textSubtle}
                                    style={styles.searchInput}
                                />
                                <Search size={16} color={colors.textMuted} />
                            </View>

                            {!!error && <Text style={styles.errorText}>{error}</Text>}

                            <ScrollView contentContainerStyle={styles.channelList}>
                                {/* Events Button */}
                                <TouchableOpacity
                                    style={[styles.eventsButton, showEventsView && styles.eventsButtonActive]}
                                    onPress={() => {
                                        if (isMobile) {
                                            // On mobile, navigate to sub-channel with showEvents flag
                                            router.push({
                                                pathname: '/(main)/sub-channel',
                                                params: {
                                                    subgridId: activeSubgridId,
                                                    channelId: channels[0]?._id || '',
                                                    channelName: channels[0]?.name || 'general',
                                                    showEvents: 'true',
                                                },
                                            });
                                        } else {
                                            setShowEventsView(!showEventsView);
                                        }
                                    }}
                                >
                                    <Calendar size={16} color={showEventsView ? colors.text : colors.textMuted} />
                                    <Text style={[styles.eventsButtonText, showEventsView && styles.eventsButtonTextActive]}>
                                        Events
                                    </Text>
                                    {events.length > 0 && (
                                        <View style={styles.eventsBadge}>
                                            <Text style={styles.eventsBadgeText}>{events.length}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Channel groups (categories + uncategorized) */}
                                {groupedChannels.map((group) => {
                                    const isOpen = !collapsedGroups[group.groupId];
                                    return (
                                        <View key={group.groupId} style={styles.groupBlock}>
                                            <TouchableOpacity
                                                style={styles.groupHeader}
                                                onPress={() => setCollapsedGroups((prev) => ({ ...prev, [group.groupId]: !prev[group.groupId] }))}
                                            >
                                                <ChevronDown size={16} color={colors.textMuted} style={!isOpen ? { transform: [{ rotate: '-90deg' }] } : undefined} />
                                                <Text style={styles.groupTitle}>{group.groupName}</Text>
                                            </TouchableOpacity>
                                            {isOpen && group.channels.length === 0 && (
                                                <Text style={styles.emptyText}>No channels yet.</Text>
                                            )}
                                            {isOpen && group.channels.map((channel) => {
                                                const count = getCount(channel);
                                                const isActive = channel._id === activeChannelId;
                                                const isVoice = channel.type === 'voice';
                                                const iconType = getChannelIcon(channel);
                                                return (
                                                    <TouchableOpacity
                                                        key={channel._id}
                                                        style={[styles.channelRow, isActive && styles.channelRowActive]}
                                                        onPress={() => handleChannelPress(channel)}
                                                    >
                                                        <View style={styles.channelLeft}>
                                                            {isVoice ? (
                                                                <Volume2 size={14} color={colors.textMuted} />
                                                            ) : iconType === 'lock' ? (
                                                                <Lock size={14} color={colors.textMuted} />
                                                            ) : (
                                                                <Hash size={14} color={colors.textMuted} />
                                                            )}
                                                            <Text style={[
                                                                styles.channelText,
                                                                isActive && styles.channelTextActive,
                                                            ]}>
                                                                {channel.name || 'Untitled'}
                                                            </Text>
                                                        </View>
                                                        {!isVoice && count > 0 && (
                                                            <View style={styles.badge}>
                                                                <Text style={styles.badgeText}>{count}</Text>
                                                            </View>
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>

                    {showCenterPanel && (
                        <View style={[styles.centerPanel, isCompact && styles.panelCompact]}>
                            {showEventsView ? (
                                /* Events View */
                                <>
                                    <View style={styles.centerHeader}>
                                        <View style={styles.eventsHeaderLeft}>
                                            <Calendar size={18} color={colors.textMuted} />
                                            <Text style={styles.centerTitle}>Events & Announcements</Text>
                                        </View>
                                    </View>

                                    <ScrollView
                                        contentContainerStyle={styles.eventsListContent}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        {events.length === 0 ? (
                                            <View style={styles.channelWelcome}>
                                                <View style={styles.channelWelcomeIcon}>
                                                    <Calendar size={32} color={colors.textMuted} />
                                                </View>
                                                <Text style={styles.channelWelcomeTitle}>No Events Yet</Text>
                                                <Text style={styles.channelWelcomeSubtitle}>
                                                    Check back later for upcoming events and announcements.
                                                </Text>
                                            </View>
                                        ) : (
                                            events.map((event) => (
                                                <View key={event._id} style={styles.eventCard}>
                                                    <View style={styles.eventCardHeader}>
                                                        <View style={[
                                                            styles.eventTypeBadge,
                                                            event.eventType === 'announcement' ? styles.eventTypeBadgeAnnouncement : styles.eventTypeBadgeEvent
                                                        ]}>
                                                            {event.eventType === 'announcement' ? (
                                                                <Megaphone size={12} color="#FFFFFF" />
                                                            ) : (
                                                                <Calendar size={12} color="#FFFFFF" />
                                                            )}
                                                            <Text style={styles.eventTypeBadgeText}>
                                                                {event.eventType === 'announcement' ? 'Announcement' : 'Event'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.eventTitle}>{event.title}</Text>
                                                    {event.description && (
                                                        <Text style={styles.eventDescription}>{event.description}</Text>
                                                    )}
                                                    <View style={styles.eventMeta}>
                                                        {event.startDate && (
                                                            <View style={styles.eventMetaItem}>
                                                                <Clock size={14} color={colors.textMuted} />
                                                                <Text style={styles.eventMetaText}>
                                                                    {new Date(event.startDate).toLocaleDateString('en-US', {
                                                                        weekday: 'short',
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        year: 'numeric',
                                                                        hour: 'numeric',
                                                                        minute: '2-digit',
                                                                    })}
                                                                </Text>
                                                            </View>
                                                        )}
                                                        {event.location && (
                                                            <View style={styles.eventMetaItem}>
                                                                <MapPin size={14} color={colors.textMuted} />
                                                                <Text style={styles.eventMetaText}>{event.location}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    {event.status && event.status !== 'scheduled' && (
                                                        <View style={[
                                                            styles.eventStatusBadge,
                                                            event.status === 'completed' && styles.eventStatusCompleted,
                                                            event.status === 'cancelled' && styles.eventStatusCancelled,
                                                            event.status === 'ongoing' && styles.eventStatusOngoing,
                                                        ]}>
                                                            <Text style={styles.eventStatusText}>
                                                                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            ))
                                        )}
                                    </ScrollView>
                                </>
                            ) : (
                                /* Channel View */
                                <>
                            <View style={styles.centerHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    {activeChannel && getChannelIcon(activeChannel) === 'lock' ? (
                                        <Lock size={16} color={colors.text} />
                                    ) : (
                                        <Hash size={16} color={colors.text} />
                                    )}
                                    <Text style={styles.centerTitle}>{activeChannel?.name || 'general'}</Text>
                                </View>
                                <Search size={16} color={colors.textMuted} />
                            </View>

                            <ScrollView
                                ref={feedScrollRef}
                                contentContainerStyle={styles.feedList}
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Channel Welcome Banner */}
                                {activeChannel && (
                                    <View style={styles.channelWelcome}>
                                        <View style={styles.channelWelcomeIcon}>
                                            {getChannelIcon(activeChannel) === 'lock' ? (
                                                <Lock size={32} color={colors.textMuted} />
                                            ) : (
                                                <Hash size={32} color={colors.textMuted} />
                                            )}
                                        </View>
                                        <Text style={styles.channelWelcomeTitle}>
                                            Welcome to {getChannelIcon(activeChannel) === 'lock' ? '' : '#'}{activeChannel.name}
                                        </Text>
                                        <Text style={styles.channelWelcomeSubtitle}>
                                            This is the start of the {getChannelIcon(activeChannel) === 'lock' ? '' : '#'}{activeChannel.name} channel.
                                        </Text>
                                    </View>
                                )}
                                {feedItems.length === 0 && !activeChannel && (
                                    <Text style={styles.emptyText}>No channel updates yet.</Text>
                                )}
                                {feedItems.map((item: any) => {
                                    // Use _isPost flag set during feedItems creation for reliable detection
                                    const isPost = item._isPost === true;
                                    const likeCount = item.likeCount ?? 0;
                                    const commentCount = item.commentCount ?? 0;
                                    const reshareCount = item.reshareCount ?? 0;
                                    return (
                                        <View key={item._id} style={styles.feedCard}>
                                            <View style={styles.feedHeader}>
                                                <UserAvatar
                                                    uri={getAvatarUrl(item.authorId || item.senderId)}
                                                    name={getDisplayName(item.authorId || item.senderId)}
                                                    style={styles.avatar}
                                                />
                                                <View style={styles.feedHeaderInfo}>
                                                    <View style={styles.authorRow}>
                                                        <Text style={styles.feedAuthor}>{getDisplayName(item.authorId || item.senderId)}</Text>
                                                        {isMemberAdmin(item.authorId || item.senderId) && (
                                                            <View style={styles.verifiedBadge}>
                                                                <BadgeCheck size={14} color="#3B82F6" />
                                                            </View>
                                                        )}
                                                        {getMemberDisplayUsername(item.authorId || item.senderId) && (
                                                            <Text style={styles.feedUsername}>@{getMemberDisplayUsername(item.authorId || item.senderId)}</Text>
                                                        )}
                                                        {getCompany(item.authorId || item.senderId) && (
                                                            <Text style={styles.feedCompany}>from {getCompany(item.authorId || item.senderId)}</Text>
                                                        )}
                                                        {getStakeholderBadge(item.authorId || item.senderId) && (
                                                            <View style={[styles.stakeholderBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getStakeholderBadge(item.authorId || item.senderId)!] }]}>
                                                                <Text style={styles.stakeholderBadgeText}>
                                                                    {formatStakeholderBadgeLabel(getStakeholderBadge(item.authorId || item.senderId)!)}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={styles.feedMeta}>{formatTime(item.createdAt)}</Text>
                                                </View>
                                                <View style={styles.feedHeaderActions}>
                                                    <TouchableOpacity
                                                        style={styles.feedMenuButton}
                                                        onPress={(e) => handleOpenFeedMenu(e, item, isPost)}
                                                    >
                                                        <MoreHorizontal size={16} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            {!!item.body && (
                                                <Text style={styles.feedText} numberOfLines={4}>
                                                    {item.body}
                                                    {item.body.length > 200 && <Text style={styles.moreText}> More</Text>}
                                                </Text>
                                            )}
                                            {(() => { const attachments = normalizeAttachments(item.attachments); return attachments.length > 0 ? (
                                                <View style={styles.attachmentStack}>
                                                    {attachments.map((attachment, idx) => {
                                                        if (attachment.type === 'audio' || attachment.type === 'voice') {
                                                            return (
                                                                <VoiceMessagePlayer
                                                                    key={`${item._id}-audio-${idx}`}
                                                                    source={attachment.value}
                                                                    durationMs={attachment.durationMs}
                                                                    colors={colors}
                                                                    compact
                                                                />
                                                            );
                                                        }
                                                        if (attachment.type === 'image') {
                                                            const imageUrl = attachment.uri || attachment.value;
                                                            return (
                                                                <Image
                                                                    key={`${item._id}-img-${idx}`}
                                                                    source={{ uri: imageUrl }}
                                                                    style={styles.feedImage}
                                                                    resizeMode="cover"
                                                                />
                                                            );
                                                        }
                                                        if (attachment.type === 'emoji' || attachment.type === 'sticker') {
                                                            return (
                                                                <Image
                                                                    key={`${item._id}-emoji-${idx}`}
                                                                    source={{ uri: attachment.uri }}
                                                                    style={styles.feedImage}
                                                                />
                                                            );
                                                        }
                                                        if (attachment.type === 'file') {
                                                            return (
                                                                <View key={`${item._id}-file-${idx}`} style={styles.fileBubble}>
                                                                    <File size={20} color={colors.textMuted} />
                                                                    <Text style={styles.fileText} numberOfLines={1}>
                                                                        {attachment.label || 'File'}
                                                                    </Text>
                                                                </View>
                                                            );
                                                        }
                                                        // Handle reshare attachments - show original message content
                                                        if (attachment.type === 'reshare') {
                                                            const reshareData = attachment as any;
                                                            return (
                                                                <View key={`${item._id}-reshare-${idx}`} style={styles.reshareCard}>
                                                                    <View style={styles.reshareHeader}>
                                                                        <Repeat2 size={14} color={colors.textMuted} />
                                                                        <Text style={styles.reshareLabel}>Reshared</Text>
                                                                    </View>
                                                                    <View style={styles.reshareContent}>
                                                                        <View style={styles.reshareAuthorRow}>
                                                                            <UserAvatar
                                                                                uri={getAvatarUrl(reshareData.originalAuthorId)}
                                                                                name={getDisplayName(reshareData.originalAuthorId)}
                                                                                style={styles.reshareAvatar}
                                                                            />
                                                                            <Text style={styles.reshareAuthorName}>
                                                                                {getDisplayName(reshareData.originalAuthorId)}
                                                                            </Text>
                                                                            <Text style={styles.reshareTime}>
                                                                                {formatMessageDate(reshareData.originalCreatedAt)}
                                                                            </Text>
                                                                        </View>
                                                                        {!!reshareData.originalBody && (
                                                                            <Text style={styles.reshareBody} numberOfLines={3}>
                                                                                {reshareData.originalBody}
                                                                            </Text>
                                                                        )}
                                                                        {/* Render original attachments (images, etc.) */}
                                                                        {reshareData.originalAttachments?.length > 0 && (
                                                                            <View style={styles.reshareAttachments}>
                                                                                {reshareData.originalAttachments.map((origAtt: any, origIdx: number) => {
                                                                                    const origUrl = origAtt?.value || origAtt?.uri || origAtt?.url || (typeof origAtt === 'string' ? origAtt : null);
                                                                                    const origType = origAtt?.type || '';
                                                                                    const origMime = origAtt?.mimeType || '';
                                                                                    if (!origUrl) return null;

                                                                                    const isOrigImage = origType === 'image' || origType === 'sticker' || origType === 'emoji' ||
                                                                                        origMime?.startsWith('image/') ||
                                                                                        /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(origUrl);

                                                                                    if (isOrigImage) {
                                                                                        return (
                                                                                            <Image
                                                                                                key={`reshare-att-${origIdx}`}
                                                                                                source={{ uri: origUrl }}
                                                                                                style={styles.reshareImage}
                                                                                                resizeMode="cover"
                                                                                            />
                                                                                        );
                                                                                    }
                                                                                    return null;
                                                                                })}
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                </View>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </View>
                                            ) : null; })()}
                                            {/* Show reactions for all feed items (posts and messages) */}
                                            <View style={styles.feedReactions}>
                                                <TouchableOpacity
                                                    style={styles.reactionItem}
                                                    onPress={() => handleCommentPress(item._id, isPost)}
                                                >
                                                    <MessageCircle size={14} color={colors.textMuted} />
                                                    <Text style={styles.reactionText}>{commentCount}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.reactionItem}
                                                    onPress={() => handleLikeItem(item._id, item.userLiked, isPost)}
                                                    disabled={likeLoading === item._id}
                                                >
                                                    <Heart
                                                        size={14}
                                                        color={item.userLiked ? '#EF4444' : colors.textMuted}
                                                        fill={item.userLiked ? '#EF4444' : 'transparent'}
                                                    />
                                                    <Text style={[styles.reactionText, item.userLiked && styles.reactionTextActive]}>
                                                        {likeCount}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.reactionItem}
                                                    onPress={() => handleReshareItem(item._id, item.userReshared, isPost)}
                                                    disabled={reshareLoading === item._id}
                                                >
                                                    <Repeat2
                                                        size={14}
                                                        color={item.userReshared ? '#22C55E' : colors.textMuted}
                                                    />
                                                    <Text style={[styles.reactionText, item.userReshared && styles.reactionTextReshared]}>
                                                        {reshareCount}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            {/* Attachment Preview */}
                            {attachments.length > 0 && (
                                <View style={styles.attachmentPreview}>
                                    {attachments.map((att, idx) => (
                                        <View key={idx} style={styles.attachmentItem}>
                                            {att.type.startsWith('image/') ? (
                                                <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
                                            ) : (
                                                <View style={styles.attachmentFileIcon}>
                                                    <File size={20} color={colors.textMuted} />
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={styles.attachmentRemove}
                                                onPress={() => handleRemoveAttachment(idx)}
                                            >
                                                <X size={12} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Recording UI */}
                            {isRecording ? (
                                <View style={styles.recordingContainer}>
                                    <View style={styles.recordingIndicator}>
                                        <View style={styles.recordingDot} />
                                        <Text style={styles.recordingText}>Recording {formatRecordingTime(recordingDuration)}</Text>
                                    </View>
                                    <View style={styles.recordingActions}>
                                        <TouchableOpacity style={styles.cancelRecordingBtn} onPress={handleCancelRecording}>
                                            <Trash2 size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.stopRecordingBtn} onPress={handleStopRecording}>
                                            <Send size={18} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.messageComposer}>
                                    <TouchableOpacity style={styles.composerIconBtn} onPress={handlePickImage}>
                                        <PlusCircle size={22} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    <View style={styles.composerInputWrapper}>
                                        <TextInput
                                            placeholder={`Message #${activeChannel?.name || 'general'}`}
                                            placeholderTextColor={colors.textSubtle}
                                            value={channelDraft}
                                            onChangeText={setChannelDraft}
                                            style={styles.messageInput}
                                            onSubmitEditing={handleSendChannelMessage}
                                        />
                                        <View style={styles.composerActions}>
                                            <TouchableOpacity style={styles.composerIconBtn} onPress={handlePickFile}>
                                                <Paperclip size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.composerIconBtn} onPress={() => setShowEmojiPicker(true)}>
                                                <Smile size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.composerIconBtn} onPress={handleStartRecording}>
                                                <Mic size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            {(channelDraft.trim() || attachments.length > 0) && (
                                                <TouchableOpacity style={styles.sendButton} onPress={handleSendChannelMessage}>
                                                    <Send size={16} color={colors.primaryText} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            )}
                                </>
                            )}
                        </View>
                    )}

                    {showRightPanel && (
                        <View style={styles.rightPanel}>
                            <View style={styles.dmHeader}>
                                <Text style={styles.dmTitle}>Direct Messages</Text>
                                <View style={styles.dmSearchRow}>
                                    <Search size={14} color={colors.textMuted} />
                                    <Text style={styles.dmSearchText}>Search</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.addFriendsBtn}
                                    onPress={() => {
                                        if (!activeSubgridId) return;
                                        router.push({
                                            pathname: '/(main)/direct-messages',
                                            params: { subgridId: activeSubgridId },
                                        });
                                    }}
                                >
                                    <Text style={styles.addFriendsText}>Add Friends</Text>
                                    <UserPlus size={14} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarRow}>
                                {directMessagePeers.map((peerId) => (
                                    <UserAvatar
                                        key={peerId}
                                        uri={getAvatarUrl(peerId)}
                                        name={buildName(peerId, friendUsers[peerId])}
                                        style={styles.dmAvatar}
                                    />
                                ))}
                            </ScrollView>

                            <ScrollView contentContainerStyle={styles.dmList} showsVerticalScrollIndicator={false}>
                                {directMessagePeers.length === 0 && (
                                    <Text style={styles.emptyText}>No direct messages yet.</Text>
                                )}
                                {directMessagePeers.map((peerId) => {
                                    const isActive = peerId === activeDmId;
                                    const lastMessage = isActive && dmMessages.length > 0
                                        ? dmMessages[dmMessages.length - 1]
                                        : null;
                                    const isSentByMe = lastMessage?.senderId === userId;
                                    const previewText = lastMessage?.body
                                        ? (isSentByMe ? `You: ${lastMessage.body}` : lastMessage.body)
                                        : 'Tap to start chat';
                                    return (
                                        <TouchableOpacity
                                            key={peerId}
                                            style={[styles.dmRow, isActive && styles.dmRowActive]}
                                            onPress={() => router.push({
                                                pathname: '/(main)/direct-messages',
                                                params: { subgridId: activeSubgridId },
                                            })}
                                        >
                                            <UserAvatar
                                                uri={getAvatarUrl(peerId)}
                                                name={buildName(peerId, friendUsers[peerId])}
                                                style={styles.dmAvatarLarge}
                                            />
                                            <View style={styles.dmInfo}>
                                                <Text style={styles.dmName}>{buildName(peerId, friendUsers[peerId])}</Text>
                                                <Text style={styles.dmMeta} numberOfLines={1}>
                                                    {previewText}
                                                </Text>
                                            </View>
                                            <Text style={styles.dmTime}>{formatRelativeTime(lastMessage?.createdAt)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}
                </View>
            </View>

            {/* Floating Feed Action Menu */}
            {feedMenuOpen && feedMenuItem && (
                <>
                    <Pressable
                        style={styles.floatingMenuOverlay}
                        onPress={closeFeedMenu}
                    />
                    <View style={[styles.floatingMenuDropdown, { top: feedMenuPosition.top, right: feedMenuPosition.right }]}>
                        {/* Show Delete option only for own posts/messages */}
                        {(feedMenuItem.authorId === userId || feedMenuItem.senderId === userId) && (
                            <TouchableOpacity
                                style={styles.floatingMenuItem}
                                onPress={() => {
                                    openDeleteModal(feedMenuItem._id, feedMenuItem.isPost ? 'post' : 'message');
                                    closeFeedMenu();
                                }}
                            >
                                <Trash2 size={16} color="#EF4444" />
                                <Text style={[styles.floatingMenuItemText, { color: '#EF4444' }]}>Delete</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.floatingMenuItem}
                            onPress={() => {
                                openReportModal(feedMenuItem._id, feedMenuItem.isPost ? 'post' : 'message');
                                closeFeedMenu();
                            }}
                        >
                            <Flag size={16} color={colors.textMuted} />
                            <Text style={styles.floatingMenuItemText}>Report</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* Report Modal */}
            <Modal visible={reportModalOpen} transparent animationType="fade" onRequestClose={() => setReportModalOpen(false)}>
                <View style={styles.reportOverlay}>
                    <TouchableOpacity style={styles.reportBackdrop} activeOpacity={1} onPress={() => setReportModalOpen(false)} />
                    <View style={styles.reportCard}>
                        <View style={styles.reportHeader}>
                            <Text style={styles.reportTitle}>Report content</Text>
                            <TouchableOpacity onPress={() => setReportModalOpen(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.reportSubtitle}>Select a reason for this report.</Text>
                        <View style={styles.reportReasonGrid}>
                            {REPORT_REASONS.map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    style={[styles.reportReasonChip, reportReason === reason && styles.reportReasonChipActive]}
                                    onPress={() => setReportReason(reason)}
                                >
                                    <Text style={[styles.reportReasonText, reportReason === reason && styles.reportReasonTextActive]}>
                                        {reason}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {reportReason === 'Other' && (
                            <View style={styles.reportNotesWrap}>
                                <Text style={styles.reportNotesLabel}>Reason details</Text>
                                <TextInput
                                    style={styles.reportNotesInput}
                                    value={reportNotes}
                                    onChangeText={setReportNotes}
                                    placeholder="Share more details..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                />
                            </View>
                        )}
                        <View style={styles.reportActions}>
                            <TouchableOpacity style={styles.reportCancelBtn} onPress={() => setReportModalOpen(false)}>
                                <Text style={styles.reportCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.reportSubmitBtn, reportSubmitting && styles.reportSubmitBtnDisabled]}
                                onPress={submitReport}
                                disabled={reportSubmitting}
                            >
                                <Text style={styles.reportSubmitText}>{reportSubmitting ? 'Submitting...' : 'Submit Report'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal visible={deleteModalOpen} transparent animationType="fade" onRequestClose={() => setDeleteModalOpen(false)}>
                <View style={styles.reportOverlay}>
                    <TouchableOpacity style={styles.reportBackdrop} activeOpacity={1} onPress={() => setDeleteModalOpen(false)} />
                    <View style={styles.reportCard}>
                        <View style={styles.reportHeader}>
                            <Text style={styles.reportTitle}>Delete {deleteTarget?.type === 'post' ? 'Post' : 'Message'}?</Text>
                            <TouchableOpacity onPress={() => setDeleteModalOpen(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.reportSubtitle}>
                            This will permanently delete this {deleteTarget?.type}. This action cannot be undone.
                        </Text>
                        <View style={styles.reportActions}>
                            <TouchableOpacity style={styles.reportCancelBtn} onPress={() => setDeleteModalOpen(false)}>
                                <Text style={styles.reportCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.reportSubmitBtn, { backgroundColor: '#EF4444' }, deleteSubmitting && styles.reportSubmitBtnDisabled]}
                                onPress={submitDelete}
                                disabled={deleteSubmitting}
                            >
                                <Text style={styles.reportSubmitText}>{deleteSubmitting ? 'Deleting...' : 'Delete'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Comment Modal */}
            <Modal visible={commentModalOpen} transparent animationType="slide" onRequestClose={() => setCommentModalOpen(false)}>
                <View style={styles.commentModalOverlay}>
                    <TouchableOpacity style={styles.commentBackdrop} activeOpacity={1} onPress={() => setCommentModalOpen(false)} />
                    <View style={styles.commentModalContent}>
                        <View style={styles.commentModalHeader}>
                            <Text style={styles.commentModalTitle}>Comments</Text>
                            <TouchableOpacity onPress={() => setCommentModalOpen(false)}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.commentList} contentContainerStyle={styles.commentListContent}>
                            {comments.length === 0 ? (
                                <View style={styles.commentEmpty}>
                                    <MessageCircle size={32} color={colors.textMuted} />
                                    <Text style={styles.commentEmptyText}>No comments yet</Text>
                                    <Text style={styles.commentEmptySubtext}>Be the first to comment!</Text>
                                </View>
                            ) : (
                                comments.map((comment, idx) => (
                                    <View key={comment._id || idx} style={styles.commentItem}>
                                        <UserAvatar
                                            uri={getAvatarUrl(comment.authorId)}
                                            name={getDisplayName(comment.authorId)}
                                            style={styles.commentAvatar}
                                        />
                                        <View style={styles.commentBody}>
                                            <View style={styles.commentAuthorRow}>
                                                <Text style={styles.commentAuthor}>{getDisplayName(comment.authorId)}</Text>
                                                {isMemberAdmin(comment.authorId) && (
                                                    <View style={styles.verifiedBadge}>
                                                        <BadgeCheck size={12} color="#3B82F6" />
                                                    </View>
                                                )}
                                                {getMemberDisplayUsername(comment.authorId) && (
                                                    <Text style={styles.commentUsername}>@{getMemberDisplayUsername(comment.authorId)}</Text>
                                                )}
                                                {getStakeholderBadge(comment.authorId) && (
                                                    <View style={[styles.commentBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getStakeholderBadge(comment.authorId)!] }]}>
                                                        <Text style={styles.commentBadgeText}>
                                                            {formatStakeholderBadgeLabel(getStakeholderBadge(comment.authorId)!)}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={styles.commentTime}>{formatTime(comment.createdAt)}</Text>
                                            </View>
                                            <Text style={styles.commentText}>{comment.body}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        <View style={styles.commentInputContainer}>
                            <TextInput
                                style={styles.commentInput}
                                placeholder="Write a comment..."
                                placeholderTextColor={colors.textMuted}
                                value={commentText}
                                onChangeText={setCommentText}
                                multiline
                            />
                            <TouchableOpacity
                                style={[styles.commentSendBtn, (!commentText.trim() || commentLoading) && styles.commentSendBtnDisabled]}
                                onPress={handleSubmitComment}
                                disabled={!commentText.trim() || commentLoading}
                            >
                                {commentLoading ? (
                                    <Text style={styles.commentSendText}>...</Text>
                                ) : (
                                    <Send size={18} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Emoji Picker Modal */}
            <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
                <TouchableOpacity
                    style={styles.emojiModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowEmojiPicker(false)}
                >
                    <View style={styles.emojiModalContent}>
                        <View style={styles.emojiModalHeader}>
                            <Text style={styles.emojiModalTitle}>Emoji</Text>
                            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.emojiGrid}>
                            {EMOJI_GRID.map((row, rowIdx) => (
                                <View key={rowIdx} style={styles.emojiRow}>
                                    {row.map((emoji, emojiIdx) => (
                                        <TouchableOpacity
                                            key={emojiIdx}
                                            style={styles.emojiBtn}
                                            onPress={() => handleEmojiSelect(emoji)}
                                        >
                                            <Text style={styles.emojiText}>{emoji}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

        </SafeAreaView>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors'], bottomInset: number = 0) =>
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
        gridCompact: {
            flexDirection: 'column',
        },
        gridMobile: {
            gap: 0,
        },
        leftPanel: {
            flexDirection: 'row',
            width: 380,
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
            marginTop: 'auto',
        },
        channelPanel: {
            flex: 1,
            paddingVertical: 20,
            paddingRight: 20,
            gap: 16,
        },
        panelHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
        },
        panelTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        memberPill: {
            marginTop: 8,
            backgroundColor: colors.surfaceMuted,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            alignSelf: 'flex-start',
        },
        memberText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
        },
        moreBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        searchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderRadius: 12,
            paddingHorizontal: 14,
            height: 44,
            backgroundColor: colors.surfaceMuted,
        },
        searchInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
        },
        sectionTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
        },
        helperText: {
            fontSize: 11,
            color: colors.textMuted,
        },
        errorText: {
            fontSize: 11,
            color: colors.dangerText,
        },
        channelList: {
            gap: 16,
            paddingBottom: 24,
        },
        eventsButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 8,
            borderRadius: 6,
            marginBottom: 8,
        },
        eventsButtonActive: {
            backgroundColor: colors.surfaceMuted,
        },
        eventsButtonText: {
            fontSize: 14,
            color: colors.textMuted,
            flex: 1,
        },
        eventsButtonTextActive: {
            color: colors.text,
            fontWeight: '600',
        },
        eventsBadge: {
            backgroundColor: colors.primary,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 10,
            minWidth: 20,
            alignItems: 'center',
        },
        eventsBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        eventsHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        eventsListContent: {
            padding: 16,
            gap: 16,
        },
        eventCard: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
        },
        eventCardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        eventTypeBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
        },
        eventTypeBadgeEvent: {
            backgroundColor: '#3B82F6',
        },
        eventTypeBadgeAnnouncement: {
            backgroundColor: '#F59E0B',
        },
        eventTypeBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        eventTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        eventDescription: {
            fontSize: 14,
            color: colors.textMuted,
            lineHeight: 20,
            marginBottom: 12,
        },
        eventMeta: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
        },
        eventMetaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        eventMetaText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        eventStatusBadge: {
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            marginTop: 12,
        },
        eventStatusCompleted: {
            backgroundColor: '#22C55E20',
        },
        eventStatusCancelled: {
            backgroundColor: '#EF444420',
        },
        eventStatusOngoing: {
            backgroundColor: '#3B82F620',
        },
        eventStatusText: {
            fontSize: 12,
            fontWeight: '500',
            color: colors.text,
        },
        groupBlock: {
            gap: 8,
        },
        groupHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        groupTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
        },
        channelRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 10,
        },
        channelRowActive: {
            backgroundColor: colors.surfaceMuted,
        },
        channelLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        channelText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        channelTextActive: {
            fontWeight: '600',
        },
        badge: {
            minWidth: 24,
            height: 24,
            borderRadius: 12,
            paddingHorizontal: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        badgeText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
        },
        emptyText: {
            fontSize: 12,
            color: colors.textSubtle,
            marginLeft: 24,
        },
        channelWelcome: {
            alignItems: 'flex-start',
            padding: 24,
            marginBottom: 16,
        },
        channelWelcomeIcon: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        channelWelcomeTitle: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 8,
        },
        channelWelcomeSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
        },
        centerPanel: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            margin: 16,
            padding: 20,
            gap: 16,
        },
        centerHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        centerTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        feedList: {
            gap: 16,
            paddingBottom: 16,
        },
        feedCard: {
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 12,
        },
        feedHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        feedHeaderInfo: {
            flex: 1,
        },
        feedHeaderActions: {
            position: 'relative',
        },
        feedMenuButton: {
            padding: 4,
        },
        feedMenuDropdown: {
            position: 'absolute',
            top: 24,
            right: 0,
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 6,
            minWidth: 120,
            zIndex: 20,
        },
        feedMenuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
        },
        feedMenuText: {
            fontSize: 12,
            color: colors.text,
        },
        // Floating menu styles for proper z-index handling
        floatingMenuOverlay: {
            position: 'fixed' as any,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998,
            backgroundColor: 'transparent',
        },
        floatingMenuDropdown: {
            position: 'fixed' as any,
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 10,
            zIndex: 9999,
            minWidth: 140,
            paddingVertical: 4,
        },
        floatingMenuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 16,
        },
        floatingMenuItemText: {
            fontSize: 14,
            color: colors.text,
        },
        avatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
        },
        authorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
        },
        feedAuthor: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        feedUsername: {
            fontSize: 12,
            color: colors.textMuted,
            fontWeight: '400',
        },
        feedCompany: {
            fontSize: 12,
            color: colors.textMuted,
            fontStyle: 'italic',
        },
        stakeholderBadge: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
        },
        stakeholderBadgeText: {
            fontSize: 9,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        verifiedBadge: {
            marginLeft: 4,
            alignItems: 'center',
            justifyContent: 'center',
        },
        feedMeta: {
            fontSize: 11,
            color: colors.textMuted,
        },
        feedText: {
            fontSize: 13,
            color: colors.text,
            lineHeight: 20,
        },
        moreText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.primary,
        },
        feedReactions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginTop: 4,
        },
        reactionItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            minHeight: 36, // Ensure minimum touch target size for mobile
        },
        reactionText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        reactionTextActive: {
            color: '#EF4444',
        },
        reactionTextReshared: {
            color: '#22C55E',
        },
        attachmentStack: {
            gap: 10,
        },
        feedImage: {
            width: '100%',
            minHeight: 200,
            maxHeight: 400,
            borderRadius: 16,
            aspectRatio: 16 / 9,
        },
        audioBubble: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: colors.surface,
        },
        audioDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
        },
        audioText: {
            fontSize: 11,
            color: colors.text,
        },
        fileBubble: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: colors.surfaceMuted,
        },
        fileText: {
            fontSize: 12,
            color: colors.text,
            flex: 1,
        },
        reshareCard: {
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            padding: 12,
            marginTop: 8,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
        },
        reshareHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
        },
        reshareContent: {
            gap: 8,
        },
        reshareAuthorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        reshareAvatar: {
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        reshareAuthorName: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        reshareTime: {
            fontSize: 11,
            color: colors.textSecondary,
        },
        reshareBody: {
            fontSize: 14,
            color: colors.text,
            lineHeight: 20,
        },
        reshareAttachments: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 4,
        },
        reshareImage: {
            width: 120,
            height: 120,
            borderRadius: 8,
        },
        messageComposer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            paddingBottom: bottomInset + 8,
        },
        composerIconBtn: {
            padding: 6,
        },
        composerInputWrapper: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
        },
        messageInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
        composerActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        sendButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            marginLeft: 4,
        },
        attachmentPreview: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 8,
        },
        attachmentItem: {
            position: 'relative',
        },
        attachmentThumb: {
            width: 60,
            height: 60,
            borderRadius: 8,
        },
        attachmentFileIcon: {
            width: 60,
            height: 60,
            borderRadius: 8,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        attachmentRemove: {
            position: 'absolute',
            top: -6,
            right: -6,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#EF4444',
            alignItems: 'center',
            justifyContent: 'center',
        },
        recordingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: bottomInset + 12,
            backgroundColor: colors.surfaceMuted,
        },
        recordingIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        recordingDot: {
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#EF4444',
        },
        recordingText: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '500',
        },
        recordingActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        cancelRecordingBtn: {
            padding: 8,
        },
        stopRecordingBtn: {
            backgroundColor: '#5865F2',
            borderRadius: 20,
            padding: 10,
        },
        reportOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        reportBackdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        reportCard: {
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
        },
        reportHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        reportTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        reportSubtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 14,
        },
        reportReasonGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        reportReasonChip: {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        reportReasonChipActive: {
            backgroundColor: '#111111',
            borderColor: '#111111',
        },
        reportReasonText: {
            fontSize: 12,
            color: colors.text,
        },
        reportReasonTextActive: {
            color: '#FFFFFF',
            fontWeight: '600',
        },
        reportNotesWrap: {
            marginTop: 16,
        },
        reportNotesLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 6,
        },
        reportNotesInput: {
            minHeight: 80,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            color: colors.text,
            backgroundColor: colors.surfaceMuted,
            textAlignVertical: 'top',
        },
        reportActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 18,
        },
        reportCancelBtn: {
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
        },
        reportCancelText: {
            fontSize: 12,
            color: colors.text,
        },
        reportSubmitBtn: {
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 18,
            backgroundColor: '#111111',
        },
        reportSubmitBtnDisabled: {
            opacity: 0.6,
        },
        reportSubmitText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        emojiModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        emojiModalContent: {
            width: 320,
            maxHeight: 400,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
        },
        emojiModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        emojiModalTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        emojiGrid: {
            maxHeight: 300,
        },
        emojiRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
        },
        emojiBtn: {
            width: '12.5%',
            aspectRatio: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emojiText: {
            fontSize: 24,
        },
        commentModalOverlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        commentBackdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        commentModalContent: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '80%',
            minHeight: 400,
        },
        commentModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        commentModalTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
        },
        commentList: {
            flex: 1,
        },
        commentListContent: {
            padding: 16,
            gap: 16,
        },
        commentLoading: {
            padding: 40,
            alignItems: 'center',
        },
        commentLoadingText: {
            color: colors.textMuted,
            fontSize: 14,
        },
        commentEmpty: {
            padding: 40,
            alignItems: 'center',
            gap: 8,
        },
        commentEmptyText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        commentEmptySubtext: {
            fontSize: 14,
            color: colors.textMuted,
        },
        commentItem: {
            flexDirection: 'row',
            gap: 12,
        },
        commentAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
        },
        commentBody: {
            flex: 1,
            gap: 4,
        },
        commentAuthorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        commentAuthor: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        commentUsername: {
            fontSize: 12,
            color: colors.textMuted,
        },
        commentBadge: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
        },
        commentBadgeText: {
            fontSize: 10,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        commentTime: {
            fontSize: 12,
            color: colors.textMuted,
            marginLeft: 'auto',
        },
        commentText: {
            fontSize: 14,
            color: colors.text,
            lineHeight: 20,
        },
        commentInputContainer: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 12,
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        commentInput: {
            flex: 1,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 14,
            color: colors.text,
            maxHeight: 100,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
        commentSendBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        commentSendBtnDisabled: {
            opacity: 0.5,
        },
        commentSendText: {
            color: '#fff',
            fontWeight: '600',
        },
        rightPanel: {
            width: 300,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            margin: 16,
            marginLeft: 0,
            padding: 20,
            gap: 16,
        },
        dmHeader: {
            gap: 12,
        },
        dmTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
        },
        dmSearchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
        },
        dmSearchText: {
            fontSize: 12,
            color: colors.textSubtle,
        },
        addFriendsBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        addFriendsText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
        },
        avatarRow: {
            flexGrow: 0,
        },
        dmAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            marginRight: 10,
        },
        dmList: {
            gap: 12,
            paddingBottom: 16,
        },
        dmRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: colors.surfaceMuted,
        },
        dmRowActive: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        dmAvatarLarge: {
            width: 36,
            height: 36,
            borderRadius: 18,
        },
        dmInfo: {
            flex: 1,
            gap: 2,
        },
        dmName: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
        },
        dmMeta: {
            fontSize: 11,
            color: colors.textMuted,
        },
        dmTime: {
            fontSize: 10,
            color: colors.textSubtle,
        },
    });

export default TenantCommunityScreen;
