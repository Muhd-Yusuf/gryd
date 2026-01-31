import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    useWindowDimensions,
    Modal,
    Pressable,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { communityGet, communityPost, communityPatch, communityPut, communityDelete, getTenantId, getUserId, resolveTenantId, getOnlineStatus, updatePresence, setUserOnline, uploadFile, getAuthUser, initiateChannelCall, logout, inviteStakeholder, StakeholderBadge } from '../lib/api';
import { useTheme } from '../lib/theme';
import UserAvatar from './UserAvatar';
import VoiceMessagePlayer from './VoiceMessagePlayer';

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
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { width } = useWindowDimensions();
    const isMobile = width < 800;

    const handleLogout = async () => {
        try {
            await logout();
            router.replace('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    const userId = getUserId();
    const [tenantId, setTenantId] = useState(getTenantId());
    const [subgrids, setSubgrids] = useState<Subgrid[]>([]);
    const [activeSubgridId, setActiveSubgridId] = useState('');
    const [channels, setChannels] = useState<Channel[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [activeChannelId, setActiveChannelId] = useState('');
    const [posts, setPosts] = useState<Post[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [memberOnlineStatuses, setMemberOnlineStatuses] = useState<Record<string, boolean>>({});
    const [error, setError] = useState('');
    const [initialLoading, setInitialLoading] = useState(true);

    // UI State
    const [textChannelsOpen, setTextChannelsOpen] = useState(true);
    const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
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
    const expoRecordingRef = useRef<Audio.Recording | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const feedScrollRef = useRef<ScrollView>(null);

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
    const [editChannelId, setEditChannelId] = useState('');
    const [editChannelName, setEditChannelName] = useState('');
    const [editChannelType, setEditChannelType] = useState<'text' | 'voice'>('text');
    const [editChannelPrivate, setEditChannelPrivate] = useState(false);
    const [permissionChannelId, setPermissionChannelId] = useState('');
    const [channelPermissions, setChannelPermissions] = useState({
        members: true,
        stakeholders: true,
        serverAdmin: true,
        serverOwner: true,
    });
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isPrivateCategory, setIsPrivateCategory] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDescription, setNewEventDescription] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventType, setNewEventType] = useState<'event' | 'announcement'>('event');
    const [newEventLocation, setNewEventLocation] = useState('');
    const [showEventsView, setShowEventsView] = useState(false);
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

    // Privacy Settings
    const [allowDMs, setAllowDMs] = useState(true);
    const [showOnlineStatus, setShowOnlineStatus] = useState(true);

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
    const [commentsLoading, setCommentsLoading] = useState(false);

    // Moderation queue state (server settings)
    const [moderationQueue, setModerationQueue] = useState<ModerationFlag[]>([]);
    const [moderationLoading, setModerationLoading] = useState(false);
    const [moderationError, setModerationError] = useState('');
    const [moderationMenuOpen, setModerationMenuOpen] = useState<string | null>(null);
    const [moderationDetailOpen, setModerationDetailOpen] = useState(false);
    const [activeModerationItem, setActiveModerationItem] = useState<ModerationFlag | null>(null);
    const [moderationActionLoading, setModerationActionLoading] = useState(false);

    // Server Settings Tab
    const [settingsTab, setSettingsTab] = useState('server-profile');
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
    const [engagementSettings, setEngagementSettings] = useState({
        joinMessage: true,
        uploadNotice: true,
        emojiReactions: true,
        autoEmoji: true,
        stickersAutocomplete: false,
    });

    // Content Moderation (Prohibited Words) state
    const [contentModerationEnabled, setContentModerationEnabled] = useState(true);
    const [prohibitedWords, setProhibitedWords] = useState<string[]>([]);
    const [contentModerationAction, setContentModerationAction] = useState<'block' | 'flag' | 'censor'>('block');
    const [blockedMessage, setBlockedMessage] = useState('Your message contains prohibited content and cannot be sent.');
    const [newProhibitedWord, setNewProhibitedWord] = useState('');
    const [contentModerationLoading, setContentModerationLoading] = useState(false);
    const [contentModerationTestText, setContentModerationTestText] = useState('');
    const [contentModerationTestResult, setContentModerationTestResult] = useState<{ isProhibited: boolean; matchedWords: string[]; filteredContent: string } | null>(null);

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
        });
    }, []);

    // Load subgrids
    useEffect(() => {
        if (!tenantId) {
            console.log('[CUA Admin] No tenantId yet, skipping subgrids load');
            return;
        }
        console.log('[CUA Admin] Loading subgrids for tenant:', tenantId);
        communityGet(`/tenants/${tenantId}/subgrids`)
            .then((response) => {
                console.log('[CUA Admin] Subgrids response:', response);
                const list = response?.data || [];
                setSubgrids(list);
                if (list.length > 0 && !activeSubgridId) {
                    console.log('[CUA Admin] Setting active subgrid:', list[0]._id);
                    setActiveSubgridId(list[0]._id);
                    setServerName(list[0].name || '');
                    setServerDescription(list[0].description || '');
                    setServerLogoUrl(list[0].logoUrl || '');
                }
            })
            .catch((err) => {
                console.error('[CUA Admin] Failed to load subgrids:', err);
            })
            .finally(() => {
                setInitialLoading(false);
            });
    }, [tenantId]);

    // Load subgrid data
    useEffect(() => {
        if (!activeSubgridId) {
            console.log('[CUA Admin] No activeSubgridId, skipping subgrid data load');
            return;
        }
        console.log('[CUA Admin] Loading subgrid data for:', activeSubgridId);
        Promise.allSettled([
            communityGet(`/subgrids/${activeSubgridId}/channels`),
            communityGet(`/subgrids/${activeSubgridId}/posts`),
            communityGet(`/subgrids/${activeSubgridId}/members`),
            communityGet(`/subgrids/${activeSubgridId}/categories`),
            communityGet(`/subgrids/${activeSubgridId}/events`),
        ])
            .then(([channelsRes, postsRes, membersRes, categoriesRes, eventsRes]) => {
                console.log('[CUA Admin] Channels result:', channelsRes);
                console.log('[CUA Admin] Posts result:', postsRes);
                console.log('[CUA Admin] Members result:', membersRes);
                if (channelsRes.status === 'fulfilled') setChannels(channelsRes.value?.data || []);
                if (postsRes.status === 'fulfilled') setPosts(postsRes.value?.data || []);
                if (membersRes.status === 'fulfilled') setMembers(membersRes.value?.data || []);
                if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value?.data || []);
                if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value?.data || []);
            });
    }, [activeSubgridId]);

    // Set default channel
    useEffect(() => {
        if (channels.length && !activeChannelId) {
            const general = channels.find(c => c.name?.toLowerCase() === 'general');
            setActiveChannelId(general?._id || channels[0]._id);
        }
    }, [channels]);

    // Load messages for active channel with auto-refresh
    useEffect(() => {
        if (!activeSubgridId || !activeChannelId) return;

        const fetchMessages = () => {
            communityGet(`/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}`)
                .then((response) => setMessages(response?.data || []))
                .catch(() => setMessages([]));
        };

        // Initial fetch
        fetchMessages();

        // Auto-refresh every 5 seconds for real-time sync
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [activeSubgridId, activeChannelId]);

    useEffect(() => {
        if (!serverSettingsModalOpen || settingsTab !== 'bans' || !activeSubgridId) return;
        loadModerationQueue();
    }, [serverSettingsModalOpen, settingsTab, activeSubgridId]);

    // Load content moderation settings when entering that tab
    useEffect(() => {
        if (!serverSettingsModalOpen || settingsTab !== 'content-moderation' || !activeSubgridId) return;
        loadContentModerationSettings();
    }, [serverSettingsModalOpen, settingsTab, activeSubgridId]);

    // Fetch and update member online statuses
    useEffect(() => {
        if (!activeSubgridId || members.length === 0) return;

        // Update current user's presence
        updatePresence(activeSubgridId);

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
    }, [messages]);

    useEffect(() => {
        if (!activeSubgridId) return;
        const current = subgrids.find((s) => s._id === activeSubgridId);
        if (!current) return;
        setServerName(current.name || '');
        setServerDescription(current.description || '');
        setServerLogoUrl(current.logoUrl || '');
    }, [activeSubgridId, subgrids]);

    const activeSubgrid = subgrids.find((s) => s._id === activeSubgridId);
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

    // Check if server is empty (no channels)
    const isServerEmpty = channels.length === 0;

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

    // Scroll to bottom when new messages arrive (WhatsApp-style)
    useEffect(() => {
        if (feedItems.length > 0 && feedScrollRef.current) {
            // Small delay to ensure content is rendered
            setTimeout(() => {
                feedScrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [feedItems.length]);

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
            const path =
                reportTarget.type === 'post'
                    ? `/subgrids/${activeSubgridId}/posts/${reportTarget.id}/flag`
                    : `/subgrids/${activeSubgridId}/messages/${reportTarget.id}/flag`;
            await communityPost(path, { reason });
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
        setModerationLoading(true);
        setModerationError('');
        try {
            const response = await communityGet(`/subgrids/${activeSubgridId}/moderation`);
            setModerationQueue(response?.data || []);
        } catch (err: any) {
            setModerationError(err.message || 'Failed to load moderation queue.');
            setModerationQueue([]);
        } finally {
            setModerationLoading(false);
        }
    };

    // Content Moderation (Prohibited Words) functions
    const loadContentModerationSettings = async () => {
        if (!activeSubgridId) return;
        setContentModerationLoading(true);
        try {
            const response = await communityGet(`/subgrids/${activeSubgridId}/content-moderation`);
            const settings = response?.data || {};
            setContentModerationEnabled(settings.enabled ?? true);
            setProhibitedWords(settings.prohibitedWords || []);
            setContentModerationAction(settings.action || 'block');
            setBlockedMessage(settings.blockedMessage || 'Your message contains prohibited content and cannot be sent.');
        } catch (err: any) {
            console.error('Failed to load content moderation settings:', err);
        } finally {
            setContentModerationLoading(false);
        }
    };

    const saveContentModerationSettings = async () => {
        if (!activeSubgridId) return;
        setContentModerationLoading(true);
        try {
            await communityPatch(`/subgrids/${activeSubgridId}/content-moderation`, {
                enabled: contentModerationEnabled,
                action: contentModerationAction,
                blockedMessage,
            });
            showSuccessModal('Settings Saved', 'Content moderation settings have been updated.');
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to save content moderation settings.');
            } else {
                Alert.alert('Error', err.message || 'Failed to save content moderation settings.');
            }
        } finally {
            setContentModerationLoading(false);
        }
    };

    const addProhibitedWord = async () => {
        if (!activeSubgridId || !newProhibitedWord.trim()) return;
        const word = newProhibitedWord.trim().toLowerCase();
        if (prohibitedWords.includes(word)) {
            if (Platform.OS === 'web') {
                window.alert('This word is already in the prohibited list.');
            } else {
                Alert.alert('Duplicate', 'This word is already in the prohibited list.');
            }
            return;
        }
        setContentModerationLoading(true);
        try {
            await communityPost(`/subgrids/${activeSubgridId}/content-moderation/words`, {
                words: [word],
            });
            setProhibitedWords((prev) => [...prev, word]);
            setNewProhibitedWord('');
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to add prohibited word.');
            } else {
                Alert.alert('Error', err.message || 'Failed to add prohibited word.');
            }
        } finally {
            setContentModerationLoading(false);
        }
    };

    const removeProhibitedWord = async (word: string) => {
        if (!activeSubgridId) return;
        setContentModerationLoading(true);
        try {
            await communityDelete(`/subgrids/${activeSubgridId}/content-moderation/words`, {
                words: [word],
            });
            setProhibitedWords((prev) => prev.filter((w) => w !== word));
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to remove prohibited word.');
            } else {
                Alert.alert('Error', err.message || 'Failed to remove prohibited word.');
            }
        } finally {
            setContentModerationLoading(false);
        }
    };

    const testContentModeration = async () => {
        if (!activeSubgridId || !contentModerationTestText.trim()) return;
        setContentModerationLoading(true);
        try {
            const response = await communityPost(`/subgrids/${activeSubgridId}/content-moderation/test`, {
                content: contentModerationTestText,
            });
            setContentModerationTestResult(response?.data || null);
        } catch (err: any) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Failed to test content moderation.');
            } else {
                Alert.alert('Error', err.message || 'Failed to test content moderation.');
            }
        } finally {
            setContentModerationLoading(false);
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
            await communityPost(`/subgrids/${activeSubgridId}/moderation/${flag._id}/action`, {
                action,
                reason: flag.reason || '',
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
            await communityPost(`/subgrids/${activeSubgridId}/channels`, {
                name: channelName,
                type: newChannelType,
                visibility: isPrivateChannel ? 'admin' : 'public',
            });
            const response = await communityGet(`/subgrids/${activeSubgridId}/channels`);
            setChannels(response?.data || []);
            setCreateChannelModalOpen(false);
            setNewChannelName('');
            setNewChannelType('text');
            setIsPrivateChannel(false);
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
            await communityPatch(`/subgrids/${activeSubgridId}/channels/${editChannelId}`, {
                name: channelName,
                type: editChannelType,
                visibility: editChannelPrivate ? 'admin' : 'public',
            });
            const response = await communityGet(`/subgrids/${activeSubgridId}/channels`);
            setChannels(response?.data || []);
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
        const visibility = channelPermissions.members ? 'public' : 'admin';
        try {
            await communityPatch(`/subgrids/${activeSubgridId}/channels/${permissionChannelId}`, {
                visibility,
            });
            const response = await communityGet(`/subgrids/${activeSubgridId}/channels`);
            setChannels(response?.data || []);
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

    const toggleEngagementSetting = (key: EngagementSettingKey) => {
        setEngagementSettings((prev) => ({ ...prev, [key]: !prev[key] }));
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
                // Remove member from subgrid
                await communityDelete(`/subgrids/${activeSubgridId}/members/${memberId}`);
                setMembers((prev) => prev.filter((m) => {
                    const id = m.userId || m.user?._id || m._id;
                    return String(id) !== String(memberId);
                }));
                showSuccessModal('Stakeholder Removed', 'The stakeholder has been removed from this server.');
            } else {
                // Mute or unmute member
                const newStatus = action === 'mute' ? 'muted' : 'active';
                await communityPatch(`/subgrids/${activeSubgridId}/members/${memberId}`, { status: newStatus });
                setMembers((prev) => prev.map((m) => {
                    const id = m.userId || m.user?._id || m._id;
                    if (String(id) === String(memberId)) {
                        return { ...m, status: newStatus };
                    }
                    return m;
                }));
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
                // Remove member from subgrid
                await communityDelete(`/subgrids/${activeSubgridId}/members/${memberId}`);
                setMembers((prev) => prev.filter((m) => {
                    const id = m.userId || m.user?._id || m._id;
                    return String(id) !== String(memberId);
                }));
                showSuccessModal('Member Removed', 'The member has been removed from this server.');
            } else if (action === 'suspend' || action === 'unsuspend') {
                // Suspend or unsuspend member
                const newStatus = action === 'suspend' ? 'suspended' : 'active';
                await communityPatch(`/subgrids/${activeSubgridId}/members/${memberId}`, { status: newStatus });
                setMembers((prev) => prev.map((m) => {
                    const id = m.userId || m.user?._id || m._id;
                    if (String(id) === String(memberId)) {
                        return { ...m, status: newStatus };
                    }
                    return m;
                }));
                showSuccessModal(
                    action === 'suspend' ? 'Member Suspended' : 'Member Unsuspended',
                    action === 'suspend' ? 'The member has been suspended and cannot access the server.' : 'The member can now access the server again.'
                );
            } else if (action === 'mute' || action === 'unmute') {
                // Mute or unmute member
                const newStatus = action === 'mute' ? 'muted' : 'active';
                await communityPatch(`/subgrids/${activeSubgridId}/members/${memberId}`, { status: newStatus });
                setMembers((prev) => prev.map((m) => {
                    const id = m.userId || m.user?._id || m._id;
                    if (String(id) === String(memberId)) {
                        return { ...m, status: newStatus };
                    }
                    return m;
                }));
                showSuccessModal(
                    action === 'mute' ? 'Member Muted' : 'Member Unmuted',
                    action === 'mute' ? 'The member has been muted and cannot send messages.' : 'The member can now send messages again.'
                );
            } else if (action === 'promote') {
                // Promote member to moderator
                await communityPatch(`/subgrids/${activeSubgridId}/members/${memberId}`, { role: 'moderator' });
                setMembers((prev) => prev.map((m) => {
                    const id = m.userId || m.user?._id || m._id;
                    if (String(id) === String(memberId)) {
                        return { ...m, role: 'moderator' };
                    }
                    return m;
                }));
                showSuccessModal('Member Promoted', 'The member has been promoted to Moderator.');
            } else if (action === 'demote') {
                // Demote member to regular member
                await communityPatch(`/subgrids/${activeSubgridId}/members/${memberId}`, { role: 'member' });
                setMembers((prev) => prev.map((m) => {
                    const id = m.userId || m.user?._id || m._id;
                    if (String(id) === String(memberId)) {
                        return { ...m, role: 'member' };
                    }
                    return m;
                }));
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
                await communityDelete(`/subgrids/${activeSubgridId}/channels/${id}`);
                const response = await communityGet(`/subgrids/${activeSubgridId}/channels`);
                setChannels(response?.data || []);
                if (activeChannelId === id) {
                    setActiveChannelId('');
                }
                showSuccessModal('Channel Deleted', 'The channel has been deleted successfully.');
            } else if (type === 'post') {
                await communityDelete(`/subgrids/${activeSubgridId}/posts/${id}`);
                setPosts(prev => prev.filter(p => p._id !== id));
                setItemMenuOpen(null);
                showSuccessModal('Post Deleted', 'The post has been deleted successfully.');
            } else if (type === 'message') {
                await communityDelete(`/subgrids/${activeSubgridId}/messages/${id}`);
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
        try {
            await communityPost(`/subgrids/${activeSubgridId}/categories`, {
                name: newCategoryName.trim(),
                visibility: isPrivateCategory ? 'private' : 'public',
            });
            const response = await communityGet(`/subgrids/${activeSubgridId}/categories`);
            setCategories(response?.data || []);
            setCreateCategoryModalOpen(false);
            setNewCategoryName('');
            setIsPrivateCategory(false);
        } catch (err: any) {
            setError(err.message || 'Failed to create category.');
        }
    };

    const handleCreateEvent = async () => {
        if (!newEventTitle.trim() || !activeSubgridId) return;
        // For events, date is required; for announcements, date is optional
        if (newEventType === 'event' && !newEventDate.trim()) return;
        try {
            const eventData: any = {
                title: newEventTitle.trim(),
                description: newEventDescription.trim(),
                eventType: newEventType,
                location: newEventLocation.trim(),
            };
            // Only include startDate if provided (required for events, optional for announcements)
            if (newEventDate.trim()) {
                eventData.startDate = newEventDate;
            }
            await communityPost(`/subgrids/${activeSubgridId}/events`, eventData);
            const response = await communityGet(`/subgrids/${activeSubgridId}/events`);
            setEvents(response?.data || []);
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
            await communityDelete(`/subgrids/${activeSubgridId}/events/${eventId}`);
            setEvents(prev => prev.filter(e => e._id !== eventId));
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
            await communityPatch(`/subgrids/${activeSubgridId}`, {
                name: serverName.trim(),
                description: serverDescription.trim(),
                logoUrl: serverLogoUrl || '',
            });
            const response = await communityGet(`/tenants/${tenantId}/subgrids`);
            setSubgrids(response?.data || []);
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
            await communityPatch(`/subgrids/${activeSubgridId}`, { logoUrl: uploadUrl });
            const response = await communityGet(`/tenants/${tenantId}/subgrids`);
            setSubgrids(response?.data || []);
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
            await communityPatch(`/subgrids/${activeSubgridId}`, { logoUrl: '' });
            setServerLogoUrl('');
            const response = await communityGet(`/tenants/${tenantId}/subgrids`);
            setSubgrids(response?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to remove server icon.');
        }
    };

    const handleCreateServer = async () => {
        if (!tenantId || !newServerName.trim()) return;
        try {
            const response = await communityPost(`/tenants/${tenantId}/subgrids`, {
                name: newServerName.trim(),
                description: newServerDescription.trim(),
                visibility: newServerVisibility,
            });
            const created = response?.data;
            const refreshed = await communityGet(`/tenants/${tenantId}/subgrids`);
            setSubgrids(refreshed?.data || []);
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
            await communityPatch(`/subgrids/${activeSubgridId}`, { status: 'archived' });
            const response = await communityGet(`/tenants/${tenantId}/subgrids`);
            const updated = response?.data || [];
            setSubgrids(updated);
            setActiveSubgridId(updated[0]?._id || '');
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

    const handleSendMessage = async () => {
        if ((!messageDraft.trim() && attachments.length === 0) || !activeSubgridId || !activeChannelId) return;
        try {
            // Upload attachments first if any
            const uploadedAttachments: Array<{ type: string; value: string; mimeType?: string; fileName?: string }> = [];

            for (const att of attachments) {
                try {
                    console.log('[CUAdmin] Uploading attachment:', att.name, att.type);
                    const uploadResult = await uploadFile(
                        { uri: att.uri, name: att.name, type: att.type },
                        { type: 'chat', subgridId: activeSubgridId }
                    );
                    console.log('[CUAdmin] Upload result:', uploadResult);
                    // uploadFile returns { success: true, data: { url: '...' } }
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
                body: messageDraft.trim(),
            };

            if (uploadedAttachments.length > 0) {
                messagePayload.attachments = uploadedAttachments;
            }

            await communityPost(`/subgrids/${activeSubgridId}/messages`, messagePayload);
            setMessageDraft('');
            setAttachments([]);
            const response = await communityGet(`/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}`);
            setMessages(response?.data || []);
        } catch (err: any) {
            console.error('Failed to send message:', err.message);
        }
    };

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
            await communityPost(`/subgrids/${activeSubgridId}/messages/${messageId}/pin`, {});
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
            await communityDelete(`/subgrids/${activeSubgridId}/messages/${messageId}/pin`);
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
        if (!activeSubgridId || !activeChannelId) return;
        try {
            // Upload voice note first
            const uploadResult = await uploadFile(
                { uri: dataUrl, name: `voice_${Date.now()}.webm`, type: mimeType },
                { type: 'voice-note', subgridId: activeSubgridId }
            );

            if (uploadResult?.url) {
                // Send message with voice attachment
                await communityPost(`/subgrids/${activeSubgridId}/messages`, {
                    channelId: activeChannelId,
                    body: '',
                    attachments: [{
                        type: 'voice',
                        value: uploadResult.url,
                        mimeType,
                        durationMs,
                    }],
                });
                // Refresh messages
                const response = await communityGet(`/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}`);
                setMessages(response?.data || []);
            }
        } catch (err: any) {
            console.error('Failed to send voice note:', err.message);
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
                    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                    const durationMs = Date.now() - recordingStartRef.current;
                    const dataUrl = await blobToDataUrl(blob);
                    await sendVoiceNote(dataUrl, blob.type, durationMs);
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

        // Native recording using expo-av
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                setRecordingError('Microphone permission denied');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            expoRecordingRef.current = newRecording;
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

        // Native recording
        if (expoRecordingRef.current) {
            try {
                await expoRecordingRef.current.stopAndUnloadAsync();
                const uri = expoRecordingRef.current.getURI();
                const durationMs = Date.now() - recordingStartRef.current;

                if (uri && activeSubgridId) {
                    const result = await uploadFile(
                        { uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' },
                        { type: 'voice-note', subgridId: activeSubgridId }
                    );

                    if (result?.url) {
                        await communityPost(`/subgrids/${activeSubgridId}/messages`, {
                            channelId: activeChannelId,
                            body: '',
                            attachments: [{
                                type: 'voice',
                                value: result.url,
                                mimeType: 'audio/m4a',
                                durationMs,
                            }],
                        });
                        const response = await communityGet(`/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}`);
                        setMessages(response?.data || []);
                    }
                }
            } catch (err: any) {
                setRecordingError(err.message || 'Failed to save recording.');
            } finally {
                expoRecordingRef.current = null;
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
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

        // Native recording
        if (expoRecordingRef.current) {
            try {
                await expoRecordingRef.current.stopAndUnloadAsync();
            } catch { }
            expoRecordingRef.current = null;
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
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
        const endpoint = isPost ? 'posts' : 'messages';
        const items = isPost ? posts : messages;
        const setItems = isPost ? setPosts : setMessages;
        try {
            const item = items.find(i => i._id === itemId);
            if (item?.userLiked) {
                // Unlike
                await communityDelete(`/subgrids/${activeSubgridId}/${endpoint}/${itemId}/like`);
                setItems(prev => prev.map(i =>
                    i._id === itemId
                        ? { ...i, likeCount: Math.max(0, (i.likeCount || 0) - 1), userLiked: false }
                        : i
                ));
            } else {
                // Like
                await communityPost(`/subgrids/${activeSubgridId}/${endpoint}/${itemId}/like`, {});
                setItems(prev => prev.map(i =>
                    i._id === itemId
                        ? { ...i, likeCount: (i.likeCount || 0) + 1, userLiked: true }
                        : i
                ));
            }
        } catch (err: any) {
            console.error(`Failed to like/unlike ${endpoint}:`, err.message);
        }
    };

    // Reshare a feed item (post or message)
    const handleReshareItem = async (itemId: string, isPost: boolean) => {
        if (!activeSubgridId) return;
        const endpoint = isPost ? 'posts' : 'messages';
        const items = isPost ? posts : messages;
        const setItems = isPost ? setPosts : setMessages;
        try {
            const item = items.find(i => i._id === itemId);
            if (item?.userReshared) {
                // Unreshare
                await communityDelete(`/subgrids/${activeSubgridId}/${endpoint}/${itemId}/reshare`);
                setItems(prev => prev.map(i =>
                    i._id === itemId
                        ? { ...i, reshareCount: Math.max(0, (i.reshareCount || 0) - 1), userReshared: false }
                        : i
                ));
            } else {
                // Reshare
                await communityPost(`/subgrids/${activeSubgridId}/${endpoint}/${itemId}/reshare`, {});
                setItems(prev => prev.map(i =>
                    i._id === itemId
                        ? { ...i, reshareCount: (i.reshareCount || 0) + 1, userReshared: true }
                        : i
                ));
            }
        } catch (err: any) {
            console.error(`Failed to reshare/unreshare ${endpoint}:`, err.message);
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
        setCommentsLoading(true);
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
        } finally {
            setCommentsLoading(false);
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
            const endpoint = commentTarget.isPost
                ? `/subgrids/${activeSubgridId}/posts/${commentTarget.id}/comments`
                : `/subgrids/${activeSubgridId}/messages/${commentTarget.id}/comments`;

            const res = await communityPost(endpoint, { body: commentText.trim() });
            console.log('[Comment] Created comment:', res);

            // Add the new comment to the list
            setComments(prev => [...prev, res.comment || res]);
            setCommentText('');

            // Update local state for comment count
            if (commentTarget.isPost) {
                setPosts(prev => prev.map(p =>
                    p._id === commentTarget.id
                        ? { ...p, commentCount: (p.commentCount || 0) + 1 }
                        : p
                ));
            } else {
                setMessages(prev => prev.map(m =>
                    m._id === commentTarget.id
                        ? { ...m, commentCount: (m.commentCount || 0) + 1 }
                        : m
                ));
            }
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
                <MaterialIcons name="person-add" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setCreateChannelModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Create Channel</Text>
                <MaterialIcons name="add" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setCreateCategoryModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Create Category</Text>
                <MaterialIcons name="create-new-folder" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setCreateEventModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Create Event</Text>
                <MaterialCommunityIcons name="calendar-plus" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setServerSettingsModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Server Settings</Text>
                <MaterialIcons name="settings" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setNotificationSettingsModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Notification Settings</Text>
                <MaterialIcons name="notifications" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setServerMenuOpen(false); setPrivacySettingsModalOpen(true); }}
            >
                <Text style={styles.dropdownText}>Privacy Settings</Text>
                <MaterialIcons name="shield" size={18} color={colors.textMuted} />
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
                <Text style={styles.emptyServerName}>{activeSubgrid?.name || 'RBFCU Server'}</Text>
                <Text style={styles.emptyServerSubtitle}>
                    This is your brand new server. Here are some steps to help you get started
                </Text>

                <TouchableOpacity
                    style={styles.welcomeActionBtn}
                    onPress={() => setInviteModalOpen(true)}
                >
                    <Text style={styles.welcomeActionText}>Invite your friends</Text>
                    <MaterialIcons name="add" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.welcomeActionBtn}
                    onPress={() => setServerSettingsModalOpen(true)}
                >
                    <Text style={styles.welcomeActionText}>Personalize your server with an icon</Text>
                    <MaterialIcons name="add" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.welcomeActionBtn}
                    onPress={() => setCreateChannelModalOpen(true)}
                >
                    <Text style={styles.welcomeActionText}>Send your first message</Text>
                    <MaterialIcons name="add" size={18} color={colors.textMuted} />
                </TouchableOpacity>
            </View>
        </View>
    );

    if (initialLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 16, color: colors.textMuted, fontSize: 16 }}>Loading server...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View pointerEvents="none" style={styles.gridBackground} />
            {/* Top Navigation */}
            <View style={styles.topNav}>
                <View style={styles.topNavLeft}>
                    <MaterialIcons name="tag" size={24} color={colors.text} />
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                <View style={styles.topNavTabs}>
                    <TouchableOpacity style={styles.tabActive}>
                        <Text style={styles.tabTextActive}>Server</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.tab} onPress={() => router.push('/admin/messages')}>
                        <Text style={styles.tabText}>Messages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.tab} onPress={() => router.push('/admin/contributors')}>
                        <Text style={styles.tabText}>Top Contributors</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.mainArea}>
                {/* Left Icon Rail */}
                <View style={styles.iconRail}>
                    <TouchableOpacity style={styles.railLogo}>
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
                    <TouchableOpacity style={styles.railButton} onPress={() => router.push('/admin/messages')}>
                        <MaterialIcons name="message" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={styles.railButton} onPress={() => router.push('/admin/contributors')}>
                        <MaterialIcons name="emoji-events" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.railButton} onPress={toggleTheme}>
                        {mode === 'dark' ? (
                            <MaterialIcons name="light-mode" size={18} color={colors.textMuted} />
                        ) : (
                            <MaterialIcons name="dark-mode" size={18} color={colors.textMuted} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.exitButton} onPress={handleLogout}>
                        <MaterialIcons name="close" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {/* Channel Sidebar */}
                <View style={styles.channelSidebar}>
                    {/* Server Header with Dropdown */}
                    <View style={styles.serverHeaderContainer}>
                        <View style={styles.serverHeader}>
                            <View style={[styles.serverHeaderLeft, { flex: 1, overflow: 'hidden', paddingRight: 4 }]}>
                                <View style={{ flex: 1 }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ alignItems: 'center', paddingRight: 16 }}>
                                        <Text style={styles.serverName} numberOfLines={1}>{activeSubgrid?.name || 'RBFCU Server'}</Text>
                                    </ScrollView>
                                </View>
                                <TouchableOpacity onPress={() => setServerSettingsModalOpen(true)} style={{ marginLeft: 4 }}>
                                    <MaterialIcons name="settings" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => setServerMenuOpen(!serverMenuOpen)}>
                                <MaterialIcons name="person-add" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        {serverMenuOpen && <ServerMenuDropdown />}
                    </View>

                    <ScrollView style={styles.channelList} showsVerticalScrollIndicator={false}>
                        {/* Events */}
                        <TouchableOpacity
                            style={[styles.eventsButton, showEventsView && styles.eventsButtonActive]}
                            onPress={() => setShowEventsView(!showEventsView)}
                        >
                            <MaterialIcons name="event" size={16} color={showEventsView ? colors.text : colors.textMuted} />
                            <Text style={[styles.eventsText, showEventsView && styles.eventsTextActive]}>Events</Text>
                            <TouchableOpacity
                                style={{ marginLeft: 'auto' }}
                                onPress={(e) => { e.stopPropagation(); setCreateEventModalOpen(true); }}
                            >
                                <MaterialIcons name="add" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </TouchableOpacity>

                        {/* Text Channels */}
                        <View style={styles.channelGroup}>
                            <View style={styles.channelGroupHeader}>
                                <TouchableOpacity
                                    style={styles.channelGroupToggle}
                                    onPress={() => setTextChannelsOpen(!textChannelsOpen)}
                                >
                                    <MaterialIcons
                                        name="expand-more"
                                        size={12}
                                        color={colors.textMuted}
                                        style={!textChannelsOpen ? { transform: [{ rotate: '-90deg' }] } : undefined}
                                    />
                                    <Text style={styles.channelGroupTitle}>Text Channels</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    setNewChannelType('text');
                                    setCreateChannelModalOpen(true);
                                }}>
                                    <MaterialIcons name="add" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                            {textChannelsOpen && textChannels.map((channel) => {
                                const isActive = channel._id === activeChannelId;
                                return (
                                    <TouchableOpacity
                                        key={channel._id}
                                        style={[styles.channelItem, isActive && styles.channelItemActive]}
                                        onPress={() => {
                                            setActiveChannelId(channel._id);
                                        }}
                                    >
                                        <MaterialIcons name="tag" size={16} color={isActive ? colors.text : colors.textMuted} />
                                        <View style={{ flex: 1, marginRight: 8, justifyContent: 'center' }}>
                                            <Text style={[styles.channelName, isActive && styles.channelNameActive]} numberOfLines={1} ellipsizeMode="tail">
                                                {channel.name || 'untitled'}
                                            </Text>
                                        </View>
                                        {isActive && (
                                            <View style={styles.channelActions}>
                                                <TouchableOpacity
                                                    onPress={(e) => { e.stopPropagation(); setInviteModalOpen(true); }}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <MaterialIcons name="person-add" size={14} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        openChannelSettingsModal(channel);
                                                    }}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <MaterialIcons name="settings" size={14} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                            {textChannelsOpen && textChannels.length === 0 && (
                                <Text style={styles.emptyText}>No text channels</Text>
                            )}
                        </View>

                        {/* Voice Channels */}
                        <View style={styles.channelGroup}>
                            <View style={styles.channelGroupHeader}>
                                <TouchableOpacity
                                    style={styles.channelGroupToggle}
                                    onPress={() => setVoiceChannelsOpen(!voiceChannelsOpen)}
                                >
                                    <MaterialIcons
                                        name="expand-more"
                                        size={12}
                                        color={colors.textMuted}
                                        style={!voiceChannelsOpen ? { transform: [{ rotate: '-90deg' }] } : undefined}
                                    />
                                    <Text style={styles.channelGroupTitle}>Voice Channels</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    setNewChannelType('voice');
                                    setCreateChannelModalOpen(true);
                                }}>
                                    <MaterialIcons name="add" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                            {voiceChannelsOpen && voiceChannels.map((channel) => (
                                <TouchableOpacity
                                    key={channel._id}
                                    style={styles.channelItem}
                                    onPress={() => {
                                        handleVoiceChannelClick(channel);
                                    }}
                                >
                                    <MaterialIcons name="headphones" size={16} color={colors.textMuted} />
                                    <View style={{ flex: 1, marginRight: 8, justifyContent: 'center' }}>
                                        <Text style={styles.channelName} numberOfLines={1} ellipsizeMode="tail">
                                            {channel.name || 'untitled'}
                                        </Text>
                                    </View>
                                    <View style={styles.channelActions}>
                                        <TouchableOpacity
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                openChannelSettingsModal(channel);
                                            }}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <MaterialIcons name="settings" size={14} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {voiceChannelsOpen && voiceChannels.length === 0 && (
                                <Text style={styles.emptyText}>No voice channels</Text>
                            )}
                        </View>
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
                                    <MaterialIcons name="mic" size={14} color={colors.textMuted} />
                                    <MaterialIcons name="expand-more" size={10} color={colors.textMuted} />
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
                                                {selectedMic === option && <MaterialIcons name="check" size={14} color="#22C55E" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <View style={styles.dropdownWrapper}>
                                <TouchableOpacity style={styles.userActionBtn} onPress={() => { setShowHeadphoneDropdown(!showHeadphoneDropdown); setShowMicDropdown(false); }}>
                                    <MaterialIcons name="headphones" size={14} color={colors.textMuted} />
                                    <MaterialIcons name="expand-more" size={10} color={colors.textMuted} />
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
                                                {selectedHeadphone === option && <MaterialIcons name="check" size={14} color="#22C55E" />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setServerSettingsModalOpen(true)}>
                                <MaterialIcons name="settings" size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Main Content */}
                <Pressable
                    style={styles.mainContent}
                    onPress={() => {
                        if (serverMenuOpen) setServerMenuOpen(false);
                    }}
                >
                    {showEventsView ? (
                        /* Events View */
                        <>
                            <View style={styles.contentHeader}>
                                <View style={styles.contentHeaderLeft}>
                                    <MaterialIcons name="event" size={18} color={colors.textMuted} />
                                    <Text style={styles.contentTitle}>Events & Announcements</Text>
                                </View>
                                <View style={styles.contentHeaderRight}>
                                    <TouchableOpacity
                                        style={styles.createEventHeaderBtn}
                                        onPress={() => setCreateEventModalOpen(true)}
                                    >
                                        <MaterialIcons name="add" size={16} color="#FFFFFF" />
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
                                            <MaterialIcons name="event" size={32} color={colors.textMuted} />
                                        </View>
                                        <Text style={styles.welcomeTitle}>No Events Yet</Text>
                                        <Text style={styles.welcomeSubtitle}>Create your first event or announcement to keep members informed.</Text>
                                        <TouchableOpacity
                                            style={styles.editChannelBtn}
                                            onPress={() => setCreateEventModalOpen(true)}
                                        >
                                            <MaterialIcons name="add" size={14} color={colors.text} />
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
                                                    <MaterialIcons
                                                        name={event.eventType === 'announcement' ? 'campaign' : 'event'}
                                                        size={12}
                                                        color="#FFFFFF"
                                                    />
                                                    <Text style={styles.eventTypeBadgeText}>
                                                        {event.eventType === 'announcement' ? 'Announcement' : 'Event'}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={styles.eventDeleteBtn}
                                                    onPress={() => handleDeleteEvent(event._id)}
                                                >
                                                    <MaterialIcons name="delete" size={16} color={colors.dangerText} />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.eventTitle}>{event.title}</Text>
                                            {event.description && (
                                                <Text style={styles.eventDescription}>{event.description}</Text>
                                            )}
                                            <View style={styles.eventMeta}>
                                                {event.startDate && (
                                                    <View style={styles.eventMetaItem}>
                                                        <MaterialIcons name="schedule" size={14} color={colors.textMuted} />
                                                        <Text style={styles.eventMetaText}>{formatEventDate(event.startDate)}</Text>
                                                    </View>
                                                )}
                                                {event.location && (
                                                    <View style={styles.eventMetaItem}>
                                                        <MaterialIcons name="location-on" size={14} color={colors.textMuted} />
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
                    <View style={styles.contentHeader}>
                        <View style={styles.contentHeaderLeft}>
                            <MaterialIcons name="tag" size={18} color={colors.textMuted} />
                            <Text style={styles.contentTitle}>{activeChannel?.name || 'general'}</Text>
                        </View>
                        <View style={styles.contentHeaderRight}>
                            <TouchableOpacity style={styles.headerIcon} onPress={() => setShowPinnedMessages(!showPinnedMessages)}>
                                <MaterialIcons name="push-pin" size={18} color={showPinnedMessages ? colors.text : colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerIcon} onPress={() => setNotificationSettingsModalOpen(true)}>
                                <MaterialIcons name="notifications" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerIcon} onPress={() => setShowMembersSidebar(!showMembersSidebar)}>
                                <MaterialIcons name="group" size={18} color={showMembersSidebar ? colors.text : colors.textMuted} />
                            </TouchableOpacity>
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
                                        <MaterialIcons name="close" size={14} color={colors.textMuted} />
                                    </TouchableOpacity>
                                ) : (
                                    <MaterialIcons name="search" size={14} color={colors.textMuted} />
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Show Empty State or Feed */}
                    {isServerEmpty ? (
                        <EmptyServerWelcome />
                    ) : (
                        <>
                            {/* Feed */}
                            <ScrollView
                                ref={feedScrollRef}
                                style={styles.feedContainer}
                                contentContainerStyle={styles.feedContent}
                                showsVerticalScrollIndicator={false}
                                onContentSizeChange={() => {
                                    // Auto-scroll to bottom when content changes (new messages)
                                    feedScrollRef.current?.scrollToEnd({ animated: false });
                                }}
                            >
                                {feedItems.length === 0 && feedSearchQuery.trim() && (
                                    <View style={styles.welcomeCard}>
                                        <View style={styles.welcomeIcon}>
                                            <MaterialIcons name="search-off" size={32} color={colors.textMuted} />
                                        </View>
                                        <Text style={styles.welcomeTitle}>No results found</Text>
                                        <Text style={styles.welcomeSubtitle}>No messages or posts match "{feedSearchQuery}"</Text>
                                        <TouchableOpacity
                                            style={styles.editChannelBtn}
                                            onPress={() => setFeedSearchQuery('')}
                                        >
                                            <MaterialIcons name="close" size={14} color={colors.text} />
                                            <Text style={styles.editChannelText}>Clear search</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {feedItems.length === 0 && !feedSearchQuery.trim() && (
                                    <View style={styles.welcomeCard}>
                                        <View style={styles.welcomeIcon}>
                                            <MaterialIcons name="tag" size={32} color={colors.textMuted} />
                                        </View>
                                        <Text style={styles.welcomeTitle}>Welcome to {activeChannel?.name || 'general'}</Text>
                                        <Text style={styles.welcomeSubtitle}>This is the start of the #{activeChannel?.name || 'general'} channel.</Text>
                                        <TouchableOpacity
                                            style={styles.editChannelBtn}
                                            onPress={() => {
                                                if (activeChannel) {
                                                    openEditChannelModal(activeChannel);
                                                }
                                            }}
                                        >
                                            <MaterialIcons name="edit" size={14} color={colors.text} />
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
                                                                <MaterialIcons name="verified" size={14} color="#3B82F6" />
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
                                                        <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
                                                    </View>
                                                    {getMemberCompany(authorMember) && (
                                                        <Text style={styles.postCompany}>{getMemberCompany(authorMember)}</Text>
                                                    )}
                                                </View>
                                                <View style={styles.itemMenuContainer}>
                                                    <TouchableOpacity onPress={(e) => handleOpenItemMenu(e, item, isPost)}>
                                                        <MaterialIcons name="more-horiz" size={18} color={colors.textMuted} />
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
                                                                        <MaterialIcons name="repeat" size={14} color={colors.textMuted} />
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
                                                                />
                                                            );
                                                        }

                                                        // Handle video attachments (NOT .webm for voice notes - only mp4/mov/avi)
                                                        const isVideo = attType === 'video' ||
                                                            mimeType?.startsWith('video/') ||
                                                            /\.(mp4|mov|avi|mkv)(\?|$)/i.test(url);
                                                        if (isVideo) {
                                                            return (
                                                                <View key={`${item._id}-att-${idx}`} style={styles.videoPlaceholder}>
                                                                    <MaterialIcons name="play-circle-filled" size={48} color="#FFFFFF" />
                                                                    <Text style={styles.videoLabel}>Video</Text>
                                                                </View>
                                                            );
                                                        }

                                                        // Handle audio/voice attachments (including .webm voice notes)
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

                                                        // Handle file attachments
                                                        return (
                                                            <View key={`${item._id}-att-${idx}`} style={styles.fileAttachment}>
                                                                <MaterialIcons name="insert-drive-file" size={20} color={colors.textMuted} />
                                                                <Text style={styles.fileLabel} numberOfLines={1}>{att?.fileName || att?.label || 'File'}</Text>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                            {/* Show reactions for all feed items (posts and messages) */}
                                            <View style={styles.postStats}>
                                                <TouchableOpacity style={styles.statItem} onPress={() => handleCommentPress(item._id, isPost)}>
                                                    <MaterialIcons name="chat-bubble" size={16} color={colors.textMuted} />
                                                    <Text style={styles.statText}>{commentCount}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.statItem} onPress={() => handleLikeItem(item._id, isPost)}>
                                                    <MaterialIcons name="favorite" size={16} color={userLiked ? '#EF4444' : colors.textMuted} />
                                                    <Text style={[styles.statText, userLiked && { color: '#EF4444' }]}>{likeCount}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.statItem} onPress={() => handleReshareItem(item._id, isPost)}>
                                                    <MaterialIcons name="repeat" size={16} color={userReshared ? '#22C55E' : colors.textMuted} />
                                                    <Text style={[styles.statText, userReshared && { color: '#22C55E' }]}>{reshareCount}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            {/* Attachment Preview */}
                            {attachments.length > 0 && (
                                <View style={styles.attachmentPreview}>
                                    {attachments.map((attachment, index) => (
                                        <View key={index} style={styles.attachmentItem}>
                                            {attachment.type.startsWith('image/') ? (
                                                <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} />
                                            ) : (
                                                <View style={styles.attachmentFileIcon}>
                                                    <MaterialIcons name="insert-drive-file" size={24} color={colors.textMuted} />
                                                </View>
                                            )}
                                            <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
                                            <TouchableOpacity style={styles.attachmentRemove} onPress={() => handleRemoveAttachment(index)}>
                                                <MaterialIcons name="close" size={16} color={colors.textMuted} />
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
                                        <TouchableOpacity style={styles.recordingCancelBtn} onPress={handleCancelRecording}>
                                            <MaterialIcons name="delete" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.recordingStopBtn} onPress={handleStopRecording}>
                                            <MaterialIcons name="stop" size={20} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                /* Message Input */
                                <View style={styles.messageInputContainer}>
                                    <View style={styles.messageInputLeft}>
                                        <TouchableOpacity style={styles.inputIcon} onPress={handlePickImage}>
                                            <MaterialIcons name="add-circle" size={22} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.messageInputMiddle}>
                                        <TextInput
                                            style={styles.messageInput}
                                            placeholder={`Message #${activeChannel?.name || 'general'}`}
                                            placeholderTextColor={colors.textSubtle}
                                            value={messageDraft}
                                            onChangeText={setMessageDraft}
                                            onSubmitEditing={handleSendMessage}
                                        />
                                        <View style={styles.messageInputActions}>
                                            <TouchableOpacity style={styles.inputActionIcon} onPress={handlePickFile}>
                                                <MaterialIcons name="attach-file" size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.inputActionIcon} onPress={() => setShowEmojiPicker(true)}>
                                                <MaterialIcons name="emoji-emotions" size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.inputActionIcon} onPress={handleStartRecording}>
                                                <MaterialIcons name="mic" size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            {(messageDraft.trim() || attachments.length > 0) ? (
                                                <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                                                    <MaterialIcons name="send" size={18} color="#FFFFFF" />
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                        </>
                    )}
                </Pressable>

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


            {/* Create Channel Modal */}
            <Modal visible={createChannelModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setCreateChannelModalOpen(false)}>
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                                <MaterialIcons name="tag" size={20} color={colors.textMuted} />
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
                                <MaterialIcons name="headphones" size={20} color={colors.textMuted} />
                            </View>
                            <View style={styles.typeInfo}>
                                <Text style={styles.typeTitle}>Voice</Text>
                                <Text style={styles.typeDesc}>Hang out together with voice, video, and screen share</Text>
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.modalLabel}>CHANNEL NAME</Text>
                        <View style={styles.inputRow}>
                            <MaterialIcons name="tag" size={18} color={colors.textMuted} />
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
                                <MaterialIcons name="lock" size={16} color={colors.textMuted} />
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
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                                <MaterialIcons name="tag" size={20} color={colors.textMuted} />
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
                                <MaterialIcons name="headphones" size={20} color={colors.textMuted} />
                            </View>
                            <View style={styles.typeInfo}>
                                <Text style={styles.typeTitle}>Voice</Text>
                                <Text style={styles.typeDesc}>Hang out together with voice, video, and screen share</Text>
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.modalLabel}>CHANNEL NAME</Text>
                        <View style={styles.inputRow}>
                            <MaterialIcons name="tag" size={18} color={colors.textMuted} />
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
                                <MaterialIcons name="lock" size={16} color={colors.textMuted} />
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
                            <MaterialIcons name="edit" size={18} color="#9CA3AF" />
                            <Text style={styles.channelSettingsText}>Rename Channel</Text>
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
                            <MaterialIcons name="delete" size={18} color="#EF4444" />
                            <Text style={[styles.channelSettingsText, { color: '#EF4444' }]}>Delete Channel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.channelSettingsItem}
                            onPress={() => {
                                if (selectedSettingsChannel) openChannelPermissionModal(selectedSettingsChannel);
                            }}
                        >
                            <MaterialIcons name="settings" size={18} color="#9CA3AF" />
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
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                                        <MaterialIcons
                                            name={isChecked ? 'check-box' : 'check-box-outline-blank'}
                                            size={18}
                                            color={isChecked ? colors.text : colors.textMuted}
                                        />
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

            {/* Invite Member Modal */}
            <Modal visible={inviteModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setInviteModalOpen(false)}>
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={styles.modalIconWrap}>
                            <MaterialIcons name="badge" size={28} color="#8B5CF6" />
                            <View style={[styles.modalIconBadge, { backgroundColor: '#8B5CF6' }]}>
                                <MaterialIcons name="add" size={10} color="#FFFFFF" />
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
                                                <MaterialIcons name="check" size={10} color="#FFFFFF" />
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
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                                <MaterialIcons name="emoji-emotions" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.privateCategoryRow}>
                            <MaterialIcons name="lock" size={18} color={colors.text} />
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
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>{newEventType === 'announcement' ? 'Create Announcement' : 'Create Event'}</Text>

                        <Text style={styles.modalLabel}>TYPE</Text>
                        <View style={styles.eventTypeSelector}>
                            <TouchableOpacity
                                style={[styles.eventTypeOption, newEventType === 'event' && styles.eventTypeOptionActive]}
                                onPress={() => setNewEventType('event')}
                            >
                                <MaterialIcons name="event" size={18} color={newEventType === 'event' ? '#FFFFFF' : colors.textMuted} />
                                <Text style={[styles.eventTypeOptionText, newEventType === 'event' && styles.eventTypeOptionTextActive]}>Event</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.eventTypeOption, newEventType === 'announcement' && styles.eventTypeOptionActive]}
                                onPress={() => setNewEventType('announcement')}
                            >
                                <MaterialIcons name="campaign" size={18} color={newEventType === 'announcement' ? '#FFFFFF' : colors.textMuted} />
                                <Text style={[styles.eventTypeOptionText, newEventType === 'announcement' && styles.eventTypeOptionTextActive]}>Announcement</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalLabel}>{newEventType === 'announcement' ? 'ANNOUNCEMENT TITLE' : 'EVENT TITLE'}</Text>
                        <View style={styles.inputRow}>
                            <MaterialIcons name={newEventType === 'announcement' ? 'campaign' : 'event'} size={18} color={colors.textMuted} />
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
                            <MaterialIcons name="schedule" size={18} color={colors.textMuted} />
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
                                    <MaterialIcons name="location-on" size={18} color={colors.textMuted} />
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
            <Modal visible={serverSettingsModalOpen} transparent animationType="fade">
                <View style={styles.settingsFullPage}>
                    {/* Settings Sidebar */}
                    <View style={styles.settingsSidebar}>
                        <View style={styles.settingsSidebarHeader}>
                            <MaterialIcons name="tag" size={16} color="#FFFFFF" />
                            <Text style={styles.settingsSidebarTitle}>THE GRYD</Text>
                        </View>

                        <Text style={styles.settingsSectionLabel}>{activeSubgrid?.name || 'RBFCU Server'}</Text>

                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'server-profile' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('server-profile')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'server-profile' && styles.settingsNavTextActive]}>Server Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'engagement' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('engagement')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'engagement' && styles.settingsNavTextActive]}>Engagement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'members' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('members')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'members' && styles.settingsNavTextActive]}>Members</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'stakeholders' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('stakeholders')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'stakeholders' && styles.settingsNavTextActive]}>Stakeholders</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'roles' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('roles')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'roles' && styles.settingsNavTextActive]}>Roles & Permissions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'invites' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('invites')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'invites' && styles.settingsNavTextActive]}>Invites</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'bans' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('bans')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'bans' && styles.settingsNavTextActive]}>Ban Members</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'content-moderation' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('content-moderation')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'content-moderation' && styles.settingsNavTextActive]}>Content Moderation</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Settings Content */}
                    <View style={styles.settingsContent}>
                        <View style={styles.settingsContentHeader}>
                            <Text style={styles.settingsContentTitle}>Server Settings</Text>
                            <TouchableOpacity style={styles.settingsCloseBtn} onPress={() => setServerSettingsModalOpen(false)}>
                                <Text style={styles.settingsCloseBtnText}>Close</Text>
                                <MaterialIcons name="close" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.settingsScrollContent} showsVerticalScrollIndicator={false}>
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
                                                value={serverName || activeSubgrid?.name || 'RBFCU Server'}
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
                                                        style={styles.settingsInput}
                                                        value={accountEmail}
                                                        onChangeText={setAccountEmail}
                                                        placeholderTextColor={colors.textSubtle}
                                                    />
                                                </View>
                                                <View style={styles.serverProfileInputCol}>
                                                    <Text style={styles.settingsLabel}>Server Name</Text>
                                                    <TextInput
                                                        style={styles.settingsInput}
                                                        value={serverName || activeSubgrid?.name || 'RBFCU'}
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
                                                        />
                                                    ) : (
                                                        <Text style={styles.serverPreviewAvatarText}>
                                                            {(serverName || activeSubgrid?.name || 'RS')[0]?.toUpperCase()}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                            <View style={styles.serverPreviewInfo}>
                                                <Text style={styles.serverPreviewName}>{serverName || activeSubgrid?.name || 'RBFCU Server'}</Text>
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
                                                    <MaterialIcons name="content-copy" size={18} color={colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    <View style={styles.settingsActions}>
                                        <TouchableOpacity style={styles.settingsSaveBtn} onPress={handleUpdateServer}>
                                            <Text style={styles.settingsSaveBtnText}>Save Changes</Text>
                                        </TouchableOpacity>
                                        <View style={styles.serverCrudActions}>
                                            <TouchableOpacity style={styles.settingsSecondaryBtn} onPress={() => setCreateServerModalOpen(true)}>
                                                <Text style={styles.settingsSecondaryBtnText}>Create Server</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.settingsDangerBtn} onPress={handleArchiveServer}>
                                                <Text style={styles.settingsDangerBtnText}>Archive Server</Text>
                                            </TouchableOpacity>
                                        </View>
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
                                                    engagementSettings.joinMessage && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('joinMessage')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        engagementSettings.joinMessage && styles.engagementToggleKnobOn,
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
                                                    engagementSettings.uploadNotice && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('uploadNotice')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        engagementSettings.uploadNotice && styles.engagementToggleKnobOn,
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
                                                    engagementSettings.emojiReactions && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('emojiReactions')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        engagementSettings.emojiReactions && styles.engagementToggleKnobOn,
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
                                                    engagementSettings.autoEmoji && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('autoEmoji')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        engagementSettings.autoEmoji && styles.engagementToggleKnobOn,
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
                                                    engagementSettings.stickersAutocomplete && styles.engagementToggleOn,
                                                ]}
                                                onPress={() => toggleEngagementSetting('stickersAutocomplete')}
                                            >
                                                <View
                                                    style={[
                                                        styles.engagementToggleKnob,
                                                        engagementSettings.stickersAutocomplete && styles.engagementToggleKnobOn,
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
                                                <MaterialIcons name="search" size={16} color={colors.textMuted} />
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
                                                                <MaterialIcons name="more-horiz" size={16} color={colors.textMuted} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}

                                            {filteredMembers.length === 0 && (
                                                <View style={styles.emptyMembersList}>
                                                    <MaterialIcons name="group" size={48} color={colors.textMuted} />
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
                                                    <MaterialIcons name="navigate-before" size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.memberActionBtn}>
                                                    <MaterialIcons name="navigate-next" size={16} color={colors.textMuted} />
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
                                            <MaterialIcons name="search" size={16} color={colors.textMuted} />
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
                                                                </View>
                                                                {username && (
                                                                    <Text style={styles.stakeholderUsername}>@{username}</Text>
                                                                )}
                                                                {company && (
                                                                    <Text style={styles.stakeholderCompany}>
                                                                        <MaterialIcons name="business" size={12} color={colors.textMuted} /> {company}
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
                                                                <MaterialIcons name="visibility" size={14} color="#FFFFFF" />
                                                                <Text style={styles.stakeholderActionBtnTextPrimary}>View Details</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.stakeholderActionBtn}
                                                                onPress={() => handleStakeholderAction(memberId, member.status === 'muted' ? 'unmute' : 'mute')}
                                                            >
                                                                <MaterialIcons name={member.status === 'muted' ? 'volume-up' : 'volume-off'} size={14} color={colors.text} />
                                                                <Text style={styles.stakeholderActionBtnText}>{member.status === 'muted' ? 'Unmute' : 'Mute'}</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={[styles.stakeholderActionBtn, styles.stakeholderActionBtnDanger]}
                                                                onPress={() => handleStakeholderAction(memberId, 'remove')}
                                                            >
                                                                <MaterialIcons name="person-remove" size={14} color="#EF4444" />
                                                                <Text style={styles.stakeholderActionBtnTextDanger}>Remove</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                            {filteredStakeholders.length === 0 && (
                                                <View style={styles.emptyMembersList}>
                                                    <MaterialIcons name="people-outline" size={48} color={colors.textMuted} />
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
                                    <Text style={styles.settingsPanelDesc}>Create and manage server roles with specific permissions</Text>

                                    <TouchableOpacity style={styles.createRoleBtn}>
                                        <MaterialIcons name="add" size={18} color="#FFFFFF" />
                                        <Text style={styles.createRoleBtnText}>Create Role</Text>
                                    </TouchableOpacity>

                                    <View style={styles.rolesList}>
                                        <View style={styles.roleItem}>
                                            <View style={[styles.roleColor, { backgroundColor: '#22C55E' }]} />
                                            <Text style={styles.roleName}>Admin</Text>
                                            <Text style={styles.roleMemberCount}>1 member</Text>
                                            <TouchableOpacity>
                                                <MaterialIcons name="more-vert" size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.roleItem}>
                                            <View style={[styles.roleColor, { backgroundColor: '#3B82F6' }]} />
                                            <Text style={styles.roleName}>Moderator</Text>
                                            <Text style={styles.roleMemberCount}>0 members</Text>
                                            <TouchableOpacity>
                                                <MaterialIcons name="more-vert" size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.roleItem}>
                                            <View style={[styles.roleColor, { backgroundColor: colors.textMuted }]} />
                                            <Text style={styles.roleName}>@everyone</Text>
                                            <Text style={styles.roleMemberCount}>{members.length} members</Text>
                                            <TouchableOpacity>
                                                <MaterialIcons name="more-vert" size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
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
                                                        {currentUserName || 'John Michael'}
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
                                                    <MaterialIcons name="link" size={48} color={colors.textMuted} />
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

                                            {moderationLoading ? (
                                                <View style={styles.moderationEmpty}>
                                                    <MaterialIcons name="hourglass-empty" size={40} color={colors.textMuted} />
                                                    <Text style={styles.moderationEmptyText}>Loading moderation queue</Text>
                                                </View>
                                            ) : moderationQueue.length === 0 ? (
                                                <View style={styles.moderationEmpty}>
                                                    <MaterialIcons name="shield" size={48} color={colors.textMuted} />
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
                                                            ? { bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' }
                                                            : { bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B' };
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
                                                                    <MaterialIcons name="more-horiz" size={16} color={colors.textMuted} />
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
                                                                            <MaterialIcons name="visibility" size={14} color={colors.textMuted} />
                                                                            <Text style={styles.moderationMenuText}>View</Text>
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            style={styles.moderationMenuItem}
                                                                            onPress={() => {
                                                                                setModerationMenuOpen(null);
                                                                                handleModerationAction(item, 'mute');
                                                                            }}
                                                                        >
                                                                            <MaterialIcons name="block" size={14} color={colors.textMuted} />
                                                                            <Text style={styles.moderationMenuText}>Restrict User</Text>
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            style={styles.moderationMenuItem}
                                                                            onPress={() => {
                                                                                setModerationMenuOpen(null);
                                                                                handleModerationAction(item, 'ban');
                                                                            }}
                                                                        >
                                                                            <MaterialIcons name="person-remove" size={14} color={colors.textMuted} />
                                                                            <Text style={styles.moderationMenuText}>Remove User</Text>
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            style={styles.moderationMenuItem}
                                                                            onPress={() => {
                                                                                setModerationMenuOpen(null);
                                                                                handleModerationAction(item, 'warn');
                                                                            }}
                                                                        >
                                                                            <MaterialIcons name="warning" size={14} color={colors.textMuted} />
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
                                                    <MaterialIcons name="navigate-before" size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.memberActionBtn}>
                                                    <MaterialIcons name="navigate-next" size={16} color={colors.textMuted} />
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
                                                        contentModerationEnabled && styles.toggleSwitchActive
                                                    ]}
                                                    onPress={() => setContentModerationEnabled(!contentModerationEnabled)}
                                                >
                                                    <View style={[
                                                        styles.toggleKnob,
                                                        contentModerationEnabled && styles.toggleKnobActive
                                                    ]} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Filter Action */}
                                        <View style={styles.contentModerationSection}>
                                            <Text style={styles.contentModerationLabel}>Filter Action</Text>
                                            <Text style={styles.contentModerationHint}>What happens when prohibited content is detected</Text>
                                            <View style={styles.contentModerationActions}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.contentModerationActionBtn,
                                                        contentModerationAction === 'block' && styles.contentModerationActionBtnActive
                                                    ]}
                                                    onPress={() => setContentModerationAction('block')}
                                                >
                                                    <MaterialIcons
                                                        name="block"
                                                        size={18}
                                                        color={contentModerationAction === 'block' ? '#fff' : colors.textMuted}
                                                    />
                                                    <Text style={[
                                                        styles.contentModerationActionText,
                                                        contentModerationAction === 'block' && styles.contentModerationActionTextActive
                                                    ]}>Block</Text>
                                                    <Text style={[
                                                        styles.contentModerationActionHint,
                                                        contentModerationAction === 'block' && styles.contentModerationActionHintActive
                                                    ]}>Prevent sending</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.contentModerationActionBtn,
                                                        contentModerationAction === 'flag' && styles.contentModerationActionBtnActive
                                                    ]}
                                                    onPress={() => setContentModerationAction('flag')}
                                                >
                                                    <MaterialIcons
                                                        name="flag"
                                                        size={18}
                                                        color={contentModerationAction === 'flag' ? '#fff' : colors.textMuted}
                                                    />
                                                    <Text style={[
                                                        styles.contentModerationActionText,
                                                        contentModerationAction === 'flag' && styles.contentModerationActionTextActive
                                                    ]}>Flag</Text>
                                                    <Text style={[
                                                        styles.contentModerationActionHint,
                                                        contentModerationAction === 'flag' && styles.contentModerationActionHintActive
                                                    ]}>Send but flag for review</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.contentModerationActionBtn,
                                                        contentModerationAction === 'censor' && styles.contentModerationActionBtnActive
                                                    ]}
                                                    onPress={() => setContentModerationAction('censor')}
                                                >
                                                    <MaterialIcons
                                                        name="visibility-off"
                                                        size={18}
                                                        color={contentModerationAction === 'censor' ? '#fff' : colors.textMuted}
                                                    />
                                                    <Text style={[
                                                        styles.contentModerationActionText,
                                                        contentModerationAction === 'censor' && styles.contentModerationActionTextActive
                                                    ]}>Censor</Text>
                                                    <Text style={[
                                                        styles.contentModerationActionHint,
                                                        contentModerationAction === 'censor' && styles.contentModerationActionHintActive
                                                    ]}>Replace with ***</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Blocked Message */}
                                        {contentModerationAction === 'block' && (
                                            <View style={styles.contentModerationSection}>
                                                <Text style={styles.contentModerationLabel}>Blocked Message</Text>
                                                <Text style={styles.contentModerationHint}>Message shown to users when their content is blocked</Text>
                                                <TextInput
                                                    style={styles.contentModerationInput}
                                                    value={blockedMessage}
                                                    onChangeText={setBlockedMessage}
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
                                                <MaterialIcons name="add" size={20} color="#fff" />
                                                <Text style={styles.contentModerationAddBtnText}>Add</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Word List */}
                                        <View style={styles.contentModerationWordList}>
                                            {prohibitedWords.length === 0 ? (
                                                <View style={styles.contentModerationEmpty}>
                                                    <MaterialIcons name="filter-list-off" size={40} color={colors.textMuted} />
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
                                                                <MaterialIcons name="close" size={14} color={colors.textMuted} />
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
                                                <MaterialIcons name="play-arrow" size={18} color="#fff" />
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
                                                    <MaterialIcons
                                                        name={contentModerationTestResult.isProhibited ? 'warning' : 'check-circle'}
                                                        size={20}
                                                        color={contentModerationTestResult.isProhibited ? '#DC2626' : '#16A34A'}
                                                    />
                                                    <Text style={[
                                                        styles.contentModerationTestResultTitle,
                                                        { color: contentModerationTestResult.isProhibited ? '#DC2626' : '#16A34A' }
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
                                                {contentModerationTestResult.isProhibited && contentModerationAction === 'censor' && (
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
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Create Server Modal */}
            <Modal visible={createServerModalOpen} transparent animationType="fade" onRequestClose={() => setCreateServerModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setCreateServerModalOpen(false)}>
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Create Server</Text>

                        <Text style={styles.modalLabel}>SERVER NAME</Text>
                        <View style={styles.inputRow}>
                            <MaterialIcons name="tag" size={18} color={colors.textMuted} />
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
                                <MaterialIcons name="lock" size={16} color={newServerVisibility === 'private' ? '#FFFFFF' : colors.textMuted} />
                                <Text style={[styles.visibilityText, newServerVisibility === 'private' && styles.visibilityTextActive]}>Private</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.visibilityOption, newServerVisibility === 'public' && styles.visibilityOptionActive]}
                                onPress={() => setNewServerVisibility('public')}
                            >
                                <MaterialIcons name="public" size={16} color={newServerVisibility === 'public' ? '#FFFFFF' : colors.textMuted} />
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
                            <MaterialIcons name="flag" size={16} color={colors.textMuted} />
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
                            <MaterialIcons name="delete" size={16} color="#EF4444" />
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
                                <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                                <MaterialIcons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.commentList} contentContainerStyle={styles.commentListContent}>
                            {commentsLoading ? (
                                <View style={styles.commentLoading}>
                                    <Text style={styles.commentLoadingText}>Loading comments...</Text>
                                </View>
                            ) : comments.length === 0 ? (
                                <View style={styles.commentEmpty}>
                                    <MaterialIcons name="chat-bubble-outline" size={32} color={colors.textMuted} />
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
                                                            <MaterialIcons name="verified" size={12} color="#3B82F6" />
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
                                    <MaterialIcons name="send" size={18} color="#fff" />
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
                                <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Notification Settings</Text>

                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <MaterialIcons name="notifications" size={16} color={colors.textMuted} />
                                <View>
                                    <Text style={styles.toggleTitle}>All Messages</Text>
                                    <Text style={styles.toggleDesc}>Get notified for every message</Text>
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
                                <MaterialIcons name="group" size={16} color={colors.textMuted} />
                                <View>
                                    <Text style={styles.toggleTitle}>Mentions Only</Text>
                                    <Text style={styles.toggleDesc}>Only get notified when mentioned</Text>
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
                                <MaterialIcons name="event" size={16} color={colors.textMuted} />
                                <View>
                                    <Text style={styles.toggleTitle}>Events</Text>
                                    <Text style={styles.toggleDesc}>Get notified about events</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.toggle, notifyEvents && styles.toggleActive]}
                                onPress={() => setNotifyEvents(!notifyEvents)}
                            >
                                <View style={[styles.toggleKnob, notifyEvents && styles.toggleKnobActive]} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.fullWidthBtn} onPress={() => setNotificationSettingsModalOpen(false)}>
                            <Text style={styles.fullWidthBtnText}>Save Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Privacy Settings Modal */}
            <Modal visible={privacySettingsModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setPrivacySettingsModalOpen(false)}>
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Privacy Settings</Text>

                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <MaterialIcons name="message" size={16} color={colors.textMuted} />
                                <View>
                                    <Text style={styles.toggleTitle}>Allow Direct Messages</Text>
                                    <Text style={styles.toggleDesc}>Let members send you DMs</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.toggle, allowDMs && styles.toggleActive]}
                                onPress={() => setAllowDMs(!allowDMs)}
                            >
                                <View style={[styles.toggleKnob, allowDMs && styles.toggleKnobActive]} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <MaterialIcons name="shield" size={16} color={colors.textMuted} />
                                <View>
                                    <Text style={styles.toggleTitle}>Show Online Status</Text>
                                    <Text style={styles.toggleDesc}>Let others see when you're online</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.toggle, showOnlineStatus && styles.toggleActive]}
                                onPress={() => setShowOnlineStatus(!showOnlineStatus)}
                            >
                                <View style={[styles.toggleKnob, showOnlineStatus && styles.toggleKnobActive]} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.fullWidthBtn} onPress={() => setPrivacySettingsModalOpen(false)}>
                            <Text style={styles.fullWidthBtnText}>Save Settings</Text>
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
                                <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                                {muted ? <MaterialIcons name="mic-off" size={20} color="#EF4444" /> : <MaterialIcons name="mic" size={20} color={colors.text} />}
                            </TouchableOpacity>
                            {callType === 'video' && (
                                <TouchableOpacity style={styles.callActionButton} onPress={toggleCamera}>
                                    {cameraOff ? <MaterialIcons name="videocam-off" size={20} color="#EF4444" /> : <MaterialIcons name="videocam" size={20} color={colors.text} />}
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
                                <MaterialIcons name="call-end" size={20} color="#FFFFFF" />
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
                            <MaterialIcons name="check-circle" size={64} color="#22C55E" />
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
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                                    </View>
                                    {username && <Text style={[styles.stakeholderUsername, { marginBottom: 8 }]}>@{username}</Text>}

                                    <View style={styles.stakeholderDetailSection}>
                                        <View style={styles.stakeholderDetailItem}>
                                            <MaterialIcons name="email" size={16} color={colors.textMuted} />
                                            <Text style={styles.stakeholderDetailText}>{getMemberEmail(selectedStakeholder)}</Text>
                                        </View>
                                        {company && (
                                            <View style={styles.stakeholderDetailItem}>
                                                <MaterialIcons name="business" size={16} color={colors.textMuted} />
                                                <Text style={styles.stakeholderDetailText}>{company}</Text>
                                            </View>
                                        )}
                                        <View style={styles.stakeholderDetailItem}>
                                            <MaterialIcons name="verified-user" size={16} color={colors.textMuted} />
                                            <Text style={styles.stakeholderDetailText}>Role: {getMemberRoleLabel(selectedStakeholder.role)}</Text>
                                        </View>
                                        <View style={styles.stakeholderDetailItem}>
                                            <MaterialIcons name="info" size={16} color={colors.textMuted} />
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
                                            <MaterialIcons name={selectedStakeholder.status === 'muted' ? 'volume-up' : 'volume-off'} size={14} color={colors.text} />
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
                                            <MaterialIcons name="person-remove" size={14} color="#EF4444" />
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
                                        <MaterialIcons name="person" size={18} color={colors.text} />
                                        <Text style={styles.memberActionMenuText}>View Details</Text>
                                    </TouchableOpacity>

                                    {!isAdmin && (
                                        <>
                                            <TouchableOpacity
                                                style={styles.memberActionMenuItem}
                                                onPress={() => handleMemberAction(memberId, memberStatus === 'muted' ? 'unmute' : 'mute')}
                                            >
                                                <MaterialIcons name={memberStatus === 'muted' ? 'volume-up' : 'volume-off'} size={18} color={colors.text} />
                                                <Text style={styles.memberActionMenuText}>{memberStatus === 'muted' ? 'Unmute' : 'Mute'}</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.memberActionMenuItem}
                                                onPress={() => handleMemberAction(memberId, memberStatus === 'suspended' ? 'unsuspend' : 'suspend')}
                                            >
                                                <MaterialIcons name={memberStatus === 'suspended' ? 'check-circle' : 'block'} size={18} color={memberStatus === 'suspended' ? colors.success : colors.warning} />
                                                <Text style={[styles.memberActionMenuText, { color: memberStatus === 'suspended' ? colors.success : colors.warning }]}>
                                                    {memberStatus === 'suspended' ? 'Unsuspend' : 'Suspend'}
                                                </Text>
                                            </TouchableOpacity>

                                            {!isModerator && (
                                                <TouchableOpacity
                                                    style={styles.memberActionMenuItem}
                                                    onPress={() => handleMemberAction(memberId, 'promote')}
                                                >
                                                    <MaterialIcons name="arrow-upward" size={18} color={colors.primary} />
                                                    <Text style={[styles.memberActionMenuText, { color: colors.primary }]}>Promote to Moderator</Text>
                                                </TouchableOpacity>
                                            )}

                                            {isModerator && (
                                                <TouchableOpacity
                                                    style={styles.memberActionMenuItem}
                                                    onPress={() => handleMemberAction(memberId, 'demote')}
                                                >
                                                    <MaterialIcons name="arrow-downward" size={18} color={colors.warning} />
                                                    <Text style={[styles.memberActionMenuText, { color: colors.warning }]}>Demote to Member</Text>
                                                </TouchableOpacity>
                                            )}

                                            <View style={styles.memberActionMenuDivider} />

                                            <TouchableOpacity
                                                style={styles.memberActionMenuItem}
                                                onPress={() => handleMemberAction(memberId, 'remove')}
                                            >
                                                <MaterialIcons name="person-remove" size={18} color="#EF4444" />
                                                <Text style={[styles.memberActionMenuText, { color: '#EF4444' }]}>Remove from Server</Text>
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
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
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
                                            <MaterialIcons name="email" size={16} color={colors.textMuted} />
                                            <Text style={styles.memberDetailText}>{email || 'No email'}</Text>
                                        </View>
                                        <View style={styles.memberDetailItem}>
                                            <MaterialIcons name="verified-user" size={16} color={colors.textMuted} />
                                            <Text style={styles.memberDetailText}>Role: {getMemberRoleLabel(memberRole)}</Text>
                                        </View>
                                        <View style={styles.memberDetailItem}>
                                            <MaterialIcons name="info" size={16} color={colors.textMuted} />
                                            <View style={[styles.statusBadge, getMemberStatusStyle(memberStatus), { marginLeft: 0 }]}>
                                                <Text style={[styles.statusBadgeText, getMemberStatusTextStyle(memberStatus)]}>
                                                    {getMemberStatusLabel(memberStatus)}
                                                </Text>
                                            </View>
                                        </View>
                                        {joinedAt && (
                                            <View style={styles.memberDetailItem}>
                                                <MaterialIcons name="event" size={16} color={colors.textMuted} />
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
                                                <MaterialIcons name={memberStatus === 'muted' ? 'volume-up' : 'volume-off'} size={16} color={colors.text} />
                                                <Text style={styles.memberDetailActionText}>{memberStatus === 'muted' ? 'Unmute' : 'Mute'}</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.memberDetailActionBtn, memberStatus === 'suspended' ? styles.memberDetailActionBtnSuccess : styles.memberDetailActionBtnWarning]}
                                                onPress={() => handleMemberAction(memberId, memberStatus === 'suspended' ? 'unsuspend' : 'suspend')}
                                            >
                                                <MaterialIcons name={memberStatus === 'suspended' ? 'check-circle' : 'block'} size={16} color={memberStatus === 'suspended' ? '#10B981' : '#F59E0B'} />
                                                <Text style={[styles.memberDetailActionText, { color: memberStatus === 'suspended' ? '#10B981' : '#F59E0B' }]}>
                                                    {memberStatus === 'suspended' ? 'Unsuspend' : 'Suspend'}
                                                </Text>
                                            </TouchableOpacity>

                                            {!isModerator && (
                                                <TouchableOpacity
                                                    style={[styles.memberDetailActionBtn, styles.memberDetailActionBtnPrimary]}
                                                    onPress={() => handleMemberAction(memberId, 'promote')}
                                                >
                                                    <MaterialIcons name="arrow-upward" size={16} color={colors.primary} />
                                                    <Text style={[styles.memberDetailActionText, { color: colors.primary }]}>Promote</Text>
                                                </TouchableOpacity>
                                            )}

                                            {isModerator && (
                                                <TouchableOpacity
                                                    style={[styles.memberDetailActionBtn, styles.memberDetailActionBtnWarning]}
                                                    onPress={() => handleMemberAction(memberId, 'demote')}
                                                >
                                                    <MaterialIcons name="arrow-downward" size={16} color="#F59E0B" />
                                                    <Text style={[styles.memberDetailActionText, { color: '#F59E0B' }]}>Demote</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity
                                                style={[styles.memberDetailActionBtn, styles.memberDetailActionBtnDanger]}
                                                onPress={() => handleMemberAction(memberId, 'remove')}
                                            >
                                                <MaterialIcons name="person-remove" size={16} color="#EF4444" />
                                                <Text style={[styles.memberDetailActionText, { color: '#EF4444' }]}>Remove</Text>
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
                            <MaterialIcons name="warning" size={56} color="#EF4444" />
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
                                <MaterialIcons name={deleteConfirmData.type === 'channel' ? 'tag' : 'article'} size={16} color={colors.textMuted} />
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
                                <MaterialIcons name="delete" size={16} color="#FFFFFF" />
                                <Text style={styles.deleteModalConfirmText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.surface,
            position: 'relative',
        },
        gridBackground: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            ...(Platform.OS === 'web'
                ? ({
                    backgroundImage:
                        'linear-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.08) 1px, transparent 1px)',
                    backgroundSize: '24px 24px, 24px 24px, 120px 120px, 120px 120px',
                    backgroundPosition: '0 0, 0 0, 0 0, 0 0',
                } as any)
                : {}),
        },
        topNav: {
            height: 48,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
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
            paddingVertical: 4,
        },
        tabActive: {
            paddingVertical: 4,
        },
        tabText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        tabTextActive: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        mainArea: {
            flex: 1,
            flexDirection: 'row',
            overflow: 'visible',
        },
        iconRail: {
            width: 64,
            backgroundColor: colors.surfaceMuted,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            alignItems: 'center',
            paddingVertical: 12,
            gap: 8,
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
        railLogoText: {
            fontSize: 8,
            fontWeight: '700',
            color: '#FFFFFF',
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
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },
        exitButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#EF4444',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
        },
        channelSidebar: {
            width: 240,
            backgroundColor: colors.surface,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            overflow: 'visible',
            zIndex: 100,
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
            borderBottomColor: colors.border,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 1000,
            zIndex: 9999,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
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
            backgroundColor: colors.surfaceMuted,
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
            color: '#FFFFFF',
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
            borderColor: colors.border,
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
            color: '#FFFFFF',
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
            gap: 8,
            padding: 8,
            borderRadius: 6,
        },
        channelItemActive: {
            backgroundColor: colors.surfaceMuted,
        },
        channelName: {
            flex: 1,
            fontSize: 14,
            color: colors.textMuted,
        },
        channelNameActive: {
            color: colors.text,
            fontWeight: '500',
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
            backgroundColor: '#1f2937',
            borderRadius: 8,
            paddingVertical: 6,
            width: 200,
            borderWidth: 1,
            borderColor: '#374151',
            zIndex: 100,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
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
            backgroundColor: '#374151',
        },
        channelMenuText: {
            fontSize: 14,
            color: '#e5e7eb',
            fontWeight: '500',
        },
        channelMenuTextDanger: {
            fontSize: 14,
            color: '#EF4444',
            fontWeight: '500',
        },
        channelSettingsOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        channelSettingsModal: {
            backgroundColor: colors.cardBg,
            borderRadius: 12,
            padding: 8,
            minWidth: 220,
            maxWidth: 280,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 10,
        },
        channelSettingsTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
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
            borderTopColor: colors.border,
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
            padding: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
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
        userStatus: {
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
        dropdownWrapper: {
            position: 'relative',
        },
        audioDropdown: {
            position: 'absolute',
            bottom: '100%',
            left: -50,
            width: 180,
            backgroundColor: colors.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surface,
            zIndex: 1,
        },
        contentHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        contentHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        contentTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        contentHeaderRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        headerIcon: {
            padding: 4,
        },
        searchBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 6,
            minWidth: 180,
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
            backgroundColor: colors.surfaceMuted,
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
            borderColor: colors.border,
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
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: colors.surface,
            marginBottom: 12,
        },
        welcomeActionText: {
            fontSize: 14,
            color: colors.text,
        },
        // Feed
        feedContainer: {
            flex: 1,
            backgroundColor: colors.surfaceMuted,
        },
        feedContent: {
            padding: 16,
            gap: 16,
        },
        welcomeCard: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 24,
            alignItems: 'flex-start',
        },
        welcomeIcon: {
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
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
            borderColor: colors.border,
        },
        editChannelText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        postCard: {
            backgroundColor: colors.surface,
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
            backgroundColor: colors.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
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
            color: '#EF4444',
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
        floatingMenuItemTextDanger: {
            fontSize: 14,
            color: '#EF4444',
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
            color: '#FFFFFF',
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surfaceMuted,
        },
        videoPlaceholder: {
            width: '100%',
            height: 200,
            borderRadius: 12,
            backgroundColor: '#1A1A2E',
            alignItems: 'center',
            justifyContent: 'center',
        },
        videoLabel: {
            color: '#FFFFFF',
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surfaceMuted,
            maxWidth: 200,
        },
        fileLabel: {
            fontSize: 13,
            color: colors.text,
            flex: 1,
        },
        // Reshare card styles
        reshareCard: {
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
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
            paddingVertical: 12,
        },
        messageInputLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        messageInputMiddle: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        inputIcon: {
            padding: 4,
        },
        messageInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
            paddingVertical: 4,
        },
        messageInputActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        inputActionIcon: {
            padding: 6,
        },
        sendBtn: {
            backgroundColor: '#5865F2',
            borderRadius: 6,
            padding: 8,
            marginLeft: 4,
        },
        membersSidebar: {
            width: 200,
            backgroundColor: colors.surface,
            borderLeftWidth: 1,
            borderLeftColor: colors.border,
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
        channelMenuDropdown: {
            position: 'absolute',
            top: 24,
            right: 0,
            backgroundColor: 'white',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 8,
            zIndex: 1000,
            minWidth: 160,
        },
        channelSettingsOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        channelSettingsModal: {
            backgroundColor: '#1f2937',
            borderRadius: 12,
            padding: 8,
            minWidth: 220,
            maxWidth: 280,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 10,
        },
        channelSettingsTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: '#FFFFFF',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#374151',
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
            color: '#E5E7EB',
        },
        channelSettingsCancel: {
            justifyContent: 'center',
            borderTopWidth: 1,
            borderTopColor: '#374151',
            marginTop: 4,
        },
        channelSettingsCancelText: {
            fontSize: 14,
            color: '#9CA3AF',
            textAlign: 'center',
        },
        memberOnline: {
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
        memberName: {
            fontSize: 14,
            color: colors.text,
        },
        // Modal styles
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        modalContent: {
            width: '90%',
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 24,
        },
        permissionModalContent: {
            width: '90%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 24,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: '#22C55E',
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
            borderColor: colors.border,
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
            borderColor: colors.border,
            fontSize: 14,
            color: colors.text,
        },
        disabledInput: {
            backgroundColor: colors.surfaceMuted,
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
            color: colors.surface,
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
            borderColor: colors.border,
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
            color: '#FFFFFF',
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
            backgroundColor: '#8B5CF6',
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 8,
        },
        inviteBtnDisabled: {
            opacity: 0.6,
        },
        inviteBtnText: {
            color: '#FFFFFF',
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
            backgroundColor: colors.border,
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
            borderColor: colors.border,
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
            borderColor: colors.border,
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
            borderColor: colors.border,
            marginBottom: 8,
        },
        typeOptionActive: {
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.border,
            padding: 2,
        },
        toggleActive: {
            backgroundColor: '#22C55E',
        },
        toggleKnob: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.surface,
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
            borderColor: colors.border,
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
            color: colors.surface,
        },
        createBtnBlack: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: '#000000',
            alignItems: 'center',
        },
        createBtnBlackText: {
            fontSize: 14,
            fontWeight: '500',
            color: '#FFFFFF',
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
            borderColor: colors.border,
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
            color: colors.surface,
        },
        // Server Settings Full Page Styles
        settingsFullPage: {
            flex: 1,
            flexDirection: 'row',
            backgroundColor: '#E9E9E9',
            padding: 16,
        },
        settingsSidebar: {
            width: 220,
            backgroundColor: '#0B0B0C',
            paddingVertical: 16,
            borderRightWidth: 1,
            borderRightColor: '#E5E7EB',
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
            color: '#FFFFFF',
        },
        settingsSectionLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: '#9CA3AF',
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
            backgroundColor: '#1F1F1F',
        },
        settingsNavItemRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        settingsNavText: {
            fontSize: 14,
            color: '#B5B5B5',
        },
        settingsNavTextActive: {
            color: '#FFFFFF',
            fontWeight: '500',
        },
        settingsContent: {
            flex: 1,
            backgroundColor: colors.surface,
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderLeftWidth: 0,
        },
        settingsContentHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
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
            color: '#EF4444',
        },
        settingsScrollContent: {
            flex: 1,
            paddingHorizontal: 32,
            paddingVertical: 24,
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
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: colors.text,
        },
        engagementCard: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
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
            backgroundColor: '#E5E7EB',
        },
        engagementSectionDivider: {
            height: 1,
            backgroundColor: '#E5E7EB',
            marginVertical: 12,
        },
        engagementToggle: {
            width: 38,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#E5E7EB',
            padding: 2,
            justifyContent: 'center',
        },
        engagementToggleOn: {
            backgroundColor: '#111111',
        },
        engagementToggleKnob: {
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: '#FFFFFF',
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
            backgroundColor: colors.surface,
            borderRadius: 12,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderWidth: 3,
            borderColor: colors.surface,
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
            backgroundColor: '#22C55E',
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
            backgroundColor: '#5865F2',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
        },
        changeIconBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: '#FFFFFF',
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
            borderColor: colors.border,
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
            borderColor: '#5865F2',
        },
        // Invite Code Section
        inviteCodeSection: {
            marginTop: 24,
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        inviteCodeBox: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceHover,
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
            backgroundColor: colors.surface,
        },
        settingsActions: {
            marginTop: 32,
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        settingsSaveBtn: {
            backgroundColor: '#22C55E',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
        },
        settingsSaveBtnText: {
            fontSize: 14,
            fontWeight: '500',
            color: '#FFFFFF',
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
            borderColor: colors.border,
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
            backgroundColor: '#111111',
        },
        settingsDangerBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: '#FFFFFF',
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
            borderColor: colors.border,
        },
        visibilityOptionActive: {
            backgroundColor: '#111111',
            borderColor: '#111111',
        },
        visibilityText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        visibilityTextActive: {
            color: '#FFFFFF',
            fontWeight: '600',
        },
        settingsCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: '#E5E7EB',
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
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: '#E5E7EB',
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
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: '#5865F2',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
        },
        inviteMemberBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: '#FFFFFF',
        },
        membersSectionTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 12,
        },
        membersTable: {
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: colors.surface,
        },
        invitesTable: {
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: colors.surface,
        },
        membersTableHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: '#F4F4F5',
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
            borderBottomColor: '#E5E7EB',
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
            backgroundColor: '#DCFCE7',
        },
        statusBadgePending: {
            backgroundColor: '#FEF3C7',
        },
        statusBadgeMuted: {
            backgroundColor: '#FDE68A',
        },
        statusBadgeSuspended: {
            backgroundColor: '#FEE2E2',
        },
        statusBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.text,
        },
        statusBadgeTextActive: {
            color: '#16A34A',
        },
        statusBadgeTextPending: {
            color: '#D97706',
        },
        statusBadgeTextMuted: {
            color: '#B45309',
        },
        statusBadgeTextSuspended: {
            color: '#DC2626',
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
            backgroundColor: colors.surfaceMuted,
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
            borderBottomColor: colors.border,
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
            backgroundColor: '#5865F2',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
            marginBottom: 24,
        },
        createRoleBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: '#FFFFFF',
        },
        rolesList: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            overflow: 'hidden',
        },
        roleItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
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
        createInviteBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#111111',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 16,
        },
        createInviteBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: '#FFFFFF',
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
            backgroundColor: '#5865F2',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
            marginBottom: 24,
        },
        uploadEmojiBtnText: {
            fontSize: 13,
            fontWeight: '500',
            color: '#FFFFFF',
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
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
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
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        reportReasonOptionActive: {
            borderColor: '#111111',
            backgroundColor: '#111111',
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
            borderColor: colors.border,
        },
        reportCancelText: {
            fontSize: 13,
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
            fontSize: 13,
            color: '#FFFFFF',
            fontWeight: '600',
        },
        moderationErrorText: {
            fontSize: 12,
            color: '#EF4444',
            marginBottom: 12,
        },
        moderationTable: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            overflow: 'hidden',
        },
        moderationTableHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceMuted,
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
            borderBottomColor: colors.border,
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
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
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
            borderColor: colors.border,
            alignItems: 'center',
            backgroundColor: colors.surface,
        },
        moderationActionBtnDisabled: {
            opacity: 0.6,
        },
        moderationActionRemove: {
            backgroundColor: '#111111',
            borderColor: '#111111',
        },
        moderationActionWarn: {
            backgroundColor: colors.surfaceMuted,
        },
        moderationActionText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
        },
        moderationActionTextOnDark: {
            fontSize: 12,
            fontWeight: '600',
            color: '#FFFFFF',
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: '#EF4444',
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
            backgroundColor: '#EF4444',
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
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '50%',
        },
        emojiPickerHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            gap: 20,
            position: 'relative',
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
            color: '#EF4444',
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
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: '#1a1a1a',
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
            color: '#FFFFFF',
            marginTop: 16,
        },
        selfVideoWrap: {
            position: 'absolute',
            top: 16,
            right: 16,
            width: 110,
            height: 150,
            borderRadius: 12,
            backgroundColor: '#2a2a2a',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#3a3a3a',
        },
        selfVideoAvatar: {
            width: 60,
            height: 60,
            borderRadius: 30,
        },
        selfVideoName: {
            fontSize: 12,
            fontWeight: '500',
            color: '#FFFFFF',
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
            backgroundColor: colors.surfaceMuted,
        },
        endCallButton: {
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#EF4444',
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
            backgroundColor: colors.surface,
            borderRadius: 20,
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
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
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
            backgroundColor: '#22C55E',
            paddingVertical: 14,
            paddingHorizontal: 48,
            borderRadius: 12,
            minWidth: 160,
        },
        successModalButtonText: {
            color: '#FFFFFF',
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
            backgroundColor: colors.surface,
            borderRadius: 20,
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
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
            backgroundColor: colors.background,
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
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: '#EF4444',
        },
        deleteModalConfirmText: {
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
        },
        // Stakeholder Management Styles
        stakeholderCard: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
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
            color: '#FFFFFF',
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
            borderTopColor: colors.border,
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
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
        },
        stakeholderActionBtnPrimary: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        stakeholderActionBtnDanger: {
            backgroundColor: 'transparent',
            borderColor: '#EF4444',
        },
        stakeholderActionBtnText: {
            fontSize: 13,
            color: colors.text,
            fontWeight: '500',
        },
        stakeholderActionBtnTextPrimary: {
            fontSize: 13,
            color: '#FFFFFF',
            fontWeight: '500',
        },
        stakeholderActionBtnTextDanger: {
            fontSize: 13,
            color: '#EF4444',
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
            backgroundColor: '#22C55E20',
        },
        statusMuted: {
            backgroundColor: '#F59E0B20',
        },
        statusBanned: {
            backgroundColor: '#EF444420',
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
            borderTopColor: colors.border,
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
            backgroundColor: colors.border,
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
            borderTopColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        memberDetailActionBtnPrimary: {
            borderColor: colors.primary + '40',
            backgroundColor: colors.primary + '10',
        },
        memberDetailActionBtnWarning: {
            borderColor: '#F59E0B40',
            backgroundColor: '#F59E0B10',
        },
        memberDetailActionBtnSuccess: {
            borderColor: '#10B98140',
            backgroundColor: '#10B98110',
        },
        memberDetailActionBtnDanger: {
            borderColor: '#EF444440',
            backgroundColor: '#EF444410',
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
            backgroundColor: colors.border,
            padding: 3,
        },
        toggleSwitchActive: {
            backgroundColor: colors.primary,
        },
        toggleKnob: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
        },
        toggleKnobActive: {
            transform: [{ translateX: 22 }],
        },
        contentModerationActions: {
            flexDirection: 'row',
            gap: 12,
        },
        contentModerationActionBtn: {
            flex: 1,
            alignItems: 'center',
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        contentModerationActionBtnActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        contentModerationActionText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginTop: 8,
        },
        contentModerationActionTextActive: {
            color: '#FFFFFF',
        },
        contentModerationActionHint: {
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 4,
            textAlign: 'center',
        },
        contentModerationActionHintActive: {
            color: 'rgba(255,255,255,0.8)',
        },
        contentModerationInput: {
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
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
            color: '#FFFFFF',
        },
        contentModerationAddWord: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 16,
        },
        contentModerationWordInput: {
            flex: 1,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
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
            color: '#FFFFFF',
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
            backgroundColor: colors.surfaceMuted,
            paddingVertical: 6,
            paddingLeft: 12,
            paddingRight: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
            minHeight: 60,
            textAlignVertical: 'top',
        },
        contentModerationTestBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#10B981',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            alignSelf: 'flex-start',
        },
        contentModerationTestBtnText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        contentModerationTestResult: {
            borderRadius: 12,
            padding: 16,
        },
        contentModerationTestResultBlocked: {
            backgroundColor: '#FEE2E2',
            borderWidth: 1,
            borderColor: '#FECACA',
        },
        contentModerationTestResultAllowed: {
            backgroundColor: '#DCFCE7',
            borderWidth: 1,
            borderColor: '#BBF7D0',
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
            color: '#6B7280',
            marginBottom: 4,
        },
        contentModerationTestResultValue: {
            fontSize: 13,
            color: '#374151',
        },
    });

export default CreditUnionAdminScreen;
