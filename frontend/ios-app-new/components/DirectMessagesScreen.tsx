import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Platform,
    Modal,
    Pressable,
    Alert,
    Animated,
    useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    MessageSquare,
    Award,
    Sun,
    Moon,
    Plus,
    UserPlus,
    Mic,
    ChevronDown,
    Headphones,
    Settings,
    ArrowLeft,
    Phone,
    Video,
    Pin,
    Trash2,
    File,
    X,
    Send,
    PlusCircle,
    Paperclip,
    Smile,
    MoreHorizontal,
    Search,
    Loader2,
    PhoneOff,
    PhoneMissed,
    ArrowUpRight,
    ArrowDownLeft,
    PhoneIncoming,
    PhoneOutgoing,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../lib/theme';
import {
    communityGet,
    communityPost,
    communityDelete,
    getUserId,
    resolveUserId,
    resolveTenantId,
    getAuthUser,
    uploadFile,
    subscribeToCallEventsAsync,
    answerCall,
    declineCall,
} from '../lib/api';
import { Audio } from 'expo-av';
import { Attachment, twemojiUrl } from '../lib/chatMedia';
import UserAvatar from './UserAvatar';
import { useAgoraCall } from '../hooks';
import { useCallContext } from '../contexts/CallContext';
import { useWebSocketContext } from '../contexts/WebSocketContext';
// Import CallModal directly - Metro will resolve to .web.tsx on web platform
import CallModal from './CallModal';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { MessageBubble, MessageComposer } from './messaging';

// Incoming call notification type
type IncomingCallNotification = {
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: 'audio' | 'video';
    channelName: string;
    token: string;
    uid: number;
    appId: string;
};

type Channel = {
    _id: string;
    name?: string;
    type?: string;
    visibility?: string;
    status?: string;
};

type StakeholderBadge = 'stakeholder' | 'vendor' | 'partner' | 'sponsor' | 'investor';

const STAKEHOLDER_BADGE_COLORS: Record<StakeholderBadge, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};

type UserProfile = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    createdAt?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    stakeholderBadge?: StakeholderBadge | null;
};

type DirectMessage = {
    _id: string;
    senderId?: string;
    recipientId?: string;
    body?: string;
    createdAt?: string;
    kind?: string;
    attachments?: Array<Attachment | string>;
    // Call history fields
    callType?: 'video' | 'voice';
    callDuration?: number;
    callStatus?: 'ended' | 'missed' | 'declined';
    isOutgoing?: boolean;
    isMissed?: boolean;
    isDeclined?: boolean;
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
    status?: string;
    createdAt?: string;
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        username?: string;
        createdAt?: string;
        avatarUrl?: string;
    };
};

type Subgrid = {
    _id: string;
    name?: string;
    logoUrl?: string;
    coverImageUrl?: string;
};

export default function DirectMessagesScreen() {
    const { colors, mode, toggleTheme } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 900;
    const [mobileShowContent, setMobileShowContent] = useState(false);

    // WebSocket for real-time messages
    const { isConnected, joinRoom, leaveRoom, subscribe } = useWebSocketContext();

    const [subgrids, setSubgrids] = useState<Subgrid[]>([]);
    const [activeSubgridId, setActiveSubgridId] = useState<string | null>(null);
    const [friends, setFriends] = useState<string[]>([]);
    const [friendUsers, setFriendUsers] = useState<Record<string, UserProfile>>({});
    const [lastMessages, setLastMessages] = useState<Record<string, DirectMessage>>({});
    const [members, setMembers] = useState<Member[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [mutualFriends, setMutualFriends] = useState<string[]>([]);
    const [mutualFriendUsers, setMutualFriendUsers] = useState<Record<string, UserProfile>>({});
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUserInfo, setCurrentUserInfo] = useState<{ firstName?: string; lastName?: string; email?: string; avatarUrl?: string } | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);


    // Incoming call state
    const [incomingCall, setIncomingCall] = useState<IncomingCallNotification | null>(null);
    const incomingCallAnim = useRef(new Animated.Value(0)).current;
    const cleanupSSERef = useRef<(() => void) | null>(null);

    // Chat input state
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [attachments, setAttachments] = useState<Array<{ uri: string; name: string; type: string }>>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [addFriendOpen, setAddFriendOpen] = useState(false);
    const [addFriendSearch, setAddFriendSearch] = useState('');
    const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
    const recordingInterval = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<any | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStartRef = useRef<number>(0);
    const activeAudioStreamRef = useRef<any | null>(null);
    const expoRecordingRef = useRef<Audio.Recording | null>(null);

    const emojis = [
        '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌',
        '😍', '🥰', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗',
        '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
        '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
        '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕',
        '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🤚', '🖐️', '✋',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💖',
    ];

    const activeSubgrid = useMemo(
        () => subgrids.find((s) => s._id === activeSubgridId) || null,
        [subgrids, activeSubgridId]
    );

    // Sort friends by last message timestamp (most recent first) - WhatsApp-like behavior
    const sortedFriends = useMemo(() => {
        return [...friends].sort((a, b) => {
            const lastMsgA = lastMessages[a];
            const lastMsgB = lastMessages[b];

            // Friends with messages come first
            if (!lastMsgA && !lastMsgB) return 0;
            if (!lastMsgA) return 1;
            if (!lastMsgB) return -1;

            // Sort by most recent message
            const dateA = new Date(lastMsgA.createdAt || 0).getTime();
            const dateB = new Date(lastMsgB.createdAt || 0).getTime();
            return dateB - dateA;
        });
    }, [friends, lastMessages]);

    // Format relative time for last message (WhatsApp style)
    const formatLastMessageTime = useCallback((dateStr?: string): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }, []);

    // Truncate message preview
    const truncateMessage = useCallback((text?: string, maxLen = 30): string => {
        if (!text) return '';
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen) + '...';
    }, []);

    // Agora call hook for inline calling (matching member dashboard behavior)
    const { startActiveCall, markCallConnected, endCall: contextEndCall } = useCallContext();

    const onCallEnded = useCallback((callId: string, reason: string) => {
        console.log('[DirectMessages] Call ended:', callId, reason);
        // Refresh messages to show call history
        if (activeSubgridId && selectedFriendId) {
            communityGet(`/subgrids/${activeSubgridId}/direct-messages?peerId=${selectedFriendId}`)
                .then(response => setMessages(response?.data || []))
                .catch(() => {});
        }
    }, [activeSubgridId, selectedFriendId]);

    const onCallError = useCallback((err: Error) => {
        Alert.alert('Call Error', err.message);
    }, []);

    const agoraCallOptions = useMemo(() => ({
        onCallEnded,
        onError: onCallError,
    }), [onCallEnded, onCallError]);

    const agoraCall = useAgoraCall(agoraCallOptions);

    // Check if call modal should be visible
    const isCallModalVisible = agoraCall.callState !== 'idle';

    // Update CallContext when Agora call becomes connected
    useEffect(() => {
        if (agoraCall.callState === 'connected' && agoraCall.currentCall?.callId) {
            console.log('[DirectMessages] Agora connected, calling markCallConnected()');
            markCallConnected();
        }
    }, [agoraCall.callState, agoraCall.currentCall?.callId, markCallConnected]);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                const tenantId = await resolveTenantId();
                // Use resolveUserId to ensure user ID is properly loaded (important for mobile)
                let userId = await resolveUserId();
                console.log('[DirectMessages] Resolved userId from resolveUserId:', userId);

                // Load current user info
                const user = await getAuthUser();
                if (user) {
                    setCurrentUserInfo({
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        avatarUrl: user.avatarUrl,
                    });
                    // ALWAYS prefer userId from auth user if available (more reliable on mobile)
                    if (user.userId) {
                        console.log('[DirectMessages] Using userId from getAuthUser:', user.userId);
                        userId = user.userId;
                    }
                }

                // Set currentUserId with the best available value
                if (userId) {
                    console.log('[DirectMessages] Setting currentUserId to:', userId);
                    setCurrentUserId(userId);
                } else {
                    console.warn('[DirectMessages] No userId available from any source!');
                }

                if (!tenantId) {
                    console.warn('[DirectMessages] No tenant ID resolved');
                    return;
                }

                const subgridsRes = await communityGet(`/tenants/${tenantId}/subgrids`);
                const subgridsList = subgridsRes?.data || [];
                setSubgrids(subgridsList);
                if (subgridsList.length > 0) {
                    setActiveSubgridId(subgridsList[0]._id);
                }
            } catch (error) {
                console.error('[DirectMessages] Failed to load initial data:', error);
            }
        };
        loadData();
    }, []);

    const refreshFriends = useCallback(async (subgridId: string) => {
        try {
            const response = await communityGet(`/subgrids/${subgridId}/friends`);
            const friendIds = response?.data?.friends || [];
            const users = response?.data?.users || {};
            const normalizedIds = Array.isArray(friendIds) ? friendIds : [];
            console.log('[DirectMessages] refreshFriends loaded:', normalizedIds.length, 'friends');
            setFriends(normalizedIds);
            setFriendUsers(users);

            // Fetch last message for each friend to enable sorting by recent activity
            if (normalizedIds.length > 0) {
                const lastMsgsPromises = normalizedIds.slice(0, 20).map(async (friendId: string) => {
                    try {
                        const msgRes = await communityGet(`/subgrids/${subgridId}/direct-messages?peerId=${friendId}&limit=1`);
                        const msgs = msgRes?.data || [];
                        // API returns newest first, so msgs[0] is the most recent
                        return { friendId, lastMsg: msgs.length > 0 ? msgs[0] : null };
                    } catch {
                        return { friendId, lastMsg: null };
                    }
                });
                const results = await Promise.all(lastMsgsPromises);
                const lastMsgsMap: Record<string, DirectMessage> = {};
                results.forEach(({ friendId, lastMsg }) => {
                    if (lastMsg) {
                        lastMsgsMap[friendId] = lastMsg;
                    }
                });
                setLastMessages(lastMsgsMap);
            }

            // Only clear selection if previously selected friend is no longer in list
            setSelectedFriendId((prev) => {
                if (prev && !normalizedIds.includes(prev)) {
                    return null;
                }
                return prev;
            });
        } catch (error) {
            console.error('[DirectMessages] Failed to load friends:', error);
            setFriends([]);
            setFriendUsers({});
        }
    }, []);

    // Load friends and members when subgrid changes
    useEffect(() => {
        if (!activeSubgridId) return;

        refreshFriends(activeSubgridId);

        Promise.allSettled([
            communityGet(`/subgrids/${activeSubgridId}/members`),
            communityGet(`/subgrids/${activeSubgridId}/channels`),
        ]).then(([membersRes, channelsRes]) => {
            if (membersRes.status === 'fulfilled') {
                const rawMembers = membersRes.value?.data;
                setMembers(Array.isArray(rawMembers) ? rawMembers : []);
            }
            if (channelsRes.status === 'fulfilled') {
                const rawChannels = channelsRes.value?.data;
                setChannels(Array.isArray(rawChannels) ? rawChannels : []);
            }
        });
    }, [activeSubgridId, refreshFriends]);

    // Load messages when friend changes (ensure currentUserId is set first)
    useEffect(() => {
        if (!activeSubgridId || !selectedFriendId || !currentUserId) {
            console.log('[DirectMessages] Skipping message fetch - activeSubgridId:', activeSubgridId, 'selectedFriendId:', selectedFriendId, 'currentUserId:', currentUserId);
            return;
        }

        console.log('[DirectMessages] Fetching messages - currentUserId:', currentUserId, 'selectedFriendId:', selectedFriendId);
        communityGet(`/subgrids/${activeSubgridId}/direct-messages?peerId=${selectedFriendId}`)
            .then((res) => {
                const msgs = res?.data || [];
                console.log('[DirectMessages] Fetched', msgs.length, 'messages. First msg senderId:', msgs[0]?.senderId, 'currentUserId:', currentUserId);
                setMessages(Array.isArray(msgs) ? msgs : []);
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
            })
            .catch((err) => {
                console.error('[DirectMessages] Error fetching messages:', err);
                setMessages([]);
            });
    }, [activeSubgridId, selectedFriendId, currentUserId]);

    // Use refs to avoid stale closures in WebSocket handlers
    const currentUserIdRef = useRef(currentUserId);
    const selectedFriendIdRef = useRef(selectedFriendId);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    useEffect(() => {
        selectedFriendIdRef.current = selectedFriendId;
    }, [selectedFriendId]);

    // Subscribe to WebSocket for real-time DM updates
    useEffect(() => {
        console.log('[DirectMessages] WebSocket effect - isConnected:', isConnected, 'currentUserId:', currentUserId, 'selectedFriendId:', selectedFriendId);

        if (!isConnected || !currentUserId || !selectedFriendId) {
            console.log('[DirectMessages] Skipping subscription - missing:', { isConnected, currentUserId: !!currentUserId, selectedFriendId: !!selectedFriendId });
            return;
        }

        // Create consistent DM room ID (sorted user IDs)
        const sortedIds = [String(currentUserId), String(selectedFriendId)].sort();
        const dmRoomId = `${sortedIds[0]}_${sortedIds[1]}`;

        console.log('[DirectMessages] Joining DM room:', dmRoomId);
        joinRoom('dm', dmRoomId);

        // Subscribe to new messages - use refs to always get current values
        const unsubNewMessage = subscribe('new_message', (data: any) => {
            console.log('[DirectMessages] new_message event received:', data?.roomType, data?.roomId);
            // Only handle DM messages
            if (data.roomType === 'dm' && data.message) {
                const msgSenderId = String(data.message?.senderId || data.senderId || '');
                const msgRecipientId = String(data.message?.recipientId || data.recipientId || '');
                const myUserId = String(currentUserIdRef.current || '');
                const friendId = String(selectedFriendIdRef.current || '');

                console.log('[DirectMessages] Message details - sender:', msgSenderId, 'recipient:', msgRecipientId, 'me:', myUserId, 'friend:', friendId);

                // Check if this message belongs to this conversation
                const isForThisConversation =
                    (msgSenderId === myUserId && msgRecipientId === friendId) ||
                    (msgSenderId === friendId && msgRecipientId === myUserId);

                console.log('[DirectMessages] isForThisConversation:', isForThisConversation);

                if (isForThisConversation) {
                    setMessages((prev) => {
                        // Avoid duplicates
                        if (prev.some((m) => m._id === data.message._id)) {
                            console.log('[DirectMessages] Duplicate message, skipping');
                            return prev;
                        }
                        console.log('[DirectMessages] Adding new message to state');
                        return [...prev, data.message];
                    });
                    // Scroll to bottom for new messages
                    setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }

                // Update lastMessages for conversation list sorting (WhatsApp-like)
                const otherUserId = msgSenderId === myUserId ? msgRecipientId : msgSenderId;
                if (otherUserId) {
                    setLastMessages((prev) => ({
                        ...prev,
                        [otherUserId]: data.message,
                    }));
                }
            }
        });

        // Subscribe to message updates
        const unsubMessageUpdated = subscribe('message_updated', (data: any) => {
            if (data.roomType === 'dm' && data.message) {
                setMessages((prev) =>
                    prev.map((m) => (m._id === data.message._id ? data.message : m))
                );
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
            unsubMessageUpdated();
            unsubMessageDeleted();
        };
    }, [isConnected, currentUserId, selectedFriendId, joinRoom, leaveRoom, subscribe]);

    useEffect(() => {
        if (!activeSubgridId || !selectedFriendId) {
            setMutualFriends([]);
            setMutualFriendUsers({});
            return;
        }

        communityGet(`/subgrids/${activeSubgridId}/friends/${selectedFriendId}/mutual`)
            .then((response) => {
                const friendIds = response?.data?.friends || [];
                const users = response?.data?.users || {};
                setMutualFriends(Array.isArray(friendIds) ? friendIds : []);
                setMutualFriendUsers(users || {});
            })
            .catch((error) => {
                console.error('[DirectMessages] Failed to load mutual friends:', error);
                setMutualFriends([]);
                setMutualFriendUsers({});
            });
    }, [activeSubgridId, selectedFriendId, friends]);

    // Subscribe to call events via SSE
    useEffect(() => {
        let isMounted = true;

        const handleCallEvent = (event: string, data: any) => {
            if (!isMounted) return;

            switch (event) {
                case 'incoming_call':
                    console.log('[DirectMessages] Incoming call:', data);
                    const incoming: IncomingCallNotification = {
                        callId: data.callId,
                        callerId: data.callerId,
                        callerName: data.callerName || 'Unknown Caller',
                        callerAvatar: data.callerAvatar,
                        callType: data.callType || 'audio',
                        channelName: data.channelName,
                        token: data.token,
                        uid: data.uid,
                        appId: data.appId,
                    };
                    setIncomingCall(incoming);
                    // Animate in
                    Animated.spring(incomingCallAnim, {
                        toValue: 1,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 8,
                    }).start();
                    break;

                case 'call_answered':
                case 'call_declined':
                case 'call_ended':
                case 'call_missed':
                    console.log('[DirectMessages] Call event:', event, data);
                    // Clear incoming call notification
                    Animated.timing(incomingCallAnim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => {
                        setIncomingCall(null);
                    });
                    break;

                case 'user_busy':
                    console.log('[DirectMessages] User busy:', data);
                    Alert.alert('User Busy', 'User is busy on another call');
                    break;
            }
        };

        const setupSSE = async () => {
            try {
                const cleanup = await subscribeToCallEventsAsync(handleCallEvent);
                if (isMounted) {
                    cleanupSSERef.current = cleanup;
                } else {
                    cleanup();
                }
            } catch (err) {
                console.error('[DirectMessages] Failed to subscribe to call events:', err);
            }
        };

        setupSSE();

        return () => {
            isMounted = false;
            cleanupSSERef.current?.();
        };
    }, []);

    // Handle accepting incoming call
    const handleAcceptCall = useCallback(async () => {
        if (!incomingCall) return;

        try {
            const response = await answerCall(incomingCall.callId);
            if (response?.success) {
                // Navigate to voice channel with all required Agora params
                router.push({
                    pathname: '/voice-channel',
                    params: {
                        callId: incomingCall.callId,
                        agoraChannelName: incomingCall.channelName,
                        callType: incomingCall.callType,
                        token: incomingCall.token,
                        uid: String(incomingCall.uid),
                        appId: incomingCall.appId,
                        displayName: `Call with ${incomingCall.callerName}`,
                        peerName: incomingCall.callerName,
                        peerAvatar: incomingCall.callerAvatar || '',
                    },
                });
            } else {
                console.error('[DirectMessages] Failed to answer call:', response?.error);
                Alert.alert('Error', 'Failed to answer call. Please try again.');
            }
        } catch (err: any) {
            console.error('[DirectMessages] Answer call error:', err);
            Alert.alert('Error', err.message || 'Failed to answer call');
        } finally {
            Animated.timing(incomingCallAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setIncomingCall(null);
            });
        }
    }, [incomingCall, router, incomingCallAnim]);

    // Handle declining incoming call
    const handleDeclineCall = useCallback(async () => {
        if (!incomingCall) return;

        try {
            await declineCall(incomingCall.callId);
        } catch (err) {
            console.error('[DirectMessages] Decline call error:', err);
        } finally {
            Animated.timing(incomingCallAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setIncomingCall(null);
            });
        }
    }, [incomingCall, incomingCallAnim]);

    const getFriendName = (friendId: string) => {
        const user = friendUsers[friendId];
        if (user) {
            const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
            return name || user.email || 'Unknown User';
        }
        return 'Unknown User';
    };

    const getFriendUsername = (friendId: string) => {
        const user = friendUsers[friendId];
        if (user?.firstName) {
            return `@${user.firstName.toLowerCase()}${(user.lastName || '').slice(0, 3).toLowerCase()}`;
        }
        return `@user${friendId.slice(-6)}`;
    };

    const getFriendBadge = (friendId: string): StakeholderBadge | null => {
        const user = friendUsers[friendId];
        return user?.stakeholderBadge || null;
    };

    const getMemberId = (member: Member) => member.userId || member.user?._id || member._id || '';

    const getMemberName = (member: Member) => {
        const firstName = member.firstName || member.user?.firstName || '';
        const lastName = member.lastName || member.user?.lastName || '';
        const email = member.email || member.user?.email || '';
        const name = [firstName, lastName].filter(Boolean).join(' ').trim();
        return name || email || 'Unknown User';
    };

    const getMemberMeta = (member: Member) => {
        return member.username || member.user?.username || member.email || member.user?.email || '';
    };

    const formatMemberRole = (role?: string) => {
        switch ((role || '').toLowerCase()) {
            case 'subgrid_admin':
            case 'admin':
            case 'owner':
                return 'Credit Union Admin';
            case 'moderator':
                return 'Moderator';
            case 'member':
            default:
                return 'Credit Union Member';
        }
    };

    const isAdminRole = (role?: string | null) => {
        const value = String(role || '').toLowerCase();
        return value === 'subgrid_admin' || value === 'owner' || value === 'admin';
    };

    const getMemberRole = (id?: string | null) => {
        if (!id) return '';
        const idStr = String(id);
        const member = members.find((item) =>
            String(item.userId) === idStr || String(item._id) === idStr || String(item.user?._id) === idStr
        );
        return member?.role || '';
    };

    const memberMap = useMemo(() => {
        const map: Record<string, Member> = {};
        members.forEach((member) => {
            const id = member.userId || member.user?._id || member._id;
            if (id) {
                map[id] = member;
            }
        });
        return map;
    }, [members]);

    const getAvatarUrl = (id?: string) => {
        if (!id) return null;
        if (String(id) === String(currentUserId)) {
            return currentUserInfo?.avatarUrl || memberMap[id]?.avatarUrl || null;
        }
        return friendUsers[id]?.avatarUrl || mutualFriendUsers[id]?.avatarUrl || memberMap[id]?.avatarUrl || null;
    };

    const getMutualFriendName = (friendId: string) => {
        const user = mutualFriendUsers[friendId] || friendUsers[friendId];
        if (user) {
            const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
            return name || user.email || 'Unknown User';
        }
        const member = memberMap[friendId];
        if (member) {
            return getMemberName(member);
        }
        return 'Unknown User';
    };

    const commonForums = useMemo(() => {
        if (!selectedFriendId) return [];
        const currentRole = getMemberRole(currentUserId);
        const friendRole = getMemberRole(selectedFriendId);
        const allowAdmin = isAdminRole(currentRole) && isAdminRole(friendRole);
        return channels
            .filter((channel) => channel.status !== 'archived')
            .filter((channel) => channel.type !== 'voice')
            .filter((channel) => {
                if (channel.visibility === 'admin') {
                    return allowAdmin;
                }
                return true;
            })
            .map((channel) => channel.name)
            .filter(Boolean) as string[];
    }, [channels, selectedFriendId, currentUserId, members]);

    const getSenderName = (senderId: string) => {
        if (String(senderId) === String(currentUserId)) return 'You';
        const user = friendUsers[senderId];
        if (user) {
            return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Unknown User';
        }
        return selectedFriendId ? getFriendName(selectedFriendId) : 'Unknown User';
    };

    const normalizeAttachments = (message: DirectMessage) => {
        const raw = Array.isArray(message.attachments) ? message.attachments : [];

        // Debug: log raw attachments to understand their structure
        if (raw.length > 0) {
            console.log('[DirectMessages] Raw attachments for message:', message._id, JSON.stringify(raw));
        }

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

        // Debug logging for attachments
        if (result.length > 0) {
            console.log('[DirectMessages] Normalized attachments:', message._id, result);
        }
        return result;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTimeOnly = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
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

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && attachments.length === 0) || !activeSubgridId || !selectedFriendId) return;

        const body = newMessage.trim();
        setNewMessage('');

        try {
            // Upload attachments first if any
            const uploadedAttachments: Attachment[] = [];
            if (attachments.length > 0) {
                setUploading(true);
                for (const file of attachments) {
                    try {
                        const result = await uploadFile(file, { type: 'attachment', subgridId: activeSubgridId });
                        if (result?.success && result?.data) {
                            uploadedAttachments.push({
                                type: file.type.startsWith('image/') ? 'image' : 'file',
                                value: result.data.url || result.data.secure_url,
                                label: file.name,
                                mimeType: file.type,
                            } as Attachment);
                        }
                    } catch (uploadErr: any) {
                        console.error('Failed to upload attachment:', uploadErr.message);
                    }
                }
                setAttachments([]);
                setUploading(false);
            }

            const response = await communityPost(`/subgrids/${activeSubgridId}/direct-messages`, {
                recipientId: selectedFriendId,
                body,
                attachments: uploadedAttachments,
            });

            // Add the sent message to state immediately (optimistic update)
            // The WebSocket will also deliver it, but we handle duplicates
            if (response?.data) {
                setMessages((prev) => {
                    if (prev.some((m) => m._id === response.data._id)) {
                        return prev;
                    }
                    return [...prev, response.data];
                });
                // Update lastMessages for conversation list sorting (WhatsApp-like)
                setLastMessages((prev) => ({
                    ...prev,
                    [selectedFriendId]: response.data,
                }));
            }
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error) {
            console.error('Failed to send message:', error);
            setUploading(false);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!activeSubgridId) return;
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

        try {
            await communityDelete(`/subgrids/${activeSubgridId}/direct-messages/${messageId}`);
            setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
        } catch (error) {
            console.error('Failed to delete message:', error);
        }
    };

    const handleAddFriend = async (recipientId: string) => {
        if (!activeSubgridId || !recipientId) return;
        try {
            setAddingFriendId(recipientId);
            await communityPost(`/subgrids/${activeSubgridId}/friend-requests`, { recipientId });
            await refreshFriends(activeSubgridId);
            setSelectedFriendId(recipientId);
        } catch (error: any) {
            console.error('Failed to add friend:', error);
            Alert.alert('Error', error?.message || 'Failed to add friend');
        } finally {
            setAddingFriendId(null);
        }
    };

    const handleRemoveFriend = async () => {
        if (!activeSubgridId || !selectedFriendId) return;
        try {
            await communityDelete(`/subgrids/${activeSubgridId}/friends/${selectedFriendId}`);
            setFriends((prev) => (prev || []).filter((id) => id !== selectedFriendId));
            setSelectedFriendId(null);
        } catch (error) {
            console.error('Failed to remove friend:', error);
        }
    };

    const handleBlockFriend = async () => {
        if (!activeSubgridId || !selectedFriendId) return;
        try {
            await communityPost(`/subgrids/${activeSubgridId}/friends/${selectedFriendId}/block`, {});
            setFriends((prev) => (prev || []).filter((id) => id !== selectedFriendId));
            setSelectedFriendId(null);
        } catch (error) {
            console.error('Failed to block friend:', error);
        }
    };

    // Call handlers - using inline CallModal like member dashboard (NOT navigating to voice-channel)
    const handleStartCall = async (type: 'audio' | 'video') => {
        if (!selectedFriendId) {
            Alert.alert('Error', 'Please select a friend to call');
            return;
        }

        const callStartedAt = Date.now();
        const friendName = getFriendName(selectedFriendId);

        console.log('[DirectMessages] Starting inline call to:', selectedFriendId, 'type:', type);

        // Use agoraCall.startCall which handles everything inline (no navigation)
        // Pass undefined instead of empty string for subgridId to avoid MongoDB validation error
        const result = await agoraCall.startCall(selectedFriendId, type, activeSubgridId || undefined);

        // Set active call in context after we have the callId from backend
        if (result?.callId) {
            startActiveCall({
                callId: result.callId,
                peerId: selectedFriendId,
                peerName: friendName,
                callType: type,
                startedAt: callStartedAt,
            });
        }
    };

    // Handle ending a call - cleanup Agora and notify backend
    const handleHangup = useCallback(async () => {
        // First hangup the Agora call (leave channel, cleanup tracks)
        await agoraCall.hangup();
        // Then end the call in context (API call + redirect)
        await contextEndCall();
    }, [agoraCall, contextEndCall]);

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
        setNewMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

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

                    // Upload to server
                    try {
                        const blobUrl = URL.createObjectURL(blob);
                        const result = await uploadFile(
                            { uri: blobUrl, name: `voice_${Date.now()}.webm`, type: blob.type || 'audio/webm' },
                            { type: 'voice-note', subgridId: activeSubgridId || '' }
                        );
                        URL.revokeObjectURL(blobUrl);

                        if (result?.success && result?.data && activeSubgridId && selectedFriendId) {
                            const response = await communityPost(`/subgrids/${activeSubgridId}/direct-messages`, {
                                recipientId: selectedFriendId,
                                body: '',
                                kind: 'audio',
                                attachments: [{
                                    type: 'audio',
                                    value: result.data.url || result.data.secure_url,
                                    label: 'Voice note',
                                    mimeType: blob.type || 'audio/webm',
                                    durationMs,
                                }],
                            });
                            // Add sent message optimistically (WebSocket will also deliver it)
                            if (response?.data) {
                                setMessages((prev) => {
                                    if (prev.some((m) => m._id === response.data._id)) {
                                        return prev;
                                    }
                                    return [...prev, response.data];
                                });
                            }
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

        // Native recording using expo-av
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                console.error('Microphone permission denied');
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

        // Native recording
        if (expoRecordingRef.current) {
            try {
                await expoRecordingRef.current.stopAndUnloadAsync();
                const uri = expoRecordingRef.current.getURI();
                const durationMs = Date.now() - recordingStartRef.current;

                if (uri && activeSubgridId && selectedFriendId) {
                    // Upload the voice note
                    const result = await uploadFile(
                        { uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' },
                        { type: 'voice-note', subgridId: activeSubgridId }
                    );

                    if (result?.success && result?.data) {
                        const response = await communityPost(`/subgrids/${activeSubgridId}/direct-messages`, {
                            recipientId: selectedFriendId,
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
                        // Add sent message optimistically (WebSocket will also deliver it)
                        if (response?.data) {
                            setMessages((prev) => {
                                if (prev.some((m) => m._id === response.data._id)) {
                                    return prev;
                                }
                                return [...prev, response.data];
                            });
                        }
                    }
                }
            } catch (err: any) {
                console.error('Failed to save recording:', err.message);
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
            if (activeAudioStreamRef.current) {
                activeAudioStreamRef.current.getTracks().forEach((track: any) => track.stop());
                activeAudioStreamRef.current = null;
            }
            mediaRecorderRef.current = null;
            return;
        }

        // Native recording
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

    // Group messages by date
    const groupMessagesByDate = (msgs: DirectMessage[]) => {
        const groups: { date: string; messages: DirectMessage[] }[] = [];
        let currentDate = '';
        const sorted = [...msgs].sort((a, b) => {
            return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        });

        sorted.forEach((msg) => {
            const msgDate = formatDate(msg.createdAt);
            if (msgDate !== currentDate) {
                currentDate = msgDate;
                groups.push({ date: msgDate, messages: [msg] });
            } else if (groups.length > 0) {
                groups[groups.length - 1].messages.push(msg);
            }
        });

        return groups;
    };

    const selectedFriendUser = selectedFriendId ? friendUsers[selectedFriendId] : null;
    const selectedFriendName = selectedFriendId ? getFriendName(selectedFriendId) : '';
    const selectedFriendUsername = selectedFriendId ? getFriendUsername(selectedFriendId) : '';
    const selectedFriendMember = selectedFriendId ? memberMap[selectedFriendId] : null;
    const selectedFriendAbout = formatMemberRole(selectedFriendMember?.role);
    const selectedFriendSince =
        selectedFriendMember?.createdAt ||
        selectedFriendMember?.user?.createdAt ||
        selectedFriendUser?.createdAt ||
        '';
    const messageGroups = groupMessagesByDate(messages);
    const currentUserName = currentUserInfo
        ? [currentUserInfo.firstName, currentUserInfo.lastName].filter(Boolean).join(' ').trim() || currentUserInfo.email || 'User'
        : 'User';

    const addFriendCandidates = useMemo(() => {
        const friendSet = new Set(friends);
        const query = addFriendSearch.trim().toLowerCase();
        return members
            .map((member) => {
                const id = getMemberId(member);
                return {
                    member,
                    id,
                    name: getMemberName(member),
                    meta: getMemberMeta(member),
                };
            })
            .filter((item) => {
                if (!item.id || String(item.id) === String(currentUserId)) return false;
                if (friendSet.has(item.id)) return false;
                if (!query) return true;
                return `${item.name} ${item.meta}`.toLowerCase().includes(query);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [members, friends, currentUserId, addFriendSearch]);

    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.container}>
            {/* Top Navigation */}
            <View style={[styles.topNav, isMobile && styles.topNavMobile]}>
                {!isMobile && (
                    <View style={styles.logo}>
                        <Text style={styles.logoIcon}>#</Text>
                        <Text style={styles.logoText}>The Gryd</Text>
                    </View>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.navTabs, isMobile && styles.navTabsMobile]}>
                    <TouchableOpacity style={styles.navTab} onPress={() => router.push('/admin')}>
                        <Text style={styles.navTabText}>Server</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.navTab, styles.navTabActive]}>
                        <Text style={[styles.navTabText, styles.navTabTextActive]}>Messages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navTab} onPress={() => router.push('/admin/contributors')}>
                        <Text style={styles.navTabText}>Top Contributors</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

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

                {/* Friends Sidebar - full width on mobile, hidden when viewing content */}
                {(!isMobile || !mobileShowContent) && (
                <View style={[styles.friendsSidebar, isMobile && styles.friendsSidebarMobile]}>
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
                                    <Text style={styles.mobileServerSubtitle}>Direct Messages</Text>
                                </View>
                            </View>
                        </View>
                    )}
                    {/* Sidebar Header */}
                    <View style={styles.sidebarHeader}>
                        <View style={styles.sidebarHeaderLeft}>
                            <Text style={styles.sidebarTitle}>Direct message</Text>
                        </View>
                        <TouchableOpacity style={styles.sidebarHeaderIcon} onPress={() => setAddFriendOpen(true)}>
                            <Plus size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Friends List - Sorted by most recent message (WhatsApp-like) */}
                    <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
                        {(sortedFriends || []).length === 0 ? (
                            <View style={styles.emptyFriendsList}>
                                <UserPlus size={40} color={colors.textSubtle} />
                                <Text style={styles.emptyFriendsTitle}>No friends yet</Text>
                                <Text style={styles.emptyFriendsText}>Tap the + button above to add friends and start messaging</Text>
                            </View>
                        ) : (
                            (sortedFriends || []).map((friendId, index) => {
                                const isActive = selectedFriendId === friendId;
                                const name = getFriendName(friendId);
                                const friendBadge = getFriendBadge(friendId);
                                const lastMsg = lastMessages[friendId];
                                const lastMsgPreview = lastMsg?.body
                                    ? truncateMessage(lastMsg.body)
                                    : lastMsg?.attachments?.length
                                        ? '📎 Attachment'
                                        : lastMsg?.callType
                                            ? `📞 ${lastMsg.callType === 'video' ? 'Video' : 'Voice'} call`
                                            : '';
                                const lastMsgTime = formatLastMessageTime(lastMsg?.createdAt);
                                const isSentByMe = lastMsg?.senderId === currentUserId;
                                return (
                                    <TouchableOpacity
                                        key={friendId}
                                        style={[styles.friendItem, isActive && styles.friendItemActive]}
                                        onPress={() => { setSelectedFriendId(friendId); if (isMobile) setMobileShowContent(true); }}
                                    >
                                        <UserAvatar
                                            uri={getAvatarUrl(friendId)}
                                            name={getFriendName(friendId)}
                                            style={styles.friendAvatar}
                                        />
                                        <View style={styles.friendInfo}>
                                            <View style={styles.friendNameRow}>
                                                <View style={styles.friendNameWithBadge}>
                                                    <Text style={[styles.friendName, isActive && styles.friendNameActive]} numberOfLines={1}>{name}</Text>
                                                    {friendBadge && (
                                                        <View style={[styles.friendBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[friendBadge] }]}>
                                                            <Text style={styles.friendBadgeText}>
                                                                {friendBadge.charAt(0).toUpperCase() + friendBadge.slice(1)}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                {lastMsgTime ? (
                                                    <Text style={styles.friendLastMsgTime}>{lastMsgTime}</Text>
                                                ) : null}
                                            </View>
                                            {lastMsgPreview ? (
                                                <Text style={styles.friendLastMsgPreview} numberOfLines={1}>
                                                    {isSentByMe ? 'You: ' : ''}{lastMsgPreview}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>

                    {/* User Profile */}
                    <View style={styles.userProfile}>
                        <View style={styles.userAvatarContainer}>
                            <UserAvatar
                                uri={getAvatarUrl(currentUserId)}
                                name={currentUserName}
                                style={styles.userAvatar}
                            />
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

                {/* Chat Area - full width on mobile, shown when viewing content */}
                {(!isMobile || mobileShowContent) && (
                <View style={[styles.chatArea, isMobile && styles.chatAreaMobile]}>
                    {selectedFriendId ? (
                        <>
                            {/* Chat Header */}
                            <View style={styles.chatHeader}>
                                <View style={styles.chatHeaderLeft}>
                                    {isMobile && (
                                        <TouchableOpacity onPress={() => setMobileShowContent(false)} style={styles.mobileBackButton}>
                                            <ArrowLeft size={20} color={colors.text} />
                                        </TouchableOpacity>
                                    )}
                                    <UserAvatar
                                        uri={getAvatarUrl(selectedFriendId)}
                                        name={selectedFriendName}
                                        style={styles.chatHeaderAvatar}
                                    />
                                    <Text style={styles.chatHeaderName}>{selectedFriendName}</Text>
                                    {selectedFriendId && getFriendBadge(selectedFriendId) && (
                                        <View style={[styles.chatHeaderBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getFriendBadge(selectedFriendId)!] }]}>
                                            <Text style={styles.chatHeaderBadgeText}>
                                                {getFriendBadge(selectedFriendId)!.charAt(0).toUpperCase() + getFriendBadge(selectedFriendId)!.slice(1)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.chatHeaderIcons}>
                                    <TouchableOpacity style={styles.headerIcon} onPress={() => handleStartCall('audio')}>
                                        <Phone size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.headerIcon} onPress={() => handleStartCall('video')}>
                                        <Video size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.headerIcon}>
                                        <Pin size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Chat Content */}
                            <ScrollView style={styles.chatContent} ref={scrollViewRef}>
                                {/* Profile Banner */}
                                <View style={styles.profileBanner}>
                                    <View style={styles.profileAvatarLarge}>
                                        <UserAvatar
                                            uri={getAvatarUrl(selectedFriendId)}
                                            name={selectedFriendName}
                                            style={styles.profileAvatarImage}
                                        />
                                    </View>
                                    <View style={styles.profileNameRow}>
                                        <Text style={styles.profileName}>{selectedFriendName}</Text>
                                        {selectedFriendId && getFriendBadge(selectedFriendId) && (
                                            <View style={[styles.profileBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[getFriendBadge(selectedFriendId)!] }]}>
                                                <Text style={styles.profileBadgeText}>
                                                    {getFriendBadge(selectedFriendId)!.charAt(0).toUpperCase() + getFriendBadge(selectedFriendId)!.slice(1)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.profileUsername}>{selectedFriendUsername}</Text>
                                    <Text style={styles.introText}>
                                        This is the beginning of your direct message with{' '}
                                        <Text style={styles.introTextBold}>{selectedFriendName}</Text>
                                    </Text>
                                    <View style={styles.commonForums}>
                                        <Text style={styles.commonLabel}>Forum in common:</Text>
                                        <Text style={styles.commonValue}>
                                            {commonForums.length > 0 ? commonForums.join(', ') : 'None'}
                                        </Text>
                                    </View>
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity style={styles.removeButton} onPress={handleRemoveFriend}>
                                            <Text style={styles.removeButtonText}>Remove Friend</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.blockButton} onPress={handleBlockFriend}>
                                            <Text style={styles.blockButtonText}>Block</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Messages */}
                                <View style={styles.messagesContainer}>
                                    {messageGroups.map((group, groupIndex) => (
                                        <View key={groupIndex}>
                                            <View style={styles.dateDivider}>
                                                <View style={styles.dateLine} />
                                                <Text style={styles.dateText}>{group.date}</Text>
                                                <View style={styles.dateLine} />
                                            </View>
                                            {group.messages.map((msg) => {
                                                const senderName = getSenderName(msg.senderId || '');
                                                const msgSenderId = String(msg.senderId || '');
                                                const myUserId = String(currentUserId || '');
                                                const isOwnMessage = msgSenderId === myUserId;
                                                // Debug: log ID comparison to troubleshoot delete button visibility
                                                console.log('[DM] isOwnMessage check - msgId:', msg._id, 'senderId:', msgSenderId, 'currentUserId:', myUserId, 'isOwn:', isOwnMessage);
                                                const attachmentList = normalizeAttachments(msg);

                                                // Render call history entry (like WhatsApp)
                                                if (msg.callType || msg.kind === 'call') {
                                                    const isOutgoing = msg.isOutgoing || String(msg.senderId || '') === String(currentUserId || '');
                                                    const isMissed = msg.isMissed || msg.callStatus === 'missed';
                                                    const isDeclined = msg.isDeclined || msg.callStatus === 'declined';
                                                    const CallIcon = msg.callType === 'video' ? Video : Phone;
                                                    const ArrowIcon = isOutgoing ? PhoneOutgoing : PhoneIncoming;
                                                    const arrowColor = isMissed || isDeclined ? '#EF4444' : '#22C55E';

                                                    let callLabel = msg.callType === 'video' ? 'Video call' : 'Voice call';
                                                    if (isMissed) {
                                                        callLabel = isOutgoing ? 'Cancelled' : 'Missed';
                                                    } else if (isDeclined) {
                                                        callLabel = isOutgoing ? 'Not answered' : 'Declined';
                                                    }

                                                    return (
                                                        <View key={msg._id} style={styles.callHistoryItem}>
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
                                                                    {(isMissed || isDeclined) ? formatTimeOnly(msg.createdAt) : formatCallDuration(msg.callDuration)}
                                                                </Text>
                                                            </View>
                                                            <TouchableOpacity
                                                                style={styles.callHistoryAction}
                                                                onPress={() => handleStartCall(msg.callType === 'video' ? 'video' : 'audio')}
                                                            >
                                                                <CallIcon size={20} color={colors.primary} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    );
                                                }

                                                return (
                                                    <TouchableOpacity
                                                        key={msg._id}
                                                        style={[styles.messageRow, isOwnMessage && styles.messageRowSelf]}
                                                        onLongPress={() => {
                                                            if (isOwnMessage) {
                                                                handleDeleteMessage(msg._id);
                                                            }
                                                        }}
                                                        delayLongPress={500}
                                                        activeOpacity={0.8}
                                                    >
                                                        {/* Delete button BEFORE bubble for own messages (left side) */}
                                                        {isOwnMessage && (
                                                            <TouchableOpacity
                                                                style={styles.messageDeleteBtn}
                                                                onPress={() => handleDeleteMessage(msg._id)}
                                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                            >
                                                                <Trash2 size={18} color={colors.error || '#EF4444'} />
                                                            </TouchableOpacity>
                                                        )}
                                                        {!isOwnMessage && (
                                                            <UserAvatar
                                                                uri={getAvatarUrl(msg.senderId)}
                                                                name={senderName}
                                                                style={styles.messageAvatar}
                                                            />
                                                        )}
                                                        <View style={[styles.messageBubble, isOwnMessage ? styles.messageBubbleSelf : styles.messageBubbleOther]}>
                                                            {!isOwnMessage && (
                                                                <Text style={styles.messageSenderName}>{senderName}</Text>
                                                            )}
                                                            {!!msg.body && <Text style={[styles.messageText, isOwnMessage && styles.messageTextSelf]}>{msg.body}</Text>}
                                                            {attachmentList.map((attachment, idx) => {
                                                                if (attachment.type === 'audio' || attachment.type === 'voice') {
                                                                    return (
                                                                        <VoiceMessagePlayer
                                                                            key={`${msg._id}-audio-${idx}`}
                                                                            source={attachment.value}
                                                                            durationMs={attachment.durationMs}
                                                                            colors={colors}
                                                                        />
                                                                    );
                                                                }
                                                                if (attachment.type === 'image') {
                                                                    return (
                                                                        <Image
                                                                            key={`${msg._id}-img-${idx}`}
                                                                            source={{ uri: attachment.value }}
                                                                            style={styles.msgAttachmentImage}
                                                                            resizeMode="cover"
                                                                        />
                                                                    );
                                                                }
                                                                if (attachment.type === 'emoji' || attachment.type === 'sticker') {
                                                                    return (
                                                                        <Image
                                                                            key={`${msg._id}-sticker-${idx}`}
                                                                            source={{ uri: attachment.uri }}
                                                                            style={styles.msgStickerImage}
                                                                        />
                                                                    );
                                                                }
                                                                if (attachment.type === 'file') {
                                                                    return (
                                                                        <View key={`${msg._id}-file-${idx}`} style={styles.msgFileBubble}>
                                                                            <File size={20} color={colors.textMuted} />
                                                                            <Text style={styles.msgFileText} numberOfLines={1}>{attachment.label || 'File'}</Text>
                                                                        </View>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                            <Text style={[styles.messageTimeStamp, isOwnMessage && styles.messageTimeStampSelf]}>{formatTimeOnly(msg.createdAt)}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>

                            {/* Message Input */}
                            <View style={styles.inputContainer}>
                                {/* Attachment Preview */}
                                {attachments.length > 0 && (
                                    <View style={styles.attachmentPreviewContainer}>
                                        {attachments.map((attachment, index) => (
                                            <View key={index} style={styles.attachmentPreview}>
                                                {attachment.type.startsWith('image/') ? (
                                                    <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                                                ) : (
                                                    <View style={styles.attachmentFileIcon}>
                                                        <File size={24} color={colors.textMuted} />
                                                    </View>
                                                )}
                                                <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
                                                <TouchableOpacity style={styles.removeAttachmentBtn} onPress={() => handleRemoveAttachment(index)}>
                                                    <X size={14} color="#FFFFFF" />
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
                                    <View style={styles.inputRow}>
                                        <TouchableOpacity style={styles.inputAddBtn} onPress={handlePickFile}>
                                            <PlusCircle size={22} color={colors.textMuted} />
                                        </TouchableOpacity>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.input}
                                                placeholder={`Message @${selectedFriendName}`}
                                                placeholderTextColor={colors.textMuted}
                                                value={newMessage}
                                                onChangeText={setNewMessage}
                                                onSubmitEditing={handleSendMessage}
                                            />
                                            <View style={styles.inputActions}>
                                                <TouchableOpacity style={styles.inputActionBtn} onPress={handlePickFile}>
                                                    <Paperclip size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.inputActionBtn} onPress={() => setShowEmojiPicker(true)}>
                                                    <Smile size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.inputActionBtn} onPress={handleStartRecording}>
                                                    <Mic size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                {newMessage.trim() || attachments.length > 0 ? (
                                                    <TouchableOpacity style={styles.inputSendBtn} onPress={handleSendMessage}>
                                                        <Send size={18} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                ) : null}
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Select a friend to start messaging</Text>
                        </View>
                    )}
                </View>
                )}

                {/* Profile Sidebar - hidden on mobile */}
                {!isMobile && selectedFriendId && (
                    <View style={styles.profileSidebar}>
                        <View style={[styles.profileHeaderBanner, { backgroundColor: activeSubgrid?.coverImageUrl || colors.primary }]}>
                            {/* User banner image or subgrid theme color */}
                            {selectedFriendUser?.bannerUrl ? (
                                <Image
                                    source={{ uri: selectedFriendUser.bannerUrl }}
                                    style={styles.bannerImage}
                                    resizeMode="cover"
                                />
                            ) : null}
                            {/* More icon */}
                            <TouchableOpacity style={styles.moreIcon}>
                                <MoreHorizontal size={18} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.profileSidebarContent}>
                            <View style={styles.sidebarAvatarContainer}>
                                <UserAvatar
                                    uri={getAvatarUrl(selectedFriendId || undefined)}
                                    name={selectedFriendName}
                                    style={styles.sidebarAvatarImage}
                                />
                            </View>
                            <Text style={styles.sidebarName}>{selectedFriendName}</Text>
                            <Text style={styles.sidebarUsername}>{selectedFriendUsername}</Text>

                            <View style={styles.sidebarSection}>
                                <Text style={styles.sidebarSectionLabel}>About me</Text>
                                <Text style={styles.sidebarSectionValue}>{selectedFriendAbout}</Text>
                            </View>

                            <View style={styles.sidebarSection}>
                                <Text style={styles.sidebarSectionLabel}>Member since</Text>
                                <Text style={styles.sidebarSectionValue}>{selectedFriendSince ? formatDate(selectedFriendSince) : 'Unknown'}</Text>
                            </View>

                            <View style={styles.mutualSection}>
                                <Text style={styles.mutualTitle}>Mutual Friends - {(mutualFriends || []).length}</Text>
                                {(mutualFriends || []).map((friendId) => {
                                    const name = getMutualFriendName(friendId);
                                    return (
                                        <View key={friendId} style={styles.mutualItem}>
                                            <UserAvatar
                                                uri={getAvatarUrl(friendId)}
                                                name={name}
                                                style={styles.mutualAvatar}
                                            />
                                            <Text style={styles.mutualName}>{name}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {/* Add Friend Modal */}
            <Modal visible={addFriendOpen} transparent animationType="fade" onRequestClose={() => setAddFriendOpen(false)}>
                <Pressable style={styles.addFriendOverlay} onPress={() => setAddFriendOpen(false)}>
                    <Pressable style={styles.addFriendModal} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.addFriendHeader}>
                            <Text style={styles.addFriendTitle}>Add Friends</Text>
                            <TouchableOpacity style={styles.addFriendClose} onPress={() => setAddFriendOpen(false)}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.addFriendSearch}>
                            <Search size={16} color={colors.textMuted} />
                            <TextInput
                                style={styles.addFriendSearchInput}
                                placeholder="Search members..."
                                placeholderTextColor={colors.textSubtle}
                                value={addFriendSearch}
                                onChangeText={setAddFriendSearch}
                            />
                            {addFriendSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setAddFriendSearch('')}>
                                    <X size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView style={styles.addFriendList} showsVerticalScrollIndicator={false}>
                            {addFriendCandidates.length === 0 ? (
                                <Text style={styles.addFriendEmpty}>No members to add.</Text>
                            ) : (
                                addFriendCandidates.map(({ member, id, name, meta }) => {
                                    const isAdding = addingFriendId === id;
                                    return (
                                        <View key={id} style={styles.addFriendRow}>
                                            <UserAvatar
                                                uri={getAvatarUrl(id) || member.avatarUrl || member.user?.avatarUrl}
                                                name={name}
                                                style={styles.addFriendAvatar}
                                            />
                                            <View style={styles.addFriendInfo}>
                                                <Text style={styles.addFriendName}>{name}</Text>
                                                {!!meta && <Text style={styles.addFriendMeta}>{meta}</Text>}
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.addFriendAction, isAdding && styles.addFriendActionDisabled]}
                                                onPress={() => handleAddFriend(id)}
                                                disabled={isAdding}
                                            >
                                                {isAdding ? (
                                                    <Loader2 size={18} color={colors.textMuted} />
                                                ) : (
                                                    <UserPlus size={18} color={colors.text} />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Emoji Picker Modal */}
            <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
                <Pressable style={styles.emojiPickerOverlay} onPress={() => setShowEmojiPicker(false)}>
                    <Pressable style={styles.emojiPickerContainer} onPress={(e) => e.stopPropagation()}>
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
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Incoming Call Notification */}
            {incomingCall && (
                <Animated.View
                    style={[
                        styles.incomingCallOverlay,
                        {
                            opacity: incomingCallAnim,
                            transform: [
                                {
                                    translateY: incomingCallAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-100, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <View style={styles.incomingCallCard}>
                        <View style={styles.incomingCallHeader}>
                            <UserAvatar
                                uri={incomingCall.callerAvatar}
                                name={incomingCall.callerName}
                                style={styles.incomingCallAvatar}
                            />
                            <View style={styles.incomingCallInfo}>
                                <Text style={styles.incomingCallName}>{incomingCall.callerName}</Text>
                                <Text style={styles.incomingCallType}>
                                    Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
                                </Text>
                            </View>
                        </View>
                        <View style={styles.incomingCallActions}>
                            <TouchableOpacity
                                style={[styles.incomingCallButton, styles.declineButton]}
                                onPress={handleDeclineCall}
                            >
                                <PhoneOff size={24} color="#FFFFFF" />
                                <Text style={styles.incomingCallButtonText}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.incomingCallButton, styles.acceptButton]}
                                onPress={handleAcceptCall}
                            >
                                {incomingCall.callType === 'video' ? (
                                    <Video size={24} color="#FFFFFF" />
                                ) : (
                                    <Phone size={24} color="#FFFFFF" />
                                )}
                                <Text style={styles.incomingCallButtonText}>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* Call Modal - Agora-based inline calling (matching member dashboard behavior) */}
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
                error={agoraCall.error}
                peerName={selectedFriendName}
                peerAvatar={friendUsers[selectedFriendId || '']?.avatarUrl}
                selfAvatar={currentUserInfo?.avatarUrl}
                engine={agoraCall.engine}
                onAnswer={() => {}}
                onDecline={() => {}}
                onHangup={handleHangup}
                onToggleMute={agoraCall.toggleMute}
                onToggleVideo={agoraCall.toggleVideo}
                onToggleSpeaker={agoraCall.toggleSpeaker}
                onSwitchCamera={agoraCall.switchCamera}
            />
        </View>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
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
        divider: {
            width: 32,
            height: 2,
            backgroundColor: colors.border,
            marginVertical: 8,
        },
        friendsSidebar: {
            width: 240,
            backgroundColor: colors.surface,
            borderRightWidth: 1,
            borderRightColor: colors.border,
        },
        sidebarHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        sidebarHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        sidebarHeaderIcon: {
            padding: 4,
        },
        sidebarTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        addButton: {
            width: 24,
            height: 24,
            alignItems: 'center',
            justifyContent: 'center',
        },
        addButtonText: {
            fontSize: 18,
            color: colors.textMuted,
        },
        friendsList: {
            flex: 1,
            padding: 8,
        },
        friendItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 10,
            borderRadius: 10,
            marginBottom: 2,
        },
        friendItemActive: {
            backgroundColor: colors.primary + '15',
        },
        friendAvatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            marginRight: 12,
        },
        friendInfo: {
            flex: 1,
            justifyContent: 'center',
        },
        friendNameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 2,
        },
        friendName: {
            fontSize: 15,
            fontWeight: '500',
            color: colors.text,
            flexShrink: 1,
        },
        friendNameActive: {
            color: colors.primary,
            fontWeight: '600',
        },
        friendNameWithBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
        },
        friendBadge: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            flexShrink: 0,
        },
        friendBadgeText: {
            fontSize: 9,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        friendLastMsgTime: {
            fontSize: 11,
            color: colors.textMuted,
            marginLeft: 8,
        },
        friendLastMsgPreview: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 2,
        },
        // User Profile (matching Server screen)
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
        chatArea: {
            flex: 1,
            backgroundColor: colors.surface,
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
        },
        chatHeaderAvatar: {
            width: 24,
            height: 24,
            borderRadius: 12,
            marginRight: 8,
        },
        chatHeaderName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        chatHeaderBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 4,
            marginLeft: 8,
        },
        chatHeaderBadgeText: {
            fontSize: 10,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        chatHeaderIcons: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        headerIcon: {
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
        },
        headerIconText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        chatContent: {
            flex: 1,
        },
        profileBanner: {
            padding: 24,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        profileAvatarLarge: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#FBD8D3',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            overflow: 'hidden',
        },
        profileAvatarImage: {
            width: 80,
            height: 80,
            borderRadius: 40,
        },
        profileNameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
        },
        profileName: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
        },
        profileBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 6,
        },
        profileBadgeText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        profileUsername: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 16,
        },
        introText: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 12,
        },
        introTextBold: {
            fontWeight: '600',
            color: colors.text,
        },
        commonForums: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
        },
        commonLabel: {
            fontSize: 14,
            color: colors.textMuted,
            marginRight: 8,
        },
        commonValue: {
            fontSize: 14,
            color: colors.textSubtle,
        },
        actionButtons: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        removeButton: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 4,
            marginRight: 8,
        },
        removeButtonText: {
            fontSize: 14,
            color: colors.text,
        },
        blockButton: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.text,
            borderRadius: 4,
        },
        blockButtonText: {
            fontSize: 14,
            color: colors.surface,
        },
        messagesContainer: {
            padding: 16,
        },
        dateDivider: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 16,
        },
        dateLine: {
            flex: 1,
            height: 1,
            backgroundColor: colors.border,
        },
        dateText: {
            paddingHorizontal: 16,
            fontSize: 12,
            color: colors.textMuted,
        },
        messageItem: {
            flexDirection: 'row',
            marginBottom: 16,
        },
        // WhatsApp-style message row and bubble
        messageRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            marginBottom: 8,
            paddingHorizontal: 12,
        },
        messageRowSelf: {
            justifyContent: 'flex-end',
        },
        messageBubble: {
            maxWidth: '75%',
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            paddingBottom: 6,
        },
        messageBubbleSelf: {
            backgroundColor: colors.primary,
            borderBottomRightRadius: 4,
        },
        messageBubbleOther: {
            backgroundColor: colors.surfaceMuted,
            borderBottomLeftRadius: 4,
        },
        messageSenderName: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.primary,
            marginBottom: 4,
        },
        messageText: {
            fontSize: 15,
            color: colors.text,
            lineHeight: 20,
        },
        messageTextSelf: {
            color: '#FFFFFF',
        },
        messageTimeStamp: {
            fontSize: 10,
            color: colors.textMuted,
            marginTop: 4,
            alignSelf: 'flex-end',
        },
        messageTimeStampSelf: {
            color: 'rgba(255, 255, 255, 0.7)',
        },
        messageDeleteBtn: {
            marginRight: 8,
            padding: 8,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 16,
            alignSelf: 'center',
        },
        messageAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 8,
        },
        messageContent: {
            flex: 1,
        },
        messageHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
        },
        messageSender: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginRight: 8,
        },
        messageTime: {
            fontSize: 12,
            color: colors.textMuted,
        },
        messageDeleteButton: {
            marginLeft: 'auto',
            padding: 4,
        },
        messageBody: {
            fontSize: 14,
            color: colors.text,
            lineHeight: 20,
        },
        msgAudioBubble: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginTop: 8,
            alignSelf: 'flex-start',
        },
        msgAudioText: {
            fontSize: 13,
            color: colors.text,
        },
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
            backgroundColor: colors.surfaceMuted,
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
        inputContainer: {
            flexDirection: 'column',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        inputAddBtn: {
            padding: 4,
        },
        inputWrapper: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            paddingHorizontal: 12,
        },
        input: {
            flex: 1,
            paddingVertical: 10,
            fontSize: 14,
            color: colors.text,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
        inputActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        inputActionBtn: {
            padding: 6,
        },
        inputSendBtn: {
            backgroundColor: '#5865F2',
            borderRadius: 6,
            padding: 8,
            marginLeft: 4,
        },
        profileSidebar: {
            width: 280,
            backgroundColor: colors.surface,
            borderLeftWidth: 1,
            borderLeftColor: colors.border,
        },
        profileHeaderBanner: {
            height: 160,
            position: 'relative',
            overflow: 'hidden',
        },
        bannerImage: {
            width: '100%',
            height: 160,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
        },
        moreIcon: {
            position: 'absolute',
            top: 10,
            right: 10,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },
        moreIconText: {
            fontSize: 14,
            color: colors.text,
        },
        profileSidebarContent: {
            padding: 16,
            marginTop: -40,
        },
        sidebarAvatarContainer: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.surface,
            padding: 4,
            marginBottom: 12,
        },
        sidebarAvatarImage: {
            width: 72,
            height: 72,
            borderRadius: 36,
        },
        sidebarName: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 2,
        },
        sidebarUsername: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 16,
        },
        sidebarSection: {
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
        },
        sidebarSectionLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        sidebarSectionValue: {
            fontSize: 14,
            color: colors.textMuted,
        },
        mutualSection: {
            marginTop: 8,
        },
        mutualTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 12,
        },
        mutualItem: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        mutualAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 12,
        },
        mutualName: {
            fontSize: 14,
            color: colors.text,
        },
        addFriendOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        addFriendModal: {
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            maxHeight: 480,
        },
        addFriendHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        addFriendTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        addFriendClose: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        addFriendSearch: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 40,
            marginBottom: 12,
        },
        addFriendSearchInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
        },
        addFriendList: {
            maxHeight: 360,
        },
        addFriendRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
        },
        addFriendAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            marginRight: 12,
        },
        addFriendInfo: {
            flex: 1,
        },
        addFriendName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        addFriendMeta: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        addFriendAction: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        addFriendActionDisabled: {
            opacity: 0.6,
        },
        addFriendEmpty: {
            fontSize: 13,
            color: colors.textMuted,
            textAlign: 'center',
            paddingVertical: 24,
        },
        bottomBar: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        userAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 8,
        },
        userInfo: {
            flex: 1,
        },
        userName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        userStatus: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        statusDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#22C55E',
            marginRight: 4,
        },
        statusText: {
            fontSize: 12,
            color: colors.textMuted,
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
            fontSize: 10,
            color: colors.textMuted,
        },
        emptyState: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
        },
        emptyText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        // Chat input feature styles
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            width: '100%',
        },
        attachmentPreviewContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
        },
        attachmentPreview: {
            width: 80,
            height: 80,
            borderRadius: 8,
            backgroundColor: colors.surfaceMuted,
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        attachmentImage: {
            width: '100%',
            height: '100%',
            borderRadius: 8,
        },
        attachmentFileIcon: {
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
        attachmentName: {
            fontSize: 10,
            color: colors.textMuted,
            position: 'absolute',
            bottom: 4,
            left: 4,
            right: 4,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: 2,
            borderRadius: 4,
            textAlign: 'center',
        },
        removeAttachmentBtn: {
            position: 'absolute',
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        recordingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flex: 1,
        },
        recordingIndicator: {
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
        recordingText: {
            fontSize: 14,
            color: colors.text,
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
            borderRadius: 6,
            padding: 8,
        },
        // Emoji picker styles
        emojiPickerOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        emojiPickerContainer: {
            width: 320,
            maxHeight: 400,
            backgroundColor: colors.surface,
            borderRadius: 16,
            overflow: 'hidden',
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
            padding: 12,
        },
        emojiGridInner: {
            flexDirection: 'row',
            flexWrap: 'wrap',
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
        // Incoming call notification styles
        incomingCallOverlay: {
            position: 'absolute',
            top: 80,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 1000,
            paddingHorizontal: 20,
        },
        incomingCallCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            width: '100%',
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            borderWidth: 1,
            borderColor: colors.border,
        },
        incomingCallHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
        },
        incomingCallAvatar: {
            width: 56,
            height: 56,
            borderRadius: 28,
        },
        incomingCallInfo: {
            marginLeft: 16,
            flex: 1,
        },
        incomingCallName: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        incomingCallType: {
            fontSize: 14,
            color: colors.textMuted,
        },
        incomingCallActions: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 24,
        },
        incomingCallButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 30,
            gap: 8,
            minWidth: 120,
        },
        declineButton: {
            backgroundColor: '#EF4444',
        },
        acceptButton: {
            backgroundColor: '#22C55E',
        },
        incomingCallButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#FFFFFF',
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
        friendsSidebarMobile: {
            width: '100%',
            borderRightWidth: 0,
        },
        chatAreaMobile: {
            width: '100%',
        },
        mobileTopBar: {
            flexDirection: 'column',
            paddingHorizontal: 16,
            paddingVertical: 12,
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
        mobileBackButton: {
            marginRight: 8,
            padding: 4,
        },
        emptyFriendsList: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 40,
            paddingHorizontal: 20,
            gap: 8,
        },
        emptyFriendsTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginTop: 8,
        },
        emptyFriendsText: {
            fontSize: 13,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 18,
        },
    });
