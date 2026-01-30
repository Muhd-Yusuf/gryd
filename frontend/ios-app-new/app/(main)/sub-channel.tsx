
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
    Alert,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ArrowLeft, Heart, MessageCircle, Mic, MicOff, MoreHorizontal, Paperclip, Repeat2, Search, Send, Smile, Sticker, Trash2, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { communityGet, communityPost, communityDelete, getTenantId, getUserId, resolveTenantId, uploadFile, StakeholderBadge } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { Attachment, EMOJI_SET, STICKER_SET, formatDuration, formatMessageDate, twemojiUrl } from '../../lib/chatMedia';
import UserAvatar from '../../components/UserAvatar';
import VoiceMessagePlayer from '../../components/VoiceMessagePlayer';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

type Channel = {
    _id: string;
    name?: string;
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
    commentCount?: number;
    reshareCount?: number;
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
    username?: string;
    avatarUrl?: string;
    role?: string;
    userRole?: string;
    stakeholderBadge?: StakeholderBadge;
    company?: string;
};

const STAKEHOLDER_BADGE_COLORS: Record<StakeholderBadge, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};

const normalizeParam = (value?: string | string[]) => {
    if (Array.isArray(value)) {
        return value[0] || '';
    }
    return value || '';
};

const labelFromId = (value?: string) => {
    if (!value) return 'Member';
    return `Member ${String(value).slice(-6)}`;
};

const formatTime = (value?: string) => {
    return formatMessageDate(value);
};

const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read audio'));
        reader.readAsDataURL(blob);
    });

const normalizeAttachments = (attachments?: Array<Attachment | string>) => {
    const raw = Array.isArray(attachments) ? attachments : [];
    return raw
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') {
                // Detect if string is an image URL
                const lowerItem = item.toLowerCase();
                if (lowerItem.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
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

const REPORT_REASONS = ['Spam', 'Harassment', 'Hate speech', 'Scam', 'Nudity', 'Other'];

const SubChannelScreen = () => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const navigation = useNavigation();
    const params = useLocalSearchParams();
    const initialSubgridId = normalizeParam(params.subgridId);
    const initialChannelId = normalizeParam(params.channelId);
    const initialChannelName = normalizeParam(params.channelName);
    const [tenantId, setTenantId] = useState(getTenantId());
    const [subgrids, setSubgrids] = useState<Subgrid[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [subgridId, setSubgridId] = useState(initialSubgridId);
    const [channelId, setChannelId] = useState(initialChannelId);
    const [channelName, setChannelName] = useState(initialChannelName);
    const [posts, setPosts] = useState<Post[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [stickerOpen, setStickerOpen] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingError, setRecordingError] = useState('');
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const [menuItem, setMenuItem] = useState<any>(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
    const [reportNotes, setReportNotes] = useState('');
    const [reportTarget, setReportTarget] = useState<{ id: string; type: 'post' | 'message' } | null>(null);
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [attachments, setAttachments] = useState<Array<{ type: 'image' | 'file'; uri: string; name?: string; mimeType?: string }>>([]);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [likeLoading, setLikeLoading] = useState<string | null>(null);
    const [reshareLoading, setReshareLoading] = useState<string | null>(null);
    const currentUserId = getUserId();
    const mediaRecorderRef = useRef<any | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStartRef = useRef<number>(0);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const activeAudioStreamRef = useRef<any | null>(null);
    const expoRecordingRef = useRef<Audio.Recording | null>(null);
    const feedScrollRef = useRef<ScrollView>(null);

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
                setSubgrids(list);
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
        const loadChannels = async () => {
            if (!subgridId) return;
            if (channelId) return;
            try {
                const response = await communityGet(`/subgrids/${subgridId}/channels`);
                const list = response?.data || [];
                setChannels(list);
                if (!channelId && list.length > 0) {
                    setChannelId(list[0]._id);
                    setChannelName(list[0].name || 'general');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load channels.');
            }
        };

        loadChannels();
    }, [subgridId, channelId]);

    useEffect(() => {
        const loadMembers = async () => {
            if (!subgridId) return;
            try {
                const response = await communityGet(`/subgrids/${subgridId}/members`);
                setMembers(response?.data || []);
            } catch (err: any) {
                setMembers([]);
                setError(err.message || 'Failed to load members.');
            }
        };

        loadMembers();
    }, [subgridId]);

    useEffect(() => {
        const loadFeed = async () => {
            if (!subgridId || !channelId) return;
            setLoading(true);
            setError('');
            try {
                const [postsRes, messagesRes] = await Promise.allSettled([
                    communityGet(`/subgrids/${subgridId}/posts?channelId=${channelId}`),
                    communityGet(`/subgrids/${subgridId}/messages?channelId=${channelId}`),
                ]);
                if (postsRes.status === 'fulfilled') {
                    setPosts(postsRes.value?.data || []);
                } else {
                    setPosts([]);
                }
                if (messagesRes.status === 'fulfilled') {
                    setMessages(messagesRes.value?.data || []);
                } else {
                    setMessages([]);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load channel updates.');
            } finally {
                setLoading(false);
            }
        };

        loadFeed();
    }, [subgridId, channelId]);

    // Fetch user role in subgrid
    useEffect(() => {
        const fetchRole = async () => {
            if (!subgridId) return;
            try {
                const response = await communityGet(`/subgrids/${subgridId}/my-role`);
                setUserRole(response?.data?.role || null);
            } catch {
                setUserRole(null);
            }
        };
        fetchRole();
    }, [subgridId]);

    // Sort ascending (oldest first) so newest messages appear at the bottom like WhatsApp
    const feedItems = useMemo(() => {
        const merged = [...messages, ...posts];
        return merged.sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return aTime - bTime; // Ascending: oldest first, newest at bottom
        });
    }, [messages, posts]);

    // Scroll to bottom when new messages arrive (WhatsApp-style)
    useEffect(() => {
        if (feedItems.length > 0 && feedScrollRef.current) {
            setTimeout(() => {
                feedScrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [feedItems.length]);

    const openReportModal = (id: string, type: 'post' | 'message') => {
        setReportTarget({ id, type });
        setReportReason(REPORT_REASONS[0]);
        setReportNotes('');
        setReportModalOpen(true);
    };

    // Handle opening the action menu with proper position
    const handleOpenMenu = (event: any, item: any) => {
        if (menuOpen === item._id) {
            setMenuOpen(null);
            setMenuItem(null);
            return;
        }

        // Get position from event target for web
        const target = event.currentTarget || event.target;
        if (target && target.getBoundingClientRect) {
            const rect = target.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 5,
                right: window.innerWidth - rect.right,
            });
        }
        setMenuItem(item);
        setMenuOpen(item._id);
    };

    // Close action menu
    const closeMenu = () => {
        setMenuOpen(null);
        setMenuItem(null);
    };

    const submitReport = async () => {
        if (!subgridId || !reportTarget) return;
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
                    ? `/subgrids/${subgridId}/posts/${reportTarget.id}/flag`
                    : `/subgrids/${subgridId}/messages/${reportTarget.id}/flag`;
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

    const memberMap = useMemo(() => {
        const map: Record<string, Member> = {};
        members.forEach((member) => {
            if (member.userId) {
                map[member.userId] = member;
            }
        });
        return map;
    }, [members]);

    const getDisplayName = (id?: string) => {
        if (!id) return 'Member';
        const member = memberMap[id];
        if (member) {
            const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
            if (name) return name;
            if (member.email) return member.email;
        }
        if (id === currentUserId) return 'You';
        return labelFromId(id);
    };

    const getUsername = (id?: string): string | null => {
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

    const getAvatarUrl = (id?: string) => {
        if (!id) return null;
        const member = memberMap[id];
        return member?.avatarUrl || null;
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

    const canDeleteItem = (item: any) => {
        const authorId = item.authorId || item.senderId;
        const isAuthor = String(authorId) === String(currentUserId);
        const isAdminOrMod = userRole === 'subgrid_admin' || userRole === 'moderator';
        return isAuthor || isAdminOrMod;
    };

    const handleDeleteItem = async (item: any) => {
        if (!subgridId) return;
        // Messages have 'kind' field (text, emoji, sticker, audio), posts don't
        const isPost = !item.kind;
        const itemId = item._id;
        const itemType = isPost ? 'Post' : 'Message';

        const confirmDelete = Platform.OS === 'web'
            ? window.confirm(`Are you sure you want to delete this ${itemType.toLowerCase()}? This action cannot be undone.`)
            : await new Promise<boolean>((resolve) => {
                Alert.alert(
                    `Delete ${itemType}`,
                    `Are you sure you want to delete this ${itemType.toLowerCase()}? This action cannot be undone.`,
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => { setMenuOpen(null); resolve(false); } },
                        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                    ]
                );
            });

        if (!confirmDelete) {
            setMenuOpen(null);
            return;
        }

        try {
            console.log('[handleDeleteItem] Debug:', {
                itemId,
                itemType,
                currentUserId,
                itemAuthorId: item.authorId,
                itemSenderId: item.senderId,
                resolvedAuthorId: item.authorId || item.senderId,
            });
            if (isPost) {
                await communityDelete(`/subgrids/${subgridId}/posts/${itemId}`);
                setPosts((prev) => prev.filter((p) => p._id !== itemId));
            } else {
                await communityDelete(`/subgrids/${subgridId}/messages/${itemId}`);
                setMessages((prev) => prev.filter((m) => m._id !== itemId));
            }
            setMenuOpen(null);
            if (Platform.OS === 'web') {
                window.alert(`${itemType} deleted successfully.`);
            } else {
                Alert.alert('Success', `${itemType} deleted successfully.`);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to delete item.');
            if (Platform.OS === 'web') {
                window.alert(err.message || `Failed to delete ${itemType.toLowerCase()}.`);
            } else {
                Alert.alert('Error', err.message || `Failed to delete ${itemType.toLowerCase()}.`);
            }
            setMenuOpen(null);
        }
    };

    const handleSend = async () => {
        if ((!draft.trim() && attachments.length === 0) || !subgridId || !channelId) {
            return;
        }
        const body = draft.trim();
        setDraft('');
        const currentAttachments = [...attachments];
        setAttachments([]);
        try {
            // Upload attachments if any
            const uploadedAttachments: Attachment[] = [];
            for (const att of currentAttachments) {
                try {
                    const result = await uploadFile(
                        { uri: att.uri, name: att.name || 'file', type: att.mimeType || 'application/octet-stream' },
                        { type: 'attachment', subgridId }
                    );
                    if (result?.success && result?.data) {
                        uploadedAttachments.push({
                            type: att.type,
                            value: result.data.url || result.data.secure_url,
                            label: att.name,
                            mimeType: att.mimeType,
                        });
                    }
                } catch (uploadErr: any) {
                    console.error('Failed to upload attachment:', uploadErr);
                }
            }

            await communityPost(`/subgrids/${subgridId}/messages`, {
                channelId,
                body: body || '',
                attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
            });
            const response = await communityGet(`/subgrids/${subgridId}/messages?channelId=${channelId}`);
            setMessages(response?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to send message.');
        }
    };

    const handleSendAttachment = async (attachment: Attachment) => {
        if (!subgridId || !channelId) return;
        try {
            await communityPost(`/subgrids/${subgridId}/messages`, {
                channelId,
                body: '',
                kind: attachment.type,
                attachments: [attachment],
            });
            const response = await communityGet(`/subgrids/${subgridId}/messages?channelId=${channelId}`);
            setMessages(response?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to send attachment.');
        }
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartRecording = async () => {
        if (recording) return;
        setRecordingError('');
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
                    if (event.data && event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };
                recorder.onstop = async () => {
                    // Clear the interval
                    if (recordingIntervalRef.current) {
                        clearInterval(recordingIntervalRef.current);
                        recordingIntervalRef.current = null;
                    }

                    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                    const durationMs = Date.now() - recordingStartRef.current;

                    // Upload to server
                    try {
                        const blobUrl = URL.createObjectURL(blob);
                        const result = await uploadFile(
                            { uri: blobUrl, name: `voice_${Date.now()}.webm`, type: blob.type || 'audio/webm' },
                            { type: 'voice-note', subgridId: subgridId || '' }
                        );
                        URL.revokeObjectURL(blobUrl);

                        if (result?.success && result?.data && subgridId && channelId) {
                            await communityPost(`/subgrids/${subgridId}/messages`, {
                                channelId,
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
                            const response = await communityGet(`/subgrids/${subgridId}/messages?channelId=${channelId}`);
                            setMessages(response?.data || []);
                        }
                    } catch (uploadErr: any) {
                        console.error('Failed to upload voice note:', uploadErr);
                        setError('Failed to send voice note.');
                    }

                    stream.getTracks().forEach((track) => track.stop());
                    activeAudioStreamRef.current = null;
                };
                mediaRecorderRef.current = recorder;
                recorder.start();
                setRecording(true);

                // Start the timer interval
                recordingIntervalRef.current = setInterval(() => {
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
            setRecording(true);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (err: any) {
            setRecordingError(err.message || 'Unable to start recording.');
        }
    };

    const handleStopRecording = async () => {
        setRecording(false);
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
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

                if (uri && subgridId && channelId) {
                    // Upload the voice note
                    const result = await uploadFile(
                        { uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' },
                        { type: 'voice-note', subgridId }
                    );

                    if (result?.success && result?.data) {
                        await communityPost(`/subgrids/${subgridId}/messages`, {
                            channelId,
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
                        const response = await communityGet(`/subgrids/${subgridId}/messages?channelId=${channelId}`);
                        setMessages(response?.data || []);
                    }
                }
            } catch (err: any) {
                console.error('Failed to save recording:', err.message);
                setError('Failed to send voice note.');
            } finally {
                expoRecordingRef.current = null;
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            }
        }
        setRecordingDuration(0);
    };

    const handleCancelRecording = async () => {
        setRecording(false);
        setRecordingDuration(0);
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }

        // Web recording
        if (Platform.OS === 'web') {
            const recorder = mediaRecorderRef.current;
            if (recorder) {
                // Remove the onstop handler to prevent sending
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

    const handleToggleRecording = () => {
        if (recording) {
            handleStopRecording();
        } else {
            handleStartRecording();
        }
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

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: false,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setAttachments((prev) => [
                    ...prev,
                    {
                        type: 'image',
                        uri: asset.uri,
                        name: asset.fileName || 'image.jpg',
                        mimeType: asset.mimeType || 'image/jpeg',
                    },
                ]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to pick image.');
        }
    };

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setAttachments((prev) => [
                    ...prev,
                    {
                        type: 'file',
                        uri: asset.uri,
                        name: asset.name || 'file',
                        mimeType: asset.mimeType || 'application/octet-stream',
                    },
                ]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to pick file.');
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleAttachPress = () => {
        if (Platform.OS === 'web') {
            const choice = window.confirm('Click OK to pick an image, or Cancel to pick a file.');
            if (choice) {
                handlePickImage();
            } else {
                handlePickFile();
            }
        } else {
            Alert.alert('Add Attachment', 'Choose attachment type', [
                { text: 'Image', onPress: handlePickImage },
                { text: 'File', onPress: handlePickFile },
                { text: 'Cancel', style: 'cancel' },
            ]);
        }
    };

    const handleBack = () => {
        // Use navigation.canGoBack() to check if we can go back
        if (navigation.canGoBack()) {
            router.back();
        } else {
            router.push('/(main)');
        }
    };

    // Like handler for feed items (posts and messages)
    const handleLikeItem = async (itemId: string, isLiked: boolean, isPost: boolean) => {
        console.log('[SubChannel Like] handleLikeItem called:', { itemId, isLiked, isPost, subgridId, likeLoading });
        if (!subgridId) {
            console.log('[SubChannel Like] Early return: no subgridId');
            return;
        }
        if (likeLoading) {
            console.log('[SubChannel Like] Early return: likeLoading in progress');
            return;
        }
        setLikeLoading(itemId);
        const endpoint = isPost ? 'posts' : 'messages';
        try {
            if (isLiked) {
                console.log(`[SubChannel Like] Unliking ${endpoint}:`, `/subgrids/${subgridId}/${endpoint}/${itemId}/like`);
                await communityDelete(`/subgrids/${subgridId}/${endpoint}/${itemId}/like`);
            } else {
                console.log(`[SubChannel Like] Liking ${endpoint}:`, `/subgrids/${subgridId}/${endpoint}/${itemId}/like`);
                await communityPost(`/subgrids/${subgridId}/${endpoint}/${itemId}/like`, {});
            }
            console.log('[SubChannel Like] API call successful');
            // Update local state optimistically
            if (isPost) {
                setPosts((prev) =>
                    prev.map((p) =>
                        p._id === itemId
                            ? { ...p, userLiked: !isLiked, likeCount: (p.likeCount || 0) + (isLiked ? -1 : 1) }
                            : p
                    )
                );
            } else {
                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === itemId
                            ? { ...m, userLiked: !isLiked, likeCount: (m.likeCount || 0) + (isLiked ? -1 : 1) }
                            : m
                    )
                );
            }
        } catch (err: any) {
            console.error('[SubChannel Like] Error:', err.message, err);
            setError(err.message || 'Failed to update like.');
        } finally {
            setLikeLoading(null);
        }
    };

    // Reshare handler for feed items (posts and messages)
    const handleReshareItem = async (itemId: string, isReshared: boolean, isPost: boolean) => {
        console.log('[SubChannel Reshare] handleReshareItem called:', { itemId, isReshared, isPost, subgridId, reshareLoading });
        if (!subgridId) {
            console.log('[SubChannel Reshare] Early return: no subgridId');
            return;
        }
        if (reshareLoading) {
            console.log('[SubChannel Reshare] Early return: reshareLoading in progress');
            return;
        }
        setReshareLoading(itemId);
        const endpoint = isPost ? 'posts' : 'messages';
        try {
            if (isReshared) {
                console.log(`[SubChannel Reshare] Unresharing ${endpoint}:`, `/subgrids/${subgridId}/${endpoint}/${itemId}/reshare`);
                await communityDelete(`/subgrids/${subgridId}/${endpoint}/${itemId}/reshare`);
            } else {
                console.log(`[SubChannel Reshare] Resharing ${endpoint}:`, `/subgrids/${subgridId}/${endpoint}/${itemId}/reshare`);
                await communityPost(`/subgrids/${subgridId}/${endpoint}/${itemId}/reshare`, {});
            }
            console.log('[SubChannel Reshare] API call successful');
            // Update local state optimistically
            if (isPost) {
                setPosts((prev) =>
                    prev.map((p) =>
                        p._id === itemId
                            ? { ...p, userReshared: !isReshared, reshareCount: (p.reshareCount || 0) + (isReshared ? -1 : 1) }
                            : p
                    )
                );
            } else {
                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === itemId
                            ? { ...m, userReshared: !isReshared, reshareCount: (m.reshareCount || 0) + (isReshared ? -1 : 1) }
                            : m
                    )
                );
            }
        } catch (err: any) {
            console.error('[SubChannel Reshare] Error:', err.message, err);
            setError(err.message || 'Failed to update reshare.');
        } finally {
            setReshareLoading(null);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View pointerEvents="none" style={styles.gridBackground} />
            <View style={styles.page}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
                            <ArrowLeft size={18} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}># {channelName || 'general'}</Text>
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.iconButton}>
                                <Search size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {!!error && <Text style={styles.errorText}>{error}</Text>}
                    {loading && <Text style={styles.helperText}>Loading channel...</Text>}

                    <ScrollView
                        ref={feedScrollRef}
                        contentContainerStyle={styles.feedList}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => {
                            feedScrollRef.current?.scrollToEnd({ animated: false });
                        }}
                    >
                        {feedItems.length === 0 && !loading && (
                            <Text style={styles.emptyText}>No channel updates yet.</Text>
                        )}
                        {feedItems.map((item: any) => {
                            // Messages have 'kind' field (text, emoji, sticker, audio), posts don't
                            const isPost = !item.kind;
                            const likesCount = item.likeCount || 0;
                            const commentsCount = item.commentCount || 0;
                            const resharesCount = item.reshareCount || 0;
                            const userLiked = item.userLiked || false;
                            const userReshared = item.userReshared || false;
                            const showDelete = canDeleteItem(item);
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
                                                    <MaterialIcons name="verified" size={14} color="#3B82F6" />
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
                                    <View style={styles.menuContainer}>
                                        <TouchableOpacity
                                            style={styles.menuButton}
                                            onPress={(e) => handleOpenMenu(e, { ...item, isPost, showDelete })}
                                        >
                                            <MoreHorizontal size={18} color={colors.textMuted} />
                                        </TouchableOpacity>
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
                                            if (attachment.type === 'image' || attachment.type === 'emoji' || attachment.type === 'sticker') {
                                                return (
                                                    <Image
                                                        key={`${item._id}-img-${idx}`}
                                                        source={{ uri: attachment.uri || attachment.value }}
                                                        style={styles.feedImage}
                                                    />
                                                );
                                            }
                                            if (attachment.type === 'video') {
                                                return (
                                                    <View key={`${item._id}-video-${idx}`} style={styles.videoPlaceholder}>
                                                        <MaterialIcons name="play-circle-filled" size={48} color="#FFFFFF" />
                                                        <Text style={styles.videoLabel}>Video</Text>
                                                    </View>
                                                );
                                            }
                                            if (attachment.type === 'file') {
                                                return (
                                                    <View key={`${item._id}-file-${idx}`} style={styles.fileAttachment}>
                                                        <MaterialIcons name="insert-drive-file" size={20} color={colors.textMuted} />
                                                        <Text style={styles.fileLabel} numberOfLines={1}>{attachment.fileName || attachment.label || 'File'}</Text>
                                                    </View>
                                                );
                                            }
                                            return null;
                                        })}
                                    </View>
                                )}
                                {/* Show reactions for all feed items (posts and messages) */}
                                <View style={styles.feedReactions}>
                                    <View style={styles.reactionItem}>
                                        <MessageCircle size={14} color={colors.textMuted} />
                                        <Text style={styles.reactionText}>{commentsCount}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.reactionItem}
                                        onPress={() => handleLikeItem(item._id, userLiked, isPost)}
                                        disabled={likeLoading === item._id}
                                    >
                                        <Heart
                                            size={14}
                                            color={userLiked ? '#EF4444' : colors.textMuted}
                                            fill={userLiked ? '#EF4444' : 'transparent'}
                                        />
                                        <Text style={[styles.reactionText, userLiked && styles.reactionTextActive]}>
                                            {likesCount}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.reactionItem}
                                        onPress={() => handleReshareItem(item._id, userReshared, isPost)}
                                        disabled={reshareLoading === item._id}
                                    >
                                        <Repeat2
                                            size={14}
                                            color={userReshared ? '#22C55E' : colors.textMuted}
                                        />
                                        <Text style={[styles.reactionText, userReshared && styles.reactionTextReshared]}>
                                            {resharesCount}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            );
                        })}
                    </ScrollView>

                    {!!recordingError && <Text style={styles.errorText}>{recordingError}</Text>}

                    {/* Attachment Preview */}
                    {attachments.length > 0 && (
                        <View style={styles.attachmentPreview}>
                            {attachments.map((att, idx) => (
                                <View key={`att-${idx}`} style={styles.attachmentPreviewItem}>
                                    {att.type === 'image' ? (
                                        <Image source={{ uri: att.uri }} style={styles.attachmentPreviewImage} />
                                    ) : (
                                        <View style={styles.attachmentPreviewFile}>
                                            <MaterialIcons name="insert-drive-file" size={20} color={colors.textMuted} />
                                            <Text style={styles.attachmentPreviewFileName} numberOfLines={1}>{att.name}</Text>
                                        </View>
                                    )}
                                    <TouchableOpacity
                                        style={styles.attachmentRemoveButton}
                                        onPress={() => handleRemoveAttachment(idx)}
                                    >
                                        <X size={12} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Recording UI - WhatsApp Style */}
                    {recording ? (
                        <View style={styles.recordingContainer}>
                            <TouchableOpacity style={styles.recordingCancelButton} onPress={handleCancelRecording}>
                                <X size={20} color={colors.dangerText} />
                            </TouchableOpacity>
                            <View style={styles.recordingInfo}>
                                <View style={styles.recordingDotAnimated} />
                                <Text style={styles.recordingTimer}>{formatRecordingTime(recordingDuration)}</Text>
                                <View style={styles.recordingWaveform}>
                                    {[12, 18, 10, 22, 14, 20, 8, 24, 16, 12, 20, 14].map((height, i) => (
                                        <View
                                            key={i}
                                            style={[
                                                styles.waveformBar,
                                                { height, backgroundColor: colors.primary }
                                            ]}
                                        />
                                    ))}
                                </View>
                            </View>
                            <TouchableOpacity style={styles.recordingSendButton} onPress={handleStopRecording}>
                                <Send size={18} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.composer}>
                            <TouchableOpacity style={styles.composerIcon} onPress={() => setEmojiOpen(true)}>
                                <Smile size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TextInput
                                value={draft}
                                onChangeText={setDraft}
                                placeholder="Type message"
                                placeholderTextColor={colors.textSubtle}
                                style={styles.composerInput}
                            />
                            <TouchableOpacity style={styles.composerIcon} onPress={handleAttachPress}>
                                <Paperclip size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.composerIcon} onPress={handleStartRecording}>
                                <Mic size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                                <Send size={16} color={colors.primaryText} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            <Modal visible={reportModalOpen} transparent animationType="fade" onRequestClose={() => setReportModalOpen(false)}>
                <View style={styles.reportOverlay}>
                    <TouchableOpacity style={styles.reportBackdrop} activeOpacity={1} onPress={() => setReportModalOpen(false)} />
                    <View style={styles.reportCard}>
                        <View style={styles.reportHeader}>
                            <Text style={styles.reportTitle}>Report content</Text>
                            <TouchableOpacity onPress={() => setReportModalOpen(false)}>
                                <X size={16} color={colors.textMuted} />
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

            <Modal visible={emojiOpen} transparent={true} animationType="fade" onRequestClose={() => setEmojiOpen(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => setEmojiOpen(false)}
                    />
                    <View style={styles.pickerCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Emoji</Text>
                            <TouchableOpacity style={styles.iconButton} onPress={() => setEmojiOpen(false)}>
                                <X size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.pickerGrid}>
                            {EMOJI_SET.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji.id}
                                    style={styles.pickerItem}
                                    onPress={() => {
                                        setEmojiOpen(false);
                                        handleSendAttachment({
                                            type: 'emoji',
                                            value: emoji.code,
                                            label: emoji.label,
                                        });
                                    }}
                                >
                                    <Image source={{ uri: twemojiUrl(emoji.code) }} style={styles.pickerImage} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={stickerOpen} transparent={true} animationType="fade" onRequestClose={() => setStickerOpen(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => setStickerOpen(false)}
                    />
                    <View style={styles.pickerCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Stickers</Text>
                            <TouchableOpacity style={styles.iconButton} onPress={() => setStickerOpen(false)}>
                                <X size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.pickerGrid}>
                            {STICKER_SET.map((sticker) => (
                                <TouchableOpacity
                                    key={sticker.id}
                                    style={styles.pickerItem}
                                    onPress={() => {
                                        setStickerOpen(false);
                                        handleSendAttachment({
                                            type: 'sticker',
                                            value: sticker.uri,
                                            label: sticker.label,
                                            mimeType: 'image/png',
                                        });
                                    }}
                                >
                                    <Image source={{ uri: sticker.uri }} style={styles.pickerImage} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Floating Action Menu */}
            {menuOpen && menuItem && (
                <>
                    <Pressable
                        style={styles.floatingMenuOverlay}
                        onPress={closeMenu}
                    />
                    <View style={[styles.floatingMenuDropdown, { top: menuPosition.top, right: menuPosition.right }]}>
                        <TouchableOpacity
                            style={styles.floatingMenuItem}
                            onPress={() => {
                                const isPost = menuItem.isPost;
                                openReportModal(menuItem._id, isPost ? 'post' : 'message');
                                closeMenu();
                            }}
                        >
                            <MaterialIcons name="flag" size={16} color={colors.textMuted} />
                            <Text style={styles.floatingMenuItemText}>Report</Text>
                        </TouchableOpacity>
                        {menuItem.showDelete && (
                            <TouchableOpacity
                                style={styles.floatingMenuItem}
                                onPress={() => {
                                    handleDeleteItem(menuItem);
                                    closeMenu();
                                }}
                            >
                                <Trash2 size={16} color={colors.dangerText} />
                                <Text style={styles.floatingMenuItemTextDanger}>Delete</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </>
            )}
        </SafeAreaView>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.appBg,
            position: 'relative',
        },
        page: {
            flex: 1,
            padding: 16,
            backgroundColor: colors.appBg,
        },
        gridBackground: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            ...(Platform.OS === 'web'
                ? (({
                    backgroundImage:
                        'linear-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.08) 1px, transparent 1px)',
                    backgroundSize: '24px 24px, 24px 24px, 120px 120px, 120px 120px',
                } as any))
                : {}),
        },
        card: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 12,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        title: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        headerActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        iconButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        helperText: {
            fontSize: 11,
            color: colors.textMuted,
        },
        errorText: {
            fontSize: 11,
            color: colors.dangerText,
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
            backgroundColor: colors.surfaceMuted,
            overflow: 'visible',
        },
        feedHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            zIndex: 10,
        },
        feedHeaderInfo: {
            flex: 1,
        },
        menuContainer: {
            position: 'relative',
            zIndex: 100,
        },
        menuButton: {
            padding: 4,
        },
        menuDropdown: {
            position: 'absolute',
            top: 28,
            right: 0,
            backgroundColor: colors.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 10,
            zIndex: 1000,
            minWidth: 100,
        },
        menuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 12,
        },
        menuItemText: {
            fontSize: 13,
            color: colors.text,
        },
        menuItemTextDanger: {
            fontSize: 13,
            color: colors.dangerText,
        },
        // Floating menu styles (renders outside of feed items)
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
            shadowRadius: 12,
            elevation: 20,
            zIndex: 9999,
            minWidth: 140,
            paddingVertical: 6,
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
            zIndex: 1,
        },
        feedImage: {
            width: '100%',
            height: 180,
            borderRadius: 16,
        },
        videoPlaceholder: {
            width: '100%',
            height: 180,
            borderRadius: 16,
            backgroundColor: '#1A1A2E',
            alignItems: 'center',
            justifyContent: 'center',
        },
        videoLabel: {
            color: '#FFFFFF',
            fontSize: 12,
            marginTop: 8,
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
        emptyText: {
            fontSize: 12,
            color: colors.textSubtle,
        },
        toolsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        toolButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
        },
        recordingText: {
            fontSize: 11,
            color: colors.dangerText,
        },
        composer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 44,
            backgroundColor: colors.surfaceMuted,
        },
        composerInput: {
            flex: 1,
            fontSize: 13,
            color: colors.text,
        },
        composerIcon: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sendButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
        },
        attachmentPreview: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingVertical: 8,
        },
        attachmentPreviewItem: {
            position: 'relative',
        },
        attachmentPreviewImage: {
            width: 60,
            height: 60,
            borderRadius: 8,
        },
        attachmentPreviewFile: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            maxWidth: 120,
        },
        attachmentPreviewFileName: {
            fontSize: 11,
            color: colors.text,
            flex: 1,
        },
        attachmentRemoveButton: {
            position: 'absolute',
            top: -6,
            right: -6,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.dangerText,
            alignItems: 'center',
            justifyContent: 'center',
        },
        recordingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            height: 48,
        },
        recordingCancelButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
        },
        recordingInfo: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        recordingDotAnimated: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.dangerText,
        },
        recordingTimer: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
            minWidth: 40,
        },
        recordingWaveform: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            height: 24,
        },
        waveformBar: {
            width: 3,
            borderRadius: 2,
        },
        recordingSendButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
        },
        recordingIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
        },
        recordingDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.dangerText,
        },
        recordingText: {
            fontSize: 13,
            color: colors.dangerText,
            fontWeight: '500',
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
            fontSize: 12,
            fontWeight: '600',
            color: '#FFFFFF',
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
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
        },
        modalBackdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        modalTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
        },
        pickerCard: {
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 12,
        },
        pickerGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        pickerItem: {
            width: 52,
            height: 52,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
        },
        pickerImage: {
            width: 28,
            height: 28,
        },
    });

export default SubChannelScreen;
