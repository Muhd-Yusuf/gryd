/**
 * Agora Call Hook - Web Implementation
 * Uses Agora Web SDK for browser-based voice/video calls
 */

// Debug log to track which file is being loaded
console.log('[useAgoraCall.web] Loading WEB implementation (useAgoraCall.web.ts)');

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AgoraRTC, {
    IAgoraRTCClient,
    IAgoraRTCRemoteUser,
    IMicrophoneAudioTrack,
    ICameraVideoTrack,
    UID,
} from 'agora-rtc-sdk-ng';
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
}

export const useAgoraCall = (options: UseAgoraCallOptions = {}) => {
    const [callState, setCallStateInternal] = useState<CallState>('idle');
    // Simplified setCallState wrapper
    const setCallState = useCallback((newState: CallState | ((prev: CallState) => CallState)) => {
        setCallStateInternal(newState);
    }, []);
    const [callType, setCallType] = useState<CallType>('audio');
    const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);
    // State for tracks to trigger re-renders when tracks are created
    const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
    const [client, setClient] = useState<IAgoraRTCClient | null>(null);

    const clientRef = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
    const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
    const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
    const callStateRef = useRef<CallState>('idle');
    const startDurationTimerRef = useRef<(() => void) | null>(null);

    // Keep callStateRef in sync
    callStateRef.current = callState;

    // Initialize Agora client
    const initClient = useCallback(async () => {
        // If client exists and is connected, leave first to avoid UID_CONFLICT
        if (clientRef.current) {
            try {
                if (clientRef.current.connectionState === 'CONNECTED' ||
                    clientRef.current.connectionState === 'CONNECTING') {
                    await clientRef.current.leave();
                }
            } catch (e) {}
            return clientRef.current;
        }

        try {
            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

            // Set up event listeners
            client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
                await client.subscribe(user, mediaType);

                if (mediaType === 'audio') {
                    user.audioTrack?.play();
                }
                if (mediaType === 'video') {
                    // Trigger re-render so CallModal can play the video track
                    setRemoteUsers(prev => [...prev]);
                }
            });

            client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
                // User unpublished their track
            });

            client.on('user-joined', (user: IAgoraRTCRemoteUser) => {
                console.log('[Agora Web] user-joined event:', user.uid, 'current state:', callStateRef.current);
                setRemoteUsers(prev => [...prev.filter(uid => uid !== user.uid), user.uid as number]);
                // Transition from 'ringing' or 'connecting' to 'connected' when the other user joins
                if (callStateRef.current === 'ringing' || callStateRef.current === 'connecting') {
                    console.log('[Agora Web] Transitioning to connected state');
                    setCallState('connected');
                    startDurationTimerRef.current?.();
                }
            });

            client.on('user-left', (user: IAgoraRTCRemoteUser, reason?: string) => {
                setRemoteUsers(prev => {
                    const newUsers = prev.filter(uid => uid !== user.uid);
                    // If no remote users left and we were connected, end the call
                    // This handles the case where the other party hangs up
                    if (newUsers.length === 0 && callStateRef.current === 'connected') {
                        // Use setTimeout to avoid state update during render
                        setTimeout(() => {
                            setCallState('ended');
                        }, 0);
                    }
                    return newUsers;
                });
            });

            client.on('connection-state-change', (curState: string, prevState: string, reason?: string) => {
                console.log('[Agora Web] Connection state changed:', prevState, '->', curState, 'reason:', reason);
            });

            client.on('token-privilege-will-expire', async () => {
                await handleTokenRefresh();
            });

            client.on('token-privilege-did-expire', async () => {
                setError('Call token expired');
            });

            clientRef.current = client;
            setClient(client); // Update state to trigger re-renders
            return client;
        } catch (err: any) {
            console.error('[Agora Web] Failed to initialize client:', err);
            setError(err.message);
            throw err;
        }
    }, []);

    // Start duration timer
    const startDurationTimer = useCallback(() => {
        if (durationTimerRef.current) return;
        durationTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    }, []);

    // Keep ref in sync for use in event handlers
    startDurationTimerRef.current = startDurationTimer;

    // Stop duration timer
    const stopDurationTimer = useCallback(() => {
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
    }, []);

    // Handle token refresh
    const handleTokenRefresh = useCallback(async () => {
        if (!currentCall || !clientRef.current) return;
        try {
            const response = await refreshCallToken(currentCall.channelName);
            if (response.success) {
                await clientRef.current.renewToken(response.data.token);
            }
        } catch (err) {
            console.error('[Agora Web] Token refresh failed:', err);
        }
    }, [currentCall]);

    // Create local tracks
    const createLocalTracks = useCallback(async (type: CallType) => {
        try {
            // Clean up any existing tracks first to release camera/microphone
            if (localAudioTrackRef.current) {
                try {
                    localAudioTrackRef.current.stop();
                    localAudioTrackRef.current.close();
                } catch (e) {}
                localAudioTrackRef.current = null;
            }
            if (localVideoTrackRef.current) {
                try {
                    localVideoTrackRef.current.stop();
                    localVideoTrackRef.current.close();
                } catch (e) {}
                localVideoTrackRef.current = null;
                setLocalVideoTrack(null);
            }

            // Create audio track
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            localAudioTrackRef.current = audioTrack;

            // Create video track if video call
            let videoTrack = null;
            if (type === 'video') {
                try {
                    videoTrack = await AgoraRTC.createCameraVideoTrack({
                        encoderConfig: '480p_1',
                    });
                    localVideoTrackRef.current = videoTrack;
                    setLocalVideoTrack(videoTrack);
                    setIsVideoEnabled(true);
                } catch (videoErr: any) {
                    console.error('[Agora Web] Failed to create video track:', videoErr);
                    setIsVideoEnabled(false);
                    setLocalVideoTrack(null);
                    setError(`Video unavailable: ${videoErr?.message || 'Camera access denied'}`);
                }
            }

            return { audioTrack, videoTrack: localVideoTrackRef.current };
        } catch (err: any) {
            console.error('[Agora Web] Failed to create local tracks:', err);
            throw err;
        }
    }, []);

    // Clean up local tracks
    const cleanupLocalTracks = useCallback(() => {
        if (localAudioTrackRef.current) {
            localAudioTrackRef.current.stop();
            localAudioTrackRef.current.close();
            localAudioTrackRef.current = null;
        }
        if (localVideoTrackRef.current) {
            localVideoTrackRef.current.stop();
            localVideoTrackRef.current.close();
            localVideoTrackRef.current = null;
        }
        setLocalVideoTrack(null); // Reset state
    }, []);

    // Start a DM call
    const startCall = useCallback(async (calleeId: string, type: CallType = 'audio', subgridId?: string) => {
        try {
            setError(null);
            setCallState('initiating');
            setCallType(type);
            setCallDuration(0);

            const response = await initiateDMCall(calleeId, type, subgridId);
            if (!response.success) {
                setError(response.error || 'Failed to initiate call');
                setCallState('idle');
                options.onError?.(new Error(response.error || 'Failed to initiate call'));
                return null;
            }

            const { callId, channelName, caller } = response.data;
            const { token, uid, appId } = caller;

            // Initialize client and create tracks
            const client = await initClient();
            const { audioTrack, videoTrack } = await createLocalTracks(type);

            // Join channel
            console.log('[Agora Web] Joining channel:', channelName, 'with uid:', uid);
            await client.join(appId, channelName, token, uid);
            console.log('[Agora Web] Joined channel successfully');

            // Publish tracks
            const tracksToPublish = [audioTrack];
            if (videoTrack) {
                tracksToPublish.push(videoTrack);
            }
            console.log('[Agora Web] Publishing tracks:', tracksToPublish.length);
            await client.publish(tracksToPublish);
            console.log('[Agora Web] Tracks published successfully');

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

            console.log('[Agora Web] Call initiated, setting state to ringing');
            setCallState('ringing');

            // Check if there are already remote users in the channel (they joined before us)
            const existingRemoteUsers = client.remoteUsers || [];
            if (existingRemoteUsers.length > 0) {
                console.log('[Agora Web] Found existing remote users:', existingRemoteUsers.length);
                setRemoteUsers(existingRemoteUsers.map(u => u.uid as number));
                setCallState('connected');
                startDurationTimer();
            }

            return response.data;
        } catch (err: any) {
            console.error('[Agora Web] Start call failed:', err);
            setError(err.message);
            setCallState('idle');
            cleanupLocalTracks();
            options.onError?.(err);
            return null;
        }
    }, [initClient, createLocalTracks, cleanupLocalTracks, options]);

    // Answer incoming call (callId and callType passed from CallContext)
    const answer = useCallback(async (callId: string, callTypeArg?: CallType) => {
        try {
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

            // Initialize client and create tracks
            const client = await initClient();
            const { audioTrack, videoTrack } = await createLocalTracks(type);

            // Join channel
            await client.join(appId, channelName, token, uid);

            // Publish tracks
            const tracksToPublish = [audioTrack];
            if (videoTrack) {
                tracksToPublish.push(videoTrack);
            }
            await client.publish(tracksToPublish);

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
            console.error('[Agora Web] Answer call failed:', err);
            setError(err.message);
            setCallState('idle');
            cleanupLocalTracks();
            options.onError?.(err);
            return null;
        }
    }, [initClient, createLocalTracks, cleanupLocalTracks, startDurationTimer, options]);

    // Decline incoming call
    const decline = useCallback(async (callId: string) => {
        try {
            await apiDeclineCall(callId);
        } catch (err: any) {
            console.error('[Agora Web] Decline call failed:', err);
        }
    }, []);

    // End current call
    const hangup = useCallback(async () => {
        try {
            if (currentCall) {
                await apiEndCall(currentCall.callId);
            }

            // Leave channel
            if (clientRef.current) {
                await clientRef.current.leave();
            }

            // Clean up tracks
            cleanupLocalTracks();

            setCallState('ended');
            setCurrentCall(null);
            setRemoteUsers([]);
            stopDurationTimer();

            if (currentCall) {
                options.onCallEnded?.(currentCall.callId, 'user_ended');
            }
        } catch (err: any) {
            console.error('[Agora Web] Hangup failed:', err);
        }
    }, [currentCall, cleanupLocalTracks, stopDurationTimer, options]);

    // Toggle mute
    const toggleMute = useCallback(async () => {
        if (localAudioTrackRef.current) {
            const newMuted = !isMuted;
            try {
                await localAudioTrackRef.current.setEnabled(!newMuted);
                setIsMuted(newMuted);
            } catch (err) {
                console.error('[Agora Web] Failed to toggle mute:', err);
            }
        } else {
            // Still toggle UI state even if no track (for visual feedback)
            setIsMuted(prev => !prev);
        }
    }, [isMuted]);

    // Toggle video
    const toggleVideo = useCallback(async () => {
        if (localVideoTrackRef.current) {
            const newVideoEnabled = !isVideoEnabled;
            try {
                await localVideoTrackRef.current.setEnabled(newVideoEnabled);
                setIsVideoEnabled(newVideoEnabled);
            } catch (err) {
                console.error('[Agora Web] Failed to toggle video:', err);
            }
        } else {
            setIsVideoEnabled(prev => !prev);
        }
    }, [isVideoEnabled]);

    // Toggle speaker - mutes/unmutes remote audio playback
    const toggleSpeaker = useCallback(() => {
        const newSpeakerOn = !isSpeakerOn;

        // On web, we can control remote audio volume through the client
        if (clientRef.current) {
            try {
                const remoteUsersList = clientRef.current.remoteUsers || [];
                remoteUsersList.forEach((user: IAgoraRTCRemoteUser) => {
                    if (user.audioTrack) {
                        user.audioTrack.setVolume(newSpeakerOn ? 100 : 0);
                    }
                });
            } catch (err) {
                console.error('[Agora Web] Failed to toggle speaker:', err);
            }
        }

        setIsSpeakerOn(newSpeakerOn);
    }, [isSpeakerOn]);

    // Switch camera (web implementation)
    const switchCamera = useCallback(async () => {
        if (localVideoTrackRef.current) {
            try {
                // Get list of cameras
                const cameras = await AgoraRTC.getCameras();
                if (cameras.length > 1) {
                    // Find current camera and switch to next
                    const currentLabel = localVideoTrackRef.current.getMediaStreamTrack()?.label;
                    const currentIndex = cameras.findIndex(c => c.label === currentLabel);
                    const nextIndex = (currentIndex + 1) % cameras.length;
                    await localVideoTrackRef.current.setDevice(cameras[nextIndex].deviceId);
                }
            } catch (err) {
                console.error('[Agora Web] Switch camera failed:', err);
            }
        }
    }, []);

    // Note: SSE call event subscription is now handled globally by CallContext
    // This hook only handles Agora-specific call actions

    // Cleanup when call ends (either by user hangup or remote user leaving)
    useEffect(() => {
        if (callState === 'ended') {
            const callId = currentCall?.callId;
            // Leave channel
            if (clientRef.current) {
                clientRef.current.leave().catch(() => {});
            }
            // Clean up local tracks
            cleanupLocalTracks();
            // Stop duration timer
            stopDurationTimer();
            // Clear current call
            setCurrentCall(null);
            setRemoteUsers([]);
            // Call the onCallEnded callback if we have a callId
            if (callId) {
                options.onCallEnded?.(callId, 'remote_ended');
            }
            // Reset to idle after a short delay to allow UI to show "Call ended" briefly
            setTimeout(() => {
                setCallState('idle');
            }, 1500);
        }
    }, [callState, cleanupLocalTracks, stopDurationTimer, currentCall, options]);

    // Memoize engine object to prevent unnecessary re-renders in CallModal
    // Only create new object when localVideoTrack or client actually changes
    const engine = useMemo(() => ({
        localVideoTrack,
        client,
    }), [localVideoTrack, client]);

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

        // Track references for video rendering (use state values for reactivity)
        localVideoTrack,
        client,

        // Engine object containing tracks and client for CallModal.web.tsx
        // On web, this contains { localVideoTrack, client } instead of native Agora engine
        // Memoized to prevent infinite re-render loops in video calls
        engine,
    };
};

export default useAgoraCall;
