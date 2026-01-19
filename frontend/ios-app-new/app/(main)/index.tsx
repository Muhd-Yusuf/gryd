
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { communityGet, communityPost, communityDelete, getTenantId, getUserId, resolveTenantId, initiateChannelCall, uploadFile } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { Attachment, formatDuration, formatRelativeTime, formatMessageDate, twemojiUrl } from '../../lib/chatMedia';
import UserAvatar from '../../components/UserAvatar';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

type Channel = {
    _id: string;
    name?: string;
    unreadCount?: number;
    messageCount?: number;
    messagesCount?: number;
    count?: number;
    isPrivate?: boolean;
    type?: 'text' | 'video' | 'voice';
};

type Subgrid = {
    _id: string;
    name?: string;
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

type Member = {
    userId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    avatarUrl?: string;
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
    if (channel.isPrivate || name.includes('private')) return 'lock';
    if (channel.type === 'video' || name.includes('video')) return 'video';
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
            const uri = typed.uri || (typed.type === 'emoji' ? twemojiUrl(typed.value) : typed.value);
            return { ...typed, uri };
        })
        .filter(Boolean) as Array<Attachment & { uri?: string }>;
};

const TenantCommunityScreen = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { width } = useWindowDimensions();
    const isCompact = width < 1200;
    const isMobile = width < 900;
    const showCenterPanel = !isMobile;
    const showRightPanel = !isCompact;
    const userId = getUserId();
    const [tenantId, setTenantId] = useState(getTenantId());
    const [subgrids, setSubgrids] = useState<Subgrid[]>([]);
    const [activeSubgridId, setActiveSubgridId] = useState('');
    const [channels, setChannels] = useState<Channel[]>([]);
    const [activeChannelId, setActiveChannelId] = useState('');
    const [posts, setPosts] = useState<Post[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [channelDraft, setChannelDraft] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [friends, setFriends] = useState<string[]>([]);
    const [friendUsers, setFriendUsers] = useState<Record<string, UserProfile>>({});
    const [directMessagePeers, setDirectMessagePeers] = useState<string[]>([]);
    const [activeDmId, setActiveDmId] = useState('');
    const [dmMessages, setDmMessages] = useState<Message[]>([]);
    const [memberCount, setMemberCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [textChannelsOpen, setTextChannelsOpen] = useState(true);
    const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
    const [activeRail, setActiveRail] = useState('home');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    // Attachment and recording state
    const [attachments, setAttachments] = useState<Array<{ uri: string; name: string; type: string }>>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [likeLoading, setLikeLoading] = useState<string | null>(null);
    const [reshareLoading, setReshareLoading] = useState<string | null>(null);
    const recordingInterval = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<any | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStartRef = useRef<number>(0);
    const activeAudioStreamRef = useRef<any | null>(null);
    const expoRecordingRef = useRef<Audio.Recording | null>(null);
    const waveformAnim = useRef(new Animated.Value(0)).current;

    const EMOJI_GRID = [
        ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊'],
        ['😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝'],
        ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🤚', '🖐️', '✋'],
        ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💖'],
    ];

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
            setLoading(true);
            setError('');
            try {
                const response = await communityGet(`/tenants/${tenantId}/subgrids`);
                const list = response?.data || [];
                setSubgrids(list);
                if (!activeSubgridId && list.length > 0) {
                    setActiveSubgridId(list[0]._id);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load subgrids.');
            } finally {
                setLoading(false);
            }
        };

        loadSubgrids();
    }, [tenantId, activeSubgridId]);

    useEffect(() => {
        const loadSubgridData = async () => {
            if (!activeSubgridId) {
                setChannels([]);
                setPosts([]);
                setMembers([]);
                setMemberCount(0);
                return;
            }
            setLoading(true);
            setError('');
            try {
                const results = await Promise.allSettled([
                    communityGet(`/subgrids/${activeSubgridId}/channels`),
                    communityGet(`/subgrids/${activeSubgridId}/posts`),
                    communityGet(`/subgrids/${activeSubgridId}/members`),
                    communityGet(`/subgrids/${activeSubgridId}/friends`),
                ]);
                const [channelsRes, postsRes, membersRes, friendsRes] = results;
                if (channelsRes.status === 'fulfilled') {
                    setChannels(channelsRes.value?.data || []);
                } else {
                    setChannels([]);
                }
                if (postsRes.status === 'fulfilled') {
                    setPosts(postsRes.value?.data || []);
                } else {
                    setPosts([]);
                }
                if (membersRes.status === 'fulfilled') {
                    const list = membersRes.value?.data || [];
                    setMembers(list);
                    setMemberCount(list.length);
                } else {
                    setMembers([]);
                    setMemberCount(0);
                }
                if (friendsRes.status === 'fulfilled') {
                    setFriends(friendsRes.value?.data?.friends || []);
                    setFriendUsers(friendsRes.value?.data?.users || {});
                } else {
                    setFriends([]);
                    setFriendUsers({});
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load community data.');
            } finally {
                setLoading(false);
            }
        };

        loadSubgridData();
    }, [activeSubgridId]);

    useEffect(() => {
        if (!channels.length) {
            setActiveChannelId('');
            return;
        }
        if (!channels.some((channel) => channel._id === activeChannelId)) {
            setActiveChannelId(channels[0]._id);
        }
    }, [channels, activeChannelId]);

    useEffect(() => {
        const loadMessages = async () => {
            if (!activeSubgridId || !activeChannelId) {
                setMessages([]);
                return;
            }
            try {
                const response = await communityGet(
                    `/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}`
                );
                setMessages(response?.data || []);
            } catch {
                setMessages([]);
            }
        };

        loadMessages();
    }, [activeSubgridId, activeChannelId]);

    useEffect(() => {
        const peers = friends.filter((friendId) => friendId && friendId !== userId);
        setDirectMessagePeers(peers);
        if (peers.length > 0 && !peers.includes(activeDmId)) {
            setActiveDmId(peers[0]);
        }
        if (!peers.length) {
            setActiveDmId('');
        }
    }, [members, userId, activeDmId]);

    useEffect(() => {
        const loadDmMessages = async () => {
            if (!activeSubgridId || !activeDmId) {
                setDmMessages([]);
                return;
            }
            try {
                const response = await communityGet(
                    `/subgrids/${activeSubgridId}/direct-messages?peerId=${activeDmId}`
                );
                setDmMessages(response?.data || []);
            } catch {
                setDmMessages([]);
            }
        };

        loadDmMessages();
    }, [activeSubgridId, activeDmId]);

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

    // Group channels by type (text vs voice) - matching admin dashboard
    const groupedChannels = useMemo(() => {
        const textChannels: Channel[] = [];
        const voiceChannels: Channel[] = [];
        filteredChannels.forEach((channel) => {
            if (channel.type === 'voice') {
                voiceChannels.push(channel);
            } else {
                textChannels.push(channel);
            }
        });
        return { textChannels, voiceChannels };
    }, [filteredChannels]);

    // Create a lookup map for member profiles by userId
    const memberMap = useMemo(() => {
        const map: Record<string, Member> = {};
        members.forEach((member) => {
            if (member.userId) {
                map[member.userId] = member;
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

    const railItems = [
        {
            id: 'messages',
            icon: 'chat-bubble-outline' as const,
            onPress: () =>
                router.push({
                    pathname: '/(main)/direct-messages',
                    params: { subgridId: activeSubgridId },
                }),
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

            await communityPost(`/subgrids/${activeSubgridId}/messages`, {
                channelId: activeChannelId,
                body,
                attachments: uploadedAttachments,
            });
            const response = await communityGet(
                `/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}`
            );
            setMessages(response?.data || []);
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
                            await communityPost(`/subgrids/${activeSubgridId}/messages`, {
                                channelId: activeChannelId,
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
                            const response = await communityGet(
                                `/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}`
                            );
                            setMessages(response?.data || []);
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

                if (uri && activeSubgridId && activeChannelId) {
                    const result = await uploadFile(
                        { uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' },
                        { type: 'voice-note', subgridId: activeSubgridId }
                    );

                    if (result?.success && result?.data) {
                        await communityPost(`/subgrids/${activeSubgridId}/messages`, {
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
                        const response = await communityGet(
                            `/subgrids/${activeSubgridId}/messages?channelId=${activeChannelId}`
                        );
                        setMessages(response?.data || []);
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
        // Native playback using expo-av
        try {
            const { sound } = await Audio.Sound.createAsync({ uri: source });
            await sound.playAsync();
        } catch (err) {
            console.error('Failed to play audio:', err);
        }
    };

    const feedItems = useMemo(() => {
        const merged = [...messages, ...posts];
        return merged.sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
        });
    }, [messages, posts]);

    // Like handler for posts
    const handleLikePost = async (postId: string, isLiked: boolean) => {
        if (!activeSubgridId || likeLoading) return;
        setLikeLoading(postId);
        try {
            if (isLiked) {
                await communityDelete(`/subgrids/${activeSubgridId}/posts/${postId}/like`);
            } else {
                await communityPost(`/subgrids/${activeSubgridId}/posts/${postId}/like`, {});
            }
            // Update local state optimistically
            setPosts((prev) =>
                prev.map((p) =>
                    p._id === postId
                        ? {
                              ...p,
                              userLiked: !isLiked,
                              likeCount: (p.likeCount || 0) + (isLiked ? -1 : 1),
                          }
                        : p
                )
            );
        } catch (err: any) {
            setError(err.message || 'Failed to update like.');
        } finally {
            setLikeLoading(null);
        }
    };

    // Reshare handler for posts
    const handleResharePost = async (postId: string, isReshared: boolean) => {
        if (!activeSubgridId || reshareLoading) return;
        setReshareLoading(postId);
        try {
            if (isReshared) {
                await communityDelete(`/subgrids/${activeSubgridId}/posts/${postId}/reshare`);
            } else {
                await communityPost(`/subgrids/${activeSubgridId}/posts/${postId}/reshare`, {});
            }
            // Update local state optimistically
            setPosts((prev) =>
                prev.map((p) =>
                    p._id === postId
                        ? {
                              ...p,
                              userReshared: !isReshared,
                              reshareCount: (p.reshareCount || 0) + (isReshared ? -1 : 1),
                          }
                        : p
                )
            );
        } catch (err: any) {
            setError(err.message || 'Failed to update reshare.');
        } finally {
            setReshareLoading(null);
        }
    };

    // Comment handler - navigate to post detail/comments
    const handleCommentPress = (itemId: string) => {
        // Navigate to post detail or sub-channel with comment focus
        if (activeSubgridId && activeChannelId) {
            router.push({
                pathname: '/(main)/sub-channel',
                params: {
                    subgridId: activeSubgridId,
                    channelId: activeChannelId,
                    channelName: activeChannel?.name || '',
                    focusPostId: itemId,
                },
            });
        }
    };

    // Show empty state when no tenants/subgrids
    if (!loading && !tenantId && !error) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No Communities Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        You haven't joined any communities. Check your email for an invite link, or contact your admin.
                    </Text>
                    <TouchableOpacity
                        style={styles.emptyButton}
                        onPress={() => router.replace('/welcome')}
                    >
                        <Text style={styles.emptyButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (!loading && subgrids.length === 0 && tenantId && !error) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No Communities Found</Text>
                    <Text style={styles.emptySubtitle}>
                        Your organization doesn't have any communities yet. Go to the admin dashboard to create one.
                    </Text>
                    <TouchableOpacity
                        style={styles.emptyButton}
                        onPress={() => router.push('/admin')}
                    >
                        <Text style={styles.emptyButtonText}>Go to Admin Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

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
                            <TouchableOpacity style={styles.railLogo} onPress={() => router.push('/(main)')}>
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
                                        <MaterialIcons
                                            name={item.icon}
                                            size={20}
                                            color={isActive ? colors.text : colors.textMuted}
                                        />
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
                            <TouchableOpacity style={styles.exitButton}>
                                <MaterialIcons name="close" size={18} color="#FFFFFF" />
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
                            {loading && <Text style={styles.helperText}>Loading channels...</Text>}

                            <ScrollView contentContainerStyle={styles.channelList}>
                                {/* Text Channels */}
                                <View style={styles.groupBlock}>
                                    <TouchableOpacity
                                        style={styles.groupHeader}
                                        onPress={() => setTextChannelsOpen((prev) => !prev)}
                                    >
                                        <ChevronDown size={16} color={colors.textMuted} style={!textChannelsOpen && { transform: [{ rotate: '-90deg' }] }} />
                                        <Text style={styles.groupTitle}>TEXT CHANNELS</Text>
                                    </TouchableOpacity>
                                    {textChannelsOpen && groupedChannels.textChannels.length === 0 && (
                                        <Text style={styles.emptyText}>No text channels yet.</Text>
                                    )}
                                    {textChannelsOpen && groupedChannels.textChannels.map((channel) => {
                                        const count = getCount(channel);
                                        const isActive = channel._id === activeChannelId;
                                        const iconType = getChannelIcon(channel);
                                        return (
                                            <TouchableOpacity
                                                key={channel._id}
                                                style={[styles.channelRow, isActive && styles.channelRowActive]}
                                                onPress={() => handleChannelPress(channel)}
                                            >
                                                <View style={styles.channelLeft}>
                                                    {iconType === 'lock' && <Lock size={14} color={colors.textMuted} />}
                                                    {iconType === 'hash' && <Hash size={14} color={colors.textMuted} />}
                                                    <Text style={[
                                                        styles.channelText,
                                                        isActive && styles.channelTextActive,
                                                    ]}>
                                                        {channel.name || 'Untitled'}
                                                    </Text>
                                                </View>
                                                {count > 0 && (
                                                    <View style={styles.badge}>
                                                        <Text style={styles.badgeText}>{count}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Voice Channels */}
                                <View style={styles.groupBlock}>
                                    <TouchableOpacity
                                        style={styles.groupHeader}
                                        onPress={() => setVoiceChannelsOpen((prev) => !prev)}
                                    >
                                        <ChevronDown size={16} color={colors.textMuted} style={!voiceChannelsOpen && { transform: [{ rotate: '-90deg' }] }} />
                                        <Text style={styles.groupTitle}>VOICE CHANNELS</Text>
                                    </TouchableOpacity>
                                    {voiceChannelsOpen && groupedChannels.voiceChannels.length === 0 && (
                                        <Text style={styles.emptyText}>No voice channels.</Text>
                                    )}
                                    {voiceChannelsOpen && groupedChannels.voiceChannels.map((channel) => {
                                        const isActive = channel._id === activeChannelId;
                                        return (
                                            <TouchableOpacity
                                                key={channel._id}
                                                style={[styles.channelRow, isActive && styles.channelRowActive]}
                                                onPress={() => handleChannelPress(channel)}
                                            >
                                                <View style={styles.channelLeft}>
                                                    <Volume2 size={14} color={colors.textMuted} />
                                                    <Text style={[
                                                        styles.channelText,
                                                        isActive && styles.channelTextActive,
                                                    ]}>
                                                        {channel.name || 'Untitled'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        </View>
                    </View>

                    {showCenterPanel && (
                        <View style={[styles.centerPanel, isCompact && styles.panelCompact]}>
                            <View style={styles.centerHeader}>
                                <Text style={styles.centerTitle}># {activeChannel?.name || 'general'}</Text>
                                <Search size={16} color={colors.textMuted} />
                            </View>

                            <ScrollView contentContainerStyle={styles.feedList} showsVerticalScrollIndicator={false}>
                                {/* Channel Welcome Banner */}
                                {activeChannel && (
                                    <View style={styles.channelWelcome}>
                                        <View style={styles.channelWelcomeIcon}>
                                            <Hash size={32} color={colors.textMuted} />
                                        </View>
                                        <Text style={styles.channelWelcomeTitle}>Welcome to #{activeChannel.name}</Text>
                                        <Text style={styles.channelWelcomeSubtitle}>
                                            This is the start of the #{activeChannel.name} channel.
                                        </Text>
                                    </View>
                                )}
                                {feedItems.length === 0 && !activeChannel && (
                                    <Text style={styles.emptyText}>No channel updates yet.</Text>
                                )}
                                {feedItems.map((item: any) => {
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
                                                <Text style={styles.feedAuthor}>{getDisplayName(item.authorId || item.senderId)}</Text>
                                                <Text style={styles.feedMeta}>{formatTime(item.createdAt)}</Text>
                                            </View>
                                        </View>
                                        {!!item.body && (
                                            <Text style={styles.feedText} numberOfLines={4}>
                                                {item.body}
                                                {item.body.length > 200 && <Text style={styles.moreText}> More</Text>}
                                            </Text>
                                        )}
                                        {normalizeAttachments(item.attachments).length > 0 && (
                                            <View style={styles.attachmentStack}>
                                                {normalizeAttachments(item.attachments).map((attachment, idx) => {
                                                    if (attachment.type === 'audio') {
                                                        return (
                                                            <TouchableOpacity
                                                                key={`${item._id}-audio-${idx}`}
                                                                style={styles.audioBubble}
                                                                onPress={() => handlePlayAudio(attachment.value)}
                                                            >
                                                                <View style={styles.audioDot} />
                                                                <Text style={styles.audioText}>
                                                                    Voice note {formatDuration(attachment.durationMs)}
                                                                </Text>
                                                            </TouchableOpacity>
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
                                                                <MaterialIcons name="insert-drive-file" size={20} color={colors.textMuted} />
                                                                <Text style={styles.fileText} numberOfLines={1}>
                                                                    {attachment.label || 'File'}
                                                                </Text>
                                                            </View>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </View>
                                        )}
                                        <View style={styles.feedReactions}>
                                            <TouchableOpacity
                                                style={styles.reactionItem}
                                                onPress={() => handleCommentPress(item._id)}
                                            >
                                                <MessageCircle size={14} color={colors.textMuted} />
                                                <Text style={styles.reactionText}>{commentCount}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.reactionItem}
                                                onPress={() => handleLikePost(item._id, item.userLiked)}
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
                                                onPress={() => handleResharePost(item._id, item.userReshared)}
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
                                                    <MaterialIcons name="insert-drive-file" size={20} color={colors.textMuted} />
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={styles.attachmentRemove}
                                                onPress={() => handleRemoveAttachment(idx)}
                                            >
                                                <MaterialIcons name="close" size={12} color="#fff" />
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
                                <View style={styles.messageComposer}>
                                    <TouchableOpacity style={styles.composerIconBtn} onPress={handlePickImage}>
                                        <MaterialIcons name="add-circle" size={22} color={colors.textMuted} />
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
                                                <MaterialIcons name="attach-file" size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.composerIconBtn} onPress={() => setShowEmojiPicker(true)}>
                                                <MaterialIcons name="emoji-emotions" size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.composerIconBtn} onPress={handleStartRecording}>
                                                <MaterialIcons name="mic" size={20} color={colors.textMuted} />
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
                                onPress={() => router.push({
                                    pathname: '/(main)/direct-messages',
                                    params: { subgridId: activeSubgridId },
                                })}
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
                                            onPress={() => setActiveDmId(peerId)}
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
                                <MaterialIcons name="close" size={20} color={colors.textMuted} />
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

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        emptyTitle: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 12,
            textAlign: 'center',
        },
        emptySubtitle: {
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
            maxWidth: 320,
            marginBottom: 24,
        },
        emptyButton: {
            backgroundColor: '#3B82F6',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
        },
        emptyButtonText: {
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
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
        avatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
        },
        feedAuthor: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
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
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 8,
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
        messageComposer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
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
