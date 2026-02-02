/**
 * Agora Call Hook - Web Implementation
 * Uses agora-rtc-sdk-ng for web-based voice/video calls
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
    endCall as apiEndCall,
    subscribeToCallEventsAsync,
} from '../lib/api';

// Only impor types here if possible, or use 'any' for the library types to avoid runtime import
// Since we can't easily import types without importing the library in some bundlers, we'll use 'any' for the library objects
// inside the implementation, but keep our own types strict.

export type CallState = 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallType = 'audio' | 'video';

export interface CallSession {
    callId: string;
    channelName: string;
    callType: CallType;
    token: string;
    uid: number;
    appId: string;
}

interface UseAgoraCallWebOptions {
    onCallEnded?: (callId: string, reason: string) => void;
    onError?: (error: Error) => void;
    // Initial connection params for voice channels
    channelName?: string;
    token?: string;
    uid?: number;
    appId?: string;
    callId?: string;
    autoJoin?: boolean;
}

export const useAgoraCallWeb = (options: UseAgoraCallWebOptions = {}) => {
    const isWeb = Platform.OS === 'web';

    const [callState, setCallState] = useState<CallState>('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);

    const clientRef = useRef<any | null>(null);
    const localAudioTrackRef = useRef<any | null>(null);
    const localVideoTrackRef = useRef<any | null>(null);
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const cleanupSSERef = useRef<(() => void) | null>(null);
    const currentCallIdRef = useRef<string | null>(null);
    const hasJoinedRef = useRef(false);
    const isJoiningRef = useRef(false); // Track if currently in the process of joining
    const currentChannelRef = useRef<string | null>(null); // Track current channel name
    const optionsRef = useRef(options);

    // Store the AgoraRTC instance dynamically imported
    const agoraRtcRef = useRef<any>(null);

    // Keep options ref updated
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    // Cleanup function that doesn't depend on state
    const cleanup = useCallback(async () => {
        if (!isWeb) return;

        console.log('[AgoraWeb] Cleanup starting, hasJoined:', hasJoinedRef.current, 'channel:', currentChannelRef.current);

        // Stop duration timer
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        // Close local tracks
        if (localAudioTrackRef.current) {
            try {
                localAudioTrackRef.current.close();
            } catch (err) {
                console.error('[AgoraWeb] Close audio track error:', err);
            }
            localAudioTrackRef.current = null;
        }

        if (localVideoTrackRef.current) {
            try {
                localVideoTrackRef.current.close();
            } catch (err) {
                console.error('[AgoraWeb] Close video track error:', err);
            }
            localVideoTrackRef.current = null;
        }

        // Leave channel
        if (clientRef.current) {
            try {
                const connectionState = clientRef.current.connectionState;
                console.log('[AgoraWeb] Client connection state before leave:', connectionState);

                // Only attempt to leave if actually connected
                if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
                    await clientRef.current.leave();
                    console.log('[AgoraWeb] Successfully left channel');
                }
            } catch (err) {
                console.error('[AgoraWeb] Leave error:', err);
            }
        }

        hasJoinedRef.current = false;
        isJoiningRef.current = false;
        currentChannelRef.current = null;
    }, [isWeb]);

    // Initialize Agora client (WEB ONLY)
    useEffect(() => {
        if (!isWeb) return;

        let isMounted = true;

        const init = async () => {
            try {
                // Dynamic import to avoid crash on native
                const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
                agoraRtcRef.current = AgoraRTC;

                if (!isMounted) return;

                const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                clientRef.current = client;

                // Handle remote user events
                client.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
                    try {
                        await client.subscribe(user, mediaType);

                        if (mediaType === 'audio') {
                            user.audioTrack?.play();
                        }

                        setRemoteUsers(prev => {
                            if (!prev.includes(user.uid as number)) {
                                return [...prev, user.uid as number];
                            }
                            return prev;
                        });
                    } catch (err) {
                        console.error('[AgoraWeb] Subscribe error:', err);
                    }
                });

                client.on('user-unpublished', () => {
                    // User stopped publishing
                });

                client.on('user-left', (user: any) => {
                    setRemoteUsers(prev => prev.filter(uid => uid !== user.uid));
                });

                client.on('user-joined', (user: any) => {
                    setRemoteUsers(prev => {
                        if (!prev.includes(user.uid as number)) {
                            return [...prev, user.uid as number];
                        }
                        return prev;
                    });
                });
            } catch (err) {
                console.error('[AgoraWeb] Failed to load Agora SDK:', err);
            }
        };

        init();

        return () => {
            isMounted = false;
            cleanup();
            if (clientRef.current) {
                clientRef.current.removeAllListeners();
            }
        };
    }, [isWeb, cleanup]);

    // Auto-join if params provided
    useEffect(() => {
        if (!isWeb) return;

        // Skip if not configured for auto-join or missing required params
        if (!options.autoJoin || !options.channelName || !options.token || !options.appId) {
            return;
        }

        // Skip if already joined to this channel or currently joining
        if ((hasJoinedRef.current && currentChannelRef.current === options.channelName) || isJoiningRef.current) {
            console.log('[AgoraWeb] Skip join - already joined or joining:', {
                hasJoined: hasJoinedRef.current,
                isJoining: isJoiningRef.current,
                currentChannel: currentChannelRef.current,
                targetChannel: options.channelName
            });
            return;
        }

        const joinAsync = async () => {
            // Wait for client to be initialized
            if (!clientRef.current || !agoraRtcRef.current) {
                // Retry once after a short delay if init is slow
                setTimeout(() => {
                    if (clientRef.current && agoraRtcRef.current && !hasJoinedRef.current && !isJoiningRef.current) {
                        joinAsync();
                    }
                }, 500);
                return;
            }

            // Double-check we're not already joining
            if (isJoiningRef.current) {
                console.log('[AgoraWeb] Join already in progress, skipping');
                return;
            }

            const client = clientRef.current;
            const AgoraRTC = agoraRtcRef.current;

            try {
                // Mark as joining to prevent duplicate attempts
                isJoiningRef.current = true;
                setCallState('connecting');
                setError(null);
                currentCallIdRef.current = options.callId || null;

                console.log('[AgoraWeb] Attempting to join channel:', options.channelName, 'with uid:', options.uid);
                console.log('[AgoraWeb] Current client state:', client.connectionState);

                // If client is already connected to a different channel, leave first
                if (client.connectionState === 'CONNECTED' || client.connectionState === 'CONNECTING') {
                    console.log('[AgoraWeb] Client already connected/connecting, cleaning up first');
                    try {
                        // Close existing tracks
                        if (localAudioTrackRef.current) {
                            localAudioTrackRef.current.close();
                            localAudioTrackRef.current = null;
                        }
                        if (localVideoTrackRef.current) {
                            localVideoTrackRef.current.close();
                            localVideoTrackRef.current = null;
                        }
                        await client.leave();
                        console.log('[AgoraWeb] Left previous channel');
                        // Wait a moment for the leave to fully process
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } catch (leaveErr) {
                        console.error('[AgoraWeb] Error leaving previous channel:', leaveErr);
                    }
                }

                // Join the channel
                console.log('[AgoraWeb] Joining channel:', options.channelName);
                await client.join(options.appId, options.channelName, options.token, options.uid || 0);
                console.log('[AgoraWeb] Successfully joined channel');

                // Track current channel
                currentChannelRef.current = options.channelName;
                hasJoinedRef.current = true;

                // Create and publish local audio track
                const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                localAudioTrackRef.current = audioTrack;
                await client.publish([audioTrack]);

                setCallState('connected');
                console.log('[AgoraWeb] Successfully joined and published');

                // Start duration timer
                durationIntervalRef.current = setInterval(() => {
                    setCallDuration(prev => prev + 1);
                }, 1000);

            } catch (err: any) {
                console.error('[AgoraWeb] Join failed:', err);

                // Handle UID_CONFLICT specifically
                if (err.message && err.message.includes('UID_CONFLICT')) {
                    console.log('[AgoraWeb] UID conflict detected, attempting recovery...');
                    try {
                        // Force cleanup and retry
                        if (localAudioTrackRef.current) {
                            localAudioTrackRef.current.close();
                            localAudioTrackRef.current = null;
                        }
                        if (localVideoTrackRef.current) {
                            localVideoTrackRef.current.close();
                            localVideoTrackRef.current = null;
                        }
                        await client.leave();
                        console.log('[AgoraWeb] Recovery: left channel');

                        // Wait and retry
                        await new Promise(resolve => setTimeout(resolve, 500));

                        console.log('[AgoraWeb] Recovery: rejoining...');
                        await client.join(options.appId!, options.channelName!, options.token!, options.uid || 0);
                        currentChannelRef.current = options.channelName!;
                        hasJoinedRef.current = true;

                        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                        localAudioTrackRef.current = audioTrack;
                        await client.publish([audioTrack]);

                        setCallState('connected');
                        console.log('[AgoraWeb] Recovery successful');

                        durationIntervalRef.current = setInterval(() => {
                            setCallDuration(prev => prev + 1);
                        }, 1000);

                        isJoiningRef.current = false;
                        return; // Success after recovery
                    } catch (recoveryErr: any) {
                        console.error('[AgoraWeb] Recovery failed:', recoveryErr);
                        setError('Failed to join voice channel. Please try again.');
                    }
                } else {
                    setError(err.message || 'Failed to join voice channel');
                }

                setCallState('idle');
                hasJoinedRef.current = false;
                currentChannelRef.current = null;
                optionsRef.current.onError?.(err);
            } finally {
                isJoiningRef.current = false;
            }
        };

        joinAsync();
    }, [isWeb, options.autoJoin, options.channelName, options.token, options.appId, options.uid, options.callId]);

    const leaveChannel = useCallback(async () => {
        if (!isWeb) return;
        console.log('[AgoraWeb] leaveChannel called');
        await cleanup();
        setCallState('ended');
        setRemoteUsers([]);
        setCallDuration(0);
        setError(null);
    }, [isWeb, cleanup]);

    const hangup = useCallback(async () => {
        if (!isWeb) return;
        try {
            if (currentCallIdRef.current) {
                await apiEndCall(currentCallIdRef.current);
            }
            await leaveChannel();
            optionsRef.current.onCallEnded?.(currentCallIdRef.current || '', 'user_ended');
        } catch (err: any) {
            console.error('[AgoraWeb] Hangup failed:', err);
            await leaveChannel();
        }
    }, [isWeb, leaveChannel]);

    const toggleMute = useCallback(async () => {
        if (!isWeb) return;
        const audioTrack = localAudioTrackRef.current;
        if (audioTrack) {
            setIsMuted(prev => {
                const newMuted = !prev;
                audioTrack.setEnabled(!newMuted);
                return newMuted;
            });
        }
    }, [isWeb]);

    const toggleVideo = useCallback(async () => {
        if (!isWeb) return;
        const client = clientRef.current;
        const AgoraRTC = agoraRtcRef.current;

        if (!client || !AgoraRTC) return;

        if (isVideoEnabled && localVideoTrackRef.current) {
            // Disable video
            await client.unpublish([localVideoTrackRef.current]);
            localVideoTrackRef.current.close();
            localVideoTrackRef.current = null;
            setIsVideoEnabled(false);
        } else {
            // Enable video
            try {
                const videoTrack = await AgoraRTC.createCameraVideoTrack();
                localVideoTrackRef.current = videoTrack;
                await client.publish([videoTrack]);
                setIsVideoEnabled(true);
            } catch (err: any) {
                console.error('[AgoraWeb] Enable video failed:', err);
                setError('Failed to enable camera');
            }
        }
    }, [isWeb, isVideoEnabled]);

    // Handle call events from backend
    useEffect(() => {
        // SSE setup is safe on native but we might not want it if using native Agora
        // For now, let's keep it consistent
        let isMounted = true;

        const handleCallEvent = (event: string, data: any) => {
            switch (event) {
                case 'call_ended':
                case 'call_declined':
                    if (isWeb) {
                        leaveChannel();
                        optionsRef.current.onCallEnded?.(data.callId, event);
                    }
                    break;
            }
        };

        // Use async version to ensure bootstrap is complete before subscribing
        const setupSSE = async () => {
            try {
                const cleanup = await subscribeToCallEventsAsync(handleCallEvent);
                if (isMounted) {
                    cleanupSSERef.current = cleanup;
                } else {
                    // Component unmounted before SSE was set up, clean up immediately
                    cleanup();
                }
            } catch (err) {
                console.error('[AgoraWeb] Failed to subscribe to call events:', err);
            }
        };

        setupSSE();

        return () => {
            isMounted = false;
            cleanupSSERef.current?.();
        };
    }, [isWeb, leaveChannel]);

    return {
        // State
        callState,
        isMuted,
        isVideoEnabled,
        remoteUsers,
        error,
        callDuration,

        // Actions
        hangup,
        toggleMute,
        toggleVideo,

        // References
        client: clientRef.current,
        localAudioTrack: localAudioTrackRef.current,
        localVideoTrack: localVideoTrackRef.current,
    };
};

export default useAgoraCallWeb;
