/**
 * Call Modal Component - Web Implementation
 * Full-screen modal for voice/video calls using Agora Web SDK
 */

// Debug log to track which file is being loaded
console.log('[CallModal.web] Loading WEB implementation (CallModal.web.tsx)');

import React, { useEffect, useMemo, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
} from 'react-native';
import { Phone, Video, VideoOff, Mic, MicOff, PhoneOff, Volume2, VolumeX, SwitchCamera, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { CallState, CallType, IncomingCall, CallSession } from '../hooks';
import UserAvatar from './UserAvatar';

interface CallModalProps {
    visible: boolean;
    callState: CallState;
    callType: CallType;
    currentCall: CallSession | null;
    incomingCall: IncomingCall | null;
    isMuted: boolean;
    isVideoEnabled: boolean;
    isSpeakerOn: boolean;
    remoteUsers: number[];
    callDuration: number;
    error: string | null;
    peerName: string;
    peerAvatar?: string;
    selfAvatar?: string;
    engine: any;
    onAnswer: () => void;
    onDecline: () => void;
    onHangup: () => void;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    onToggleSpeaker: () => void;
    onSwitchCamera: () => void;
}

const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const CallModal: React.FC<CallModalProps> = ({
    visible,
    callState,
    callType,
    currentCall,
    incomingCall,
    isMuted,
    isVideoEnabled,
    isSpeakerOn,
    remoteUsers,
    callDuration,
    error,
    peerName,
    peerAvatar,
    selfAvatar,
    engine,
    onAnswer,
    onDecline,
    onHangup,
    onToggleMute,
    onToggleVideo,
    onToggleSpeaker,
    onSwitchCamera,
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const remoteVideoRef = useRef<HTMLDivElement | null>(null);
    const localVideoRef = useRef<HTMLDivElement | null>(null);
    // Track which tracks have been played to prevent re-playing (causes loops)
    const playedLocalTrackRef = useRef<any>(null);
    const playedRemoteUserRef = useRef<number | null>(null);

    const isIncoming = !!incomingCall && callState === 'idle';
    const isConnecting = callState === 'initiating' || callState === 'ringing' || callState === 'connecting';
    const isConnected = callState === 'connected';
    const isVideoCall = callType === 'video';
    const incomingAvatar = incomingCall?.callerAvatar || peerAvatar || null;

    // Handle video track playback for web
    // Note: On web, the Agora SDK handles video rendering through the client/tracks
    // The engine prop contains { localVideoTrack, client } on web (not the native Agora engine)
    useEffect(() => {
        if (!visible || !isVideoCall) return;

        // On web, engine may contain { localVideoTrack, client } or be null
        // We need to handle both cases
        const localTrack = engine?.localVideoTrack;
        const client = engine?.client;

        console.log('[CallModal Web] Video effect running - visible:', visible, 'isVideoCall:', isVideoCall, 'hasLocalTrack:', !!localTrack, 'remoteUsers:', remoteUsers.length);

        const playRemoteVideo = async () => {
            if (remoteVideoRef.current && remoteUsers.length > 0 && client) {
                try {
                    const remoteUser = client.remoteUsers?.find((u: any) => u.uid === remoteUsers[0]);
                    console.log('[CallModal Web] Looking for remote user:', remoteUsers[0], 'found:', remoteUser, 'hasVideoTrack:', !!remoteUser?.videoTrack);

                    // Check if we already played this specific track
                    if (remoteUser?.videoTrack) {
                        // Only skip if we've already played this exact user's track
                        if (playedRemoteUserRef.current === remoteUsers[0]) {
                            console.log('[CallModal Web] Already played remote video for user:', remoteUsers[0]);
                            return;
                        }
                        console.log('[CallModal Web] Playing remote video track');
                        remoteUser.videoTrack.play(remoteVideoRef.current);
                        playedRemoteUserRef.current = remoteUsers[0];
                    }
                } catch (err) {
                    console.error('[CallModal Web] Failed to play remote video:', err);
                }
            }
        };

        const playLocalVideo = async () => {
            // Skip if we've already played this exact track
            if (localTrack && playedLocalTrackRef.current === localTrack) {
                console.log('[CallModal Web] Already played local video track');
                return;
            }
            if (localVideoRef.current && localTrack) {
                try {
                    console.log('[CallModal Web] Playing local video track, track id:', localTrack?.getTrackId?.());
                    localTrack.play(localVideoRef.current);
                    playedLocalTrackRef.current = localTrack;
                    console.log('[CallModal Web] Local video track playing successfully');
                } catch (err) {
                    console.error('[CallModal Web] Failed to play local video:', err);
                }
            } else {
                console.log('[CallModal Web] Cannot play local video - ref:', !!localVideoRef.current, 'track:', !!localTrack);
            }
        };

        // Play local video immediately, even before connection
        playLocalVideo();
        // Play remote video when available
        playRemoteVideo();
    }, [visible, isVideoCall, engine, remoteUsers, isVideoEnabled]);

    // Reset played track refs when call ends or modal closes
    useEffect(() => {
        if (!visible || callState === 'idle' || callState === 'ended') {
            playedLocalTrackRef.current = null;
            playedRemoteUserRef.current = null;
        }
    }, [visible, callState]);

    const getStatusText = () => {
        if (error) return error;
        switch (callState) {
            case 'initiating': return 'Initiating call...';
            case 'ringing': return 'Ringing...';
            case 'connecting': return 'Connecting...';
            case 'connected': return formatDuration(callDuration);
            case 'ended': return 'Call ended';
            default: return '';
        }
    };

    if (!visible) return null;

    // Render incoming call UI
    if (isIncoming) {
        return (
            <Modal visible={visible} animationType="slide" transparent>
                <View style={styles.incomingContainer}>
                    <View style={styles.incomingContent}>
                        <Text style={styles.incomingLabel}>
                            Incoming {incomingCall?.callType === 'video' ? 'Video' : 'Voice'} Call
                        </Text>
                        <UserAvatar
                            uri={incomingAvatar}
                            name={incomingCall?.callerName || peerName}
                            style={styles.incomingAvatar}
                        />
                        <Text style={styles.incomingName}>{incomingCall?.callerName || peerName}</Text>
                        <View style={styles.pulseContainer}>
                            {incomingCall?.callType === 'video' ? (
                                <Video size={24} color="#22C55E" />
                            ) : (
                                <Phone size={24} color="#22C55E" />
                            )}
                        </View>
                    </View>
                    <View style={styles.incomingActions}>
                        <View style={styles.actionButtonWrap}>
                            <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
                                <PhoneOff size={32} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.actionLabel}>Decline</Text>
                        </View>
                        <View style={styles.actionButtonWrap}>
                            <TouchableOpacity style={styles.answerButton} onPress={onAnswer}>
                                {incomingCall?.callType === 'video' ? (
                                    <Video size={32} color="#FFFFFF" />
                                ) : (
                                    <Phone size={32} color="#FFFFFF" />
                                )}
                            </TouchableOpacity>
                            <Text style={styles.actionLabel}>Answer</Text>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    // Render active call UI
    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.container}>
                {isVideoCall ? (
                    <View style={styles.videoContainer}>
                        {/* Remote video - always render the div for video calls so it's ready when track arrives */}
                        <div
                            ref={remoteVideoRef}
                            style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: '#000',
                                display: remoteUsers.length > 0 ? 'block' : 'none'
                            }}
                        />
                        {/* Placeholder when no remote video yet */}
                        {remoteUsers.length === 0 && (
                            <View style={styles.videoPlaceholder}>
                                <UserAvatar uri={peerAvatar} name={peerName} style={styles.videoPlaceholderAvatar} />
                                <Text style={styles.videoPlaceholderName}>{peerName}</Text>
                                <Text style={styles.statusText}>{getStatusText()}</Text>
                            </View>
                        )}
                        {/* Local video - show whenever video is enabled (not just when connected) */}
                        {isVideoEnabled && (
                            <View style={styles.localVideoContainer}>
                                <div
                                    ref={localVideoRef}
                                    style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#333' }}
                                />
                            </View>
                        )}
                        {isConnecting && (
                            <View style={styles.statusOverlay}>
                                <Text style={styles.statusTextLarge}>{getStatusText()}</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.audioContainer}>
                        <View style={styles.audioContent}>
                            <UserAvatar uri={peerAvatar} name={peerName} style={styles.audioAvatar} />
                            <Text style={styles.audioName}>{peerName}</Text>
                            <Text style={styles.audioStatus}>{getStatusText()}</Text>
                            {isConnected && (
                                <View style={styles.waveformContainer}>
                                    {[20, 35, 45, 30, 25].map((height, i) => (
                                        <View key={i} style={[styles.waveformBar, { height }]} />
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                )}

                <View style={styles.controls}>
                    <View style={styles.controlsRow}>
                        <TouchableOpacity
                            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                            onPress={onToggleMute}
                        >
                            {isMuted ? (
                                <MicOff size={28} color="#EF4444" />
                            ) : (
                                <Mic size={28} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                        {isVideoCall && (
                            <TouchableOpacity
                                style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
                                onPress={onToggleVideo}
                            >
                                {isVideoEnabled ? (
                                    <Video size={28} color="#FFFFFF" />
                                ) : (
                                    <VideoOff size={28} color="#EF4444" />
                                )}
                            </TouchableOpacity>
                        )}
                        {!isVideoCall && (
                            <TouchableOpacity
                                style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                                onPress={onToggleSpeaker}
                            >
                                {isSpeakerOn ? (
                                    <Volume2 size={28} color="#FFFFFF" />
                                ) : (
                                    <VolumeX size={28} color="#FFFFFF" />
                                )}
                            </TouchableOpacity>
                        )}
                        {isVideoCall && (
                            <TouchableOpacity style={styles.controlButton} onPress={onSwitchCamera}>
                                <SwitchCamera size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity style={styles.hangupButton} onPress={onHangup}>
                        <PhoneOff size={36} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {error && (
                    <View style={styles.errorContainer}>
                        <AlertCircle size={20} color="#EF4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const createStyles = (colors: ReturnType<typeof import('../lib/theme').useTheme>['colors']) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: '#1A1A2E' },
        incomingContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'space-between', paddingVertical: 60 },
        incomingContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        incomingLabel: { fontSize: 18, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 32 },
        incomingAvatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#22C55E' },
        incomingName: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginTop: 24 },
        pulseContainer: { marginTop: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(34, 197, 94, 0.2)', justifyContent: 'center', alignItems: 'center' },
        incomingActions: { flexDirection: 'row', justifyContent: 'center', gap: 60, paddingBottom: 40 },
        actionButtonWrap: { alignItems: 'center' },
        declineButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
        answerButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center' },
        actionLabel: { color: '#FFFFFF', fontSize: 14, marginTop: 8 },
        videoContainer: { flex: 1, backgroundColor: '#000' },
        videoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' },
        videoPlaceholderAvatar: { width: 140, height: 140, borderRadius: 70, marginBottom: 16 },
        videoPlaceholderName: { fontSize: 24, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
        localVideoContainer: { position: 'absolute', top: 20, right: 20, width: 120, height: 160, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.3)' },
        statusOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        statusTextLarge: { fontSize: 20, color: '#FFFFFF', fontWeight: '500' },
        audioContainer: { flex: 1, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
        audioContent: { alignItems: 'center' },
        audioAvatar: { width: 160, height: 160, borderRadius: 80, marginBottom: 24, borderWidth: 4, borderColor: colors.primary },
        audioName: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
        audioStatus: { fontSize: 16, color: 'rgba(255, 255, 255, 0.7)' },
        waveformContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 32 },
        waveformBar: { width: 4, backgroundColor: colors.primary, borderRadius: 2 },
        statusText: { fontSize: 16, color: 'rgba(255, 255, 255, 0.7)', marginTop: 8 },
        controls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 24, paddingHorizontal: 20, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
        controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 24 },
        controlButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255, 255, 255, 0.15)', justifyContent: 'center', alignItems: 'center' },
        controlButtonActive: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
        hangupButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
        errorContainer: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, gap: 8 },
        errorText: { color: '#EF4444', fontSize: 14, flex: 1 },
    });

export default CallModal;
