/**
 * Voice Channel Screen
 * Handles voice calls in community voice channels using Agora
 * Supports both web and native platforms
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Mic, MicOff, PhoneOff, Users, Volume2 } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { getAuthUser, getCallDetails, communityGet, joinVoiceChannel, leaveVoiceChannel, getVoiceChannelParticipants } from '../../lib/api';
import useAgoraCall from '../../hooks/useAgoraCall';
import useAgoraCallWeb from '../../hooks/useAgoraCallWeb';
import UserAvatar from '../../components/UserAvatar';

// Type for participant details fetched from the call API
interface ParticipantDetails {
    agoraUid: number;
    userId: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    memberRole?: string;
    stakeholderBadge?: string | null;
    company?: string | null;
}

// Stakeholder badge colors
const STAKEHOLDER_BADGE_COLORS: Record<string, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};

const normalizeParam = (value?: string | string[]) => {
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
};

const VoiceChannelScreen = () => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const params = useLocalSearchParams();

    const channelId = normalizeParam(params.channelId);
    const displayName = normalizeParam(params.displayName);
    const agoraChannelName = normalizeParam(params.agoraChannelName);
    const subgridId = normalizeParam(params.subgridId);
    const callId = normalizeParam(params.callId);
    const token = normalizeParam(params.token);
    const uid = parseInt(normalizeParam(params.uid) || '0', 10);
    const appId = normalizeParam(params.appId);
    // Peer info passed from navigation (for DM calls)
    const peerName = normalizeParam(params.peerName);
    const peerAvatar = normalizeParam(params.peerAvatar);

    const isWeb = Platform.OS === 'web';
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState('You');
    const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(null);
    const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
    // Map of agoraUid -> participant details for remote users
    const [participantMap, setParticipantMap] = useState<Map<number, ParticipantDetails>>(new Map());
    // Store all participants from API for fallback lookup
    const [allParticipants, setAllParticipants] = useState<ParticipantDetails[]>([]);
    // Store subgrid members for voice channel calls (no callId)
    const [subgridMembers, setSubgridMembers] = useState<any[]>([]);

    // Use web hook for web platform, native hook for mobile
    // IMPORTANT: Must be called before any useEffect that depends on callState
    const webHook = useAgoraCallWeb({
        channelName: agoraChannelName,
        token,
        uid,
        appId,
        callId,
        autoJoin: isWeb && !!token && !!appId && !!agoraChannelName,
        onCallEnded: () => {
            router.back();
        },
        onError: (err) => {
            console.error('[VoiceChannel] Web Error:', err);
        },
    });

    const nativeHook = useAgoraCall({
        onCallEnded: () => {
            router.back();
        },
        onError: (err) => {
            console.error('[VoiceChannel] Native Error:', err);
        },
    });

    // Select the appropriate hook based on platform
    const {
        callState,
        isMuted,
        remoteUsers,
        callDuration,
        error,
        hangup,
        toggleMute,
    } = isWeb ? webHook : nativeHook;

    // Fetch current user details
    useEffect(() => {
        let isActive = true;
        getAuthUser()
            .then((user) => {
                if (!isActive || !user) return;
                setCurrentUserId(user.userId);
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
                setCurrentUserName(name || user.email || 'You');
                setCurrentUserUsername(user.username || null);
                setCurrentUserAvatar(user.avatarUrl || null);
            })
            .catch(() => {});
        return () => {
            isActive = false;
        };
    }, []);

    // Fetch call participant details when we have a callId
    useEffect(() => {
        if (!callId) return;

        let isActive = true;
        const fetchParticipants = async () => {
            try {
                console.log('[VoiceChannel] Fetching call details for callId:', callId);
                const response = await getCallDetails(callId);
                if (!isActive) return;

                const participants = response?.data?.participants || [];
                const newMap = new Map<number, ParticipantDetails>();
                const allParts: ParticipantDetails[] = [];

                participants.forEach((p: any) => {
                    if (p.userDetails) {
                        const detail: ParticipantDetails = {
                            agoraUid: p.agoraUid || 0,
                            userId: p.userId?.toString() || '',
                            displayName: p.userDetails.displayName || `User ${p.agoraUid || 'Unknown'}`,
                            username: p.userDetails.username || null,
                            avatarUrl: p.userDetails.avatarUrl || null,
                            memberRole: p.userDetails.memberRole || 'member',
                            stakeholderBadge: p.userDetails.stakeholderBadge || null,
                            company: p.userDetails.company || null,
                        };
                        allParts.push(detail);

                        // Only add to map if we have a valid agoraUid
                        if (p.agoraUid) {
                            newMap.set(p.agoraUid, detail);
                        }
                    }
                });

                console.log('[VoiceChannel] Participant map updated:', newMap.size, 'participants, allParts:', allParts.length);
                console.log('[VoiceChannel] All participants:', JSON.stringify(allParts));
                setParticipantMap(newMap);
                setAllParticipants(allParts);
            } catch (err) {
                console.error('[VoiceChannel] Failed to fetch call participants:', err);
            }
        };

        fetchParticipants();

        // Refresh participant list periodically in case new users join
        const interval = setInterval(fetchParticipants, 10000);

        return () => {
            isActive = false;
            clearInterval(interval);
        };
    }, [callId]);

    // Fetch subgrid members for voice channel calls (when no callId)
    useEffect(() => {
        if (!subgridId) return;

        let isActive = true;
        const fetchMembers = async () => {
            try {
                console.log('[VoiceChannel] Fetching subgrid members for:', subgridId);
                const response = await communityGet(`/subgrids/${subgridId}/members`);
                if (!isActive) return;

                const members = response?.data || [];
                console.log('[VoiceChannel] Fetched', members.length, 'members from subgrid');
                setSubgridMembers(members);
            } catch (err) {
                console.error('[VoiceChannel] Failed to fetch subgrid members:', err);
            }
        };

        fetchMembers();

        return () => {
            isActive = false;
        };
    }, [subgridId]);

    // Join voice channel when connected and fetch participants
    useEffect(() => {
        if (callState !== 'connected' || !channelId || !uid) return;

        let isActive = true;

        // Register ourselves in the voice channel
        const registerAndFetch = async () => {
            try {
                console.log('[VoiceChannel] Registering in voice channel:', channelId, 'uid:', uid);
                await joinVoiceChannel(channelId, subgridId, uid);
            } catch (err) {
                console.error('[VoiceChannel] Failed to join voice channel tracking:', err);
            }

            // Fetch participants
            fetchVoiceChannelParticipants();
        };

        const fetchVoiceChannelParticipants = async () => {
            if (!isActive) return;
            try {
                console.log('[VoiceChannel] Fetching voice channel participants for:', channelId);
                const response = await getVoiceChannelParticipants(channelId, subgridId);
                if (!isActive) return;

                const participants = response?.data?.participants || [];
                const newMap = new Map<number, ParticipantDetails>();
                const allParts: ParticipantDetails[] = [];

                participants.forEach((p: any) => {
                    if (p.userDetails) {
                        const detail: ParticipantDetails = {
                            agoraUid: p.agoraUid || 0,
                            userId: p.userId?.toString() || '',
                            displayName: p.userDetails.displayName || `User ${p.agoraUid || 'Unknown'}`,
                            username: p.userDetails.username || null,
                            avatarUrl: p.userDetails.avatarUrl || null,
                            memberRole: p.userDetails.memberRole || 'member',
                            stakeholderBadge: p.userDetails.stakeholderBadge || null,
                            company: p.userDetails.company || null,
                        };
                        allParts.push(detail);

                        if (p.agoraUid) {
                            newMap.set(p.agoraUid, detail);
                        }
                    }
                });

                console.log('[VoiceChannel] Voice channel participants updated:', newMap.size, 'participants');
                setParticipantMap(newMap);
                setAllParticipants(allParts);
            } catch (err) {
                console.error('[VoiceChannel] Failed to fetch voice channel participants:', err);
            }
        };

        registerAndFetch();

        // Refresh participant list periodically
        const interval = setInterval(fetchVoiceChannelParticipants, 5000);

        return () => {
            isActive = false;
            clearInterval(interval);
            // Unregister from voice channel
            leaveVoiceChannel(channelId, uid).catch(err => {
                console.error('[VoiceChannel] Failed to leave voice channel tracking:', err);
            });
        };
    }, [callState, channelId, subgridId, uid]);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleLeave = async () => {
        await hangup();
        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Volume2 size={20} color={colors.primary} />
                    <Text style={styles.headerTitle}>{displayName || 'Voice Channel'}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Call Info */}
            <View style={styles.callInfo}>
                <Text style={styles.callStatus}>
                    {callState === 'connected' ? 'Connected' : callState === 'connecting' ? 'Connecting...' : 'Voice Channel'}
                </Text>
                {callState === 'connected' && (
                    <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
                )}
            </View>

            {/* Participants */}
            <View style={styles.participantsSection}>
                <View style={styles.participantsHeader}>
                    <Users size={16} color={colors.textMuted} />
                    <Text style={styles.participantsTitle}>
                        Participants ({1 + remoteUsers.length})
                    </Text>
                </View>

                <ScrollView style={styles.participantsList}>
                    {/* Self */}
                    <View style={styles.participantRow}>
                        <UserAvatar
                            uri={currentUserAvatar}
                            name={currentUserName}
                            style={styles.participantAvatar}
                        />
                        <View style={styles.participantInfo}>
                            <Text style={styles.participantName}>{currentUserName}</Text>
                            {currentUserUsername && (
                                <Text style={styles.participantUsername}>@{currentUserUsername}</Text>
                            )}
                        </View>
                        {isMuted ? (
                            <MicOff size={16} color={colors.error} />
                        ) : (
                            <Mic size={16} color={colors.success} />
                        )}
                    </View>

                    {/* Remote Users */}
                    {remoteUsers.map((agoraUid, index) => {
                        // Strategy 1: Direct lookup by agoraUid in the map
                        let participant = participantMap.get(agoraUid);
                        let remoteDisplayName = participant?.displayName;
                        let remoteUsername = participant?.username || null;
                        let remoteAvatarUrl = participant?.avatarUrl || null;
                        let remoteBadge = participant?.stakeholderBadge || null;
                        let remoteCompany = participant?.company || null;

                        // Strategy 2: For DM calls, find the "other" participant (not current user)
                        if (!remoteDisplayName && currentUserId && allParticipants.length > 0) {
                            const otherParticipant = allParticipants.find(p => p.userId !== currentUserId);
                            if (otherParticipant) {
                                remoteDisplayName = otherParticipant.displayName;
                                remoteUsername = otherParticipant.username;
                                remoteAvatarUrl = otherParticipant.avatarUrl;
                                remoteBadge = otherParticipant.stakeholderBadge || null;
                                remoteCompany = otherParticipant.company || null;
                                console.log('[VoiceChannel] Using other participant fallback:', remoteDisplayName);
                            }
                        }

                        // Strategy 3: Use peer info from navigation params (for DM calls)
                        if (!remoteDisplayName && peerName) {
                            remoteDisplayName = peerName;
                            remoteAvatarUrl = peerAvatar || null;
                            console.log('[VoiceChannel] Using peerName param fallback:', remoteDisplayName);
                        }

                        // Strategy 4: For voice channel calls, look up member from subgrid members
                        // Find member who is not the current user (other members in channel)
                        if (!remoteDisplayName && subgridMembers.length > 0 && currentUserId) {
                            // Find a member who is not the current user
                            // For multiple remote users, use index to pick different members
                            const otherMembers = subgridMembers.filter(m => {
                                const memberId = m.userId?.toString() || m.user?._id?.toString();
                                return memberId !== currentUserId;
                            });
                            if (otherMembers.length > index) {
                                const member = otherMembers[index];
                                const firstName = member.firstName || member.user?.firstName || '';
                                const lastName = member.lastName || member.user?.lastName || '';
                                remoteDisplayName = [firstName, lastName].filter(Boolean).join(' ').trim() || member.email || member.user?.email;
                                remoteUsername = member.username || member.user?.username || null;
                                remoteAvatarUrl = member.avatarUrl || member.user?.avatarUrl || null;
                                remoteBadge = member.stakeholderBadge || member.user?.stakeholderBadge || null;
                                remoteCompany = member.company || member.user?.company || null;
                                console.log('[VoiceChannel] Using subgrid member fallback:', remoteDisplayName);
                            }
                        }

                        // Final fallback with agoraUid
                        if (!remoteDisplayName) {
                            remoteDisplayName = `User ${agoraUid}`;
                            console.log('[VoiceChannel] Using UID fallback for agoraUid:', agoraUid, 'participantMap keys:', Array.from(participantMap.keys()));
                        }

                        return (
                            <View key={agoraUid} style={styles.participantRow}>
                                <UserAvatar
                                    uri={remoteAvatarUrl}
                                    name={remoteDisplayName}
                                    style={styles.participantAvatar}
                                />
                                <View style={styles.participantInfo}>
                                    <View style={styles.participantNameRow}>
                                        <Text style={styles.participantName}>{remoteDisplayName}</Text>
                                        {remoteBadge && (
                                            <View style={[styles.participantBadge, { backgroundColor: STAKEHOLDER_BADGE_COLORS[remoteBadge] || '#3B82F6' }]}>
                                                <Text style={styles.participantBadgeText}>
                                                    {remoteBadge.charAt(0).toUpperCase() + remoteBadge.slice(1)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    {remoteUsername && (
                                        <Text style={styles.participantUsername}>@{remoteUsername}</Text>
                                    )}
                                    {remoteCompany && (
                                        <Text style={styles.participantCompany}>{remoteCompany}</Text>
                                    )}
                                </View>
                                <Mic size={16} color={colors.success} />
                            </View>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Error Message */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                    onPress={toggleMute}
                >
                    {isMuted ? (
                        <MicOff size={24} color="#FFFFFF" />
                    ) : (
                        <Mic size={24} color="#FFFFFF" />
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.endCallButton} onPress={handleLeave}>
                    <PhoneOff size={28} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        backButton: {
            padding: 8,
        },
        headerCenter: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
        },
        callInfo: {
            alignItems: 'center',
            paddingVertical: 24,
        },
        callStatus: {
            fontSize: 16,
            color: colors.textMuted,
            marginBottom: 4,
        },
        callDuration: {
            fontSize: 24,
            fontWeight: '600',
            color: colors.text,
        },
        participantsSection: {
            flex: 1,
            paddingHorizontal: 16,
        },
        participantsHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
        },
        participantsTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.textMuted,
        },
        participantsList: {
            flex: 1,
        },
        participantRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 12,
            backgroundColor: colors.cardBg,
            borderRadius: 8,
            marginBottom: 8,
            gap: 12,
        },
        participantAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.border,
        },
        participantInfo: {
            flex: 1,
        },
        participantNameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
        },
        participantName: {
            fontSize: 16,
            color: colors.text,
        },
        participantBadge: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
        },
        participantBadgeText: {
            fontSize: 10,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        participantUsername: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        participantCompany: {
            fontSize: 11,
            color: colors.textMuted,
            fontStyle: 'italic',
            marginTop: 1,
        },
        errorContainer: {
            backgroundColor: colors.error + '20',
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginHorizontal: 16,
            borderRadius: 8,
            marginBottom: 16,
        },
        errorText: {
            color: colors.error,
            textAlign: 'center',
        },
        controls: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 24,
            paddingVertical: 24,
            paddingBottom: 40,
        },
        controlButton: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.textMuted,
            justifyContent: 'center',
            alignItems: 'center',
        },
        controlButtonActive: {
            backgroundColor: colors.primary,
        },
        endCallButton: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#EF4444',
            justifyContent: 'center',
            alignItems: 'center',
        },
    });

export default VoiceChannelScreen;
