/**
 * Agora Call Hook - Web Implementation
 * Uses Agora Web SDK for browser-based voice/video calls
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
    const [callState, setCallState] = useState<CallState>('idle');
    const [callType, setCallType] = useState<CallType>('audio');
    const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);

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
                    console.log('[Agora Web] Leaving existing channel before rejoining...');
                    await clientRef.current.leave();
                }
            } catch (e) {
                console.log('[Agora Web] Error leaving previous channel:', e);
            }
            return clientRef.current;
        }

        try {
            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

            // Set up event listeners
            client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
                await client.subscribe(user, mediaType);
                console.log('[Agora Web] Subscribed to', mediaType, 'from user', user.uid);

                if (mediaType === 'audio') {
                    user.audioTrack?.play();
                }
                if (mediaType === 'video') {
                    // Video track will be handled by the UI
                }
            });

            client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
                console.log('[Agora Web] User unpublished', mediaType, user.uid);
            });

            client.on('user-joined', (user: IAgoraRTCRemoteUser) => {
                console.log('[Agora Web] User joined:', user.uid);
                setRemoteUsers(prev => [...prev.filter(uid => uid !== user.uid), user.uid as number]);
                // Transition from 'ringing' to 'connected' when the other user joins
                if (callStateRef.current === 'ringing') {
                    console.log('[Agora Web] Callee joined, transitioning to connected');
                    setCallState('connected');
                    startDurationTimerRef.current?.();
                }
            });

            client.on('user-left', (user: IAgoraRTCRemoteUser) => {
                console.log('[Agora Web] User left:', user.uid);
                setRemoteUsers(prev => prev.filter(uid => uid !== user.uid));
            });

            client.on('token-privilege-will-expire', async () => {
                console.log('[Agora Web] Token expiring, refreshing...');
                await handleTokenRefresh();
            });

            client.on('token-privilege-did-expire', async () => {
                console.log('[Agora Web] Token expired');
                setError('Call token expired');
            });

            clientRef.current = client;
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
            // Create audio track
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            localAudioTrackRef.current = audioTrack;

            // Create video track if video call
            if (type === 'video') {
                const videoTrack = await AgoraRTC.createCameraVideoTrack();
                localVideoTrackRef.current = videoTrack;
                setIsVideoEnabled(true);
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
            await client.join(appId, channelName, token, uid);
            console.log('[Agora Web] Joined channel:', channelName);

            // Publish tracks
            const tracksToPublish = [audioTrack];
            if (videoTrack) {
                tracksToPublish.push(videoTrack);
            }
            await client.publish(tracksToPublish);
            console.log('[Agora Web] Published local tracks');

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
            console.log('[Agora Web] Joined channel as callee:', channelName);

            // Publish tracks
            const tracksToPublish = [audioTrack];
            if (videoTrack) {
                tracksToPublish.push(videoTrack);
            }
            await client.publish(tracksToPublish);
            console.log('[Agora Web] Published local tracks');

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
        console.log('[Agora Web] toggleMute called, current isMuted:', isMuted, 'hasAudioTrack:', !!localAudioTrackRef.current);
        if (localAudioTrackRef.current) {
            const newMuted = !isMuted;
            try {
                await localAudioTrackRef.current.setEnabled(!newMuted);
                setIsMuted(newMuted);
                console.log('[Agora Web] Mute toggled, now muted:', newMuted);
            } catch (err) {
                console.error('[Agora Web] Failed to toggle mute:', err);
            }
        } else {
            // Still toggle UI state even if no track (for visual feedback)
            setIsMuted(prev => !prev);
            console.log('[Agora Web] No audio track, toggled UI state only');
        }
    }, [isMuted]);

    // Toggle video
    const toggleVideo = useCallback(async () => {
        console.log('[Agora Web] toggleVideo called, current isVideoEnabled:', isVideoEnabled, 'hasVideoTrack:', !!localVideoTrackRef.current);
        if (localVideoTrackRef.current) {
            const newVideoEnabled = !isVideoEnabled;
            try {
                await localVideoTrackRef.current.setEnabled(newVideoEnabled);
                setIsVideoEnabled(newVideoEnabled);
                console.log('[Agora Web] Video toggled, now enabled:', newVideoEnabled);
            } catch (err) {
                console.error('[Agora Web] Failed to toggle video:', err);
            }
        } else {
            setIsVideoEnabled(prev => !prev);
            console.log('[Agora Web] No video track, toggled UI state only');
        }
    }, [isVideoEnabled]);

    // Toggle speaker - mutes/unmutes remote audio playback
    const toggleSpeaker = useCallback(() => {
        console.log('[Agora Web] toggleSpeaker called, current isSpeakerOn:', isSpeakerOn);
        const newSpeakerOn = !isSpeakerOn;

        // On web, we can control remote audio volume through the client
        if (clientRef.current) {
            try {
                // Get all remote users and adjust their audio volume
                const remoteUsersList = clientRef.current.remoteUsers || [];
                remoteUsersList.forEach((user: IAgoraRTCRemoteUser) => {
                    if (user.audioTrack) {
                        // setVolume takes 0-100, 0 = mute, 100 = full volume
                        user.audioTrack.setVolume(newSpeakerOn ? 100 : 0);
                    }
                });
                console.log('[Agora Web] Speaker toggled, remote audio volume set to:', newSpeakerOn ? 100 : 0);
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

    // Cleanup only on actual unmount when call ends
    // We don't auto-cleanup the Agora client on component re-renders
    // since that would end active calls unexpectedly

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

        // Track references for video rendering
        localVideoTrack: localVideoTrackRef.current,
        client: clientRef.current,

        // Engine reference (null on web, but we provide client instead)
        engine: null,
    };
};

export default useAgoraCall;
