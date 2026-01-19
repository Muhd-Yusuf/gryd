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
import { getAuthUser, getCallDetails } from '../../lib/api';
import useAgoraCall from '../../hooks/useAgoraCall';
import useAgoraCallWeb from '../../hooks/useAgoraCallWeb';
import UserAvatar from '../../components/UserAvatar';

// Type for participant details fetched from the call API
interface ParticipantDetails {
    agoraUid: number;
    displayName: string;
    avatarUrl: string | null;
}

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
    const [currentUserName, setCurrentUserName] = useState('You');
    const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
    // Map of agoraUid -> participant details for remote users
    const [participantMap, setParticipantMap] = useState<Map<number, ParticipantDetails>>(new Map());

    // Fetch current user details
    useEffect(() => {
        let isActive = true;
        getAuthUser()
            .then((user) => {
                if (!isActive || !user) return;
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
                setCurrentUserName(name || user.email || 'You');
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

                participants.forEach((p: any) => {
                    if (p.agoraUid && p.userDetails) {
                        newMap.set(p.agoraUid, {
                            agoraUid: p.agoraUid,
                            displayName: p.userDetails.displayName || `User ${p.agoraUid}`,
                            avatarUrl: p.userDetails.avatarUrl || null,
                        });
                    }
                });

                console.log('[VoiceChannel] Participant map updated:', newMap.size, 'participants');
                setParticipantMap(newMap);
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

    // Use web hook for web platform, native hook for mobile
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
                        <Text style={styles.participantName}>{currentUserName}</Text>
                        {isMuted ? (
                            <MicOff size={16} color={colors.error} />
                        ) : (
                            <Mic size={16} color={colors.success} />
                        )}
                    </View>

                    {/* Remote Users */}
                    {remoteUsers.map((agoraUid) => {
                        const participant = participantMap.get(agoraUid);
                        const displayName = participant?.displayName || `User ${agoraUid}`;
                        const avatarUrl = participant?.avatarUrl || null;

                        return (
                            <View key={agoraUid} style={styles.participantRow}>
                                <UserAvatar
                                    uri={avatarUrl}
                                    name={displayName}
                                    style={styles.participantAvatar}
                                />
                                <Text style={styles.participantName}>{displayName}</Text>
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
        participantName: {
            flex: 1,
            fontSize: 16,
            color: colors.text,
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
