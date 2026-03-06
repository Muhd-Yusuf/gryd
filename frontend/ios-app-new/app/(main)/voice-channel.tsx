/**
 * Voice Channel Screen - Twitter Spaces-like Experience
 * Features:
 * - Host/Speaker/Listener roles
 * - Admin can mute members
 * - Members can wave (raise hand) to request speaking
 * - Admin can grant/revoke speaker permissions
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Mic, MicOff, PhoneOff, Users, Volume2, Crown, Shield, Hand, UserPlus, UserMinus } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { useAgoraCall } from '../../hooks';
import { useAgoraCallWeb } from '../../hooks/useAgoraCallWeb';
import UserAvatar from '../../components/UserAvatar';
import {
    diagnoseVoiceChannelState,
    testClientConnectionState,
    testVoiceRoleAssignment,
    runVoiceChannelConnectionTests,
} from '../../lib/voiceChannelTestUtils';
import {
    useCurrentUser,
    useVoiceChannelParticipants,
    useJoinVoiceChannel,
    useLeaveVoiceChannel,
    useWaveToSpeak,
    useCancelWave,
    useGrantSpeaker,
    useRevokeSpeaker,
    useMuteParticipant,
    useUpdateMuteState,
} from '../../hooks/queries';

// Type for participant details
interface ParticipantDetails {
    agoraUid: number;
    userId: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    memberRole?: string;
    stakeholderBadge?: string | null;
    company?: string | null;
    voiceRole: 'host' | 'speaker' | 'listener';
    isMuted: boolean;
    isHandRaised: boolean;
}

// Wave request type
interface WaveRequest {
    userId: string;
    timestamp: Date;
    displayName: string;
    avatarUrl: string | null;
}

// Badge colors for stakeholders and roles
const BADGE_COLORS: Record<string, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
    subgrid_admin: '#DC2626',
    moderator: '#F97316',
};

const getBadgeInfo = (memberRole?: string, stakeholderBadge?: string | null): { label: string; color: string } | null => {
    if (memberRole === 'subgrid_admin') {
        return { label: 'CU Admin', color: BADGE_COLORS.subgrid_admin };
    }
    if (memberRole === 'moderator') {
        return { label: 'Moderator', color: BADGE_COLORS.moderator };
    }
    if (stakeholderBadge && BADGE_COLORS[stakeholderBadge]) {
        return { label: stakeholderBadge.charAt(0).toUpperCase() + stakeholderBadge.slice(1), color: BADGE_COLORS[stakeholderBadge] };
    }
    return null;
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

    const isWeb = Platform.OS === 'web';

    // UI state
    const [showParticipantActions, setShowParticipantActions] = useState<string | null>(null);

    // React Query hooks
    const { data: currentUser } = useCurrentUser();
    const participantsQuery = useVoiceChannelParticipants(channelId, subgridId);
    const joinMutation = useJoinVoiceChannel();
    const leaveMutation = useLeaveVoiceChannel();
    const waveMutation = useWaveToSpeak();
    const cancelWaveMutation = useCancelWave();
    const grantSpeakerMutation = useGrantSpeaker();
    const revokeSpeakerMutation = useRevokeSpeaker();
    const muteParticipantMutation = useMuteParticipant();
    const updateMuteMutation = useUpdateMuteState();

    // Derived state from current user
    const currentUserId = currentUser?.userId || null;
    const currentUserName = currentUser
        ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim() || currentUser.email || 'You'
        : 'You';
    const currentUserAvatar = currentUser?.avatarUrl || null;

    // Derived state from participants query
    const participantsData = participantsQuery.data || { participants: [], hostId: null, waveRequests: [] };
    const participants: ParticipantDetails[] = (participantsData.participants || []).map((p: any) => ({
        agoraUid: p.agoraUid || 0,
        userId: p.userId?.toString() || '',
        displayName: p.userDetails?.displayName || `User ${p.agoraUid || 'Unknown'}`,
        username: p.userDetails?.username || null,
        avatarUrl: p.userDetails?.avatarUrl || null,
        memberRole: p.userDetails?.memberRole || 'member',
        stakeholderBadge: p.userDetails?.stakeholderBadge || null,
        company: p.userDetails?.company || null,
        voiceRole: p.voiceRole || 'listener',
        isMuted: p.isMuted || false,
        isHandRaised: p.isHandRaised || false,
    }));
    const hostId = participantsData.hostId || null;
    const waveRequests: WaveRequest[] = participantsData.waveRequests || [];

    // Find my participant info
    const myParticipant = currentUserId ? participants.find(p => p.userId === currentUserId) : null;
    const myVoiceRole = myParticipant?.voiceRole || 'listener';
    const isHandRaised = myParticipant?.isHandRaised || false;

    // Agora hooks
    const webHook = useAgoraCallWeb({
        channelName: agoraChannelName,
        token,
        uid,
        appId,
        callId,
        autoJoin: isWeb && !!token && !!appId && !!agoraChannelName,
        onCallEnded: () => router.back(),
        onError: (err) => console.error('[VoiceChannel] Web Error:', err),
    });

    const nativeHook = useAgoraCall({
        channelName: agoraChannelName,
        token,
        uid,
        appId,
        callId,
        autoJoin: !isWeb && !!token && !!appId && !!agoraChannelName,
        onCallEnded: () => router.back(),
        onError: (err) => console.error('[VoiceChannel] Native Error:', err),
    });

    const {
        callState,
        isMuted,
        callDuration,
        error,
        hangup,
        toggleMute: agoraToggleMute,
    } = isWeb ? webHook : nativeHook;

    // Join voice channel when connected
    useEffect(() => {
        if (callState !== 'connected' || !channelId || !uid) return;

        joinMutation.mutate({ channelId, subgridId, agoraUid: uid });

        return () => {
            leaveMutation.mutate({ channelId, agoraUid: uid });
        };
    }, [callState, channelId, subgridId, uid]);

    // Toggle mute with server sync
    const handleToggleMute = useCallback(async () => {
        agoraToggleMute();
        const newMutedState = !isMuted;
        try {
            await updateMuteMutation.mutateAsync({ channelId, isMuted: newMutedState });
        } catch (err) {
            console.error('[VoiceChannel] Failed to update mute state:', err);
        }
    }, [agoraToggleMute, isMuted, channelId, updateMuteMutation]);

    // Wave to speak (raise hand)
    const handleWaveToSpeak = useCallback(async () => {
        try {
            if (isHandRaised) {
                await cancelWaveMutation.mutateAsync(channelId);
            } else {
                await waveMutation.mutateAsync(channelId);
            }
        } catch (err) {
            console.error('[VoiceChannel] Failed to wave:', err);
        }
    }, [channelId, isHandRaised, waveMutation, cancelWaveMutation]);

    // Grant speaker (host/speaker action)
    const handleGrantSpeaker = useCallback(async (targetUserId: string) => {
        try {
            await grantSpeakerMutation.mutateAsync({ channelId, targetUserId });
            setShowParticipantActions(null);
        } catch (err: any) {
            console.error('[VoiceChannel] Failed to grant speaker:', err);
            if (Platform.OS !== 'web') {
                Alert.alert('Error', err.message || 'Failed to grant speaker permission');
            }
        }
    }, [channelId, grantSpeakerMutation]);

    // Revoke speaker (host action)
    const handleRevokeSpeaker = useCallback(async (targetUserId: string) => {
        try {
            await revokeSpeakerMutation.mutateAsync({ channelId, targetUserId });
            setShowParticipantActions(null);
        } catch (err: any) {
            console.error('[VoiceChannel] Failed to revoke speaker:', err);
            if (Platform.OS !== 'web') {
                Alert.alert('Error', err.message || 'Failed to revoke speaker permission');
            }
        }
    }, [channelId, revokeSpeakerMutation]);

    // Mute participant (host/speaker action)
    const handleMuteParticipant = useCallback(async (targetUserId: string, mute: boolean) => {
        try {
            await muteParticipantMutation.mutateAsync({ channelId, targetUserId, mute });
            setShowParticipantActions(null);
        } catch (err: any) {
            console.error('[VoiceChannel] Failed to mute participant:', err);
            if (Platform.OS !== 'web') {
                Alert.alert('Error', err.message || 'Failed to mute participant');
            }
        }
    }, [channelId, muteParticipantMutation]);

    const handleLeave = async () => {
        await hangup();
        router.back();
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const isHost = myVoiceRole === 'host';
    const isSpeaker = myVoiceRole === 'speaker' || myVoiceRole === 'host';
    // Only host (CU Admin) can mute others, grant/revoke speaker permissions
    const canMuteOthers = isHost;
    const canGrantSpeaker = isHost;
    const canRevokeSpeaker = isHost;

    // Separate participants into speakers and listeners
    const speakers = participants.filter(p => p.voiceRole === 'host' || p.voiceRole === 'speaker');
    const listeners = participants.filter(p => p.voiceRole === 'listener');

    // Expose test utilities to browser console (web only)
    useEffect(() => {
        if (!isWeb) return;

        const webClient = webHook.client;

        (window as any).voiceChannelTest = {
            diagnose: () => diagnoseVoiceChannelState({
                callState,
                participants,
                hostId,
                myVoiceRole,
                isHandRaised,
                isMuted,
                error,
                client: webClient
            }),
            testClientState: () => testClientConnectionState(webClient),
            testRoles: () => testVoiceRoleAssignment(
                participants.map(p => ({
                    userId: p.userId,
                    voiceRole: p.voiceRole,
                    memberRole: p.memberRole
                })),
                hostId
            ),
            runTests: () => runVoiceChannelConnectionTests({
                getClient: () => webClient
            }),
            getState: () => ({
                callState,
                isMuted,
                isHandRaised,
                myVoiceRole,
                hostId,
                participantCount: participants.length,
                speakers: speakers.length,
                listeners: listeners.length,
                waveRequests: waveRequests.length,
                clientState: webClient?.connectionState,
                error
            })
        };

        console.log('[VoiceChannel] Test utilities available at window.voiceChannelTest');
        console.log('[VoiceChannel] Commands: diagnose(), testClientState(), testRoles(), runTests(), getState()');

        return () => {
            delete (window as any).voiceChannelTest;
        };
    }, [isWeb, callState, participants, hostId, myVoiceRole, isHandRaised, isMuted, error, webHook.client, speakers.length, listeners.length, waveRequests.length]);

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
                <View style={styles.headerRight}>
                    <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                    </View>
                </View>
            </View>

            {/* Call Info */}
            <View style={styles.callInfo}>
                <Text style={styles.callStatus}>
                    {callState === 'connected' ? `${participants.length} listening` : callState === 'connecting' ? 'Connecting...' : 'Voice Channel'}
                </Text>
                {callState === 'connected' && (
                    <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
                )}
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Speakers Section - Twitter Spaces style */}
                <View style={styles.speakersSection}>
                    <View style={styles.sectionHeader}>
                        <Crown size={16} color={colors.primary} />
                        <Text style={styles.sectionTitle}>Speakers ({speakers.length})</Text>
                    </View>
                    <View style={styles.speakersGrid}>
                        {speakers.map((participant) => {
                            const isMe = participant.userId === currentUserId;
                            const badgeInfo = getBadgeInfo(participant.memberRole, participant.stakeholderBadge);
                            const showMuted = isMe ? isMuted : participant.isMuted;

                            return (
                                <TouchableOpacity
                                    key={participant.userId}
                                    style={styles.speakerCard}
                                    onPress={() => !isMe && canMuteOthers && setShowParticipantActions(
                                        showParticipantActions === participant.userId ? null : participant.userId
                                    )}
                                    activeOpacity={canMuteOthers && !isMe ? 0.7 : 1}
                                >
                                    <View style={[styles.speakerAvatarContainer, participant.voiceRole === 'host' && styles.hostAvatarContainer]}>
                                        <UserAvatar
                                            uri={isMe ? currentUserAvatar : participant.avatarUrl}
                                            name={isMe ? currentUserName : participant.displayName}
                                            style={styles.speakerAvatar}
                                        />
                                        {participant.voiceRole === 'host' && (
                                            <View style={styles.hostBadge}>
                                                <Crown size={10} color="#FFFFFF" />
                                            </View>
                                        )}
                                        <View style={[styles.micIndicator, showMuted && styles.micIndicatorMuted]}>
                                            {showMuted ? (
                                                <MicOff size={10} color="#FFFFFF" />
                                            ) : (
                                                <Mic size={10} color="#FFFFFF" />
                                            )}
                                        </View>
                                    </View>
                                    <Text style={styles.speakerName} numberOfLines={1}>
                                        {isMe ? 'You' : participant.displayName}
                                    </Text>
                                    {badgeInfo && (
                                        <View style={[styles.roleBadge, { backgroundColor: badgeInfo.color }]}>
                                            <Text style={styles.roleBadgeText}>{badgeInfo.label}</Text>
                                        </View>
                                    )}

                                    {/* Actions dropdown */}
                                    {showParticipantActions === participant.userId && !isMe && (
                                        <View style={styles.actionsDropdown}>
                                            <TouchableOpacity
                                                style={styles.actionItem}
                                                onPress={() => handleMuteParticipant(participant.userId, !participant.isMuted)}
                                            >
                                                {participant.isMuted ? <Mic size={16} color={colors.text} /> : <MicOff size={16} color={colors.text} />}
                                                <Text style={styles.actionText}>{participant.isMuted ? 'Unmute' : 'Mute'}</Text>
                                            </TouchableOpacity>
                                            {canRevokeSpeaker && participant.voiceRole !== 'host' && (
                                                <TouchableOpacity
                                                    style={styles.actionItem}
                                                    onPress={() => handleRevokeSpeaker(participant.userId)}
                                                >
                                                    <UserMinus size={16} color={colors.error} />
                                                    <Text style={[styles.actionText, { color: colors.error }]}>Remove Speaker</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                style={styles.actionItem}
                                                onPress={() => setShowParticipantActions(null)}
                                            >
                                                <Text style={styles.actionText}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Wave Requests Section (visible to host only) */}
                {isHost && waveRequests.length > 0 && (
                    <View style={styles.waveSection}>
                        <View style={styles.sectionHeader}>
                            <Hand size={16} color="#F59E0B" />
                            <Text style={styles.sectionTitle}>Requests to Speak ({waveRequests.length})</Text>
                        </View>
                        {waveRequests.map((request) => (
                            <View key={request.userId} style={styles.waveRequestRow}>
                                <UserAvatar
                                    uri={request.avatarUrl}
                                    name={request.displayName}
                                    style={styles.waveAvatar}
                                />
                                <Text style={styles.waveName}>{request.displayName}</Text>
                                <View style={styles.waveActions}>
                                    <TouchableOpacity
                                        style={styles.grantButton}
                                        onPress={() => handleGrantSpeaker(request.userId)}
                                    >
                                        <UserPlus size={14} color="#FFFFFF" />
                                        <Text style={styles.grantButtonText}>Allow</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Listeners Section */}
                <View style={styles.listenersSection}>
                    <View style={styles.sectionHeader}>
                        <Users size={16} color={colors.textMuted} />
                        <Text style={styles.sectionTitle}>Listeners ({listeners.length})</Text>
                    </View>
                    <View style={styles.listenersGrid}>
                        {listeners.map((participant) => {
                            const isMe = participant.userId === currentUserId;
                            const hasRaisedHand = participant.isHandRaised;

                            return (
                                <TouchableOpacity
                                    key={participant.userId}
                                    style={styles.listenerCard}
                                    onPress={() => !isMe && isHost && setShowParticipantActions(
                                        showParticipantActions === participant.userId ? null : participant.userId
                                    )}
                                    activeOpacity={isHost && !isMe ? 0.7 : 1}
                                >
                                    <View style={styles.listenerAvatarContainer}>
                                        <UserAvatar
                                            uri={isMe ? currentUserAvatar : participant.avatarUrl}
                                            name={isMe ? currentUserName : participant.displayName}
                                            style={styles.listenerAvatar}
                                        />
                                        {hasRaisedHand && (
                                            <View style={styles.handRaisedBadge}>
                                                <Hand size={8} color="#FFFFFF" />
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.listenerName} numberOfLines={1}>
                                        {isMe ? 'You' : participant.displayName}
                                    </Text>

                                    {/* Actions dropdown for listeners (host only) */}
                                    {showParticipantActions === participant.userId && !isMe && isHost && (
                                        <View style={styles.actionsDropdown}>
                                            <TouchableOpacity
                                                style={styles.actionItem}
                                                onPress={() => handleGrantSpeaker(participant.userId)}
                                            >
                                                <UserPlus size={16} color={colors.primary} />
                                                <Text style={[styles.actionText, { color: colors.primary }]}>Make Speaker</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.actionItem}
                                                onPress={() => handleMuteParticipant(participant.userId, !participant.isMuted)}
                                            >
                                                {participant.isMuted ? <Mic size={16} color={colors.text} /> : <MicOff size={16} color={colors.text} />}
                                                <Text style={styles.actionText}>{participant.isMuted ? 'Unmute' : 'Mute'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.actionItem}
                                                onPress={() => setShowParticipantActions(null)}
                                            >
                                                <Text style={styles.actionText}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Error Message */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
                {/* Wave/Lower Hand button for listeners */}
                {myVoiceRole === 'listener' && (
                    <TouchableOpacity
                        style={[styles.controlButton, isHandRaised && styles.controlButtonActive]}
                        onPress={handleWaveToSpeak}
                    >
                        <Hand size={24} color={isHandRaised ? '#F59E0B' : '#FFFFFF'} />
                    </TouchableOpacity>
                )}

                {/* Mute button for speakers */}
                {isSpeaker && (
                    <TouchableOpacity
                        style={[styles.controlButton, isMuted && styles.controlButtonMuted]}
                        onPress={handleToggleMute}
                    >
                        {isMuted ? (
                            <MicOff size={24} color="#EF4444" />
                        ) : (
                            <Mic size={24} color="#FFFFFF" />
                        )}
                    </TouchableOpacity>
                )}

                {/* Leave button */}
                <TouchableOpacity style={styles.endCallButton} onPress={handleLeave}>
                    <PhoneOff size={28} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Host indicator */}
                {isHost && (
                    <View style={styles.hostIndicator}>
                        <Shield size={16} color={colors.primary} />
                        <Text style={styles.hostIndicatorText}>Host</Text>
                    </View>
                )}
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
        headerRight: {
            width: 60,
            alignItems: 'flex-end',
        },
        liveIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#EF4444',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            gap: 4,
        },
        liveDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#FFFFFF',
        },
        liveText: {
            fontSize: 10,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        callInfo: {
            alignItems: 'center',
            paddingVertical: 16,
        },
        callStatus: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 4,
        },
        callDuration: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.text,
        },
        content: {
            flex: 1,
            paddingHorizontal: 16,
        },
        speakersSection: {
            marginBottom: 24,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
        },
        sectionTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
        },
        speakersGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
        },
        speakerCard: {
            alignItems: 'center',
            width: 80,
        },
        speakerAvatarContainer: {
            position: 'relative',
            marginBottom: 8,
        },
        hostAvatarContainer: {
            borderWidth: 2,
            borderColor: colors.primary,
            borderRadius: 32,
            padding: 2,
        },
        speakerAvatar: {
            width: 56,
            height: 56,
            borderRadius: 28,
        },
        hostBadge: {
            position: 'absolute',
            top: -4,
            right: -4,
            backgroundColor: colors.primary,
            width: 20,
            height: 20,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        micIndicator: {
            position: 'absolute',
            bottom: -2,
            right: -2,
            backgroundColor: '#22C55E',
            width: 20,
            height: 20,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.appBg,
        },
        micIndicatorMuted: {
            backgroundColor: '#EF4444',
        },
        speakerName: {
            fontSize: 12,
            color: colors.text,
            textAlign: 'center',
        },
        roleBadge: {
            marginTop: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
        },
        roleBadgeText: {
            fontSize: 9,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        actionsDropdown: {
            position: 'absolute',
            top: 70,
            left: -20,
            right: -20,
            backgroundColor: colors.cardBg,
            borderRadius: 8,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            zIndex: 100,
        },
        actionItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 4,
        },
        actionText: {
            fontSize: 12,
            color: colors.text,
        },
        waveSection: {
            marginBottom: 24,
            backgroundColor: '#FEF3C7',
            borderRadius: 12,
            padding: 12,
        },
        waveRequestRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            gap: 12,
        },
        waveAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
        },
        waveName: {
            flex: 1,
            fontSize: 14,
            color: '#78350F',
        },
        waveActions: {
            flexDirection: 'row',
            gap: 8,
        },
        grantButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#22C55E',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
        },
        grantButtonText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        listenersSection: {
            marginBottom: 24,
        },
        listenersGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        listenerCard: {
            alignItems: 'center',
            width: 60,
        },
        listenerAvatarContainer: {
            position: 'relative',
            marginBottom: 4,
        },
        listenerAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
        },
        handRaisedBadge: {
            position: 'absolute',
            bottom: -2,
            right: -2,
            backgroundColor: '#F59E0B',
            width: 16,
            height: 16,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.appBg,
        },
        listenerName: {
            fontSize: 10,
            color: colors.textMuted,
            textAlign: 'center',
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
            borderTopWidth: 1,
            borderTopColor: colors.border,
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
            backgroundColor: colors.cardBg,
            borderWidth: 2,
            borderColor: '#F59E0B',
        },
        controlButtonMuted: {
            backgroundColor: colors.cardBg,
            borderWidth: 2,
            borderColor: colors.border,
        },
        endCallButton: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#EF4444',
            justifyContent: 'center',
            alignItems: 'center',
        },
        hostIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.primary + '20',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
        },
        hostIndicatorText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.primary,
        },
    });

export default VoiceChannelScreen;
