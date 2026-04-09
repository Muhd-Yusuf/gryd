/**
 * Call Modal Component - Native Implementation
 * Full-screen modal for voice/video calls with real video rendering
 *
 * Uses RtcSurfaceView for remote video (full-screen, no z-order issues)
 * Uses RtcTextureView for local self-view (TextureView has no z-order issues on Android)
 *
 * Android SurfaceView renders on a separate layer and ignores View hierarchy z-ordering.
 * Two overlapping SurfaceViews will fight for rendering priority. TextureView doesn't
 * have this problem - it renders as a regular View and respects z-ordering.
 */

import React, { useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { Phone, Video, VideoOff, Mic, MicOff, PhoneOff, Volume2, VolumeX, SwitchCamera } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { CallState, CallType, IncomingCall, CallSession } from '../hooks';
import UserAvatar from './UserAvatar';

type AgoraModule = typeof import('react-native-agora');

let cachedModule: AgoraModule | null | undefined;

const getAgora = (): AgoraModule | null => {
    if (cachedModule !== undefined) return cachedModule;
    try {
        const mod: AgoraModule = require('react-native-agora');
        void mod.RtcSurfaceView;
        void mod.RtcTextureView;
        void mod.RenderModeType;
        cachedModule = mod;
        return mod;
    } catch {
        cachedModule = null;
        return null;
    }
};

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
    const agora = useMemo(() => getAgora(), []);

    const RtcSurfaceView = agora?.RtcSurfaceView as any;
    const RtcTextureView = agora?.RtcTextureView as any;
    const RenderModeType = agora?.RenderModeType as any;

    const isIncoming = !!incomingCall && callState === 'idle';
    const isConnecting = callState === 'initiating' || callState === 'ringing' || callState === 'connecting';
    const isConnected = callState === 'connected';
    const isVideoCall = callType === 'video';
    const hasRemoteVideo = remoteUsers.length > 0 && engine;
    const hasAgora = RtcSurfaceView && RtcTextureView && RenderModeType;

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

    // Incoming call UI
    if (isIncoming) {
        const incomingAvatar = incomingCall?.callerAvatar || peerAvatar || null;
        return (
            <Modal visible={visible} animationType="slide" statusBarTranslucent>
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
                    </View>
                    <View style={styles.incomingActions}>
                        <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
                            <PhoneOff size={32} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.answerButton} onPress={onAnswer}>
                            {incomingCall?.callType === 'video' ? (
                                <Video size={32} color="#FFFFFF" />
                            ) : (
                                <Phone size={32} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    // Active call UI
    return (
        <Modal visible={visible} animationType="fade" statusBarTranslucent>
            <View style={styles.container}>
                {isVideoCall ? (
                    <View style={styles.videoContainer}>
                        {/* REMOTE VIDEO (full-screen) - uses SurfaceView for best performance */}
                        {hasAgora && hasRemoteVideo ? (
                            <RtcSurfaceView
                                style={StyleSheet.absoluteFill}
                                canvas={{
                                    uid: remoteUsers[0],
                                    renderMode: RenderModeType.RenderModeFit,
                                }}
                            />
                        ) : (
                            <View style={styles.videoPlaceholder}>
                                <UserAvatar
                                    uri={peerAvatar}
                                    name={peerName}
                                    style={styles.videoPlaceholderAvatar}
                                />
                                <Text style={styles.videoPlaceholderName}>{peerName}</Text>
                                {isConnecting && <Text style={styles.connectingText}>{getStatusText()}</Text>}
                            </View>
                        )}

                        {/* LOCAL SELF-VIEW (small overlay) - uses TextureView to avoid z-order conflicts */}
                        <View style={styles.localVideoContainer}>
                            {hasAgora && engine && isVideoEnabled ? (
                                <>
                                    <RtcTextureView
                                        style={styles.localVideo}
                                        canvas={{
                                            uid: 0,
                                            renderMode: RenderModeType.RenderModeHidden,
                                        }}
                                    />
                                    <TouchableOpacity style={styles.switchCameraBtn} onPress={onSwitchCamera}>
                                        <SwitchCamera size={16} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <View style={styles.localVideoOff}>
                                    <VideoOff size={28} color="#FFFFFF" />
                                </View>
                            )}
                        </View>

                        {/* Duration */}
                        {isConnected && (
                            <View style={styles.durationOverlay}>
                                <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    /* Audio Call Layout */
                    <View style={styles.audioContainer}>
                        <View style={styles.audioContent}>
                            <UserAvatar uri={peerAvatar} name={peerName} style={styles.audioAvatar} />
                            <Text style={styles.audioName}>{peerName}</Text>
                            <Text style={styles.audioStatus}>{getStatusText()}</Text>
                        </View>
                    </View>
                )}

                {/* Error */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Controls */}
                <View style={styles.controlsContainer}>
                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                            onPress={onToggleMute}
                        >
                            {isMuted ? <MicOff size={28} color="#EF4444" /> : <Mic size={28} color="#FFFFFF" />}
                        </TouchableOpacity>

                        {isVideoCall && (
                            <TouchableOpacity
                                style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
                                onPress={onToggleVideo}
                            >
                                {isVideoEnabled ? <Video size={28} color="#FFFFFF" /> : <VideoOff size={28} color="#EF4444" />}
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.endCallButton} onPress={onHangup}>
                            <PhoneOff size={32} color="#FFFFFF" />
                        </TouchableOpacity>

                        {!isVideoCall && (
                            <TouchableOpacity
                                style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                                onPress={onToggleSpeaker}
                            >
                                {isSpeakerOn ? <Volume2 size={28} color="#FFFFFF" /> : <VolumeX size={28} color="#FFFFFF" />}
                            </TouchableOpacity>
                        )}

                        {isVideoCall && (
                            <TouchableOpacity style={styles.controlButton} onPress={onSwitchCamera}>
                                <SwitchCamera size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: ReturnType<typeof import('../lib/theme').useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#000000', // Call screen is intentionally pure black
        },

        // Incoming call
        incomingContainer: {
            flex: 1,
            backgroundColor: 'transparent',
            justifyContent: 'space-between',
            paddingVertical: 80,
        },
        incomingContent: {
            alignItems: 'center',
            gap: 24,
        },
        incomingLabel: {
            fontSize: 18,
            color: colors.textMuted,
        },
        incomingAvatar: {
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 4,
            borderColor: colors.glassBorder,
        },
        incomingName: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.text,
        },
        incomingActions: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 60,
        },
        declineButton: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#EF4444',
            alignItems: 'center',
            justifyContent: 'center',
        },
        answerButton: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#22C55E',
            alignItems: 'center',
            justifyContent: 'center',
        },

        // Video call
        videoContainer: {
            flex: 1,
            backgroundColor: '#000000',
        },
        videoPlaceholder: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.glassBg,
        },
        videoPlaceholderAvatar: {
            width: 140,
            height: 140,
            borderRadius: 70,
            marginBottom: 20,
            borderWidth: 3,
            borderColor: colors.glassBorder,
        },
        videoPlaceholderName: {
            fontSize: 24,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        connectingText: {
            fontSize: 16,
            color: colors.textMuted,
        },

        // Local self-view - elevated above remote SurfaceView
        localVideoContainer: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 60 : 40,
            right: 20,
            width: 120,
            height: 160,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.3)',
            elevation: 10, // Android: ensure above SurfaceView
            zIndex: 10,
        },
        localVideo: {
            flex: 1,
        },
        localVideoOff: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)',
        },
        switchCameraBtn: {
            position: 'absolute',
            bottom: 6,
            right: 6,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
        },

        durationOverlay: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 60 : 40,
            left: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 20,
            zIndex: 10,
        },
        durationText: {
            fontSize: 16,
            fontWeight: '600',
            color: '#FFFFFF',
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },

        // Audio call
        audioContainer: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        audioContent: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
        },
        audioAvatar: {
            width: 180,
            height: 180,
            borderRadius: 90,
            borderWidth: 4,
            borderColor: colors.glassBorder,
            marginBottom: 20,
        },
        audioName: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.text,
        },
        audioStatus: {
            fontSize: 18,
            color: colors.textMuted,
        },

        // Error
        errorContainer: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 100 : 80,
            left: 20,
            right: 20,
            padding: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.9)',
            borderRadius: 12,
            zIndex: 20,
        },
        errorText: {
            fontSize: 14,
            color: '#FFFFFF',
            textAlign: 'center',
        },

        // Controls
        controlsContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: Platform.OS === 'ios' ? 40 : 30,
            paddingTop: 20,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 20,
        },
        controls: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 24,
        },
        controlButton: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        controlButtonActive: {
            backgroundColor: 'rgba(255,255,255,0.35)',
        },
        endCallButton: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#EF4444',
            alignItems: 'center',
            justifyContent: 'center',
        },
    });

export default CallModal;
