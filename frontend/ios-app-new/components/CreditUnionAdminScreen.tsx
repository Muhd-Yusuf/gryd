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
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { communityGet, communityPost, communityPut, communityDelete, getTenantId, getUserId, resolveTenantId, getOnlineStatus, updatePresence, setUserOnline, uploadFile, getAuthUser, initiateChannelCall } from '../lib/api';
import { useTheme } from '../lib/theme';
import UserAvatar from './UserAvatar';

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
    startDate?: string;
    endDate?: string;
};

type Subgrid = {
    _id: string;
    name?: string;
    description?: string;
    icon?: string;
    inviteCode?: string;
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
    // Nested user object (fallback)
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        username?: string;
        avatarUrl?: string;
    };
};

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
    // Check userId (direct), user._id (nested), or _id (fallback)
    const member = members.find(m =>
        m.userId === authorId ||
        m.user?._id === authorId ||
        m._id === authorId
    );
    if (member) return getMemberName(member);
    return `User ${String(authorId).slice(-6)}`;
};

const getMemberAvatarUrl = (member?: Member) => {
    if (!member) return null;
    return member.avatarUrl || member.user?.avatarUrl || null;
};

const CreditUnionAdminScreen = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const router = useRouter();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { width } = useWindowDimensions();
    const isMobile = width < 800;

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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

    // Success & Confirmation Modal States
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successModalMessage, setSuccessModalMessage] = useState('');
    const [successModalTitle, setSuccessModalTitle] = useState('');
    const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [deleteConfirmData, setDeleteConfirmData] = useState<{ type: 'channel' | 'post' | 'message'; id: string; name?: string } | null>(null);

    // Form States
    const [inviteEmail, setInviteEmail] = useState('');
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
    const [isPrivateChannel, setIsPrivateChannel] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isPrivateCategory, setIsPrivateCategory] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDescription, setNewEventDescription] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [serverName, setServerName] = useState('');
    const [serverDescription, setServerDescription] = useState('');

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

    // Item menu state (for post/message delete dropdown)
    const [itemMenuOpen, setItemMenuOpen] = useState<string | null>(null);

    // Server Settings Tab
    const [settingsTab, setSettingsTab] = useState('server-profile');
    const [accountEmail, setAccountEmail] = useState('');
    const [selectedBanner, setSelectedBanner] = useState(0);
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
        setLoading(true);
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
                }
            })
            .catch((err) => {
                console.error('[CUA Admin] Failed to load subgrids:', err);
                setError(err.message);
            })
            .finally(() => setLoading(false));
    }, [tenantId]);

    // Load subgrid data
    useEffect(() => {
        if (!activeSubgridId) {
            console.log('[CUA Admin] No activeSubgridId, skipping subgrid data load');
            return;
        }
        console.log('[CUA Admin] Loading subgrid data for:', activeSubgridId);
        setLoading(true);
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
            })
            .finally(() => setLoading(false));
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

    const activeSubgrid = subgrids.find((s) => s._id === activeSubgridId);
    const activeChannel = channels.find((c) => c._id === activeChannelId);

    const textChannels = channels.filter(c => c.type !== 'voice' && c.type !== 'announcement');
    const voiceChannels = channels.filter(c => c.type === 'voice');

    // Check if server is empty (no channels)
    const isServerEmpty = channels.length === 0;

    // Combine posts and messages for feed
    const feedItems = useMemo(() => {
        const items = [...posts, ...messages].sort((a, b) => {
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        return items;
    }, [posts, messages]);

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
        try {
            await communityPost(`/subgrids/${activeSubgridId}/events`, {
                title: newEventTitle.trim(),
                description: newEventDescription.trim(),
                startDate: newEventDate || new Date().toISOString(),
            });
            const response = await communityGet(`/subgrids/${activeSubgridId}/events`);
            setEvents(response?.data || []);
            setCreateEventModalOpen(false);
            setNewEventTitle('');
            setNewEventDescription('');
            setNewEventDate('');
        } catch (err: any) {
            setError(err.message || 'Failed to create event.');
        }
    };

    const handleUpdateServer = async () => {
        if (!activeSubgridId) return;
        try {
            await communityPut(`/subgrids/${activeSubgridId}`, {
                name: serverName.trim(),
                description: serverDescription.trim(),
            });
            const response = await communityGet(`/tenants/${tenantId}/subgrids`);
            setSubgrids(response?.data || []);
            setServerSettingsModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to update server.');
        }
    };

    const handleInviteMember = async () => {
        const emailToInvite = inviteEmail.trim();
        if (!emailToInvite || !activeSubgridId) return;
        setError('');
        try {
            const response = await communityPost(`/subgrids/${activeSubgridId}/invites/email`, {
                email: emailToInvite,
                memberRole: 'member',
            });
            setInviteEmail('');
            setInviteModalOpen(false);
            if (response?.data?.emailSent) {
                Alert.alert('Invite Sent', `An invitation email has been sent to ${emailToInvite}`);
            } else {
                Alert.alert('Invite Created', 'Invitation created but email may not have been sent. You can share the invite link manually.');
            }
        } catch (err: any) {
            const message = err.message || 'Failed to send invite.';
            if (message.includes('already a member')) {
                Alert.alert('Already a Member', 'This user is already a member of your community.');
            } else if (message.includes('already been sent')) {
                Alert.alert('Invite Pending', 'An invitation has already been sent to this email address.');
            } else {
                setError(message);
            }
        }
    };

    const handleSendMessage = async () => {
        if ((!messageDraft.trim() && attachments.length === 0) || !activeSubgridId || !activeChannelId) return;
        try {
            setLoading(true);

            // Upload attachments first if any
            const uploadedAttachments: Array<{ type: string; value: string; mimeType?: string; fileName?: string }> = [];

            for (const att of attachments) {
                try {
                    const uploadResult = await uploadFile(
                        { uri: att.uri, name: att.name, type: att.type },
                        { type: 'chat', subgridId: activeSubgridId }
                    );
                    if (uploadResult?.url) {
                        const attType = att.type.startsWith('image/') ? 'image' :
                                       att.type.startsWith('audio/') ? 'voice' :
                                       att.type.startsWith('video/') ? 'video' : 'file';
                        uploadedAttachments.push({
                            type: attType,
                            value: uploadResult.url,
                            mimeType: att.type,
                            fileName: att.name,
                        });
                    }
                } catch (uploadErr) {
                    console.error('Failed to upload attachment:', uploadErr);
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
            setError(err.message || 'Failed to send message.');
        } finally {
            setLoading(false);
        }
    };

    // Copy invite link to clipboard
    const handleCopyInviteLink = async () => {
        const inviteLink = `https://the-gryd.com/${activeSubgridId?.slice(-8) || '3v4KrVwQ'}`;
        try {
            if (Platform.OS === 'web' && navigator.clipboard) {
                await navigator.clipboard.writeText(inviteLink);
                Alert.alert('Copied!', 'Invite link copied to clipboard');
            } else {
                // For native platforms, use Clipboard API from react-native
                const Clipboard = require('react-native').Clipboard;
                if (Clipboard?.setString) {
                    Clipboard.setString(inviteLink);
                    Alert.alert('Copied!', 'Invite link copied to clipboard');
                } else {
                    Alert.alert('Link', inviteLink);
                }
            }
        } catch (err) {
            Alert.alert('Invite Link', inviteLink);
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
            setLoading(true);
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
            setError(err.message || 'Failed to send voice note.');
        } finally {
            setLoading(false);
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
            } catch {}
            expoRecordingRef.current = null;
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        }
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Like a post
    const handleLikePost = async (postId: string) => {
        if (!activeSubgridId) return;
        try {
            const post = posts.find(p => p._id === postId);
            if (post?.userLiked) {
                // Unlike
                await communityDelete(`/subgrids/${activeSubgridId}/posts/${postId}/like`);
                setPosts(prev => prev.map(p =>
                    p._id === postId
                        ? { ...p, likeCount: Math.max(0, (p.likeCount || 0) - 1), userLiked: false }
                        : p
                ));
            } else {
                // Like
                await communityPost(`/subgrids/${activeSubgridId}/posts/${postId}/like`, {});
                setPosts(prev => prev.map(p =>
                    p._id === postId
                        ? { ...p, likeCount: (p.likeCount || 0) + 1, userLiked: true }
                        : p
                ));
            }
        } catch (err: any) {
            console.error('Failed to like/unlike post:', err.message);
        }
    };

    // Reshare a post
    const handleResharePost = async (postId: string) => {
        if (!activeSubgridId) return;
        try {
            const post = posts.find(p => p._id === postId);
            if (post?.userReshared) {
                // Unreshare
                await communityDelete(`/subgrids/${activeSubgridId}/posts/${postId}/reshare`);
                setPosts(prev => prev.map(p =>
                    p._id === postId
                        ? { ...p, reshareCount: Math.max(0, (p.reshareCount || 0) - 1), userReshared: false }
                        : p
                ));
            } else {
                // Reshare
                await communityPost(`/subgrids/${activeSubgridId}/posts/${postId}/reshare`, {});
                setPosts(prev => prev.map(p =>
                    p._id === postId
                        ? { ...p, reshareCount: (p.reshareCount || 0) + 1, userReshared: true }
                        : p
                ));
            }
        } catch (err: any) {
            console.error('Failed to reshare/unreshare post:', err.message);
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

    const currentUserMember = members.find(m => m.userId === userId || m.user?._id === userId || m._id === userId);
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
                        <Text style={styles.railLogoText}>RBFCU</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.railButton} onPress={() => router.push('/admin/messages')}>
                        <MaterialIcons name="message" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.railButton} onPress={() => setServerSettingsModalOpen(true)}>
                        <MaterialIcons name="settings" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={styles.railButton}>
                        <MaterialIcons name="star" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.railButton} onPress={toggleTheme}>
                        {mode === 'dark' ? (
                            <MaterialIcons name="light-mode" size={18} color={colors.textMuted} />
                        ) : (
                            <MaterialIcons name="dark-mode" size={18} color={colors.textMuted} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Channel Sidebar */}
                <View style={styles.channelSidebar}>
                    {/* Server Header with Dropdown */}
                    <View style={styles.serverHeaderContainer}>
                        <View style={styles.serverHeader}>
                            <View style={styles.serverHeaderLeft}>
                                <Text style={styles.serverName}>{activeSubgrid?.name || 'RBFCU Server'}</Text>
                                <TouchableOpacity onPress={() => setServerSettingsModalOpen(true)}>
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
                        <TouchableOpacity style={styles.eventsButton}>
                            <MaterialIcons name="event" size={16} color={colors.textMuted} />
                            <Text style={styles.eventsText}>Events</Text>
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
                                        onPress={() => setActiveChannelId(channel._id)}
                                    >
                                        <MaterialIcons name="tag" size={16} color={isActive ? colors.text : colors.textMuted} />
                                        <Text style={[styles.channelName, isActive && styles.channelNameActive]}>
                                            {channel.name || 'untitled'}
                                        </Text>
                                        {isActive && (
                                            <View style={styles.channelActions}>
                                                <TouchableOpacity
                                                    onPress={(e) => { e.stopPropagation(); setInviteModalOpen(true); }}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <MaterialIcons name="person-add" size={14} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={(e) => { e.stopPropagation(); handleDeleteChannel(channel._id, channel.name); }}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <MaterialIcons name="delete" size={14} color="#EF4444" />
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
                                    onPress={() => handleVoiceChannelClick(channel)}
                                >
                                    <MaterialIcons name="headphones" size={16} color={colors.textMuted} />
                                    <Text style={styles.channelName}>{channel.name || 'untitled'}</Text>
                                    <View style={styles.channelActions}>
                                        <TouchableOpacity
                                            onPress={(e) => { e.stopPropagation(); handleDeleteChannel(channel._id, channel.name); }}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <MaterialIcons name="delete" size={14} color="#EF4444" />
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
                <Pressable style={styles.mainContent} onPress={() => serverMenuOpen && setServerMenuOpen(false)}>
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
                                <Text style={styles.searchPlaceholder}>Search RBFCU server</Text>
                                <MaterialIcons name="search" size={14} color={colors.textMuted} />
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
                                style={styles.feedContainer}
                                contentContainerStyle={styles.feedContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {feedItems.length === 0 && !loading && (
                                    <View style={styles.welcomeCard}>
                                        <View style={styles.welcomeIcon}>
                                            <MaterialIcons name="tag" size={32} color={colors.textMuted} />
                                        </View>
                                        <Text style={styles.welcomeTitle}>Welcome to {activeChannel?.name || 'general'}</Text>
                                        <Text style={styles.welcomeSubtitle}>This is the start of the #{activeChannel?.name || 'general'} channel.</Text>
                                        <TouchableOpacity style={styles.editChannelBtn}>
                                            <MaterialIcons name="edit" size={14} color={colors.text} />
                                            <Text style={styles.editChannelText}>Edit Channel</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {feedItems.map((item: any) => {
                                    const isPost = !!item.authorId; // Posts have authorId, messages have senderId
                                    const authorId = item.authorId || item.senderId;
                                    const authorName = getAuthorName(authorId, members);
                                    const authorMember = members.find((member) =>
                                        member.userId === authorId || member.user?._id === authorId || member._id === authorId
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
                                                        <Text style={styles.postHandle}>@{String(authorId).slice(-8)}</Text>
                                                        <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.itemMenuContainer}>
                                                    <TouchableOpacity onPress={() => setItemMenuOpen(itemMenuOpen === item._id ? null : item._id)}>
                                                        <MaterialIcons name="more-horiz" size={18} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                    {itemMenuOpen === item._id && (
                                                        <View style={styles.itemMenuDropdown}>
                                                            <TouchableOpacity
                                                                style={styles.itemMenuItem}
                                                                onPress={() => isPost ? handleDeletePost(item._id) : handleDeleteMessage(item._id)}
                                                            >
                                                                <MaterialIcons name="delete" size={14} color="#EF4444" />
                                                                <Text style={styles.itemMenuTextDanger}>Delete</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            {!!item.body && (
                                                <Text style={styles.postBody}>{item.body}</Text>
                                            )}
                                            {item.attachments?.length > 0 && (
                                                <View style={styles.postAttachments}>
                                                    {item.attachments.map((att: any, idx: number) => {
                                                        const url = att?.value || att?.uri || att?.url || (typeof att === 'string' ? att : null);
                                                        const attType = att?.type || '';
                                                        if (!url) return null;

                                                        // Handle image attachments
                                                        if (attType === 'image' || attType === 'sticker' || attType === 'emoji' || url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                                                            return (
                                                                <Image
                                                                    key={`${item._id}-att-${idx}`}
                                                                    source={{ uri: url }}
                                                                    style={styles.postImage}
                                                                    resizeMode="cover"
                                                                />
                                                            );
                                                        }

                                                        // Handle video attachments
                                                        if (attType === 'video' || url.match(/\.(mp4|webm|mov)$/i)) {
                                                            return (
                                                                <View key={`${item._id}-att-${idx}`} style={styles.videoPlaceholder}>
                                                                    <MaterialIcons name="play-circle-filled" size={48} color="#FFFFFF" />
                                                                    <Text style={styles.videoLabel}>Video</Text>
                                                                </View>
                                                            );
                                                        }

                                                        // Handle audio/voice attachments
                                                        if (attType === 'audio' || attType === 'voice' || url.match(/\.(mp3|wav|webm|ogg|m4a)$/i)) {
                                                            return (
                                                                <View key={`${item._id}-att-${idx}`} style={styles.audioAttachment}>
                                                                    <MaterialIcons name="mic" size={20} color={colors.primary} />
                                                                    <Text style={styles.audioLabel}>Voice note</Text>
                                                                </View>
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
                                            {isPost ? (
                                                <View style={styles.postStats}>
                                                    <TouchableOpacity style={styles.statItem}>
                                                        <MaterialIcons name="chat-bubble" size={16} color={colors.textMuted} />
                                                        <Text style={styles.statText}>{commentCount}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.statItem} onPress={() => handleLikePost(item._id)}>
                                                        <MaterialIcons name="favorite" size={16} color={userLiked ? '#EF4444' : colors.textMuted} />
                                                        <Text style={[styles.statText, userLiked && { color: '#EF4444' }]}>{likeCount}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.statItem} onPress={() => handleResharePost(item._id)}>
                                                        <MaterialIcons name="repeat" size={16} color={userReshared ? '#22C55E' : colors.textMuted} />
                                                        <Text style={[styles.statText, userReshared && { color: '#22C55E' }]}>{reshareCount}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <View style={styles.postStats}>
                                                    <Text style={[styles.statText, { fontSize: 11 }]}>Message</Text>
                                                </View>
                                            )}
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

            {/* Invite Member Modal */}
            <Modal visible={inviteModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setInviteModalOpen(false)}>
                            <MaterialIcons name="close" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={styles.modalIconWrap}>
                            <MaterialIcons name="group" size={28} color="#22C55E" />
                            <View style={styles.modalIconBadge}>
                                <MaterialIcons name="add" size={10} color="#FFFFFF" />
                            </View>
                        </View>
                        <Text style={styles.modalTitle}>Invite members to {activeSubgrid?.name || 'RBFCU Server'}</Text>
                        <Text style={styles.modalSubtitle}>Recipients will be added in #general</Text>

                        <Text style={styles.modalLabel}>Enter Email address</Text>
                        <View style={styles.inputWithBtn}>
                            <TextInput
                                style={styles.modalInputFlex}
                                placeholder="name@example.com"
                                placeholderTextColor={colors.textSubtle}
                                value={inviteEmail}
                                onChangeText={setInviteEmail}
                            />
                            <TouchableOpacity style={styles.actionBtn} onPress={handleInviteMember}>
                                <Text style={styles.actionBtnText}>Invite</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.linkLabel}>Or, send a server invite link to a friend</Text>
                        <View style={styles.inputWithBtn}>
                            <TextInput
                                style={[styles.modalInputFlex, styles.disabledInput]}
                                value={`https://the-gryd.com/${activeSubgridId?.slice(-8) || '3v4KrVwQ'}`}
                                editable={false}
                            />
                            <TouchableOpacity style={styles.actionBtn} onPress={handleCopyInviteLink}>
                                <Text style={styles.actionBtnText}>Copy Link</Text>
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
                        <Text style={styles.modalTitle}>Create Event</Text>

                        <Text style={styles.modalLabel}>EVENT TITLE</Text>
                        <View style={styles.inputRow}>
                            <MaterialIcons name="event" size={18} color={colors.textMuted} />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Event Title"
                                placeholderTextColor={colors.textSubtle}
                                value={newEventTitle}
                                onChangeText={setNewEventTitle}
                            />
                        </View>

                        <Text style={styles.modalLabel}>DESCRIPTION</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Event description..."
                            placeholderTextColor={colors.textSubtle}
                            value={newEventDescription}
                            onChangeText={setNewEventDescription}
                            multiline
                            numberOfLines={3}
                        />

                        <Text style={styles.modalLabel}>DATE</Text>
                        <View style={styles.inputRow}>
                            <MaterialIcons name="event" size={18} color={colors.textMuted} />
                            <TextInput
                                style={styles.modalInput}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.textSubtle}
                                value={newEventDate}
                                onChangeText={setNewEventDate}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateEventModalOpen(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createBtn} onPress={handleCreateEvent}>
                                <Text style={styles.createBtnText}>Create Event</Text>
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
                            <MaterialIcons name="tag" size={16} color={colors.text} />
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
                            style={[styles.settingsNavItem, settingsTab === 'server-tag' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('server-tag')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'server-tag' && styles.settingsNavTextActive]}>Server Tag</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'engagement' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('engagement')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'engagement' && styles.settingsNavTextActive]}>Engagement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'boost-perks' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('boost-perks')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'boost-perks' && styles.settingsNavTextActive]}>Boost Perks</Text>
                        </TouchableOpacity>

                        <Text style={styles.settingsSectionLabel}>EXPRESSION</Text>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'emoji' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('emoji')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'emoji' && styles.settingsNavTextActive]}>Emoji</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'stickers' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('stickers')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'stickers' && styles.settingsNavTextActive]}>Stickers</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'soundboard' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('soundboard')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'soundboard' && styles.settingsNavTextActive]}>Soundboard</Text>
                        </TouchableOpacity>

                        <Text style={styles.settingsSectionLabel}>PEOPLE</Text>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'members' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('members')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'members' && styles.settingsNavTextActive]}>Members</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'roles' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('roles')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'roles' && styles.settingsNavTextActive]}>Roles</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'invites' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('invites')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'invites' && styles.settingsNavTextActive]}>Invites</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'access' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('access')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'access' && styles.settingsNavTextActive]}>Access</Text>
                        </TouchableOpacity>

                        <Text style={styles.settingsSectionLabel}>APPS</Text>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'integrations' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('integrations')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'integrations' && styles.settingsNavTextActive]}>Integrations</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'app-directory' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('app-directory')}
                        >
                            <View style={styles.settingsNavItemRow}>
                                <Text style={[styles.settingsNavText, settingsTab === 'app-directory' && styles.settingsNavTextActive]}>App Directory</Text>
                                <MaterialIcons name="open-in-new" size={14} color={colors.textMuted} />
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.settingsSectionLabel}>MODERATION</Text>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'safety-setup' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('safety-setup')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'safety-setup' && styles.settingsNavTextActive]}>Safety Setup</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'audit-log' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('audit-log')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'audit-log' && styles.settingsNavTextActive]}>Audit Log</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.settingsNavItem, settingsTab === 'bans' && styles.settingsNavItemActive]}
                            onPress={() => setSettingsTab('bans')}
                        >
                            <Text style={[styles.settingsNavText, settingsTab === 'bans' && styles.settingsNavTextActive]}>Bans</Text>
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
                                                    <Text style={styles.serverPreviewAvatarText}>
                                                        {(serverName || activeSubgrid?.name || 'RS')[0]?.toUpperCase()}
                                                    </Text>
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
                                    <TouchableOpacity style={styles.changeIconBtn}>
                                        <Text style={styles.changeIconBtnText}>Change Server Icon</Text>
                                    </TouchableOpacity>

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
                                    </View>
                                </View>
                            )}

                            {/* Members Tab */}
                            {settingsTab === 'members' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Members</Text>
                                    <Text style={styles.settingsPanelDesc}>Manage server members and their permissions</Text>

                                    <View style={styles.membersSearchRow}>
                                        <View style={styles.membersSearchBox}>
                                            <MaterialIcons name="search" size={18} color={colors.textMuted} />
                                            <TextInput
                                                style={styles.membersSearchInput}
                                                placeholder="Search members..."
                                                placeholderTextColor={colors.textSubtle}
                                            />
                                        </View>
                                        <TouchableOpacity style={styles.inviteMemberBtn} onPress={() => { setServerSettingsModalOpen(false); setInviteModalOpen(true); }}>
                                            <MaterialIcons name="person-add" size={16} color="#FFFFFF" />
                                            <Text style={styles.inviteMemberBtnText}>Invite Member</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.membersListHeader}>
                                        <Text style={styles.membersListHeaderText}>MEMBER</Text>
                                        <Text style={styles.membersListHeaderText}>ROLE</Text>
                                        <Text style={styles.membersListHeaderText}>JOINED</Text>
                                        <Text style={styles.membersListHeaderText}>ACTIONS</Text>
                                    </View>

                                    {members.map((member, index) => (
                                        <View key={member._id || index} style={styles.memberListItem}>
                                            <View style={styles.memberListItemLeft}>
                                                <UserAvatar
                                                    uri={getMemberAvatarUrl(member)}
                                                    name={getMemberName(member)}
                                                    style={styles.memberListAvatar}
                                                />
                                                <Text style={styles.memberListName}>{getMemberName(member)}</Text>
                                            </View>
                                            <Text style={styles.memberListRole}>{member.role || 'Member'}</Text>
                                            <Text style={styles.memberListJoined}>Jan 2026</Text>
                                            <View style={styles.memberListActions}>
                                                <TouchableOpacity style={styles.memberActionBtn}>
                                                    <MaterialIcons name="edit" size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.memberActionBtn}>
                                                    <MaterialIcons name="delete" size={16} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}

                                    {members.length === 0 && (
                                        <View style={styles.emptyMembersList}>
                                            <MaterialIcons name="group" size={48} color={colors.textMuted} />
                                            <Text style={styles.emptyMembersText}>No members yet</Text>
                                            <Text style={styles.emptyMembersHint}>Invite people to join your server</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Roles Tab */}
                            {settingsTab === 'roles' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Roles</Text>
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
                                    <Text style={styles.settingsPanelTitle}>Invites</Text>
                                    <Text style={styles.settingsPanelDesc}>Manage server invite links</Text>

                                    <TouchableOpacity style={styles.createInviteBtn} onPress={() => { setServerSettingsModalOpen(false); setInviteModalOpen(true); }}>
                                        <MaterialIcons name="link" size={18} color="#FFFFFF" />
                                        <Text style={styles.createInviteBtnText}>Create Invite Link</Text>
                                    </TouchableOpacity>

                                    <View style={styles.invitesListEmpty}>
                                        <MaterialIcons name="link" size={48} color={colors.textMuted} />
                                        <Text style={styles.invitesEmptyText}>No active invites</Text>
                                        <Text style={styles.invitesEmptyHint}>Create an invite link to share with others</Text>
                                    </View>
                                </View>
                            )}

                            {/* Emoji Tab */}
                            {settingsTab === 'emoji' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Emoji</Text>
                                    <Text style={styles.settingsPanelDesc}>Add custom emoji for your server members to use</Text>

                                    <TouchableOpacity style={styles.uploadEmojiBtn}>
                                        <MaterialIcons name="add-photo-alternate" size={18} color="#FFFFFF" />
                                        <Text style={styles.uploadEmojiBtnText}>Upload Emoji</Text>
                                    </TouchableOpacity>

                                    <View style={styles.emojiListEmpty}>
                                        <MaterialIcons name="emoji-emotions" size={48} color={colors.textMuted} />
                                        <Text style={styles.emojiEmptyText}>No custom emoji</Text>
                                        <Text style={styles.emojiEmptyHint}>Upload custom emoji for your server</Text>
                                    </View>
                                </View>
                            )}

                            {/* Audit Log Tab */}
                            {settingsTab === 'audit-log' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Audit Log</Text>
                                    <Text style={styles.settingsPanelDesc}>View a log of all actions taken in this server</Text>

                                    <View style={styles.auditLogEmpty}>
                                        <MaterialIcons name="history" size={48} color={colors.textMuted} />
                                        <Text style={styles.auditLogEmptyText}>No audit log entries</Text>
                                        <Text style={styles.auditLogEmptyHint}>Actions taken in this server will appear here</Text>
                                    </View>
                                </View>
                            )}

                            {/* Bans Tab */}
                            {settingsTab === 'bans' && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>Bans</Text>
                                    <Text style={styles.settingsPanelDesc}>View and manage banned users</Text>

                                    <View style={styles.bansListEmpty}>
                                        <MaterialIcons name="block" size={48} color={colors.textMuted} />
                                        <Text style={styles.bansEmptyText}>No banned users</Text>
                                        <Text style={styles.bansEmptyHint}>Banned users will appear here</Text>
                                    </View>
                                </View>
                            )}

                            {/* Default/Other tabs */}
                            {['server-tag', 'engagement', 'boost-perks', 'stickers', 'soundboard', 'access', 'integrations', 'app-directory', 'safety-setup'].includes(settingsTab) && (
                                <View style={styles.settingsPanel}>
                                    <Text style={styles.settingsPanelTitle}>{settingsTab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</Text>
                                    <Text style={styles.settingsPanelDesc}>Configure {settingsTab.replace(/-/g, ' ')} settings</Text>

                                    <View style={styles.comingSoonBox}>
                                        <MaterialIcons name="construction" size={48} color={colors.textMuted} />
                                        <Text style={styles.comingSoonText}>Coming Soon</Text>
                                        <Text style={styles.comingSoonHint}>This feature is under development</Text>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
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
        railButton: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
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
        },
        eventsText: {
            fontSize: 14,
            color: colors.textMuted,
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
        },
        postHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
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
        itemMenuTextDanger: {
            fontSize: 13,
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
            height: 200,
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
            backgroundColor: colors.appBg,
        },
        settingsSidebar: {
            width: 220,
            backgroundColor: colors.surface,
            paddingVertical: 16,
            borderRightWidth: 1,
            borderRightColor: colors.border,
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
            borderRadius: 4,
        },
        settingsNavItemActive: {
            backgroundColor: colors.surfaceMuted,
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
            color: colors.text,
            fontWeight: '500',
        },
        settingsContent: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        settingsContentHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
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
            backgroundColor: '#5865F2',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
            alignSelf: 'flex-start',
            marginBottom: 24,
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
    });

export default CreditUnionAdminScreen;
