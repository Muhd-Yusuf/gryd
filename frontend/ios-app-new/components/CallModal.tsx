/**
 * Call Modal Component
 * Full-screen modal for voice/video calls
 * Note: This file is for native platforms. Web uses CallModal.web.tsx
 */

// Debug log to track which file is being loaded
console.log('[CallModal] Loading NATIVE implementation (CallModal.tsx)');

import React, { useEffect, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';

// Log warning if native file is loaded on web
if (Platform.OS === 'web') {
    console.warn('[CallModal] WARNING: Web platform is loading native CallModal! This will crash due to react-native-agora import.');
}

import { MaterialIcons } from '@expo/vector-icons';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';
import { useTheme } from '../lib/theme';
import { CallState, CallType, IncomingCall, CallSession } from '../hooks';
import UserAvatar from './UserAvatar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

    const isIncoming = !!incomingCall && callState === 'idle';
    const isConnecting = callState === 'initiating' || callState === 'ringing' || callState === 'connecting';
    const isConnected = callState === 'connected';
    const isVideoCall = callType === 'video';
    const incomingAvatar = incomingCall?.callerAvatar || peerAvatar || null;

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

    // Render incoming call UI
    if (isIncoming) {
        return (
            <Modal visible={visible} animationType="slide" statusBarTranslucent>
                <View style={styles.incomingContainer}>
                    <View style={styles.incomingContent}>
                        <Text style={styles.incomingLabel}>Incoming {incomingCall?.callType === 'video' ? 'Video' : 'Voice'} Call</Text>
                        <UserAvatar
                            uri={incomingAvatar}
                            name={incomingCall?.callerName || peerName}
                            style={styles.incomingAvatar}
                        />
                        <Text style={styles.incomingName}>{incomingCall?.callerName || peerName}</Text>
                    </View>
                    <View style={styles.incomingActions}>
                        <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
                            <MaterialIcons name="call-end" size={32} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.answerButton} onPress={onAnswer}>
                            <MaterialIcons name={incomingCall?.callType === 'video' ? 'videocam' : 'call'} size={32} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    // Render active call UI
    return (
        <Modal visible={visible} animationType="fade" statusBarTranslucent>
            <View style={styles.container}>
                {/* Video Call Layout */}
                {isVideoCall ? (
                    <View style={styles.videoContainer}>
                        {/* Remote video (full screen) */}
                        {remoteUsers.length > 0 && engine && RtcSurfaceView && VideoSourceType ? (
                            <RtcSurfaceView
                                style={styles.remoteVideo}
                                canvas={{
                                    uid: remoteUsers[0],
                                    sourceType: VideoSourceType.VideoSourceRemote,
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
                                {Platform.OS === 'web' && isConnected && (
                                    <Text style={styles.connectingText}>Video calls not supported on web</Text>
                                )}
                            </View>
                        )}

                        {/* Local video (picture-in-picture) */}
                        {isVideoEnabled && engine && RtcSurfaceView && VideoSourceType ? (
                            <View style={styles.localVideoContainer}>
                                <RtcSurfaceView
                                    style={styles.localVideo}
                                    canvas={{
                                        uid: 0,
                                        sourceType: VideoSourceType.VideoSourceCamera,
                                    }}
                                />
                                <TouchableOpacity style={styles.switchCameraButton} onPress={onSwitchCamera}>
                                    <MaterialIcons name="flip-camera-ios" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={[styles.localVideoContainer, styles.localVideoDisabled]}>
                                <MaterialIcons name="videocam-off" size={32} color="#FFFFFF" />
                            </View>
                        )}

                        {/* Duration overlay */}
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
                            <UserAvatar
                                uri={peerAvatar}
                                name={peerName}
                                style={styles.audioAvatar}
                            />
                            <Text style={styles.audioName}>{peerName}</Text>
                            <Text style={styles.audioStatus}>{getStatusText()}</Text>
                        </View>
                    </View>
                )}

                {/* Error display */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Call controls */}
                <View style={styles.controlsContainer}>
                    <View style={styles.controls}>
                        {/* Mute button */}
                        <TouchableOpacity
                            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                            onPress={onToggleMute}
                        >
                            <MaterialIcons
                                name={isMuted ? 'mic-off' : 'mic'}
                                size={28}
                                color={isMuted ? '#EF4444' : '#FFFFFF'}
                            />
                        </TouchableOpacity>

                        {/* Video toggle (only for video calls) */}
                        {isVideoCall && (
                            <TouchableOpacity
                                style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
                                onPress={onToggleVideo}
                            >
                                <MaterialIcons
                                    name={isVideoEnabled ? 'videocam' : 'videocam-off'}
                                    size={28}
                                    color={!isVideoEnabled ? '#EF4444' : '#FFFFFF'}
                                />
                            </TouchableOpacity>
                        )}

                        {/* End call button */}
                        <TouchableOpacity style={styles.endCallButton} onPress={onHangup}>
                            <MaterialIcons name="call-end" size={32} color="#FFFFFF" />
                        </TouchableOpacity>

                        {/* Speaker button (audio calls) */}
                        {!isVideoCall && (
                            <TouchableOpacity
                                style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                                onPress={onToggleSpeaker}
                            >
                                <MaterialIcons
                                    name={isSpeakerOn ? 'volume-up' : 'volume-off'}
                                    size={28}
                                    color="#FFFFFF"
                                />
                            </TouchableOpacity>
                        )}

                        {/* Switch camera (video calls) */}
                        {isVideoCall && (
                            <TouchableOpacity style={styles.controlButton} onPress={onSwitchCamera}>
                                <MaterialIcons name="flip-camera-ios" size={28} color="#FFFFFF" />
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
            backgroundColor: colors.appBg,
        },

        // Incoming call styles
        incomingContainer: {
            flex: 1,
            backgroundColor: colors.appBg,
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
            borderColor: colors.border,
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

        // Video call styles
        videoContainer: {
            flex: 1,
            backgroundColor: '#000000',
        },
        remoteVideo: {
            flex: 1,
        },
        videoPlaceholder: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
        },
        videoPlaceholderAvatar: {
            width: 140,
            height: 140,
            borderRadius: 70,
            marginBottom: 20,
            borderWidth: 3,
            borderColor: colors.border,
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
        localVideoContainer: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 60 : 40,
            right: 20,
            width: 120,
            height: 160,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: colors.surfaceMuted,
            borderWidth: 2,
            borderColor: colors.border,
        },
        localVideo: {
            flex: 1,
        },
        localVideoDisabled: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        switchCameraButton: {
            position: 'absolute',
            bottom: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        durationOverlay: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 60 : 40,
            left: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 20,
        },
        durationText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },

        // Audio call styles
        audioContainer: {
            flex: 1,
            backgroundColor: colors.appBg,
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
            borderColor: colors.border,
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

        // Error styles
        errorContainer: {
            position: 'absolute',
            top: Platform.OS === 'ios' ? 100 : 80,
            left: 20,
            right: 20,
            padding: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.9)',
            borderRadius: 12,
        },
        errorText: {
            fontSize: 14,
            color: '#FFFFFF',
            textAlign: 'center',
        },

        // Controls styles
        controlsContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: Platform.OS === 'ios' ? 40 : 30,
            paddingTop: 20,
            backgroundColor: 'rgba(0,0,0,0.6)',
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
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        controlButtonActive: {
            backgroundColor: colors.surface,
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
