
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Modal,
    Platform,
    Animated,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import {
    communityDelete,
    communityGet,
    communityPost,
    getAuthUser,
    getTenantId,
    getUserId,
    resolveTenantId,
    resolveUserId,
    uploadFile,
    StakeholderBadge,
} from '../../../lib/api';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useTheme } from '../../../lib/theme';
import { Attachment, EMOJI_SET, STICKER_SET, formatDuration, twemojiUrl } from '../../../lib/chatMedia';
import { getCachedUser, cacheUser, getCachedMessages, cacheMessages, addMessageToCache, getCachedSubgrids, cacheSubgrids, getCachedFriends, cacheFriends } from '../../../lib/userCache';
import { useAgoraCall } from '../../../hooks';
import { useCallContext } from '../../../contexts/CallContext';
import { CallModalDefault as CallModal } from '../../../components';
import UserAvatar from '../../../components/UserAvatar';
import VoiceMessagePlayer from '../../../components/VoiceMessagePlayer';
import { MessageBubble, MessageComposer } from '../../../components/messaging';

type Subgrid = {
    _id: string;
    name?: string;
    icon?: string;
};

type Message = {
    _id: string;
    senderId?: string;
    body?: string;
    kind?: string;
    attachments?: Array<Attachment | string>;
    createdAt?: string;
    callType?: 'video' | 'voice';
    callDuration?: number;
    callStatus?: 'ended' | 'missed' | 'declined';
    isOutgoing?: boolean;
    isMissed?: boolean;
    isDeclined?: boolean;
};

type UserProfile = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
    stakeholderBadge?: StakeholderBadge;
    company?: string;
};

type Channel = {
    _id: string;
    name?: string;
    type?: string;
    visibility?: string;
    status?: string;
};

type Member = {
    _id?: string;
    userId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
    userRole?: string;
    stakeholderBadge?: StakeholderBadge;
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        createdAt?: string;
        role?: string;
        stakeholderBadge?: StakeholderBadge;
    };
};

const STAKEHOLDER_BADGE_COLORS: Record<StakeholderBadge, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};


const EMOJI_GRID = [
    ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊'],
    ['😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝'],
    ['🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒'],
    ['🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢'],
];

const normalizeParam = (value?: string | string[]) => {
    if (Array.isArray(value)) {
        return value[0] || '';
    }
    return value || '';
};

const formatFullDateTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

const formatDateOnly = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
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

const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read audio'));
        reader.readAsDataURL(blob);
    });

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

const groupMessagesByDate = (messages: Message[]) => {
    // Sort messages chronologically (oldest first, newest last) like WhatsApp
    const sortedMessages = [...messages].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
    });

    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    sortedMessages.forEach((message) => {
        const msgDate = formatDateOnly(message.createdAt);
        if (msgDate !== currentDate) {
            currentDate = msgDate;
            groups.push({ date: msgDate, messages: [message] });
        } else if (groups.length > 0) {
            groups[groups.length - 1].messages.push(message);
        }
    });
    return groups;
};

const DirectMessageChatScreen = () => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const navigation = useNavigation();

    const params = useLocalSearchParams();
    const peerId = normalizeParam(params.peerId);
    const initialSubgridId = normalizeParam(params.subgridId);
    const [currentUserId, setCurrentUserId] = useState(getUserId());
    const [tenantId, setTenantId] = useState(getTenantId());
    const [subgrids, setSubgrids] = useState<Subgrid[]>(() => {
        const tid = getTenantId();
        return tid ? (getCachedSubgrids(tid) || []) : [];
    });
    const [subgridId, setSubgridId] = useState(initialSubgridId);
    const [members, setMembers] = useState<Member[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [messages, setMessages] = useState<Message[]>(() => {
        return peerId ? (getCachedMessages(peerId) as Message[] || []) : [];
    });
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [stickerOpen, setStickerOpen] = useState(false);
    const [emojiSearch, setEmojiSearch] = useState('');
    const [recording, setRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordingError, setRecordingError] = useState('');
    const [friendName, setFriendName] = useState('');
    const [friendUsername, setFriendUsername] = useState<string | null>(null);
    const [friendAvatar, setFriendAvatar] = useState<string | undefined>(undefined);
    const [friendStakeholderBadge, setFriendStakeholderBadge] = useState<StakeholderBadge | null>(null);
    const [friendCompany, setFriendCompany] = useState<string | null>(null);
    const [currentUserAvatar, setCurrentUserAvatar] = useState<string | undefined>(undefined);
    const [isFriend, setIsFriend] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showContributors, setShowContributors] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<Array<{ uri: string; name: string; type: string }>>([]);
    const [uploading, setUploading] = useState(false);
    const mediaRecorderRef = useRef<any | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStartRef = useRef<number>(0);
    const activeStreamRef = useRef<any | null>(null);
    const recordingTimerRef = useRef<any>(null);
    const expoRecordingRef = useRef<Audio.Recording | null>(null);
    const waveformAnim = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);

    // Get call context for managing calls
    const { incomingCall, clearIncomingCall, startActiveCall, markCallConnected, endCall: contextEndCall } = useCallContext();

    // Load friend profile from cache immediately (instant display)
    useEffect(() => {
        if (!peerId) return;
        const cached = getCachedUser(peerId);
        if (cached) {
            const name = [cached.firstName, cached.lastName].filter(Boolean).join(' ').trim();
            if (name || cached.email) setFriendName(name || cached.email || '');
            if (cached.username) setFriendUsername(cached.username);
            if (cached.avatarUrl) setFriendAvatar(cached.avatarUrl);
            if (cached.company) setFriendCompany(cached.company);
            if (cached.stakeholderBadge) setFriendStakeholderBadge(cached.stakeholderBadge as StakeholderBadge);
        }
    }, [peerId]);

    // Get answerCall params from URL (when navigating from incoming call overlay)
    const answerCallId = normalizeParam(params.answerCall);
    const answerCallType = normalizeParam(params.callType) as 'audio' | 'video' | '';
    // Track if we've already processed this answer to prevent duplicate calls
    const answerProcessedRef = useRef<string | null>(null);

    // Agora call hook - memoize callbacks to prevent unnecessary re-renders
    const onCallEnded = useCallback((callId: string, reason: string) => {
        // Call ended - messages stay as they are, no refresh needed
    }, []);

    const onCallError = useCallback((err: Error) => {
        Alert.alert('Call Error', err.message);
    }, []);

    // Memoize options to prevent useAgoraCall from recreating functions unnecessarily
    const agoraCallOptions = useMemo(() => ({
        onCallEnded,
        onError: onCallError,
    }), [onCallEnded, onCallError]);

    const agoraCall = useAgoraCall(agoraCallOptions);

    // Handle answering call when navigated with answerCall param
    // Note: We use agoraCall.answer in the dependency array, not the entire agoraCall object,
    // to prevent unnecessary re-runs when callState changes
    useEffect(() => {
        if (!answerCallId || !answerCallType) return;
        if (answerProcessedRef.current === answerCallId) return;

        // Mark as processed immediately to prevent duplicate calls
        answerProcessedRef.current = answerCallId;

        // Answer the call (async operation)
        // We do NOT navigate away - the call modal will show based on agoraCall.callState
        agoraCall.answer(answerCallId, answerCallType).catch((err) => {
            console.error('[DM] Failed to answer call:', err);
        });

        // Clear any lingering incoming call state
        clearIncomingCall();
    }, [answerCallId, answerCallType, agoraCall.answer, clearIncomingCall]);

    // Check if call modal should be visible
    const isCallModalVisible = agoraCall.callState !== 'idle';

    // Update CallContext when Agora call becomes connected
    // This prevents stale call_missed/call_declined events from closing the call modal
    useEffect(() => {
        if (agoraCall.callState === 'connected' && agoraCall.currentCall?.callId) {
            markCallConnected();
        }
    }, [agoraCall.callState, agoraCall.currentCall?.callId, markCallConnected]);

    useEffect(() => {
        let isActive = true;
        resolveTenantId().then((id) => { if (isActive) setTenantId(id || ''); }).catch(() => {});
        resolveUserId().then((id) => { if (isActive) setCurrentUserId(id || ''); }).catch(() => {});
        getAuthUser()
            .then((user) => {
                if (isActive && user?.avatarUrl) {
                    setCurrentUserAvatar(user.avatarUrl);
                }
            })
            .catch(() => {});
        return () => { isActive = false; };
    }, []);

    useEffect(() => {
        const loadSubgrids = async () => {
            if (!tenantId) return;

            // Use cached subgrids first for instant display
            const cached = getCachedSubgrids(tenantId);
            if (cached && cached.length > 0 && !subgridId) {
                setSubgrids(cached);
                setSubgridId(cached[0]._id);
            }

            // Skip API call if we already have subgridId set
            if (subgridId) return;

            try {
                const response = await communityGet(`/tenants/${tenantId}/subgrids`);
                const list = response?.data || [];
                setSubgrids(list);
                cacheSubgrids(tenantId, list);
                if (!subgridId && list.length > 0) setSubgridId(list[0]._id);
            } catch (err: any) {
                // Keep cached data on error
                if (!cached || cached.length === 0) {
                    setError(err.message || 'Failed to load subgrids.');
                }
            }
        };
        loadSubgrids();
    }, [tenantId, subgridId]);

    const refreshRelationship = async (activeSubgridId: string) => {
        if (!peerId) return;
        try {
            const [friendsRes, blocksRes] = await Promise.allSettled([
                communityGet(`/subgrids/${activeSubgridId}/friends`),
                communityGet(`/subgrids/${activeSubgridId}/blocks`),
            ]);
            if (friendsRes.status === 'fulfilled') {
                const friendIds = friendsRes.value?.data?.friends || [];
                const users = friendsRes.value?.data?.users || {};
                setIsFriend(friendIds.includes(peerId));
                const user = users[peerId] as UserProfile | undefined;
                if (user) {
                    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
                    setFriendName(name || user.email || '');
                    setFriendUsername(user.username || null);
                    setFriendAvatar(user.avatarUrl || undefined);
                    setFriendCompany(user.company || null);
                    // Set stakeholder badge if user is a stakeholder
                    if (user.role === 'stakeholder' && user.stakeholderBadge) {
                        setFriendStakeholderBadge(user.stakeholderBadge);
                    } else {
                        setFriendStakeholderBadge(null);
                    }
                    // Cache for instant loading next time
                    cacheUser({
                        id: peerId,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        username: user.username,
                        avatarUrl: user.avatarUrl,
                        role: user.role,
                        stakeholderBadge: user.stakeholderBadge,
                        company: user.company,
                    });
                }
                // If user not found, keep any cached data that was already loaded
            }
            if (blocksRes.status === 'fulfilled') {
                const blocked = blocksRes.value?.data?.blocked || [];
                setIsBlocked(blocked.includes(peerId));
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load friend status.');
        }
    };

    useEffect(() => { if (subgridId) refreshRelationship(subgridId); }, [subgridId, peerId]);

    useEffect(() => {
        if (!subgridId) return;
        Promise.allSettled([
            communityGet(`/subgrids/${subgridId}/members`),
            communityGet(`/subgrids/${subgridId}/channels`),
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
    }, [subgridId]);

    useEffect(() => {
        const loadMessages = async () => {
            if (!subgridId || !peerId) return;
            setError('');

            // Load from cache first for instant display
            const cached = getCachedMessages(peerId);
            if (cached && cached.length > 0) {
                setMessages(cached as Message[]);
            }

            // Then fetch fresh data in background
            try {
                const response = await communityGet(`/subgrids/${subgridId}/direct-messages?peerId=${peerId}`);
                const msgs = response?.data || [];
                setMessages(msgs);
                // Update cache with fresh data
                cacheMessages(peerId, msgs);
            } catch (err: any) {
                // Keep cached messages on error, only clear if no cache
                if (!cached || cached.length === 0) {
                    setMessages([]);
                }
                setError(err.message || 'Failed to load direct messages.');
            }
        };
        loadMessages();
    }, [subgridId, peerId]);

    const handleSend = async () => {
        if ((!draft.trim() && pendingAttachments.length === 0) || !subgridId || !peerId) return;
        const body = draft.trim();
        setDraft('');

        try {
            // Upload attachments first if any
            const uploadedAttachments: Attachment[] = [];
            if (pendingAttachments.length > 0) {
                setUploading(true);
                for (const file of pendingAttachments) {
                    try {
                        const result = await uploadFile(file, { type: 'attachment', subgridId });
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
                setPendingAttachments([]);
                setUploading(false);
            }

            await communityPost(`/subgrids/${subgridId}/direct-messages`, {
                recipientId: peerId,
                body,
                attachments: uploadedAttachments,
            });
            const response = await communityGet(`/subgrids/${subgridId}/direct-messages?peerId=${peerId}`);
            setMessages(response?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to send message.');
            setUploading(false);
        }
    };

    // Handle picking image from gallery
    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const image = result.assets[0];
                setPendingAttachments(prev => [...prev, {
                    uri: image.uri,
                    name: image.fileName || `image_${Date.now()}.jpg`,
                    type: image.mimeType || 'image/jpeg',
                }]);
            }
        } catch (err) {
            console.error('Error picking image:', err);
        }
    };

    // Handle picking file
    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                setPendingAttachments(prev => [...prev, {
                    uri: file.uri,
                    name: file.name || 'file',
                    type: file.mimeType || 'application/octet-stream',
                }]);
            }
        } catch (err) {
            console.error('Error picking file:', err);
        }
    };

    // Show attachment picker options
    const handleAttachPress = () => {
        if (Platform.OS === 'web') {
            // On web, directly pick image (most common use case)
            handlePickImage();
        } else {
            Alert.alert(
                'Add Attachment',
                'Choose attachment type',
                [
                    { text: 'Photo', onPress: handlePickImage },
                    { text: 'File', onPress: handlePickFile },
                    { text: 'Cancel', style: 'cancel' },
                ]
            );
        }
    };

    const handleSendAttachment = async (attachment: Attachment) => {
        if (!subgridId || !peerId) return;
        try {
            await communityPost(`/subgrids/${subgridId}/direct-messages`, {
                recipientId: peerId,
                body: '',
                kind: attachment.type,
                attachments: [attachment],
            });
            const response = await communityGet(`/subgrids/${subgridId}/direct-messages?peerId=${peerId}`);
            setMessages(response?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to send attachment.');
        }
    };

    const handleSendEmoji = (emoji: string) => {
        setDraft((prev) => prev + emoji);
        setEmojiOpen(false);
    };

    useEffect(() => {
        if (recording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(waveformAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
                    Animated.timing(waveformAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
                ])
            ).start();
        } else {
            waveformAnim.setValue(0);
        }
    }, [recording]);

    const handleStartRecording = async () => {
        if (recording) return;
        setRecordingError('');
        setRecordingTime(0);
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

                    // Upload to Cloudinary first (like native does)
                    try {
                        const blobUrl = URL.createObjectURL(blob);
                        const result = await uploadFile(
                            { uri: blobUrl, name: `voice_${Date.now()}.webm`, type: blob.type || 'audio/webm' },
                            { type: 'voice-note', subgridId: subgridId || '' }
                        );
                        URL.revokeObjectURL(blobUrl);

                        if (result?.success && result?.data) {
                            await handleSendAttachment({
                                type: 'audio',
                                value: result.data.url || result.data.secure_url,
                                label: 'Voice note',
                                mimeType: blob.type || 'audio/webm',
                                durationMs,
                            });
                        }
                    } catch (uploadErr: any) {
                        console.error('Failed to upload voice note:', uploadErr);
                        setRecordingError('Failed to upload voice note');
                    }

                    stream.getTracks().forEach((track) => track.stop());
                    activeStreamRef.current = null;
                };
                mediaRecorderRef.current = recorder;
                recorder.start();
                setRecording(true);
                recordingTimerRef.current = setInterval(() => {
                    setRecordingTime((prev) => prev + 1);
                }, 1000);
            } catch (err: any) {
                setRecordingError(err.message || 'Unable to start recording.');
            }
            return;
        }

        // Native recording using expo-av
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
            setRecording(true);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err: any) {
            setRecordingError(err.message || 'Unable to start recording.');
        }
    };

    const handleStopRecording = async () => {
        setRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

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

                if (uri && subgridId) {
                    // Upload the voice note
                    const result = await uploadFile(
                        { uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' },
                        { type: 'voice-note', subgridId }
                    );

                    if (result?.success && result?.data) {
                        await handleSendAttachment({
                            type: 'audio',
                            value: result.data.url || result.data.secure_url,
                            label: 'Voice note',
                            mimeType: 'audio/m4a',
                            durationMs,
                        });
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
        setRecording(false);
        setRecordingTime(0);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

        // Web recording
        if (Platform.OS === 'web') {
            const recorder = mediaRecorderRef.current;
            if (recorder) {
                recorder.ondataavailable = null;
                recorder.onstop = null;
                recorder.stop();
            }
            if (activeStreamRef.current) {
                activeStreamRef.current.getTracks().forEach((track: any) => track.stop());
                activeStreamRef.current = null;
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

    const handleToggleRecording = () => {
        if (recording) handleStopRecording();
        else handleStartRecording();
    };

    const handlePlayAudio = async (source?: string) => {
        if (!source) return;

        if (Platform.OS === 'web') {
            // Use browser's native Audio API for web
            // Access via globalThis to avoid conflict with expo-av's Audio import
            const BrowserAudio = (globalThis as any).Audio;
            if (BrowserAudio) {
                const audio = new BrowserAudio(source);
                audio.play().catch((err: any) => console.error('Failed to play audio:', err));
            }
        } else {
            // Use expo-av for native platforms
            try {
                const { sound } = await Audio.Sound.createAsync({ uri: source });
                await sound.playAsync();
            } catch (err) {
                console.error('Failed to play audio:', err);
            }
        }
    };

    // Start a call using Agora
    const handleStartCall = async (type: 'audio' | 'video') => {
        if (!peerId) {
            Alert.alert('Error', 'No recipient selected');
            return;
        }

        const callStartedAt = Date.now();

        // Pass undefined instead of empty string for subgridId to avoid MongoDB validation error
        const result = await agoraCall.startCall(peerId, type, subgridId || undefined);

        // Only set active call after we have the actual callId from backend
        // Use startActiveCall which also manages activeCallIds to protect against stale events
        if (result?.callId) {
            startActiveCall({
                callId: result.callId,
                peerId: peerId,
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

    const handleBlockToggle = async () => {
        if (!subgridId || !peerId) return;
        try {
            if (isBlocked) await communityDelete(`/subgrids/${subgridId}/friends/${peerId}/block`);
            else await communityPost(`/subgrids/${subgridId}/friends/${peerId}/block`, {});
        } catch (err: any) {
            setError(err.message || 'Failed to update block status.');
        } finally {
            refreshRelationship(subgridId);
        }
    };

    const handleRemoveFriend = async () => {
        if (!subgridId || !peerId) return;
        try {
            await communityDelete(`/subgrids/${subgridId}/friends/${peerId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to update friend.');
        } finally {
            refreshRelationship(subgridId);
        }
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            router.back();
        } else {
            router.push({ pathname: '/(main)/direct-messages', params: subgridId ? { subgridId } : {} });
        }
    };

    const activeSubgrid = useMemo(
        () => subgrids.find((item) => item._id === subgridId) || null,
        [subgrids, subgridId]
    );

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

    const commonForums = useMemo(() => {
        if (!peerId) return [];
        const currentRole = getMemberRole(currentUserId);
        const friendRole = getMemberRole(peerId);
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
    }, [channels, peerId, currentUserId, members]);

    const profileHandle = friendUsername ? `@${friendUsername}` : '';
    const messageGroups = groupMessagesByDate(messages);
    const showSendButton = draft.trim().length > 0 || pendingAttachments.length > 0;
    const formatRecordingTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.mainContainer}>
                {/* Main Chat Area */}
                <View style={styles.chatContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.headerAvatarWrap}>
                            <UserAvatar
                                uri={friendAvatar}
                                name={friendName}
                                style={styles.headerAvatar}
                            />
                            <View style={styles.onlineIndicator} />
                        </View>
                        <View style={styles.headerNameRow}>
                            <Text style={styles.headerName}>{friendName}</Text>
                            {friendUsername && (
                                <Text style={styles.headerUsername}>@{friendUsername}</Text>
                            )}
                            {friendCompany && (
                                <Text style={styles.headerCompany}>from {friendCompany}</Text>
                            )}
                            {friendStakeholderBadge && (
                                <View style={[styles.stakeholderBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[friendStakeholderBadge] }]}>
                                    <Text style={styles.stakeholderBadgeText}>
                                        {friendStakeholderBadge.charAt(0).toUpperCase() + friendStakeholderBadge.slice(1)}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.headerIcon} onPress={() => handleStartCall('audio')}>
                                <MaterialIcons name="phone" size={20} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerIcon} onPress={() => handleStartCall('video')}>
                                <MaterialIcons name="videocam" size={20} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerIcon}>
                                <MaterialIcons name="search" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.headerDivider} />

                    {/* Content */}
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => {
                            // Auto-scroll to bottom when content changes (new messages)
                            scrollViewRef.current?.scrollToEnd({ animated: false });
                        }}
                    >
                        {/* Profile Card */}
                        <View style={styles.profileSection}>
                            <View style={styles.profileAvatarWrap}>
                                <UserAvatar
                                    uri={friendAvatar}
                                    name={friendName}
                                    style={styles.profileAvatar}
                                />
                            </View>
                            <Text style={styles.profileName}>{friendName}</Text>
                            {profileHandle ? <Text style={styles.profileHandle}>{profileHandle}</Text> : null}
                            <Text style={styles.profileIntro}>
                                This is the beginning of your direct message with{'\n'}
                                <Text style={styles.profileIntroName}>{friendName}</Text>
                            </Text>
                            <Text style={styles.forumCommon}>
                                Forum in common:{' '}
                                <Text style={styles.forumCommonValue}>
                                    {commonForums.length > 0 ? commonForums.join(', ') : 'None'}
                                </Text>
                            </Text>
                            <View style={styles.profileActions}>
                                <TouchableOpacity style={styles.removeButton} onPress={handleRemoveFriend}>
                                    <Text style={styles.removeButtonText}>Remove Friend</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.blockButton} onPress={handleBlockToggle}>
                                    <Text style={styles.blockButtonText}>{isBlocked ? 'Unblock' : 'Block'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {!!error && <Text style={styles.errorText}>{error}</Text>}

                        {messageGroups.map((group, groupIndex) => (
                            <View key={`group-${groupIndex}`}>
                                <View style={styles.dateDivider}>
                                    <View style={styles.dateLine} />
                                    <Text style={styles.dateText}>{group.date}</Text>
                                    <View style={styles.dateLine} />
                                </View>

                                {group.messages.map((message) => {
                                    const isSelf = message.senderId === currentUserId;
                                    const attachmentList = normalizeAttachments(message);
                                    const senderName = isSelf ? 'You' : friendName;

                                    // Render call history entry (like WhatsApp)
                                    if (message.callType || message.kind === 'call') {
                                        const isOutgoing = message.isOutgoing || message.senderId === currentUserId;
                                        const isMissed = message.isMissed || message.callStatus === 'missed';
                                        const isDeclined = message.isDeclined || message.callStatus === 'declined';
                                        const callIcon = message.callType === 'video' ? 'videocam' : 'phone';
                                        const arrowIcon = isOutgoing ? 'call-made' : 'call-received';
                                        const arrowColor = isMissed || isDeclined ? '#EF4444' : '#22C55E';

                                        let callLabel = message.callType === 'video' ? 'Video call' : 'Voice call';
                                        if (isMissed) {
                                            callLabel = isOutgoing ? 'Cancelled' : 'Missed';
                                        } else if (isDeclined) {
                                            callLabel = isOutgoing ? 'Not answered' : 'Declined';
                                        }

                                        return (
                                            <View key={message._id} style={styles.callHistoryItem}>
                                                <View style={[styles.callHistoryIcon, (isMissed || isDeclined) && styles.callHistoryIconMissed]}>
                                                    <MaterialIcons name={callIcon} size={18} color={(isMissed || isDeclined) ? '#EF4444' : colors.primary} />
                                                </View>
                                                <View style={styles.callHistoryInfo}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <MaterialIcons name={arrowIcon} size={14} color={arrowColor} />
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
                                                    onPress={() => handleStartCall(message.callType === 'video' ? 'video' : 'audio')}
                                                >
                                                    <MaterialIcons name={callIcon} size={20} color={colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    }

                                    return (
                                        <View key={message._id} style={[styles.messageRow, isSelf && styles.messageRowSelf]}>
                                            {!isSelf && (
                                                <UserAvatar
                                                    uri={friendAvatar}
                                                    name={friendName}
                                                    style={styles.messageAvatar}
                                                />
                                            )}
                                            <View style={[styles.messageBubble, isSelf ? styles.messageBubbleSelf : styles.messageBubbleOther]}>
                                                {!isSelf && (
                                                    <Text style={styles.messageSender}>{senderName}</Text>
                                                )}
                                                {!!message.body && <Text style={[styles.messageText, isSelf && styles.messageTextSelf]}>{message.body}</Text>}
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
                                                    if (attachment.type === 'emoji' || attachment.type === 'sticker') {
                                                        return (
                                                            <Image
                                                                key={`${message._id}-img-${idx}`}
                                                                source={{ uri: attachment.uri }}
                                                                style={styles.attachmentImage}
                                                                resizeMode="cover"
                                                            />
                                                        );
                                                    }
                                                    if (attachment.type === 'image') {
                                                        return (
                                                            <Image
                                                                key={`${message._id}-img-${idx}`}
                                                                source={{ uri: attachment.value }}
                                                                style={styles.attachmentImage}
                                                                resizeMode="cover"
                                                            />
                                                        );
                                                    }
                                                    if (attachment.type === 'file') {
                                                        return (
                                                            <View key={`${message._id}-file-${idx}`} style={styles.fileBubble}>
                                                                <MaterialIcons name="insert-drive-file" size={20} color={colors.textMuted} />
                                                                <Text style={styles.fileText} numberOfLines={1}>{attachment.label || 'File'}</Text>
                                                            </View>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <Text style={[styles.messageTime, isSelf && styles.messageTimeSelf]}>{formatFullDateTime(message.createdAt)}</Text>
                                            </View>
                                            {isSelf && (
                                                <UserAvatar
                                                    uri={currentUserAvatar}
                                                    name="You"
                                                    style={styles.messageAvatar}
                                                />
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </ScrollView>

                    {/* Recording UI */}
                    {recording ? (
                        <View style={styles.recordingContainer}>
                            <View style={styles.recordingRow}>
                                <TouchableOpacity style={styles.recordingCopy}>
                                    <MaterialIcons name="content-copy" size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.recordingCancel} onPress={handleCancelRecording}>
                                    <MaterialIcons name="delete" size={18} color="#EF4444" />
                                </TouchableOpacity>
                                <View style={styles.recordingWaveform}>
                                    <Text style={styles.recordingTimer}>{formatRecordingTime(recordingTime)}</Text>
                                    <View style={styles.waveformBars}>
                                        {[...Array(20)].map((_, i) => (
                                            <Animated.View
                                                key={i}
                                                style={[
                                                    styles.waveformBar,
                                                    {
                                                        height: waveformAnim.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [4, 8 + Math.random() * 16],
                                                        }),
                                                    },
                                                ]}
                                            />
                                        ))}
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.recordingSend} onPress={handleStopRecording}>
                                    <MaterialIcons name="send" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.composerContainer}>
                            <View style={styles.composer}>
                                <TouchableOpacity style={styles.composerIconLeft} onPress={() => setEmojiOpen(true)}>
                                    <MaterialIcons name="emoji-emotions" size={22} color={colors.textMuted} />
                                </TouchableOpacity>
                                <TextInput
                                    value={draft}
                                    onChangeText={setDraft}
                                    placeholder="Type message"
                                    placeholderTextColor={colors.textMuted}
                                    style={styles.composerInput}
                                    onSubmitEditing={handleSend}
                                />
                                <TouchableOpacity style={styles.composerIconRight} onPress={handleAttachPress}>
                                    <MaterialIcons name="attach-file" size={22} color={colors.textMuted} />
                                </TouchableOpacity>
                                {/* Pending attachment preview */}
                                {pendingAttachments.length > 0 && (
                                    <View style={{ flexDirection: 'row', gap: 4, marginLeft: 4 }}>
                                        {pendingAttachments.map((att, idx) => (
                                            <View key={idx} style={{ position: 'relative' }}>
                                                {att.type.startsWith('image/') ? (
                                                    <Image source={{ uri: att.uri }} style={{ width: 32, height: 32, borderRadius: 4 }} />
                                                ) : (
                                                    <View style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: colors.cardBg, justifyContent: 'center', alignItems: 'center' }}>
                                                        <MaterialIcons name="insert-drive-file" size={16} color={colors.textMuted} />
                                                    </View>
                                                )}
                                                <TouchableOpacity
                                                    style={{ position: 'absolute', top: -4, right: -4, backgroundColor: colors.error, borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}
                                                    onPress={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                >
                                                    <MaterialIcons name="close" size={10} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                            {showSendButton ? (
                                <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                                    <MaterialIcons name="send" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.micButton} onPress={handleToggleRecording}>
                                    <MaterialIcons name="mic" size={22} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    {!!recordingError && <Text style={styles.recordingError}>{recordingError}</Text>}
                </View>

                {/* Right Sidebar - Top Contributors */}
                {showContributors && (
                    <View style={styles.sidebar}>
                        <View style={styles.sidebarHeader}>
                            <View style={styles.sidebarIcon}>
                                <UserAvatar
                                    uri={activeSubgrid?.icon}
                                    name={activeSubgrid?.name || 'Community'}
                                    style={styles.sidebarLogo}
                                />
                            </View>
                            <Text style={styles.sidebarTitle}>Top Contributors</Text>
                        </View>
                        <ScrollView style={styles.contributorsList}>
                            <Text style={styles.emptyText}>No contributors data available</Text>
                        </ScrollView>
                    </View>
                )}
            </View>

            {/* Emoji Picker Modal */}
            <Modal visible={emojiOpen} transparent animationType="fade" onRequestClose={() => setEmojiOpen(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEmojiOpen(false)} />
                    <View style={styles.emojiPickerCard}>
                        <View style={styles.emojiSearchRow}>
                            <MaterialIcons name="search" size={16} color={colors.textMuted} />
                            <TextInput
                                value={emojiSearch}
                                onChangeText={setEmojiSearch}
                                placeholder="Search Emoji"
                                placeholderTextColor={colors.textMuted}
                                style={styles.emojiSearchInput}
                            />
                        </View>
                        <ScrollView style={styles.emojiGrid}>
                            {EMOJI_GRID.map((row, rowIdx) => (
                                <View key={rowIdx} style={styles.emojiRow}>
                                    {row.map((emoji, emojiIdx) => (
                                        <TouchableOpacity
                                            key={emojiIdx}
                                            style={styles.emojiItem}
                                            onPress={() => handleSendEmoji(emoji)}
                                        >
                                            <Text style={styles.emojiText}>{emoji}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Call Modal - Agora-based (for active calls only, incoming calls handled by IncomingCallOverlay) */}
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
                peerName={friendName}
                peerAvatar={friendAvatar}
                selfAvatar={currentUserAvatar}
                engine={agoraCall.engine}
                onAnswer={() => {}}
                onDecline={() => {}}
                onHangup={handleHangup}
                onToggleMute={agoraCall.toggleMute}
                onToggleVideo={agoraCall.toggleVideo}
                onToggleSpeaker={agoraCall.toggleSpeaker}
                onSwitchCamera={agoraCall.switchCamera}
            />
        </SafeAreaView>
    );
};

const createStyles = (colors: ReturnType<typeof import('../../../lib/theme').useTheme>['colors']) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.appBg },
        mainContainer: { flex: 1, flexDirection: 'row' },
        chatContainer: { flex: 1, backgroundColor: colors.appBg },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
        backButton: { padding: 4 },
        headerAvatarWrap: { position: 'relative' },
        headerAvatar: { width: 36, height: 36, borderRadius: 18 },
        onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.appBg },
        headerNameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
        headerName: { fontSize: 17, fontWeight: '600', color: colors.text },
        headerUsername: { fontSize: 13, color: colors.textMuted, fontWeight: '400' },
        headerCompany: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
        stakeholderBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
        stakeholderBadgeText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
        headerIcon: { padding: 4 },
        headerDivider: { height: 1, backgroundColor: colors.border },
        content: { flex: 1 },
        contentContainer: { padding: 20, paddingBottom: 100 },
        profileSection: { alignItems: 'flex-start', marginBottom: 24 },
        profileAvatarWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F472B6', padding: 4, marginBottom: 16 },
        profileAvatar: { width: '100%', height: '100%', borderRadius: 56 },
        profileName: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
        profileHandle: { fontSize: 15, color: colors.textMuted, marginBottom: 20 },
        profileIntro: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: 12 },
        profileIntroName: { fontWeight: '700', color: colors.text },
        forumCommon: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
        forumCommonValue: { color: colors.textSubtle },
        profileActions: { flexDirection: 'row', gap: 12 },
        removeButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
        removeButtonText: { fontSize: 14, fontWeight: '500', color: colors.text },
        blockButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
        blockButtonText: { fontSize: 14, fontWeight: '500', color: colors.text },
        dateDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
        dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
        dateText: { fontSize: 13, color: colors.textMuted },
        callHistoryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.surfaceMuted, borderRadius: 12, marginBottom: 12, gap: 12 },
        callHistoryIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
        callHistoryIconMissed: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
        callHistoryInfo: { flex: 1 },
        callHistoryType: { fontSize: 14, fontWeight: '600', color: colors.text },
        callHistoryTypeMissed: { color: '#EF4444' },
        callHistoryDuration: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        callHistoryTime: { fontSize: 12, color: colors.textMuted },
        callHistoryAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
        messageRow: { flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'flex-end', paddingRight: 60 },
        messageRowSelf: { flexDirection: 'row-reverse', paddingRight: 0, paddingLeft: 60 },
        messageAvatar: { width: 32, height: 32, borderRadius: 16 },
        messageBubble: { padding: 12, borderRadius: 16, flexShrink: 1 },
        messageBubbleSelf: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
        messageBubbleOther: { backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4 },
        messageSender: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
        messageTime: { fontSize: 11, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
        messageTimeSelf: { color: 'rgba(255,255,255,0.7)' },
        messageText: { fontSize: 15, color: colors.text, lineHeight: 22 },
        messageTextSelf: { color: '#FFFFFF' },
        attachmentImage: { width: 120, height: 120, borderRadius: 12, marginTop: 8 },
        fileBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 8 },
        fileText: { fontSize: 13, color: colors.text, flex: 1 },
        audioBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'flex-start', marginTop: 8 },
        audioBubbleSelf: { backgroundColor: 'rgba(255,255,255,0.2)' },
        audioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
        audioText: { fontSize: 13, color: colors.text },
        errorText: { fontSize: 13, color: '#EF4444', marginBottom: 12 },
        loadingText: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
        recordingContainer: { padding: 16, backgroundColor: colors.appBg },
        recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        recordingCopy: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
        recordingCancel: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
        recordingWaveform: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 22, paddingHorizontal: 16, height: 44, gap: 12 },
        recordingTimer: { fontSize: 13, color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
        waveformBars: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', height: 24 },
        waveformBar: { width: 3, backgroundColor: colors.textMuted, borderRadius: 2 },
        recordingSend: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
        composerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, backgroundColor: colors.appBg },
        composer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 24, paddingHorizontal: 4, height: 52 },
        composerIconLeft: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        composerInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 8 },
        composerIconRight: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        micButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
        sendButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        recordingError: { fontSize: 12, color: '#EF4444', paddingHorizontal: 16, paddingBottom: 8 },
        sidebar: { width: 280, backgroundColor: colors.surface, borderLeftWidth: 1, borderLeftColor: colors.border },
        sidebarHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
        sidebarIcon: { width: 32, height: 32, borderRadius: 8, overflow: 'hidden' },
        sidebarLogo: { width: 32, height: 32 },
        sidebarTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
        contributorsList: { flex: 1 },
        emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 20 },
        contributorRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
        contributorAvatar: { width: 36, height: 36, borderRadius: 18 },
        contributorInfo: { flex: 1 },
        contributorName: { fontSize: 13, fontWeight: '600', color: colors.text },
        contributorHandle: { fontSize: 11, color: colors.textMuted },
        contributorCount: { fontSize: 11, color: colors.textMuted },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
        modalBackdrop: { ...StyleSheet.absoluteFillObject },
        emojiPickerCard: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: 20, padding: 16, maxHeight: 400 },
        emojiSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8, marginBottom: 12 },
        emojiSearchInput: { flex: 1, fontSize: 14, color: colors.text },
        emojiGrid: { flex: 1 },
        emojiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
        emojiItem: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
        emojiText: { fontSize: 20 },
    });

export default DirectMessageChatScreen;
