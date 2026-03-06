/**
 * Agora Call Hook - Main Entry Point
 *
 * This file is used for NATIVE builds (APK/IPA) where react-native-agora is available.
 * For web platform, Metro automatically loads useAgoraCall.web.ts instead.
 *
 * In native builds, react-native-agora is linked and available.
 * The native implementation uses the full Agora SDK for voice/video calls.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import type { IRtcEngine } from 'react-native-agora';
import {
    initiateDMCall,
    answerCall as apiAnswerCall,
    declineCall as apiDeclineCall,
    endCall as apiEndCall,
    refreshCallToken,
} from '../lib/api';

export type CallState = 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallType = 'audio' | 'video';

export interface CallParticipant {
    odId: string;
    agoraUid: number;
    name?: string;
    avatar?: string;
    isSelf?: boolean;
    isVideoEnabled?: boolean;
    isAudioEnabled?: boolean;
}

export interface IncomingCall {
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: CallType;
    channelName: string;
    token: string;
    uid: number;
    appId: string;
}

export interface CallSession {
    callId: string;
    channelName: string;
    callType: CallType;
    token: string;
    uid: number;
    appId: string;
    participants: CallParticipant[];
    duration: number;
}

interface UseAgoraCallOptions {
    onCallEnded?: (callId: string, reason: string) => void;
    onError?: (error: Error) => void;
    // Auto-join params for voice channels (pre-existing credentials)
    channelName?: string;
    token?: string;
    uid?: number;
    appId?: string;
    callId?: string;
    autoJoin?: boolean;
}

type AgoraModule = typeof import('react-native-agora');

let cachedAgoraModule: AgoraModule | null | undefined;

const getAgoraModule = (): AgoraModule | null => {
    if (cachedAgoraModule !== undefined) {
        return cachedAgoraModule;
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod: AgoraModule = require('react-native-agora');

        // Touch an export to eagerly surface the common "not linked" Proxy error.
        // If this throws, we'll treat Agora as unavailable (e.g., Expo Go).
        void mod.createAgoraRtcEngine;

        cachedAgoraModule = mod;
        return cachedAgoraModule;
    } catch {
        cachedAgoraModule = null;
        return null;
    }
};

const getAgoraUnavailableMessage = () =>
    "Calls aren't available in Expo Go. Use a development build / standalone build (or reinstall + rebuild native dependencies).";

// Request permissions for Android
const requestAndroidPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
        const permissions: string[] = [
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
        ];

        // Add Bluetooth permission for Android 12+
        if (Platform.Version >= 31) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
        }

        const results = await PermissionsAndroid.requestMultiple(
            permissions as Array<(typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]>
        );

        const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        const cameraGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;

        if (!audioGranted) {
            Alert.alert('Permission Required', 'Microphone permission is required for calls.');
            return false;
        }

        if (!cameraGranted) {
            console.warn('[Agora Native] Camera permission denied - video calls will be audio only');
        }

        return audioGranted;
    } catch (err) {
        console.error('[Agora Native] Permission request failed:', err);
        return false;
    }
};

export const useAgoraCall = (options: UseAgoraCallOptions = {}) => {
    const [callState, setCallState] = useState<CallState>('idle');
    const [callType, setCallType] = useState<CallType>('audio');
    const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);

    const engineRef = useRef<IRtcEngine | null>(null);
    const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const callStateRef = useRef<CallState>('idle');
    const currentCallRef = useRef<CallSession | null>(null);
    const isInitializedRef = useRef(false);
    const eventHandlerRef = useRef<any>(null);

    // Keep refs in sync with state
    useEffect(() => {
        callStateRef.current = callState;
    }, [callState]);

    useEffect(() => {
        currentCallRef.current = currentCall;
    }, [currentCall]);

    // Start duration timer
    const startDurationTimer = useCallback(() => {
        if (durationTimerRef.current) return;
        durationTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    }, []);

    // Stop duration timer
    const stopDurationTimer = useCallback(() => {
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
    }, []);

    // Handle token refresh
    const handleTokenRefresh = useCallback(async () => {
        if (!currentCallRef.current || !engineRef.current) return;
        try {
            const response = await refreshCallToken(currentCallRef.current.channelName);
            if (response.success) {
                engineRef.current.renewToken(response.data.token);
            }
        } catch (err) {
            console.error('[Agora Native] Token refresh failed:', err);
        }
    }, []);

    // Initialize Agora engine
    const initEngine = useCallback(async (appId: string): Promise<IRtcEngine> => {
        const agora = getAgoraModule();
        if (!agora) {
            const message = getAgoraUnavailableMessage();
            setError(message);
            throw new Error(message);
        }

        if (engineRef.current && isInitializedRef.current) {
            return engineRef.current;
        }

        try {
            const engine = agora.createAgoraRtcEngine();

            // Initialize with app ID first
            engine.initialize({
                appId,
                channelProfile: agora.ChannelProfileType.ChannelProfileCommunication,
            });

            // Create event handler object
            eventHandlerRef.current = {
                onJoinChannelSuccess: (connection: any, elapsed: number) => {
                    console.log('[Agora Native] Joined channel:', connection.channelId, 'uid:', connection.localUid);
                },
                onUserJoined: (connection: any, remoteUid: number, elapsed: number) => {
                    console.log('[Agora Native] Remote user joined:', remoteUid);
                    setRemoteUsers(prev => {
                        if (prev.includes(remoteUid)) return prev;
                        return [...prev, remoteUid];
                    });
                    // Transition to connected when remote user joins
                    if (callStateRef.current === 'ringing' || callStateRef.current === 'connecting') {
                        setCallState('connected');
                        startDurationTimer();
                    }
                },
                onUserOffline: (connection: any, remoteUid: number, reason: number) => {
                    console.log('[Agora Native] Remote user left:', remoteUid, 'reason:', reason);
                    setRemoteUsers(prev => {
                        const newUsers = prev.filter(uid => uid !== remoteUid);
                        // If no remote users left and we were connected, end the call
                        if (newUsers.length === 0 && callStateRef.current === 'connected') {
                            setTimeout(() => setCallState('ended'), 0);
                        }
                        return newUsers;
                    });
                },
                onError: (err: number, msg: string) => {
                    console.error('[Agora Native] Error:', err, msg);
                    setError(`Agora error: ${msg}`);
                    options.onError?.(new Error(msg));
                },
                onTokenPrivilegeWillExpire: (connection: any, token: string) => {
                    console.log('[Agora Native] Token will expire, refreshing...');
                    handleTokenRefresh();
                },
                onConnectionStateChanged: (connection: any, state: number, reason: number) => {
                    console.log('[Agora Native] Connection state changed:', state, 'reason:', reason);
                },
            };

            // Register event handler
            engine.registerEventHandler(eventHandlerRef.current);

            // Enable audio
            engine.enableAudio();
            engine.setDefaultAudioRouteToSpeakerphone(true);

            engineRef.current = engine;
            isInitializedRef.current = true;

            console.log('[Agora Native] Engine initialized successfully');
            return engine;
        } catch (err: any) {
            console.error('[Agora Native] Failed to initialize engine:', err);
            setError(err.message);
            throw err;
        }
    }, [options, startDurationTimer, handleTokenRefresh]);

    // Enable video for video calls
    const enableVideo = useCallback(async (engine: IRtcEngine) => {
        try {
            engine.enableVideo();
            engine.startPreview();
            setIsVideoEnabled(true);
        } catch (err: any) {
            console.error('[Agora Native] Failed to enable video:', err);
            setIsVideoEnabled(false);
        }
    }, []);

    // Cleanup engine
    const cleanupEngine = useCallback(async () => {
        if (engineRef.current) {
            try {
                if (eventHandlerRef.current) {
                    engineRef.current.unregisterEventHandler(eventHandlerRef.current);
                }
                engineRef.current.leaveChannel();
                engineRef.current.release();
            } catch (err) {
                console.error('[Agora Native] Cleanup error:', err);
            }
            engineRef.current = null;
            eventHandlerRef.current = null;
            isInitializedRef.current = false;
        }
    }, []);

    // Start a call
    const startCall = useCallback(async (calleeId: string, type: CallType = 'audio', subgridId?: string) => {
        try {
            const agora = getAgoraModule();
            if (!agora) {
                const message = getAgoraUnavailableMessage();
                setError(message);
                Alert.alert('Calls Unavailable', message);
                return null;
            }

            // Request permissions first
            const hasPermission = await requestAndroidPermissions();
            if (!hasPermission) {
                setError('Microphone permission required for calls');
                options.onError?.(new Error('Microphone permission required'));
                return null;
            }

            setError(null);
            setCallState('initiating');
            setCallType(type);
            setCallDuration(0);

            // Call API to initiate
            const response = await initiateDMCall(calleeId, type, subgridId);
            if (!response.success) {
                setError(response.error || 'Failed to initiate call');
                setCallState('idle');
                options.onError?.(new Error(response.error || 'Failed to initiate call'));
                return null;
            }

            const { callId, channelName, caller } = response.data;
            const { token, uid, appId } = caller;

            // Initialize engine
            const engine = await initEngine(appId);

            // Enable video if video call
            if (type === 'video') {
                await enableVideo(engine);
            }

            // Set client role
            engine.setClientRole(agora.ClientRoleType.ClientRoleBroadcaster);

            // Join channel
            console.log('[Agora Native] Joining channel:', channelName, 'uid:', uid);
            engine.joinChannel(token, channelName, uid, {
                clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
                publishMicrophoneTrack: true,
                publishCameraTrack: type === 'video',
                autoSubscribeAudio: true,
                autoSubscribeVideo: true,
            });

            setCurrentCall({
                callId,
                channelName,
                callType: type,
                token,
                uid,
                appId,
                participants: [],
                duration: 0,
            });

            setCallState('ringing');
            return response.data;
        } catch (err: any) {
            console.error('[Agora Native] Start call failed:', err);
            setError(err.message);
            setCallState('idle');
            await cleanupEngine();
            options.onError?.(err);
            return null;
        }
    }, [initEngine, enableVideo, cleanupEngine, options]);

    // Answer incoming call
    const answer = useCallback(async (callId: string, callTypeArg?: CallType) => {
        try {
            const agora = getAgoraModule();
            if (!agora) {
                const message = getAgoraUnavailableMessage();
                setError(message);
                Alert.alert('Calls Unavailable', message);
                return null;
            }

            // Request permissions first
            const hasPermission = await requestAndroidPermissions();
            if (!hasPermission) {
                setError('Microphone permission required for calls');
                return null;
            }

            setError(null);
            setCallState('connecting');
            const type = callTypeArg || 'audio';
            setCallType(type);
            setCallDuration(0);

            const response = await apiAnswerCall(callId);
            if (!response.success) {
                setError(response.error || 'Failed to answer call');
                setCallState('idle');
                return null;
            }

            const { channelName, token, uid, appId } = response.data;

            // Initialize engine
            const engine = await initEngine(appId);

            // Enable video if video call
            if (type === 'video') {
                await enableVideo(engine);
            }

            // Set client role
            engine.setClientRole(agora.ClientRoleType.ClientRoleBroadcaster);

            // Join channel
            console.log('[Agora Native] Answering - joining channel:', channelName, 'uid:', uid);
            engine.joinChannel(token, channelName, uid, {
                clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
                publishMicrophoneTrack: true,
                publishCameraTrack: type === 'video',
                autoSubscribeAudio: true,
                autoSubscribeVideo: true,
            });

            setCurrentCall({
                callId,
                channelName,
                callType: type,
                token,
                uid,
                appId,
                participants: [],
                duration: 0,
            });

            setCallState('connected');
            startDurationTimer();
            return response.data;
        } catch (err: any) {
            console.error('[Agora Native] Answer call failed:', err);
            setError(err.message);
            setCallState('idle');
            await cleanupEngine();
            options.onError?.(err);
            return null;
        }
    }, [initEngine, enableVideo, cleanupEngine, startDurationTimer, options]);

    // Decline incoming call
    const decline = useCallback(async (callId: string) => {
        try {
            await apiDeclineCall(callId);
        } catch (err: any) {
            console.error('[Agora Native] Decline call failed:', err);
        }
    }, []);

    // End current call
    const hangup = useCallback(async () => {
        try {
            if (currentCall) {
                await apiEndCall(currentCall.callId);
            }

            // Leave channel and cleanup
            if (engineRef.current) {
                engineRef.current.leaveChannel();
            }

            setCallState('ended');
            setCurrentCall(null);
            setRemoteUsers([]);
            stopDurationTimer();

            if (currentCall) {
                options.onCallEnded?.(currentCall.callId, 'user_ended');
            }
        } catch (err: any) {
            console.error('[Agora Native] Hangup failed:', err);
        }
    }, [currentCall, stopDurationTimer, options]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (engineRef.current) {
            const newMuted = !isMuted;
            engineRef.current.muteLocalAudioStream(newMuted);
            setIsMuted(newMuted);
        }
    }, [isMuted]);

    // Toggle video
    const toggleVideo = useCallback(() => {
        if (engineRef.current) {
            const newVideoEnabled = !isVideoEnabled;
            engineRef.current.muteLocalVideoStream(!newVideoEnabled);
            setIsVideoEnabled(newVideoEnabled);
        }
    }, [isVideoEnabled]);

    // Toggle speaker
    const toggleSpeaker = useCallback(() => {
        if (engineRef.current) {
            const newSpeakerOn = !isSpeakerOn;
            engineRef.current.setEnableSpeakerphone(newSpeakerOn);
            setIsSpeakerOn(newSpeakerOn);
        }
    }, [isSpeakerOn]);

    // Switch camera
    const switchCamera = useCallback(() => {
        if (engineRef.current) {
            engineRef.current.switchCamera();
        }
    }, []);

    // Cleanup when call ends
    useEffect(() => {
        if (callState === 'ended') {
            const callId = currentCallRef.current?.callId;

            // Stop duration timer
            stopDurationTimer();

            // Clear state
            setCurrentCall(null);
            setRemoteUsers([]);

            // Call the onCallEnded callback if we have a callId
            if (callId) {
                options.onCallEnded?.(callId, 'remote_ended');
            }

            // Reset to idle after a short delay
            setTimeout(() => {
                setCallState('idle');
            }, 1500);
        }
    }, [callState, stopDurationTimer, options]);

    // Auto-join for voice channels (pre-existing credentials)
    useEffect(() => {
        if (!options.autoJoin || !options.channelName || !options.token || !options.appId) return;
        if (callStateRef.current !== 'idle') return;

        const joinAsync = async () => {
            const agora = getAgoraModule();
            if (!agora) {
                const message = getAgoraUnavailableMessage();
                setError(message);
                return;
            }

            const hasPermission = await requestAndroidPermissions();
            if (!hasPermission) {
                setError('Microphone permission required');
                return;
            }

            try {
                setCallState('connecting');
                setError(null);
                setCallDuration(0);

                const engine = await initEngine(options.appId!);
                engine.setClientRole(agora.ClientRoleType.ClientRoleBroadcaster);

                console.log('[Agora Native] Auto-joining voice channel:', options.channelName, 'uid:', options.uid);
                engine.joinChannel(options.token!, options.channelName!, options.uid || 0, {
                    clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
                    publishMicrophoneTrack: true,
                    publishCameraTrack: false,
                    autoSubscribeAudio: true,
                    autoSubscribeVideo: false,
                });

                setCurrentCall({
                    callId: options.callId || '',
                    channelName: options.channelName!,
                    callType: 'audio',
                    token: options.token!,
                    uid: options.uid || 0,
                    appId: options.appId!,
                    participants: [],
                    duration: 0,
                });

                setCallState('connected');
                startDurationTimer();
            } catch (err: any) {
                console.error('[Agora Native] Auto-join failed:', err);
                setError(err.message);
                setCallState('idle');
                options.onError?.(err);
            }
        };

        joinAsync();
    }, [options.autoJoin, options.channelName, options.token, options.appId, options.uid, options.callId, initEngine, startDurationTimer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupEngine();
            stopDurationTimer();
        };
    }, [cleanupEngine, stopDurationTimer]);

    // Engine reference for video rendering
    const engine = useMemo(() => engineRef.current, [currentCall, remoteUsers]);

    return {
        // State
        callState,
        callType,
        currentCall,
        isMuted,
        isVideoEnabled,
        isSpeakerOn,
        remoteUsers,
        error,
        callDuration,

        // Actions
        startCall,
        answer,
        decline,
        hangup,
        toggleMute,
        toggleVideo,
        toggleSpeaker,
        switchCamera,

        // Engine reference for video rendering
        engine: engineRef.current,
    };
};

export default useAgoraCall;
