import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    useWindowDimensions,
    Modal,
    Pressable,
    Platform,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    UserPlus,
    Plus,
    FolderPlus,
    Settings,
    Bell,
    Shield,
    MessageSquare,
    Trophy,
    DollarSign,
    TrendingUp,
    Sun,
    Moon,
    X,
    Calendar,
    Trash2,
    Lock,
    Mic,
    ChevronDown,
    Check,
    Headphones,
    ArrowLeft,
    Pin,
    Users,
    Search,
    SearchX,
    Edit,
    BadgeCheck,
    MoreHorizontal,
    Repeat,
    PlayCircle,
    FileText,
    MessageCircle,
    Heart,
    Square,
    PlusCircle,
    Paperclip,
    Smile,
    Send,
    Award,
    Megaphone,
    Clock,
    MapPin,
    Copy,
    ChevronLeft,
    ChevronRight,
    Building2,
    Eye,
    Volume2,
    VolumeX,
    UserMinus,
    MoreVertical,
    Link,
    Ban,
    AlertTriangle,
    Play,
    Globe,
    Flag,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    CheckCircle,
    Mail,
    ShieldCheck,
    Info,
    User,
    ArrowUp,
    ArrowDown,
    FilterX,
    CalendarPlus,
    File,
    XCircle,
    CheckCheck,
    AlertCircle,
    Handshake,
    RefreshCw,
    ShoppingBag,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import { communityGet, communityPost, communityPatch, communityPut, communityDelete, getTenantId, getUserId, resolveTenantId, getOnlineStatus, updatePresence, setUserOnline, uploadFile, getAuthUser, initiateChannelCall, logout, inviteStakeholder, StakeholderBadge, getNotificationPreferences, updateNotificationPreferences, getCustomRoles, createCustomRole, updateCustomRole, deleteCustomRole, assignCustomRole, removeCustomRole, CustomRole } from '../lib/api';
import { useTheme } from '../lib/theme';
import { GlassButton, GlassIconButton, GlassModal, GlassStatCard, GlassBadge, GlassInput, GlassRail } from './glass';
import UserAvatar from './UserAvatar';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { ErrorRetry } from './ErrorRetry';
import { MessageSkeleton, ChannelSkeleton } from './SkeletonLoader';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { generateTempId, isTempId } from '../lib/messageQueue';
import { useQueryClient } from '@tanstack/react-query';
import { useScrollToBottom } from '../hooks';
import { hapticLight, hapticSuccess, hapticError, hapticMedium } from '../lib/haptics';
import {
    useSubgrids,
    useChannels,
    useMembers,
    usePosts,
    useCategories,
    useEvents,
    useChannelMessages,
    useInfiniteChannelMessages,
    useContentModerationSettings,
    useUpdateContentModeration,
    useAddProhibitedWords,
    useRemoveProhibitedWords,
    useEngagementSettings,
    useUpdateEngagementSettings,
    useBannedUsers,
    useBanUser,
    useUnbanUser,
    useUpdateSubgrid,
    useCustomRoles,
    useCreateCustomRole,
    useUpdateCustomRole,
    useDeleteCustomRole,
    useAssignCustomRole,
    useCreateChannel,
    useUpdateChannel,
    useDeleteChannel,
    useRemoveMember,
    useUpdateMemberRole,
    useUpdateMemberStatus,
    useCreateCategory,
    useDeleteCategory,
    useCreateEvent,
    useDeleteEvent,
    useDeletePost,
    useDeleteMessage,
    usePinMessage,
    useUnpinMessage,
    useLikeItem,
    useUnlikeItem,
    useReshareItem,
    useUnreshareItem,
    useAddChannelMember,
    useRemoveChannelMember,
    useCreateComment,
    useFlagContent,
    useModerationAction,
    useCreateSubgrid,
    usePrivacySettings,
    useUpdatePrivacySettings,
} from '../hooks/queries';
import { queryKeys } from '../lib/queryClient';

// Helper to convert Blob to data URL
const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

type Channel = {
    _id: string;
    name?: string;
    type?: 'text' | 'announcement' | 'voice';
    visibility?: string;
    categoryId?: string;
};

type Category = {
    _id: string;
    name?: string;
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

type Subgrid = {
    _id: string;
    name?: string;
    description?: string;
    icon?: string;
    inviteCode?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    status?: string;
    engagementSettings?: {
        joinMessage?: boolean;
        uploadNotice?: boolean;
        emojiReactions?: boolean;
        autoEmoji?: boolean;
        stickersAutocomplete?: boolean;
    };
};

type Post = {
    _id: string;
    authorId?: string;
    body?: string;
    createdAt?: string;
    attachments?: any[];
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
    createdAt?: string;
    attachments?: any[];
    likeCount?: number;
    reshareCount?: number;
    commentCount?: number;
    userLiked?: boolean;
    userReshared?: boolean;
};

type Member = {
    _id?: string;
    oderId?: string;
    userId?: string;
    role?: string;
    status?: string;
    // Direct fields from enriched API
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
    userRole?: string;
    stakeholderBadge?: StakeholderBadge;
    company?: string;
    // Custom role assigned by CU Admin
    customRole?: {
        _id: string;
        name: string;
        color: string;
    };
    // Computed userName for display
    userName?: string;
    // Nested user object (fallback)
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        username?: string;
        avatarUrl?: string;
        role?: string;
        stakeholderBadge?: StakeholderBadge;
        company?: string;
    };
};

type ChannelPermissionKey = 'members' | 'stakeholders' | 'serverAdmin' | 'serverOwner';
type EngagementSettingKey =
    | 'joinMessage'
    | 'uploadNotice'
    | 'emojiReactions'
    | 'autoEmoji'
    | 'stickersAutocomplete';

const formatDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getMemberName = (member: Member) => {
    // Check both direct fields (from enriched API) and nested user object
    const firstName = member.firstName || member.user?.firstName;
    const lastName = member.lastName || member.user?.lastName;
    const email = member.email || member.user?.email;
    const id = member.userId || member.user?._id || member._id;

    if (firstName || lastName) {
        const name = [firstName, lastName].filter(Boolean).join(' ');
        return name || email || `Member ${String(id).slice(-6)}`;
    }
    if (email) return email;
    return `Member ${String(id).slice(-6)}`;
};

const getAuthorName = (authorId?: string, members?: Member[]) => {
    if (!authorId || !members) return `User ${String(authorId).slice(-6)}`;
    // Ensure authorId is a string for comparison
    const authorIdStr = String(authorId);
    // Check userId (direct), user._id (nested), or _id (fallback)
    // Use String() to ensure consistent comparison since ObjectIds may be returned as objects
    const member = members.find(m =>
        String(m.userId) === authorIdStr ||
        String(m.user?._id) === authorIdStr ||
        String(m._id) === authorIdStr
    );
    if (member) return getMemberName(member);
    return `User ${authorIdStr.slice(-6)}`;
};

const getMemberAvatarUrl = (member?: Member) => {
    if (!member) return null;
    return member.avatarUrl || member.user?.avatarUrl || null;
};

const getMemberEmail = (member: Member) => {
    return member.email || member.user?.email || '';
};

const getMemberUsername = (member?: Member) => {
    if (!member) return null;
    return member.username || member.user?.username || null;
};

const getMemberCompany = (member?: Member) => {
    if (!member) return null;
    return member.company || member.user?.company || null;
};

const getMemberBadge = (member?: Member): StakeholderBadge | null => {
    if (!member) return null;
    return member.stakeholderBadge || member.user?.stakeholderBadge || null;
};

const isMemberAdmin = (member?: Member): boolean => {
    if (!member) return false;
    const role = member.role || member.userRole || member.user?.role || '';
    return ['owner', 'admin', 'subgrid_admin', 'super_admin'].includes(role.toLowerCase());
};

const getMemberDisplayUsername = (member?: Member): string => {
    if (!member) return '';
    // If admin, show "Server Admin" unless they have a custom username
    if (isMemberAdmin(member)) {
        const username = member.username || member.user?.username;
        return username || 'Server Admin';
    }
    return member.username || member.user?.username || '';
};

const getMemberDisplayName = (member?: Member): string => {
    if (!member) return 'Unknown User';
    return getMemberName(member);
};

const REPORT_REASONS = ['Spam', 'Harassment', 'Hate speech', 'Scam', 'Nudity', 'Other'];

const STAKEHOLDER_BADGE_COLORS: Record<StakeholderBadge, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};

type ModerationFlag = {
    _id: string;
    contentType?: 'message' | 'post' | 'comment' | 'direct_message';
    contentId?: string;
    reason?: string;
    createdAt?: string;
    content?: any;
};


const CreditUnionAdminScreen = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 900;
    const insets = useSafeAreaInsets();
    // Calculate safe area values for mobile
    const bottomInset = Platform.OS !== 'web' && isMobile ? Math.max(insets.bottom, 12) : 0;
    const topInset = Platform.OS !== 'web' && isMobile ? Math.max(insets.top, 16) : 0;
    const styles = useMemo(() => createStyles(colors, mode, bottomInset, topInset), [colors, mode, bottomInset, topInset]);
    const [mobileShowContent, setMobileShowContent] = useState(false);
    const [mobileShowSettingsContent, setMobileShowSettingsContent] = useState(false);
    const { subscribe, joinRoom, leaveRoom, isConnected, startTyping, stopTyping } = useWebSocketContext();

    const handleLogout = async () => {
        try {
            await logout();
            router.replace('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    const userId = getUserId();
    const queryClient = useQueryClient();
    const [tenantId, setTenantId] = useState(getTenantId());
    const [activeSubgridId, setActiveSubgridId] = useState('');
    const [activeChannelId, setActiveChannelId] = useState('');
    const [memberOnlineStatuses, setMemberOnlineStatuses] = useState<Record<string, boolean>>({});
    const [error, setError] = useState('');

    // React Query hooks for data fetching with caching
    const subgridsQuery = useSubgrids(tenantId);
    const channelsQuery = useChannels(activeSubgridId);
    const membersQuery = useMembers(activeSubgridId);
    const postsQuery = usePosts(activeSubgridId);
    const categoriesQuery = useCategories(activeSubgridId);
    const eventsQuery = useEvents(activeSubgridId);
    const messagesQuery = useChannelMessages(activeSubgridId, activeChannelId);
    const infiniteMessagesQuery = useInfiniteChannelMessages(activeSubgridId, activeChannelId);

    // Pull-to-refresh state
    const [refreshing, setRefreshing] = useState(false);
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                channelsQuery.refetch(),
                membersQuery.refetch(),
                messagesQuery.refetch(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, []);

    // Server Settings React Query hooks
    const contentModerationQuery = useContentModerationSettings(activeSubgridId);
    const updateContentModerationMutation = useUpdateContentModeration(activeSubgridId);
    const addProhibitedWordsMutation = useAddProhibitedWords(activeSubgridId);
    const removeProhibitedWordsMutation = useRemoveProhibitedWords(activeSubgridId);
    const engagementSettingsQuery = useEngagementSettings(activeSubgridId);
    const updateEngagementSettingsMutation = useUpdateEngagementSettings(activeSubgridId);
    const bannedUsersQuery = useBannedUsers(activeSubgridId);
    const banUserMutation = useBanUser(activeSubgridId);
    const unbanUserMutation = useUnbanUser(activeSubgridId);
    const updateSubgridMutation = useUpdateSubgrid(activeSubgridId);
    const customRolesQuery = useCustomRoles(activeSubgridId);
    const createCustomRoleMutation = useCreateCustomRole(activeSubgridId);
    const updateCustomRoleMutation = useUpdateCustomRole(activeSubgridId);
    const deleteCustomRoleMutation = useDeleteCustomRole(activeSubgridId);
    const assignCustomRoleMutation = useAssignCustomRole(activeSubgridId);

    // Channel mutations
    const createChannelMutation = useCreateChannel(activeSubgridId);
    const updateChannelMutation = useUpdateChannel(activeSubgridId);
    const deleteChannelMutation = useDeleteChannel(activeSubgridId);

    // Member mutations
    const removeMemberMutation = useRemoveMember(activeSubgridId);
    const updateMemberRoleMutation = useUpdateMemberRole(activeSubgridId);
    const updateMemberStatusMutation = useUpdateMemberStatus(activeSubgridId);

    // Category mutations
    const createCategoryMutation = useCreateCategory(activeSubgridId);
    const deleteCategoryMutation = useDeleteCategory(activeSubgridId);

    // Event mutations
    const createEventMutation = useCreateEvent(activeSubgridId);
    const deleteEventMutation = useDeleteEvent(activeSubgridId);

    // Post/Message mutations
    const deletePostMutation = useDeletePost(activeSubgridId);
    const deleteMessageMutation = useDeleteMessage(activeSubgridId);
    const pinMessageMutation = usePinMessage(activeSubgridId);
    const unpinMessageMutation = useUnpinMessage(activeSubgridId);

    // Like/Reshare mutations
    const likeItemMutation = useLikeItem(activeSubgridId);
    const unlikeItemMutation = useUnlikeItem(activeSubgridId);
    const reshareItemMutation = useReshareItem(activeSubgridId);
    const unreshareItemMutation = useUnreshareItem(activeSubgridId);

    // Channel member mutations
    const addChannelMemberMutation = useAddChannelMember(activeSubgridId);
    const removeChannelMemberMutation = useRemoveChannelMember(activeSubgridId);

    // Comment mutation
    const createCommentMutation = useCreateComment(activeSubgridId);

    // Moderation mutations
    const flagContentMutation = useFlagContent(activeSubgridId);
    const moderationActionMutation = useModerationAction(activeSubgridId);

    // Create subgrid mutation
    const createSubgridMutation = useCreateSubgrid(tenantId);

    // Derived data from React Query
    const subgrids: Subgrid[] = subgridsQuery.data || [];
    const channels: Channel[] = channelsQuery.data || [];
    const members: Member[] = useMemo(() => {
        const rawMembers = membersQuery.data || [];
        return rawMembers.map((m: Member) => ({
            ...m,
            userName: m.firstName && m.lastName
                ? `${m.firstName} ${m.lastName}`
                : m.username || m.user?.firstName && m.user?.lastName
                    ? `${m.user?.firstName} ${m.user?.lastName}`
                    : m.user?.username || m.email || 'Unknown User',
        }));
    }, [membersQuery.data]);
    const posts: Post[] = postsQuery.data || [];
    const categories: Category[] = categoriesQuery.data || [];
    const events: Event[] = eventsQuery.data || [];
    // Derived settings from React Query
    const contentModerationSettings = contentModerationQuery.data || { enabled: true, prohibitedWords: [], action: 'block' as const, localBlockedMessage: 'Your message contains prohibited content and cannot be sent.' };
    const engagementSettings = engagementSettingsQuery.data || { joinMessage: true, uploadNotice: true, emojiReactions: true, autoEmoji: false, stickersAutocomplete: true };
    const bannedUsers = bannedUsersQuery.data || [];
    const customRoles: CustomRole[] = customRolesQuery.data || [];
    // Privacy Settings - connected to API (must be before useEffect that references it)
    const privacyQuery = usePrivacySettings();
    const updatePrivacyMutation = useUpdatePrivacySettings();

    // Sync privacy settings from API
    useEffect(() => {
        if (privacyQuery.data) {
            setPrivacyProfileVisibility(privacyQuery.data.profileVisibility || 'hidden');
            setPrivacyAllowDMsFrom(privacyQuery.data.allowDMsFrom || 'friends_only');
            setPrivacyAllowFriendRequestsFrom(privacyQuery.data.allowFriendRequestsFrom || 'everyone');
            setPrivacyShowOnlineStatus(privacyQuery.data.showOnlineStatus !== false);
        }
    }, [privacyQuery.data]);

    // Messages need local state for WebSocket real-time updates
    const [messages, setMessages] = useState<Message[]>([]);

    // Sync messages from React Query (prefer infinite pages, fall back to regular)
    // Preserve optimistic messages (temp IDs with pending/sending/failed status)
    useEffect(() => {
        const serverMsgs = infiniteMessagesQuery.data?.pages
            ? infiniteMessagesQuery.data.pages.flat()
            : (messagesQuery.data || []);
        if (serverMsgs.length > 0 || messagesQuery.data || infiniteMessagesQuery.data) {
            setMessages(prev => {
                const optimisticMsgs = prev.filter((m: any) => isTempId(m._id) && (m._isPending || m._status === 'failed' || m._status === 'sending'));
                return [...serverMsgs, ...optimisticMsgs];
            });
        }
    }, [messagesQuery.data, infiniteMessagesQuery.data]);

    // Custom Roles UI State (data comes from customRolesQuery)
    const loadingRoles = customRolesQuery.isLoading;
    const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleColor, setNewRoleColor] = useState('#3B82F6');
    const [assignRoleModalOpen, setAssignRoleModalOpen] = useState(false);
    const [assigningMember, setAssigningMember] = useState<Member | null>(null);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');

    // UI State
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [serverMenuOpen, setServerMenuOpen] = useState(false);
    const [messageDraft, setMessageDraft] = useState('');
    const [showMembersSidebar, setShowMembersSidebar] = useState(false);

    // Chat Input State
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [attachments, setAttachments] = useState<Array<{ uri: string; name: string; type: string }>>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingError, setRecordingError] = useState('');
    const recordingInterval = useRef<NodeJS.Timeout | null>(null);
    const recordingStartRef = useRef<number>(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const prevFeedItemsCountRef = useRef<number>(0);

    // Typing indicator state
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const channelIsTypingRef = useRef(false);
    const channelStopTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Centralized scroll management
    const {
        scrollViewRef: feedScrollRef,
        keyboardAwareRef,
        scrollToBottom,
        handleContentSizeChange,
        handleScrollViewLayout,
        resetScrollState,
        markForInitialScroll,
    } = useScrollToBottom();

    // expo-audio recorder hook (for native platforms)
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

    // Common emojis for picker
    const emojis = [
        '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌',
        '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑',
        '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
        '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
        '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🖐️', '✋', '👏',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💖',
        '🔥', '✨', '🎉', '🎊', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣',
    ];

    // Modal States
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false);
    const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false);
    const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
    const [serverSettingsModalOpen, setServerSettingsModalOpen] = useState(false);
    const [notificationSettingsModalOpen, setNotificationSettingsModalOpen] = useState(false);
    const [privacySettingsModalOpen, setPrivacySettingsModalOpen] = useState(false);
    const [editChannelModalOpen, setEditChannelModalOpen] = useState(false);
    const [channelPermissionModalOpen, setChannelPermissionModalOpen] = useState(false);
    const [channelSettingsModalOpen, setChannelSettingsModalOpen] = useState(false);
    const [selectedSettingsChannel, setSelectedSettingsChannel] = useState<Channel | null>(null);

    // Success & Confirmation Modal States
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successModalMessage, setSuccessModalMessage] = useState('');
    const [successModalTitle, setSuccessModalTitle] = useState('');
    const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [deleteConfirmData, setDeleteConfirmData] = useState<{ type: 'channel' | 'post' | 'message'; id: string; name?: string } | null>(null);

    // Form States
    const [inviteEmail, setInviteEmail] = useState('');
    const [selectedStakeholderBadge, setSelectedStakeholderBadge] = useState<StakeholderBadge>('stakeholder');
    const [invitingStakeholder, setInvitingStakeholder] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
    const [isPrivateChannel, setIsPrivateChannel] = useState(false);
    const [newChannelCategoryId, setNewChannelCategoryId] = useState('');
    const [editChannelId, setEditChannelId] = useState('');
    const [editChannelName, setEditChannelName] = useState('');
    const [editChannelType, setEditChannelType] = useState<'text' | 'voice'>('text');
    const [editChannelPrivate, setEditChannelPrivate] = useState(false);
    const [editChannelCategoryId, setEditChannelCategoryId] = useState('');
    const [permissionChannelId, setPermissionChannelId] = useState('');
    const [channelPermissions, setChannelPermissions] = useState({
        members: true,
        stakeholders: true,
        serverAdmin: true,
        serverOwner: true,
    });
    const [channelMembersModalOpen, setChannelMembersModalOpen] = useState(false);
    const [channelMembers, setChannelMembers] = useState<any[]>([]);
    const [addMemberSearchQuery, setAddMemberSearchQuery] = useState('');
    const [managingChannelId, setManagingChannelId] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isPrivateCategory, setIsPrivateCategory] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDescription, setNewEventDescription] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventType, setNewEventType] = useState<'event' | 'announcement'>('event');
    const [newEventLocation, setNewEventLocation] = useState('');
    const [showEventsView, setShowEventsView] = useState(false);
    const [showRevenueView, setShowRevenueView] = useState(false);
    const [showRevShareTab, setShowRevShareTab] = useState(false);
    const [showPartnerListingsView, setShowPartnerListingsView] = useState(false);
    const [showPartnerRequestsView, setShowPartnerRequestsView] = useState(false);
    const [partnerListings, setPartnerListings] = useState<any[]>([]);
    const [partnerListingsLoading, setPartnerListingsLoading] = useState(false);
    const [listingActionTarget, setListingActionTarget] = useState<any | null>(null);
    const [listingActionModalOpen, setListingActionModalOpen] = useState(false);
    const [listingActionLoading, setListingActionLoading] = useState(false);
    const [revShareSummary, setRevShareSummary] = useState<any>(null);
    const [partnerRevShare, setPartnerRevShare] = useState<any[]>([]);
    const [revShareLoading, setRevShareLoading] = useState(false);
    const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
    const [revShareData, setRevShareData] = useState<{
        totalRevShare: number;
        partners: Array<{
            partnerId: string;
            businessName: string;
            cuAmount: number;
            transactionCount: number;
            percent: number;
        }>;
    } | null>(null);
    const [serverName, setServerName] = useState('');
    const [serverDescription, setServerDescription] = useState('');
    const [serverLogoUrl, setServerLogoUrl] = useState('');
    const [serverIconUploading, setServerIconUploading] = useState(false);
    const [createServerModalOpen, setCreateServerModalOpen] = useState(false);
    const [newServerName, setNewServerName] = useState('');
    const [newServerDescription, setNewServerDescription] = useState('');
    const [newServerVisibility, setNewServerVisibility] = useState<'private' | 'public'>('private');

    // Notification Settings
    const [notifyAllMessages, setNotifyAllMessages] = useState(true);
    const [notifyMentions, setNotifyMentions] = useState(true);
    const [notifyEvents, setNotifyEvents] = useState(true);
    const [notifyDMs, setNotifyDMs] = useState(true);
    const [notifyCalls, setNotifyCalls] = useState(true);
    const [notificationSettingsLoading, setNotificationSettingsLoading] = useState(false);
    const [notificationSettingsSaving, setNotificationSettingsSaving] = useState(false);

    // Privacy Settings
    const [privacyProfileVisibility, setPrivacyProfileVisibility] = useState<'hidden' | 'friends_only' | 'public'>('hidden');
    const [privacyAllowDMsFrom, setPrivacyAllowDMsFrom] = useState<'nobody' | 'friends_only' | 'everyone'>('friends_only');
    const [privacyAllowFriendRequestsFrom, setPrivacyAllowFriendRequestsFrom] = useState<'nobody' | 'members_only' | 'everyone'>('everyone');
    const [privacyShowOnlineStatus, setPrivacyShowOnlineStatus] = useState(true);

    // Call State
    const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
    const [callError, setCallError] = useState('');
    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(false);
    const activeStreamRef = useRef<any>(null);

    // Audio/Headphone dropdown states
    const [showMicDropdown, setShowMicDropdown] = useState(false);
    const [showHeadphoneDropdown, setShowHeadphoneDropdown] = useState(false);
    const [selectedMic, setSelectedMic] = useState('Default Microphone');
    const [selectedHeadphone, setSelectedHeadphone] = useState('Default Speakers');
    const micOptions = ['Default Microphone', 'Built-in Microphone', 'External Mic', 'Headset Mic'];
    const headphoneOptions = ['Default Speakers', 'Built-in Speakers', 'Headphones', 'External Speakers'];

    // Pinned messages state
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [showPinnedMessages, setShowPinnedMessages] = useState(false);

    // Item menu state (for post/message delete dropdown) - using floating menu approach
    const [itemMenuOpen, setItemMenuOpen] = useState<string | null>(null);
    const [itemMenuPosition, setItemMenuPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const [itemMenuItem, setItemMenuItem] = useState<any>(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
    const [reportNotes, setReportNotes] = useState('');
    const [reportTarget, setReportTarget] = useState<{ id: string; type: 'post' | 'message' } | null>(null);
    const [reportSubmitting, setReportSubmitting] = useState(false);

    // Comment modal state
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [commentTarget, setCommentTarget] = useState<{ id: string; isPost: boolean } | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    // Moderation queue state (server settings)
    const [moderationQueue, setModerationQueue] = useState<ModerationFlag[]>([]);
    const [moderationError, setModerationError] = useState('');
    const [moderationMenuOpen, setModerationMenuOpen] = useState<string | null>(null);
    const [moderationDetailOpen, setModerationDetailOpen] = useState(false);
    const [activeModerationItem, setActiveModerationItem] = useState<ModerationFlag | null>(null);
    const [moderationActionLoading, setModerationActionLoading] = useState(false);

    // Server Settings Tab
    const [settingsTab, setSettingsTab] = useState('server-profile');
    const [partnershipStatus, setPartnershipStatus] = useState<'open' | 'invite' | 'closed'>('open');
    const [partnershipStatusSaving, setPartnershipStatusSaving] = useState(false);
    const [revShareRate, setRevShareRate] = useState<number>(10);
    const [revShareRateSaving, setRevShareRateSaving] = useState(false);
    const [vendorInviteEmail, setVendorInviteEmail] = useState('');
    const [vendorInviteSending, setVendorInviteSending] = useState(false);
    const [vendorInvites, setVendorInvites] = useState<any[]>([]);
    const [vendorInvitesLoading, setVendorInvitesLoading] = useState(false);
    const [accountEmail, setAccountEmail] = useState('');
    const [selectedBanner, setSelectedBanner] = useState(0);
    const [membersSearch, setMembersSearch] = useState('');
    const [stakeholdersSearch, setStakeholdersSearch] = useState('');
    const [selectedStakeholder, setSelectedStakeholder] = useState<Member | null>(null);
    const [stakeholderDetailModalOpen, setStakeholderDetailModalOpen] = useState(false);
    const [feedSearchQuery, setFeedSearchQuery] = useState('');
    // Member management state
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [memberActionModalOpen, setMemberActionModalOpen] = useState(false);
    const [memberDetailModalOpen, setMemberDetailModalOpen] = useState(false);
    const bannerColors = [
        ['#1a1a2e', '#16213e'],
        ['#ff6b6b', '#ee5a5a'],
        ['#ff9a9e', '#fecfef'],
        ['#a18cd1', '#fbc2eb'],
        ['#96e6a1', '#d4fc79'],
        ['#667eea', '#764ba2'],
        ['#00c9ff', '#92fe9d'],
        ['#11998e', '#38ef7d'],
        ['#fc5c7d', '#6a82fb'],
    ];
    // Content Moderation form inputs (for user editing before save)
    const [newProhibitedWord, setNewProhibitedWord] = useState('');
    const [contentModerationTestText, setContentModerationTestText] = useState('');
    const [contentModerationTestResult, setContentModerationTestResult] = useState<{ isProhibited: boolean; matchedWords: string[]; filteredContent: string } | null>(null);
    // Local edit state for content moderation settings (synced from React Query)
    const [localContentModerationEnabled, setLocalContentModerationEnabled] = useState(true);
    const [localContentModerationAction, setLocalContentModerationAction] = useState<'block' | 'flag' | 'censor'>('block');
    const [localBlockedMessage, setLocalBlockedMessage] = useState('Your message contains prohibited content and cannot be sent.');
    // Local edit state for engagement settings (synced from React Query)
    const [localEngagementSettings, setLocalEngagementSettings] = useState({
        joinMessage: true,
        uploadNotice: true,
        emojiReactions: true,
        autoEmoji: false,
        stickersAutocomplete: true,
    });

    // Partnership Requests State
    const [partnershipRequestsOpen, setPartnershipRequestsOpen] = useState(false);
    const [partnershipApplications, setPartnershipApplications] = useState<any[]>([]);
    const [partnershipApplicationsLoading, setPartnershipApplicationsLoading] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
    const [applicationActionOpen, setApplicationActionOpen] = useState(false);
    const [applicationFeedback, setApplicationFeedback] = useState('');
    const [applicationActionLoading, setApplicationActionLoading] = useState(false);
    const [partnerRequestsFilter, setPartnerRequestsFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('all');
    const [expandedApplicationIds, setExpandedApplicationIds] = useState<string[]>([]);

    // Bootstrap tenant and load user info
    useEffect(() => {
        console.log('[CUA Admin] Initializing...');
        resolveTenantId()
            .then((id) => {
                console.log('[CUA Admin] Resolved tenantId:', id);
                setTenantId(id || '');
            })
            .catch((err) => {
                console.error('[CUA Admin] Failed to resolve tenant:', err);
                setError(err.message || 'Failed to resolve tenant.');
            });

        // Load current user email for settings
        getAuthUser().then((user) => {
            console.log('[CUA Admin] Auth user:', user);
            if (user?.email) {
                setAccountEmail(user.email);
            }
        }).catch((err) => {
            console.error('[CUA Admin] Failed to get auth user:', err);
        });
    }, []);

    // Set active subgrid when subgrids load from React Query
    useEffect(() => {
        if (subgrids.length > 0) {
            setActiveSubgridId((current) => {
                if (!current) {
                    console.log('[CUA Admin] Setting active subgrid:', subgrids[0]._id);
                    setServerName(subgrids[0].name || '');
                    setServerDescription(subgrids[0].description || '');
                    setServerLogoUrl(subgrids[0].logoUrl || '');
                    return subgrids[0]._id;
                }
                return current;
            });
        }
    }, [subgrids]);

    // Sync local content moderation state with React Query data
    useEffect(() => {
        if (contentModerationQuery.data) {
            setLocalContentModerationEnabled(contentModerationQuery.data.enabled ?? true);
            setLocalContentModerationAction(contentModerationQuery.data.action || 'block');
            setLocalBlockedMessage(contentModerationQuery.data.localBlockedMessage || 'Your message contains prohibited content and cannot be sent.');
        }
    }, [contentModerationQuery.data]);

    // Sync local engagement settings with React Query data
    useEffect(() => {
        if (engagementSettingsQuery.data) {
            setLocalEngagementSettings({
                joinMessage: engagementSettingsQuery.data.joinMessage ?? true,
                uploadNotice: engagementSettingsQuery.data.uploadNotice ?? true,
                emojiReactions: engagementSettingsQuery.data.emojiReactions ?? true,
                autoEmoji: engagementSettingsQuery.data.autoEmoji ?? false,
                stickersAutocomplete: engagementSettingsQuery.data.stickersAutocomplete ?? true,
            });
        }
    }, [engagementSettingsQuery.data]);

    // Set default channel
    useEffect(() => {
        if (channels.length && !activeChannelId) {
            const general = channels.find(c => c.name?.toLowerCase() === 'general');
            setActiveChannelId(general?._id || channels[0]._id);
        }
    }, [channels]);

    // Messages are now loaded via React Query (messagesQuery) and synced to local state above

    // WebSocket: Join channel room and subscribe to new messages
    useEffect(() => {
        if (!activeChannelId || !activeSubgridId || !isConnected) return;

        const channelId = String(activeChannelId);

        // Join the channel room
        joinRoom('channel', channelId);

        // Subscribe to new messages - update both local state and React Query cache
        const unsubscribeNewMessage = subscribe('new_message', (data) => {
            if (data.roomType === 'channel' && String(data.roomId) === channelId && data.message) {
                setMessages((prev) => {
                    if (prev.some(m => m._id === data.message._id)) return prev;
                    return [...prev, data.message];
                });
                // Also update React Query cache
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, channelId),
                    (old: Message[] | undefined) => {
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
                setMessages((prev) => prev.map(m =>
                    m._id === data.message._id ? data.message : m
                ));
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, channelId),
                    (old: Message[] | undefined) => {
                        if (!old) return [data.message];
                        return old.map(m => m._id === data.message._id ? data.message : m);
                    }
                );
            }
        });

        // Subscribe to message deletions
        const unsubscribeMessageDeleted = subscribe('message_deleted', (data) => {
            if (data.roomType === 'channel' && String(data.roomId) === channelId) {
                setMessages((prev) => prev.filter(m => m._id !== data.messageId));
                queryClient.setQueryData(
                    queryKeys.messages.channel(activeSubgridId, channelId),
                    (old: Message[] | undefined) => {
                        if (!old) return [];
                        return old.filter(m => m._id !== data.messageId);
                    }
                );
            }
        });

        // Subscribe to typing events
        const unsubscribeTyping = subscribe('user_typing', (data: any) => {
            const typingUserId = String(data.userId || '');
            if (!typingUserId || typingUserId === userId) return;
            if (data.roomType !== 'channel' || String(data.roomId) !== channelId) return;

            if (data.isTyping) {
                setTypingUsers(prev => { const next = new Set(prev); next.add(typingUserId); return next; });
                const existing = typingTimeoutsRef.current.get(typingUserId);
                if (existing) clearTimeout(existing);
                typingTimeoutsRef.current.set(typingUserId, setTimeout(() => {
                    setTypingUsers(prev => { const next = new Set(prev); next.delete(typingUserId); return next; });
                    typingTimeoutsRef.current.delete(typingUserId);
                }, 3000));
            } else {
                setTypingUsers(prev => { const next = new Set(prev); next.delete(typingUserId); return next; });
                const existing = typingTimeoutsRef.current.get(typingUserId);
                if (existing) { clearTimeout(existing); typingTimeoutsRef.current.delete(typingUserId); }
            }
        });

        return () => {
            leaveRoom('channel', channelId);
            unsubscribeNewMessage();
            unsubscribeMessageUpdated();
            unsubscribeMessageDeleted();
            unsubscribeTyping();
            // Clear typing state on channel change
            setTypingUsers(new Set());
            typingTimeoutsRef.current.forEach(t => clearTimeout(t));
            typingTimeoutsRef.current.clear();
        };
    }, [activeChannelId, activeSubgridId, isConnected, subscribe, joinRoom, leaveRoom, queryClient, userId]);

    // WebSocket: Join subgrid room for channel/post/member updates
    useEffect(() => {
        if (!activeSubgridId || !isConnected) return;

        // Join the subgrid room
        joinRoom('subgrid', activeSubgridId);

        // Subscribe to channel events - update React Query cache
        const unsubscribeChannelCreated = subscribe('channel_created', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.channels(activeSubgridId),
                    (old: Channel[] | undefined) => old ? [...old, data.channel] : [data.channel]
                );
            }
        });

        const unsubscribeChannelUpdated = subscribe('channel_updated', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.channels(activeSubgridId),
                    (old: Channel[] | undefined) => old ? old.map(c => c._id === data.channel._id ? data.channel : c) : [data.channel]
                );
            }
        });

        const unsubscribeChannelDeleted = subscribe('channel_deleted', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.channels(activeSubgridId),
                    (old: Channel[] | undefined) => old ? old.filter(c => c._id !== data.channelId) : []
                );
            }
        });

        // Subscribe to post events - update React Query cache
        const unsubscribePostCreated = subscribe('post_created', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: Post[] | undefined) => old ? [data.post, ...old] : [data.post]
                );
            }
        });

        const unsubscribePostUpdated = subscribe('post_updated', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: Post[] | undefined) => old ? old.map(p => p._id === data.post._id ? data.post : p) : [data.post]
                );
            }
        });

        const unsubscribePostDeleted = subscribe('post_deleted', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: Post[] | undefined) => old ? old.filter(p => p._id !== data.postId) : []
                );
            }
        });

        // Subscribe to member events - update React Query cache
        const unsubscribeMemberJoined = subscribe('member_joined', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.members(activeSubgridId),
                    (old: Member[] | undefined) => old ? [...old, data.member] : [data.member]
                );
            }
        });

        const unsubscribeMemberLeft = subscribe('member_left', (data) => {
            if (data.subgridId === activeSubgridId) {
                queryClient.setQueryData(
                    queryKeys.subgrids.members(activeSubgridId),
                    (old: Member[] | undefined) => old ? old.filter(m => (m.userId || m._id) !== data.userId) : []
                );
            }
        });

        const unsubscribeMemberUpdated = subscribe('member_updated', (data) => {
            if (data.subgridId === activeSubgridId && data.member) {
                queryClient.setQueryData(
                    queryKeys.subgrids.members(activeSubgridId),
                    (old: Member[] | undefined) => old ? old.map(m => (m.userId || m._id) === (data.member.userId || data.member._id) ? { ...m, ...data.member } : m) : [data.member]
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
            unsubscribeMemberUpdated();
        };
    }, [activeSubgridId, isConnected, subscribe, joinRoom, leaveRoom, queryClient]);

    useEffect(() => {
        if (!serverSettingsModalOpen || settingsTab !== 'bans' || !activeSubgridId) return;
        loadModerationQueue();
    }, [serverSettingsModalOpen, settingsTab, activeSubgridId]);

    // Refetch content moderation settings when entering that tab
    const refetchContentModeration = contentModerationQuery.refetch;
    useEffect(() => {
        if (!serverSettingsModalOpen || settingsTab !== 'content-moderation' || !activeSubgridId) return;
        refetchContentModeration();
    }, [serverSettingsModalOpen, settingsTab, activeSubgridId, refetchContentModeration]);

    // Fetch and update member online statuses
    useEffect(() => {
        if (!activeSubgridId || members.length === 0) return;

        // Update current user's presence
        updatePresence(activeSubgridId).catch(err => console.warn('[CUA] Presence update failed:', err));

        // Fetch online statuses for members
        const fetchStatuses = async () => {
            const memberIds = members.map(m => m.userId || m.user?._id || m._id).filter(Boolean) as string[];
            if (memberIds.length === 0) return;
            const statuses = await getOnlineStatus(memberIds, activeSubgridId);
            setMemberOnlineStatuses(statuses);
        };

        fetchStatuses();

        // Poll for updates every 30 seconds
        const interval = setInterval(fetchStatuses, 30000);
        return () => clearInterval(interval);
    }, [activeSubgridId, members]);

    // Update online status when messages are received
    useEffect(() => {
        messages.forEach((msg) => {
            if (msg.senderId && msg.senderId !== userId) {
                setUserOnline(msg.senderId, true);
            }
        });
    }, [messages, userId]);

    useEffect(() => {
        if (!activeSubgridId) return;
        const current = subgrids.find((s) => s._id === activeSubgridId);
        if (!current) return;
        setServerName(current.name || '');
        setServerDescription(current.description || '');
        setServerLogoUrl(current.logoUrl || '');
        // Initialize banner color selection from saved coverImageUrl
        if (current.coverImageUrl) {
            const savedBannerIndex = bannerColors.findIndex(
                (colors) => colors[0] === current.coverImageUrl
            );
            if (savedBannerIndex !== -1) {
                setSelectedBanner(savedBannerIndex);
            }
        }
    }, [activeSubgridId, subgrids]);

    // Load notification preferences when modal opens
    useEffect(() => {
        if (!notificationSettingsModalOpen) return;
        const loadPreferences = async () => {
            setNotificationSettingsLoading(true);
            try {
                const res = await getNotificationPreferences();
                if (res.success && res.data) {
                    setNotifyAllMessages(res.data.messages ?? true);
                    setNotifyMentions(res.data.mentions ?? true);
                    setNotifyDMs(res.data.dms ?? true);
                    setNotifyCalls(res.data.calls ?? true);
                    setNotifyEvents(res.data.invites ?? true); // Map invites to events for UI
                }
            } catch (err) {
                console.error('Failed to load notification preferences:', err);
            } finally {
                setNotificationSettingsLoading(false);
            }
        };
        loadPreferences();
    }, [notificationSettingsModalOpen]);

    // Refetch custom roles when roles tab is selected
    const refetchCustomRoles = customRolesQuery.refetch;
    useEffect(() => {
        if (settingsTab === 'roles' && activeSubgridId) {
            refetchCustomRoles();
        }
    }, [settingsTab, activeSubgridId, refetchCustomRoles]);

    // Refetch engagement settings when engagement tab is selected
    const refetchEngagementSettings = engagementSettingsQuery.refetch;
    useEffect(() => {
        if (settingsTab === 'engagement' && activeSubgridId) {
            refetchEngagementSettings();
        }
    }, [settingsTab, activeSubgridId, refetchEngagementSettings]);

    const handleSaveNotificationSettings = async () => {
        setNotificationSettingsSaving(true);
        try {
            await updateNotificationPreferences({
                messages: notifyAllMessages,
                mentions: notifyMentions,
                dms: notifyDMs,
                calls: notifyCalls,
                invites: notifyEvents, // Map events to invites in backend
            });
            setNotificationSettingsModalOpen(false);
        } catch (err) {
            console.error('Failed to save notification preferences:', err);
            Alert.alert('Error', 'Failed to save notification settings');
        } finally {
            setNotificationSettingsSaving(false);
        }
    };

    const activeSubgrid = subgrids.find((s) => s._id === activeSubgridId);

    // Load partnership status from active subgrid when server settings modal opens
    useEffect(() => {
        if (!serverSettingsModalOpen || !activeSubgrid) return;
        setPartnershipStatus((activeSubgrid as any).partnershipStatus || 'open');
    }, [serverSettingsModalOpen, activeSubgrid]);

    const activeChannel = channels.find((c) => c._id === activeChannelId);
    const moderationContent = activeModerationItem?.content || {};
    const moderationAuthorId = moderationContent?.authorId || moderationContent?.senderId;
    const moderationAuthorMember = members.find((member) =>
        String(member.userId) === String(moderationAuthorId) || String(member.user?._id) === String(moderationAuthorId) || String(member._id) === String(moderationAuthorId)
    );
    const moderationAuthorName = moderationAuthorId ? getAuthorName(moderationAuthorId, members) : 'Unknown';
    const moderationContentText =
        moderationContent?.body || moderationContent?.text || moderationContent?.title || 'Content unavailable';

    const textChannels = channels.filter(c => c.type !== 'voice' && c.type !== 'announcement');
    const voiceChannels = channels.filter(c => c.type === 'voice');

    // Group channels by category for the sidebar
    const adminGroupedChannels = useMemo(() => {
        type AdminChannelGroup = {
            groupId: string;
            groupName: string;
            order: number;
            channels: Channel[];
        };
        const categoryMap = new Map<string, Category>();
        categories.forEach((cat) => categoryMap.set(cat._id, cat));

        const groupMap = new Map<string, Channel[]>();
        channels.forEach((channel) => {
            const catId = channel.categoryId || 'null';
            if (!groupMap.has(catId)) {
                groupMap.set(catId, []);
            }
            groupMap.get(catId)!.push(channel);
        });

        const groups: AdminChannelGroup[] = [];
        const uncategorized = groupMap.get('null') || [];
        if (uncategorized.length > 0) {
            const uncatText = uncategorized.filter((c) => c.type !== 'voice');
            const uncatVoice = uncategorized.filter((c) => c.type === 'voice');
            if (uncatText.length > 0) {
                groups.push({ groupId: '__uncategorized_text', groupName: 'Text Channels', order: -2, channels: uncatText });
            }
            if (uncatVoice.length > 0) {
                groups.push({ groupId: '__uncategorized_voice', groupName: 'Voice Channels', order: -1, channels: uncatVoice });
            }
        }
        groupMap.forEach((chans, catId) => {
            if (catId === 'null') return;
            const cat = categoryMap.get(catId);
            groups.push({
                groupId: catId,
                groupName: cat?.name || 'Unknown',
                order: cat?.order ?? 999,
                channels: chans,
            });
        });
        groups.sort((a, b) => a.order - b.order);
        return groups;
    }, [channels, categories]);

    // Check if data is still initializing (tenant not resolved or subgrids still loading)
    const isInitializing = !tenantId || subgridsQuery.isLoading || (!subgridsQuery.isFetched && !subgridsQuery.isError);

    // Check if server is empty (no channels) - only after data has fully loaded
    const isServerEmpty = !isInitializing && channels.length === 0 && !channelsQuery.isLoading && channelsQuery.isFetched;

    const permissionOptions: { key: ChannelPermissionKey; label: string }[] = [
        { key: 'members', label: 'Members' },
        { key: 'stakeholders', label: 'Stakeholders' },
        { key: 'serverAdmin', label: 'Server Admin' },
        { key: 'serverOwner', label: 'Server Owner' },
    ];
    const filteredMembers = useMemo(() => {
        const query = membersSearch.trim().toLowerCase();
        if (!query) return members;
        return members.filter((member) => {
            const name = getMemberName(member).toLowerCase();
            const email = getMemberEmail(member).toLowerCase();
            return name.includes(query) || email.includes(query);
        });
    }, [members, membersSearch]);

    // Filter stakeholders only
    const filteredStakeholders = useMemo(() => {
        const stakeholders = members.filter((member) => {
            // Check SubgridMembership role first, then fall back to user role
            const role = member.role || member.userRole || member.user?.role;
            return role === 'stakeholder';
        });
        const query = stakeholdersSearch.trim().toLowerCase();
        if (!query) return stakeholders;
        return stakeholders.filter((member) => {
            const name = getMemberName(member).toLowerCase();
            const email = getMemberEmail(member).toLowerCase();
            const company = (member.company || member.user?.company || '').toLowerCase();
            const badge = (member.stakeholderBadge || member.user?.stakeholderBadge || '').toLowerCase();
            return name.includes(query) || email.includes(query) || company.includes(query) || badge.includes(query);
        });
    }, [members, stakeholdersSearch]);

    // Combine posts and messages for feed, with search filtering
    // Sort ascending (oldest first) so newest messages appear at the bottom like WhatsApp
    const feedItems = useMemo(() => {
        let items = [...posts, ...messages].sort((a, b) => {
            return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        });

        // Filter by search query if present
        if (feedSearchQuery.trim()) {
            const query = feedSearchQuery.toLowerCase().trim();
            items = items.filter((item: any) => {
                // Search in message/post body
                const body = (item.body || '').toLowerCase();
                if (body.includes(query)) return true;

                // Search in author name
                const authorId = item.authorId || item.senderId;
                const authorName = getAuthorName(authorId, members).toLowerCase();
                if (authorName.includes(query)) return true;

                return false;
            });
        }

        return items;
    }, [posts, messages, feedSearchQuery, members]);

    // Scroll to bottom on initial load and when new messages are added (WhatsApp-style)
    const lastChannelIdRef = useRef<string | null>(null);

    useEffect(() => {
        // Reset scroll state when channel changes
        if (activeChannelId !== lastChannelIdRef.current) {
            resetScrollState();
            prevFeedItemsCountRef.current = 0;
            lastChannelIdRef.current = activeChannelId;
        }

        const prevCount = prevFeedItemsCountRef.current;
        const currentCount = feedItems.length;

        // Scroll to bottom on initial load (once) or when new items are added
        if (currentCount > 0) {
            if (prevCount === 0) {
                // Initial load
                markForInitialScroll();
            } else if (currentCount > prevCount) {
                // New messages added - scroll with animation
                setTimeout(() => scrollToBottom(true), 100);
            }
        }

        prevFeedItemsCountRef.current = currentCount;
    }, [feedItems.length, activeChannelId, resetScrollState, markForInitialScroll, scrollToBottom]);

    const getSeverityLabel = (reason?: string) => {
        const value = (reason || '').toLowerCase();
        if (value.includes('hate') || value.includes('harass') || value.includes('scam') || value.includes('fraud')) {
            return 'High';
        }
        return 'Medium';
    };

    const openReportModal = (id: string, type: 'post' | 'message') => {
        setReportTarget({ id, type });
        setReportReason(REPORT_REASONS[0]);
        setReportNotes('');
        setReportModalOpen(true);
    };

    // Handle opening item action menu with proper positioning
    const handleOpenItemMenu = (event: any, item: any, isPost: boolean) => {
        if (itemMenuOpen === item._id) {
            setItemMenuOpen(null);
            setItemMenuItem(null);
            return;
        }
        // Get position from event target for web
        const target = event.currentTarget || event.target;
        if (target && target.getBoundingClientRect) {
            const rect = target.getBoundingClientRect();
            setItemMenuPosition({
                top: rect.bottom + 5,
                right: window.innerWidth - rect.right,
            });
        }
        setItemMenuItem({ ...item, isPost });
        setItemMenuOpen(item._id);
    };

    const closeItemMenu = () => {
        setItemMenuOpen(null);
        setItemMenuItem(null);
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
            const itemType = reportTarget.type === 'post' ? 'posts' : 'messages';
            await flagContentMutation.mutateAsync({
                itemType,
                itemId: reportTarget.id,
                reason,
            });
            setReportModalOpen(false);
            setReportTarget(null);
            showSuccessModal('Report Submitted', 'Thanks for reporting. Our team will review this content.');
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

    const loadModerationQueue = async () => {
        if (!activeSubgridId) return;
        setModerationError('');
        try {
            const response = await communityGet(`/subgrids/${activeSubgridId}/moderation`);
            setModerationQueue(response?.data || []);
        } catch (err: any) {
            setModerationError(err.message || 'Failed to load moderation queue.');
            setModerationQueue([]);
        }
    };

    // Content Moderation (Prohibited Words) functions - using React Query mutations
    const contentModerationLoading = contentModerationQuery.isLoading ||
        updateContentModerationMutation.isPending ||
        addProhibitedWordsMutation.isPending ||
        removeProhibitedWordsMutation.isPending;
    const prohibitedWords = contentModerationSettings.prohibitedWords || [];

    const saveContentModerationSettings = async () => {
        if (!activeSubgridId) return;
        try {
            await updateContentModerationMutation.mutateAsync({
                enabled: localContentModerationEnabled,
                action: localContentModerationAction,
                blockedMessage: localBlockedMessage,
            });
            showSuccessModal('Settings Saved', 'Content moderation settings have been updated.');
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to save content moderation settings.');
            } else {
                Alert.alert('Error', err.message || 'Failed to save content moderation settings.');
            }
        }
    };

    const handleSavePartnershipStatus = async (status: 'open' | 'invite' | 'closed') => {
        if (!activeSubgridId) return;
        setPartnershipStatus(status);
        setPartnershipStatusSaving(true);
        try {
            await communityPatch(`/subgrids/${activeSubgridId}/settings`, { partnershipStatus: status });
        } catch (e) {
            console.error('Failed to save partnership status', e);
        } finally {
            setPartnershipStatusSaving(false);
        }
    };

    // Load revShare rate when partnerships tab opens
    useEffect(() => {
        if (!serverSettingsModalOpen || settingsTab !== 'partnerships' || !activeSubgridId) return;
        communityGet(`/subgrids/${activeSubgridId}/settings`).then((data: any) => {
            if (data?.revShareRate !== undefined) setRevShareRate(data.revShareRate);
        }).catch(() => {});
    }, [serverSettingsModalOpen, settingsTab, activeSubgridId]);

    // Load vendor invites when partnerships tab opens in invite mode
    useEffect(() => {
        if (!serverSettingsModalOpen || settingsTab !== 'partnerships' || !activeSubgridId) return;
        if (partnershipStatus === 'invite') fetchVendorInvites();
    }, [serverSettingsModalOpen, settingsTab, activeSubgridId, partnershipStatus]);

    const handleSaveRevShareRate = async () => {
        if (!activeSubgridId) return;
        setRevShareRateSaving(true);
        try {
            await communityPatch(`/subgrids/${activeSubgridId}/settings`, { revShareRate });
        } catch (err) {
            console.error('[CUA] revshare rate save error:', err);
        } finally {
            setRevShareRateSaving(false);
        }
    };

    const fetchVendorInvites = async () => {
        if (!activeSubgridId) return;
        setVendorInvitesLoading(true);
        try {
            const data = await communityGet(`/partnership-forum/invites?subgridId=${activeSubgridId}`);
            setVendorInvites(Array.isArray(data) ? data : (data as any)?.invites ?? []);
        } catch {}
        finally { setVendorInvitesLoading(false); }
    };

    const handleSendVendorInvite = async () => {
        if (!vendorInviteEmail.trim() || !activeSubgridId) return;
        setVendorInviteSending(true);
        try {
            await communityPost('/partnership-forum/invite', { email: vendorInviteEmail.trim(), subgridId: activeSubgridId });
            setVendorInviteEmail('');
            await fetchVendorInvites();
        } catch (err) {
            console.error('[CUA] vendor invite error:', err);
        } finally {
            setVendorInviteSending(false);
        }
    };

    const handleRevokeVendorInvite = async (inviteId: string) => {
        try {
            await communityPatch(`/partnership-forum/invites/${inviteId}`, { status: 'revoked' });
            await fetchVendorInvites();
        } catch (err) {
            console.error('[CUA] revoke invite error:', err);
        }
    };

    const addProhibitedWord = async () => {
        console.log('[addProhibitedWord] Called with:', { activeSubgridId, newProhibitedWord });
        if (!activeSubgridId || !newProhibitedWord.trim()) {
            console.log('[addProhibitedWord] Missing required fields');
            return;
        }
        const word = newProhibitedWord.trim().toLowerCase();
        if (prohibitedWords.includes(word)) {
            if (Platform.OS === 'web') {
                window.alert('This word is already in the prohibited list.');
            } else {
                Alert.alert('Duplicate', 'This word is already in the prohibited list.');
            }
            return;
        }
        try {
            console.log('[addProhibitedWord] Using mutation...');
            await addProhibitedWordsMutation.mutateAsync([word]);
            setNewProhibitedWord('');
        } catch (err: any) {
            console.error('[addProhibitedWord] Error:', err);
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to add prohibited word.');
            } else {
                Alert.alert('Error', err.message || 'Failed to add prohibited word.');
            }
        }
    };

    const removeProhibitedWord = async (word: string) => {
        console.log('[removeProhibitedWord] Called with:', { activeSubgridId, word });
        if (!activeSubgridId) {
            console.log('[removeProhibitedWord] No activeSubgridId');
            return;
        }
        try {
            console.log('[removeProhibitedWord] Using mutation...');
            await removeProhibitedWordsMutation.mutateAsync([word]);
        } catch (err: any) {
            console.error('[removeProhibitedWord] Error:', err);
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to remove prohibited word.');
            } else {
                Alert.alert('Error', err.message || 'Failed to remove prohibited word.');
            }
        }
    };

    const [testingModeration, setTestingModeration] = useState(false);

    const testContentModeration = async () => {
        console.log('[testContentModeration] Called with:', { activeSubgridId, contentModerationTestText });
        if (!activeSubgridId || !contentModerationTestText.trim()) {
            console.log('[testContentModeration] Missing required fields');
            return;
        }
        setTestingModeration(true);
        try {
            console.log('[testContentModeration] Calling API...');
            const response = await communityPost(`/subgrids/${activeSubgridId}/content-moderation/test`, {
                content: contentModerationTestText,
            });
            console.log('[testContentModeration] API Response:', response);
            // Map backend response to frontend expected shape
            // Backend returns: { allowed, message?, censoredContent?, flagged?, matches? }
            // Frontend expects: { isProhibited, matchedWords, filteredContent }
            const data = response?.data;
            if (data) {
                setContentModerationTestResult({
                    isProhibited: !data.allowed,
                    matchedWords: data.matches || [],
                    filteredContent: data.censoredContent || contentModerationTestText,
                });
            } else {
                setContentModerationTestResult(null);
            }
        } catch (err: any) {
            console.error('[testContentModeration] Error:', err);
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to test content moderation.');
            } else {
                Alert.alert('Error', err.message || 'Failed to test content moderation.');
            }
        } finally {
            setTestingModeration(false);
        }
    };

    const openModerationDetail = (item: ModerationFlag) => {
        setActiveModerationItem(item);
        setModerationDetailOpen(true);
    };

    const handleModerationAction = async (flag: ModerationFlag | null, action: 'approve' | 'remove' | 'warn' | 'mute' | 'ban') => {
        if (!activeSubgridId || !flag?._id) return;
        setModerationActionLoading(true);
        try {
            await moderationActionMutation.mutateAsync({
                flagId: flag._id,
                action: action as 'approve' | 'reject' | 'delete',
                notes: flag.reason || '',
            });
            setModerationQueue((prev) => prev.filter((item) => item._id !== flag._id));
            if (activeModerationItem?._id === flag._id) {
                setModerationDetailOpen(false);
                setActiveModerationItem(null);
            }
            showSuccessModal('Moderation Updated', 'The moderation action has been applied.');
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to apply moderation action.');
            } else {
                Alert.alert('Error', err.message || 'Failed to apply moderation action.');
            }
        } finally {
            setModerationActionLoading(false);
        }
    };

    // Helper function to show success modal
    const showSuccessModal = (title: string, message: string) => {
        setSuccessModalTitle(title);
        setSuccessModalMessage(message);
        setSuccessModalOpen(true);
    };

    // Helper function to show delete confirmation modal
    const showDeleteConfirmModal = (type: 'channel' | 'post' | 'message', id: string, name?: string) => {
        setDeleteConfirmData({ type, id, name });
        setDeleteConfirmModalOpen(true);
    };

    // CRUD Operations
    const handleCreateChannel = async () => {
        if (!newChannelName.trim() || !activeSubgridId) return;
        const channelName = newChannelName.trim();
        try {
            await createChannelMutation.mutateAsync({
                name: channelName,
                type: newChannelType,
                category: newChannelCategoryId || undefined,
            });
            setCreateChannelModalOpen(false);
            setNewChannelName('');
            setNewChannelType('text');
            setIsPrivateChannel(false);
            setNewChannelCategoryId('');
            showSuccessModal('Channel Created', `Channel "${channelName}" has been created successfully!`);
        } catch (err: any) {
            setError(err.message || 'Failed to create channel.');
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to create channel.');
            } else {
                Alert.alert('Error', err.message || 'Failed to create channel.');
            }
        }
    };

    const openEditChannelModal = (channel: Channel) => {
        setEditChannelId(channel._id);
        setEditChannelName(channel.name || '');
        setEditChannelType(channel.type === 'voice' ? 'voice' : 'text');
        setEditChannelPrivate(channel.visibility === 'admin');
        setEditChannelCategoryId(channel.categoryId || '');
        setEditChannelModalOpen(true);
        setChannelSettingsModalOpen(false);
    };

    const openChannelSettingsModal = (channel: Channel) => {
        setSelectedSettingsChannel(channel);
        setChannelSettingsModalOpen(true);
    };

    const handleUpdateChannel = async () => {
        if (!editChannelId || !activeSubgridId) return;
        const channelName = editChannelName.trim();
        if (!channelName) return;
        try {
            await updateChannelMutation.mutateAsync({
                channelId: editChannelId,
                data: {
                    name: channelName,
                    type: editChannelType,
                    category: editChannelCategoryId || undefined,
                },
            });
            setEditChannelModalOpen(false);
            showSuccessModal('Channel Updated', `Channel "${channelName}" has been updated successfully!`);
        } catch (err: any) {
            setError(err.message || 'Failed to update channel.');
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to update channel.');
            } else {
                Alert.alert('Error', err.message || 'Failed to update channel.');
            }
        }
    };

    const openChannelPermissionModal = (channel: Channel) => {
        const isPublic = channel.visibility !== 'admin';
        setPermissionChannelId(channel._id);
        setChannelPermissions({
            members: isPublic,
            stakeholders: true,
            serverAdmin: true,
            serverOwner: true,
        });
        setChannelPermissionModalOpen(true);
        setChannelSettingsModalOpen(false);
    };

    const handleSaveChannelPermissions = async () => {
        if (!permissionChannelId || !activeSubgridId) return;
        try {
            await updateChannelMutation.mutateAsync({
                channelId: permissionChannelId,
                data: {},
            });
            setChannelPermissionModalOpen(false);
            showSuccessModal('Permissions Updated', 'Channel permissions have been updated successfully.');
        } catch (err: any) {
            setError(err.message || 'Failed to update channel permissions.');
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to update channel permissions.');
            } else {
                Alert.alert('Error', err.message || 'Failed to update channel permissions.');
            }
        }
    };

    const toggleChannelPermission = (key: ChannelPermissionKey) => {
        setChannelPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const openChannelMembersModal = async (channel: Channel) => {
        setManagingChannelId(channel._id);
        setChannelMembersModalOpen(true);
        setChannelSettingsModalOpen(false);
        setAddMemberSearchQuery('');
        try {
            const response = await communityGet(`/subgrids/${activeSubgridId}/channels/${channel._id}/members`);
            setChannelMembers(response?.data || []);
        } catch (err) {
            console.error('Failed to load channel members:', err);
            setChannelMembers([]);
        }
    };

    const handleAddChannelMember = async (userId: string) => {
        if (!managingChannelId || !activeSubgridId) return;
        try {
            await addChannelMemberMutation.mutateAsync({ channelId: managingChannelId, userId });
            const response = await communityGet(`/subgrids/${activeSubgridId}/channels/${managingChannelId}/members`);
            setChannelMembers(response?.data || []);
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to add member');
            } else {
                Alert.alert('Error', err.message || 'Failed to add member');
            }
        }
    };

    const handleRemoveChannelMember = async (userId: string) => {
        if (!managingChannelId || !activeSubgridId) return;
        try {
            await removeChannelMemberMutation.mutateAsync({ channelId: managingChannelId, userId });
            setChannelMembers(prev => prev.filter(m => (m._id || m.userId) !== userId));
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to remove member');
            } else {
                Alert.alert('Error', err.message || 'Failed to remove member');
            }
        }
    };

    const toggleEngagementSetting = async (key: EngagementSettingKey) => {
        if (!activeSubgridId) return;

        const newValue = !localEngagementSettings[key];
        const updatedSettings = { ...localEngagementSettings, [key]: newValue };

        // Optimistic update
        setLocalEngagementSettings(updatedSettings);

        try {
            await updateEngagementSettingsMutation.mutateAsync(updatedSettings);
        } catch (err) {
            console.error('Failed to save engagement setting:', err);
            // Revert on error
            setLocalEngagementSettings((prev) => ({ ...prev, [key]: !newValue }));
        }
    };

    const getMemberStatusLabel = (status?: string) => {
        const value = (status || 'active').toLowerCase();
        if (value === 'pending') return 'Pending';
        if (value === 'suspended') return 'Suspended';
        if (value === 'muted') return 'Muted';
        return 'Active';
    };

    const getMemberStatusStyle = (status?: string) => {
        const value = (status || 'active').toLowerCase();
        if (value === 'pending') return styles.statusBadgePending;
        if (value === 'suspended') return styles.statusBadgeSuspended;
        if (value === 'muted') return styles.statusBadgeMuted;
        return styles.statusBadgeActive;
    };

    const getMemberStatusTextStyle = (status?: string) => {
        const value = (status || 'active').toLowerCase();
        if (value === 'pending') return styles.statusBadgeTextPending;
        if (value === 'suspended') return styles.statusBadgeTextSuspended;
        if (value === 'muted') return styles.statusBadgeTextMuted;
        return styles.statusBadgeTextActive;
    };

    const getMemberRoleLabel = (role?: string) => {
        const value = (role || 'member').replace(/_/g, ' ');
        return value.replace(/\b\w/g, (char) => char.toUpperCase());
    };

    // Handle stakeholder actions (mute, unmute, remove)
    const handleStakeholderAction = async (memberId: string | undefined, action: 'mute' | 'unmute' | 'remove') => {
        if (!memberId || !activeSubgridId) return;

        try {
            if (action === 'remove') {
                await removeMemberMutation.mutateAsync(memberId);
                showSuccessModal('Stakeholder Removed', 'The stakeholder has been removed from this server.');
            } else {
                const newStatus = action === 'mute' ? 'muted' : 'active';
                await updateMemberStatusMutation.mutateAsync({ memberId, status: newStatus });
                showSuccessModal(
                    action === 'mute' ? 'Stakeholder Muted' : 'Stakeholder Unmuted',
                    action === 'mute' ? 'The stakeholder has been muted and cannot send messages.' : 'The stakeholder can now send messages again.'
                );
            }
        } catch (err: any) {
            console.error('[handleStakeholderAction] Error:', err);
            setError(err.message || `Failed to ${action} stakeholder`);
        }
    };

    // Handle member actions (mute, unmute, suspend, unsuspend, remove, change role)
    const handleMemberAction = async (memberId: string | undefined, action: 'mute' | 'unmute' | 'suspend' | 'unsuspend' | 'remove' | 'promote' | 'demote') => {
        if (!memberId || !activeSubgridId) return;

        try {
            if (action === 'remove') {
                await removeMemberMutation.mutateAsync(memberId);
                showSuccessModal('Member Removed', 'The member has been removed from this server.');
            } else if (action === 'suspend' || action === 'unsuspend') {
                const newStatus = action === 'suspend' ? 'suspended' : 'active';
                await updateMemberStatusMutation.mutateAsync({ memberId, status: newStatus });
                showSuccessModal(
                    action === 'suspend' ? 'Member Suspended' : 'Member Unsuspended',
                    action === 'suspend' ? 'The member has been suspended and cannot access the server.' : 'The member can now access the server again.'
                );
            } else if (action === 'mute' || action === 'unmute') {
                const newStatus = action === 'mute' ? 'muted' : 'active';
                await updateMemberStatusMutation.mutateAsync({ memberId, status: newStatus });
                showSuccessModal(
                    action === 'mute' ? 'Member Muted' : 'Member Unmuted',
                    action === 'mute' ? 'The member has been muted and cannot send messages.' : 'The member can now send messages again.'
                );
            } else if (action === 'promote') {
                await updateMemberRoleMutation.mutateAsync({ memberId, role: 'moderator' });
                showSuccessModal('Member Promoted', 'The member has been promoted to Moderator.');
            } else if (action === 'demote') {
                await updateMemberRoleMutation.mutateAsync({ memberId, role: 'member' });
                showSuccessModal('Member Demoted', 'The member has been changed to regular member.');
            }
            // Close modals
            setMemberActionModalOpen(false);
            setMemberDetailModalOpen(false);
            setSelectedMember(null);
        } catch (err: any) {
            console.error('[handleMemberAction] Error:', err);
            setError(err.message || `Failed to ${action} member`);
        }
    };

    // Custom Roles Functions - using React Query mutations
    const savingRole = createCustomRoleMutation.isPending || updateCustomRoleMutation.isPending;

    const handleCreateRole = async () => {
        if (!activeSubgridId || !newRoleName.trim()) return;
        try {
            await createCustomRoleMutation.mutateAsync({
                name: newRoleName.trim(),
                color: newRoleColor,
            });
            setCreateRoleModalOpen(false);
            setNewRoleName('');
            setNewRoleColor('#3B82F6');
            showSuccessModal('Role Created', `The "${newRoleName}" role has been created successfully.`);
        } catch (err: any) {
            setError(err.message || 'Failed to create role');
        }
    };

    const handleUpdateRole = async () => {
        if (!activeSubgridId || !editingRole || !newRoleName.trim()) return;
        try {
            await updateCustomRoleMutation.mutateAsync({
                roleId: editingRole._id,
                data: {
                    name: newRoleName.trim(),
                    color: newRoleColor,
                },
            });
            setEditingRole(null);
            setCreateRoleModalOpen(false);
            setNewRoleName('');
            setNewRoleColor('#3B82F6');
            showSuccessModal('Role Updated', 'The role has been updated successfully.');
        } catch (err: any) {
            setError(err.message || 'Failed to update role');
        }
    };

    const handleDeleteRole = async (roleId: string, roleName: string) => {
        if (!activeSubgridId) return;
        try {
            await deleteCustomRoleMutation.mutateAsync(roleId);
            showSuccessModal('Role Deleted', `The "${roleName}" role has been deleted.`);
        } catch (err: any) {
            setError(err.message || 'Failed to delete role');
        }
    };

    const handleAssignRole = async (memberId: string, roleId: string | null) => {
        if (!activeSubgridId) return;
        try {
            await assignCustomRoleMutation.mutateAsync({ memberId, roleId });
            setAssignRoleModalOpen(false);
            setAssigningMember(null);
            showSuccessModal('Role Updated', 'Member role has been updated successfully.');
        } catch (err: any) {
            setError(err.message || 'Failed to assign role');
        }
    };

    const openEditRole = (role: CustomRole) => {
        setEditingRole(role);
        setNewRoleName(role.name);
        setNewRoleColor(role.color);
        setCreateRoleModalOpen(true);
    };

    const openAssignRole = (member: Member) => {
        // Toggle inline role selector - if clicking same member, close it
        if (assigningMember?._id === member._id) {
            setAssigningMember(null);
        } else {
            setAssigningMember(member);
        }
    };

    const getChannelAccessLabel = (role?: string) => {
        const value = (role || '').toLowerCase();
        if (['subgrid_admin', 'admin', 'owner', 'moderator'].includes(value)) {
            return 'Full Access';
        }
        return 'Limited Access';
    };

    const handleDeleteChannel = (channelId: string, channelName?: string) => {
        console.log('[handleDeleteChannel] Called with channelId:', channelId, 'activeSubgridId:', activeSubgridId);
        if (!activeSubgridId) {
            console.log('[handleDeleteChannel] No activeSubgridId, returning early');
            return;
        }
        // Show custom delete confirmation modal
        showDeleteConfirmModal('channel', channelId, channelName);
    };

    // Execute delete after confirmation
    const executeDelete = async () => {
        if (!deleteConfirmData || !activeSubgridId) return;

        const { type, id } = deleteConfirmData;
        setDeleteConfirmModalOpen(false);

        try {
            if (type === 'channel') {
                await deleteChannelMutation.mutateAsync(id);
                if (activeChannelId === id) {
                    setActiveChannelId('');
                }
                showSuccessModal('Channel Deleted', 'The channel has been deleted successfully.');
            } else if (type === 'post') {
                await deletePostMutation.mutateAsync(id);
                setItemMenuOpen(null);
                showSuccessModal('Post Deleted', 'The post has been deleted successfully.');
            } else if (type === 'message') {
                await deleteMessageMutation.mutateAsync(id);
                setMessages(prev => prev.filter(m => m._id !== id));
                setItemMenuOpen(null);
                showSuccessModal('Message Deleted', 'The message has been deleted successfully.');
            }
        } catch (err: any) {
            console.error('[executeDelete] Error:', err.message);
            setError(err.message || `Failed to delete ${type}.`);
            if (Platform.OS === 'web') {
                window.alert(err.message || `Failed to delete ${type}.`);
            } else {
                Alert.alert('Error', err.message || `Failed to delete ${type}.`);
            }
        }
        setDeleteConfirmData(null);
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim() || !activeSubgridId) return;
        const categoryName = newCategoryName.trim();
        try {
            await createCategoryMutation.mutateAsync({
                name: categoryName,
            });
            setCreateCategoryModalOpen(false);
            setNewCategoryName('');
            setIsPrivateCategory(false);
            showSuccessModal('Category Created', `Category "${categoryName}" has been created successfully!`);
        } catch (err: any) {
            setError(err.message || 'Failed to create category.');
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to create category.');
            } else {
                Alert.alert('Error', err.message || 'Failed to create category.');
            }
        }
    };

    const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
        const confirmDelete = Platform.OS === 'web'
            ? window.confirm(`Delete category "${categoryName}"? Channels in this category will become uncategorized.`)
            : true;
        if (!confirmDelete) return;
        try {
            await deleteCategoryMutation.mutateAsync(categoryId);
            showSuccessModal('Category Deleted', `Category "${categoryName}" has been deleted. Its channels are now uncategorized.`);
        } catch (err: any) {
            setError(err.message || 'Failed to delete category.');
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to delete category.');
            } else {
                Alert.alert('Error', err.message || 'Failed to delete category.');
            }
        }
    };

    const handleCreateEvent = async () => {
        if (!newEventTitle.trim() || !activeSubgridId) return;
        // For events, date is required; for announcements, date is optional
        if (newEventType === 'event' && !newEventDate.trim()) return;
        try {
            await createEventMutation.mutateAsync({
                title: newEventTitle.trim(),
                description: newEventDescription.trim(),
                location: newEventLocation.trim(),
                startDate: newEventDate.trim() || new Date().toISOString(),
            });
            setCreateEventModalOpen(false);
            setNewEventTitle('');
            setNewEventDescription('');
            setNewEventDate('');
            setNewEventType('event');
            setNewEventLocation('');
        } catch (err: any) {
            setError(err.message || 'Failed to create event.');
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!activeSubgridId) return;
        try {
            await deleteEventMutation.mutateAsync(eventId);
        } catch (err: any) {
            setError(err.message || 'Failed to delete event.');
        }
    };

    const formatEventDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const handleUpdateServer = async () => {
        if (!activeSubgridId) return;
        try {
            await updateSubgridMutation.mutateAsync({
                name: serverName.trim(),
                description: serverDescription.trim(),
                logoUrl: serverLogoUrl || '',
                coverImageUrl: bannerColors[selectedBanner][0],
            });
            setServerSettingsModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to update server.');
        }
    };

    const handlePickServerIcon = async () => {
        if (!activeSubgridId) return;
        try {
            console.log('[ServerIcon] Starting image picker...');
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            console.log('[ServerIcon] Permission result:', permissionResult);
            if (!permissionResult.granted) {
                Alert.alert('Permission required', 'Please allow access to your photos to update the server icon.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            console.log('[ServerIcon] Picker result:', result.canceled ? 'canceled' : 'selected', result.assets?.length || 0, 'assets');
            if (result.canceled || !result.assets?.length) return;
            const image = result.assets[0];
            console.log('[ServerIcon] Selected image:', { uri: image.uri?.substring(0, 50), fileName: image.fileName, mimeType: image.mimeType });
            setServerIconUploading(true);
            const uploadResult = await uploadFile(
                {
                    uri: image.uri,
                    name: image.fileName || `server_icon_${Date.now()}.jpg`,
                    type: image.mimeType || 'image/jpeg',
                },
                { type: 'server-icon', subgridId: activeSubgridId }
            );
            console.log('[ServerIcon] Upload result:', uploadResult);
            const uploadUrl = uploadResult?.data?.url || uploadResult?.url;
            if (!uploadUrl) {
                throw new Error('Upload failed to return a URL.');
            }
            setServerLogoUrl(uploadUrl);
            await updateSubgridMutation.mutateAsync({ logoUrl: uploadUrl });
            showSuccessModal('Server Icon Updated', 'Your server icon has been updated.');
        } catch (err: any) {
            console.error('[ServerIcon] Error:', err);
            setError(err.message || 'Failed to update server icon.');
        } finally {
            setServerIconUploading(false);
        }
    };

    const handleRemoveServerIcon = async () => {
        if (!activeSubgridId) return;
        try {
            await updateSubgridMutation.mutateAsync({ logoUrl: '' });
            setServerLogoUrl('');
        } catch (err: any) {
            setError(err.message || 'Failed to remove server icon.');
        }
    };

    const handleCreateServer = async () => {
        if (!tenantId || !newServerName.trim()) return;
        try {
            const created = await createSubgridMutation.mutateAsync({
                name: newServerName.trim(),
                description: newServerDescription.trim(),
                visibility: newServerVisibility,
            });
            if (created?._id) {
                setActiveSubgridId(created._id);
            }
            setCreateServerModalOpen(false);
            setNewServerName('');
            setNewServerDescription('');
            setNewServerVisibility('private');
            showSuccessModal('Server Created', 'Your new server is ready.');
        } catch (err: any) {
            setError(err.message || 'Failed to create server.');
        }
    };

    const handleArchiveServer = async () => {
        if (!activeSubgridId) return;
        const confirm = Platform.OS === 'web'
            ? window.confirm('Archive this server? Members will lose access until it is reactivated.')
            : await new Promise<boolean>((resolve) => {
                Alert.alert(
                    'Archive Server',
                    'Archive this server? Members will lose access until it is reactivated.',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Archive', style: 'destructive', onPress: () => resolve(true) },
                    ]
                );
            });
        if (!confirm) return;
        try {
            await updateSubgridMutation.mutateAsync({ status: 'archived' });
            // Set to first available subgrid after archive
            const updatedSubgrids = subgridsQuery.data || [];
            setActiveSubgridId(updatedSubgrids[0]?._id || '');
            showSuccessModal('Server Archived', 'The server has been archived.');
        } catch (err: any) {
            setError(err.message || 'Failed to archive server.');
        }
    };

    const handleInviteStakeholder = async () => {
        const emailToInvite = inviteEmail.trim();
        if (!emailToInvite || !activeSubgridId) return;
        setError('');
        setInvitingStakeholder(true);
        try {
            await inviteStakeholder({
                email: emailToInvite,
                subgridId: activeSubgridId,
                stakeholderBadge: selectedStakeholderBadge,
            });
            setInviteEmail('');
            setSelectedStakeholderBadge('stakeholder');
            setInviteModalOpen(false);
            Alert.alert('Invite Sent', `A stakeholder invitation has been sent to ${emailToInvite}`);
        } catch (err: any) {
            const message = err.message || 'Failed to send invite.';
            if (message.includes('already a member') || message.includes('already a stakeholder')) {
                Alert.alert('Already Exists', 'This user is already a member or stakeholder of your community.');
            } else if (message.includes('already been sent')) {
                Alert.alert('Invite Pending', 'An invitation has already been sent to this email address.');
            } else {
                setError(message);
            }
        } finally {
            setInvitingStakeholder(false);
        }
    };

    // Handle draft change with typing indicator emission
    const handleDraftChange = useCallback((text: string) => {
        setMessageDraft(text);
        if (!activeChannelId || !activeSubgridId) return;

        if (text.trim() && !channelIsTypingRef.current) {
            channelIsTypingRef.current = true;
            startTyping('channel', activeChannelId);
        }

        // Reset stop-typing debounce
        if (channelStopTypingTimeoutRef.current) clearTimeout(channelStopTypingTimeoutRef.current);
        if (text.trim()) {
            channelStopTypingTimeoutRef.current = setTimeout(() => {
                channelIsTypingRef.current = false;
                stopTyping('channel', activeChannelId);
            }, 2000);
        } else {
            channelIsTypingRef.current = false;
            stopTyping('channel', activeChannelId);
        }
    }, [activeChannelId, activeSubgridId, startTyping, stopTyping]);

    const handleSendMessage = async () => {
        if ((!messageDraft.trim() && attachments.length === 0) || !activeSubgridId || !activeChannelId) return;

        // Stop typing indicator on send
        if (channelIsTypingRef.current) {
            channelIsTypingRef.current = false;
            stopTyping('channel', activeChannelId);
            if (channelStopTypingTimeoutRef.current) { clearTimeout(channelStopTypingTimeoutRef.current); channelStopTypingTimeoutRef.current = null; }
        }
        hapticLight();

        const tempId = generateTempId();
        const messageBody = messageDraft.trim();
        const currentAttachments = [...attachments];

        // Create optimistic message for instant display
        const optimisticMessage = {
            _id: tempId,
            senderId: userId,
            channelId: activeChannelId,
            body: messageBody,
            attachments: currentAttachments.map(att => ({
                type: att.type.startsWith('image/') ? 'image' :
                      att.type.startsWith('audio/') ? 'voice' :
                      att.type.startsWith('video/') ? 'video' : 'file',
                value: att.uri, // Use local URI temporarily
                mimeType: att.type,
                fileName: att.name,
            })),
            createdAt: new Date().toISOString(),
            _isPending: true,
            _status: 'sending',
        };

        // Add optimistic message to UI immediately
        setMessages(prev => [...prev, optimisticMessage]);
        setMessageDraft('');
        setAttachments([]);

        try {
            // Upload attachments first if any
            const uploadedAttachments: Array<{ type: string; value: string; mimeType?: string; fileName?: string }> = [];

            for (const att of currentAttachments) {
                try {
                    console.log('[CUAdmin] Uploading attachment:', att.name, att.type);
                    const uploadResult = await uploadFile(
                        { uri: att.uri, name: att.name, type: att.type },
                        { type: 'chat', subgridId: activeSubgridId }
                    );
                    console.log('[CUAdmin] Upload result:', uploadResult);
                    const uploadUrl = uploadResult?.data?.url || uploadResult?.url;
                    if (uploadUrl) {
                        const attType = att.type.startsWith('image/') ? 'image' :
                            att.type.startsWith('audio/') ? 'voice' :
                                att.type.startsWith('video/') ? 'video' : 'file';
                        uploadedAttachments.push({
                            type: attType,
                            value: uploadUrl,
                            mimeType: att.type,
                            fileName: att.name,
                        });
                        console.log('[CUAdmin] Attachment uploaded successfully:', attType, uploadUrl);
                    } else {
                        console.error('[CUAdmin] Upload succeeded but no URL in result:', uploadResult);
                    }
                } catch (uploadErr) {
                    console.error('[CUAdmin] Failed to upload attachment:', uploadErr);
                }
            }

            // Build message payload
            const messagePayload: any = {
                channelId: activeChannelId,
                body: messageBody,
            };

            if (uploadedAttachments.length > 0) {
                messagePayload.attachments = uploadedAttachments;
            }

            const response = await communityPost(`/subgrids/${activeSubgridId}/messages`, messagePayload);

            // Replace optimistic message with real message
            const realMessage = response?.data || response?.message || response;
            setMessages(prev => prev.map(msg =>
                msg._id === tempId ? { ...realMessage, _isPending: false, _status: 'sent' } : msg
            ));

        } catch (err: any) {
            console.error('Failed to send message:', err.message);
            // Mark message as failed but keep it visible for retry
            setMessages(prev => prev.map(msg =>
                msg._id === tempId ? { ...msg, _isPending: true, _status: 'failed' } : msg
            ));
        }
    };

    // Retry a failed message
    const handleRetryMessage = useCallback(async (failedMsg: any) => {
        if (!activeSubgridId || !activeChannelId) return;
        hapticLight();

        // Mark as sending again
        setMessages(prev => prev.map(msg =>
            msg._id === failedMsg._id ? { ...msg, _status: 'sending', _isPending: true } : msg
        ));

        try {
            const response = await communityPost(`/subgrids/${activeSubgridId}/messages`, {
                channelId: activeChannelId,
                body: failedMsg.body || '',
                attachments: failedMsg.attachments?.filter((a: any) => a.value && !a.value.startsWith('file://') && !a.value.startsWith('content://')) || undefined,
            });

            const realMessage = response?.data || response?.message || response;
            setMessages(prev => prev.map(msg =>
                msg._id === failedMsg._id ? { ...realMessage, _isPending: false, _status: 'sent' } : msg
            ));
        } catch (err: any) {
            setMessages(prev => prev.map(msg =>
                msg._id === failedMsg._id ? { ...msg, _isPending: true, _status: 'failed' } : msg
            ));
        }
    }, [activeSubgridId, activeChannelId]);

    // Copy invite code to clipboard
    const handleCopyInviteLink = async () => {
        const inviteCode = activeSubgrid?.inviteCode || activeSubgridId?.slice(-8) || 'XXXXXXXX';
        try {
            if (Platform.OS === 'web' && navigator.clipboard) {
                await navigator.clipboard.writeText(inviteCode);
                Alert.alert('Copied!', 'Invite code copied to clipboard');
            } else {
                // For native platforms, use Clipboard API from react-native
                const Clipboard = require('react-native').Clipboard;
                if (Clipboard?.setString) {
                    Clipboard.setString(inviteCode);
                    Alert.alert('Copied!', 'Invite code copied to clipboard');
                } else {
                    Alert.alert('Invite Code', inviteCode);
                }
            }
        } catch (err) {
            Alert.alert('Invite Code', inviteCode);
        }
    };

    // Pin/Unpin message
    const handlePinMessage = async (messageId: string) => {
        if (!activeSubgridId) return;
        try {
            await pinMessageMutation.mutateAsync(messageId);
            // Refresh pinned messages
            const response = await communityGet(`/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}&pinned=true`);
            setPinnedMessages(response?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to pin message.');
        }
    };

    const handleUnpinMessage = async (messageId: string) => {
        if (!activeSubgridId) return;
        try {
            await unpinMessageMutation.mutateAsync(messageId);
            setPinnedMessages(prev => prev.filter(m => m._id !== messageId));
        } catch (err: any) {
            setError(err.message || 'Failed to unpin message.');
        }
    };

    // Handle file attachment
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
                    type: file.mimeType || 'application/octet-stream'
                }]);
            }
        } catch (err) {
            console.error('Error picking file:', err);
        }
    };

    // Handle image picker
    const handlePickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission required', 'Please allow access to your photos to attach images.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const image = result.assets[0];
                setAttachments(prev => [...prev, {
                    uri: image.uri,
                    name: image.fileName || 'image.jpg',
                    type: image.mimeType || 'image/jpeg'
                }]);
            }
        } catch (err) {
            console.error('Error picking image:', err);
        }
    };

    // Handle emoji selection
    const handleEmojiSelect = (emoji: string) => {
        setMessageDraft(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    // Handle voice recording - send voice note as message attachment
    const sendVoiceNote = async (dataUrl: string, mimeType: string, durationMs: number) => {
        if (!activeSubgridId || !activeChannelId) {
            setRecordingError('Missing channel data. Please select a channel and try again.');
            return;
        }
        try {
            // Upload voice note first
            let uploadResult;
            try {
                uploadResult = await uploadFile(
                    { uri: dataUrl, name: `voice_${Date.now()}.webm`, type: mimeType },
                    { type: 'voice-note', subgridId: activeSubgridId }
                );
            } catch (uploadError: any) {
                console.error('[Voice Note Web] Upload failed:', uploadError?.message || uploadError);
                setRecordingError('Failed to upload voice note.');
                return;
            }

            if (uploadResult?.success && uploadResult?.data) {
                // Send message with voice attachment
                const messageResponse = await communityPost(`/subgrids/${activeSubgridId}/messages`, {
                    channelId: activeChannelId,
                    body: '',
                    kind: 'audio',
                    attachments: [{
                        type: 'audio',
                        value: uploadResult.data.url || uploadResult.data.secure_url,
                        label: 'Voice note',
                        mimeType,
                        durationMs,
                    }],
                });
                // Add the new message to state
                if (messageResponse?.data) {
                    setMessages(prev => {
                        if (prev.some(m => m._id === messageResponse.data._id)) return prev;
                        return [...prev, messageResponse.data];
                    });
                }
            } else {
                console.error('[Voice Note Web] Upload result missing success or data:', uploadResult);
                setRecordingError('Voice note upload failed. Please try again.');
            }
        } catch (err: any) {
            console.error('Failed to send voice note:', err.message);
            setRecordingError(err.message || 'Failed to send voice note.');
        }
    };

    const handleStartRecording = async () => {
        if (isRecording) return;
        setRecordingError('');
        setRecordingDuration(0);
        recordingStartRef.current = Date.now();

        // Web recording using MediaRecorder
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                activeStreamRef.current = stream;
                const recorder = new MediaRecorder(stream);
                audioChunksRef.current = [];
                recorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
                };
                recorder.onstop = async () => {
                    // Chrome may report video/webm for audio-only recordings; normalize to audio/webm
                    const rawMime = recorder.mimeType || 'audio/webm';
                    const voiceMime = rawMime.replace(/^video\/webm/, 'audio/webm');
                    const blob = new Blob(audioChunksRef.current, { type: voiceMime });
                    const durationMs = Date.now() - recordingStartRef.current;
                    const dataUrl = await blobToDataUrl(blob);
                    await sendVoiceNote(dataUrl, voiceMime, durationMs);
                    stream.getTracks().forEach((track) => track.stop());
                    activeStreamRef.current = null;
                };
                mediaRecorderRef.current = recorder;
                recorder.start();
                setIsRecording(true);
                recordingInterval.current = setInterval(() => {
                    setRecordingDuration((prev) => prev + 1);
                }, 1000);
            } catch (err: any) {
                setRecordingError(err.message || 'Unable to start recording.');
            }
            return;
        }

        // Native recording using expo-audio
        try {
            const permission = await AudioModule.requestRecordingPermissionsAsync();
            if (!permission.granted) {
                setRecordingError('Microphone permission denied');
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
            setRecordingError(err.message || 'Unable to start recording.');
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
                const durationMs = Date.now() - recordingStartRef.current;

                if (uri && activeSubgridId && activeChannelId) {
                    console.log('[Voice Note CU Admin] Starting upload, URI:', uri, 'subgridId:', activeSubgridId, 'channelId:', activeChannelId);
                    let result;
                    try {
                        result = await uploadFile(
                            { uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' },
                            { type: 'voice-note', subgridId: activeSubgridId }
                        );
                        console.log('[Voice Note CU Admin] Upload result:', JSON.stringify(result));
                    } catch (uploadError: any) {
                        console.error('[Voice Note CU Admin] Upload failed:', uploadError?.message || uploadError);
                        setRecordingError('Failed to upload voice note.');
                        return;
                    }

                    if (result?.success && result?.data) {
                        console.log('[Voice Note CU Admin] Sending message with attachment URL:', result.data.url || result.data.secure_url);
                        const messageResponse = await communityPost(`/subgrids/${activeSubgridId}/messages`, {
                            channelId: activeChannelId,
                            body: '',
                            kind: 'audio',
                            attachments: [{
                                type: 'audio',
                                value: result.data.url || result.data.secure_url,
                                label: 'Voice note',
                                mimeType: 'audio/m4a',
                                durationMs,
                            }],
                        });
                        console.log('[Voice Note CU Admin] Message response:', JSON.stringify(messageResponse));
                        // Add the new message to state
                        if (messageResponse?.data && messageResponse.data._id) {
                            console.log('[Voice Note CU Admin] Adding message to state:', messageResponse.data._id, 'attachments:', JSON.stringify(messageResponse.data.attachments));
                            setMessages(prev => {
                                console.log('[Voice Note CU Admin] Current messages count:', prev.length);
                                if (prev.some(m => m._id === messageResponse.data._id)) {
                                    console.log('[Voice Note CU Admin] Message already exists in state');
                                    return prev;
                                }
                                const newMessages = [...prev, messageResponse.data];
                                console.log('[Voice Note CU Admin] New messages count:', newMessages.length);
                                return newMessages;
                            });
                        } else {
                            console.error('[Voice Note CU Admin] No message data or _id in response:', JSON.stringify(messageResponse));
                        }
                    } else {
                        console.error('[Voice Note CU Admin] Upload result missing success or data:', result);
                        setRecordingError('Voice note upload failed. Please try again.');
                    }
                } else {
                    console.error('[Voice Note CU Admin] Missing required data:', { uri: !!uri, activeSubgridId, activeChannelId });
                    setRecordingError('Missing channel data. Please select a channel and try again.');
                }
            } catch (err: any) {
                setRecordingError(err.message || 'Failed to save recording.');
            } finally {
                await setAudioModeAsync({ allowsRecording: false });
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

        // Web recording
        if (Platform.OS === 'web') {
            const recorder = mediaRecorderRef.current;
            if (recorder) {
                recorder.ondataavailable = null;
                recorder.onstop = null;
                recorder.stop();
            }
            if (activeStreamRef.current) {
                activeStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
                activeStreamRef.current = null;
            }
            mediaRecorderRef.current = null;
            return;
        }

        // Native recording using expo-audio
        if (audioRecorder.isRecording) {
            try {
                await audioRecorder.stop();
            } catch (err) {
                console.warn('[CUA] Failed to stop audio recorder:', err);
                setRecordingError('Failed to stop recording. Please try again.');
            }
            try {
                await setAudioModeAsync({ allowsRecording: false });
            } catch (audioModeErr) {
                console.warn('[CUA] Failed to reset audio mode:', audioModeErr);
            }
        }
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Like a feed item (post or message)
    const handleLikeItem = async (itemId: string, isPost: boolean) => {
        if (!activeSubgridId) return;
        const itemType = isPost ? 'posts' : 'messages';
        const items = isPost ? posts : messages;
        try {
            const item = items.find(i => i._id === itemId);
            const isLiked = item?.userLiked ?? false;

            // Optimistic update for immediate UI feedback
            if (isPost) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? old.map((p) =>
                        p._id === itemId
                            ? { ...p, userLiked: !isLiked, likeCount: Math.max(0, (p.likeCount || 0) + (isLiked ? -1 : 1)) }
                            : p
                    ) : []
                );
            } else {
                setMessages(prev => prev.map(m =>
                    m._id === itemId
                        ? { ...m, userLiked: !isLiked, likeCount: Math.max(0, (m.likeCount || 0) + (isLiked ? -1 : 1)) }
                        : m
                ));
            }

            if (isLiked) {
                await unlikeItemMutation.mutateAsync({ itemId, itemType, channelId: activeChannelId });
            } else {
                await likeItemMutation.mutateAsync({ itemId, itemType, channelId: activeChannelId });
            }
        } catch (err: any) {
            const msg = (err.message || '').toLowerCase();
            const item = items.find(i => i._id === itemId);
            const isLiked = item?.userLiked ?? false;
            // If server says "already liked", keep optimistic state
            if (!isLiked && msg.includes('already liked')) {
                // Don't revert — the server confirms it's liked
            } else {
                console.error(`Failed to like/unlike ${itemType}:`, err.message);
                // Revert optimistic update on error by invalidating cache
                if (isPost) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(activeSubgridId) });
                } else if (activeChannelId) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(activeSubgridId, activeChannelId) });
                }
            }
        }
    };

    // Reshare a feed item (post or message)
    const handleReshareItem = async (itemId: string, isPost: boolean) => {
        if (!activeSubgridId) return;
        const itemType = isPost ? 'posts' : 'messages';
        const items = isPost ? posts : messages;
        try {
            const item = items.find(i => i._id === itemId);
            const isReshared = (item as any)?.userReshared ?? false;

            // Optimistic update for immediate UI feedback
            if (isPost) {
                queryClient.setQueryData(
                    queryKeys.subgrids.posts(activeSubgridId),
                    (old: any[] | undefined) => old ? old.map((p) =>
                        p._id === itemId
                            ? { ...p, userReshared: !isReshared, reshareCount: Math.max(0, (p.reshareCount || 0) + (isReshared ? -1 : 1)) }
                            : p
                    ) : []
                );
            } else {
                setMessages(prev => prev.map(m =>
                    m._id === itemId
                        ? { ...m, userReshared: !isReshared, reshareCount: Math.max(0, (m.reshareCount || 0) + (isReshared ? -1 : 1)) }
                        : m
                ));
            }

            if (isReshared) {
                await unreshareItemMutation.mutateAsync({ itemId, itemType, channelId: activeChannelId });
            } else {
                await reshareItemMutation.mutateAsync({ itemId, itemType, channelId: activeChannelId });
            }
        } catch (err: any) {
            const msg = (err.message || '').toLowerCase();
            const item = items.find(i => i._id === itemId);
            const isReshared = (item as any)?.userReshared ?? false;
            // If server says "already reshared", keep optimistic state
            if (!isReshared && msg.includes('already reshared')) {
                // Don't revert — the server confirms it's reshared
            } else {
                console.error(`Failed to reshare/unreshare ${itemType}:`, err.message);
                // Revert optimistic update on error by invalidating cache
                if (isPost) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(activeSubgridId) });
                } else if (activeChannelId) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(activeSubgridId, activeChannelId) });
                }
            }
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

    // Helper to find a member by authorId (checking both userId and _id)
    const findMemberByAuthorId = (authorId: string) => {
        if (!authorId) return undefined;
        return members.find(m =>
            m.userId === authorId ||
            m._id === authorId ||
            String(m.userId) === String(authorId) ||
            String(m._id) === String(authorId)
        );
    };

    // Submit a new comment
    const handleSubmitComment = async () => {
        if (!commentTarget || !commentText.trim() || !activeSubgridId) return;

        setCommentLoading(true);
        try {
            const itemType = commentTarget.isPost ? 'posts' : 'messages';
            const res = await createCommentMutation.mutateAsync({
                itemId: commentTarget.id,
                itemType,
                body: commentText.trim(),
            });
            console.log('[Comment] Created comment:', res);

            // Add the new comment to the list
            setComments(prev => [...prev, res?.comment || res]);
            setCommentText('');
        } catch (err: any) {
            console.error('[Comment] Error creating comment:', err);
            setError('Failed to post comment');
        } finally {
            setCommentLoading(false);
        }
    };

    // Delete post (admin can delete any post)
    const handleDeletePost = (postId: string) => {
        if (!activeSubgridId) return;
        showDeleteConfirmModal('post', postId);
    };

    // Delete message (admin can delete any message)
    const handleDeleteMessage = (messageId: string) => {
        if (!activeSubgridId) return;
        showDeleteConfirmModal('message', messageId);
    };

    // Handle voice channel click - navigate to voice channel screen
    const handleVoiceChannelClick = async (channel: Channel) => {
        if (!activeSubgridId) return;
        try {
            const response = await initiateChannelCall(channel._id, 'audio');
            if (response.success) {
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
                setError(response.error || 'Failed to join voice channel');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to join voice channel');
        }
    };

    // Remove attachment
    const handleRemoveAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Call Handlers
    const handleStartCall = async (type: 'audio' | 'video') => {
        setCallError('');
        setCallType(type);
        setMuted(false);
        setCameraOff(type !== 'video');
        if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
            setCallError('Calls are available on web only right now.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
            activeStreamRef.current = stream;
        } catch (err: any) {
            setCallError(err.message || 'Unable to start call.');
        }
    };

    const handleEndCall = () => {
        if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach((track: any) => track.stop());
            activeStreamRef.current = null;
        }
        setCallType(null);
        setCallError('');
        setMuted(false);
        setCameraOff(false);
    };

    const toggleMute = () => {
        const stream = activeStreamRef.current;
        if (stream) {
            stream.getAudioTracks().forEach((track: any) => { track.enabled = !track.enabled; });
            setMuted((prev) => !prev);
        }
    };

    const toggleCamera = () => {
        const stream = activeStreamRef.current;
        if (stream) {
            stream.getVideoTracks().forEach((track: any) => { track.enabled = !track.enabled; });
            setCameraOff((prev) => !prev);
        }
    };

    const currentUserMember = members.find(m => String(m.userId) === String(userId) || String(m.user?._id) === String(userId) || String(m._id) === String(userId));
    const currentUserName = currentUserMember ? getMemberName(currentUserMember) : 'User';

    // Server Menu Dropdown
    const ServerMenuDropdown = () => (
        <View style={styles.dropdownMenu}>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setInviteModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Invite member</Text>
                <UserPlus size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setCreateChannelModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Create Channel</Text>
                <Plus size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setCreateCategoryModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Create Category</Text>
                <FolderPlus size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setCreateEventModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Create Event</Text>
                <CalendarPlus size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setServerSettingsModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Server Settings</Text>
                <Settings size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setNotificationSettingsModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Notification Settings</Text>
                <Bell size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setPrivacySettingsModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Privacy Settings</Text>
                <Shield size={18} color={colors.textMuted} />
            </TouchableOpacity>
        </View>
    );

    // Empty Server Welcome Screen
    const EmptyServerWelcome = () => (
        <View style={styles.emptyServerContainer}>
            <View style={styles.gridPattern}>
                {/* Decorative grid dots */}
                {Array.from({ length: 100 }).map((_, i) => (
                    <View key={i} style={styles.gridDot} />
                ))}
            </View>
            <View style={styles.emptyServerContent}>
                <Text style={styles.emptyServerTitle}>Welcome to</Text>
                <Text style={styles.emptyServerName}>{activeSubgrid?.name || 'My Server'}</Text>
                <Text style={styles.emptyServerSubtitle}>
                    This is your brand new server. Here are some steps to help you get started
                </Text>

                <TouchableOpacity
                    style={styles.welcomeActionBtn}
                    onPress={() => setInviteModalOpen(true)}
                >
                    <Text style={styles.welcomeActionText}>Invite your friends</Text>
                    <Plus size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.welcomeActionBtn}
                    onPress={() => setServerSettingsModalOpen(true)}
                >
                    <Text style={styles.welcomeActionText}>Personalize your server with an icon</Text>
                    <Plus size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.welcomeActionBtn}
                    onPress={() => setCreateChannelModalOpen(true)}
                >
                    <Text style={styles.welcomeActionText}>Send your first message</Text>
                    <Plus size={18} color={colors.textMuted} />
                </TouchableOpacity>
            </View>
        </View>
    );

    // Fetch RevShare data when revenue view is shown
    useEffect(() => {
        if (!showRevenueView) return;
        communityGet('/revshare/cu/summary').then((data: any) => {
            if (data) {
                setRevShareData({
                    totalRevShare: data.totalRevShare ?? data.cuTotal ?? 0,
                    partners: (data.partners ?? data.breakdown ?? []).map((p: any, idx: number) => ({
                        partnerId: p.partnerId ?? p._id ?? String(idx),
                        businessName: p.businessName ?? p.name ?? 'Partner',
                        cuAmount: p.cuAmount ?? p.amount ?? 0,
                        transactionCount: p.transactionCount ?? p.count ?? 0,
                        percent: p.percent ?? 0,
                    })),
                });
            }
        }).catch(() => {});
    }, [showRevenueView]);

    // Render Revenue Tab
    const renderRevenueTab = () => {
        const totalRevShare = revShareData?.totalRevShare ?? 0;
        const partnerRevShare = revShareData?.partners ?? [];

        // Web-compatible glass card style
        const glassCard = {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 20,
            gap: 6,
            ...(Platform.OS === 'web' ? {
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            } as any : {}),
        };

        const glassPartnerCard = {
            backgroundColor: colors.glassBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 16,
            gap: 10,
            ...(Platform.OS === 'web' ? {
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
            } as any : {}),
        };

        // For web, center content with max-width
        const contentInner = !isMobile && Platform.OS === 'web'
            ? { maxWidth: 720, width: '100%' as any, alignSelf: 'center' as any }
            : {};

        return (
            <>
                <View style={[styles.contentHeader, isMobile && { paddingTop: insets.top + 14 }]}>
                    <View style={styles.contentHeaderLeft}>
                        {isMobile && (
                            <TouchableOpacity onPress={() => setMobileShowContent(false)} style={styles.mobileBackButton}>
                                <ArrowLeft size={20} color={colors.text} />
                            </TouchableOpacity>
                        )}
                        <DollarSign size={18} color={colors.textMuted} />
                        <Text style={styles.contentTitle}>Revenue Share</Text>
                    </View>
                </View>
                <ScrollView
                    style={styles.feedContainer}
                    contentContainerStyle={[styles.eventsListContent, contentInner]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Total RevShare hero card */}
                    <View style={glassCard}>
                        <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            Total Revenue This Month
                        </Text>
                        <Text style={{ fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: -1 }}>
                            ${totalRevShare.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textSubtle }}>From marketplace + marketing</Text>
                    </View>

                    {/* Stats row on wider screens */}
                    {!isMobile && (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <GlassStatCard
                                label="Marketplace Revenue"
                                value={partnerRevShare.length > 0
                                    ? `$${partnerRevShare.reduce((s: number, p: any) => s + (p.cuAmount ?? 0), 0).toLocaleString()}`
                                    : '$0'}
                                icon={<DollarSign size={20} color="#3b82f6" />}
                                accent="rgba(59,130,246,0.85)"
                                style={{ flex: 1 }}
                            />
                            <GlassStatCard
                                label="Active Partners"
                                value={String(partnerRevShare.length)}
                                icon={<TrendingUp size={20} color="#8b5cf6" />}
                                accent="rgba(139,92,246,0.85)"
                                style={{ flex: 1 }}
                            />
                            <GlassStatCard
                                label="Total Transactions"
                                value={String(partnerRevShare.reduce((s: number, p: any) => s + (p.transactionCount ?? 0), 0))}
                                icon={<DollarSign size={20} color="#22c55e" />}
                                accent="rgba(34,197,94,0.85)"
                                style={{ flex: 1 }}
                            />
                        </View>
                    )}

                    {/* Per-partner breakdown */}
                    {partnerRevShare.length > 0 && (
                        <>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
                                By Partner
                            </Text>
                            {partnerRevShare.map((partner) => (
                                <View key={partner.partnerId} style={glassPartnerCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 }} numberOfLines={1}>
                                            {partner.businessName}
                                        </Text>
                                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>
                                            ${partner.cuAmount.toLocaleString()}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 13, color: colors.textSubtle }}>
                                        {partner.transactionCount} transaction{partner.transactionCount !== 1 ? 's' : ''}
                                    </Text>
                                    {/* Progress bar */}
                                    <View style={{ height: 6, backgroundColor: colors.glassBorder, borderRadius: 3, overflow: 'hidden' }}>
                                        <View style={{
                                            height: 6,
                                            width: `${Math.min(partner.percent, 100)}%` as any,
                                            backgroundColor: colors.primary,
                                            borderRadius: 3,
                                        }} />
                                    </View>
                                </View>
                            ))}
                        </>
                    )}

                    {partnerRevShare.length === 0 && !revShareData && (
                        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                            <TrendingUp size={40} color={colors.textSubtle} />
                            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>No Revenue Data Yet</Text>
                            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
                                Revenue share data will appear here once transactions are processed.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </>
        );
    };

    // Fetch RevShare monitoring data
    const fetchRevShare = async () => {
        const cuId = getTenantId();
        setRevShareLoading(true);
        try {
            const [summaryData, partnersData] = await Promise.all([
                communityGet(`/admin/revshare/summary`),
                communityGet(`/admin/revshare/partners`),
            ]);
            if (summaryData) setRevShareSummary(summaryData);
            if (partnersData) setPartnerRevShare(partnersData);
        } catch {
            // leave state empty — UI shows empty state
        } finally {
            setRevShareLoading(false);
        }
    };

    // Fetch partnership applications
    const fetchPartnershipApplications = async () => {
        if (!activeSubgridId) return;
        setPartnershipApplicationsLoading(true);
        try {
            const data = await communityGet(`/partnership-forum/applications?subgridId=${activeSubgridId}`);
            setPartnershipApplications(data?.applications || data || []);
        } catch (e) {
            console.error('Failed to load partnership applications', e);
        } finally {
            setPartnershipApplicationsLoading(false);
        }
    };

    // Handle partnership application action
    const handleApplicationAction = async (status: 'approved' | 'rejected' | 'under_review') => {
        if (!selectedApplication) return;
        setApplicationActionLoading(true);
        try {
            await communityPatch(`/partnership-forum/applications/${selectedApplication.id}`, {
                status,
                feedback: applicationFeedback,
            });
            setPartnershipApplications(prev =>
                prev.map(a => a.id === selectedApplication.id ? { ...a, status, feedback: applicationFeedback } : a)
            );
            setApplicationActionOpen(false);
            setSelectedApplication(null);
            setApplicationFeedback('');
        } catch (e) {
            console.error('Failed to update application', e);
        } finally {
            setApplicationActionLoading(false);
        }
    };

    // Render RevShare monitoring tab
    const renderRevShareTab = () => {
        const monthlyTrend: Array<{ month: string; amount: number }> = revShareSummary?.monthlyTrend ?? [];
        const maxAmount = Math.max(...monthlyTrend.map((m: any) => m.amount), 1);
        const barChartWidth = 280;
        const barHeight = 18;
        const barGap = 8;
        const labelWidth = 32;
        const chartPadding = 8;

        return (
            <>
                <View style={[styles.contentHeader, isMobile && { paddingTop: insets.top + 14 }]}>
                    <View style={styles.contentHeaderLeft}>
                        {isMobile && (
                            <TouchableOpacity onPress={() => setMobileShowContent(false)} style={styles.mobileBackButton}>
                                <ArrowLeft size={20} color={colors.text} />
                            </TouchableOpacity>
                        )}
                        <TrendingUp size={18} color={colors.textMuted} />
                        <Text style={styles.contentTitle}>RevShare Monitor</Text>
                    </View>
                    <View style={styles.contentHeaderRight}>
                        <TouchableOpacity
                            style={styles.createEventHeaderBtn}
                            onPress={() => Platform.OS === 'web' ? window.alert('Report exported!') : Alert.alert('Export', 'Report exported!')}
                        >
                            <FileText size={16} color="#FFFFFF" />
                            <Text style={styles.createEventHeaderBtnText}>Export Report</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    style={styles.feedContainer}
                    contentContainerStyle={[
                        styles.eventsListContent,
                        !isMobile && Platform.OS === 'web' && { maxWidth: 900, width: '100%' as any, alignSelf: 'center' as any },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {revShareLoading ? (
                        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                    ) : (
                        <>
                            {/* Top Stats Row */}
                            <Text style={styles.revShareSectionLabel}>Overview</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 4, paddingBottom: 4 }}>
                                    {[
                                        { label: 'Total RevShare Earned', value: `$${(revShareSummary?.totalEarned ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, isEarnings: true },
                                        { label: "This Month's Earnings", value: `$${(revShareSummary?.monthEarned ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, isEarnings: true },
                                        { label: 'Active Partners', value: String(revShareSummary?.activePartners ?? 0), isEarnings: false },
                                        { label: 'Avg. Per Partner', value: `$${(revShareSummary?.avgPerPartner ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, isEarnings: true },
                                    ].map((stat, idx) => (
                                        <View key={idx} style={[styles.revShareStatCard, Platform.OS === 'web' && { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any]}>
                                            <Text style={styles.revShareStatLabel}>{stat.label}</Text>
                                            <Text style={[styles.revShareStatValue, stat.isEarnings && { color: colors.primary }]}>
                                                {stat.value}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>

                            {/* Monthly Trend Chart */}
                            {monthlyTrend.length > 0 && (
                            <><Text style={[styles.revShareSectionLabel, { marginTop: 8 }]}>Monthly Trend (Last 6 Months)</Text>
                            <View style={[styles.revShareChartCard, Platform.OS === 'web' && { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any]}>
                                <Svg
                                    width={barChartWidth}
                                    height={(barHeight + barGap) * monthlyTrend.length + chartPadding * 2}
                                >
                                    {monthlyTrend.map((item: any, i: number) => {
                                        const barWidth = Math.round(((item.amount / maxAmount) * (barChartWidth - labelWidth - 60)));
                                        const y = chartPadding + i * (barHeight + barGap);
                                        return (
                                            <React.Fragment key={item.month}>
                                                <SvgText
                                                    x={0}
                                                    y={y + barHeight - 3}
                                                    fontSize={11}
                                                    fill={colors.textMuted}
                                                    fontWeight="500"
                                                >
                                                    {item.month}
                                                </SvgText>
                                                <Rect
                                                    x={labelWidth}
                                                    y={y}
                                                    width={barWidth}
                                                    height={barHeight}
                                                    rx={4}
                                                    fill={colors.primary}
                                                    opacity={0.85}
                                                />
                                                <SvgText
                                                    x={labelWidth + barWidth + 6}
                                                    y={y + barHeight - 3}
                                                    fontSize={11}
                                                    fill={colors.text}
                                                    fontWeight="600"
                                                >
                                                    ${item.amount}
                                                </SvgText>
                                            </React.Fragment>
                                        );
                                    })}
                                </Svg>
                            </View>
                            </>
                            )}

                            {/* Partner Earnings Breakdown */}
                            <Text style={[styles.revShareSectionLabel, { marginTop: 8 }]}>Partner Earnings Breakdown</Text>

                            {/* Table Header */}
                            <View style={styles.revShareTableHeader}>
                                <Text style={[styles.revShareTableHeaderCell, { flex: 2 }]}>Partner</Text>
                                <Text style={[styles.revShareTableHeaderCell, { flex: 1 }]}>Category</Text>
                                <Text style={[styles.revShareTableHeaderCell, { flex: 1, textAlign: 'right' }]}>Redemptions</Text>
                                <Text style={[styles.revShareTableHeaderCell, { flex: 1, textAlign: 'right' }]}>Earnings</Text>
                                <Text style={[styles.revShareTableHeaderCell, { width: 50, textAlign: 'right' }]}>%</Text>
                            </View>

                            {/* Table Rows */}
                            {[...partnerRevShare]
                                .sort((a, b) => b.earnings - a.earnings)
                                .map((partner, idx) => {
                                    const isExpanded = expandedPartnerId === partner.partnerId;
                                    const isEven = idx % 2 === 0;
                                    return (
                                        <View key={partner.partnerId}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.revShareTableRow,
                                                    isEven && styles.revShareTableRowAlt,
                                                    isExpanded && styles.revShareTableRowExpanded,
                                                ]}
                                                onPress={() => {
                                                    hapticLight();
                                                    setExpandedPartnerId(isExpanded ? null : partner.partnerId);
                                                }}
                                                activeOpacity={0.75}
                                            >
                                                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <ChevronRight
                                                        size={14}
                                                        color={colors.textMuted}
                                                        style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                                                    />
                                                    <Text style={styles.revShareTableCell} numberOfLines={1}>{partner.name}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <View style={styles.revShareCategoryBadge}>
                                                        <Text style={styles.revShareCategoryText} numberOfLines={1}>{partner.category}</Text>
                                                    </View>
                                                </View>
                                                <Text style={[styles.revShareTableCell, { flex: 1, textAlign: 'right' }]}>{partner.redemptions}</Text>
                                                <Text style={[styles.revShareTableCell, { flex: 1, textAlign: 'right', color: colors.primary, fontWeight: '700' }]}>
                                                    ${partner.earnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </Text>
                                                <Text style={[styles.revShareTableCell, { width: 50, textAlign: 'right' }]}>{partner.percentage}%</Text>
                                            </TouchableOpacity>

                                            {/* Expanded detail */}
                                            {isExpanded && (
                                                <View style={styles.revShareExpandedDetail}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                                        <View style={styles.revShareDetailItem}>
                                                            <Text style={styles.revShareDetailLabel}>Total Redemptions</Text>
                                                            <Text style={styles.revShareDetailValue}>{partner.redemptions}</Text>
                                                        </View>
                                                        <View style={styles.revShareDetailItem}>
                                                            <Text style={styles.revShareDetailLabel}>Total Earnings</Text>
                                                            <Text style={[styles.revShareDetailValue, { color: colors.primary }]}>
                                                                ${partner.earnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.revShareDetailItem}>
                                                            <Text style={styles.revShareDetailLabel}>% of Total</Text>
                                                            <Text style={styles.revShareDetailValue}>{partner.percentage}%</Text>
                                                        </View>
                                                        <View style={styles.revShareDetailItem}>
                                                            <Text style={styles.revShareDetailLabel}>Last Redemption</Text>
                                                            <Text style={styles.revShareDetailValue}>{partner.lastRedemptionDate ?? 'N/A'}</Text>
                                                        </View>
                                                    </View>
                                                    {/* Progress bar */}
                                                    <View style={{ marginTop: 10 }}>
                                                        <Text style={[styles.revShareDetailLabel, { marginBottom: 4 }]}>Share of Total Revenue</Text>
                                                        <View style={{ height: 6, backgroundColor: colors.glassBorder, borderRadius: 3, overflow: 'hidden' }}>
                                                            <View style={{
                                                                height: 6,
                                                                width: `${Math.min(partner.percentage, 100)}%` as any,
                                                                backgroundColor: colors.primary,
                                                                borderRadius: 3,
                                                            }} />
                                                        </View>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            }
                        </>
                    )}
                </ScrollView>
            </>
        );
    };

    const fetchPartnerListings = async () => {
        if (!activeSubgridId) return;
        setPartnerListingsLoading(true);
        try {
            const data = await communityGet(`/marketplace?subgridId=${activeSubgridId}&admin=true`);
            setPartnerListings(Array.isArray(data) ? data : (data?.data ?? data?.listings ?? []));
        } catch (e) {
            console.error('Failed to load partner listings', e);
        } finally {
            setPartnerListingsLoading(false);
        }
    };

    const handleToggleListingStatus = async (listing: any) => {
        setListingActionLoading(true);
        try {
            const newStatus = !listing.isActive;
            await communityPatch(`/marketplace/${listing._id}/admin-status`, { isActive: newStatus });
            setPartnerListings(prev =>
                prev.map(l => l._id === listing._id ? { ...l, isActive: newStatus } : l)
            );
        } catch (e) {
            console.error('Failed to toggle listing status', e);
        } finally {
            setListingActionLoading(false);
            setListingActionModalOpen(false);
            setListingActionTarget(null);
        }
    };

    const handleForceRemoveListing = async () => {
        if (!listingActionTarget) return;
        setListingActionLoading(true);
        try {
            await communityDelete(`/marketplace/${listingActionTarget._id}`);
            setPartnerListings(prev => prev.filter(l => l._id !== listingActionTarget._id));
            setListingActionModalOpen(false);
            setListingActionTarget(null);
        } catch (e) {
            console.error('Failed to remove listing', e);
        } finally {
            setListingActionLoading(false);
        }
    };

    const renderPartnerListingsTab = () => (
        <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Partner Listings</Text>
                <TouchableOpacity onPress={fetchPartnerListings} style={{ padding: 8 }}>
                    <RefreshCw size={18} color={colors.textMuted} />
                </TouchableOpacity>
            </View>
            {partnerListingsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : partnerListings.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 40 }}>
                    <ShoppingBag size={48} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, marginTop: 12 }}>No partner listings yet</Text>
                </View>
            ) : (
                partnerListings.map((listing) => (
                    <View key={listing._id} style={styles.partnerListingCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{listing.title}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{listing.category} • {listing.discountPercent}% off</Text>
                            </View>
                            <GlassBadge
                                label={listing.isActive ? 'Active' : 'Suspended'}
                                variant={listing.isActive ? 'success' : 'warning'}
                            />
                        </View>
                        {listing.description ? (
                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16 }} numberOfLines={2}>{listing.description}</Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            <TouchableOpacity
                                style={[styles.listingActionBtn, { backgroundColor: listing.isActive ? colors.warningBg : colors.successBg }]}
                                onPress={() => { setListingActionTarget(listing); handleToggleListingStatus(listing); }}
                            >
                                <Text style={{ color: listing.isActive ? colors.warningText : colors.successText, fontSize: 12, fontWeight: '600' }}>
                                    {listing.isActive ? 'Suspend' : 'Restore'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.listingActionBtn, { backgroundColor: colors.dangerBg }]}
                                onPress={() => { setListingActionTarget(listing); setListingActionModalOpen(true); }}
                            >
                                <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: '600' }}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderPartnerRequestsTab = () => {
        const filterTabs: { key: typeof partnerRequestsFilter; label: string }[] = [
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'under_review', label: 'Under Review' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
        ];
        const filtered = partnerRequestsFilter === 'all'
            ? partnershipApplications
            : partnershipApplications.filter(a => a.status === partnerRequestsFilter);

        const statusColor = (status: string) => {
            if (status === 'approved') return '#10B981';
            if (status === 'rejected') return colors.error;
            if (status === 'under_review') return '#3B82F6';
            return '#F59E0B';
        };
        const statusLabel = (status: string) => {
            if (status === 'under_review') return 'Under Review';
            if (status === 'approved') return 'Approved';
            if (status === 'rejected') return 'Rejected';
            return 'Pending';
        };
        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            try {
                return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } catch {
                return dateStr;
            }
        };

        return (
            <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Handshake size={20} color={colors.primary} />
                        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Partnership Requests</Text>
                        <View style={{
                            backgroundColor: colors.primary,
                            borderRadius: 10,
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            marginLeft: 4,
                        }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{partnershipApplications.length}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={fetchPartnershipApplications} style={{ padding: 8 }}>
                        <RefreshCw size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Filter Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                    {filterTabs.map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setPartnerRequestsFilter(tab.key)}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: partnerRequestsFilter === tab.key ? colors.primary : colors.glassBg,
                                borderWidth: 1,
                                borderColor: partnerRequestsFilter === tab.key ? colors.primary : colors.glassBorder,
                            }}
                        >
                            <Text style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: partnerRequestsFilter === tab.key ? '#FFFFFF' : colors.textMuted,
                            }}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Content */}
                {partnershipApplicationsLoading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                ) : filtered.length === 0 ? (
                    <View style={{ alignItems: 'center', padding: 40 }}>
                        <Handshake size={48} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>
                            {partnerRequestsFilter === 'all' ? 'No partnership requests yet' : `No ${statusLabel(partnerRequestsFilter).toLowerCase()} requests`}
                        </Text>
                    </View>
                ) : (
                    filtered.map((app) => {
                        const appId = app._id || app.id;
                        const isExpanded = expandedApplicationIds.includes(appId);
                        const toggleExpand = () => {
                            setExpandedApplicationIds(prev =>
                                prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
                            );
                        };
                        return (
                            <View
                                key={appId}
                                style={{
                                    borderWidth: 1,
                                    borderColor: colors.glassBorder,
                                    borderRadius: 16,
                                    padding: 14,
                                    marginBottom: 12,
                                    backgroundColor: colors.modalBg,
                                }}
                            >
                                {/* Application header row */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                                            {app.businessName || 'Unnamed Business'}
                                        </Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                                            {app.partnerName || app.vendorName || 'Unknown Partner'}
                                        </Text>
                                        {app.category ? (
                                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
                                                {app.category}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        <View style={{
                                            backgroundColor: statusColor(app.status) + '22',
                                            borderRadius: 8,
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                            borderWidth: 1,
                                            borderColor: statusColor(app.status) + '55',
                                        }}>
                                            <Text style={{ color: statusColor(app.status), fontSize: 11, fontWeight: '700' }}>
                                                {statusLabel(app.status)}
                                            </Text>
                                        </View>
                                        {(app.createdAt || app.submittedAt) ? (
                                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                                                {formatDate(app.createdAt || app.submittedAt)}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>

                                {/* View Details toggle */}
                                <TouchableOpacity
                                    onPress={toggleExpand}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        paddingVertical: 4,
                                        marginBottom: isExpanded ? 10 : 0,
                                    }}
                                >
                                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                                        {isExpanded ? 'Hide Details' : 'View Details'}
                                    </Text>
                                    <ChevronDown
                                        size={14}
                                        color={colors.primary}
                                        style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                                    />
                                </TouchableOpacity>

                                {/* Expanded detail section */}
                                {isExpanded && (
                                    <View style={{ marginBottom: 10 }}>
                                        {(app.proposal || app.proposalText) ? (
                                            <View style={{
                                                backgroundColor: colors.glassBg,
                                                borderRadius: 8,
                                                padding: 10,
                                                marginBottom: 8,
                                                borderWidth: 1,
                                                borderColor: colors.glassBorder,
                                            }}>
                                                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Proposal</Text>
                                                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
                                                    {app.proposal || app.proposalText}
                                                </Text>
                                            </View>
                                        ) : null}
                                        {app.feedback ? (
                                            <View style={{
                                                backgroundColor: '#3B82F611',
                                                borderRadius: 8,
                                                padding: 10,
                                                borderWidth: 1,
                                                borderColor: '#3B82F633',
                                            }}>
                                                <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Feedback</Text>
                                                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>{app.feedback}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}

                                {/* Action buttons */}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                    <TouchableOpacity
                                        disabled={applicationActionLoading}
                                        onPress={() => {
                                            setSelectedApplication(app);
                                            handleApplicationAction('approved');
                                        }}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 7,
                                            borderRadius: 8,
                                            backgroundColor: '#10B98122',
                                            borderWidth: 1,
                                            borderColor: '#10B98144',
                                        }}
                                    >
                                        <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>Approve</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        disabled={applicationActionLoading}
                                        onPress={() => {
                                            setSelectedApplication(app);
                                            handleApplicationAction('under_review');
                                        }}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 7,
                                            borderRadius: 8,
                                            backgroundColor: '#3B82F622',
                                            borderWidth: 1,
                                            borderColor: '#3B82F644',
                                        }}
                                    >
                                        <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>Review</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        disabled={applicationActionLoading}
                                        onPress={() => {
                                            setSelectedApplication(app);
                                            handleApplicationAction('rejected');
                                        }}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 7,
                                            borderRadius: 8,
                                            backgroundColor: colors.dangerBg,
                                            borderWidth: 1,
                                            borderColor: colors.dangerBg,
                                        }}
                                    >
                                        <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: '600' }}>Reject</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            {/* Top Navigation - hidden on mobile, shown in mobileTopBar instead */}
            {!isMobile && (
            <View style={styles.topNav}>
                <View style={styles.topNavLeft}>
                    <Image source={require('../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6 }} />
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topNavTabs}>
                    <TouchableOpacity style={styles.tabActive}>
                        <Text style={styles.tabTextActive}>Server</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.tab} onPress={() => router.push('/admin/messages')}>
                        <Text style={styles.tabText}>Messages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.tab} onPress={() => router.push('/admin/contributors')}>
                        <Text style={styles.tabText}>Leaderboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={showRevenueView ? styles.tabActive : styles.tab}
                        onPress={() => { setShowRevenueView(!showRevenueView); setShowEventsView(false); setShowRevShareTab(false); setShowPartnerListingsView(false); setShowPartnerRequestsView(false); }}
                    >
                        <Text style={showRevenueView ? styles.tabTextActive : styles.tabText}>Revenue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={showRevShareTab ? styles.tabActive : styles.tab}
                        onPress={() => { setShowRevShareTab(!showRevShareTab); setShowRevenueView(false); setShowEventsView(false); setShowPartnerListingsView(false); setShowPartnerRequestsView(false); fetchRevShare(); }}
                    >
                        <Text style={showRevShareTab ? styles.tabTextActive : styles.tabText}>RevShare</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={showPartnerListingsView ? styles.tabActive : styles.tab}
                        onPress={() => { setShowPartnerListingsView(!showPartnerListingsView); setShowRevenueView(false); setShowRevShareTab(false); setShowEventsView(false); setShowPartnerRequestsView(false); fetchPartnerListings(); }}
                    >
                        <Text style={showPartnerListingsView ? styles.tabTextActive : styles.tabText}>Listings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={showPartnerRequestsView ? styles.tabActive : styles.tab}
                        onPress={() => { setShowPartnerRequestsView(!showPartnerRequestsView); setShowPartnerListingsView(false); setShowRevenueView(false); setShowRevShareTab(false); setShowEventsView(false); fetchPartnershipApplications(); }}
                    >
                        <Text style={showPartnerRequestsView ? styles.tabTextActive : styles.tabText}>Partners</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
            )}

            <View style={styles.mainArea}>
                {/* Left Icon Rail - hidden on mobile */}
                {!isMobile && (
                    <GlassRail
                        serverLogo={{
                            uri: activeSubgrid?.logoUrl,
                            name: activeSubgrid?.name,
                            onPress: () => {},
                        }}
                        items={[
                            {
                                id: 'messages',
                                icon: <MessageSquare size={20} color={colors.textMuted} />,
                                activeIcon: <MessageSquare size={20} color={colors.glassActiveText} />,
                                onPress: () => router.push('/admin/messages'),
                                isActive: false,
                            },
                            {
                                id: 'revenue',
                                icon: <DollarSign size={20} color={showRevenueView ? colors.primary : colors.textMuted} />,
                                activeIcon: <DollarSign size={20} color={colors.glassActiveText} />,
                                onPress: () => { setShowRevenueView(!showRevenueView); setShowEventsView(false); setShowRevShareTab(false); },
                                isActive: showRevenueView,
                            },
                            {
                                id: 'revshare',
                                icon: <TrendingUp size={20} color={showRevShareTab ? colors.primary : colors.textMuted} />,
                                activeIcon: <TrendingUp size={20} color={colors.glassActiveText} />,
                                onPress: () => { setShowRevShareTab(!showRevShareTab); setShowRevenueView(false); setShowEventsView(false); fetchRevShare(); },
                                isActive: showRevShareTab,
                            },
                            {
                                id: 'partnerlistings',
                                icon: <ShoppingBag size={20} color={showPartnerListingsView ? colors.primary : colors.textMuted} />,
                                activeIcon: <ShoppingBag size={20} color={colors.glassActiveText} />,
                                onPress: () => { setShowPartnerListingsView(!showPartnerListingsView); setShowRevenueView(false); setShowRevShareTab(false); setShowEventsView(false); setShowPartnerRequestsView(false); fetchPartnerListings(); },
                                isActive: showPartnerListingsView,
                            },
                            {
                                id: 'partnerrequests',
                                icon: <Handshake size={20} color={showPartnerRequestsView ? colors.primary : colors.textMuted} />,
                                activeIcon: <Handshake size={20} color={colors.glassActiveText} />,
                                onPress: () => { setShowPartnerRequestsView(!showPartnerRequestsView); setShowPartnerListingsView(false); setShowRevenueView(false); setShowRevShareTab(false); setShowEventsView(false); fetchPartnershipApplications(); },
                                isActive: showPartnerRequestsView,
                            },
                            {
                                id: 'leaderboard',
                                icon: <Trophy size={20} color={colors.textMuted} />,
                                activeIcon: <Trophy size={20} color={colors.glassActiveText} />,
                                onPress: () => router.push('/admin/contributors'),
                                isActive: false,
                            },
                        ]}
                        onToggleTheme={toggleTheme}
                        onLogout={handleLogout}
                    />
                )}

                {/* Channel Sidebar - full width on mobile when not showing content */}
                {(!isMobile || !mobileShowContent) && (
                <View style={[styles.channelSidebar, isMobile && styles.channelSidebarMobile]}>
                    {/* Mobile Top Bar - branded header with Gryd branding */}
                    {isMobile && (
                        <View style={styles.mobileTopBar}>
                            {/* Gryd Branding Row */}
                            <View style={styles.mobileHeaderBrandRow}>
                                <View style={styles.mobileGrydLogo}>
                                    <View style={styles.mobileGrydLogoIcon}>
                                        <Image source={require('../assets/icon.png')} style={{ width: 24, height: 24, borderRadius: 4 }} />
                                    </View>
                                    <Text style={styles.mobileGrydLogoText}>THE GRYD</Text>
                                </View>
                                <View style={styles.mobileTopBarRight}>
                                    <TouchableOpacity style={styles.mobileTopBarBtn} onPress={toggleTheme}>
                                        {mode === 'dark' ? <Sun size={16} color={colors.textMuted} /> : <Moon size={16} color={colors.textMuted} />}
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.mobileTopBarBtn} onPress={() => setServerSettingsModalOpen(true)}>
                                        <Settings size={16} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.mobileExitButton} onPress={handleLogout}>
                                        <X size={14} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {/* Server Info Row */}
                            <View style={styles.mobileServerInfoRow}>
                                {activeSubgrid?.logoUrl ? (
                                    <Image source={{ uri: activeSubgrid.logoUrl }} style={styles.mobileTopBarLogo} cachePolicy="memory-disk" />
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
                                    <Text style={styles.mobileServerSubtitle}>Credit Union Admin</Text>
                                </View>
                            </View>
                            {/* Mobile Navigation Tabs */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNavTabs}>
                                <TouchableOpacity style={styles.mobileNavTabActive}>
                                    <Text style={styles.mobileNavTabTextActive}>Server</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.mobileNavTab} onPress={() => router.push('/admin/messages')}>
                                    <Text style={styles.mobileNavTabText}>Messages</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.mobileNavTab} onPress={() => router.push('/admin/contributors')}>
                                    <Text style={styles.mobileNavTabText}>Leaderboard</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={showRevenueView ? styles.mobileNavTabActive : styles.mobileNavTab}
                                    onPress={() => { setShowRevenueView(!showRevenueView); setShowEventsView(false); setShowRevShareTab(false); setShowPartnerListingsView(false); setShowPartnerRequestsView(false); setMobileShowContent(true); }}
                                >
                                    <Text style={showRevenueView ? styles.mobileNavTabTextActive : styles.mobileNavTabText}>Revenue</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={showRevShareTab ? styles.mobileNavTabActive : styles.mobileNavTab}
                                    onPress={() => { setShowRevShareTab(!showRevShareTab); setShowRevenueView(false); setShowEventsView(false); setShowPartnerListingsView(false); setShowPartnerRequestsView(false); fetchRevShare(); setMobileShowContent(true); }}
                                >
                                    <Text style={showRevShareTab ? styles.mobileNavTabTextActive : styles.mobileNavTabText}>RevShare</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={showPartnerListingsView ? styles.mobileNavTabActive : styles.mobileNavTab}
                                    onPress={() => { setShowPartnerListingsView(!showPartnerListingsView); setShowRevenueView(false); setShowRevShareTab(false); setShowEventsView(false); setShowPartnerRequestsView(false); fetchPartnerListings(); setMobileShowContent(true); }}
                                >
                                    <Text style={showPartnerListingsView ? styles.mobileNavTabTextActive : styles.mobileNavTabText}>Listings</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={showPartnerRequestsView ? styles.mobileNavTabActive : styles.mobileNavTab}
                                    onPress={() => { setShowPartnerRequestsView(!showPartnerRequestsView); setShowPartnerListingsView(false); setShowRevenueView(false); setShowRevShareTab(false); setShowEventsView(false); fetchPartnershipApplications(); setMobileShowContent(true); }}
                                >
                                    <Text style={showPartnerRequestsView ? styles.mobileNavTabTextActive : styles.mobileNavTabText}>Partners</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    )}
                    {/* Server Header with Dropdown */}
                    <View style={styles.serverHeaderContainer}>
                        <View style={styles.serverHeader}>
                            <View style={[styles.serverHeaderLeft, { flex: 1, overflow: 'hidden', paddingRight: 4 }]}>
                                <View style={{ flex: 1 }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ alignItems: 'center', paddingRight: 16 }}>
                                        <Text style={styles.serverName} numberOfLines={1}>{activeSubgrid?.name || 'My Server'}</Text>
                                    </ScrollView>
                                </View>
                                <TouchableOpacity onPress={() => setServerSettingsModalOpen(true)} style={{ marginLeft: 4 }}>
                                    <Settings size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => setServerMenuOpen(!serverMenuOpen)}>
                                <UserPlus size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        {serverMenuOpen && <ServerMenuDropdown />}
                    </View>

                    {channelsQuery.isError && (
                        <ErrorRetry message="Failed to load channels" onRetry={() => channelsQuery.refetch()} loading={channelsQuery.isRefetching} />
                    )}
                    <ScrollView
                        style={styles.channelList}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6C5CE7" />}
                    >
                        {channelsQuery.isLoading && Array.from({ length: 5 }).map((_, i) => <ChannelSkeleton key={`ch-sk-${i}`} />)}
                        {/* Events */}
                        <TouchableOpacity
                            style={[styles.eventsButton, showEventsView && styles.eventsButtonActive]}
                            onPress={() => { setShowEventsView(!showEventsView); setShowRevenueView(false); if (isMobile) setMobileShowContent(true); }}
                        >
                            <Calendar size={16} color={showEventsView ? colors.text : colors.textMuted} />
                            <Text style={[styles.eventsText, showEventsView && styles.eventsTextActive]}>Events</Text>
                            <TouchableOpacity
                                style={{ marginLeft: 'auto' }}
                                onPress={(e) => { e.stopPropagation(); setCreateEventModalOpen(true); }}
                            >
                                <Plus size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Channel groups (categories + uncategorized) */}
                        {adminGroupedChannels.map((group) => {
                            const isOpen = !collapsedGroups[group.groupId];
                            return (
                                <View key={group.groupId} style={styles.channelGroup}>
                                    <View style={styles.channelGroupHeader}>
                                        <TouchableOpacity
                                            style={styles.channelGroupToggle}
                                            onPress={() => setCollapsedGroups((prev) => ({ ...prev, [group.groupId]: !prev[group.groupId] }))}
                                        >
                                            <ChevronDown
                                                size={12}
                                                color={colors.textMuted}
                                                style={!isOpen ? { transform: [{ rotate: '-90deg' }] } : undefined}
                                            />
                                            <Text style={styles.channelGroupTitle}>{group.groupName}</Text>
                                        </TouchableOpacity>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            {!group.groupId.startsWith('__') && (
                                                <TouchableOpacity onPress={() => handleDeleteCategory(group.groupId, group.groupName)}>
                                                    <Trash2 size={14} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity onPress={() => {
                                                setCreateChannelModalOpen(true);
                                            }}>
                                                <Plus size={16} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {isOpen && group.channels.map((channel) => {
                                        const isActive = channel._id === activeChannelId;
                                        const isVoice = channel.type === 'voice';
                                        return (
                                            <TouchableOpacity
                                                key={channel._id}
                                                style={[styles.channelItem, isActive && styles.channelItemActive]}
                                                onPress={() => {
                                                    if (isVoice) {
                                                        handleVoiceChannelClick(channel);
                                                    } else {
                                                        setActiveChannelId(channel._id);
                                                    }
                                                    if (isMobile) setMobileShowContent(true);
                                                }}
                                            >
                                                {isVoice ? (
                                                    <Headphones size={16} color={isActive ? colors.text : colors.textMuted} />
                                                ) : channel.visibility === 'admin' ? (
                                                    <Lock size={16} color={isActive ? colors.text : colors.textMuted} />
                                                ) : (
                                                    <Image source={require('../assets/icon.png')} style={{ width: 16, height: 16, borderRadius: 3 }} />
                                                )}
                                                <View style={{ flex: 1, marginRight: 8, justifyContent: 'center' }}>
                                                    <Text style={[styles.channelName, isActive && styles.channelNameActive]} numberOfLines={1} ellipsizeMode="tail">
                                                        {channel.name || 'untitled'}
                                                    </Text>
                                                </View>
                                                {isActive && !isVoice && (
                                                    <View style={styles.channelActions}>
                                                        <TouchableOpacity
                                                            onPress={(e) => { e.stopPropagation(); setInviteModalOpen(true); }}
                                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                        >
                                                            <UserPlus size={14} color={colors.textMuted} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={(e) => {
                                                                e.stopPropagation();
                                                                openChannelSettingsModal(channel);
                                                            }}
                                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                        >
                                                            <Settings size={14} color={colors.textMuted} />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                                {isVoice && (
                                                    <View style={styles.channelActions}>
                                                        <TouchableOpacity
                                                            onPress={(e) => {
                                                                e.stopPropagation();
                                                                openChannelSettingsModal(channel);
                                                            }}
                                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                        >
                                                            <Settings size={14} color={colors.textMuted} />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                    {isOpen && group.channels.length === 0 && (
                                        <Text style={styles.emptyText}>No channels</Text>
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* User Profile */}
                    <View style={styles.userProfile}>
                        <View style={styles.userAvatarContainer}>
                            <UserAvatar
                                uri={getMemberAvatarUrl(currentUserMember)}
                                name={currentUserName}
                                style={styles.userAvatar}
                            />
                            <View style={styles.onlineIndicator} />
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{currentUserName}</Text>
                            <Text style={styles.userStatus}>Online</Text>
                        </View>
                        <View style={styles.userActions}>
                            <View style={styles.dropdownWrapper}>
                                <TouchableOpacity style={styles.userActionBtn} onPress={() => { setShowMicDropdown(!showMicDropdown); setShowHeadphoneDropdown(false); }}>
                                    <Mic size={14} color={colors.textMuted} />
                                    <ChevronDown size={10} color={colors.textMuted} />
                                </TouchableOpacity>
                                {showMicDropdown && (
                                    <View style={styles.audioDropdown}>
                                        <Text style={styles.audioDropdownTitle}>Microphone</Text>
                                        {micOptions.map((option) => (
                                            <TouchableOpacity
                                                key={option}
                                                style={[styles.audioDropdownItem, selectedMic === option && styles.audioDropdownItemActive]}
                                                onPress={() => { setSelectedMic(option); setShowMicDropdown(false); }}
                                            >
                                                <Text style={[styles.audioDropdownText, selectedMic === option && styles.audioDropdownTextActive]}>{option}</Text>
                                                {selectedMic === option && <Check size={14} color="#22C55E" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <View style={styles.dropdownWrapper}>
                                <TouchableOpacity style={styles.userActionBtn} onPress={() => { setShowHeadphoneDropdown(!showHeadphoneDropdown); setShowMicDropdown(false); }}>
                                    <Headphones size={14} color={colors.textMuted} />
                                    <ChevronDown size={10} color={colors.textMuted} />
                                </TouchableOpacity>
                                {showHeadphoneDropdown && (
                                    <View style={styles.audioDropdown}>
                                        <Text style={styles.audioDropdownTitle}>Output Device</Text>
                                        {headphoneOptions.map((option) => (
                                            <TouchableOpacity
                                                key={option}
                                                style={[styles.audioDropdownItem, selectedHeadphone === option && styles.audioDropdownItemActive]}
                                                onPress={() => { setSelectedHeadphone(option); setShowHeadphoneDropdown(false); }}
                                            >
                                                <Text style={[styles.audioDropdownText, selectedHeadphone === option && styles.audioDropdownTextActive]}>{option}</Text>
                                                {selectedHeadphone === option && <Check size={14} color="#22C55E" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setServerSettingsModalOpen(true)}>
                                <Settings size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                )}

                {/* Main Content - full width on mobile when showing content */}
                {(!isMobile || mobileShowContent) && (
                <KeyboardAvoidingView
                    style={[styles.mainContent, isMobile && styles.mainContentMobile]}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                <View style={{ flex: 1 }}>
                    {/* Close server menu when tapping outside - handled by onScroll instead */}
                    {showPartnerRequestsView ? (
                        /* Partnership Requests View */
                        renderPartnerRequestsTab()
                    ) : showPartnerListingsView ? (
                        /* Partner Listings View */
                        renderPartnerListingsTab()
                    ) : showRevShareTab ? (
                        /* RevShare Monitor View */
                        renderRevShareTab()
                    ) : showRevenueView ? (
                        /* Revenue View */
                        renderRevenueTab()
                    ) : showEventsView ? (
                        /* Events View */
                        <>
                            <View style={[styles.contentHeader, isMobile && { paddingTop: insets.top + 14 }]}>
                                <View style={styles.contentHeaderLeft}>
                                    {isMobile && (
                                        <TouchableOpacity onPress={() => setMobileShowContent(false)} style={styles.mobileBackButton}>
                                            <ArrowLeft size={20} color={colors.text} />
                                        </TouchableOpacity>
                                    )}
                                    <Calendar size={18} color={colors.textMuted} />
                                    <Text style={styles.contentTitle}>Events & Announcements</Text>
                                </View>
                                <View style={styles.contentHeaderRight}>
                                    <TouchableOpacity
                                        style={styles.createEventHeaderBtn}
                                        onPress={() => setCreateEventModalOpen(true)}
                                    >
                                        <Plus size={16} color="#FFFFFF" />
                                        <Text style={styles.createEventHeaderBtnText}>Create Event</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <ScrollView
                                style={styles.feedContainer}
                                contentContainerStyle={styles.eventsListContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {events.length === 0 ? (
                                    <View style={styles.welcomeCard}>
                                        <View style={styles.welcomeIcon}>
                                            <Calendar size={32} color={colors.textMuted} />
                                        </View>
                                        <Text style={styles.welcomeTitle}>No Events Yet</Text>
                                        <Text style={styles.welcomeSubtitle}>Create your first event or announcement to keep members informed.</Text>
                                        <TouchableOpacity
                                            style={styles.editChannelBtn}
                                            onPress={() => setCreateEventModalOpen(true)}
                                        >
                                            <Plus size={14} color={colors.text} />
                                            <Text style={styles.editChannelText}>Create Event</Text>
                                        </TouchableOpacity>
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
                                                <TouchableOpacity
                                                    style={styles.eventDeleteBtn}
                                                    onPress={() => handleDeleteEvent(event._id)}
                                                >
                                                    <Trash2 size={16} color={colors.dangerText} />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.eventTitle}>{event.title}</Text>
                                            {event.description && (
                                                <Text style={styles.eventDescription}>{event.description}</Text>
                                            )}
                                            <View style={styles.eventMeta}>
                                                {event.startDate && (
                                                    <View style={styles.eventMetaItem}>
                                                        <Clock size={14} color={colors.textMuted} />
                                                        <Text style={styles.eventMetaText}>{formatEventDate(event.startDate)}</Text>
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
                    {/* Channel Header */}
                    <View style={[styles.contentHeader, isMobile && { paddingTop: insets.top + 14 }]}>
                        <View style={styles.contentHeaderLeft}>
                            {isMobile && (
                                <TouchableOpacity onPress={() => setMobileShowContent(false)} style={styles.mobileBackButton}>
                                    <ArrowLeft size={20} color={colors.text} />
                                </TouchableOpacity>
                            )}
                            {activeChannel?.visibility === 'admin' ? <Lock size={18} color={colors.textMuted} /> : <Image source={require('../assets/icon.png')} style={{ width: 18, height: 18, borderRadius: 3 }} />}
                            <Text style={styles.contentTitle}>{activeChannel?.name || 'general'}</Text>
                        </View>
                        <View style={styles.contentHeaderRight}>
                            <TouchableOpacity style={styles.headerIcon} onPress={() => setShowPinnedMessages(!showPinnedMessages)}>
                                <Pin size={18} color={showPinnedMessages ? colors.text : colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerIcon} onPress={() => setNotificationSettingsModalOpen(true)}>
                                <Bell size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                            {!isMobile && (
                            <TouchableOpacity style={styles.headerIcon} onPress={() => setShowMembersSidebar(!showMembersSidebar)}>
                                <Users size={18} color={showMembersSidebar ? colors.text : colors.textMuted} />
                            </TouchableOpacity>
                            )}
                            {!isMobile && (
                            <View style={styles.searchBox}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={`Search ${activeSubgrid?.name || 'server'}`}
                                    placeholderTextColor={colors.textSubtle}
                                    value={feedSearchQuery}
                                    onChangeText={setFeedSearchQuery}
                                />
                                {feedSearchQuery ? (
                                    <TouchableOpacity onPress={() => setFeedSearchQuery('')}>
                                        <X size={14} color={colors.textMuted} />
                                    </TouchableOpacity>
                                ) : (
                                    <Search size={14} color={colors.textMuted} />
                                )}
                            </View>
                            )}
                        </View>
                    </View>

                    {/* Show Loading, Error, Empty State, or Feed */}
                    {isInitializing ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Loading server data...</Text>
                        </View>
                    ) : (channelsQuery.isError || subgridsQuery.isError) ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                            <AlertTriangle size={48} color={colors.dangerText} />
                            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 }}>Failed to load server data</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                                {channelsQuery.error?.message || subgridsQuery.error?.message || 'Please check your connection and try again.'}
                            </Text>
                            <TouchableOpacity
                                style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}
                                onPress={() => { channelsQuery.refetch(); subgridsQuery.refetch(); membersQuery.refetch(); }}
                            >
                                <Text style={{ color: colors.glassActiveText, fontWeight: '600' }}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : isServerEmpty ? (
                        <EmptyServerWelcome />
                    ) : (
                        <>
                            {/* Feed */}
                            <ScrollView
                                ref={feedScrollRef as any}
                                style={styles.feedContainer}
                                contentContainerStyle={styles.feedContent}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                bounces={true}
                                scrollEnabled={true}
                                nestedScrollEnabled={true}
                                removeClippedSubviews={false}
                                onContentSizeChange={handleContentSizeChange}
                                onLayout={handleScrollViewLayout}
                                onScrollBeginDrag={() => {
                                    if (serverMenuOpen) setServerMenuOpen(false);
                                }}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6C5CE7" />}
                            >
                                {messagesQuery.isLoading && feedItems.length === 0 && (
                                    <View style={{ padding: 16 }}>
                                        {Array.from({ length: 5 }).map((_, i) => <MessageSkeleton key={`msg-sk-${i}`} />)}
                                    </View>
                                )}
                                {messagesQuery.isError && feedItems.length === 0 && (
                                    <ErrorRetry message="Failed to load messages" onRetry={() => messagesQuery.refetch()} loading={messagesQuery.isRefetching} />
                                )}
                                {infiniteMessagesQuery.hasNextPage && (
                                    <TouchableOpacity
                                        onPress={() => infiniteMessagesQuery.fetchNextPage()}
                                        disabled={infiniteMessagesQuery.isFetchingNextPage}
                                        style={{ alignItems: 'center', paddingVertical: 12 }}
                                    >
                                        {infiniteMessagesQuery.isFetchingNextPage ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Load earlier messages</Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                                {feedItems.length === 0 && feedSearchQuery.trim() && (
                                    <View style={styles.welcomeCard}>
                                        <View style={styles.welcomeIcon}>
                                            <SearchX size={32} color={colors.textMuted} />
                                        </View>
                                        <Text style={styles.welcomeTitle}>No results found</Text>
                                        <Text style={styles.welcomeSubtitle}>No messages or posts match "{feedSearchQuery}"</Text>
                                        <TouchableOpacity
                                            style={styles.editChannelBtn}
                                            onPress={() => setFeedSearchQuery('')}
                                        >
                                            <X size={14} color={colors.text} />
                                            <Text style={styles.editChannelText}>Clear search</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {feedItems.length === 0 && !feedSearchQuery.trim() && (
                                    <View style={styles.welcomeCard}>
                                        <View style={styles.welcomeIcon}>
                                            {activeChannel?.visibility === 'admin' ? <Lock size={32} color={colors.textMuted} /> : <Image source={require('../assets/icon.png')} style={{ width: 32, height: 32, borderRadius: 6 }} />}
                                        </View>
                                        <Text style={styles.welcomeTitle}>Welcome to {activeChannel?.name || 'general'}</Text>
                                        <Text style={styles.welcomeSubtitle}>This is the start of the {activeChannel?.name || 'general'} channel.</Text>
                                        <TouchableOpacity
                                            style={styles.editChannelBtn}
                                            onPress={() => {
                                                if (activeChannel) {
                                                    openEditChannelModal(activeChannel);
                                                }
                                            }}
                                        >
                                            <Edit size={14} color={colors.text} />
                                            <Text style={styles.editChannelText}>Edit Channel</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {feedItems.map((item: any) => {
                                    // Messages have 'kind' field (text, emoji, sticker, audio), posts don't
                                    const isPost = !item.kind;
                                    const authorId = item.authorId || item.senderId;
                                    const authorName = getAuthorName(authorId, members);
                                    const authorMember = members.find((member) =>
                                        String(member.userId) === String(authorId) || String(member.user?._id) === String(authorId) || String(member._id) === String(authorId)
                                    );
                                    const likeCount = item.likeCount ?? 0;
                                    const commentCount = item.commentCount ?? 0;
                                    const reshareCount = item.reshareCount ?? 0;
                                    const userLiked = item.userLiked ?? false;
                                    const userReshared = item.userReshared ?? false;
                                    return (
                                        <View key={item._id} style={styles.postCard}>
                                            <View style={styles.postHeader}>
                                                <UserAvatar
                                                    uri={getMemberAvatarUrl(authorMember)}
                                                    name={authorName}
                                                    style={styles.postAvatar}
                                                />
                                                <View style={styles.postHeaderInfo}>
                                                    <View style={styles.postAuthorRow}>
                                                        <Text style={styles.postAuthor}>{authorName}</Text>
                                                        {isMemberAdmin(authorMember) && (
                                                            <View style={styles.verifiedBadge}>
                                                                <BadgeCheck size={14} color="#3B82F6" />
                                                            </View>
                                                        )}
                                                        <Text style={styles.postHandle}>
                                                            @{getMemberDisplayUsername(authorMember) || String(authorId).slice(-8)}
                                                        </Text>
                                                        {getMemberBadge(authorMember) && (
                                                            <View style={[styles.stakeholderBadgeSmall, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getMemberBadge(authorMember)!] }]}>
                                                                <Text style={styles.stakeholderBadgeSmallText}>
                                                                    {getMemberBadge(authorMember)}
                                                                </Text>
                                                            </View>
                                                        )}
                                                        {authorMember?.customRole && (
                                                            <View style={[styles.roleBadge, { backgroundColor: authorMember.customRole.color + '20', borderColor: authorMember.customRole.color }]}>
                                                                <Text style={[styles.roleBadgeText, { color: authorMember.customRole.color }]}>{authorMember.customRole.name}</Text>
                                                            </View>
                                                        )}
                                                        <View style={styles.feedMetaRow}>
                                                            <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
                                                            {String(item.senderId || item.authorId) === String(userId) && (
                                                                item._status === 'failed' ? (
                                                                    <TouchableOpacity onPress={() => handleRetryMessage(item)} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                                        <AlertCircle size={12} color={colors.dangerText} />
                                                                        <Text style={{ fontSize: 10, color: colors.dangerText, marginLeft: 2 }}>Retry</Text>
                                                                    </TouchableOpacity>
                                                                ) : item._isPending || isTempId(item._id) ? (
                                                                    <Clock size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                                                                ) : (
                                                                    <CheckCheck size={12} color="#22C55E" style={{ marginLeft: 4 }} />
                                                                )
                                                            )}
                                                        </View>
                                                    </View>
                                                    {getMemberCompany(authorMember) && (
                                                        <Text style={styles.postCompany}>{getMemberCompany(authorMember)}</Text>
                                                    )}
                                                </View>
                                                <View style={styles.itemMenuContainer}>
                                                    <TouchableOpacity onPress={(e) => handleOpenItemMenu(e, item, isPost)}>
                                                        <MoreHorizontal size={18} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            {!!item.body && (
                                                <Text style={styles.postBody}>{item.body}</Text>
                                            )}
                                            {item.attachments?.length > 0 && (
                                                <View style={styles.postAttachments}>
                                                    {item.attachments.map((att: any, idx: number) => {
                                                        const attType = att?.type || '';

                                                        // Handle reshare attachments FIRST - they don't have a URL
                                                        if (attType === 'reshare') {
                                                            const reshareData = att;
                                                            const originalAuthorId = reshareData?.originalAuthorId;
                                                            const originalAuthorMember = members.find(m =>
                                                                String(m.userId) === String(originalAuthorId) ||
                                                                String(m.user?._id) === String(originalAuthorId) ||
                                                                String(m._id) === String(originalAuthorId)
                                                            );
                                                            return (
                                                                <View key={`${item._id}-reshare-${idx}`} style={styles.reshareCard}>
                                                                    <View style={styles.reshareHeader}>
                                                                        <Repeat size={14} color={colors.textMuted} />
                                                                        <Text style={styles.reshareLabel}>Reshared</Text>
                                                                    </View>
                                                                    <View style={styles.reshareContent}>
                                                                        <View style={styles.reshareAuthorRow}>
                                                                            <UserAvatar
                                                                                uri={getMemberAvatarUrl(originalAuthorMember)}
                                                                                name={getMemberName(originalAuthorMember || { _id: originalAuthorId })}
                                                                                style={styles.reshareAvatar}
                                                                            />
                                                                            <Text style={styles.reshareAuthorName}>
                                                                                {getMemberName(originalAuthorMember || { _id: originalAuthorId })}
                                                                            </Text>
                                                                            <Text style={styles.reshareTime}>
                                                                                {formatDate(reshareData?.originalCreatedAt)}
                                                                            </Text>
                                                                        </View>
                                                                        {!!reshareData?.originalBody && (
                                                                            <Text style={styles.reshareBody} numberOfLines={3}>
                                                                                {reshareData.originalBody}
                                                                            </Text>
                                                                        )}
                                                                        {/* Render original attachments (images, etc.) */}
                                                                        {reshareData?.originalAttachments?.length > 0 && (
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
                                                                                                cachePolicy="memory-disk"
                                                                                            />
                                                                                        );
                                                                                    }

                                                                                    const isOrigAudio = origType === 'audio' || origType === 'voice' ||
                                                                                        origMime?.startsWith('audio/') ||
                                                                                        /\.(mp3|wav|webm|ogg|m4a|aac)(\?|$)/i.test(origUrl);

                                                                                    if (isOrigAudio) {
                                                                                        return (
                                                                                            <VoiceMessagePlayer
                                                                                                key={`reshare-att-${origIdx}`}
                                                                                                source={origUrl}
                                                                                                durationMs={origAtt?.durationMs}
                                                                                                colors={colors}
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

                                                        const url = att?.value || att?.uri || att?.url || (typeof att === 'string' ? att : null);
                                                        const mimeType = att?.mimeType || '';
                                                        if (!url) return null;

                                                        // Debug logging
                                                        console.log('[CUAdmin] Rendering attachment:', { url: url?.substring(0, 80), attType, mimeType });

                                                        // Determine if it's an image based on type field, mimeType, or URL pattern
                                                        // Check URL for image extensions (handle Cloudinary URLs which may have params)
                                                        const isImage = attType === 'image' || attType === 'sticker' || attType === 'emoji' ||
                                                            mimeType?.startsWith('image/') ||
                                                            /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(url);

                                                        // Handle image attachments - check this FIRST before video
                                                        if (isImage) {
                                                            return (
                                                                <Image
                                                                    key={`${item._id}-att-${idx}`}
                                                                    source={{ uri: url }}
                                                                    style={styles.postImage}
                                                                    resizeMode="contain"
                                                                    cachePolicy="memory-disk"
                                                                />
                                                            );
                                                        }

                                                        // Handle audio/voice attachments BEFORE video (Chrome may report video/webm mimeType for audio-only recordings)
                                                        const isAudio = attType === 'audio' || attType === 'voice' ||
                                                            mimeType?.startsWith('audio/') ||
                                                            /\.(mp3|wav|webm|ogg|m4a|aac)(\?|$)/i.test(url);
                                                        if (isAudio) {
                                                            return (
                                                                <VoiceMessagePlayer
                                                                    key={`${item._id}-att-${idx}`}
                                                                    source={url}
                                                                    durationMs={att?.durationMs}
                                                                    colors={colors}
                                                                />
                                                            );
                                                        }

                                                        // Handle video attachments (after audio check to avoid misclassifying voice notes)
                                                        const isVideo = attType === 'video' ||
                                                            mimeType?.startsWith('video/') ||
                                                            /\.(mp4|mov|avi|mkv)(\?|$)/i.test(url);
                                                        if (isVideo) {
                                                            return (
                                                                <View key={`${item._id}-att-${idx}`} style={styles.videoPlaceholder}>
                                                                    <PlayCircle size={48} color="#FFFFFF" />
                                                                    <Text style={styles.videoLabel}>Video</Text>
                                                                </View>
                                                            );
                                                        }

                                                        // Handle file attachments
                                                        return (
                                                            <View key={`${item._id}-att-${idx}`} style={styles.fileAttachment}>
                                                                <File size={20} color={colors.textMuted} />
                                                                <Text style={styles.fileLabel} numberOfLines={1}>{att?.fileName || att?.label || 'File'}</Text>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                            {/* Show reactions for all feed items (posts and messages) */}
                                            <View style={styles.postStats}>
                                                <TouchableOpacity style={styles.statItem} onPress={() => handleCommentPress(item._id, isPost)}>
                                                    <MessageCircle size={16} color={colors.textMuted} />
                                                    <Text style={styles.statText}>{commentCount}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.statItem} onPress={() => handleLikeItem(item._id, isPost)}>
                                                    <Heart size={16} color={userLiked ? colors.dangerText : colors.textMuted} />
                                                    <Text style={[styles.statText, userLiked && { color: colors.dangerText }]}>{likeCount}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.statItem} onPress={() => handleReshareItem(item._id, isPost)}>
                                                    <Repeat size={16} color={userReshared ? colors.successText : colors.textMuted} />
                                                    <Text style={[styles.statText, userReshared && { color: colors.successText }]}>{reshareCount}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            {/* Typing Indicator */}
                            {typingUsers.size > 0 && (
                                <View style={styles.typingContainer}>
                                    <Text style={[styles.typingText, { color: colors.textMuted }]}>
                                        {typingUsers.size === 1
                                            ? `${(() => {
                                                const tid = [...typingUsers][0];
                                                const m = members.find((mb: any) => String(mb.userId || mb.user?._id || mb._id) === tid);
                                                return m ? getMemberName(m) : 'Someone';
                                            })()} is typing`
                                            : `${typingUsers.size} people typing`}...
                                    </Text>
                                </View>
                            )}

                            {/* Attachment Preview */}
                            {attachments.length > 0 && (
                                <View style={styles.attachmentPreview}>
                                    {attachments.map((attachment, index) => (
                                        <View key={index} style={styles.attachmentItem}>
                                            {attachment.type.startsWith('image/') ? (
                                                <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} cachePolicy="memory-disk" />
                                            ) : (
                                                <View style={styles.attachmentFileIcon}>
                                                    <File size={24} color={colors.textMuted} />
                                                </View>
                                            )}
                                            <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
                                            <TouchableOpacity style={styles.attachmentRemove} onPress={() => handleRemoveAttachment(index)}>
                                                <X size={16} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Recording UI */}
                            {isRecording ? (
                                <View style={[styles.recordingContainer, isMobile && { marginBottom: Math.max(insets.bottom, 12) }]}>
                                    <View style={styles.recordingIndicator}>
                                        <View style={styles.recordingDot} />
                                        <Text style={styles.recordingText}>Recording {formatRecordingTime(recordingDuration)}</Text>
                                    </View>
                                    <View style={styles.recordingActions}>
                                        <TouchableOpacity style={styles.recordingCancelBtn} onPress={handleCancelRecording}>
                                            <Trash2 size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.recordingStopBtn} onPress={handleStopRecording}>
                                            <Square size={20} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                /* Message Input */
                                <View style={[styles.messageInputContainer, isMobile && { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
                                    <View style={styles.messageInputLeft}>
                                        <TouchableOpacity style={styles.inputIcon} onPress={handlePickImage}>
                                            <PlusCircle size={22} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.messageInputMiddle}>
                                        <TextInput
                                            style={styles.messageInput}
                                            placeholder={`Message #${activeChannel?.name || 'general'}`}
                                            placeholderTextColor={colors.textSubtle}
                                            value={messageDraft}
                                            onChangeText={handleDraftChange}
                                            multiline
                                        />
                                        <View style={styles.messageInputActions}>
                                            {/* Attach button - always visible */}
                                            <TouchableOpacity style={styles.inputActionIcon} onPress={handlePickFile}>
                                                <Paperclip size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            {/* Emoji and mic buttons - only on web (mobile uses native keyboard emoji) */}
                                            {Platform.OS === 'web' && (
                                                <>
                                                    <TouchableOpacity style={styles.inputActionIcon} onPress={() => setShowEmojiPicker(true)}>
                                                        <Smile size={20} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.inputActionIcon} onPress={handleStartRecording}>
                                                        <Mic size={20} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                            {/* Send button - always visible on mobile */}
                                            <TouchableOpacity
                                                style={[
                                                    styles.sendBtn,
                                                    !(messageDraft.trim() || attachments.length > 0) && styles.sendBtnDisabled
                                                ]}
                                                onPress={handleSendMessage}
                                                disabled={!(messageDraft.trim() || attachments.length > 0)}
                                            >
                                                <Send size={18} color={(messageDraft.trim() || attachments.length > 0) ? colors.glassActiveText : colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {/* Voice recording button - only on mobile when no content */}
                                    {Platform.OS !== 'web' && !(messageDraft.trim() || attachments.length > 0) && (
                                        <TouchableOpacity style={styles.voiceMicBtn} onPress={handleStartRecording}>
                                            <Mic size={22} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </>
                    )}
                        </>
                    )}
                </View>
                </KeyboardAvoidingView>
                )}

                {/* Members Sidebar */}
                {!isMobile && showMembersSidebar && (
                    <View style={styles.membersSidebar}>
                        <Text style={styles.membersTitle}>Members</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {members.map((member, index) => (
                                <View key={member._id || index} style={styles.memberItem}>
                                    <View style={styles.memberAvatarContainer}>
                                        <UserAvatar
                                            uri={getMemberAvatarUrl(member)}
                                            name={getMemberName(member)}
                                            style={styles.memberAvatar}
                                        />
                                        {memberOnlineStatuses[member.userId || member.user?._id || member._id || ''] && <View style={styles.memberOnline} />}
                                    </View>
                                    <Text style={styles.memberName}>{getMemberName(member)}</Text>
                                </View>
                            ))}
                            {members.length === 0 && (
                                <Text style={styles.emptyText}>No members yet</Text>
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>


            {/* Assign Role Modal */}
            <Modal visible={assignRoleModalOpen} transparent animationType="fade" onRequestClose={() => setAssignRoleModalOpen(false)}>
                <View style={[styles.modalOverlay, { zIndex: 9999 }]}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => { setAssignRoleModalOpen(false); setAssigningMember(null); }}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Assign Role</Text>
                        {assigningMember && (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                                    <UserAvatar userId={assigningMember.userId} userName={assigningMember.userName} size={40} />
                                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{assigningMember.userName}</Text>
                                </View>

                                <Text style={styles.modalLabel}>SELECT ROLE</Text>
                                <ScrollView style={{ maxHeight: 200 }}>
                                    <TouchableOpacity
                                        style={[styles.roleSelectItem, !assigningMember.customRole && styles.roleSelectItemActive]}
                                        onPress={() => handleAssignRole(assigningMember.userId || assigningMember._id, null)}
                                    >
                                        <View style={[styles.roleColor, { backgroundColor: colors.textMuted }]} />
                                        <Text style={styles.roleName}>No Role</Text>
                                        {!assigningMember.customRole && <Check size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                                    </TouchableOpacity>
                                    {customRoles.map((role) => (
                                        <TouchableOpacity
                                            key={role._id}
                                            style={[styles.roleSelectItem, assigningMember.customRole?._id === role._id && styles.roleSelectItemActive]}
                                            onPress={() => handleAssignRole(assigningMember.userId || assigningMember._id, role._id)}
                                        >
                                            <View style={[styles.roleColor, { backgroundColor: role.color }]} />
                                            <Text style={styles.roleName}>{role.name}</Text>
                                            {assigningMember.customRole?._id === role._id && <Check size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Create Channel Modal */}
            <Modal visible={createChannelModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setCreateChannelModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Create Channel</Text>

                        <Text style={styles.modalLabel}>CHANNEL TYPE</Text>
                        <TouchableOpacity
                            style={[styles.typeOption, newChannelType === 'text' && styles.typeOptionActive]}
                            onPress={() => setNewChannelType('text')}
                        >
                            <View style={styles.radioOuter}>
                                {newChannelType === 'text' && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.typeIcon}>
                                <Image source={require('../assets/icon.png')} style={{ width: 20, height: 20, borderRadius: 4 }} />
                            </View>
                            <View style={styles.typeInfo}>
                                <Text style={styles.typeTitle}>Text</Text>
                                <Text style={styles.typeDesc}>Send messages, images, GIFs, emoji, opinions, and puns</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeOption, newChannelType === 'voice' && styles.typeOptionActive]}
                            onPress={() => setNewChannelType('voice')}
                        >
                            <View style={styles.radioOuter}>
                                {newChannelType === 'voice' && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.typeIcon}>
                                <Headphones size={20} color={colors.textMuted} />
                            </View>
                            <View style={styles.typeInfo}>
                                <Text style={styles.typeTitle}>Voice</Text>
                                <Text style={styles.typeDesc}>Hang out together with voice, video, and screen share</Text>
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.modalLabel}>CHANNEL NAME</Text>
                        <View style={styles.inputRow}>
                            <Image source={require('../assets/icon.png')} style={{ width: 18, height: 18, borderRadius: 3 }} />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="new-channel"
                                placeholderTextColor={colors.textSubtle}
                                value={newChannelName}
                                onChangeText={setNewChannelName}
                            />
                        </View>

                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <Lock size={16} color={colors.textMuted} />
                                <View>
                                    <Text style={styles.toggleTitle}>Private Channel</Text>
                                    <Text style={styles.toggleDesc}>Only selected members can view</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.toggle, isPrivateChannel && styles.toggleActive]}
                                onPress={() => setIsPrivateChannel(!isPrivateChannel)}
                            >
                                <View style={[styles.toggleKnob, isPrivateChannel && styles.toggleKnobActive]} />
                            </TouchableOpacity>
                        </View>

                        {categories.length > 0 && (
                            <>
                                <Text style={styles.modalLabel}>CATEGORY (OPTIONAL)</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                    <TouchableOpacity
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 7,
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: !newChannelCategoryId ? colors.primary : colors.glassBorder,
                                            backgroundColor: !newChannelCategoryId ? colors.primary + '18' : 'transparent',
                                        }}
                                        onPress={() => setNewChannelCategoryId('')}
                                    >
                                        <Text style={{ fontSize: 13, color: !newChannelCategoryId ? colors.primary : colors.textMuted }}>None</Text>
                                    </TouchableOpacity>
                                    {categories.map((cat) => (
                                        <TouchableOpacity
                                            key={cat._id}
                                            style={{
                                                paddingHorizontal: 14,
                                                paddingVertical: 7,
                                                borderRadius: 16,
                                                borderWidth: 1,
                                                borderColor: newChannelCategoryId === cat._id ? colors.primary : colors.glassBorder,
                                                backgroundColor: newChannelCategoryId === cat._id ? colors.primary + '18' : 'transparent',
                                            }}
                                            onPress={() => setNewChannelCategoryId(cat._id)}
                                        >
                                            <Text style={{ fontSize: 13, color: newChannelCategoryId === cat._id ? colors.primary : colors.textMuted }}>{cat.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateChannelModalOpen(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createBtn} onPress={handleCreateChannel}>
                                <Text style={styles.createBtnText}>Create Channel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Channel Modal */}
            <Modal visible={editChannelModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setEditChannelModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Edit Channel</Text>

                        <Text style={styles.modalLabel}>CHANNEL TYPE</Text>
                        <TouchableOpacity
                            style={[styles.typeOption, editChannelType === 'text' && styles.typeOptionActive]}
                            onPress={() => setEditChannelType('text')}
                        >
                            <View style={styles.radioOuter}>
                                {editChannelType === 'text' && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.typeIcon}>
                                <Image source={require('../assets/icon.png')} style={{ width: 20, height: 20, borderRadius: 4 }} />
                            </View>
                            <View style={styles.typeInfo}>
                                <Text style={styles.typeTitle}>Text</Text>
                                <Text style={styles.typeDesc}>Send messages, images, GIFs, emoji, opinions, and puns</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeOption, editChannelType === 'voice' && styles.typeOptionActive]}
                            onPress={() => setEditChannelType('voice')}
                        >
                            <View style={styles.radioOuter}>
                                {editChannelType === 'voice' && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.typeIcon}>
                                <Headphones size={20} color={colors.textMuted} />
                            </View>
                            <View style={styles.typeInfo}>
                                <Text style={styles.typeTitle}>Voice</Text>
                                <Text style={styles.typeDesc}>Hang out together with voice, video, and screen share</Text>
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.modalLabel}>CHANNEL NAME</Text>
                        <View style={styles.inputRow}>
                            <Image source={require('../assets/icon.png')} style={{ width: 18, height: 18, borderRadius: 3 }} />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="channel-name"
                                placeholderTextColor={colors.textSubtle}
                                value={editChannelName}
                                onChangeText={setEditChannelName}
                            />
                        </View>

                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <Lock size={16} color={colors.textMuted} />
                                <View>
                                    <Text style={styles.toggleTitle}>Private Channel</Text>
                                    <Text style={styles.toggleDesc}>Only selected members can view</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.toggle, editChannelPrivate && styles.toggleActive]}
                                onPress={() => setEditChannelPrivate(!editChannelPrivate)}
                            >
                                <View style={[styles.toggleKnob, editChannelPrivate && styles.toggleKnobActive]} />
                            </TouchableOpacity>
                        </View>

                        {categories.length > 0 && (
                            <>
                                <Text style={styles.modalLabel}>CATEGORY (OPTIONAL)</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                    <TouchableOpacity
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 7,
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: !editChannelCategoryId ? colors.primary : colors.glassBorder,
                                            backgroundColor: !editChannelCategoryId ? colors.primary + '18' : 'transparent',
                                        }}
                                        onPress={() => setEditChannelCategoryId('')}
                                    >
                                        <Text style={{ fontSize: 13, color: !editChannelCategoryId ? colors.primary : colors.textMuted }}>None</Text>
                                    </TouchableOpacity>
                                    {categories.map((cat) => (
                                        <TouchableOpacity
                                            key={cat._id}
                                            style={{
                                                paddingHorizontal: 14,
                                                paddingVertical: 7,
                                                borderRadius: 16,
                                                borderWidth: 1,
                                                borderColor: editChannelCategoryId === cat._id ? colors.primary : colors.glassBorder,
                                                backgroundColor: editChannelCategoryId === cat._id ? colors.primary + '18' : 'transparent',
                                            }}
                                            onPress={() => setEditChannelCategoryId(cat._id)}
                                        >
                                            <Text style={{ fontSize: 13, color: editChannelCategoryId === cat._id ? colors.primary : colors.textMuted }}>{cat.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditChannelModalOpen(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createBtnBlack} onPress={handleUpdateChannel}>
                                <Text style={styles.createBtnBlackText}>Update Channel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Channel Settings Modal */}
            <Modal visible={channelSettingsModalOpen} transparent animationType="fade">
                <Pressable
                    style={styles.channelSettingsOverlay}
                    onPress={() => setChannelSettingsModalOpen(false)}
                >
                    <Pressable
                        style={styles.channelSettingsModal}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={styles.channelSettingsTitle}>
                            {selectedSettingsChannel?.name || 'Channel'} Settings
                        </Text>
                        <TouchableOpacity
                            style={styles.channelSettingsItem}
                            onPress={() => {
                                if (selectedSettingsChannel) openEditChannelModal(selectedSettingsChannel);
                            }}
                        >
                            <Edit size={18} color="#9CA3AF" />
                            <Text style={styles.channelSettingsText}>Edit Channel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.channelSettingsItem}
                            onPress={() => {
                                if (selectedSettingsChannel) {
                                    setChannelSettingsModalOpen(false);
                                    handleDeleteChannel(selectedSettingsChannel._id, selectedSettingsChannel.name);
                                }
                            }}
                        >
                            <Trash2 size={18} color={colors.dangerText} />
                            <Text style={[styles.channelSettingsText, { color: colors.dangerText }]}>Delete Channel</Text>
                        </TouchableOpacity>
                        {selectedSettingsChannel?.visibility === 'admin' && (
                            <TouchableOpacity
                                style={styles.channelSettingsItem}
                                onPress={() => {
                                    if (selectedSettingsChannel) openChannelMembersModal(selectedSettingsChannel);
                                }}
                            >
                                <Users size={18} color="#9CA3AF" />
                                <Text style={styles.channelSettingsText}>Manage Members</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.channelSettingsItem}
                            onPress={() => {
                                if (selectedSettingsChannel) openChannelPermissionModal(selectedSettingsChannel);
                            }}
                        >
                            <Settings size={18} color="#9CA3AF" />
                            <Text style={styles.channelSettingsText}>Channel Permission</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.channelSettingsItem, styles.channelSettingsCancel]}
                            onPress={() => setChannelSettingsModalOpen(false)}
                        >
                            <Text style={styles.channelSettingsCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Channel Permission Modal */}
            <Modal visible={channelPermissionModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.permissionModalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setChannelPermissionModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Channel Permission</Text>

                        <View style={styles.permissionList}>
                            {permissionOptions.map((option) => {
                                const isChecked = channelPermissions[option.key];
                                return (
                                    <TouchableOpacity
                                        key={option.key}
                                        style={styles.permissionRow}
                                        onPress={() => toggleChannelPermission(option.key)}
                                    >
                                        {isChecked ? (
                                            <Check size={18} color={colors.text} />
                                        ) : (
                                            <Square size={18} color={colors.textMuted} />
                                        )}
                                        <Text style={styles.permissionLabel}>{option.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setChannelPermissionModalOpen(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createBtnBlack} onPress={handleSaveChannelPermissions}>
                                <Text style={styles.createBtnBlackText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Channel Members Modal */}
            <Modal visible={channelMembersModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setChannelMembersModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Manage Channel Members</Text>
                        <Text style={styles.modalSubtitle}>Add or remove members who can access this private channel</Text>

                        <Text style={styles.modalLabel}>ADD MEMBER</Text>
                        <View style={styles.inputRow}>
                            <Search size={18} color={colors.textMuted} />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Search members..."
                                placeholderTextColor={colors.textSubtle}
                                value={addMemberSearchQuery}
                                onChangeText={setAddMemberSearchQuery}
                            />
                        </View>

                        <ScrollView style={{ maxHeight: 150, marginBottom: 12 }} showsVerticalScrollIndicator={false}>
                            {members
                                .filter((m: any) => {
                                    const memberId = m.userId || m.user?._id || m._id;
                                    const isAlreadyMember = channelMembers.some((cm: any) => String(cm._id || cm.userId) === String(memberId));
                                    if (isAlreadyMember) return false;
                                    if (!addMemberSearchQuery.trim()) return true;
                                    const name = getMemberName(m).toLowerCase();
                                    const email = (m.email || m.user?.email || '').toLowerCase();
                                    return name.includes(addMemberSearchQuery.toLowerCase()) || email.includes(addMemberSearchQuery.toLowerCase());
                                })
                                .slice(0, 20)
                                .map((m: any) => {
                                    const memberId = m.userId || m.user?._id || m._id;
                                    const memberRole = m.role || m.user?.role || 'member';
                                    return (
                                        <TouchableOpacity
                                            key={memberId}
                                            style={styles.permissionRow}
                                            onPress={() => handleAddChannelMember(memberId)}
                                        >
                                            <UserPlus size={16} color={colors.primary} />
                                            <View style={{ flex: 1, marginLeft: 8 }}>
                                                <Text style={styles.permissionLabel}>{getMemberName(m)}</Text>
                                                {memberRole !== 'member' && (
                                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                                                        {memberRole === 'subgrid_admin' ? 'CU Admin' : memberRole === 'stakeholder' ? 'Stakeholder' : memberRole}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            {members.filter((m: any) => {
                                const memberId = m.userId || m.user?._id || m._id;
                                return !channelMembers.some((cm: any) => String(cm._id || cm.userId) === String(memberId));
                            }).length === 0 && (
                                <Text style={styles.emptyText}>All members have been added</Text>
                            )}
                        </ScrollView>

                        <Text style={styles.modalLabel}>CURRENT MEMBERS ({channelMembers.length})</Text>
                        <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                            {channelMembers.length === 0 ? (
                                <Text style={styles.emptyText}>No members added yet</Text>
                            ) : (
                                channelMembers.map((member: any) => {
                                    const memberId = member._id || member.userId;
                                    const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || member.username || 'Unknown';
                                    const role = member.memberRole || 'member';
                                    return (
                                        <View key={memberId} style={[styles.permissionRow, { justifyContent: 'space-between' }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.permissionLabel}>{name}</Text>
                                                {role !== 'member' && (
                                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                                                        {role === 'subgrid_admin' ? 'CU Admin' : role === 'stakeholder' ? 'Stakeholder' : role}
                                                    </Text>
                                                )}
                                            </View>
                                            <TouchableOpacity onPress={() => handleRemoveChannelMember(memberId)}>
                                                <XCircle size={20} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.createBtn} onPress={() => setChannelMembersModalOpen(false)}>
                                <Text style={styles.createBtnText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Invite Member Modal */}
            <Modal visible={inviteModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setInviteModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={styles.modalIconWrap}>
                            <Award size={28} color={colors.primary} />
                            <View style={[styles.modalIconBadge, { backgroundColor: colors.primary }]}>
                                <Plus size={10} color={colors.glassActiveText} />
                            </View>
                        </View>
                        <Text style={styles.modalTitle}>Invite Stakeholder</Text>
                        <Text style={styles.modalSubtitle}>Stakeholders get special badges and permissions</Text>

                        <Text style={styles.modalLabel}>Stakeholder Email</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="stakeholder@example.com"
                            placeholderTextColor={colors.textSubtle}
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <Text style={[styles.modalLabel, { marginTop: 16 }]}>Select Badge Type</Text>
                        <View style={styles.badgeOptionsRow}>
                            {(['vendor', 'partner', 'sponsor', 'investor'] as StakeholderBadge[]).map((badge) => {
                                const badgeColors: Record<StakeholderBadge, string> = {
                                    stakeholder: '#3B82F6',
                                    vendor: '#8B5CF6',
                                    partner: '#10B981',
                                    sponsor: '#F59E0B',
                                    investor: '#EC4899',
                                };
                                const isSelected = selectedStakeholderBadge === badge;
                                return (
                                    <TouchableOpacity
                                        key={badge}
                                        style={[
                                            styles.badgeOption,
                                            isSelected && { borderColor: badgeColors[badge], borderWidth: 2 },
                                        ]}
                                        onPress={() => setSelectedStakeholderBadge(badge)}
                                    >
                                        <View style={[styles.badgePreview, { backgroundColor: badgeColors[badge] }]}>
                                            <Text style={styles.badgePreviewText}>
                                                {badge.charAt(0).toUpperCase() + badge.slice(1)}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <View style={[styles.badgeCheckmark, { backgroundColor: badgeColors[badge] }]}>
                                                <Check size={10} color="#FFFFFF" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            style={[styles.inviteBtn, invitingStakeholder && styles.inviteBtnDisabled]}
                            onPress={handleInviteStakeholder}
                            disabled={invitingStakeholder || !inviteEmail.trim()}
                        >
                            <Text style={styles.inviteBtnText}>
                                {invitingStakeholder ? 'Sending...' : 'Send Invite'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>Members join via invite code</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <Text style={styles.linkLabel}>Server invite code for members</Text>
                        <View style={styles.inputWithBtn}>
                            <TextInput
                                style={[styles.modalInputFlex, styles.disabledInput]}
                                value={activeSubgrid?.inviteCode || activeSubgridId?.slice(-8) || 'XXXXXXXX'}
                                editable={false}
                            />
                            <TouchableOpacity style={styles.actionBtn} onPress={handleCopyInviteLink}>
                                <Text style={styles.actionBtnText}>Copy</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Create Category Modal */}
            <Modal visible={createCategoryModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setCreateCategoryModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Create Category</Text>

                        <Text style={styles.categoryLabel}>Category Name</Text>
                        <View style={styles.categoryInputRow}>
                            <TextInput
                                style={styles.categoryInput}
                                placeholder="New Category"
                                placeholderTextColor={colors.textSubtle}
                                value={newCategoryName}
                                onChangeText={setNewCategoryName}
                            />
                            <TouchableOpacity>
                                <Smile size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.privateCategoryRow}>
                            <Lock size={18} color={colors.text} />
                            <Text style={styles.privateCategoryTitle}>Private Category</Text>
                            <TouchableOpacity
                                style={[styles.toggle, isPrivateCategory && styles.toggleActive]}
                                onPress={() => setIsPrivateCategory(!isPrivateCategory)}
                            >
                                <View style={[styles.toggleKnob, isPrivateCategory && styles.toggleKnobActive]} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.privateCategoryDesc}>
                            By making a category private, only select members and roles will be able to view this category. Linked channels in this category will automatically match to this setting.
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateCategoryModalOpen(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createBtnBlack} onPress={handleCreateCategory}>
                                <Text style={styles.createBtnBlackText}>Create Category</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Create Event Modal */}
            <Modal visible={createEventModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setCreateEventModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>{newEventType === 'announcement' ? 'Create Announcement' : 'Create Event'}</Text>

                        <Text style={styles.modalLabel}>TYPE</Text>
                        <View style={styles.eventTypeSelector}>
                            <TouchableOpacity
                                style={[styles.eventTypeOption, newEventType === 'event' && styles.eventTypeOptionActive]}
                                onPress={() => setNewEventType('event')}
                            >
                                <Calendar size={18} color={newEventType === 'event' ? colors.glassActiveText : colors.textMuted} />
                                <Text style={[styles.eventTypeOptionText, newEventType === 'event' && styles.eventTypeOptionTextActive]}>Event</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.eventTypeOption, newEventType === 'announcement' && styles.eventTypeOptionActive]}
                                onPress={() => setNewEventType('announcement')}
                            >
                                <Megaphone size={18} color={newEventType === 'announcement' ? colors.glassActiveText : colors.textMuted} />
                                <Text style={[styles.eventTypeOptionText, newEventType === 'announcement' && styles.eventTypeOptionTextActive]}>Announcement</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalLabel}>{newEventType === 'announcement' ? 'ANNOUNCEMENT TITLE' : 'EVENT TITLE'}</Text>
                        <View style={styles.inputRow}>
                            {newEventType === 'announcement' ? <Megaphone size={18} color={colors.textMuted} /> : <Calendar size={18} color={colors.textMuted} />}
                            <TextInput
                                style={styles.modalInput}
                                placeholder={newEventType === 'announcement' ? 'Announcement Title' : 'Event Title'}
                                placeholderTextColor={colors.textSubtle}
                                value={newEventTitle}
                                onChangeText={setNewEventTitle}
                            />
                        </View>

                        <Text style={styles.modalLabel}>DESCRIPTION</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder={newEventType === 'announcement' ? 'Announcement details...' : 'Event description...'}
                            placeholderTextColor={colors.textSubtle}
                            value={newEventDescription}
                            onChangeText={setNewEventDescription}
                            multiline
                            numberOfLines={3}
                        />

                        <Text style={styles.modalLabel}>{newEventType === 'announcement' ? 'DATE (Optional)' : 'DATE'}</Text>
                        <View style={styles.inputRow}>
                            <Clock size={18} color={colors.textMuted} />
                            <TextInput
                                style={styles.modalInput}
                                placeholder={newEventType === 'announcement' ? 'YYYY-MM-DD HH:MM (optional)' : 'YYYY-MM-DD HH:MM'}
                                placeholderTextColor={colors.textSubtle}
                                value={newEventDate}
                                onChangeText={setNewEventDate}
                            />
                        </View>

                        {newEventType === 'event' && (
                            <>
                                <Text style={styles.modalLabel}>LOCATION (Optional)</Text>
                                <View style={styles.inputRow}>
                                    <MapPin size={18} color={colors.textMuted} />
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Event location..."
                                        placeholderTextColor={colors.textSubtle}
                                        value={newEventLocation}
                                        onChangeText={setNewEventLocation}
                                    />
                                </View>
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateEventModalOpen(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createBtn} onPress={handleCreateEvent}>
                                <Text style={styles.createBtnText}>{newEventType === 'announcement' ? 'Create Announcement' : 'Create Event'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Server Settings Full Page Modal */}
            <Modal visible={serverSettingsModalOpen} transparent animationType="fade" onRequestClose={() => { setServerSettingsModalOpen(false); setMobileShowSettingsContent(false); }}>
                <View style={[styles.settingsFullPage, isMobile && styles.settingsFullPageMobile]}>
                    {/* Settings Sidebar - full width on mobile, hidden when viewing content */}
                    {(!isMobile || !mobileShowSettingsContent) && (
                    <View style={[styles.settingsSidebar, isMobile && styles.settingsSidebarMobile]}>
                        <View style={[styles.settingsSidebarHeader, isMobile && { paddingTop: insets.top + 12 }]}>
                            <Image source={require('../assets/icon.png')} style={{ width: 16, height: 16, borderRadius: 3 }} />
                            <Text style={styles.settingsSidebarTitle}>THE GRYD</Text>
                            {isMobile && (
                                <TouchableOpacity style={styles.settingsMobileCloseBtn} onPress={() => { setServerSettingsModalOpen(false); setMobileShowSettingsContent(false); }}>
                                    <X size={20} color="#EF4444" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <Text style={styles.settingsSectionLabel}>{activeSubgrid?.name || 'My Server'}</Text>

                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'server-profile' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('server-profile'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'server-profile' && styles.settingsNavTextActive]}>Server Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'engagement' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('engagement'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'engagement' && styles.settingsNavTextActive]}>Engagement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'members' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('members'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'members' && styles.settingsNavTextActive]}>Members</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'stakeholders' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('stakeholders'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'stakeholders' && styles.settingsNavTextActive]}>Stakeholders</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'roles' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('roles'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'roles' && styles.settingsNavTextActive]}>Roles & Permissions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'invites' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('invites'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'invites' && styles.settingsNavTextActive]}>Invites</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'bans' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('bans'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'bans' && styles.settingsNavTextActive]}>Ban Members</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'content-moderation' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('content-moderation'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'content-moderation' && styles.settingsNavTextActive]}>Content Moderation</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'partnerships' && styles.settingsNavItemActive]}
                            onPress={() => { setSettingsTab('partnerships'); if (isMobile) setMobileShowSettingsContent(true); }}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'partnerships' && styles.settingsNavTextActive]}>Partnerships</Text>
                        </TouchableOpacity>
                    </View>
                    )}

                    {/* Settings Content - full width on mobile, shown when viewing content */}
                    {(!isMobile || mobileShowSettingsContent) && (
                    <View style={[styles.settingsContent, isMobile && styles.settingsContentMobile]}>
                        <View style={[styles.settingsContentHeader, isMobile && [styles.settingsContentHeaderMobile, { paddingTop: insets.top + 12 }]]}>
                            {isMobile && (
                                <TouchableOpacity onPress={() => setMobileShowSettingsContent(false)} style={styles.settingsMobileBackBtn}>
                                    <ArrowLeft size={18} color="#3B82F6" />
                                    <Text style={styles.settingsMobileBackBtnText}>Back</Text>
                                </TouchableOpacity>
                            )}
                            <Text style={[styles.settingsContentTitle, isMobile && { flex: 1 }]}>
                                {settingsTab === 'server-profile' ? 'Server Profile' :
                                 settingsTab === 'engagement' ? 'Engagement' :
                                 settingsTab === 'members' ? 'Members' :
                                 settingsTab === 'stakeholders' ? 'Stakeholders' :
                                 settingsTab === 'roles' ? 'Roles & Permissions' :
                                 settingsTab === 'invites' ? 'Invites' :
                                 settingsTab === 'bans' ? 'Ban Members' :
                                 settingsTab === 'content-moderation' ? 'Content Moderation' :
                                 settingsTab === 'partnerships' ? 'Partnerships' :
                                 'Server Settings'}
                            </Text>
                            <TouchableOpacity style={styles.settingsCloseBtn} onPress={() => { setServerSettingsModalOpen(false); setMobileShowSettingsContent(false); }}>
                                <Text style={styles.settingsCloseBtnText}>Close</Text>
                                <X size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={[styles.settingsScrollContent, isMobile && { paddingHorizontal: 16 }]} showsVerticalScrollIndicator={false}>
                            {/* Server Profile Tab */}
                            {settingsTab === 'server-profile' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Server Profile</Text>
                                    <Text style={styles.settingsPanelDesc}>Customize how your server appears in invite links</Text>

                                    <View style={styles.serverProfileRow}>
                                        <View style={styles.serverProfileForm}>
                                            <Text style={styles.settingsLabel}>Name</Text>
                                            <TextInput
                                                style={styles.settingsInput}
                                                value={serverName || activeSubgrid?.name || 'My Server'}
                                                onChangeText={setServerName}
                                                placeholderTextColor={colors.textSubtle}
                                            />
                                            <Text style={styles.settingsLabel}>Description</Text>
                                            <TextInput
                                                style={styles.settingsInput}
                                                value={serverDescription}
                                                onChangeText={setServerDescription}
                                                placeholder="Describe your server..."
                                                placeholderTextColor={colors.textSubtle}
                                            />

                                            <Text style={styles.settingsLabel}>Icon</Text>
                                            <Text style={styles.settingsHint}>Customize how your server appears in invite links</Text>

                                            <View style={styles.serverProfileInputRow}>
                                                <View style={styles.serverProfileInputCol}>
                                                    <Text style={styles.settingsLabel}>Account Email</Text>
                                                    <TextInput
                                                        style={[styles.settingsInput, styles.settingsInputDisabled]}
                                                        value={accountEmail}
                                                        editable={false}
                                                        placeholderTextColor={colors.textSubtle}
                                                    />
                                                </View>
                                                <View style={styles.serverProfileInputCol}>
                                                    <Text style={styles.settingsLabel}>Server Name</Text>
                                                    <TextInput
                                                        style={styles.settingsInput}
                                                        value={serverName || activeSubgrid?.name || 'Server'}
                                                        onChangeText={setServerName}
                                                        placeholderTextColor={colors.textSubtle}
                                                    />
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.serverPreviewCard}>
                                            <View style={[styles.serverPreviewBanner, { backgroundColor: bannerColors[selectedBanner][0] }]}>
                                                <View style={styles.serverPreviewAvatar}>
                                                    {(serverLogoUrl || activeSubgrid?.logoUrl) ? (
                                                        <Image
                                                            source={{ uri: serverLogoUrl || activeSubgrid?.logoUrl }}
                                                            style={styles.serverPreviewAvatarImage}
                                                            cachePolicy="memory-disk"
                                                        />
                                                    ) : (
                                                        <Text style={styles.serverPreviewAvatarText}>
                                                            {(serverName || activeSubgrid?.name || 'RS')[0]?.toUpperCase()}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                            <View style={styles.serverPreviewInfo}>
                                                <Text style={styles.serverPreviewName}>{serverName || activeSubgrid?.name || 'My Server'}</Text>
                                                <View style={styles.serverPreviewStats}>
                                                    <View style={styles.serverPreviewOnline} />
                                                    <Text style={styles.serverPreviewStatText}>1 Online</Text>
                                                    <Text style={styles.serverPreviewStatText}> • </Text>
                                                    <Text style={styles.serverPreviewStatText}>{members.length || 1} Member{members.length !== 1 ? 's' : ''}</Text>
                                                </View>
                                                <Text style={styles.serverPreviewCreated}>Created Jan 2026</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <Text style={styles.settingsLabel}>Icon</Text>
                                    <Text style={styles.settingsHint}>We recommend an image of at least 512x512.</Text>
                                    <View style={styles.serverIconActions}>
                                        <TouchableOpacity style={styles.changeIconBtn} onPress={handlePickServerIcon} disabled={serverIconUploading}>
                                            <Text style={styles.changeIconBtnText}>
                                                {serverIconUploading ? 'Uploading...' : 'Change Server Icon'}
                                            </Text>
                                        </TouchableOpacity>
                                        {!!(serverLogoUrl || activeSubgrid?.logoUrl) && (
                                            <TouchableOpacity style={styles.removeIconBtn} onPress={handleRemoveServerIcon}>
                                                <Text style={styles.removeIconBtnText}>Remove Icon</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <Text style={styles.settingsLabel}>Banner</Text>
                                    <View style={styles.bannerGrid}>
                                        {bannerColors.map((gradient, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={[
                                                    styles.bannerOption,
                                                    { backgroundColor: gradient[0] },
                                                    selectedBanner === index && styles.bannerOptionSelected
                                                ]}
                                                onPress={() => setSelectedBanner(index)}
                                            />
                                        ))}
                                    </View>

                                    {/* Invite Code Section */}
                                    {activeSubgrid?.inviteCode && (
                                        <View style={styles.inviteCodeSection}>
                                            <Text style={styles.settingsLabel}>Server Invite Code</Text>
                                            <Text style={styles.settingsHint}>Share this code with members to join your server</Text>
                                            <View style={styles.inviteCodeBox}>
                                                <Text style={styles.inviteCodeText}>{activeSubgrid.inviteCode}</Text>
                                                <TouchableOpacity
                                                    style={styles.copyCodeBtn}
                                                    onPress={() => {
                                                        // Copy to clipboard logic
                                                        if (Platform.OS === 'web') {
                                                            navigator.clipboard.writeText(activeSubgrid.inviteCode || '');
                                                        }
                                                        setSuccessModalTitle('Copied!');
                                                        setSuccessModalMessage('Invite code copied to clipboard');
                                                        setSuccessModalOpen(true);
                                                    }}
                                                >
                                                    <Copy size={18} color={colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    <View style={styles.settingsActions}>
                                        <TouchableOpacity style={styles.settingsSaveBtn} onPress={handleUpdateServer}>
                                            <Text style={styles.settingsSaveBtnText}>Save Changes</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Engagement Tab */}
                            {settingsTab === 'engagement' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Engagement</Text>
                                    <Text style={styles.settingsPanelDesc}>Manage settings that keep your server active</Text>

                                    <View style={styles.engagementCard}>
                                        <Text style={styles.engagementSectionTitle}>System Message</Text>
                                        <Text style={styles.engagementSectionDesc}>
                                            Configure a system event message sent to your server.
                                        </Text>

                                        <View style={styles.engagementRow}>
                                            <View style={styles.engagementInfo}>
                                                <Text style={styles.engagementLabel}>
                                                    Send a message when someone joins the server
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.engagementToggle,
                                                    localEngagementSettings.joinMessage && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('joinMessage')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        localEngagementSettings.joinMessage && styles.engagementToggleKnobOn,
                                                    ]}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.engagementDivider} />

                                        <View style={styles.engagementRow}>
                                            <View style={styles.engagementInfo}>
                                                <Text style={styles.engagementLabel}>When uploaded to The Gryd</Text>
                                                <Text style={styles.engagementDesc}>
                                                    Images larger than 10MB will not be previewed.
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.engagementToggle,
                                                    localEngagementSettings.uploadNotice && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('uploadNotice')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        localEngagementSettings.uploadNotice && styles.engagementToggleKnobOn,
                                                    ]}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.engagementSectionDivider} />

                                        <Text style={styles.engagementSectionTitle}>Emoji</Text>
                                        <Text style={styles.engagementSectionDesc}>
                                            Show emoji reactions on messages.
                                        </Text>

                                        <View style={styles.engagementRow}>
                                            <View style={styles.engagementInfo}>
                                                <Text style={styles.engagementLabel}>Emoji</Text>
                                                <Text style={styles.engagementDesc}>Show emoji reactions on messages</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.engagementToggle,
                                                    localEngagementSettings.emojiReactions && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('emojiReactions')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        localEngagementSettings.emojiReactions && styles.engagementToggleKnobOn,
                                                    ]}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.engagementDivider} />

                                        <View style={styles.engagementRow}>
                                            <View style={styles.engagementInfo}>
                                                <Text style={styles.engagementLabel}>
                                                    Automatically convert emoticons in your messages to emoji
                                                </Text>
                                                <Text style={styles.engagementDesc}>
                                                    For example, typing :) will convert to emoji.
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.engagementToggle,
                                                    localEngagementSettings.autoEmoji && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('autoEmoji')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        localEngagementSettings.autoEmoji && styles.engagementToggleKnobOn,
                                                    ]}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.engagementDivider} />

                                        <View style={styles.engagementRow}>
                                            <View style={styles.engagementInfo}>
                                                <Text style={styles.engagementLabel}>Stickers in Autocomplete</Text>
                                                <Text style={styles.engagementDesc}>
                                                    Allows stickers in your autocomplete results.
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.engagementToggle,
                                                    localEngagementSettings.stickersAutocomplete && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('stickersAutocomplete')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        localEngagementSettings.stickersAutocomplete && styles.engagementToggleKnobOn,
                                                    ]}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Members Tab */}
                            {settingsTab === 'members' && (
                                <View style={styles.settingsPanel}>
                                    <View style={styles.settingsCard}>
                                        <View style={styles.settingsCardHeader}>
                                            <View>
                                                <Text style={styles.settingsCardTitle}>Server members</Text>
                                                <Text style={styles.settingsCardSubtitle}>Members in channel list</Text>
                                            </View>
                                            <View style={styles.membersSearchWrap}>
                                                <Search size={16} color={colors.textMuted} />
                                                <TextInput
                                                    style={styles.membersSearchInput}
                                                    placeholder="Search members..."
                                                    placeholderTextColor={colors.textSubtle}
                                                    value={membersSearch}
                                                    onChangeText={setMembersSearch}
                                                />
                                            </View>
                                        </View>

                                        <Text style={styles.membersSectionTitle}>Members</Text>

                                        <View style={styles.membersTable}>
                                            <View style={styles.membersTableHeader}>
                                                <Text style={[styles.membersTableHeaderText, styles.memberColName]}>Name</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.memberColEmail]}>Email</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.memberColRole]}>Role</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.memberColAccess]}>Channel Access</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.memberColStatus]}>Status</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.memberColActions]} />
                                            </View>

                                            {filteredMembers.map((member, index) => {
                                                const memberId = member.userId || member.user?._id || member._id;
                                                const memberRole = member.role || member.user?.role || 'member';
                                                const memberStatus = member.status || 'active';
                                                const username = member.username || member.user?.username;
                                                return (
                                                    <TouchableOpacity
                                                        key={member._id || index}
                                                        style={styles.membersTableRow}
                                                        onPress={() => {
                                                            setSelectedMember(member);
                                                            setMemberDetailModalOpen(true);
                                                        }}
                                                    >
                                                        <View style={[styles.memberCell, styles.memberColName]}>
                                                            <UserAvatar
                                                                uri={getMemberAvatarUrl(member)}
                                                                name={getMemberName(member)}
                                                                style={styles.memberListAvatar}
                                                            />
                                                            <View>
                                                                <Text style={styles.memberNameText}>{getMemberName(member)}</Text>
                                                                {username && <Text style={styles.memberUsernameText}>@{username}</Text>}
                                                            </View>
                                                        </View>
                                                        <Text style={[styles.memberCellText, styles.memberColEmail]}>
                                                            {getMemberEmail(member) || '-'}
                                                        </Text>
                                                        <Text style={[styles.memberCellText, styles.memberColRole]}>
                                                            {getMemberRoleLabel(memberRole)}
                                                        </Text>
                                                        <Text style={[styles.memberCellText, styles.memberColAccess]}>
                                                            {getChannelAccessLabel(memberRole)}
                                                        </Text>
                                                        <View style={[styles.memberColStatus, styles.memberStatusWrap]}>
                                                            <View style={[styles.statusBadge, getMemberStatusStyle(memberStatus)]}>
                                                                <Text style={[styles.statusBadgeText, getMemberStatusTextStyle(memberStatus)]}>
                                                                    {getMemberStatusLabel(memberStatus)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <View style={[styles.memberColActions, styles.memberActions]}>
                                                            <TouchableOpacity
                                                                style={styles.memberActionBtn}
                                                                onPress={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedMember(member);
                                                                    setMemberActionModalOpen(true);
                                                                }}
                                                            >
                                                                <MoreHorizontal size={16} color={colors.textMuted} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}

                                            {filteredMembers.length === 0 && (
                                                <View style={styles.emptyMembersList}>
                                                    <Users size={48} color={colors.textMuted} />
                                                    <Text style={styles.emptyMembersText}>No members yet</Text>
                                                    <Text style={styles.emptyMembersHint}>Invite people to join your server</Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.membersFooter}>
                                            <Text style={styles.membersFooterText}>
                                                1 - {Math.max(filteredMembers.length, 1)} of {filteredMembers.length || 0}
                                            </Text>
                                            <View style={styles.membersFooterActions}>
                                                <TouchableOpacity style={styles.memberActionBtn}>
                                                    <ChevronLeft size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.memberActionBtn}>
                                                    <ChevronRight size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Stakeholders Tab */}
                            {settingsTab === 'stakeholders' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Stakeholders Management</Text>
                                    <Text style={styles.settingsPanelDesc}>Manage external stakeholders, vendors, partners, and investors</Text>

                                    <View style={styles.membersContainer}>
                                        <View style={styles.membersSearch}>
                                            <Search size={16} color={colors.textMuted} />
                                            <TextInput
                                                style={styles.membersSearchInput}
                                                placeholder="Search stakeholders..."
                                                placeholderTextColor={colors.textMuted}
                                                value={stakeholdersSearch}
                                                onChangeText={setStakeholdersSearch}
                                            />
                                        </View>
                                        <Text style={styles.membersSectionTitle}>Stakeholders ({filteredStakeholders.length})</Text>

                                        <View style={styles.membersList}>
                                            {filteredStakeholders.map((member, index) => {
                                                const memberId = member.userId || member.user?._id || member._id;
                                                const stakeholderBadge = member.stakeholderBadge || member.user?.stakeholderBadge;
                                                const company = member.company || member.user?.company;
                                                const username = member.username || member.user?.username;
                                                return (
                                                    <View key={memberId || index} style={styles.stakeholderCard}>
                                                        <View style={styles.stakeholderHeader}>
                                                            <UserAvatar
                                                                uri={getMemberAvatarUrl(member)}
                                                                name={getMemberName(member)}
                                                                style={styles.memberAvatarLarge}
                                                            />
                                                            <View style={styles.stakeholderInfo}>
                                                                <View style={styles.stakeholderNameRow}>
                                                                    <Text style={styles.stakeholderName}>{getMemberName(member)}</Text>
                                                                    {stakeholderBadge && (
                                                                        <View style={[styles.stakeholderBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[stakeholderBadge] }]}>
                                                                            <Text style={styles.stakeholderBadgeText}>
                                                                                {stakeholderBadge.charAt(0).toUpperCase() + stakeholderBadge.slice(1)}
                                                                            </Text>
                                                                        </View>
                                                                    )}
                                                                    {member.customRole && (
                                                                        <View style={[styles.roleBadge, { backgroundColor: member.customRole.color + '20', borderColor: member.customRole.color }]}>
                                                                            <Text style={[styles.roleBadgeText, { color: member.customRole.color }]}>{member.customRole.name}</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                {username && (
                                                                    <Text style={styles.stakeholderUsername}>@{username}</Text>
                                                                )}
                                                                {company && (
                                                                    <Text style={styles.stakeholderCompany}>
                                                                        <Building2 size={12} color={colors.textMuted} /> {company}
                                                                    </Text>
                                                                )}
                                                                <Text style={styles.stakeholderEmail}>{getMemberEmail(member)}</Text>
                                                            </View>
                                                        </View>
                                                        <View style={styles.stakeholderDetails}>
                                                            <View style={styles.stakeholderDetailRow}>
                                                                <Text style={styles.stakeholderDetailLabel}>Status</Text>
                                                                <View style={[styles.statusBadge, member.status === 'active' ? styles.statusActive : member.status === 'muted' ? styles.statusMuted : styles.statusBanned]}>
                                                                    <Text style={styles.statusBadgeText}>{getMemberStatusLabel(member.status)}</Text>
                                                                </View>
                                                            </View>
                                                            <View style={styles.stakeholderDetailRow}>
                                                                <Text style={styles.stakeholderDetailLabel}>Role</Text>
                                                                <Text style={styles.stakeholderDetailValue}>{getMemberRoleLabel(member.role)}</Text>
                                                            </View>
                                                        </View>
                                                        <View style={styles.stakeholderActions}>
                                                            <TouchableOpacity
                                                                style={[styles.stakeholderActionBtn, styles.stakeholderActionBtnPrimary]}
                                                                onPress={() => {
                                                                    setSelectedStakeholder(member);
                                                                    setStakeholderDetailModalOpen(true);
                                                                }}
                                                            >
                                                                <Eye size={14} color="#FFFFFF" />
                                                                <Text style={styles.stakeholderActionBtnTextPrimary}>View Details</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.stakeholderActionBtn}
                                                                onPress={() => handleStakeholderAction(memberId, member.status === 'muted' ? 'unmute' : 'mute')}
                                                            >
                                                                {member.status === 'muted' ? <Volume2 size={14} color={colors.text} /> : <VolumeX size={14} color={colors.text} />}
                                                                <Text style={styles.stakeholderActionBtnText}>{member.status === 'muted' ? 'Unmute' : 'Mute'}</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={[styles.stakeholderActionBtn, styles.stakeholderActionBtnDanger]}
                                                                onPress={() => handleStakeholderAction(memberId, 'remove')}
                                                            >
                                                                <UserMinus size={14} color="#EF4444" />
                                                                <Text style={styles.stakeholderActionBtnTextDanger}>Remove</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                            {filteredStakeholders.length === 0 && (
                                                <View style={styles.emptyMembersList}>
                                                    <Users size={48} color={colors.textMuted} />
                                                    <Text style={styles.emptyMembersText}>No stakeholders yet</Text>
                                                    <Text style={styles.emptyMembersHint}>Invite stakeholders to collaborate with your team</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Roles Tab */}
                            {settingsTab === 'roles' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Roles & Permissions</Text>
                                    <Text style={styles.settingsPanelDesc}>Create custom role labels that display next to member names (like staff badges)</Text>

                                    {/* Inline Create/Edit Role Form */}
                                    {createRoleModalOpen ? (
                                        <View style={{ backgroundColor: colors.glassBgHover, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                                                {editingRole ? 'Edit Role' : 'Create New Role'}
                                            </Text>

                                            <Text style={styles.modalLabel}>ROLE NAME</Text>
                                            <TextInput
                                                style={[styles.modalInput, { marginBottom: 12 }]}
                                                placeholder="e.g. Branch Manager, Loan Officer"
                                                placeholderTextColor={colors.textMuted}
                                                value={newRoleName}
                                                onChangeText={setNewRoleName}
                                                maxLength={30}
                                                autoFocus
                                            />

                                            <Text style={styles.modalLabel}>ROLE COLOR</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 12 }}>
                                                {['#3B82F6', '#22C55E', '#EAB308', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'].map((color) => (
                                                    <TouchableOpacity
                                                        key={color}
                                                        onPress={() => setNewRoleColor(color)}
                                                        style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 18,
                                                            backgroundColor: color,
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            borderWidth: newRoleColor === color ? 3 : 0,
                                                            borderColor: colors.glassActiveText,
                                                        }}
                                                    >
                                                        {newRoleColor === color && <Check size={18} color={colors.glassActiveText} />}
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
                                                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Preview:</Text>
                                                <View style={[styles.roleBadge, { backgroundColor: newRoleColor + '20', borderColor: newRoleColor }]}>
                                                    <Text style={[styles.roleBadgeText, { color: newRoleColor }]}>{newRoleName || 'Role Name'}</Text>
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <TouchableOpacity
                                                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.glassBorder, alignItems: 'center' }}
                                                    onPress={() => { setCreateRoleModalOpen(false); setEditingRole(null); setNewRoleName(''); }}
                                                >
                                                    <Text style={{ color: colors.text, fontWeight: '500' }}>Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: (!newRoleName.trim() || savingRole) ? colors.textMuted : colors.primary, alignItems: 'center' }}
                                                    onPress={editingRole ? handleUpdateRole : handleCreateRole}
                                                    disabled={!newRoleName.trim() || savingRole}
                                                >
                                                    {savingRole ? (
                                                        <ActivityIndicator size="small" color={colors.glassActiveText} />
                                                    ) : (
                                                        <Text style={{ color: colors.glassActiveText, fontWeight: '500' }}>{editingRole ? 'Save' : 'Create'}</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.createRoleBtn}
                                            onPress={() => {
                                                setEditingRole(null);
                                                setNewRoleName('');
                                                setNewRoleColor('#3B82F6');
                                                setCreateRoleModalOpen(true);
                                            }}
                                        >
                                            <Plus size={18} color="#FFFFFF" />
                                            <Text style={styles.createRoleBtnText}>Create Role</Text>
                                        </TouchableOpacity>
                                    )}

                                    <View style={styles.rolesList}>
                                        {loadingRoles ? (
                                            <View style={{ padding: 20, alignItems: 'center' }}>
                                                <ActivityIndicator size="small" color={colors.primary} />
                                                <Text style={{ color: colors.textMuted, marginTop: 8 }}>Loading roles...</Text>
                                            </View>
                                        ) : customRoles.length === 0 && !createRoleModalOpen ? (
                                            <View style={{ padding: 20, alignItems: 'center' }}>
                                                <Award size={48} color={colors.textMuted} />
                                                <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 16 }}>No custom roles yet</Text>
                                                <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 14, textAlign: 'center' }}>
                                                    Create roles like "Branch Manager" or "Loan Officer" to identify your staff members
                                                </Text>
                                            </View>
                                        ) : (
                                            customRoles.map((role) => (
                                                <View key={role._id} style={styles.roleItem}>
                                                    <View style={[styles.roleColor, { backgroundColor: role.color }]} />
                                                    <Text style={styles.roleName}>{role.name}</Text>
                                                    <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                setEditingRole(role);
                                                                setNewRoleName(role.name);
                                                                setNewRoleColor(role.color);
                                                                setCreateRoleModalOpen(true);
                                                            }}
                                                            style={{ padding: 4 }}
                                                        >
                                                            <Edit size={16} color={colors.textMuted} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={() => handleDeleteRole(role._id, role.name)}
                                                            style={{ padding: 4 }}
                                                        >
                                                            <Trash2 size={16} color="#EF4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ))
                                        )}
                                    </View>

                                    {/* Assign Roles Section */}
                                    {customRoles.length > 0 && (
                                        <View style={{ marginTop: 24 }}>
                                            <Text style={styles.settingsPanelTitle}>Assign Roles to Members</Text>
                                            <Text style={styles.settingsPanelDesc}>Click on a member to assign or remove their role badge</Text>

                                            {/* Search Input */}
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: colors.glassBg,
                                                borderRadius: 8,
                                                paddingHorizontal: 12,
                                                marginTop: 12,
                                                borderWidth: 1,
                                                borderColor: colors.glassBorder,
                                            }}>
                                                <Search size={18} color={colors.textMuted} />
                                                <TextInput
                                                    style={{
                                                        flex: 1,
                                                        paddingVertical: 10,
                                                        paddingHorizontal: 8,
                                                        color: colors.text,
                                                        fontSize: 14,
                                                    }}
                                                    placeholder="Search by name, email, or username..."
                                                    placeholderTextColor={colors.textMuted}
                                                    value={memberSearchQuery}
                                                    onChangeText={setMemberSearchQuery}
                                                />
                                                {memberSearchQuery.length > 0 && (
                                                    <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                                                        <XCircle size={18} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <ScrollView style={{ maxHeight: 400, marginTop: 12 }}>
                                                {members
                                                    .filter((member) => {
                                                        if (!memberSearchQuery.trim()) return true;
                                                        const query = memberSearchQuery.toLowerCase();
                                                        const name = (member.userName || '').toLowerCase();
                                                        const email = (member.email || '').toLowerCase();
                                                        const username = (member.username || '').toLowerCase();
                                                        return name.includes(query) || email.includes(query) || username.includes(query);
                                                    })
                                                    .map((member) => (
                                                    <View key={member._id}>
                                                        <TouchableOpacity
                                                            style={[styles.roleItem, { paddingVertical: 12, cursor: 'pointer', backgroundColor: assigningMember?._id === member._id ? colors.glassBgHover : 'transparent' } as any]}
                                                            onPress={() => openAssignRole(member)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <UserAvatar userId={member.userId} userName={member.userName} size={32} />
                                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                                <Text style={[styles.roleName, { marginLeft: 0 }]}>{member.userName}</Text>
                                                                {member.email && (
                                                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{member.email}</Text>
                                                                )}
                                                            </View>
                                                            {member.customRole && (
                                                                <View style={[styles.roleBadge, { backgroundColor: member.customRole.color + '20', borderColor: member.customRole.color }]}>
                                                                    <Text style={[styles.roleBadgeText, { color: member.customRole.color }]}>{member.customRole.name}</Text>
                                                                </View>
                                                            )}
                                                            <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 8, transform: [{ rotate: assigningMember?._id === member._id ? '90deg' : '0deg' }] }} />
                                                        </TouchableOpacity>
                                                        {/* Inline Role Selector */}
                                                        {assigningMember?._id === member._id && (
                                                            <View style={{ backgroundColor: colors.glassBgHover, padding: 12, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginBottom: 8 }}>
                                                                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' }}>Select Role</Text>
                                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                                    <TouchableOpacity
                                                                        style={{
                                                                            paddingVertical: 6,
                                                                            paddingHorizontal: 12,
                                                                            borderRadius: 16,
                                                                            backgroundColor: !member.customRole ? colors.primary : colors.glassBg,
                                                                            borderWidth: 1,
                                                                            borderColor: !member.customRole ? colors.primary : colors.glassBorder,
                                                                        }}
                                                                        onPress={() => handleAssignRole(member.userId || member._id, null)}
                                                                    >
                                                                        <Text style={{ color: !member.customRole ? colors.glassActiveText : colors.text, fontSize: 13 }}>No Role</Text>
                                                                    </TouchableOpacity>
                                                                    {customRoles.map((role) => (
                                                                        <TouchableOpacity
                                                                            key={role._id}
                                                                            style={{
                                                                                paddingVertical: 6,
                                                                                paddingHorizontal: 12,
                                                                                borderRadius: 16,
                                                                                backgroundColor: member.customRole?._id === role._id ? role.color : colors.glassBg,
                                                                                borderWidth: 1,
                                                                                borderColor: role.color,
                                                                            }}
                                                                            onPress={() => handleAssignRole(member.userId || member._id, role._id)}
                                                                        >
                                                                            <Text style={{ color: member.customRole?._id === role._id ? colors.glassActiveText : role.color, fontSize: 13 }}>{role.name}</Text>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                </View>
                                                            </View>
                                                        )}
                                                    </View>
                                                ))}
                                                {members.filter((member) => {
                                                    if (!memberSearchQuery.trim()) return true;
                                                    const query = memberSearchQuery.toLowerCase();
                                                    const name = (member.userName || '').toLowerCase();
                                                    const email = (member.email || '').toLowerCase();
                                                    const username = (member.username || '').toLowerCase();
                                                    return name.includes(query) || email.includes(query) || username.includes(query);
                                                }).length === 0 && (
                                                    <View style={{ padding: 20, alignItems: 'center' }}>
                                                        <SearchX size={32} color={colors.textMuted} />
                                                        <Text style={{ color: colors.textMuted, marginTop: 8 }}>No members found</Text>
                                                    </View>
                                                )}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Invites Tab */}
                            {settingsTab === 'invites' && (
                                <View style={styles.settingsPanel}>
                                    <View style={styles.settingsCard}>
                                        <View style={styles.settingsCardHeader}>
                                            <View>
                                                <Text style={styles.settingsCardTitle}>Invites</Text>
                                                <Text style={styles.settingsCardSubtitle}>Monitor active invite links</Text>
                                            </View>
                                            <TouchableOpacity style={styles.createInviteBtn} onPress={() => { setServerSettingsModalOpen(false); setInviteModalOpen(true); }}>
                                                <Text style={styles.createInviteBtnText}>Create Invite Link</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.membersSectionTitle}>Active Invite Links</Text>

                                        <View style={styles.invitesTable}>
                                            <View style={styles.membersTableHeader}>
                                                <Text style={[styles.membersTableHeaderText, styles.inviteColInviter]}>Inviter</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.inviteColCode]}>Invite Code</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.inviteColUsers]}>Users</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.inviteColExpires]}>Expires</Text>
                                                <Text style={[styles.membersTableHeaderText, styles.inviteColRole]}>Roles</Text>
                                            </View>

                                            {activeSubgrid?.inviteCode ? (
                                                <View style={styles.membersTableRow}>
                                                    <Text style={[styles.memberCellText, styles.inviteColInviter]}>
                                                        {currentUserName || 'Admin'}
                                                    </Text>
                                                    <Text style={[styles.memberCellText, styles.inviteColCode]}>
                                                        {activeSubgrid.inviteCode}
                                                    </Text>
                                                    <Text style={[styles.memberCellText, styles.inviteColUsers]}>0</Text>
                                                    <Text style={[styles.memberCellText, styles.inviteColExpires]}>02/12 1:32</Text>
                                                    <Text style={[styles.memberCellText, styles.inviteColRole]}>Member</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.invitesListEmpty}>
                                                    <Link size={48} color={colors.textMuted} />
                                                    <Text style={styles.invitesEmptyText}>No active invites</Text>
                                                    <Text style={styles.invitesEmptyHint}>Create an invite link to share with others</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Emoji Tab */}
                            {/* Bans Tab */}
                            {settingsTab === 'bans' && (
                                <View style={styles.settingsPanel}>
                                    <View style={styles.settingsCard}>
                                        <View style={styles.settingsCardHeader}>
                                            <View>
                                                <Text style={styles.settingsCardTitle}>Ban Members</Text>
                                                <Text style={styles.settingsCardSubtitle}>Monitor flagged content</Text>
                                            </View>
                                        </View>

                                        {!!moderationError && (
                                            <Text style={styles.moderationErrorText}>{moderationError}</Text>
                                        )}

                                        <View style={styles.moderationTable}>
                                            <View style={styles.moderationTableHeader}>
                                                <View style={styles.moderationCheckboxCell}>
                                                    <View style={styles.checkbox} />
                                                </View>
                                                <Text style={[styles.moderationHeaderText, styles.moderationColSeverity]}>Severity</Text>
                                                <Text style={[styles.moderationHeaderText, styles.moderationColContent]}>Content</Text>
                                                <Text style={[styles.moderationHeaderText, styles.moderationColType]}>Type</Text>
                                                <Text style={[styles.moderationHeaderText, styles.moderationColCommunity]}>Community</Text>
                                                <Text style={[styles.moderationHeaderText, styles.moderationColAuthor]}>Author</Text>
                                                <Text style={[styles.moderationHeaderText, styles.moderationColReport]}>Report</Text>
                                                <View style={styles.moderationColActions} />
                                            </View>

                                            {moderationQueue.length === 0 ? (
                                                <View style={styles.moderationEmpty}>
                                                    <Shield size={48} color={colors.textMuted} />
                                                    <Text style={styles.moderationEmptyText}>No flagged content</Text>
                                                    <Text style={styles.moderationEmptyHint}>Reported items will appear here</Text>
                                                </View>
                                            ) : (
                                                moderationQueue.map((item) => {
                                                    const content = item.content || {};
                                                    const contentText = content?.body || content?.text || content?.title || 'Content unavailable';
                                                    const authorId = content?.authorId || content?.senderId;
                                                    const authorName = authorId ? getAuthorName(authorId, members) : 'Unknown';
                                                    const typeLabel = item.contentType
                                                        ? item.contentType.replace('_', ' ')
                                                        : 'content';
                                                    const severity = getSeverityLabel(item.reason);
                                                    const severityColor =
                                                        severity === 'High'
                                                            ? { bg: colors.dangerBg, text: colors.dangerText, dot: colors.dangerText }
                                                            : { bg: colors.warningBg, text: colors.warningText, dot: colors.warningText };
                                                    return (
                                                        <View key={item._id} style={styles.moderationRow}>
                                                            <View style={styles.moderationCheckboxCell}>
                                                                <View style={styles.checkbox} />
                                                            </View>
                                                            <View style={[styles.moderationCell, styles.moderationColSeverity]}>
                                                                <View style={[styles.severityBadge, { backgroundColor: severityColor.bg }]}>
                                                                    <View style={[styles.severityDot, { backgroundColor: severityColor.dot }]} />
                                                                    <Text style={[styles.severityText, { color: severityColor.text }]}>
                                                                        {severity}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            <Text
                                                                style={[styles.moderationCellText, styles.moderationColContent]}
                                                                numberOfLines={1}
                                                            >
                                                                {contentText}
                                                            </Text>
                                                            <View style={[styles.moderationCell, styles.moderationColType]}>
                                                                <View style={styles.typeBadge}>
                                                                    <Text style={styles.typeBadgeText}>
                                                                        {typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            <Text style={[styles.moderationCellText, styles.moderationColCommunity]}>
                                                                {activeSubgrid?.name || 'Community'}
                                                            </Text>
                                                            <Text style={[styles.moderationCellText, styles.moderationColAuthor]}>
                                                                {authorName}
                                                            </Text>
                                                            <Text
                                                                style={[styles.moderationCellText, styles.moderationColReport]}
                                                                numberOfLines={1}
                                                            >
                                                                {item.reason || '-'}
                                                            </Text>
                                                            <View style={[styles.moderationColActions, styles.moderationActions]}>
                                                                <TouchableOpacity
                                                                    style={styles.memberActionBtn}
                                                                    onPress={() =>
                                                                        setModerationMenuOpen(moderationMenuOpen === item._id ? null : item._id)
                                                                    }
                                                                >
                                                                    <MoreHorizontal size={16} color={colors.textMuted} />
                                                                </TouchableOpacity>
                                                                {moderationMenuOpen === item._id && (
                                                                    <View style={styles.moderationMenuDropdown}>
                                                                        <TouchableOpacity
                                                                            style={styles.moderationMenuItem}
                                                                            onPress={() => {
                                                                                setModerationMenuOpen(null);
                                                                                openModerationDetail(item);
                                                                            }}
                                                                        >
                                                                            <Eye size={14} color={colors.textMuted} />
                                                                            <Text style={styles.moderationMenuText}>View</Text>
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            style={styles.moderationMenuItem}
                                                                            onPress={() => {
                                                                                setModerationMenuOpen(null);
                                                                                handleModerationAction(item, 'mute');
                                                                            }}
                                                                        >
                                                                            <Ban size={14} color={colors.textMuted} />
                                                                            <Text style={styles.moderationMenuText}>Restrict User</Text>
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            style={styles.moderationMenuItem}
                                                                            onPress={() => {
                                                                                setModerationMenuOpen(null);
                                                                                handleModerationAction(item, 'ban');
                                                                            }}
                                                                        >
                                                                            <UserMinus size={14} color={colors.textMuted} />
                                                                            <Text style={styles.moderationMenuText}>Remove User</Text>
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            style={styles.moderationMenuItem}
                                                                            onPress={() => {
                                                                                setModerationMenuOpen(null);
                                                                                handleModerationAction(item, 'warn');
                                                                            }}
                                                                        >
                                                                            <AlertTriangle size={14} color={colors.textMuted} />
                                                                            <Text style={styles.moderationMenuText}>Warn User</Text>
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </View>
                                                    );
                                                })
                                            )}
                                        </View>

                                        <View style={styles.membersFooter}>
                                            <Text style={styles.membersFooterText}>
                                                {moderationQueue.length === 0 ? '0 - 0' : `1 - ${moderationQueue.length}`} of {moderationQueue.length}
                                            </Text>
                                            <View style={styles.membersFooterActions}>
                                                <TouchableOpacity style={styles.memberActionBtn}>
                                                    <ChevronLeft size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.memberActionBtn}>
                                                    <ChevronRight size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Content Moderation Tab */}
                            {settingsTab === 'content-moderation' && (
                                <View style={styles.settingsPanel}>
                                    <View style={styles.settingsCard}>
                                        <View style={styles.settingsCardHeader}>
                                            <View>
                                                <Text style={styles.settingsCardTitle}>Content Moderation</Text>
                                                <Text style={styles.settingsCardSubtitle}>Set up prohibited words and language filters</Text>
                                            </View>
                                        </View>

                                        {/* Enable/Disable Toggle */}
                                        <View style={styles.contentModerationSection}>
                                            <View style={styles.contentModerationRow}>
                                                <View style={styles.contentModerationRowInfo}>
                                                    <Text style={styles.contentModerationLabel}>Enable Content Filtering</Text>
                                                    <Text style={styles.contentModerationHint}>When enabled, messages containing prohibited words will be filtered</Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.toggleSwitch,
                                                        localContentModerationEnabled && styles.toggleSwitchActive
                                                    ]}
                                                    onPress={() => setContentModerationEnabled(!localContentModerationEnabled)}
                                                >
                                                    <View style={[
                                                        styles.toggleKnob,
                                                        localContentModerationEnabled && styles.toggleKnobActive
                                                    ]} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Filter Action */}
                                        <View style={styles.contentModerationSection}>
                                            <Text style={styles.contentModerationLabel}>Filter Action</Text>
                                            <Text style={styles.contentModerationHint}>What happens when prohibited content is detected</Text>
                                            <View style={styles.localContentModerationActions}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.localContentModerationActionBtn,
                                                        localContentModerationAction === 'block' && styles.localContentModerationActionBtnActive
                                                    ]}
                                                    onPress={() => setContentModerationAction('block')}
                                                >
                                                    <Ban
                                                        size={18}
                                                        color={localContentModerationAction === 'block' ? colors.glassActiveText : colors.textMuted}
                                                    />
                                                    <Text style={[
                                                        styles.localContentModerationActionText,
                                                        localContentModerationAction === 'block' && styles.localContentModerationActionTextActive
                                                    ]}>Block</Text>
                                                    <Text style={[
                                                        styles.localContentModerationActionHint,
                                                        localContentModerationAction === 'block' && styles.localContentModerationActionHintActive
                                                    ]}>Prevent sending</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.localContentModerationActionBtn,
                                                        localContentModerationAction === 'flag' && styles.localContentModerationActionBtnActive
                                                    ]}
                                                    onPress={() => setContentModerationAction('flag')}
                                                >
                                                    <Flag
                                                        size={18}
                                                        color={localContentModerationAction === 'flag' ? colors.glassActiveText : colors.textMuted}
                                                    />
                                                    <Text style={[
                                                        styles.localContentModerationActionText,
                                                        localContentModerationAction === 'flag' && styles.localContentModerationActionTextActive
                                                    ]}>Flag</Text>
                                                    <Text style={[
                                                        styles.localContentModerationActionHint,
                                                        localContentModerationAction === 'flag' && styles.localContentModerationActionHintActive
                                                    ]}>Send but flag for review</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.localContentModerationActionBtn,
                                                        localContentModerationAction === 'censor' && styles.localContentModerationActionBtnActive
                                                    ]}
                                                    onPress={() => setContentModerationAction('censor')}
                                                >
                                                    <Eye
                                                        size={18}
                                                        color={localContentModerationAction === 'censor' ? colors.glassActiveText : colors.textMuted}
                                                    />
                                                    <Text style={[
                                                        styles.localContentModerationActionText,
                                                        localContentModerationAction === 'censor' && styles.localContentModerationActionTextActive
                                                    ]}>Censor</Text>
                                                    <Text style={[
                                                        styles.localContentModerationActionHint,
                                                        localContentModerationAction === 'censor' && styles.localContentModerationActionHintActive
                                                    ]}>Replace with ***</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Blocked Message */}
                                        {localContentModerationAction === 'block' && (
                                            <View style={styles.contentModerationSection}>
                                                <Text style={styles.contentModerationLabel}>Blocked Message</Text>
                                                <Text style={styles.contentModerationHint}>Message shown to users when their content is blocked</Text>
                                                <TextInput
                                                    style={styles.contentModerationInput}
                                                    value={localBlockedMessage}
                                                    onChangeText={setLocalBlockedMessage}
                                                    placeholder="Your message contains prohibited content..."
                                                    placeholderTextColor={colors.textSubtle}
                                                    multiline
                                                />
                                            </View>
                                        )}

                                        {/* Save Settings Button */}
                                        <TouchableOpacity
                                            style={styles.contentModerationSaveBtn}
                                            onPress={saveContentModerationSettings}
                                            disabled={contentModerationLoading}
                                        >
                                            <Text style={styles.contentModerationSaveBtnText}>
                                                {contentModerationLoading ? 'Saving...' : 'Save Settings'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Prohibited Words Section */}
                                    <View style={styles.settingsCard}>
                                        <View style={styles.settingsCardHeader}>
                                            <View>
                                                <Text style={styles.settingsCardTitle}>Prohibited Words</Text>
                                                <Text style={styles.settingsCardSubtitle}>Add words or phrases to filter from messages</Text>
                                            </View>
                                        </View>

                                        {/* Add New Word */}
                                        <View style={styles.contentModerationAddWord}>
                                            <TextInput
                                                style={styles.contentModerationWordInput}
                                                value={newProhibitedWord}
                                                onChangeText={setNewProhibitedWord}
                                                placeholder="Enter word or phrase to prohibit..."
                                                placeholderTextColor={colors.textSubtle}
                                                onSubmitEditing={addProhibitedWord}
                                            />
                                            <TouchableOpacity
                                                style={styles.contentModerationAddBtn}
                                                onPress={addProhibitedWord}
                                                disabled={contentModerationLoading || !newProhibitedWord.trim()}
                                            >
                                                <Plus size={20} color="#fff" />
                                                <Text style={styles.contentModerationAddBtnText}>Add</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Word List */}
                                        <View style={styles.contentModerationWordList}>
                                            {prohibitedWords.length === 0 ? (
                                                <View style={styles.contentModerationEmpty}>
                                                    <FilterX size={40} color={colors.textMuted} />
                                                    <Text style={styles.contentModerationEmptyText}>No prohibited words yet</Text>
                                                    <Text style={styles.contentModerationEmptyHint}>Add words above to start filtering content</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.contentModerationWordTags}>
                                                    {prohibitedWords.map((word, index) => (
                                                        <View key={index} style={styles.contentModerationWordTag}>
                                                            <Text style={styles.contentModerationWordTagText}>{word}</Text>
                                                            <TouchableOpacity
                                                                style={styles.contentModerationWordTagRemove}
                                                                onPress={() => removeProhibitedWord(word)}
                                                            >
                                                                <X size={14} color={colors.textMuted} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>

                                        <Text style={styles.contentModerationWordCount}>
                                            {prohibitedWords.length} word{prohibitedWords.length !== 1 ? 's' : ''} in filter list
                                        </Text>
                                    </View>

                                    {/* Test Filter Section */}
                                    <View style={styles.settingsCard}>
                                        <View style={styles.settingsCardHeader}>
                                            <View>
                                                <Text style={styles.settingsCardTitle}>Test Filter</Text>
                                                <Text style={styles.settingsCardSubtitle}>Test your content filter with sample text</Text>
                                            </View>
                                        </View>

                                        <View style={styles.contentModerationTestSection}>
                                            <TextInput
                                                style={styles.contentModerationTestInput}
                                                value={contentModerationTestText}
                                                onChangeText={setContentModerationTestText}
                                                placeholder="Enter text to test..."
                                                placeholderTextColor={colors.textSubtle}
                                                multiline
                                            />
                                            <TouchableOpacity
                                                style={styles.contentModerationTestBtn}
                                                onPress={testContentModeration}
                                                disabled={contentModerationLoading || !contentModerationTestText.trim()}
                                            >
                                                <Play size={18} color="#fff" />
                                                <Text style={styles.contentModerationTestBtnText}>Test</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {contentModerationTestResult && (
                                            <View style={[
                                                styles.contentModerationTestResult,
                                                contentModerationTestResult.isProhibited
                                                    ? styles.contentModerationTestResultBlocked
                                                    : styles.contentModerationTestResultAllowed
                                            ]}>
                                                <View style={styles.contentModerationTestResultHeader}>
                                                    {contentModerationTestResult.isProhibited ? (
                                                        <AlertTriangle size={20} color={colors.dangerText} />
                                                    ) : (
                                                        <CheckCircle size={20} color={colors.successText} />
                                                    )}
                                                    <Text style={[
                                                        styles.contentModerationTestResultTitle,
                                                        { color: contentModerationTestResult.isProhibited ? colors.dangerText : colors.successText }
                                                    ]}>
                                                        {contentModerationTestResult.isProhibited ? 'Content Would Be Filtered' : 'Content Is Allowed'}
                                                    </Text>
                                                </View>
                                                {contentModerationTestResult.isProhibited && contentModerationTestResult.matchedWords.length > 0 && (
                                                    <View style={styles.contentModerationTestResultDetails}>
                                                        <Text style={styles.contentModerationTestResultLabel}>Matched words:</Text>
                                                        <Text style={styles.contentModerationTestResultValue}>
                                                            {contentModerationTestResult.matchedWords.join(', ')}
                                                        </Text>
                                                    </View>
                                                )}
                                                {contentModerationTestResult.isProhibited && localContentModerationAction === 'censor' && (
                                                    <View style={styles.contentModerationTestResultDetails}>
                                                        <Text style={styles.contentModerationTestResultLabel}>Censored output:</Text>
                                                        <Text style={styles.contentModerationTestResultValue}>
                                                            {contentModerationTestResult.filteredContent}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}

                            {settingsTab === 'partnerships' && (
                                <View style={styles.settingsPanel}>
                                    {/* Partnership Visibility Section */}
                                    <View style={styles.settingsCard}>
                                        <View style={styles.settingsCardHeader}>
                                            <View>
                                                <Text style={styles.settingsCardTitle}>Partnership Visibility</Text>
                                                <Text style={styles.settingsCardSubtitle}>Control how vendors can apply to partner with your community</Text>
                                            </View>
                                        </View>

                                        {/* Open Option */}
                                        <TouchableOpacity
                                            style={{
                                                borderWidth: 1.5,
                                                borderColor: partnershipStatus === 'open' ? colors.primary : colors.glassBorder,
                                                backgroundColor: partnershipStatus === 'open' ? colors.primary + '15' : colors.glassBg,
                                                borderRadius: 14,
                                                padding: 16,
                                                marginBottom: 10,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 12,
                                            }}
                                            onPress={() => setPartnershipStatus('open')}
                                            activeOpacity={0.75}
                                        >
                                            <View style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: 10,
                                                borderWidth: 2,
                                                borderColor: partnershipStatus === 'open' ? colors.primary : colors.glassBorder,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                {partnershipStatus === 'open' && (
                                                    <View style={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: 5,
                                                        backgroundColor: colors.primary,
                                                    }} />
                                                )}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Open</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>Any vendor can apply to partner with this community</Text>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Invite Only Option */}
                                        <TouchableOpacity
                                            style={{
                                                borderWidth: 1.5,
                                                borderColor: partnershipStatus === 'invite' ? colors.primary : colors.glassBorder,
                                                backgroundColor: partnershipStatus === 'invite' ? colors.primary + '15' : colors.glassBg,
                                                borderRadius: 14,
                                                padding: 16,
                                                marginBottom: 10,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 12,
                                            }}
                                            onPress={() => setPartnershipStatus('invite')}
                                            activeOpacity={0.75}
                                        >
                                            <View style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: 10,
                                                borderWidth: 2,
                                                borderColor: partnershipStatus === 'invite' ? colors.primary : colors.glassBorder,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                {partnershipStatus === 'invite' && (
                                                    <View style={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: 5,
                                                        backgroundColor: colors.primary,
                                                    }} />
                                                )}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Invite Only</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>Only vendors you invite can apply</Text>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Closed Option */}
                                        <TouchableOpacity
                                            style={{
                                                borderWidth: 1.5,
                                                borderColor: partnershipStatus === 'closed' ? colors.primary : colors.glassBorder,
                                                backgroundColor: partnershipStatus === 'closed' ? colors.primary + '15' : colors.glassBg,
                                                borderRadius: 14,
                                                padding: 16,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 12,
                                            }}
                                            onPress={() => setPartnershipStatus('closed')}
                                            activeOpacity={0.75}
                                        >
                                            <View style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: 10,
                                                borderWidth: 2,
                                                borderColor: partnershipStatus === 'closed' ? colors.primary : colors.glassBorder,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                {partnershipStatus === 'closed' && (
                                                    <View style={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: 5,
                                                        backgroundColor: colors.primary,
                                                    }} />
                                                )}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Closed</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>No new partnership applications accepted</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Current Partners Info Section */}
                                    <View style={styles.settingsCard}>
                                        <View style={styles.settingsCardHeader}>
                                            <View>
                                                <Text style={styles.settingsCardTitle}>Current Partners</Text>
                                                <Text style={styles.settingsCardSubtitle}>Manage listings in the Partner Listings panel</Text>
                                            </View>
                                        </View>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: colors.modalBg,
                                            borderRadius: 10,
                                            padding: 14,
                                            borderWidth: 1,
                                            borderColor: colors.glassBorder,
                                        }}>
                                            <Text style={{ color: colors.textMuted, fontSize: 14 }}>Active Partners</Text>
                                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>{partnerListings?.length ?? 0}</Text>
                                        </View>
                                    </View>

                                    {/* Revenue Share Rate Section */}
                                    <View style={{
                                        backgroundColor: colors.modalBg,
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: colors.glassBorder,
                                        padding: 16,
                                        marginBottom: 16,
                                    }}>
                                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>Revenue Share Rate</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16 }}>Set the percentage of marketplace revenue your community earns from partner transactions</Text>

                                        {/* Large centered rate display */}
                                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                            <Text style={{ color: colors.text, fontSize: 48, fontWeight: '800', letterSpacing: -1 }}>{revShareRate}%</Text>
                                        </View>

                                        {/* Increment/Decrement controls with track visual */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                            <TouchableOpacity
                                                onPress={() => setRevShareRate(Math.max(0, revShareRate - 1))}
                                                activeOpacity={0.7}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 18,
                                                    backgroundColor: colors.glassBg,
                                                    borderWidth: 1,
                                                    borderColor: colors.glassBorder,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', lineHeight: 22 }}>−</Text>
                                            </TouchableOpacity>

                                            {/* Track visual */}
                                            <View style={{ flex: 1, height: 8, backgroundColor: colors.glassBg, borderRadius: 4, borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden' }}>
                                                <View style={{
                                                    height: '100%',
                                                    width: `${(revShareRate / 50) * 100}%`,
                                                    backgroundColor: colors.primary,
                                                    borderRadius: 4,
                                                }} />
                                            </View>

                                            <TouchableOpacity
                                                onPress={() => setRevShareRate(Math.min(50, revShareRate + 1))}
                                                activeOpacity={0.7}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 18,
                                                    backgroundColor: colors.glassBg,
                                                    borderWidth: 1,
                                                    borderColor: colors.glassBorder,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', lineHeight: 22 }}>+</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 14 }}>
                                            Gryd platform retains the remaining {100 - revShareRate}%
                                        </Text>

                                        <GlassButton
                                            label={revShareRateSaving ? 'Saving...' : 'Save Rate'}
                                            onPress={handleSaveRevShareRate}
                                            variant="primary"
                                        />
                                    </View>

                                    {/* Vendor Invite System — only shown in Invite Only mode */}
                                    {partnershipStatus === 'invite' && (
                                        <View style={{
                                            backgroundColor: colors.modalBg,
                                            borderRadius: 14,
                                            borderWidth: 1,
                                            borderColor: colors.glassBorder,
                                            padding: 16,
                                            marginBottom: 16,
                                        }}>
                                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>Invite Vendors</Text>
                                            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 14 }}>Send direct invitations to specific vendors to apply for partnership</Text>

                                            {/* Email input + Send button row */}
                                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                                                <TextInput
                                                    style={{
                                                        flex: 1,
                                                        backgroundColor: colors.glassBg,
                                                        borderWidth: 1,
                                                        borderColor: colors.glassBorder,
                                                        borderRadius: 10,
                                                        padding: 12,
                                                        color: colors.text,
                                                        fontSize: 14,
                                                    }}
                                                    placeholder="vendor@email.com"
                                                    placeholderTextColor={colors.textMuted}
                                                    value={vendorInviteEmail}
                                                    onChangeText={setVendorInviteEmail}
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                />
                                                <GlassButton
                                                    label={vendorInviteSending ? 'Sending...' : 'Send Invite'}
                                                    onPress={handleSendVendorInvite}
                                                    variant="primary"
                                                />
                                            </View>

                                            {/* Pending Invites list */}
                                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Pending Invites</Text>

                                            {vendorInvitesLoading ? (
                                                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
                                            ) : vendorInvites.length === 0 ? (
                                                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                                    <Mail size={28} color={colors.textMuted} />
                                                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>No invites sent yet</Text>
                                                </View>
                                            ) : (
                                                vendorInvites.map((invite: any) => (
                                                    <View
                                                        key={invite._id}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            backgroundColor: colors.glassBg,
                                                            borderRadius: 10,
                                                            borderWidth: 1,
                                                            borderColor: colors.glassBorder,
                                                            padding: 12,
                                                            marginBottom: 8,
                                                            gap: 10,
                                                        }}
                                                    >
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{invite.email}</Text>
                                                            {invite.createdAt && (
                                                                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                                                                    Sent {new Date(invite.createdAt).toLocaleDateString()}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <View style={{
                                                            paddingHorizontal: 8,
                                                            paddingVertical: 3,
                                                            borderRadius: 6,
                                                            backgroundColor:
                                                                invite.status === 'accepted' ? colors.primary + '25' :
                                                                invite.status === 'revoked' ? colors.error + '25' :
                                                                colors.glassBg,
                                                            borderWidth: 1,
                                                            borderColor:
                                                                invite.status === 'accepted' ? colors.primary + '60' :
                                                                invite.status === 'revoked' ? colors.error + '60' :
                                                                colors.glassBorder,
                                                        }}>
                                                            <Text style={{
                                                                fontSize: 11,
                                                                fontWeight: '600',
                                                                color:
                                                                    invite.status === 'accepted' ? colors.primary :
                                                                    invite.status === 'revoked' ? colors.error :
                                                                    colors.textMuted,
                                                                textTransform: 'capitalize',
                                                            }}>{invite.status ?? 'pending'}</Text>
                                                        </View>
                                                        {invite.status !== 'revoked' && invite.status !== 'accepted' && (
                                                            <TouchableOpacity
                                                                onPress={() => handleRevokeVendorInvite(invite._id)}
                                                                activeOpacity={0.7}
                                                                style={{
                                                                    paddingHorizontal: 10,
                                                                    paddingVertical: 5,
                                                                    borderRadius: 8,
                                                                    backgroundColor: colors.error + '18',
                                                                    borderWidth: 1,
                                                                    borderColor: colors.error + '40',
                                                                }}
                                                            >
                                                                <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>Revoke</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                ))
                                            )}
                                        </View>
                                    )}

                                    {/* Save Button */}
                                    <GlassButton
                                        label={partnershipStatusSaving ? 'Saving...' : 'Save Partnership Settings'}
                                        onPress={() => handleSavePartnershipStatus(partnershipStatus)}
                                        variant="primary"
                                    />
                                </View>
                            )}
                        </ScrollView>
                    </View>
                    )}
                </View>
            </Modal>

            {/* Create Server Modal */}
            <Modal visible={createServerModalOpen} transparent animationType="fade" onRequestClose={() => setCreateServerModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setCreateServerModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Create Server</Text>

                        <Text style={styles.modalLabel}>SERVER NAME</Text>
                        <View style={styles.inputRow}>
                            <Image source={require('../assets/icon.png')} style={{ width: 18, height: 18, borderRadius: 3 }} />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Server name"
                                placeholderTextColor={colors.textSubtle}
                                value={newServerName}
                                onChangeText={setNewServerName}
                            />
                        </View>

                        <Text style={styles.modalLabel}>DESCRIPTION</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Describe this server..."
                            placeholderTextColor={colors.textSubtle}
                            value={newServerDescription}
                            onChangeText={setNewServerDescription}
                            multiline
                            numberOfLines={3}
                        />

                        <Text style={styles.modalLabel}>VISIBILITY</Text>
                        <View style={styles.visibilityRow}>
                            <TouchableOpacity
                                style={[styles.visibilityOption, newServerVisibility === 'private' && styles.visibilityOptionActive]}
                                onPress={() => setNewServerVisibility('private')}
                            >
                                <Lock size={16} color={newServerVisibility === 'private' ? colors.glassActiveText : colors.textMuted} />
                                <Text style={[styles.visibilityText, newServerVisibility === 'private' && styles.visibilityTextActive]}>Private</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.visibilityOption, newServerVisibility === 'public' && styles.visibilityOptionActive]}
                                onPress={() => setNewServerVisibility('public')}
                            >
                                <Globe size={16} color={newServerVisibility === 'public' ? colors.glassActiveText : colors.textMuted} />
                                <Text style={[styles.visibilityText, newServerVisibility === 'public' && styles.visibilityTextActive]}>Public</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateServerModalOpen(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createBtnBlack} onPress={handleCreateServer}>
                                <Text style={styles.createBtnBlackText}>Create Server</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Floating Item Action Menu - rendered at root level for proper z-index */}
            {itemMenuOpen && itemMenuItem && (
                <>
                    <Pressable
                        style={styles.floatingMenuOverlay}
                        onPress={closeItemMenu}
                    />
                    <View style={[styles.floatingMenuDropdown, { top: itemMenuPosition.top, right: itemMenuPosition.right }]}>
                        <TouchableOpacity
                            style={styles.floatingMenuItem}
                            onPress={() => {
                                openReportModal(itemMenuItem._id, itemMenuItem.isPost ? 'post' : 'message');
                                closeItemMenu();
                            }}
                        >
                            <Flag size={16} color={colors.textMuted} />
                            <Text style={styles.floatingMenuItemText}>Report</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.floatingMenuItem}
                            onPress={() => {
                                if (itemMenuItem.isPost) {
                                    handleDeletePost(itemMenuItem._id);
                                } else {
                                    handleDeleteMessage(itemMenuItem._id);
                                }
                                closeItemMenu();
                            }}
                        >
                            <Trash2 size={16} color="#EF4444" />
                            <Text style={styles.floatingMenuItemTextDanger}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* Report Modal */}
            <Modal visible={reportModalOpen} transparent animationType="fade" onRequestClose={() => setReportModalOpen(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setReportModalOpen(false)}>
                    <Pressable style={styles.reportModalCard} onPress={(event) => event.stopPropagation()}>
                        <View style={styles.reportModalHeader}>
                            <Text style={styles.reportModalTitle}>Report content</Text>
                            <TouchableOpacity onPress={() => setReportModalOpen(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.reportModalSubtitle}>Select a reason for this report.</Text>
                        <View style={styles.reportReasonGrid}>
                            {REPORT_REASONS.map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    style={[styles.reportReasonOption, reportReason === reason && styles.reportReasonOptionActive]}
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
                        <View style={styles.reportModalActions}>
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
                    </Pressable>
                </Pressable>
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
                                comments.map((comment, idx) => {
                                    const commentMember = findMemberByAuthorId(comment.authorId);
                                    return (
                                        <View key={comment._id || idx} style={styles.commentItem}>
                                            <UserAvatar
                                                uri={getMemberAvatarUrl(commentMember)}
                                                name={getMemberDisplayName(commentMember)}
                                                style={styles.commentAvatar}
                                            />
                                            <View style={styles.commentBody}>
                                                <View style={styles.commentAuthorRow}>
                                                    <Text style={styles.commentAuthor}>{getMemberDisplayName(commentMember)}</Text>
                                                    {isMemberAdmin(commentMember) && (
                                                        <View style={styles.verifiedBadgeSmall}>
                                                            <BadgeCheck size={12} color="#3B82F6" />
                                                        </View>
                                                    )}
                                                    {getMemberDisplayUsername(commentMember) && (
                                                        <Text style={styles.commentUsername}>@{getMemberDisplayUsername(commentMember)}</Text>
                                                    )}
                                                    {getMemberBadge(commentMember) && (
                                                        <View style={[styles.commentBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getMemberBadge(commentMember)!] }]}>
                                                            <Text style={styles.commentBadgeText}>
                                                                {getMemberBadge(commentMember)}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.commentTime}>{formatDate(comment.createdAt)}</Text>
                                                </View>
                                                <Text style={styles.commentText}>{comment.body}</Text>
                                            </View>
                                        </View>
                                    );
                                })
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

            {/* Moderation Detail Modal */}
            <Modal visible={moderationDetailOpen} transparent animationType="fade" onRequestClose={() => setModerationDetailOpen(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setModerationDetailOpen(false)}>
                    <Pressable style={styles.moderationDetailCard} onPress={(event) => event.stopPropagation()}>
                        <View style={styles.moderationDetailHeader}>
                            <Text style={styles.moderationDetailTitle}>Content Detail</Text>
                            <TouchableOpacity onPress={() => setModerationDetailOpen(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.moderationDetailBody}>
                            <View style={styles.moderationDetailAuthorRow}>
                                <UserAvatar
                                    uri={getMemberAvatarUrl(moderationAuthorMember)}
                                    name={moderationAuthorName}
                                    style={styles.moderationDetailAvatar}
                                />
                                <View>
                                    <Text style={styles.moderationDetailAuthor}>{moderationAuthorName}</Text>
                                    <Text style={styles.moderationDetailMeta}>
                                        {formatDate(activeModerationItem?.createdAt) || 'Today'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.moderationDetailMessage}>
                                <Text style={styles.moderationDetailText}>{moderationContentText}</Text>
                            </View>
                            {!!activeModerationItem?.reason && (
                                <Text style={styles.moderationDetailReason}>Report reason: {activeModerationItem.reason}</Text>
                            )}
                        </View>
                        <View style={styles.moderationDetailActions}>
                            <TouchableOpacity
                                style={[styles.moderationActionBtn, moderationActionLoading && styles.moderationActionBtnDisabled]}
                                onPress={() => handleModerationAction(activeModerationItem, 'mute')}
                                disabled={moderationActionLoading}
                            >
                                <Text style={styles.moderationActionText}>Restrict User</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.moderationActionBtn, styles.moderationActionRemove, moderationActionLoading && styles.moderationActionBtnDisabled]}
                                onPress={() => handleModerationAction(activeModerationItem, 'remove')}
                                disabled={moderationActionLoading}
                            >
                                <Text style={styles.moderationActionTextOnDark}>Remove Content</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.moderationActionBtn, styles.moderationActionWarn, moderationActionLoading && styles.moderationActionBtnDisabled]}
                                onPress={() => handleModerationAction(activeModerationItem, 'warn')}
                                disabled={moderationActionLoading}
                            >
                                <Text style={styles.moderationActionWarnText}>Warn user</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Notification Settings Modal */}
            <Modal visible={notificationSettingsModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setNotificationSettingsModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Notification Settings</Text>

                        {notificationSettingsLoading ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={[styles.toggleDesc, { marginTop: 12 }]}>Loading preferences...</Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Bell size={16} color={colors.textMuted} />
                                        <View>
                                            <Text style={styles.toggleTitle}>Channel Messages</Text>
                                            <Text style={styles.toggleDesc}>Get notified for channel messages</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.toggle, notifyAllMessages && styles.toggleActive]}
                                        onPress={() => setNotifyAllMessages(!notifyAllMessages)}
                                    >
                                        <View style={[styles.toggleKnob, notifyAllMessages && styles.toggleKnobActive]} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <MessageSquare size={16} color={colors.textMuted} />
                                        <View>
                                            <Text style={styles.toggleTitle}>Direct Messages</Text>
                                            <Text style={styles.toggleDesc}>Get notified for DMs</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.toggle, notifyDMs && styles.toggleActive]}
                                        onPress={() => setNotifyDMs(!notifyDMs)}
                                    >
                                        <View style={[styles.toggleKnob, notifyDMs && styles.toggleKnobActive]} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Users size={16} color={colors.textMuted} />
                                        <View>
                                            <Text style={styles.toggleTitle}>Mentions</Text>
                                            <Text style={styles.toggleDesc}>Get notified when mentioned</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.toggle, notifyMentions && styles.toggleActive]}
                                        onPress={() => setNotifyMentions(!notifyMentions)}
                                    >
                                        <View style={[styles.toggleKnob, notifyMentions && styles.toggleKnobActive]} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Video size={16} color={colors.textMuted} />
                                        <View>
                                            <Text style={styles.toggleTitle}>Calls</Text>
                                            <Text style={styles.toggleDesc}>Get notified for incoming calls</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.toggle, notifyCalls && styles.toggleActive]}
                                        onPress={() => setNotifyCalls(!notifyCalls)}
                                    >
                                        <View style={[styles.toggleKnob, notifyCalls && styles.toggleKnobActive]} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleInfo}>
                                        <Calendar size={16} color={colors.textMuted} />
                                        <View>
                                            <Text style={styles.toggleTitle}>Invites & Events</Text>
                                            <Text style={styles.toggleDesc}>Get notified about invites and events</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.toggle, notifyEvents && styles.toggleActive]}
                                        onPress={() => setNotifyEvents(!notifyEvents)}
                                    >
                                        <View style={[styles.toggleKnob, notifyEvents && styles.toggleKnobActive]} />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={[styles.fullWidthBtn, notificationSettingsSaving && { opacity: 0.7 }]}
                                    onPress={handleSaveNotificationSettings}
                                    disabled={notificationSettingsSaving}
                                >
                                    {notificationSettingsSaving ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.fullWidthBtnText}>Save Settings</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Privacy Settings Modal */}
            <Modal visible={privacySettingsModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setPrivacySettingsModalOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Privacy & Safety</Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Profile Visibility */}
                            <Text style={[styles.toggleTitle, { marginBottom: 8, marginTop: 4 }]}>Profile Visibility</Text>
                            {([
                                { value: 'hidden', label: 'Hidden', desc: 'Only friends can see your name and profile' },
                                { value: 'friends_only', label: 'Friends Only', desc: 'Only your friends can see your profile details' },
                                { value: 'public', label: 'Public', desc: 'Anyone in your communities can see your profile' },
                            ] as const).map((opt) => (
                                <TouchableOpacity key={opt.value} style={styles.toggleRow} onPress={() => {
                                    setPrivacyProfileVisibility(opt.value);
                                    updatePrivacyMutation.mutate({ profileVisibility: opt.value });
                                }}>
                                    <View style={styles.toggleInfo}>
                                        <View>
                                            <Text style={styles.toggleTitle}>{opt.label}</Text>
                                            <Text style={styles.toggleDesc}>{opt.desc}</Text>
                                        </View>
                                    </View>
                                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: privacyProfileVisibility === opt.value ? colors.primary : colors.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
                                        {privacyProfileVisibility === opt.value && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {/* Direct Messages */}
                            <Text style={[styles.toggleTitle, { marginBottom: 8, marginTop: 16 }]}>Direct Messages</Text>
                            {([
                                { value: 'friends_only', label: 'Friends Only', desc: 'Only friends can message you' },
                                { value: 'everyone', label: 'Everyone', desc: 'Anyone can message you' },
                                { value: 'nobody', label: 'Nobody', desc: 'No one can message you' },
                            ] as const).map((opt) => (
                                <TouchableOpacity key={opt.value} style={styles.toggleRow} onPress={() => {
                                    setPrivacyAllowDMsFrom(opt.value);
                                    updatePrivacyMutation.mutate({ allowDMsFrom: opt.value });
                                }}>
                                    <View style={styles.toggleInfo}>
                                        <View>
                                            <Text style={styles.toggleTitle}>{opt.label}</Text>
                                            <Text style={styles.toggleDesc}>{opt.desc}</Text>
                                        </View>
                                    </View>
                                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: privacyAllowDMsFrom === opt.value ? colors.primary : colors.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
                                        {privacyAllowDMsFrom === opt.value && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {/* Friend Requests */}
                            <Text style={[styles.toggleTitle, { marginBottom: 8, marginTop: 16 }]}>Friend Requests</Text>
                            {([
                                { value: 'everyone', label: 'Everyone', desc: 'Anyone can send you a friend request' },
                                { value: 'members_only', label: 'Members Only', desc: 'Only regular members (not business partners)' },
                                { value: 'nobody', label: 'Nobody', desc: 'No one can send you friend requests' },
                            ] as const).map((opt) => (
                                <TouchableOpacity key={opt.value} style={styles.toggleRow} onPress={() => {
                                    setPrivacyAllowFriendRequestsFrom(opt.value);
                                    updatePrivacyMutation.mutate({ allowFriendRequestsFrom: opt.value });
                                }}>
                                    <View style={styles.toggleInfo}>
                                        <View>
                                            <Text style={styles.toggleTitle}>{opt.label}</Text>
                                            <Text style={styles.toggleDesc}>{opt.desc}</Text>
                                        </View>
                                    </View>
                                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: privacyAllowFriendRequestsFrom === opt.value ? colors.primary : colors.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
                                        {privacyAllowFriendRequestsFrom === opt.value && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {/* Online Status */}
                            <View style={[styles.toggleRow, { marginTop: 16 }]}>
                                <View style={styles.toggleInfo}>
                                    <View>
                                        <Text style={styles.toggleTitle}>Show Online Status</Text>
                                        <Text style={styles.toggleDesc}>Let others see when you're online</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.toggle, privacyShowOnlineStatus && styles.toggleActive]}
                                    onPress={() => {
                                        const newValue = !privacyShowOnlineStatus;
                                        setPrivacyShowOnlineStatus(newValue);
                                        updatePrivacyMutation.mutate({ showOnlineStatus: newValue });
                                    }}
                                >
                                    <View style={[styles.toggleKnob, privacyShowOnlineStatus && styles.toggleKnobActive]} />
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.fullWidthBtn} onPress={() => setPrivacySettingsModalOpen(false)}>
                            <Text style={styles.fullWidthBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Emoji Picker Modal */}
            <Modal visible={showEmojiPicker} transparent animationType="fade">
                <Pressable style={styles.emojiPickerOverlay} onPress={() => setShowEmojiPicker(false)}>
                    <View style={styles.emojiPickerContainer}>
                        <View style={styles.emojiPickerHeader}>
                            <Text style={styles.emojiPickerTitle}>Emoji</Text>
                            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.emojiGrid} showsVerticalScrollIndicator={false}>
                            <View style={styles.emojiGridInner}>
                                {emojis.map((emoji, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.emojiButton}
                                        onPress={() => handleEmojiSelect(emoji)}
                                    >
                                        <Text style={styles.emojiText}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Call Modal */}
            <Modal visible={callType !== null} transparent animationType="fade" onRequestClose={handleEndCall}>
                <View style={styles.callModalOverlay}>
                    <View style={styles.callCard}>
                        <TouchableOpacity style={styles.callCloseButton} onPress={handleEndCall}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.callTitle}>
                            {callType === 'video' ? 'Video Call' : 'Voice Call'} - {activeChannel?.name || 'general'}
                        </Text>
                        {!!callError && <Text style={styles.callError}>{callError}</Text>}

                        {callType === 'video' ? (
                            <View style={styles.videoCallContainer}>
                                <View style={styles.mainVideoWrap}>
                                    <UserAvatar
                                        uri={null}
                                        name={activeChannel?.name || 'Channel'}
                                        style={styles.mainVideoAvatar}
                                    />
                                    <Text style={styles.videoParticipantName}>Channel Call</Text>
                                </View>
                                <View style={styles.selfVideoWrap}>
                                    <UserAvatar
                                        uri={getMemberAvatarUrl(currentUserMember)}
                                        name={currentUserName}
                                        style={styles.selfVideoAvatar}
                                    />
                                    <Text style={styles.selfVideoName}>You</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.audioCallContainer}>
                                <View style={styles.callAvatarWrap}>
                                    <UserAvatar
                                        uri={null}
                                        name={activeChannel?.name || 'Channel'}
                                        style={styles.callAvatar}
                                    />
                                </View>
                                <Text style={styles.callParticipantName}>Channel Call</Text>
                            </View>
                        )}

                        <View style={styles.callActions}>
                            <TouchableOpacity style={styles.callActionButton} onPress={toggleMute}>
                                {muted ? <MicOff size={20} color="#EF4444" /> : <Mic size={20} color={colors.text} />}
                            </TouchableOpacity>
                            {callType === 'video' && (
                                <TouchableOpacity style={styles.callActionButton} onPress={toggleCamera}>
                                    {cameraOff ? <VideoOff size={20} color="#EF4444" /> : <Video size={20} color={colors.text} />}
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
                                <PhoneOff size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Success Modal */}
            <Modal visible={successModalOpen} transparent animationType="fade">
                <View style={styles.successModalOverlay}>
                    <View style={styles.successModalContent}>
                        <View style={styles.successIconContainer}>
                            <CheckCircle size={64} color="#22C55E" />
                        </View>
                        <Text style={styles.successModalTitle}>{successModalTitle}</Text>
                        <Text style={styles.successModalMessage}>{successModalMessage}</Text>
                        <TouchableOpacity
                            style={styles.successModalButton}
                            onPress={() => setSuccessModalOpen(false)}
                        >
                            <Text style={styles.successModalButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Stakeholder Detail Modal */}
            <Modal visible={stakeholderDetailModalOpen} transparent animationType="fade">
                <View style={styles.successModalOverlay}>
                    <View style={[styles.successModalContent, { maxWidth: 450 }]}>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => {
                                setStakeholderDetailModalOpen(false);
                                setSelectedStakeholder(null);
                            }}
                        >
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        {selectedStakeholder && (() => {
                            const stakeholderBadge = selectedStakeholder.stakeholderBadge || selectedStakeholder.user?.stakeholderBadge;
                            const company = selectedStakeholder.company || selectedStakeholder.user?.company;
                            const username = selectedStakeholder.username || selectedStakeholder.user?.username;
                            const memberId = selectedStakeholder.userId || selectedStakeholder.user?._id || selectedStakeholder._id;
                            return (
                                <View style={styles.stakeholderDetailModal}>
                                    <UserAvatar
                                        uri={getMemberAvatarUrl(selectedStakeholder)}
                                        name={getMemberName(selectedStakeholder)}
                                        style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16 }}
                                    />
                                    <View style={styles.stakeholderNameRow}>
                                        <Text style={[styles.stakeholderName, { fontSize: 20 }]}>{getMemberName(selectedStakeholder)}</Text>
                                        {stakeholderBadge && (
                                            <View style={[styles.stakeholderBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[stakeholderBadge] }]}>
                                                <Text style={styles.stakeholderBadgeText}>
                                                    {stakeholderBadge.charAt(0).toUpperCase() + stakeholderBadge.slice(1)}
                                                </Text>
                                            </View>
                                        )}
                                        {selectedStakeholder.customRole && (
                                            <View style={[styles.roleBadge, { backgroundColor: selectedStakeholder.customRole.color + '20', borderColor: selectedStakeholder.customRole.color }]}>
                                                <Text style={[styles.roleBadgeText, { color: selectedStakeholder.customRole.color }]}>{selectedStakeholder.customRole.name}</Text>
                                            </View>
                                        )}
                                    </View>
                                    {username && <Text style={[styles.stakeholderUsername, { marginBottom: 8 }]}>@{username}</Text>}

                                    <View style={styles.stakeholderDetailSection}>
                                        <View style={styles.stakeholderDetailItem}>
                                            <Mail size={16} color={colors.textMuted} />
                                            <Text style={styles.stakeholderDetailText}>{getMemberEmail(selectedStakeholder)}</Text>
                                        </View>
                                        {company && (
                                            <View style={styles.stakeholderDetailItem}>
                                                <Building2 size={16} color={colors.textMuted} />
                                                <Text style={styles.stakeholderDetailText}>{company}</Text>
                                            </View>
                                        )}
                                        <View style={styles.stakeholderDetailItem}>
                                            <ShieldCheck size={16} color={colors.textMuted} />
                                            <Text style={styles.stakeholderDetailText}>Role: {getMemberRoleLabel(selectedStakeholder.role)}</Text>
                                        </View>
                                        <View style={styles.stakeholderDetailItem}>
                                            <Info size={16} color={colors.textMuted} />
                                            <Text style={styles.stakeholderDetailText}>Status: {getMemberStatusLabel(selectedStakeholder.status)}</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.stakeholderActions, { marginTop: 20, justifyContent: 'center' }]}>
                                        <TouchableOpacity
                                            style={styles.stakeholderActionBtn}
                                            onPress={() => {
                                                handleStakeholderAction(memberId, selectedStakeholder.status === 'muted' ? 'unmute' : 'mute');
                                                setStakeholderDetailModalOpen(false);
                                                setSelectedStakeholder(null);
                                            }}
                                        >
                                            {selectedStakeholder.status === 'muted' ? <Volume2 size={14} color={colors.text} /> : <VolumeX size={14} color={colors.text} />}
                                            <Text style={styles.stakeholderActionBtnText}>{selectedStakeholder.status === 'muted' ? 'Unmute' : 'Mute'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.stakeholderActionBtn, styles.stakeholderActionBtnDanger]}
                                            onPress={() => {
                                                handleStakeholderAction(memberId, 'remove');
                                                setStakeholderDetailModalOpen(false);
                                                setSelectedStakeholder(null);
                                            }}
                                        >
                                            <UserMinus size={14} color="#EF4444" />
                                            <Text style={styles.stakeholderActionBtnTextDanger}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                </View>
            </Modal>

            {/* Member Action Modal (Quick Actions) */}
            <Modal visible={memberActionModalOpen} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.successModalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setMemberActionModalOpen(false);
                        setSelectedMember(null);
                    }}
                >
                    <View style={[styles.successModalContent, { maxWidth: 300, padding: 8 }]}>
                        {selectedMember && (() => {
                            const memberId = selectedMember.userId || selectedMember.user?._id || selectedMember._id;
                            const memberRole = selectedMember.role || selectedMember.user?.role || 'member';
                            const memberStatus = selectedMember.status || 'active';
                            const isAdmin = memberRole === 'subgrid_admin' || memberRole === 'admin';
                            const isModerator = memberRole === 'moderator';
                            return (
                                <View>
                                    <TouchableOpacity
                                        style={styles.memberActionMenuItem}
                                        onPress={() => {
                                            setMemberActionModalOpen(false);
                                            setMemberDetailModalOpen(true);
                                        }}
                                    >
                                        <User size={18} color={colors.text} />
                                        <Text style={styles.memberActionMenuText}>View Details</Text>
                                    </TouchableOpacity>

                                    {!isAdmin && (
                                        <>
                                            <TouchableOpacity
                                                style={styles.memberActionMenuItem}
                                                onPress={() => handleMemberAction(memberId, memberStatus === 'muted' ? 'unmute' : 'mute')}
                                            >
                                                {memberStatus === 'muted' ? <Volume2 size={18} color={colors.text} /> : <VolumeX size={18} color={colors.text} />}
                                                <Text style={styles.memberActionMenuText}>{memberStatus === 'muted' ? 'Unmute' : 'Mute'}</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.memberActionMenuItem}
                                                onPress={() => handleMemberAction(memberId, memberStatus === 'suspended' ? 'unsuspend' : 'suspend')}
                                            >
                                                {memberStatus === 'suspended' ? <CheckCircle size={18} color={colors.successText} /> : <Ban size={18} color={colors.warningText} />}
                                                <Text style={[styles.memberActionMenuText, { color: memberStatus === 'suspended' ? colors.successText : colors.warningText }]}>
                                                    {memberStatus === 'suspended' ? 'Unsuspend' : 'Suspend'}
                                                </Text>
                                            </TouchableOpacity>

                                            {!isModerator && (
                                                <TouchableOpacity
                                                    style={styles.memberActionMenuItem}
                                                    onPress={() => handleMemberAction(memberId, 'promote')}
                                                >
                                                    <ArrowUp size={18} color={colors.primary} />
                                                    <Text style={[styles.memberActionMenuText, { color: colors.primary }]}>Promote to Moderator</Text>
                                                </TouchableOpacity>
                                            )}

                                            {isModerator && (
                                                <TouchableOpacity
                                                    style={styles.memberActionMenuItem}
                                                    onPress={() => handleMemberAction(memberId, 'demote')}
                                                >
                                                    <ArrowDown size={18} color={colors.warningText} />
                                                    <Text style={[styles.memberActionMenuText, { color: colors.warningText }]}>Demote to Member</Text>
                                                </TouchableOpacity>
                                            )}

                                            <View style={styles.memberActionMenuDivider} />

                                            <TouchableOpacity
                                                style={styles.memberActionMenuItem}
                                                onPress={() => handleMemberAction(memberId, 'remove')}
                                            >
                                                <UserMinus size={18} color={colors.dangerText} />
                                                <Text style={[styles.memberActionMenuText, { color: colors.dangerText }]}>Remove from Server</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {isAdmin && (
                                        <Text style={styles.memberActionMenuNote}>Admin users cannot be modified</Text>
                                    )}
                                </View>
                            );
                        })()}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Member Detail Modal */}
            <Modal visible={memberDetailModalOpen} transparent animationType="fade">
                <View style={styles.successModalOverlay}>
                    <View style={[styles.successModalContent, { maxWidth: 450 }]}>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => {
                                setMemberDetailModalOpen(false);
                                setSelectedMember(null);
                            }}
                        >
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        {selectedMember && (() => {
                            const memberId = selectedMember.userId || selectedMember.user?._id || selectedMember._id;
                            const memberRole = selectedMember.role || selectedMember.user?.role || 'member';
                            const memberStatus = selectedMember.status || 'active';
                            const username = selectedMember.username || selectedMember.user?.username;
                            const email = getMemberEmail(selectedMember);
                            const isAdmin = memberRole === 'subgrid_admin' || memberRole === 'admin';
                            const isModerator = memberRole === 'moderator';
                            const joinedAt = selectedMember.createdAt || selectedMember.user?.createdAt;
                            return (
                                <View style={styles.memberDetailModal}>
                                    <UserAvatar
                                        uri={getMemberAvatarUrl(selectedMember)}
                                        name={getMemberName(selectedMember)}
                                        style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16 }}
                                    />
                                    <Text style={styles.memberDetailName}>{getMemberName(selectedMember)}</Text>
                                    {username && <Text style={styles.memberDetailUsername}>@{username}</Text>}

                                    <View style={styles.memberDetailSection}>
                                        <View style={styles.memberDetailItem}>
                                            <Mail size={16} color={colors.textMuted} />
                                            <Text style={styles.memberDetailText}>{email || 'No email'}</Text>
                                        </View>
                                        <View style={styles.memberDetailItem}>
                                            <ShieldCheck size={16} color={colors.textMuted} />
                                            <Text style={styles.memberDetailText}>Role: {getMemberRoleLabel(memberRole)}</Text>
                                        </View>
                                        <View style={styles.memberDetailItem}>
                                            <Info size={16} color={colors.textMuted} />
                                            <View style={[styles.statusBadge, getMemberStatusStyle(memberStatus), { marginLeft: 0 }]}>
                                                <Text style={[styles.statusBadgeText, getMemberStatusTextStyle(memberStatus)]}>
                                                    {getMemberStatusLabel(memberStatus)}
                                                </Text>
                                            </View>
                                        </View>
                                        {joinedAt && (
                                            <View style={styles.memberDetailItem}>
                                                <Calendar size={16} color={colors.textMuted} />
                                                <Text style={styles.memberDetailText}>Joined: {new Date(joinedAt).toLocaleDateString()}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {!isAdmin && (
                                        <View style={styles.memberDetailActions}>
                                            <TouchableOpacity
                                                style={styles.memberDetailActionBtn}
                                                onPress={() => handleMemberAction(memberId, memberStatus === 'muted' ? 'unmute' : 'mute')}
                                            >
                                                {memberStatus === 'muted' ? <Volume2 size={16} color={colors.text} /> : <VolumeX size={16} color={colors.text} />}
                                                <Text style={styles.memberDetailActionText}>{memberStatus === 'muted' ? 'Unmute' : 'Mute'}</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.memberDetailActionBtn, memberStatus === 'suspended' ? styles.memberDetailActionBtnSuccess : styles.memberDetailActionBtnWarning]}
                                                onPress={() => handleMemberAction(memberId, memberStatus === 'suspended' ? 'unsuspend' : 'suspend')}
                                            >
                                                {memberStatus === 'suspended' ? <CheckCircle size={16} color={colors.successText} /> : <Ban size={16} color={colors.warningText} />}
                                                <Text style={[styles.memberDetailActionText, { color: memberStatus === 'suspended' ? colors.successText : colors.warningText }]}>
                                                    {memberStatus === 'suspended' ? 'Unsuspend' : 'Suspend'}
                                                </Text>
                                            </TouchableOpacity>

                                            {!isModerator && (
                                                <TouchableOpacity
                                                    style={[styles.memberDetailActionBtn, styles.memberDetailActionBtnPrimary]}
                                                    onPress={() => handleMemberAction(memberId, 'promote')}
                                                >
                                                    <ArrowUp size={16} color={colors.primary} />
                                                    <Text style={[styles.memberDetailActionText, { color: colors.primary }]}>Promote</Text>
                                                </TouchableOpacity>
                                            )}

                                            {isModerator && (
                                                <TouchableOpacity
                                                    style={[styles.memberDetailActionBtn, styles.memberDetailActionBtnWarning]}
                                                    onPress={() => handleMemberAction(memberId, 'demote')}
                                                >
                                                    <ArrowDown size={16} color={colors.warningText} />
                                                    <Text style={[styles.memberDetailActionText, { color: colors.warningText }]}>Demote</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity
                                                style={[styles.memberDetailActionBtn, styles.memberDetailActionBtnDanger]}
                                                onPress={() => handleMemberAction(memberId, 'remove')}
                                            >
                                                <UserMinus size={16} color={colors.dangerText} />
                                                <Text style={[styles.memberDetailActionText, { color: colors.dangerText }]}>Remove</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {isAdmin && (
                                        <Text style={styles.memberDetailNote}>Admin users cannot be modified</Text>
                                    )}
                                </View>
                            );
                        })()}
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal visible={deleteConfirmModalOpen} transparent animationType="fade">
                <View style={styles.deleteModalOverlay}>
                    <View style={styles.deleteModalContent}>
                        <View style={styles.deleteIconContainer}>
                            <AlertTriangle size={56} color="#EF4444" />
                        </View>
                        <Text style={styles.deleteModalTitle}>
                            Delete {deleteConfirmData?.type === 'channel' ? 'Channel' : deleteConfirmData?.type === 'post' ? 'Post' : 'Message'}?
                        </Text>
                        <Text style={styles.deleteModalMessage}>
                            {deleteConfirmData?.type === 'channel'
                                ? 'This will permanently delete the channel and all its messages and posts. This action cannot be undone.'
                                : `This will permanently delete this ${deleteConfirmData?.type}. This action cannot be undone.`}
                        </Text>
                        {deleteConfirmData?.name && (
                            <View style={styles.deleteItemPreview}>
                                {deleteConfirmData.type === 'channel' ? <Image source={require('../assets/icon.png')} style={{ width: 16, height: 16, borderRadius: 3 }} /> : <FileText size={16} color={colors.textMuted} />}
                                <Text style={styles.deleteItemName}>{deleteConfirmData.name}</Text>
                            </View>
                        )}
                        <View style={styles.deleteModalButtons}>
                            <TouchableOpacity
                                style={styles.deleteModalCancelBtn}
                                onPress={() => {
                                    setDeleteConfirmModalOpen(false);
                                    setDeleteConfirmData(null);
                                }}
                            >
                                <Text style={styles.deleteModalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.deleteModalConfirmBtn}
                                onPress={executeDelete}
                            >
                                <Trash2 size={16} color="#FFFFFF" />
                                <Text style={styles.deleteModalConfirmText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Partner Listing Remove Confirmation */}
            <Modal visible={listingActionModalOpen} transparent animationType="fade" onRequestClose={() => { setListingActionModalOpen(false); setListingActionTarget(null); }}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Remove Listing?</Text>
                        <Text style={styles.modalSubtitle}>
                            This will permanently remove "{listingActionTarget?.title}" from the marketplace. The partner will no longer earn revenue from it.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: colors.glassBg }]} onPress={() => { setListingActionModalOpen(false); setListingActionTarget(null); }}>
                                <Text style={{ color: colors.text }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: colors.dangerText }]} onPress={handleForceRemoveListing}>
                                {listingActionLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Remove</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors'], mode: 'light' | 'dark', bottomInset: number = 0, topInset: number = 0) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: 'transparent',
            position: 'relative',
        },
        gridBackground: {},
        topNav: {
            height: 48,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            backgroundColor: 'transparent',
        },
        topNavLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        logoText: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        topNavTabs: {
            flexDirection: 'row',
            marginLeft: 32,
            gap: 24,
        },
        tab: {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
        },
        tabActive: {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: colors.primary + '15',
        },
        tabText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        tabTextActive: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary,
        },
        mainArea: {
            flex: 1,
            flexDirection: 'row',
            overflow: 'visible',
        },
        iconRail: {
            width: 64,
            backgroundColor: colors.glassBg,
            borderRightWidth: 1,
            borderRightColor: colors.glassBorder,
            alignItems: 'center',
            paddingVertical: 12,
            gap: 8,
        },
        railLogo: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        railLogoText: {
            fontSize: 8,
            fontWeight: '700',
            color: colors.glassActiveText,
        },
        railLogoImage: {
            width: 48,
            height: 48,
            borderRadius: 12,
        },
        railButton: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        exitButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.dangerBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
        },
        channelSidebar: {
            width: 240,
            backgroundColor: colors.glassBg,
            borderRightWidth: 1,
            borderRightColor: colors.glassBorder,
            overflow: 'visible',
            zIndex: 100,
        },
        channelSidebarMobile: {
            width: '100%',
            borderRightWidth: 0,
        },
        mobileTopBar: {
            flexDirection: 'column',
            paddingHorizontal: 16,
            paddingTop: topInset + 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            backgroundColor: 'transparent',
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
        mobileServerInfoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: colors.glassBg,
            padding: 10,
            borderRadius: 12,
        },
        mobileServerInfoText: {
            flex: 1,
        },
        mobileServerSubtitle: {
            fontSize: 11,
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
            backgroundColor: colors.glassBg,
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
            color: colors.glassActiveText,
        },
        mobileTopBarLogo: {
            width: 36,
            height: 36,
            borderRadius: 10,
        },
        mobileTopBarLogoPlaceholder: {
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        mobileTopBarLogoText: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.glassActiveText,
        },
        mobileTopBarTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        mobileTopBarRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        mobileTopBarBtn: {
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        mobileExitButton: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.dangerBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        mobileBackButton: {
            marginRight: 4,
            padding: 2,
        },
        topNavMobile: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            height: 'auto',
            backgroundColor: 'transparent',
        },
        topNavTabsMobile: {
            marginLeft: 0,
            gap: 8,
            paddingHorizontal: 4,
        },
        mainContentMobile: {
            width: '100%',
        },
        serverHeaderContainer: {
            position: 'relative',
            zIndex: 9999,
        },
        serverHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        serverHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        serverName: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        dropdownMenu: {
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: colors.modalBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 1000,
            zIndex: 9999,
        },
        dropdownOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
        },
        dropdownItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 10,
            borderRadius: 6,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
        },
        dropdownText: {
            fontSize: 14,
            color: colors.text,
        },
        channelList: {
            flex: 1,
            padding: 8,
            zIndex: 1,
        },
        eventsButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 8,
            marginBottom: 8,
            borderRadius: 6,
        },
        eventsButtonActive: {
            backgroundColor: colors.glassBg,
        },
        eventsText: {
            fontSize: 14,
            color: colors.textMuted,
            flex: 1,
        },
        eventsTextActive: {
            color: colors.text,
            fontWeight: '600',
        },
        eventsListContent: {
            padding: 16,
            gap: 16,
        },
        eventCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
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
            backgroundColor: colors.primary,
        },
        eventTypeBadgeAnnouncement: {
            backgroundColor: colors.warningBg,
        },
        eventTypeBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.glassActiveText,
        },
        eventDeleteBtn: {
            padding: 4,
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
            backgroundColor: colors.successBg,
        },
        eventStatusCancelled: {
            backgroundColor: colors.dangerBg,
        },
        eventStatusOngoing: {
            backgroundColor: colors.primary + '20',
        },
        eventStatusText: {
            fontSize: 12,
            fontWeight: '500',
            color: colors.text,
        },
        createEventHeaderBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
        },
        createEventHeaderBtnText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.glassActiveText,
        },
        eventTypeSelector: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 16,
        },
        eventTypeOption: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        eventTypeOptionActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        eventTypeOptionText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        eventTypeOptionTextActive: {
            color: colors.glassActiveText,
            fontWeight: '600',
        },
        channelGroup: {
            marginBottom: 16,
        },
        channelGroupHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 8,
            marginBottom: 4,
        },
        channelGroupToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        channelGroupTitle: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        channelItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: 10,
            marginBottom: 2,
        },
        channelItemActive: {
            backgroundColor: colors.primary + '15',
        },
        channelName: {
            flex: 1,
            fontSize: 14,
            color: colors.textMuted,
        },
        channelNameActive: {
            color: colors.primary,
            fontWeight: '600',
        },
        channelActions: {
            flexDirection: 'row',
            gap: 8,
        },
        channelMenuWrap: {
            position: 'relative',
        },
        channelMenuDropdown: {
            position: 'absolute',
            right: 0,
            top: 22,
            backgroundColor: colors.glassBg,
            borderRadius: 8,
            paddingVertical: 6,
            width: 200,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            zIndex: 100,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
            ...(Platform.OS === 'web'
                ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any
                : {}),
        },
        channelMenuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 12,
        },
        channelMenuItemPressed: {
            backgroundColor: colors.glassActiveBg,
        },
        channelMenuText: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '500',
        },
        channelMenuTextDanger: {
            fontSize: 14,
            color: colors.dangerText,
            fontWeight: '500',
        },
        channelSettingsOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        channelSettingsModalLegacy: {
            backgroundColor: colors.modalBg,
            borderRadius: 12,
            padding: 8,
            minWidth: 220,
            maxWidth: 280,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 12,
        },
        channelSettingsTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            marginBottom: 4,
        },
        channelSettingsItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 6,
        },
        channelSettingsText: {
            fontSize: 14,
            color: colors.text,
        },
        channelSettingsCancel: {
            justifyContent: 'center',
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
            marginTop: 4,
        },
        channelSettingsCancelText: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
        },
        emptyText: {
            fontSize: 12,
            color: colors.textSubtle,
            paddingLeft: 32,
            paddingVertical: 4,
        },
        userProfile: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 8,
            paddingTop: 8,
            paddingBottom: bottomInset + 8,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        userAvatarContainer: {
            position: 'relative',
        },
        userAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
        },
        onlineIndicator: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.successText,
            borderWidth: 2,
            borderColor: colors.glassBorder,
        },
        userInfo: {
            flex: 1,
        },
        userName: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
        },
        userStatus: {
            fontSize: 11,
            color: colors.successText,
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
        dropdownWrapper: {
            position: 'relative',
        },
        audioDropdown: {
            position: 'absolute',
            bottom: '100%',
            left: -50,
            width: 180,
            backgroundColor: colors.glassBg,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 8,
            marginBottom: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 10,
            zIndex: 1000,
        },
        audioDropdownTitle: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            paddingHorizontal: 8,
            paddingVertical: 4,
            marginBottom: 4,
        },
        audioDropdownItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 8,
            paddingVertical: 8,
            borderRadius: 4,
        },
        audioDropdownItemActive: {
            backgroundColor: colors.glassBg,
        },
        audioDropdownText: {
            fontSize: 13,
            color: colors.text,
        },
        audioDropdownTextActive: {
            fontWeight: '500',
        },
        mainContent: {
            flex: 1,
            backgroundColor: 'transparent',
            zIndex: 1,
        },
        contentHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            backgroundColor: 'transparent',
        },
        contentHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        contentTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        contentHeaderRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        headerIcon: {
            padding: 6,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
        },
        searchBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: colors.glassBg,
            borderRadius: 10,
            minWidth: 180,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        searchInput: {
            flex: 1,
            fontSize: 13,
            color: colors.text,
            padding: 0,
            margin: 0,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
        searchPlaceholder: {
            fontSize: 13,
            color: colors.textSubtle,
        },
        // Empty Server Welcome
        emptyServerContainer: {
            flex: 1,
            backgroundColor: colors.glassBg,
            position: 'relative',
            overflow: 'hidden',
        },
        gridPattern: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'row',
            flexWrap: 'wrap',
            opacity: 0.3,
        },
        gridDot: {
            width: '10%',
            height: 40,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderStyle: 'dotted',
        },
        emptyServerContent: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
        },
        emptyServerTitle: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.text,
        },
        emptyServerName: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 16,
        },
        emptyServerSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 32,
            maxWidth: 400,
        },
        welcomeActionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: 320,
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            marginBottom: 12,
        },
        welcomeActionText: {
            fontSize: 14,
            color: colors.text,
        },
        // Feed
        feedContainer: {
            flex: 1,
            backgroundColor: colors.glassBg,
        },
        feedContent: {
            padding: 16,
            gap: 16,
            flexGrow: 1,
            paddingBottom: 20,
        },
        welcomeCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            padding: 24,
            alignItems: 'flex-start',
        },
        welcomeIcon: {
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        welcomeTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 8,
        },
        welcomeSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 16,
        },
        editChannelBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        editChannelText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        postCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            padding: 16,
            gap: 12,
            overflow: 'visible',
        },
        postHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            overflow: 'visible',
            zIndex: 5,
        },
        postAvatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
        },
        postHeaderInfo: {
            flex: 1,
        },
        itemMenuContainer: {
            position: 'relative',
            zIndex: 10,
        },
        itemMenuDropdown: {
            position: 'absolute',
            top: 24,
            right: 0,
            backgroundColor: colors.glassBg,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
            zIndex: 100,
            minWidth: 100,
        },
        itemMenuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 12,
        },
        itemMenuText: {
            fontSize: 13,
            color: colors.text,
        },
        itemMenuTextDanger: {
            fontSize: 13,
            color: colors.dangerText,
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
            backgroundColor: colors.modalBg,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
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
        floatingMenuItemTextDanger: {
            fontSize: 14,
            color: colors.dangerText,
        },
        postAuthorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
        },
        postAuthor: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        postHandle: {
            fontSize: 13,
            color: colors.textMuted,
        },
        postDate: {
            fontSize: 13,
            color: colors.textSubtle,
        },
        feedMetaRow: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
        },
        typingContainer: {
            paddingHorizontal: 16,
            paddingVertical: 6,
        },
        typingText: {
            fontSize: 12,
            fontStyle: 'italic' as const,
        },
        postCompany: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        stakeholderBadgeSmall: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            marginLeft: 4,
        },
        stakeholderBadgeSmallText: {
            fontSize: 10,
            fontWeight: '600',
            color: colors.glassActiveText,
            textTransform: 'capitalize',
        },
        verifiedBadge: {
            marginLeft: 4,
            alignItems: 'center',
            justifyContent: 'center',
        },
        postBody: {
            fontSize: 14,
            color: colors.text,
            lineHeight: 20,
        },
        postImagePlaceholder: {
            height: 200,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        postAttachments: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 8,
        },
        postImage: {
            width: '100%',
            minHeight: 150,
            maxHeight: 500,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
        },
        videoPlaceholder: {
            width: '100%',
            height: 200,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        videoLabel: {
            color: colors.text,
            fontSize: 12,
            marginTop: 8,
        },
        audioAttachment: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 20,
            backgroundColor: colors.glassBg,
        },
        audioLabel: {
            fontSize: 13,
            color: colors.text,
        },
        fileAttachment: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            maxWidth: 200,
        },
        fileLabel: {
            fontSize: 13,
            color: colors.text,
            flex: 1,
        },
        // Reshare card styles
        reshareCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 12,
            marginTop: 8,
        },
        reshareHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
        },
        reshareLabel: {
            fontSize: 12,
            color: colors.textMuted,
            fontWeight: '500',
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
        },
        reshareAuthorName: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        reshareTime: {
            fontSize: 12,
            color: colors.textMuted,
        },
        reshareBody: {
            fontSize: 13,
            color: colors.text,
            lineHeight: 18,
        },
        reshareAttachments: {
            marginTop: 8,
            gap: 8,
        },
        reshareImage: {
            width: '100%',
            height: 150,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
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
            backgroundColor: colors.modalBg,
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
            borderBottomColor: colors.glassBorder,
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
            color: colors.glassActiveText,
            textTransform: 'capitalize',
        },
        verifiedBadgeSmall: {
            marginLeft: -4,
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
            borderTopColor: colors.glassBorder,
        },
        commentInput: {
            flex: 1,
            backgroundColor: colors.glassBg,
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
            color: colors.glassActiveText,
            fontWeight: '600',
        },
        postStats: {
            flexDirection: 'row',
            gap: 24,
            paddingTop: 8,
        },
        statItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        statText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        messageInputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: bottomInset + 12,
        },
        messageInputLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        messageInputMiddle: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        inputIcon: {
            padding: 6,
            borderRadius: 8,
        },
        messageInput: {
            flex: 1,
            fontSize: 15,
            color: colors.text,
            paddingVertical: 6,
        },
        messageInputActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        inputActionIcon: {
            padding: 8,
            borderRadius: 8,
        },
        sendBtn: {
            backgroundColor: colors.primary,
            borderRadius: 18,
            width: 36,
            height: 36,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 6,
        },
        sendBtnDisabled: {
            backgroundColor: colors.glassBg,
        },
        voiceMicBtn: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.glassBg,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 8,
        },
        membersSidebar: {
            width: 200,
            backgroundColor: colors.glassBg,
            borderLeftWidth: 1,
            borderLeftColor: colors.glassBorder,
            padding: 16,
        },
        membersTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 16,
        },
        memberItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
        },
        memberAvatarContainer: {
            position: 'relative',
        },
        memberAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
        },
        channelSettingsOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        channelSettingsModal: {
            backgroundColor: colors.modalBg,
            borderRadius: 12,
            padding: 8,
            minWidth: 220,
            maxWidth: 280,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 12,
        },
        channelSettingsTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            marginBottom: 4,
        },
        channelSettingsItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 6,
        },
        channelSettingsText: {
            fontSize: 14,
            color: colors.text,
        },
        channelSettingsCancel: {
            justifyContent: 'center',
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
            marginTop: 4,
        },
        channelSettingsCancelText: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
        },
        memberOnline: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.successText,
            borderWidth: 2,
            borderColor: colors.glassBorder,
        },
        memberName: {
            fontSize: 14,
            color: colors.text,
        },
        // Modal styles
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        modalContent: {
            width: '90%',
            maxWidth: 420,
            backgroundColor: colors.modalBg,
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        permissionModalContent: {
            width: '90%',
            maxWidth: 360,
            backgroundColor: colors.modalBg,
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        modalClose: {
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1,
        },
        modalIconWrap: {
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            position: 'relative',
        },
        modalIconBadge: {
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.successBg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 8,
        },
        modalSubtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 20,
        },
        modalLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
            marginTop: 16,
        },
        permissionList: {
            marginTop: 8,
        },
        permissionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 6,
        },
        permissionLabel: {
            fontSize: 14,
            color: colors.text,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        modalInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
        },
        inputWithBtn: {
            flexDirection: 'row',
            gap: 8,
        },
        modalInputFlex: {
            flex: 1,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            fontSize: 14,
            color: colors.text,
        },
        disabledInput: {
            backgroundColor: colors.glassBg,
            color: colors.textMuted,
        },
        actionBtn: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: colors.text,
        },
        actionBtnText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.glassBg,
        },
        linkLabel: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 20,
            marginBottom: 8,
        },
        badgeOptionsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 8,
            marginBottom: 16,
        },
        badgeOption: {
            alignItems: 'center',
            padding: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            position: 'relative',
        },
        badgePreview: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
        },
        badgePreviewText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.glassActiveText,
        },
        badgeCheckmark: {
            position: 'absolute',
            top: -4,
            right: -4,
            width: 18,
            height: 18,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
        },
        inviteBtn: {
            backgroundColor: colors.primary,
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 8,
        },
        inviteBtnDisabled: {
            opacity: 0.6,
        },
        inviteBtnText: {
            color: colors.glassActiveText,
            fontSize: 14,
            fontWeight: '600',
        },
        dividerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 20,
            gap: 12,
        },
        dividerLine: {
            flex: 1,
            height: 1,
            backgroundColor: colors.glassBorder,
        },
        dividerText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        textArea: {
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            fontSize: 14,
            color: colors.text,
            minHeight: 80,
            textAlignVertical: 'top',
        },
        uploadBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 24,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderStyle: 'dashed',
        },
        uploadBtnText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        typeOption: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            marginBottom: 8,
        },
        typeOptionActive: {
            backgroundColor: colors.glassBgMuted,
        },
        radioOuter: {
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: colors.text,
            alignItems: 'center',
            justifyContent: 'center',
        },
        radioInner: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.text,
        },
        typeIcon: {
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: colors.glassBgMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        typeInfo: {
            flex: 1,
        },
        typeTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        typeDesc: {
            fontSize: 12,
            color: colors.textMuted,
        },
        toggleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
            marginBottom: 8,
        },
        toggleInfo: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            flex: 1,
        },
        toggleTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        toggleDesc: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        toggle: {
            width: 44,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.glassBorder,
            padding: 2,
        },
        toggleActive: {
            backgroundColor: colors.successText,
        },
        toggleKnob: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.glassActiveText,
        },
        toggleKnobActive: {
            marginLeft: 20,
        },
        modalActions: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 24,
        },
        cancelBtn: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            alignItems: 'center',
        },
        cancelBtnText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        createBtn: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.text,
            alignItems: 'center',
        },
        createBtnText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.glassBg,
        },
        createBtnBlack: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.primary,
            alignItems: 'center',
        },
        createBtnBlackText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.glassActiveText,
        },
        // Category Modal styles
        categoryLabel: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
            marginTop: 16,
        },
        categoryInputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        categoryInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
        },
        privateCategoryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 20,
        },
        privateCategoryTitle: {
            flex: 1,
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        privateCategoryDesc: {
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
            marginTop: 8,
            marginBottom: 8,
        },
        fullWidthBtn: {
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.text,
            alignItems: 'center',
            marginTop: 24,
        },
        fullWidthBtnText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.glassBg,
        },
        // Server Settings Full Page Styles
        settingsFullPage: {
            flex: 1,
            flexDirection: 'row',
            backgroundColor: 'rgba(0,0,0,0.75)',
            padding: 16,
        },
        settingsSidebar: {
            width: 220,
            backgroundColor: colors.modalBg,
            paddingVertical: 16,
            borderRightWidth: 1,
            borderRightColor: colors.glassBorder,
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
        },
        settingsSidebarHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 16,
        },
        settingsSidebarTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        settingsSectionLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
            letterSpacing: 0.5,
        },
        settingsNavItem: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginHorizontal: 8,
            borderRadius: 6,
        },
        settingsNavItemActive: {
            backgroundColor: colors.glassActiveBg,
        },
        settingsNavItemRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        settingsNavText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        settingsNavTextActive: {
            color: colors.glassActiveText,
            fontWeight: '500',
        },
        settingsContent: {
            flex: 1,
            backgroundColor: colors.modalBg,
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderLeftWidth: 0,
            ...(Platform.OS === 'web'
                ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any
                : {}),
        },
        settingsContentHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        settingsContentTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        settingsCloseBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        settingsCloseBtnText: {
            fontSize: 14,
            color: colors.dangerText,
        },
        settingsScrollContent: {
            flex: 1,
            paddingHorizontal: 32,
            paddingVertical: 24,
        },
        // Server Settings Mobile Styles
        settingsFullPageMobile: {
            padding: 0,
        },
        settingsSidebarMobile: {
            width: '100%',
            borderRightWidth: 0,
            borderRadius: 0,
        },
        settingsContentMobile: {
            width: '100%',
            borderRadius: 0,
            borderLeftWidth: 0,
            borderWidth: 0,
        },
        settingsContentHeaderMobile: {
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        settingsMobileCloseBtn: {
            marginLeft: 'auto',
            padding: 4,
        },
        settingsMobileBackBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: 12,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: colors.primary + '15',
            borderRadius: 8,
            gap: 4,
        },
        settingsMobileBackBtnText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary,
        },
        settingsPanel: {
            maxWidth: 800,
        },
        settingsPanelTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        settingsPanelDesc: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
        },
        settingsLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 8,
            marginTop: 16,
        },
        settingsHint: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 12,
        },
        settingsInput: {
            backgroundColor: colors.glassBgMuted,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: colors.text,
        },
        settingsInputDisabled: {
            opacity: 0.6,
            backgroundColor: colors.glassBgMuted,
        },
        engagementCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 16,
        },
        engagementSectionTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 6,
        },
        engagementSectionDesc: {
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: 12,
        },
        engagementRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
        },
        engagementInfo: {
            flex: 1,
            paddingRight: 16,
        },
        engagementLabel: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
        },
        engagementDesc: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 4,
        },
        engagementDivider: {
            height: 1,
            backgroundColor: colors.glassBorder,
        },
        engagementSectionDivider: {
            height: 1,
            backgroundColor: colors.glassBorder,
            marginVertical: 12,
        },
        engagementToggle: {
            width: 38,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.glassBorder,
            padding: 2,
            justifyContent: 'center',
        },
        engagementToggleOn: {
            backgroundColor: colors.primary,
        },
        engagementToggleKnob: {
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.glassActiveText,
        },
        engagementToggleKnobOn: {
            marginLeft: 16,
        },
        serverProfileRow: {
            flexDirection: 'row',
            gap: 32,
            marginBottom: 24,
        },
        serverProfileForm: {
            flex: 1,
        },
        serverProfileInputRow: {
            flexDirection: 'row',
            gap: 16,
            marginTop: 16,
        },
        serverProfileInputCol: {
            flex: 1,
        },
        serverPreviewCard: {
            width: 200,
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        serverPreviewBanner: {
            height: 80,
            alignItems: 'center',
            justifyContent: 'flex-end',
        },
        serverPreviewAvatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.glassBg,
            borderWidth: 3,
            borderColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: -24,
        },
        serverPreviewAvatarImage: {
            width: 44,
            height: 44,
            borderRadius: 22,
        },
        serverPreviewAvatarText: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
        },
        serverPreviewInfo: {
            padding: 16,
            paddingTop: 32,
            alignItems: 'center',
        },
        serverPreviewName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        serverPreviewStats: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
        },
        serverPreviewOnline: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.successText,
            marginRight: 4,
        },
        serverPreviewStatText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        serverPreviewCreated: {
            fontSize: 11,
            color: colors.textMuted,
        },
        changeIconBtn: {
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
        },
        changeIconBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.glassActiveText,
        },
        serverIconActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        removeIconBtn: {
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        removeIconBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
        },
        bannerGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 8,
        },
        bannerOption: {
            width: 64,
            height: 48,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: 'transparent',
        },
        bannerOptionSelected: {
            borderColor: colors.primary,
        },
        // Invite Code Section
        inviteCodeSection: {
            marginTop: 24,
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        inviteCodeBox: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBgHover,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginTop: 8,
        },
        inviteCodeText: {
            flex: 1,
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: 4,
            color: colors.text,
            fontFamily: 'monospace',
        },
        copyCodeBtn: {
            padding: 8,
            borderRadius: 6,
            backgroundColor: colors.glassBg,
        },
        settingsActions: {
            marginTop: 32,
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        settingsSaveBtn: {
            backgroundColor: colors.successText,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
        },
        settingsSaveBtnText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.glassActiveText,
        },
        serverCrudActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
        },
        settingsSecondaryBtn: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        settingsSecondaryBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
        },
        settingsDangerBtn: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            backgroundColor: colors.dangerBg,
        },
        settingsDangerBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.dangerText,
        },
        visibilityRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 8,
        },
        visibilityOption: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        visibilityOptionActive: {
            backgroundColor: colors.glassActiveBg,
            borderColor: colors.glassActiveBg,
        },
        visibilityText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        visibilityTextActive: {
            color: colors.glassActiveText,
            fontWeight: '600',
        },
        settingsCard: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 12,
            padding: 16,
        },
        settingsCardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
        },
        settingsCardTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        settingsCardSubtitle: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        membersSearchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
            width: 220,
        },
        membersSearchRow: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 24,
        },
        membersSearchBox: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.glassBgMuted,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
        },
        membersSearchInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
            paddingVertical: 10,
        },
        inviteMemberBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
        },
        inviteMemberBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.glassActiveText,
        },
        membersSectionTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 12,
        },
        membersTable: {
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: colors.glassBg,
        },
        invitesTable: {
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: colors.glassBg,
        },
        membersTableHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: colors.glassBgMuted,
        },
        membersTableHeaderText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
        },
        membersTableRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        memberCell: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        memberCellText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        memberNameText: {
            fontSize: 12,
            fontWeight: '500',
            color: colors.text,
        },
        memberColName: {
            width: 160,
        },
        memberColEmail: {
            width: 180,
        },
        memberColRole: {
            width: 110,
        },
        memberColAccess: {
            width: 120,
        },
        memberColStatus: {
            width: 90,
            alignItems: 'flex-start',
        },
        memberColActions: {
            width: 36,
            alignItems: 'flex-end',
        },
        memberStatusWrap: {
            alignItems: 'flex-start',
        },
        statusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
        },
        statusBadgeActive: {
            backgroundColor: colors.successBg,
        },
        statusBadgePending: {
            backgroundColor: colors.warningBg,
        },
        statusBadgeMuted: {
            backgroundColor: colors.warningBg,
        },
        statusBadgeSuspended: {
            backgroundColor: colors.dangerBg,
        },
        statusBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.text,
        },
        statusBadgeTextActive: {
            color: colors.successText,
        },
        statusBadgeTextPending: {
            color: colors.warningText,
        },
        statusBadgeTextMuted: {
            color: colors.warningText,
        },
        statusBadgeTextSuspended: {
            color: colors.dangerText,
        },
        memberActions: {
            alignItems: 'flex-end',
        },
        membersFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
        },
        membersFooterText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        membersFooterActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        inviteColInviter: {
            width: 180,
        },
        inviteColCode: {
            width: 140,
        },
        inviteColUsers: {
            width: 80,
        },
        inviteColExpires: {
            width: 120,
        },
        inviteColRole: {
            width: 120,
        },
        membersListHeader: {
            flexDirection: 'row',
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: colors.glassBgMuted,
            borderRadius: 8,
            marginBottom: 8,
        },
        membersListHeaderText: {
            flex: 1,
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
            letterSpacing: 0.5,
        },
        memberListItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        memberListItemLeft: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        memberListAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
        },
        memberListName: {
            fontSize: 14,
            color: colors.text,
        },
        memberListRole: {
            flex: 1,
            fontSize: 13,
            color: colors.textMuted,
        },
        memberListJoined: {
            flex: 1,
            fontSize: 13,
            color: colors.textMuted,
        },
        memberListActions: {
            flexDirection: 'row',
            gap: 8,
        },
        memberActionBtn: {
            padding: 6,
        },
        emptyMembersList: {
            alignItems: 'center',
            paddingVertical: 48,
        },
        emptyMembersText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.text,
            marginTop: 16,
        },
        emptyMembersHint: {
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 4,
        },
        createRoleBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
            marginBottom: 24,
        },
        createRoleBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.glassActiveText,
        },
        rolesList: {
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            overflow: 'hidden',
        },
        roleItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        roleColor: {
            width: 16,
            height: 16,
            borderRadius: 8,
            marginRight: 12,
        },
        roleName: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
        },
        roleMemberCount: {
            fontSize: 13,
            color: colors.textMuted,
            marginRight: 12,
        },
        roleBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1,
            marginLeft: 8,
        },
        roleBadgeText: {
            fontSize: 12,
            fontWeight: '600',
        },
        roleSelectItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            borderRadius: 8,
            marginBottom: 4,
        },
        roleSelectItemActive: {
            backgroundColor: colors.glassBgHover,
        },
        createInviteBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primary,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 16,
        },
        createInviteBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.glassActiveText,
        },
        invitesListEmpty: {
            alignItems: 'center',
            paddingVertical: 48,
        },
        invitesEmptyText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.text,
            marginTop: 16,
        },
        invitesEmptyHint: {
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 4,
        },
        uploadEmojiBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
            marginBottom: 24,
        },
        uploadEmojiBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.glassActiveText,
        },
        emojiListEmpty: {
            alignItems: 'center',
            paddingVertical: 48,
        },
        emojiEmptyText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.text,
            marginTop: 16,
        },
        emojiEmptyHint: {
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 4,
        },
        auditLogEmpty: {
            alignItems: 'center',
            paddingVertical: 48,
        },
        auditLogEmptyText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.text,
            marginTop: 16,
        },
        auditLogEmptyHint: {
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 4,
        },
        bansListEmpty: {
            alignItems: 'center',
            paddingVertical: 48,
        },
        bansEmptyText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.text,
            marginTop: 16,
        },
        bansEmptyHint: {
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 4,
        },
        reportModalCard: {
            width: '90%',
            maxWidth: 420,
            backgroundColor: colors.modalBg,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        reportModalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        reportModalTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        reportModalSubtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 16,
        },
        reportReasonGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        reportReasonOption: {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
        },
        reportReasonOptionActive: {
            borderColor: colors.glassActiveBg,
            backgroundColor: colors.glassActiveBg,
        },
        reportReasonText: {
            fontSize: 12,
            color: colors.text,
        },
        reportReasonTextActive: {
            color: colors.glassActiveText,
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
            borderColor: colors.glassBorder,
            borderRadius: 10,
            padding: 12,
            color: colors.text,
            backgroundColor: colors.glassBgMuted,
            textAlignVertical: 'top',
        },
        reportModalActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 20,
        },
        reportCancelBtn: {
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        reportCancelText: {
            fontSize: 13,
            color: colors.text,
        },
        reportSubmitBtn: {
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 18,
            backgroundColor: colors.primary,
        },
        reportSubmitBtnDisabled: {
            opacity: 0.6,
        },
        reportSubmitText: {
            fontSize: 13,
            color: colors.glassActiveText,
            fontWeight: '600',
        },
        moderationErrorText: {
            fontSize: 12,
            color: colors.dangerText,
            marginBottom: 12,
        },
        moderationTable: {
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 12,
            overflow: 'hidden',
        },
        moderationTableHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            backgroundColor: colors.glassBgMuted,
        },
        moderationHeaderText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
        },
        moderationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        moderationCell: {
            justifyContent: 'center',
        },
        moderationCellText: {
            fontSize: 12,
            color: colors.text,
        },
        moderationCheckboxCell: {
            width: 28,
            alignItems: 'center',
        },
        moderationColSeverity: {
            width: 110,
        },
        moderationColContent: {
            flex: 2,
        },
        moderationColType: {
            width: 110,
        },
        moderationColCommunity: {
            flex: 1.2,
        },
        moderationColAuthor: {
            flex: 1,
        },
        moderationColReport: {
            flex: 1,
        },
        moderationColActions: {
            width: 40,
            alignItems: 'flex-end',
        },
        moderationActions: {
            alignItems: 'flex-end',
        },
        severityBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
        },
        severityDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        severityText: {
            fontSize: 11,
            fontWeight: '600',
        },
        typeBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            alignSelf: 'flex-start',
        },
        typeBadgeText: {
            fontSize: 11,
            color: colors.text,
        },
        moderationMenuDropdown: {
            position: 'absolute',
            top: 24,
            right: 0,
            backgroundColor: colors.glassBg,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
            zIndex: 100,
            minWidth: 160,
        },
        moderationMenuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 12,
        },
        moderationMenuText: {
            fontSize: 13,
            color: colors.text,
        },
        moderationEmpty: {
            alignItems: 'center',
            paddingVertical: 36,
        },
        moderationEmptyText: {
            fontSize: 15,
            fontWeight: '500',
            color: colors.text,
            marginTop: 12,
        },
        moderationEmptyHint: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 4,
        },
        moderationDetailCard: {
            width: '90%',
            maxWidth: 520,
            backgroundColor: colors.modalBg,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        moderationDetailHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        moderationDetailTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        moderationDetailBody: {
            gap: 12,
        },
        moderationDetailAuthorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        moderationDetailAvatar: {
            width: 42,
            height: 42,
            borderRadius: 21,
        },
        moderationDetailAuthor: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        moderationDetailMeta: {
            fontSize: 12,
            color: colors.textMuted,
        },
        moderationDetailMessage: {
            backgroundColor: colors.glassBgMuted,
            borderRadius: 12,
            padding: 12,
        },
        moderationDetailText: {
            fontSize: 13,
            color: colors.text,
            lineHeight: 18,
        },
        moderationDetailReason: {
            fontSize: 12,
            color: colors.textMuted,
        },
        moderationDetailActions: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 20,
        },
        moderationActionBtn: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            alignItems: 'center',
            backgroundColor: colors.glassBg,
        },
        moderationActionBtnDisabled: {
            opacity: 0.6,
        },
        moderationActionRemove: {
            backgroundColor: colors.dangerBg,
            borderColor: colors.dangerBg,
        },
        moderationActionWarn: {
            backgroundColor: colors.glassBgMuted,
        },
        moderationActionText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
        },
        moderationActionTextOnDark: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.dangerText,
        },
        moderationActionWarnText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
        },
        comingSoonBox: {
            alignItems: 'center',
            paddingVertical: 48,
        },
        comingSoonText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.text,
            marginTop: 16,
        },
        comingSoonHint: {
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 4,
        },
        // Attachment Preview Styles
        attachmentPreview: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 8,
        },
        attachmentItem: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBgMuted,
            borderRadius: 8,
            padding: 8,
            gap: 8,
            maxWidth: 200,
        },
        attachmentThumb: {
            width: 40,
            height: 40,
            borderRadius: 4,
        },
        attachmentFileIcon: {
            width: 40,
            height: 40,
            borderRadius: 4,
            backgroundColor: colors.glassBorder,
            alignItems: 'center',
            justifyContent: 'center',
        },
        attachmentName: {
            flex: 1,
            fontSize: 12,
            color: colors.text,
        },
        attachmentRemove: {
            padding: 4,
        },
        // Recording Styles
        recordingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.glassBgMuted,
            margin: 16,
            borderRadius: 8,
            padding: 12,
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
            backgroundColor: colors.dangerText,
        },
        recordingText: {
            fontSize: 14,
            color: colors.text,
        },
        recordingActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        recordingCancelBtn: {
            padding: 8,
        },
        recordingStopBtn: {
            backgroundColor: colors.dangerBg,
            borderRadius: 8,
            padding: 10,
        },
        // Emoji Picker Styles
        emojiPickerOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        emojiPickerContainer: {
            backgroundColor: colors.modalBg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.glassBorder,
            maxHeight: '50%',
        },
        emojiPickerHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        emojiPickerTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        emojiGrid: {
            flex: 1,
        },
        emojiGridInner: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            padding: 12,
        },
        emojiButton: {
            width: '12.5%',
            aspectRatio: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emojiText: {
            fontSize: 24,
        },
        // Call Modal Styles
        callModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        callCard: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.modalBg,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            gap: 20,
            position: 'relative',
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        callCloseButton: {
            position: 'absolute',
            top: 16,
            right: 16,
            padding: 4,
        },
        callTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        callError: {
            fontSize: 13,
            color: colors.dangerText,
        },
        audioCallContainer: {
            alignItems: 'center',
            gap: 16,
        },
        callAvatarWrap: {
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 3,
            borderColor: colors.glassBorder,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.glassBgMuted,
        },
        callAvatar: {
            width: 120,
            height: 120,
            borderRadius: 60,
        },
        callParticipantName: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        videoCallContainer: {
            width: '100%',
            aspectRatio: 0.7,
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: colors.glassBg,
        },
        mainVideoWrap: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        mainVideoAvatar: {
            width: 140,
            height: 140,
            borderRadius: 70,
        },
        videoParticipantName: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.glassActiveText,
            marginTop: 16,
        },
        selfVideoWrap: {
            position: 'absolute',
            top: 16,
            right: 16,
            width: 110,
            height: 150,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.glassBorder,
        },
        selfVideoAvatar: {
            width: 60,
            height: 60,
            borderRadius: 30,
        },
        selfVideoName: {
            fontSize: 12,
            fontWeight: '500',
            color: colors.glassActiveText,
            marginTop: 8,
        },
        callActions: {
            flexDirection: 'row',
            gap: 16,
        },
        callActionButton: {
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.glassBgMuted,
        },
        endCallButton: {
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.dangerBg,
        },
        // Success Modal Styles
        successModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        successModalContent: {
            backgroundColor: colors.modalBg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 32,
            alignItems: 'center',
            maxWidth: 340,
            width: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
        },
        successIconContainer: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.successBg,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
        },
        successModalTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 12,
            textAlign: 'center',
        },
        successModalMessage: {
            fontSize: 15,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 28,
            lineHeight: 22,
        },
        successModalButton: {
            backgroundColor: colors.successText,
            paddingVertical: 14,
            paddingHorizontal: 48,
            borderRadius: 12,
            minWidth: 160,
        },
        successModalButtonText: {
            color: colors.glassActiveText,
            fontSize: 16,
            fontWeight: '600',
            textAlign: 'center',
        },
        // Delete Confirmation Modal Styles
        deleteModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        deleteModalContent: {
            backgroundColor: colors.modalBg,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 32,
            alignItems: 'center',
            maxWidth: 380,
            width: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
        },
        deleteIconContainer: {
            width: 90,
            height: 90,
            borderRadius: 45,
            backgroundColor: colors.dangerBg,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
        },
        deleteModalTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 12,
            textAlign: 'center',
        },
        deleteModalMessage: {
            fontSize: 15,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 20,
            lineHeight: 22,
        },
        deleteItemPreview: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.glassBg,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 10,
            marginBottom: 24,
        },
        deleteItemName: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '500',
        },
        deleteModalButtons: {
            flexDirection: 'row',
            gap: 12,
            width: '100%',
        },
        deleteModalCancelBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        deleteModalCancelText: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
            textAlign: 'center',
        },
        deleteModalConfirmBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.dangerBg,
        },
        deleteModalConfirmText: {
            color: colors.dangerText,
            fontSize: 16,
            fontWeight: '600',
        },
        // Stakeholder Management Styles
        stakeholderCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        stakeholderHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
        },
        stakeholderInfo: {
            flex: 1,
        },
        stakeholderNameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 4,
        },
        stakeholderName: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        stakeholderBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 12,
        },
        stakeholderBadgeText: {
            color: colors.glassActiveText,
            fontSize: 11,
            fontWeight: '600',
        },
        stakeholderUsername: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 2,
        },
        stakeholderCompany: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 2,
            flexDirection: 'row',
            alignItems: 'center',
        },
        stakeholderEmail: {
            fontSize: 13,
            color: colors.textSubtle,
        },
        stakeholderDetails: {
            flexDirection: 'row',
            gap: 24,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
            marginBottom: 12,
        },
        stakeholderDetailRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        stakeholderDetailLabel: {
            fontSize: 13,
            color: colors.textMuted,
        },
        stakeholderDetailValue: {
            fontSize: 13,
            color: colors.text,
            fontWeight: '500',
        },
        stakeholderActions: {
            flexDirection: 'row',
            gap: 8,
            flexWrap: 'wrap',
        },
        stakeholderActionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        stakeholderActionBtnPrimary: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        stakeholderActionBtnDanger: {
            backgroundColor: 'transparent',
            borderColor: colors.dangerText,
        },
        stakeholderActionBtnText: {
            fontSize: 13,
            color: colors.text,
            fontWeight: '500',
        },
        stakeholderActionBtnTextPrimary: {
            fontSize: 13,
            color: colors.glassActiveText,
            fontWeight: '500',
        },
        stakeholderActionBtnTextDanger: {
            fontSize: 13,
            color: colors.dangerText,
            fontWeight: '500',
        },
        memberAvatarLarge: {
            width: 48,
            height: 48,
            borderRadius: 24,
        },
        statusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 12,
        },
        statusActive: {
            backgroundColor: colors.successBg,
        },
        statusMuted: {
            backgroundColor: colors.warningBg,
        },
        statusBanned: {
            backgroundColor: colors.dangerBg,
        },
        statusBadgeText: {
            fontSize: 11,
            fontWeight: '600',
        },
        stakeholderDetailModal: {
            alignItems: 'center',
            paddingTop: 20,
        },
        stakeholderDetailSection: {
            width: '100%',
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        stakeholderDetailItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 8,
        },
        stakeholderDetailText: {
            fontSize: 14,
            color: colors.text,
        },
        modalCloseBtn: {
            position: 'absolute',
            top: 12,
            right: 12,
            padding: 8,
            zIndex: 10,
        },
        // Member Management Styles
        memberUsernameText: {
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 2,
        },
        memberActionMenuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
        },
        memberActionMenuText: {
            fontSize: 14,
            color: colors.text,
        },
        memberActionMenuDivider: {
            height: 1,
            backgroundColor: colors.glassBorder,
            marginVertical: 4,
        },
        memberActionMenuNote: {
            fontSize: 12,
            color: colors.textMuted,
            textAlign: 'center',
            paddingVertical: 12,
            fontStyle: 'italic',
        },
        memberDetailModal: {
            alignItems: 'center',
            paddingTop: 20,
        },
        memberDetailName: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        memberDetailUsername: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 8,
        },
        memberDetailSection: {
            width: '100%',
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        memberDetailItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 8,
        },
        memberDetailText: {
            fontSize: 14,
            color: colors.text,
        },
        memberDetailActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            marginTop: 20,
            width: '100%',
        },
        memberDetailActionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: colors.glassBgMuted,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        memberDetailActionBtnPrimary: {
            borderColor: colors.primary + '40',
            backgroundColor: colors.primary + '10',
        },
        memberDetailActionBtnWarning: {
            borderColor: colors.warningBg,
            backgroundColor: colors.warningBg,
        },
        memberDetailActionBtnSuccess: {
            borderColor: colors.successBg,
            backgroundColor: colors.successBg,
        },
        memberDetailActionBtnDanger: {
            borderColor: colors.dangerBg,
            backgroundColor: colors.dangerBg,
        },
        memberDetailActionText: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
        },
        memberDetailNote: {
            fontSize: 12,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 20,
            fontStyle: 'italic',
        },
        // Content Moderation Styles
        contentModerationSection: {
            marginBottom: 20,
        },
        contentModerationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        contentModerationRowInfo: {
            flex: 1,
            marginRight: 16,
        },
        contentModerationLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        contentModerationHint: {
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: 12,
        },
        toggleSwitch: {
            width: 48,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.glassBorder,
            padding: 3,
        },
        toggleSwitchActive: {
            backgroundColor: colors.primary,
        },
        toggleKnob: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.glassActiveText,
        },
        toggleKnobActive: {
            transform: [{ translateX: 22 }],
        },
        localContentModerationActions: {
            flexDirection: 'row',
            gap: 12,
        },
        localContentModerationActionBtn: {
            flex: 1,
            alignItems: 'center',
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
        },
        localContentModerationActionBtnActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        localContentModerationActionText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginTop: 8,
        },
        localContentModerationActionTextActive: {
            color: colors.glassActiveText,
        },
        localContentModerationActionHint: {
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 4,
            textAlign: 'center',
        },
        localContentModerationActionHintActive: {
            color: colors.textMuted,
        },
        contentModerationInput: {
            backgroundColor: colors.glassBgMuted,
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            minHeight: 80,
            textAlignVertical: 'top',
        },
        contentModerationSaveBtn: {
            backgroundColor: colors.primary,
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 8,
            alignItems: 'center',
            alignSelf: 'flex-start',
        },
        contentModerationSaveBtnText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.glassActiveText,
        },
        contentModerationAddWord: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 16,
        },
        contentModerationWordInput: {
            flex: 1,
            backgroundColor: colors.glassBgMuted,
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        contentModerationAddBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primary,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
        },
        contentModerationAddBtnText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.glassActiveText,
        },
        contentModerationWordList: {
            marginBottom: 12,
        },
        contentModerationEmpty: {
            alignItems: 'center',
            paddingVertical: 32,
        },
        contentModerationEmptyText: {
            fontSize: 15,
            fontWeight: '500',
            color: colors.text,
            marginTop: 12,
        },
        contentModerationEmptyHint: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 4,
        },
        contentModerationWordTags: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        contentModerationWordTag: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBgMuted,
            paddingVertical: 6,
            paddingLeft: 12,
            paddingRight: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        contentModerationWordTagText: {
            fontSize: 13,
            color: colors.text,
        },
        contentModerationWordTagRemove: {
            marginLeft: 6,
            padding: 4,
        },
        contentModerationWordCount: {
            fontSize: 12,
            color: colors.textMuted,
        },
        contentModerationTestSection: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 16,
        },
        contentModerationTestInput: {
            flex: 1,
            backgroundColor: colors.glassBgMuted,
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            minHeight: 60,
            textAlignVertical: 'top',
        },
        contentModerationTestBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.successText,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            alignSelf: 'flex-start',
        },
        contentModerationTestBtnText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.glassActiveText,
        },
        contentModerationTestResult: {
            borderRadius: 12,
            padding: 16,
        },
        contentModerationTestResultBlocked: {
            backgroundColor: colors.dangerBg,
            borderWidth: 1,
            borderColor: colors.dangerText + '40',
        },
        contentModerationTestResultAllowed: {
            backgroundColor: colors.successBg,
            borderWidth: 1,
            borderColor: colors.successText + '40',
        },
        contentModerationTestResultHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
        },
        contentModerationTestResultTitle: {
            fontSize: 14,
            fontWeight: '600',
        },
        contentModerationTestResultDetails: {
            marginTop: 8,
        },
        contentModerationTestResultLabel: {
            fontSize: 12,
            fontWeight: '500',
            color: colors.textMuted,
            marginBottom: 4,
        },
        contentModerationTestResultValue: {
            fontSize: 13,
            color: colors.text,
        },

        // RevShare Monitor styles
        revShareSectionLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
        },
        revShareStatCard: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 16,
            padding: 16,
            minWidth: 140,
            gap: 6,
        },
        revShareStatLabel: {
            fontSize: 11,
            fontWeight: '500',
            color: colors.textMuted,
            letterSpacing: 0.3,
        },
        revShareStatValue: {
            fontSize: 22,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.5,
        },
        revShareChartCard: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 16,
            padding: 16,
            marginBottom: 4,
            overflow: 'hidden',
        },
        revShareTableHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: colors.glassBorder,
            borderRadius: 10,
            marginBottom: 2,
        },
        revShareTableHeaderCell: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        revShareTableRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 10,
            gap: 4,
        },
        revShareTableRowAlt: {
            backgroundColor: colors.glassBg,
        },
        revShareTableRowExpanded: {
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        revShareTableCell: {
            fontSize: 13,
            color: colors.text,
            fontWeight: '500',
        },
        revShareCategoryBadge: {
            backgroundColor: colors.primary + '20',
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
            alignSelf: 'flex-start',
        },
        revShareCategoryText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.primary,
        },
        revShareExpandedDetail: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: colors.glassBorder,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            padding: 16,
            gap: 8,
            marginBottom: 2,
        },
        revShareDetailItem: {
            gap: 2,
        },
        revShareDetailLabel: {
            fontSize: 11,
            fontWeight: '500',
            color: colors.textMuted,
            letterSpacing: 0.3,
        },
        revShareDetailValue: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
        },
        partnerListingCard: {
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
            backgroundColor: colors.glassBg,
        },
        listingActionBtn: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 8,
        },
    });

export default CreditUnionAdminScreen;
