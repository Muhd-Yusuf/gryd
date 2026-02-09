import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sun, Moon, X, Search, UserPlus, ChevronDown, Check, Phone, Video, MoreHorizontal, Trash2, File, Send, Paperclip, Smile, Mic, MessageSquare, Bell, AtSign, Eye, PhoneOff, PhoneIncoming, PhoneOutgoing, PhoneMissed, ArrowUpRight, ArrowDownLeft, MessageCircle, Trophy, User, LucideIcon } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { communityGet, communityPost, communityDelete, getAuthUser, getTenantId, getUserId, resolveTenantId, resolveUserId, getOnlineStatus, updatePresence, setUserOnline, uploadFile } from '../../../lib/api';
import { useTheme } from '../../../lib/theme';
import { formatRelativeTime, formatMessageDate, Attachment, twemojiUrl } from '../../../lib/chatMedia';
import { getCachedUsers, cacheUsers, getAllCachedUsers, getCachedSubgrids, cacheSubgrids, getCachedFriends, cacheFriends, getCachedMessages, cacheMessages, removeMessageFromCache, addMessageToCache } from '../../../lib/userCache';
import { createOptimisticMessage, markMessageSent, markMessageFailed, isTempId, saveDraft, getDraft, clearDraft } from '../../../lib/messageQueue';
import UserAvatar from '../../../components/UserAvatar';
import VoiceMessagePlayer from '../../../components/VoiceMessagePlayer';
import { useAgoraCall } from '../../../hooks';
import { useCallContext } from '../../../contexts/CallContext';
import { CallModalDefault as CallModal } from '../../../components';
import { diagnoseCallState } from '../../../lib/callTestUtils';
import { useWebSocketContext } from '../../../contexts/WebSocketContext';
import EmojiPicker from '../../../components/EmojiPicker';

type Subgrid = {
    _id: string;
    name?: string;
    logoUrl?: string;
};

type Member = {
    userId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
};

type UserProfile = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
};

type FriendRequest = {
    id: string;
    requesterId: string;
    recipientId: string;
    status: string;
    createdAt?: string;
    requester?: UserProfile | null;
    recipient?: UserProfile | null;
};

type Message = {
    _id: string;
    senderId?: string;
    body?: string;
    kind?: string;
    createdAt?: string;
    attachments?: Array<Attachment | string>;
    // Call history fields
    callType?: 'video' | 'voice';
    callDuration?: number;
    callStatus?: 'ended' | 'missed' | 'declined';
    isOutgoing?: boolean;
    isMissed?: boolean;
    isDeclined?: boolean;
};

const normalizeParam = (value?: string | string[]) => {
    if (Array.isArray(value)) {
        return value[0] || '';
    }
    return value || '';
};

const labelFromId = (value?: string) => {
    return '';
};

const buildName = (value?: string, user?: UserProfile | null) => {
    if (user) {
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        return name || user.email || '';
    }
    return '';
};

const formatTimeOnly = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
};

const formatCallDuration = (seconds?: number) => {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
};

const normalizeAttachments = (message: Message) => {
    const raw = Array.isArray(message.attachments) ? message.attachments : [];

    const result = raw
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') {
                // Try to determine type from URL
                const lowerItem = item.toLowerCase();
                if (lowerItem.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
                    return { type: 'image' as const, value: item, uri: item };
                }
                // Check for audio files (voice notes) - including cloudinary URLs
                if (lowerItem.match(/\.(mp3|wav|webm|m4a|ogg|aac)(\?|$)/i) || lowerItem.includes('/video/upload/') || lowerItem.includes('/raw/upload/')) {
                    return { type: 'audio' as const, value: item, uri: item };
                }
                // Check for cloudinary image URLs
                if (lowerItem.includes('/image/upload/')) {
                    return { type: 'image' as const, value: item, uri: item };
                }
                return { type: 'sticker' as const, value: item, uri: item };
            }

            // Handle object attachments
            const typed = item as Attachment & { uri?: string; url?: string; src?: string; secure_url?: string };

            // Get the URL from various possible properties
            const attachmentUrl = typed.value || typed.uri || typed.url || typed.src || typed.secure_url || '';

            // Determine type if not specified
            let attachmentType = typed.type;
            if (!attachmentType && attachmentUrl) {
                const lowerUrl = attachmentUrl.toLowerCase();
                if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || lowerUrl.includes('/image/upload/')) {
                    attachmentType = 'image';
                } else if (lowerUrl.match(/\.(mp3|wav|webm|m4a|ogg|aac)(\?|$)/i) || lowerUrl.includes('/video/upload/') || lowerUrl.includes('/raw/upload/')) {
                    attachmentType = 'audio';
                }
            }

            // Set uri appropriately
            const uri = typed.uri || (attachmentType === 'emoji' ? twemojiUrl(typed.value) : attachmentUrl);

            return { ...typed, type: attachmentType, value: attachmentUrl, uri };
        })
        .filter(Boolean) as Array<Attachment & { uri?: string }>;

    return result;
};

const DirectMessagesScreen = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { width } = useWindowDimensions();
    const isCompact = width < 1200;
    const isMobile = width < 900;
    const showCenterPanel = !isMobile;
    const router = useRouter();
    const params = useLocalSearchParams();
    const initialSubgridId = normalizeParam(params.subgridId);
    const [userId, setUserId] = useState(getUserId() || '');
    const [tenantId, setTenantId] = useState(getTenantId());
    const [subgrids, setSubgrids] = useState<Subgrid[]>(() => {
        const tid = getTenantId();
        return tid ? (getCachedSubgrids(tid) || []) : [];
    });
    const [subgridId, setSubgridId] = useState(() => {
        if (initialSubgridId) return initialSubgridId;
        const tid = getTenantId();
        const cached = tid ? getCachedSubgrids(tid) : null;
        return cached && cached.length > 0 ? cached[0]._id : '';
    });
    const [members, setMembers] = useState<Member[]>([]);
    const [friends, setFriends] = useState<string[]>(() => {
        const tid = getTenantId();
        const cached = tid ? getCachedSubgrids(tid) : null;
        const sgId = cached && cached.length > 0 ? cached[0]._id : '';
        if (sgId) {
            const friendsData = getCachedFriends(sgId);
            return friendsData?.friends || [];
        }
        return [];
    });
    const [friendUsers, setFriendUsers] = useState<Record<string, UserProfile>>(() => getAllCachedUsers() as Record<string, UserProfile>);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
    const [blockedIds, setBlockedIds] = useState<string[]>([]);
    const [blockedUsers, setBlockedUsers] = useState<Record<string, UserProfile>>({});
    const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
    const [lastMessages, setLastMessages] = useState<Record<string, Message | null>>({});
    const [search, setSearch] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [addFriendOpen, setAddFriendOpen] = useState(false);
    const [activePeerId, setActivePeerId] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState(() => ''); // Will be updated when activePeerId changes
    const [error, setError] = useState('');
    const [requestsOpen, setRequestsOpen] = useState(true);
    const [blockedOpen, setBlockedOpen] = useState(false);
    const [activeRail, setActiveRail] = useState('messages');
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [showSearchInput, setShowSearchInput] = useState(false);
    const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
    const [channels, setChannels] = useState<{ _id: string; name?: string }[]>([]);

    // Settings state
    const [notifyAllMessages, setNotifyAllMessages] = useState(true);
    const [notifyMentions, setNotifyMentions] = useState(true);
    const [allowDMs, setAllowDMs] = useState(true);
    const [showOnlineStatus, setShowOnlineStatus] = useState(true);

    // Call State - using Agora
    const [callError, setCallError] = useState('');

    // Get call context for managing calls
    const { incomingCall, clearIncomingCall, markCallConnected } = useCallContext();

    // WebSocket for real-time messages
    const { isConnected, joinRoom, leaveRoom, subscribe } = useWebSocketContext();

    // Agora call hook - memoize callbacks to prevent unnecessary re-renders
    const onCallEnded = useCallback((callId: string, reason: string) => {
        // Call ended - refresh messages to show call history
        if (subgridId && activePeerId) {
            communityGet(`/subgrids/${subgridId}/direct-messages?peerId=${activePeerId}`)
                .then(response => setMessages(response?.data || []))
                .catch(() => {});
        }
    }, [subgridId, activePeerId]);

    const onCallError = useCallback((err: Error) => {
        setCallError(err.message);
        if (Platform.OS !== 'web') {
            Alert.alert('Call Error', err.message);
        }
    }, []);

    // Memoize options to prevent useAgoraCall from recreating functions unnecessarily
    const agoraCallOptions = useMemo(() => ({
        onCallEnded,
        onError: onCallError,
    }), [onCallEnded, onCallError]);

    const agoraCall = useAgoraCall(agoraCallOptions);

    // Check if call modal should be visible
    const isCallModalVisible = agoraCall.callState !== 'idle';

    // Debug: Log call state changes
    useEffect(() => {
        console.log('[DM Page] Call state changed:', {
            callState: agoraCall.callState,
            callType: agoraCall.callType,
            hasCurrentCall: !!agoraCall.currentCall,
            remoteUsers: agoraCall.remoteUsers,
            isModalVisible: isCallModalVisible,
            error: agoraCall.error,
            duration: agoraCall.callDuration,
        });
    }, [agoraCall.callState, agoraCall.callType, agoraCall.currentCall, agoraCall.remoteUsers, isCallModalVisible, agoraCall.error, agoraCall.callDuration]);

    // Update CallContext when Agora call becomes connected
    useEffect(() => {
        if (agoraCall.callState === 'connected' && agoraCall.currentCall?.callId) {
            markCallConnected();
        }
    }, [agoraCall.callState, agoraCall.currentCall?.callId, markCallConnected]);

    // Chat features state
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [attachments, setAttachments] = useState<Array<{ uri: string; name: string; type: string }>>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingError, setRecordingError] = useState('');
    const recordingInterval = useRef<NodeJS.Timeout | null>(null);
    const expoRecordingRef = useRef<Audio.Recording | null>(null);
    const recordingStartRef = useRef<number>(0);

    const emojis = [
        '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌',
        '😍', '🥰', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗',
        '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
        '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🤚', '🖐️', '✋',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💖',
    ];

    useEffect(() => {
        let isActive = true;
        getAuthUser()
            .then((user) => {
                if (!isActive || !user) return;
                setCurrentUserProfile({
                    id: user.userId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                });
                // Also set userId from auth user if available
                if (user.userId) {
                    setUserId(user.userId);
                }
            })
            .catch(() => {});
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
        // Also resolve userId asynchronously (important for mobile)
        resolveUserId()
            .then((id) => {
                if (isActive && id) {
                    setUserId(id);
                }
            })
            .catch(() => {});
        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        const loadSubgrids = async () => {
            if (!tenantId) return;

            // Use cached subgrids first for instant display
            const cached = getCachedSubgrids(tenantId);
            if (cached && cached.length > 0) {
                setSubgrids(cached);
                if (!subgridId) {
                    setSubgridId(cached[0]._id);
                }
            }

            // Fetch fresh data in background
            try {
                const response = await communityGet(`/tenants/${tenantId}/subgrids`);
                const list = response?.data || [];
                setSubgrids(list);
                cacheSubgrids(tenantId, list);
                if (!subgridId && list.length > 0) {
                    setSubgridId(list[0]._id);
                }
            } catch (err: any) {
                // Keep cached data on error
                if (!cached || cached.length === 0) {
                    setError(err.message || 'Failed to load subgrids.');
                }
            }
        };

        loadSubgrids();
    }, [tenantId]);

    const activeSubgrid = useMemo(
        () => subgrids.find((s) => s._id === subgridId) || null,
        [subgrids, subgridId]
    );

    const refreshFriendState = async (activeSubgridId: string) => {
        // Load from cache first for instant display
        const cachedFriends = getCachedFriends(activeSubgridId);
        if (cachedFriends) {
            setFriends(cachedFriends.friends);
            setFriendUsers(prev => ({ ...prev, ...cachedFriends.users }));
        }

        // Then fetch fresh data in background
        try {
            const results = await Promise.allSettled([
                communityGet(`/subgrids/${activeSubgridId}/friends`),
                communityGet(`/subgrids/${activeSubgridId}/friend-requests?direction=incoming`),
                communityGet(`/subgrids/${activeSubgridId}/friend-requests?direction=outgoing`),
                communityGet(`/subgrids/${activeSubgridId}/blocks`),
            ]);
            const [friendsRes, incomingRes, outgoingRes, blocksRes] = results;
            if (friendsRes.status === 'fulfilled') {
                const friendsList = friendsRes.value?.data?.friends || [];
                const users = friendsRes.value?.data?.users || {};
                setFriends(friendsList);
                setFriendUsers(users);
                // Cache for instant loading on next visit
                cacheFriends(activeSubgridId, friendsList, users);
            } else if (!cachedFriends) {
                setFriends([]);
            }
            if (incomingRes.status === 'fulfilled') {
                setIncomingRequests(incomingRes.value?.data || []);
            } else {
                setIncomingRequests([]);
            }
            if (outgoingRes.status === 'fulfilled') {
                setOutgoingRequests(outgoingRes.value?.data || []);
            } else {
                setOutgoingRequests([]);
            }
            if (blocksRes.status === 'fulfilled') {
                setBlockedIds(blocksRes.value?.data?.blocked || []);
                const users = blocksRes.value?.data?.users || {};
                setBlockedUsers(users);
                cacheUsers(users);
            } else {
                setBlockedIds([]);
                setBlockedUsers({});
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load friends.');
        }
    };

    // Fetch last message for each friend to show in conversation list
    const fetchLastMessages = async (activeSubgridId: string, friendIds: string[]) => {
        if (!friendIds.length) return;

        const lastMsgs: Record<string, Message | null> = {};

        // Fetch last message for each friend in parallel (limit to avoid too many requests)
        const fetchPromises = friendIds.slice(0, 20).map(async (peerId) => {
            try {
                const response = await communityGet(`/subgrids/${activeSubgridId}/direct-messages?peerId=${peerId}&limit=1`);
                const msgs = response?.data || [];
                lastMsgs[peerId] = msgs.length > 0 ? msgs[0] : null;
            } catch {
                lastMsgs[peerId] = null;
            }
        });

        await Promise.all(fetchPromises);
        setLastMessages(lastMsgs);
    };

    useEffect(() => {
        const loadMembers = async () => {
            if (!subgridId) return;
            setError('');
            try {
                const response = await communityGet(`/subgrids/${subgridId}/members`);
                setMembers(response?.data || []);
            } catch (err: any) {
                setMembers([]);
                setError(err.message || 'Failed to load members.');
            }
        };

        const loadChannels = async () => {
            if (!subgridId) return;
            try {
                const response = await communityGet(`/subgrids/${subgridId}/channels`);
                setChannels(response?.data || []);
            } catch {
                setChannels([]);
            }
        };

        if (subgridId) {
            refreshFriendState(subgridId);
            loadChannels();
        }
        loadMembers();
    }, [subgridId]);

    // Fetch last messages when friends list changes
    useEffect(() => {
        if (subgridId && friends.length > 0) {
            fetchLastMessages(subgridId, friends);
        }
    }, [subgridId, friends]);

    // Load draft when switching conversations
    useEffect(() => {
        if (activePeerId) {
            setDraft(getDraft(activePeerId));
        }
    }, [activePeerId]);

    useEffect(() => {
        const loadMessages = async () => {
            if (!subgridId || !activePeerId) {
                setMessages([]);
                return;
            }

            // Load from cache first for instant display
            const cached = getCachedMessages(activePeerId);
            if (cached && cached.length > 0) {
                setMessages(cached as Message[]);
            }

            // Then fetch fresh data in background
            try {
                const response = await communityGet(`/subgrids/${subgridId}/direct-messages?peerId=${activePeerId}`);
                const msgs = response?.data || [];
                setMessages(msgs);
                cacheMessages(activePeerId, msgs);
            } catch {
                // Keep cached messages on error
                if (!cached || cached.length === 0) {
                    setMessages([]);
                }
            }
        };

        // Initial fetch
        loadMessages();

        // Only poll if WebSocket is not connected (fallback)
        let interval: NodeJS.Timeout | null = null;
        if (!isConnected) {
            interval = setInterval(loadMessages, 10000); // Reduced frequency when polling
        }
        return () => { if (interval) clearInterval(interval); };
    }, [subgridId, activePeerId, isConnected]);

    // WebSocket subscription for real-time DM updates
    // Use refs to avoid stale closures
    const userIdRef = useRef(userId);
    const activePeerIdRef = useRef(activePeerId);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { activePeerIdRef.current = activePeerId; }, [activePeerId]);

    useEffect(() => {
        if (!isConnected || !userId || !activePeerId) {
            console.log('[DM Web] Skipping WebSocket subscription - missing:', { isConnected, userId: !!userId, activePeerId: !!activePeerId });
            return;
        }

        // Create consistent DM room ID (sorted user IDs)
        const sortedIds = [String(userId), String(activePeerId)].sort();
        const dmRoomId = `${sortedIds[0]}_${sortedIds[1]}`;

        console.log('[DM Web] Joining DM room:', dmRoomId);
        joinRoom('dm', dmRoomId);

        // Subscribe to new messages
        const unsubNewMessage = subscribe('new_message', (data: any) => {
            console.log('[DM Web] new_message event received:', data?.roomType, data?.roomId);
            if (data.roomType === 'dm' && data.message) {
                const msgSenderId = String(data.message?.senderId || '');
                const msgRecipientId = String(data.message?.recipientId || '');
                const myUserId = String(userIdRef.current || '');
                const peerId = String(activePeerIdRef.current || '');

                // Check if this message belongs to this conversation
                const isForThisConversation =
                    (msgSenderId === myUserId && msgRecipientId === peerId) ||
                    (msgSenderId === peerId && msgRecipientId === myUserId);

                if (isForThisConversation) {
                    setMessages((prev) => {
                        // Avoid duplicates
                        if (prev.some((m) => m._id === data.message._id)) {
                            return prev;
                        }
                        return [...prev, data.message];
                    });
                }
            }
        });

        // Subscribe to message deletions
        const unsubMessageDeleted = subscribe('message_deleted', (data: any) => {
            if (data.roomType === 'dm' && data.messageId) {
                setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
            }
        });

        return () => {
            leaveRoom('dm', dmRoomId);
            unsubNewMessage();
            unsubMessageDeleted();
        };
    }, [isConnected, userId, activePeerId, joinRoom, leaveRoom, subscribe]);

    const friendSet = useMemo(() => new Set(friends), [friends]);
    const blockedSet = useMemo(() => new Set(blockedIds), [blockedIds]);
    const outgoingSet = useMemo(
        () => new Set(outgoingRequests.map((request) => request.recipientId)),
        [outgoingRequests]
    );
    const incomingMap = useMemo(() => {
        const map = new Map<string, FriendRequest>();
        incomingRequests.forEach((request) => {
            map.set(request.requesterId, request);
        });
        return map;
    }, [incomingRequests]);

    const peers = friends.filter((friendId) => friendId && friendId !== userId);
    const visiblePeers = peers.filter((peerId) => !blockedSet.has(peerId));

    const filteredPeers = visiblePeers
        .filter((peerId) =>
            buildName(peerId, friendUsers[peerId])
                .toLowerCase()
                .includes(search.trim().toLowerCase())
        )
        .sort((a, b) => {
            // Sort by most recent message (like WhatsApp)
            const msgA = lastMessages[a];
            const msgB = lastMessages[b];
            const timeA = msgA?.createdAt ? new Date(msgA.createdAt).getTime() : 0;
            const timeB = msgB?.createdAt ? new Date(msgB.createdAt).getTime() : 0;
            return timeB - timeA; // Newest first
        });

    const memberIds = members
        .map((member) => member.userId)
        .filter((memberId) => memberId && memberId !== userId);

    // Build a lookup map for member user profiles
    const memberUsers = useMemo(() => {
        const map: Record<string, UserProfile> = {};
        members.forEach((member) => {
            if (member.userId) {
                map[member.userId] = {
                    id: member.userId,
                    firstName: member.firstName,
                    lastName: member.lastName,
                    email: member.email,
                    avatarUrl: member.avatarUrl,
                };
            }
        });
        return map;
    }, [members]);

    const filteredMembers = memberIds.filter((peerId) =>
        buildName(peerId, memberUsers[peerId]).toLowerCase().includes(memberSearch.trim().toLowerCase())
    );

    const getAvatarUrl = (id?: string) => {
        if (!id) return null;
        if (currentUserProfile && id === currentUserProfile.id) {
            return currentUserProfile.avatarUrl || memberUsers[id]?.avatarUrl || null;
        }
        return (
            friendUsers[id]?.avatarUrl ||
            memberUsers[id]?.avatarUrl ||
            blockedUsers[id]?.avatarUrl ||
            null
        );
    };

    // Clear selection if active peer is no longer in filtered list
    useEffect(() => {
        if (activePeerId && filteredPeers.length > 0 && !filteredPeers.includes(activePeerId)) {
            setActivePeerId('');
        }
    }, [filteredPeers, activePeerId]);

    // Fetch initial online statuses and subscribe to WebSocket presence events
    useEffect(() => {
        if (!subgridId || visiblePeers.length === 0) return;

        // Update current user's presence
        updatePresence(subgridId);

        // Fetch initial online statuses (once)
        const fetchStatuses = async () => {
            const statuses = await getOnlineStatus(visiblePeers, subgridId);
            setOnlineStatuses(statuses);
        };
        fetchStatuses();

        // Subscribe to presence changes via WebSocket (real-time, no polling)
        const unsubPresence = subscribe('presence_changed', (data: any) => {
            if (data?.userId && typeof data?.online === 'boolean') {
                setOnlineStatuses((prev) => ({
                    ...prev,
                    [data.userId]: data.online,
                }));
                setUserOnline(data.userId, data.online);
            }
        });

        // Also subscribe to user_status_changed for broader updates
        const unsubStatus = subscribe('user_status_changed', (data: any) => {
            if (data?.userId && typeof data?.online === 'boolean') {
                setOnlineStatuses((prev) => ({
                    ...prev,
                    [data.userId]: data.online,
                }));
            }
        });

        return () => {
            unsubPresence();
            unsubStatus();
        };
    }, [subgridId, visiblePeers, subscribe]);

    // Update online status when messages are received (mark sender as online)
    useEffect(() => {
        messages.forEach((msg) => {
            if (msg.senderId && msg.senderId !== userId) {
                setOnlineStatuses((prev) => ({ ...prev, [msg.senderId!]: true }));
                setUserOnline(msg.senderId, true);
            }
        });
    }, [messages, userId]);

    const handleBack = () => {
        router.push('/(main)');
    };

    const handleAccept = async (requestId: string) => {
        if (!subgridId || !requestId) return;
        setError('');
        try {
            await communityPost(`/subgrids/${subgridId}/friend-requests/${requestId}/accept`, {});
            await refreshFriendState(subgridId);
        } catch (err: any) {
            setError(err.message || 'Failed to accept friend request');
        }
    };

    const handleDecline = async (requestId: string) => {
        if (!subgridId || !requestId) return;
        setError('');
        try {
            await communityPost(`/subgrids/${subgridId}/friend-requests/${requestId}/decline`, {});
            await refreshFriendState(subgridId);
        } catch (err: any) {
            setError(err.message || 'Failed to decline request.');
        }
    };

    const handleSendRequest = async (recipientId: string) => {
        if (!subgridId || !recipientId) return;
        setError('');
        try {
            await communityPost(`/subgrids/${subgridId}/friend-requests`, { recipientId });
            await refreshFriendState(subgridId);
        } catch (err: any) {
            setError(err.message || 'Failed to send request.');
        }
    };

    const handleUnblock = async (blockedId: string) => {
        if (!subgridId || !blockedId) return;
        setError('');
        try {
            await communityDelete(`/subgrids/${subgridId}/friends/${blockedId}/block`);
            await refreshFriendState(subgridId);
        } catch (err: any) {
            setError(err.message || 'Failed to unblock user.');
        }
    };

    const handleRemoveFriend = async () => {
        if (!subgridId || !activePeerId) return;
        setError('');
        try {
            await communityDelete(`/subgrids/${subgridId}/friends/${activePeerId}`);
            await refreshFriendState(subgridId);
            setActivePeerId('');
        } catch (err: any) {
            setError(err.message || 'Failed to remove friend.');
        }
    };

    const handleBlockToggle = async () => {
        if (!subgridId || !activePeerId) return;
        setError('');
        try {
            if (blockedSet.has(activePeerId)) {
                await communityDelete(`/subgrids/${subgridId}/friends/${activePeerId}/block`);
            } else {
                await communityPost(`/subgrids/${subgridId}/friends/${activePeerId}/block`, {});
            }
            await refreshFriendState(subgridId);
        } catch (err: any) {
            setError(err.message || 'Failed to update block status.');
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!subgridId || !activePeerId) return;

        // For temp messages (pending), just remove from state
        if (isTempId(messageId)) {
            setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
            return;
        }

        const confirmDelete = Platform.OS === 'web'
            ? window.confirm('Delete this message? This action cannot be undone.')
            : await new Promise<boolean>((resolve) => {
                Alert.alert(
                    'Delete message',
                    'Delete this message? This action cannot be undone.',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                    ]
                );
            });

        if (!confirmDelete) return;

        // Store message for rollback
        const deletedMessage = messages.find((msg) => msg._id === messageId);

        // Remove immediately (optimistic)
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
        removeMessageFromCache(activePeerId, messageId);

        try {
            await communityDelete(`/subgrids/${subgridId}/direct-messages/${messageId}`);
        } catch (error: any) {
            console.error('Failed to delete message:', error);
            // Rollback on failure
            if (deletedMessage) {
                setMessages((prev) => {
                    const newMessages = [...prev, deletedMessage].sort((a, b) => {
                        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return dateA - dateB;
                    });
                    return newMessages;
                });
                addMessageToCache(activePeerId, deletedMessage);
            }
            setError('Failed to delete. Message restored.');
        }
    };

    const handleSendMessage = async () => {
        const body = draft.trim();

        // Validate before sending
        if (!body && attachments.length === 0) {
            return;
        }
        if (!subgridId || !activePeerId || !userId) {
            setError('Please select a friend to message.');
            return;
        }

        setError('');

        // Clear draft immediately for instant feel
        setDraft('');
        clearDraft(activePeerId);

        // Create optimistic message - shows instantly
        const { tempMessage } = createOptimisticMessage(
            activePeerId,
            subgridId,
            body,
            userId,
            attachments.map(f => ({
                type: f.type.startsWith('image/') ? 'image' : 'file',
                value: f.uri,
                label: f.name,
                _isLocal: true,
            })),
            'text'
        );

        // Add to UI immediately
        setMessages((prev) => [...prev, tempMessage as Message]);

        // Update last message immediately
        setLastMessages(prev => ({
            ...prev,
            [activePeerId]: tempMessage as Message
        }));

        // Upload attachments in parallel
        const uploadedAttachments: any[] = [];
        if (attachments.length > 0) {
            const uploadPromises = attachments.map(async (file) => {
                try {
                    const result = await uploadFile(file, { type: 'attachment', subgridId });
                    if (result?.success && result?.data) {
                        return {
                            type: file.type.startsWith('image/') ? 'image' : 'file',
                            value: result.data.url || result.data.secure_url,
                            label: file.name,
                            mimeType: file.type,
                        };
                    }
                } catch (uploadErr: any) {
                    console.error('Failed to upload attachment:', uploadErr.message);
                }
                return null;
            });

            const results = await Promise.all(uploadPromises);
            results.forEach(r => { if (r) uploadedAttachments.push(r); });
            setAttachments([]);
        }

        try {
            const sendResult = await communityPost(`/subgrids/${subgridId}/direct-messages`, {
                recipientId: activePeerId,
                body: body || '',
                kind: 'text',
                attachments: uploadedAttachments,
            });

            // Replace temp message with real one
            if (sendResult?.data) {
                markMessageSent(tempMessage._id, sendResult.data);
                setMessages((prev) => {
                    const filtered = prev.filter((m) => m._id !== tempMessage._id && m._id !== sendResult.data._id);
                    const newMessages = [...filtered, sendResult.data];
                    cacheMessages(activePeerId, newMessages.filter(m => !isTempId(m._id)));
                    return newMessages;
                });
                setLastMessages(prev => ({
                    ...prev,
                    [activePeerId]: sendResult.data
                }));
            }
        } catch (err: any) {
            // Mark as failed but keep visible
            markMessageFailed(tempMessage._id, err.message);
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === tempMessage._id
                        ? { ...m, _status: 'failed', _error: err.message } as any
                        : m
                )
            );
            setError(err.message || 'Failed to send. Tap to retry.');
        }
    };

    // Call Handlers - using Agora
    const handleStartCall = async (type: 'audio' | 'video') => {
        if (!activePeerId || !subgridId) {
            setCallError('Please select a friend to call.');
            return;
        }
        setCallError('');
        try {
            console.log('[DM] Starting call:', { activePeerId, type, subgridId });
            await agoraCall.startCall(activePeerId, type, subgridId);
        } catch (err: any) {
            console.error('[DM] Call error:', err);
            setCallError(err.message || 'Unable to start call.');
        }
    };

    const handleEndCall = () => {
        console.log('[DM] Ending call');
        agoraCall.hangup();
        setCallError('');
    };

    const handleAnswerCall = async (callId: string, type: 'audio' | 'video') => {
        try {
            console.log('[DM] Answering call:', { callId, type });
            await agoraCall.answer(callId, type);
            clearIncomingCall();
        } catch (err: any) {
            console.error('[DM] Answer error:', err);
            setCallError(err.message || 'Unable to answer call.');
        }
    };

    const handleDeclineCall = async (callId: string) => {
        try {
            console.log('[DM] Declining call:', { callId });
            await agoraCall.decline(callId);
            clearIncomingCall();
        } catch (err: any) {
            console.error('[DM] Decline error:', err);
            setCallError(err.message || 'Unable to decline call.');
        }
    };

    // Expose call test utilities to browser console (web only)
    useEffect(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            (window as any).callTest = {
                diagnose: () => diagnoseCallState(agoraCall),
                startAudioCall: () => handleStartCall('audio'),
                startVideoCall: () => handleStartCall('video'),
                endCall: handleEndCall,
                getState: () => ({
                    callState: agoraCall.callState,
                    callType: agoraCall.callType,
                    currentCall: agoraCall.currentCall,
                    remoteUsers: agoraCall.remoteUsers,
                    isModalVisible: isCallModalVisible,
                    error: agoraCall.error || callError,
                }),
                toggleMute: agoraCall.toggleMute,
                toggleVideo: agoraCall.toggleVideo,
            };
            console.log('[DM Page] Call test utilities exposed to window.callTest');
        }
    }, [agoraCall, isCallModalVisible, callError]);

    // File/Image picker handlers
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

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const image = result.assets[0];
                setAttachments(prev => [...prev, {
                    uri: image.uri,
                    name: image.fileName || `image_${Date.now()}.jpg`,
                    type: image.mimeType || 'image/jpeg'
                }]);
            }
        } catch (err) {
            console.error('Error picking image:', err);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setDraft(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const handleStartRecording = async () => {
        setRecordingError('');
        setRecordingDuration(0);
        recordingStartRef.current = Date.now();

        try {
            // Request permissions
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                setRecordingError('Microphone permission denied');
                return;
            }

            // Configure audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Start recording
            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            expoRecordingRef.current = newRecording;
            setIsRecording(true);
            recordingInterval.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
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

        if (expoRecordingRef.current) {
            try {
                await expoRecordingRef.current.stopAndUnloadAsync();
                const uri = expoRecordingRef.current.getURI();
                const durationMs = Date.now() - recordingStartRef.current;

                if (uri && subgridId) {
                    // Upload the voice note
                    const result = await uploadFile(
                        { uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' },
                        { type: 'voice-note', subgridId }
                    );

                    if (result?.success && result?.data && activePeerId) {
                        // Send voice message
                        await communityPost(`/subgrids/${subgridId}/direct-messages`, {
                            recipientId: activePeerId,
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
                        // Refresh messages
                        const response = await communityGet(`/subgrids/${subgridId}/direct-messages?peerId=${activePeerId}`);
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

        if (expoRecordingRef.current) {
            try {
                await expoRecordingRef.current.stopAndUnloadAsync();
            } catch (err) {
                // Ignore errors during cancel
            }
            expoRecordingRef.current = null;
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const railItems: { id: string; Icon: LucideIcon; onPress?: () => void }[] = [
        {
            id: 'messages',
            Icon: MessageCircle,
        },
        {
            id: 'contributors',
            Icon: Trophy,
            onPress: () =>
                router.push({
                    pathname: '/(main)/top-contributors',
                    params: { subgridId },
                }),
        },
        {
            id: 'profile',
            Icon: User,
            onPress: () => router.push('/(main)/profile'),
        },
    ];

    const activePeer = friendUsers[activePeerId];
    const activePeerName = buildName(activePeerId, activePeer);

    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return aTime - bTime;
        });
    }, [messages]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={[styles.page, isMobile && styles.pageMobile]}>
                <View style={[styles.grid, isMobile && styles.gridMobile]}>
                    <View style={[styles.leftPanel, isCompact && styles.panelCompact]}>
                        <View style={styles.leftRail}>
                            <TouchableOpacity style={styles.railLogo} onPress={handleBack}>
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
                                const IconComponent = item.Icon;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.railButton, isActive && styles.railButtonActive]}
                                        onPress={() => {
                                            setActiveRail(item.id);
                                            item.onPress?.();
                                        }}
                                    >
                                        <IconComponent size={18} color={isActive ? colors.text : colors.textMuted} />
                                    </TouchableOpacity>
                                );
                            })}
                            <View style={styles.railDivider} />
                            <TouchableOpacity
                                style={styles.railButton}
                                onPress={toggleTheme}
                            >
                                {mode === 'dark' ? (
                                    <Sun size={18} color={colors.textMuted} />
                                ) : (
                                    <Moon size={18} color={colors.textMuted} />
                                )}
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity style={styles.exitButton} onPress={handleBack}>
                                <X size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.dmPanel}>
                            <Text style={styles.panelTitle}>Direct Messages</Text>

                            <View style={styles.topRow}>
                                <TouchableOpacity style={styles.searchIconBtn} onPress={() => setShowSearchInput(!showSearchInput)}>
                                    <Search size={18} color={showSearchInput ? colors.text : colors.textMuted} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.addFriendsBtn} onPress={() => setAddFriendOpen(true)}>
                                    <Text style={styles.addFriendsText}>Add Friends</Text>
                                    <UserPlus size={14} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            {showSearchInput && (
                                <View style={styles.searchInputContainer}>
                                    <Search size={16} color={colors.textMuted} />
                                    <TextInput
                                        style={styles.searchTextInput}
                                        placeholder="Search conversations..."
                                        placeholderTextColor={colors.textSubtle}
                                        value={search}
                                        onChangeText={setSearch}
                                        autoFocus
                                    />
                                    {search.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearch('')}>
                                            <X size={16} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {!!error && <Text style={styles.errorText}>{error}</Text>}

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarRow}>
                                {filteredPeers.map((peerId) => {
                                    const isOnline = onlineStatuses[peerId] || false;
                                    return (
                                        <View key={peerId} style={styles.avatarWrap}>
                                            <UserAvatar
                                                uri={getAvatarUrl(peerId)}
                                                name={buildName(peerId, friendUsers[peerId])}
                                                style={styles.avatarCircle}
                                            />
                                            <View style={[styles.avatarStatus, isOnline && styles.avatarStatusOnline]} />
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            <ScrollView contentContainerStyle={styles.dmList} showsVerticalScrollIndicator={false}>
                                {incomingRequests.length > 0 && (
                                    <View style={styles.groupBlock}>
                                        <TouchableOpacity style={styles.groupHeader} onPress={() => setRequestsOpen((prev) => !prev)}>
                                            <Text style={styles.groupTitle}>Requests</Text>
                                            <ChevronDown size={16} color={colors.textMuted} />
                                        </TouchableOpacity>
                                        {requestsOpen && incomingRequests.map((request) => (
                                            <View key={request.id} style={styles.requestRow}>
                                                <UserAvatar
                                                    uri={getAvatarUrl(request.requesterId)}
                                                    name={buildName(request.requesterId, request.requester)}
                                                    style={styles.dmAvatarSmall}
                                                />
                                                <View style={styles.requestInfo}>
                                                    <Text style={styles.dmName}>{buildName(request.requesterId, request.requester)}</Text>
                                                    <Text style={styles.dmMeta}>Wants to connect</Text>
                                                </View>
                                                <View style={styles.requestActions}>
                                                    <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(request.id)}>
                                                        <Check size={14} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.declineButton} onPress={() => handleDecline(request.id)}>
                                                        <X size={14} color={colors.text} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {filteredPeers.length === 0 && incomingRequests.length === 0 && (
                                    <Text style={styles.emptyText}>No direct messages yet.</Text>
                                )}
                                {filteredPeers.map((peerId) => {
                                    const isActive = peerId === activePeerId;
                                    const isOnline = onlineStatuses[peerId] || false;
                                    return (
                                        <TouchableOpacity
                                            key={peerId}
                                            style={[styles.dmRow, isActive && styles.dmRowActive]}
                                            onPress={() => {
                                                setActivePeerId(peerId);
                                                if (isMobile) {
                                                    router.push({
                                                        pathname: '/(main)/direct-messages/[peerId]',
                                                        params: { peerId, subgridId },
                                                    });
                                                }
                                            }}
                                        >
                                            <View style={styles.onlineIndicatorWrap}>
                                                <UserAvatar
                                                    uri={getAvatarUrl(peerId)}
                                                    name={buildName(peerId, friendUsers[peerId])}
                                                    style={styles.dmAvatarSmall}
                                                />
                                                <View style={[styles.onlineIndicator, isOnline && styles.onlineIndicatorActive]} />
                                            </View>
                                            <View style={styles.dmInfo}>
                                                <Text style={styles.dmName}>{buildName(peerId, friendUsers[peerId])}</Text>
                                                <Text style={styles.dmMeta} numberOfLines={1}>
                                                    {lastMessages[peerId]
                                                        ? `${lastMessages[peerId]?.senderId === userId ? 'You: ' : ''}${lastMessages[peerId]?.body || 'Attachment'}`
                                                        : 'Start a conversation'}
                                                </Text>
                                            </View>
                                            <Text style={styles.dmTime}>
                                                {lastMessages[peerId]?.createdAt
                                                    ? formatRelativeTime(lastMessages[peerId]!.createdAt!)
                                                    : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}

                                {blockedIds.length > 0 && (
                                    <View style={styles.groupBlock}>
                                        <TouchableOpacity style={styles.groupHeader} onPress={() => setBlockedOpen((prev) => !prev)}>
                                            <Text style={styles.groupTitle}>Blocked</Text>
                                            <ChevronDown size={16} color={colors.textMuted} />
                                        </TouchableOpacity>
                                        {blockedOpen && blockedIds.map((blockedId) => (
                                            <View key={blockedId} style={styles.blockedRow}>
                                                <Text style={styles.dmName}>{buildName(blockedId, blockedUsers[blockedId])}</Text>
                                                <TouchableOpacity style={styles.unblockButton} onPress={() => handleUnblock(blockedId)}>
                                                    <Text style={styles.unblockText}>Unblock</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </View>

                    {showCenterPanel && (
                        <View style={[styles.centerPanel, isCompact && styles.panelCompact]}>
                            {activePeerId ? (
                                <>
                                    <View style={styles.chatHeader}>
                                        <View style={styles.chatHeaderLeft}>
                                            <UserAvatar
                                                uri={getAvatarUrl(activePeerId)}
                                                name={buildName(activePeerId, friendUsers[activePeerId] || memberUsers[activePeerId])}
                                                style={styles.chatAvatar}
                                            />
                                            <View>
                                                <Text style={styles.chatTitle}>{activePeerName}</Text>
                                                <Text style={styles.chatSubtitle}>Online</Text>
                                            </View>
                                        </View>
                                        <View style={styles.chatHeaderRight}>
                                            <TouchableOpacity style={styles.headerIcon} onPress={() => handleStartCall('audio')}>
                                                <Phone size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.headerIcon} onPress={() => handleStartCall('video')}>
                                                <Video size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.moreBtn}>
                                                <MoreHorizontal size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <ScrollView contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false}>
                                        {/* Profile Section - matching mobile DM view */}
                                        <View style={styles.profileSection}>
                                            <View style={styles.profileAvatarWrap}>
                                                <UserAvatar
                                                    uri={getAvatarUrl(activePeerId)}
                                                    name={activePeerName}
                                                    style={styles.profileAvatar}
                                                />
                                            </View>
                                            <Text style={styles.profileName}>{activePeerName}</Text>
                                            {friendUsers[activePeerId]?.username && (
                                                <Text style={styles.profileHandle}>
                                                    @{friendUsers[activePeerId].username}
                                                </Text>
                                            )}
                                            <Text style={styles.profileIntro}>
                                                This is the beginning of your direct message with{'\n'}
                                                <Text style={styles.profileIntroName}>{activePeerName}</Text>
                                            </Text>
                                            <Text style={styles.forumCommon}>
                                                Forum in common:{' '}
                                                <Text style={styles.forumCommonValue}>
                                                    {channels.length > 0 ? channels.slice(0, 3).map(c => c.name).filter(Boolean).join(', ') || 'None' : 'None'}
                                                </Text>
                                            </Text>
                                            <View style={styles.profileActions}>
                                                <TouchableOpacity style={styles.removeButton} onPress={handleRemoveFriend}>
                                                    <Text style={styles.removeButtonText}>Remove Friend</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.blockButton} onPress={handleBlockToggle}>
                                                    <Text style={styles.blockButtonText}>
                                                        {blockedSet.has(activePeerId) ? 'Unblock' : 'Block'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {sortedMessages.length === 0 && (
                                            <View style={styles.emptyChat}>
                                                <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
                                            </View>
                                        )}
                                        {sortedMessages.map((message) => {
                                            const isMe = String(message.senderId || '') === String(userId || '');
                                            // Debug: log to verify isMe detection
                                            console.log('[DM] Message check:', { msgId: message._id, senderId: message.senderId, userId, isMe });
                                            const attachmentList = normalizeAttachments(message);

                                            // Render call history entry (like WhatsApp)
                                            if (message.callType || message.kind === 'call') {
                                                const isOutgoing = message.isOutgoing || String(message.senderId || '') === String(userId || '');
                                                const isMissed = message.isMissed || message.callStatus === 'missed';
                                                const isDeclined = message.isDeclined || message.callStatus === 'declined';
                                                const isVideoCall = message.callType === 'video';
                                                const CallIcon = isVideoCall ? Video : Phone;
                                                const ArrowIcon = isMissed ? PhoneMissed : (isOutgoing ? ArrowUpRight : ArrowDownLeft);
                                                const arrowColor = isMissed || isDeclined ? '#EF4444' : '#22C55E';

                                                let callLabel = isVideoCall ? 'Video call' : 'Voice call';
                                                if (isMissed) {
                                                    callLabel = isOutgoing ? 'Cancelled' : 'Missed';
                                                } else if (isDeclined) {
                                                    callLabel = isOutgoing ? 'Not answered' : 'Declined';
                                                }

                                                return (
                                                    <View key={message._id} style={styles.callHistoryItem}>
                                                        <View style={[styles.callHistoryIcon, (isMissed || isDeclined) && styles.callHistoryIconMissed]}>
                                                            <CallIcon size={18} color={(isMissed || isDeclined) ? '#EF4444' : colors.primary} />
                                                        </View>
                                                        <View style={styles.callHistoryInfo}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <ArrowIcon size={14} color={arrowColor} />
                                                                <Text style={[styles.callHistoryType, (isMissed || isDeclined) && styles.callHistoryTypeMissed]}>
                                                                    {callLabel}
                                                                </Text>
                                                            </View>
                                                            <Text style={styles.callHistoryDuration}>
                                                                {(isMissed || isDeclined) ? formatTimeOnly(message.createdAt) : formatCallDuration(message.callDuration)}
                                                            </Text>
                                                        </View>
                                                        <TouchableOpacity
                                                            style={styles.callHistoryAction}
                                                            onPress={() => handleStartCall(isVideoCall ? 'video' : 'audio')}
                                                        >
                                                            <CallIcon size={20} color={colors.primary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            }

                                            return (
                                                <View key={message._id} style={[styles.messageBubbleWrap, isMe && styles.messageBubbleWrapMe]}>
                                                    {/* Delete button for own messages - appears on left for own messages */}
                                                    {isMe && (
                                                        <TouchableOpacity
                                                            style={styles.messageDeleteBtn}
                                                            onPress={() => handleDeleteMessage(message._id)}
                                                        >
                                                            <Trash2 size={18} color={colors.error || '#EF4444'} />
                                                        </TouchableOpacity>
                                                    )}
                                                    {!isMe && (
                                                        <UserAvatar
                                                            uri={getAvatarUrl(message.senderId)}
                                                            name={buildName(message.senderId, friendUsers[message.senderId] || memberUsers[message.senderId])}
                                                            style={styles.messageAvatar}
                                                        />
                                                    )}
                                                    <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
                                                        {!!message.body && <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{message.body}</Text>}
                                                        {attachmentList.map((attachment, idx) => {
                                                            if (attachment.type === 'audio' || attachment.type === 'voice') {
                                                                return (
                                                                    <VoiceMessagePlayer
                                                                        key={`${message._id}-audio-${idx}`}
                                                                        source={attachment.value}
                                                                        durationMs={attachment.durationMs}
                                                                        colors={colors}
                                                                        compact={false}
                                                                    />
                                                                );
                                                            }
                                                            if (attachment.type === 'image') {
                                                                return (
                                                                    <Image
                                                                        key={`${message._id}-img-${idx}`}
                                                                        source={{ uri: attachment.value }}
                                                                        style={styles.msgAttachmentImage}
                                                                        resizeMode="cover"
                                                                    />
                                                                );
                                                            }
                                                            if (attachment.type === 'emoji' || attachment.type === 'sticker') {
                                                                return (
                                                                    <Image
                                                                        key={`${message._id}-sticker-${idx}`}
                                                                        source={{ uri: attachment.uri }}
                                                                        style={styles.msgStickerImage}
                                                                    />
                                                                );
                                                            }
                                                            if (attachment.type === 'file') {
                                                                return (
                                                                    <View key={`${message._id}-file-${idx}`} style={styles.msgFileBubble}>
                                                                        <File size={20} color={colors.textMuted} />
                                                                        <Text style={styles.msgFileText} numberOfLines={1}>{attachment.label || 'File'}</Text>
                                                                    </View>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
                                                            {formatMessageDate(message.createdAt)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </ScrollView>

                                    <View style={styles.composerContainer}>
                                        {/* Attachment Preview */}
                                        {attachments.length > 0 && (
                                            <View style={styles.attachmentPreviewRow}>
                                                {attachments.map((attachment, index) => (
                                                    <View key={index} style={styles.attachmentItem}>
                                                        {attachment.type.startsWith('image/') ? (
                                                            <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} />
                                                        ) : (
                                                            <View style={styles.attachmentFileBox}>
                                                                <File size={20} color={colors.textMuted} />
                                                            </View>
                                                        )}
                                                        <Text style={styles.attachmentFileName} numberOfLines={1}>{attachment.name}</Text>
                                                        <TouchableOpacity style={styles.removeAttachBtn} onPress={() => handleRemoveAttachment(index)}>
                                                            <X size={12} color="#FFFFFF" />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {/* Recording UI */}
                                        {isRecording ? (
                                            <View style={styles.recordingRow}>
                                                <View style={styles.recordingInfo}>
                                                    <View style={styles.recordingDot} />
                                                    <Text style={styles.recordingTime}>Recording {formatRecordingTime(recordingDuration)}</Text>
                                                </View>
                                                <View style={styles.recordingBtns}>
                                                    <TouchableOpacity style={styles.cancelRecBtn} onPress={handleCancelRecording}>
                                                        <Trash2 size={18} color="#EF4444" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.sendRecBtn} onPress={handleStopRecording}>
                                                        <Send size={16} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <View style={styles.composer}>
                                                <TouchableOpacity style={styles.composerIcon} onPress={handlePickFile}>
                                                    <Paperclip size={18} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TextInput
                                                    value={draft}
                                                    onChangeText={(text) => {
                                                        setDraft(text);
                                                        if (error) setError(''); // Clear error when typing
                                                    }}
                                                    placeholder="Type a message..."
                                                    placeholderTextColor={colors.textSubtle}
                                                    style={styles.composerInput}
                                                    onSubmitEditing={handleSendMessage}
                                                />
                                                <TouchableOpacity style={styles.composerIcon} onPress={() => setShowEmojiPicker(true)}>
                                                    <Smile size={18} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.composerIcon} onPress={handleStartRecording}>
                                                    <Mic size={18} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                                                    <Send size={16} color="#FFFFFF" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </>
                            ) : (
                                <View style={styles.emptyChat}>
                                    <MessageSquare size={48} color={colors.textSubtle} />
                                    <Text style={styles.emptyChatText}>Select a conversation to start messaging</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>

            {/* Emoji Picker Modal */}
            <EmojiPicker
                visible={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onSelectEmoji={handleEmojiSelect}
            />

            <Modal visible={addFriendOpen} transparent animationType="fade" onRequestClose={() => setAddFriendOpen(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setAddFriendOpen(false)} />
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Friends</Text>
                            <TouchableOpacity style={styles.iconButton} onPress={() => setAddFriendOpen(false)}>
                                <X size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalSearch}>
                            <Search size={14} color={colors.textMuted} />
                            <TextInput
                                value={memberSearch}
                                onChangeText={setMemberSearch}
                                placeholder="Search members"
                                placeholderTextColor={colors.textSubtle}
                                style={styles.modalSearchInput}
                            />
                        </View>
                        <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
                            {filteredMembers.length === 0 && <Text style={styles.emptyText}>No members found.</Text>}
                            {filteredMembers.map((peerId) => {
                                const isFriend = friendSet.has(peerId);
                                const isBlocked = blockedSet.has(peerId);
                                const isOutgoing = outgoingSet.has(peerId);
                                const isIncoming = incomingMap.has(peerId);
                                let actionLabel = 'Add';
                                if (isFriend) actionLabel = 'Friend';
                                if (isBlocked) actionLabel = 'Blocked';
                                if (isOutgoing) actionLabel = 'Pending';
                                if (isIncoming) actionLabel = 'Respond';
                                const isDisabled = isFriend || isBlocked || isOutgoing || isIncoming;
                                return (
                                    <View key={peerId} style={styles.modalRow}>
                                        <UserAvatar
                                            uri={getAvatarUrl(peerId)}
                                            name={buildName(peerId, memberUsers[peerId])}
                                            style={styles.modalAvatar}
                                        />
                                        <View style={styles.modalInfo}>
                                            <Text style={styles.dmName}>{buildName(peerId, memberUsers[peerId])}</Text>
                                            <Text style={styles.dmMeta}>Community member</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.modalActionButton, isDisabled && styles.modalActionDisabled]}
                                            onPress={() => {
                                                if (!isDisabled) {
                                                    handleSendRequest(peerId);
                                                }
                                            }}
                                        >
                                            <Text style={styles.modalAction}>{actionLabel}</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Settings Modal */}
            <Modal visible={settingsModalOpen} transparent animationType="fade" onRequestClose={() => setSettingsModalOpen(false)}>
                <View style={styles.settingsModalOverlay}>
                    <TouchableOpacity style={styles.settingsModalBackdrop} activeOpacity={1} onPress={() => setSettingsModalOpen(false)} />
                    <View style={styles.settingsModalCard}>
                        <View style={styles.settingsModalHeader}>
                            <Text style={styles.settingsModalTitle}>Settings</Text>
                            <TouchableOpacity onPress={() => setSettingsModalOpen(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.settingsContent} showsVerticalScrollIndicator={false}>
                            <Text style={styles.settingsSectionTitle}>Notifications</Text>
                            <View style={styles.settingsToggleRow}>
                                <View style={styles.settingsToggleInfo}>
                                    <Bell size={18} color={colors.textMuted} />
                                    <View>
                                        <Text style={styles.settingsToggleTitle}>All Messages</Text>
                                        <Text style={styles.settingsToggleDesc}>Get notified for every message</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.settingsToggle, notifyAllMessages && styles.settingsToggleActive]}
                                    onPress={() => setNotifyAllMessages(!notifyAllMessages)}
                                >
                                    <View style={[styles.settingsToggleKnob, notifyAllMessages && styles.settingsToggleKnobActive]} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.settingsToggleRow}>
                                <View style={styles.settingsToggleInfo}>
                                    <AtSign size={18} color={colors.textMuted} />
                                    <View>
                                        <Text style={styles.settingsToggleTitle}>Mentions Only</Text>
                                        <Text style={styles.settingsToggleDesc}>Only get notified when mentioned</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.settingsToggle, notifyMentions && styles.settingsToggleActive]}
                                    onPress={() => setNotifyMentions(!notifyMentions)}
                                >
                                    <View style={[styles.settingsToggleKnob, notifyMentions && styles.settingsToggleKnobActive]} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.settingsSectionTitle}>Privacy</Text>
                            <View style={styles.settingsToggleRow}>
                                <View style={styles.settingsToggleInfo}>
                                    <MessageSquare size={18} color={colors.textMuted} />
                                    <View>
                                        <Text style={styles.settingsToggleTitle}>Allow Direct Messages</Text>
                                        <Text style={styles.settingsToggleDesc}>Let others send you DMs</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.settingsToggle, allowDMs && styles.settingsToggleActive]}
                                    onPress={() => setAllowDMs(!allowDMs)}
                                >
                                    <View style={[styles.settingsToggleKnob, allowDMs && styles.settingsToggleKnobActive]} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.settingsToggleRow}>
                                <View style={styles.settingsToggleInfo}>
                                    <Eye size={18} color={colors.textMuted} />
                                    <View>
                                        <Text style={styles.settingsToggleTitle}>Show Online Status</Text>
                                        <Text style={styles.settingsToggleDesc}>Let others see when you're online</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.settingsToggle, showOnlineStatus && styles.settingsToggleActive]}
                                    onPress={() => setShowOnlineStatus(!showOnlineStatus)}
                                >
                                    <View style={[styles.settingsToggleKnob, showOnlineStatus && styles.settingsToggleKnobActive]} />
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.settingsSaveBtn} onPress={() => setSettingsModalOpen(false)}>
                            <Text style={styles.settingsSaveBtnText}>Save Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Agora Call Modal */}
            {isCallModalVisible && (
                <CallModal
                    visible={isCallModalVisible}
                    callState={agoraCall.callState}
                    callType={agoraCall.callType}
                    currentCall={agoraCall.currentCall}
                    incomingCall={null}
                    isMuted={agoraCall.isMuted}
                    isVideoEnabled={agoraCall.isVideoEnabled}
                    isSpeakerOn={agoraCall.isSpeakerOn}
                    remoteUsers={agoraCall.remoteUsers}
                    callDuration={agoraCall.callDuration}
                    error={agoraCall.error || callError}
                    peerName={activePeerName}
                    peerAvatar={getAvatarUrl(activePeerId) || undefined}
                    selfAvatar={getAvatarUrl(userId) || undefined}
                    engine={agoraCall.engine}
                    onAnswer={() => {}}
                    onDecline={() => {}}
                    onHangup={handleEndCall}
                    onToggleMute={agoraCall.toggleMute}
                    onToggleVideo={agoraCall.toggleVideo}
                    onToggleSpeaker={agoraCall.toggleSpeaker}
                    onSwitchCamera={agoraCall.switchCamera}
                />
            )}

            {/* Incoming Call Modal */}
            {incomingCall && !isCallModalVisible && (
                <Modal visible={true} transparent animationType="fade">
                    <View style={styles.callModalOverlay}>
                        <TouchableOpacity style={styles.callModalBackdrop} activeOpacity={1} onPress={() => handleDeclineCall(incomingCall.callId)} />
                        <View style={styles.callModalCard}>
                            <View style={styles.callModalHeader}>
                                <UserAvatar
                                    uri={getAvatarUrl(incomingCall.callerId)}
                                    name={buildName(incomingCall.callerId, friendUsers[incomingCall.callerId])}
                                    style={styles.callModalAvatar}
                                />
                                <View style={styles.callModalInfo}>
                                    <Text style={styles.callModalName}>
                                        {buildName(incomingCall.callerId, friendUsers[incomingCall.callerId])}
                                    </Text>
                                    <View style={styles.callModalType}>
                                        {incomingCall.callType === 'video' ? (
                                            <Video size={16} color={colors.textMuted} />
                                        ) : (
                                            <Phone size={16} color={colors.textMuted} />
                                        )}
                                        <Text style={styles.callModalTypeText}>
                                            Incoming {incomingCall.callType === 'video' ? 'Video' : 'Audio'} Call
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.callModalActions}>
                                <TouchableOpacity
                                    style={styles.declineCallButton}
                                    onPress={() => handleDeclineCall(incomingCall.callId)}
                                >
                                    <PhoneOff size={20} color="#FFFFFF" />
                                    <Text style={styles.declineCallText}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.acceptCallButton}
                                    onPress={() => handleAnswerCall(incomingCall.callId, incomingCall.callType)}
                                >
                                    <Phone size={20} color="#FFFFFF" />
                                    <Text style={styles.acceptCallText}>Accept</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
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
        },
        dmPanel: {
            flex: 1,
            paddingVertical: 20,
            paddingRight: 20,
            gap: 16,
        },
        panelTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        topRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        searchIconBtn: {
            width: 48,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        addFriendsBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
        },
        addFriendsText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        searchInputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            marginTop: 12,
        },
        searchTextInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
        },
        errorText: {
            fontSize: 11,
            color: colors.dangerText,
        },
        avatarRow: {
            flexGrow: 0,
            marginVertical: 4,
        },
        avatarWrap: {
            position: 'relative',
            marginRight: 12,
        },
        avatarCircle: {
            width: 56,
            height: 56,
            borderRadius: 16,
        },
        avatarStatus: {
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#6B7280',
            borderWidth: 2,
            borderColor: colors.appBg,
        },
        avatarStatusOnline: {
            backgroundColor: '#22C55E',
        },
        dmList: {
            gap: 8,
            paddingBottom: 24,
        },
        groupBlock: {
            gap: 8,
        },
        groupHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
        },
        groupTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
        },
        requestRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: colors.surfaceMuted,
        },
        requestInfo: {
            flex: 1,
            gap: 2,
        },
        requestActions: {
            flexDirection: 'row',
            gap: 8,
        },
        acceptButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#3B82F6',
        },
        declineButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        dmRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 16,
        },
        dmRowActive: {
            backgroundColor: colors.surfaceMuted,
        },
        onlineIndicatorWrap: {
            position: 'relative',
        },
        dmAvatarSmall: {
            width: 44,
            height: 44,
            borderRadius: 22,
        },
        onlineIndicator: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#6B7280',
            borderWidth: 2,
            borderColor: colors.appBg,
        },
        onlineIndicatorActive: {
            backgroundColor: '#22C55E',
        },
        dmInfo: {
            flex: 1,
            gap: 4,
        },
        dmName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        dmMeta: {
            fontSize: 12,
            color: colors.textMuted,
        },
        dmTime: {
            fontSize: 12,
            color: colors.textMuted,
        },
        emptyText: {
            fontSize: 12,
            color: colors.textSubtle,
            paddingVertical: 20,
        },
        blockedRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
        },
        unblockButton: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        unblockText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.text,
        },
        centerPanel: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            margin: 16,
            overflow: 'hidden',
        },
        chatHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        chatHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        chatAvatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
        },
        chatTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        chatSubtitle: {
            fontSize: 12,
            color: '#22C55E',
        },
        moreBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        messageList: {
            flex: 1,
            padding: 16,
            gap: 12,
        },
        emptyChat: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        emptyChatText: {
            fontSize: 14,
            color: colors.textSubtle,
        },
        messageBubbleWrap: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
        },
        messageBubbleWrapMe: {
            flexDirection: 'row-reverse',
        },
        messageAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
        },
        messageBubble: {
            maxWidth: '70%',
            backgroundColor: colors.surfaceMuted,
            borderRadius: 18,
            borderBottomLeftRadius: 4,
            padding: 14,
        },
        messageBubbleMe: {
            backgroundColor: '#3B82F6',
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 4,
        },
        messageText: {
            fontSize: 14,
            color: colors.text,
            lineHeight: 20,
        },
        messageTextMe: {
            color: '#FFFFFF',
        },
        messageTime: {
            fontSize: 10,
            color: colors.textMuted,
            marginTop: 6,
        },
        messageTimeMe: {
            color: 'rgba(255,255,255,0.7)',
        },
        messageDeleteBtn: {
            padding: 8,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 16,
            alignSelf: 'center',
            marginRight: 8,
        },
        // Call history styles
        callHistoryItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            marginBottom: 12,
            gap: 12,
        },
        callHistoryIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },
        callHistoryIconMissed: {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
        },
        callHistoryInfo: {
            flex: 1,
        },
        callHistoryType: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        callHistoryTypeMissed: {
            color: '#EF4444',
        },
        callHistoryDuration: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        callHistoryAction: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },
        // Attachment styles for messages
        msgAttachmentImage: {
            width: 200,
            height: 150,
            borderRadius: 12,
            marginTop: 8,
        },
        msgStickerImage: {
            width: 80,
            height: 80,
            marginTop: 8,
        },
        msgFileBubble: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surface,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginTop: 8,
            alignSelf: 'flex-start',
        },
        msgFileText: {
            fontSize: 13,
            color: colors.text,
            maxWidth: 150,
        },
        composer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        composerIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
        },
        composerInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: colors.surfaceMuted,
        },
        sendButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#3B82F6',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
        },
        modalBackdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        modalCard: {
            width: '100%',
            maxWidth: 400,
            maxHeight: '80%',
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
            gap: 16,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        modalTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        iconButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        modalSearch: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: colors.surfaceMuted,
        },
        modalSearchInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
        },
        modalList: {
            gap: 10,
            paddingBottom: 8,
        },
        modalRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: colors.surfaceMuted,
        },
        modalAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
        },
        modalInfo: {
            flex: 1,
            gap: 2,
        },
        modalActionButton: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        modalActionDisabled: {
            opacity: 0.6,
        },
        modalAction: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
        },
        callModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: 80,
            paddingHorizontal: 16,
        },
        callModalBackdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        callModalCard: {
            width: '100%',
            maxWidth: 340,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            gap: 16,
        },
        callModalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        callModalAvatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
        },
        callModalInfo: {
            flex: 1,
            gap: 4,
        },
        callModalName: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        callModalType: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        callModalTypeText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        callModalActions: {
            flexDirection: 'row',
            gap: 12,
        },
        acceptCallButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: '#22C55E',
        },
        acceptCallText: {
            fontSize: 15,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        declineCallButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: '#F87171',
        },
        declineCallText: {
            fontSize: 15,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        // Chat header call icons
        chatHeaderRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        headerIcon: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        // Outgoing call modal styles
        outgoingCallCard: {
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
        outgoingCallTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        callErrorText: {
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
        callAvatarLarge: {
            width: 120,
            height: 120,
            borderRadius: 60,
        },
        callParticipantName: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
        },
        callStatus: {
            fontSize: 14,
            color: colors.textMuted,
        },
        videoCallContainer: {
            width: '100%',
            aspectRatio: 0.75,
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
            width: 120,
            height: 120,
            borderRadius: 60,
        },
        videoParticipantName: {
            fontSize: 16,
            fontWeight: '600',
            color: '#FFFFFF',
            marginTop: 12,
        },
        selfVideoWrap: {
            position: 'absolute',
            top: 16,
            right: 16,
            width: 100,
            height: 140,
            borderRadius: 12,
            backgroundColor: '#2a2a2a',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#3a3a3a',
        },
        selfVideoAvatar: {
            width: 50,
            height: 50,
            borderRadius: 25,
        },
        selfVideoName: {
            fontSize: 11,
            fontWeight: '500',
            color: '#FFFFFF',
            marginTop: 6,
        },
        callControls: {
            flexDirection: 'row',
            gap: 16,
        },
        callControlButton: {
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        endCallBtn: {
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#EF4444',
        },
        // Composer container
        composerContainer: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            padding: 12,
        },
        // Attachment preview
        attachmentPreviewRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
        },
        attachmentItem: {
            width: 70,
            height: 70,
            borderRadius: 8,
            backgroundColor: colors.surfaceMuted,
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        attachmentThumb: {
            width: '100%',
            height: '100%',
            borderRadius: 8,
        },
        attachmentFileBox: {
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
        },
        attachmentFileName: {
            fontSize: 8,
            color: colors.textMuted,
            position: 'absolute',
            bottom: 2,
            left: 2,
            right: 2,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: 2,
            borderRadius: 4,
            textAlign: 'center',
        },
        removeAttachBtn: {
            position: 'absolute',
            top: 2,
            right: 2,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        // Recording UI
        recordingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        recordingInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        recordingDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#EF4444',
        },
        recordingTime: {
            fontSize: 14,
            color: colors.text,
        },
        recordingBtns: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        cancelRecBtn: {
            padding: 8,
        },
        sendRecBtn: {
            backgroundColor: '#5865F2',
            borderRadius: 6,
            padding: 8,
        },
        // Emoji picker modal
        emojiModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        emojiModalCard: {
            width: 320,
            maxHeight: 400,
            backgroundColor: colors.surface,
            borderRadius: 16,
            overflow: 'hidden',
        },
        emojiModalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        emojiModalTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        emojiScrollArea: {
            flex: 1,
            padding: 12,
        },
        emojiGridWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        emojiBtn: {
            width: '12.5%',
            aspectRatio: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emojiBtnText: {
            fontSize: 24,
        },
        // Settings Modal Styles
        settingsModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
        },
        settingsModalBackdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        settingsModalCard: {
            width: '100%',
            maxWidth: 400,
            maxHeight: '80%',
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
        },
        settingsModalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
        },
        settingsModalTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        settingsContent: {
            flex: 1,
        },
        settingsSectionTitle: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            marginBottom: 12,
            marginTop: 8,
        },
        settingsToggleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        settingsToggleInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flex: 1,
        },
        settingsToggleTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        settingsToggleDesc: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        settingsToggle: {
            width: 44,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            padding: 2,
        },
        settingsToggleActive: {
            backgroundColor: '#3B82F6',
        },
        settingsToggleKnob: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.surface,
        },
        settingsToggleKnobActive: {
            transform: [{ translateX: 20 }],
        },
        settingsSaveBtn: {
            backgroundColor: '#3B82F6',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 16,
        },
        settingsSaveBtnText: {
            fontSize: 15,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        // Profile section styles (matching mobile DM view)
        profileSection: {
            alignItems: 'center',
            paddingVertical: 24,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: 16,
        },
        profileAvatarWrap: {
            width: 88,
            height: 88,
            borderRadius: 44,
            borderWidth: 3,
            borderColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
        },
        profileAvatar: {
            width: 80,
            height: 80,
            borderRadius: 40,
        },
        profileName: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        profileHandle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 12,
        },
        profileIntro: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 12,
        },
        profileIntroName: {
            fontWeight: '600',
            color: colors.text,
        },
        forumCommon: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 16,
        },
        forumCommonValue: {
            fontWeight: '600',
            color: colors.text,
        },
        profileActions: {
            flexDirection: 'row',
            gap: 12,
        },
        removeButton: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
        },
        removeButtonText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        blockButton: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
        },
        blockButtonText: {
            fontSize: 13,
            fontWeight: '600',
            color: '#EF4444',
        },
    });

export default DirectMessagesScreen;
