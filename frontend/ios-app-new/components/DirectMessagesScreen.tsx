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
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../lib/theme';
import {
    communityGet,
    communityPost,
    communityDelete,
    getTenantId,
    getUserId,
    resolveTenantId,
    getAuthUser,
    uploadFile,
    subscribeToCallEventsAsync,
    answerCall,
    declineCall,
    initiateDMCall,
} from '../lib/api';
import { Audio } from 'expo-av';
import { Attachment, twemojiUrl, formatDuration } from '../lib/chatMedia';
import UserAvatar from './UserAvatar';

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

type Friend = {
    oderId?: string;
};

type UserProfile = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    createdAt?: string;
    avatarUrl?: string;
};

type DirectMessage = {
    _id: string;
    senderId?: string;
    recipientId?: string;
    body?: string;
    createdAt?: string;
    kind?: string;
    attachments?: Array<Attachment | string>;
};

type Member = {
    _id?: string;
    userId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
    user?: {
        _id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        createdAt?: string;
    };
};

export default function DirectMessagesScreen() {
    const { colors, mode, toggleTheme } = useTheme();
    const router = useRouter();

    const [activeSubgridId, setActiveSubgridId] = useState<string | null>(null);
    const [friends, setFriends] = useState<string[]>([]);
    const [friendUsers, setFriendUsers] = useState<Record<string, UserProfile>>({});
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUserInfo, setCurrentUserInfo] = useState<{ firstName?: string; lastName?: string; email?: string; avatarUrl?: string } | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // Call state
    const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
    const [callError, setCallError] = useState('');
    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(false);
    const activeStreamRef = useRef<any>(null);

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

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                const tenantId = await resolveTenantId();
                const userId = getUserId();
                setCurrentUserId(userId);

                // Load current user info
                const user = await getAuthUser();
                if (user) {
                    setCurrentUserInfo({
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        avatarUrl: user.avatarUrl,
                    });
                }

                if (!tenantId) {
                    console.warn('[DirectMessages] No tenant ID resolved');
                    return;
                }

                const subgridsRes = await communityGet(`/tenants/${tenantId}/subgrids`);
                const subgrids = subgridsRes?.data || [];
                if (subgrids.length > 0) {
                    setActiveSubgridId(subgrids[0]._id);
                }
            } catch (error) {
                console.error('[DirectMessages] Failed to load initial data:', error);
            }
        };
        loadData();
    }, []);

    // Load friends and members when subgrid changes
    useEffect(() => {
        if (!activeSubgridId) return;

        Promise.allSettled([
            communityGet(`/subgrids/${activeSubgridId}/friends`),
            communityGet(`/subgrids/${activeSubgridId}/members`),
        ]).then(([friendsRes, membersRes]) => {
            if (friendsRes.status === 'fulfilled') {
                const friendIds = friendsRes.value?.data?.friends || [];
                const users = friendsRes.value?.data?.users || {};
                setFriends(Array.isArray(friendIds) ? friendIds : []);
                setFriendUsers(users);
                if (friendIds.length > 0 && !selectedFriendId) {
                    setSelectedFriendId(friendIds[0]);
                }
            }
            if (membersRes.status === 'fulfilled') {
                const rawMembers = membersRes.value?.data;
                setMembers(Array.isArray(rawMembers) ? rawMembers : []);
            }
        });
    }, [activeSubgridId]);

    // Load messages when friend changes
    useEffect(() => {
        if (!activeSubgridId || !selectedFriendId) return;

        communityGet(`/subgrids/${activeSubgridId}/direct-messages?peerId=${selectedFriendId}`)
            .then((res) => {
                const msgs = res?.data || [];
                setMessages(Array.isArray(msgs) ? msgs : []);
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
            })
            .catch(() => setMessages([]));
    }, [activeSubgridId, selectedFriendId]);

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
                    // Also end any active call
                    if (callType !== null) {
                        handleEndCall();
                    }
                    break;

                case 'user_busy':
                    console.log('[DirectMessages] User busy:', data);
                    setCallError('User is busy on another call');
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
                // Navigate to voice channel
                router.push({
                    pathname: '/voice-channel',
                    params: {
                        callId: incomingCall.callId,
                        channelName: incomingCall.channelName,
                        callType: incomingCall.callType,
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

    const memberMap = useMemo(() => {
        const map: Record<string, Member> = {};
        members.forEach((member) => {
            const id = member.userId || member._id;
            if (id) {
                map[id] = member;
            }
        });
        return map;
    }, [members]);

    const getAvatarUrl = (id?: string) => {
        if (!id) return null;
        if (id === currentUserId) {
            return currentUserInfo?.avatarUrl || memberMap[id]?.avatarUrl || null;
        }
        return friendUsers[id]?.avatarUrl || memberMap[id]?.avatarUrl || null;
    };

    const getSenderName = (senderId: string) => {
        if (senderId === currentUserId) return 'You';
        const user = friendUsers[senderId];
        if (user) {
            return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Unknown User';
        }
        return selectedFriendId ? getFriendName(selectedFriendId) : 'Unknown User';
    };

    const normalizeAttachments = (message: DirectMessage) => {
        const raw = Array.isArray(message.attachments) ? message.attachments : [];
        return raw
            .map((item) => {
                if (!item) return null;
                if (typeof item === 'string') {
                    // Try to determine type from URL
                    const lowerItem = item.toLowerCase();
                    if (lowerItem.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
                        return { type: 'image' as const, value: item, uri: item };
                    }
                    return { type: 'sticker' as const, value: item, uri: item };
                }
                const typed = item as Attachment & { uri?: string };
                // Preserve the original type and set uri appropriately
                const uri = typed.uri || (typed.type === 'emoji' ? twemojiUrl(typed.value) : typed.value);
                return { ...typed, uri };
            })
            .filter(Boolean) as Array<Attachment & { uri?: string }>;
    };

    const handlePlayAudio = async (source?: string) => {
        if (!source) return;
        if (Platform.OS === 'web') {
            const audio = new (globalThis as any).Audio(source);
            audio.play();
        } else {
            try {
                const { sound } = await Audio.Sound.createAsync({ uri: source });
                await sound.playAsync();
            } catch (err) {
                console.error('Failed to play audio:', err);
            }
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatDateTime = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
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

            await communityPost(`/subgrids/${activeSubgridId}/direct-messages`, {
                recipientId: selectedFriendId,
                body,
                attachments: uploadedAttachments,
            });

            const res = await communityGet(`/subgrids/${activeSubgridId}/direct-messages?peerId=${selectedFriendId}`);
            setMessages(res?.data || []);
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

    // Call handlers
    const handleStartCall = async (type: 'audio' | 'video') => {
        if (!selectedFriendId) {
            Alert.alert('Error', 'Please select a friend to call');
            return;
        }

        setCallError('');

        try {
            // Initiate the call via API
            console.log('[DirectMessages] Initiating DM call to:', selectedFriendId, 'type:', type);
            const response = await initiateDMCall(selectedFriendId, type, activeSubgridId || undefined);

            if (!response?.success) {
                setCallError(response?.error || 'Failed to initiate call');
                Alert.alert('Call Failed', response?.error || 'Unable to start call. Please try again.');
                return;
            }

            const { callId, channelName, caller } = response.data;
            const { token, uid, appId } = caller;

            console.log('[DirectMessages] Call initiated, navigating to voice channel:', callId);

            // Navigate to voice channel for the call
            router.push({
                pathname: '/voice-channel',
                params: {
                    callId,
                    agoraChannelName: channelName,
                    token,
                    uid: String(uid),
                    appId,
                    displayName: `Call with ${getFriendName(selectedFriendId)}`,
                    callType: type,
                },
            });
        } catch (err: any) {
            console.error('[DirectMessages] Start call error:', err);
            setCallError(err.message || 'Unable to start call');
            Alert.alert('Call Failed', err.message || 'Unable to start call. Please try again.');
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
                            await communityPost(`/subgrids/${activeSubgridId}/direct-messages`, {
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
                            // Refresh messages
                            const res = await communityGet(`/subgrids/${activeSubgridId}/direct-messages?peerId=${selectedFriendId}`);
                            setMessages(res?.data || []);
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
                        await communityPost(`/subgrids/${activeSubgridId}/direct-messages`, {
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
                        // Refresh messages
                        const res = await communityGet(`/subgrids/${activeSubgridId}/direct-messages?peerId=${selectedFriendId}`);
                        setMessages(res?.data || []);
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

    const getMutualFriends = () => {
        if (!Array.isArray(friends)) return [];
        return friends.slice(1, 3);
    };

    const selectedFriendUser = selectedFriendId ? friendUsers[selectedFriendId] : null;
    const selectedFriendName = selectedFriendId ? getFriendName(selectedFriendId) : '';
    const selectedFriendUsername = selectedFriendId ? getFriendUsername(selectedFriendId) : '';
    const messageGroups = groupMessagesByDate(messages);
    const mutualFriends = getMutualFriends();
    const currentUserName = currentUserInfo
        ? [currentUserInfo.firstName, currentUserInfo.lastName].filter(Boolean).join(' ').trim() || currentUserInfo.email || 'User'
        : 'User';

    const styles = useMemo(() => createStyles(colors), [colors]);

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
                    <TouchableOpacity style={[styles.navTab, styles.navTabActive]}>
                        <Text style={[styles.navTabText, styles.navTabTextActive]}>Messages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navTab} onPress={() => router.push('/admin/contributors')}>
                        <Text style={styles.navTabText}>Top Contributors</Text>
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

                {/* Friends Sidebar */}
                <View style={styles.friendsSidebar}>
                    {/* Sidebar Header */}
                    <View style={styles.sidebarHeader}>
                        <View style={styles.sidebarHeaderLeft}>
                            <Text style={styles.sidebarTitle}>Direct message</Text>
                        </View>
                        <TouchableOpacity style={styles.sidebarHeaderIcon}>
                            <MaterialIcons name="add" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Friends List */}
                    <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
                        {(friends || []).map((friendId, index) => {
                            const isActive = selectedFriendId === friendId;
                            const name = getFriendName(friendId);
                            return (
                                <TouchableOpacity
                                    key={friendId}
                                    style={[styles.friendItem, isActive && styles.friendItemActive]}
                                    onPress={() => setSelectedFriendId(friendId)}
                                >
                                    <UserAvatar
                                        uri={getAvatarUrl(friendId)}
                                        name={getFriendName(friendId)}
                                        style={styles.friendAvatar}
                                    />
                                    <Text style={[styles.friendName, isActive && styles.friendNameActive]}>{name}</Text>
                                </TouchableOpacity>
                            );
                        })}
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

                {/* Chat Area */}
                <View style={styles.chatArea}>
                    {selectedFriendId ? (
                        <>
                            {/* Chat Header */}
                            <View style={styles.chatHeader}>
                                <View style={styles.chatHeaderLeft}>
                                    <UserAvatar
                                        uri={getAvatarUrl(selectedFriendId)}
                                        name={selectedFriendName}
                                        style={styles.chatHeaderAvatar}
                                    />
                                    <Text style={styles.chatHeaderName}>{selectedFriendName}</Text>
                                </View>
                                <View style={styles.chatHeaderIcons}>
                                    <TouchableOpacity style={styles.headerIcon} onPress={() => handleStartCall('audio')}>
                                        <MaterialIcons name="phone" size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.headerIcon} onPress={() => handleStartCall('video')}>
                                        <MaterialIcons name="videocam" size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.headerIcon}>
                                        <MaterialIcons name="push-pin" size={20} color={colors.textMuted} />
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
                                    <Text style={styles.profileName}>{selectedFriendName}</Text>
                                    <Text style={styles.profileUsername}>{selectedFriendUsername}</Text>
                                    <Text style={styles.introText}>
                                        This is the beginning of your direct message with{' '}
                                        <Text style={styles.introTextBold}>{selectedFriendName}</Text>
                                    </Text>
                                    <View style={styles.commonForums}>
                                        <Text style={styles.commonLabel}>Forum in common:</Text>
                                        <Text style={styles.commonValue}>General, Financial Tips</Text>
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
                                                const isOwnMessage = msg.senderId === currentUserId;
                                                const attachmentList = normalizeAttachments(msg);
                                                return (
                                                    <View key={msg._id} style={styles.messageItem}>
                                                        <UserAvatar
                                                            uri={getAvatarUrl(msg.senderId)}
                                                            name={senderName}
                                                            style={styles.messageAvatar}
                                                        />
                                                        <View style={styles.messageContent}>
                                                            <View style={styles.messageHeader}>
                                                                <Text style={styles.messageSender}>{senderName}</Text>
                                                                <Text style={styles.messageTime}>{formatDateTime(msg.createdAt)}</Text>
                                                                {isOwnMessage ? (
                                                                    <TouchableOpacity
                                                                        style={styles.messageDeleteButton}
                                                                        onPress={() => handleDeleteMessage(msg._id)}
                                                                    >
                                                                        <MaterialIcons name="delete-outline" size={16} color={colors.textMuted} />
                                                                    </TouchableOpacity>
                                                                ) : null}
                                                            </View>
                                                            {!!msg.body && <Text style={styles.messageBody}>{msg.body}</Text>}
                                                            {attachmentList.map((attachment, idx) => {
                                                                if (attachment.type === 'audio') {
                                                                    return (
                                                                        <TouchableOpacity
                                                                            key={`${msg._id}-audio-${idx}`}
                                                                            style={styles.msgAudioBubble}
                                                                            onPress={() => handlePlayAudio(attachment.value)}
                                                                        >
                                                                            <MaterialIcons name="play-arrow" size={20} color={colors.text} />
                                                                            <Text style={styles.msgAudioText}>
                                                                                Voice note {formatDuration(attachment.durationMs)}
                                                                            </Text>
                                                                        </TouchableOpacity>
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
                                                                            <MaterialIcons name="insert-drive-file" size={20} color={colors.textMuted} />
                                                                            <Text style={styles.msgFileText} numberOfLines={1}>{attachment.label || 'File'}</Text>
                                                                        </View>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                        </View>
                                                    </View>
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
                                                        <MaterialIcons name="insert-drive-file" size={24} color={colors.textMuted} />
                                                    </View>
                                                )}
                                                <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
                                                <TouchableOpacity style={styles.removeAttachmentBtn} onPress={() => handleRemoveAttachment(index)}>
                                                    <MaterialIcons name="close" size={14} color="#FFFFFF" />
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
                                                <MaterialIcons name="delete" size={20} color="#EF4444" />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.stopRecordingBtn} onPress={handleStopRecording}>
                                                <MaterialIcons name="send" size={18} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.inputRow}>
                                        <TouchableOpacity style={styles.inputAddBtn} onPress={handlePickFile}>
                                            <MaterialIcons name="add-circle" size={22} color={colors.textMuted} />
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
                                                    <MaterialIcons name="attach-file" size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.inputActionBtn} onPress={() => setShowEmojiPicker(true)}>
                                                    <MaterialIcons name="emoji-emotions" size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.inputActionBtn} onPress={handleStartRecording}>
                                                    <MaterialIcons name="mic" size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                {newMessage.trim() || attachments.length > 0 ? (
                                                    <TouchableOpacity style={styles.inputSendBtn} onPress={handleSendMessage}>
                                                        <MaterialIcons name="send" size={18} color="#FFFFFF" />
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

                {/* Profile Sidebar */}
                {selectedFriendId && (
                    <View style={styles.profileSidebar}>
                        <View style={styles.profileHeaderBanner}>
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
                            </View>
                            {/* More icon */}
                            <TouchableOpacity style={styles.moreIcon}>
                                <MaterialIcons name="more-horiz" size={18} color={colors.text} />
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
                                <Text style={styles.sidebarSectionValue}>Credit Union Member</Text>
                            </View>

                            <View style={styles.sidebarSection}>
                                <Text style={styles.sidebarSectionLabel}>Member since</Text>
                                <Text style={styles.sidebarSectionValue}>{selectedFriendUser?.createdAt ? formatDate(selectedFriendUser.createdAt) : 'Unknown'}</Text>
                            </View>

                            <View style={styles.mutualSection}>
                                <Text style={styles.mutualTitle}>Mutual Friends - {(mutualFriends || []).length}</Text>
                                {(mutualFriends || []).map((friendId, index) => {
                                    const name = getFriendName(friendId);
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

            {/* Emoji Picker Modal */}
            <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
                <Pressable style={styles.emojiPickerOverlay} onPress={() => setShowEmojiPicker(false)}>
                    <Pressable style={styles.emojiPickerContainer} onPress={(e) => e.stopPropagation()}>
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
                    </Pressable>
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
                            {callType === 'video' ? 'Video Call' : 'Voice Call'} with {selectedFriendId ? getFriendName(selectedFriendId) : 'Friend'}
                        </Text>
                        {!!callError && <Text style={styles.callError}>{callError}</Text>}

                        {callType === 'video' ? (
                            <View style={styles.videoCallContainer}>
                                <View style={styles.mainVideoWrap}>
                                    <UserAvatar
                                        uri={getAvatarUrl(selectedFriendId || undefined)}
                                        name={selectedFriendId ? getFriendName(selectedFriendId) : 'Friend'}
                                        style={styles.mainVideoAvatar}
                                    />
                                    <Text style={styles.videoParticipantName}>{selectedFriendId ? getFriendName(selectedFriendId) : 'Friend'}</Text>
                                </View>
                                <View style={styles.selfVideoWrap}>
                                    <UserAvatar
                                        uri={getAvatarUrl(currentUserId)}
                                        name="You"
                                        style={styles.selfVideoAvatar}
                                    />
                                    <Text style={styles.selfVideoName}>You</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.audioCallContainer}>
                                <View style={styles.callAvatarWrap}>
                                    <UserAvatar
                                        uri={getAvatarUrl(selectedFriendId || undefined)}
                                        name={selectedFriendId ? getFriendName(selectedFriendId) : 'Friend'}
                                        style={styles.callAvatar}
                                    />
                                </View>
                                <Text style={styles.callParticipantName}>{selectedFriendId ? getFriendName(selectedFriendId) : 'Friend'}</Text>
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
                                <MaterialIcons name="call-end" size={24} color="#FFFFFF" />
                                <Text style={styles.incomingCallButtonText}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.incomingCallButton, styles.acceptButton]}
                                onPress={handleAcceptCall}
                            >
                                <MaterialIcons name={incomingCall.callType === 'video' ? 'videocam' : 'call'} size={24} color="#FFFFFF" />
                                <Text style={styles.incomingCallButtonText}>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            )}
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
            padding: 8,
            borderRadius: 6,
        },
        friendItemActive: {
            backgroundColor: colors.surfaceMuted,
        },
        friendAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 12,
        },
        friendName: {
            fontSize: 14,
            color: colors.textMuted,
        },
        friendNameActive: {
            color: colors.text,
            fontWeight: '500',
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
        messageAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            marginRight: 12,
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
            height: 120,
            backgroundColor: '#F8E8E8',
            position: 'relative',
            overflow: 'hidden',
        },
        bannerShape1: {
            position: 'absolute',
            top: 10,
            left: 30,
            width: 60,
            height: 80,
            backgroundColor: '#2D4A5E',
            transform: [{ rotate: '15deg' }],
        },
        bannerShape2: {
            position: 'absolute',
            top: -20,
            left: 80,
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: '#E8B4B4',
        },
        bannerShape3: {
            position: 'absolute',
            top: 20,
            right: 60,
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#D4847C',
        },
        bannerShape4: {
            position: 'absolute',
            top: 50,
            right: 20,
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: '#FAD4D4',
        },
        bannerStripes: {
            position: 'absolute',
            bottom: 10,
            left: 10,
            width: 30,
            height: 50,
        },
        stripe: {
            width: 30,
            height: 3,
            backgroundColor: '#2D4A5E',
            marginBottom: 3,
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
        // Call Modal styles
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
    });
