/**
 * Global Call Context
 * Provides app-wide call event subscription so users can receive calls from anywhere
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { subscribeToCallEventsAsync } from '../lib/api';

export interface IncomingCall {
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: 'audio' | 'video';
    channelName: string;
    token: string;
    uid: number;
    appId: string;
}

export interface ActiveCall {
    callId: string;
    peerId: string;
    peerName: string;
    callType: 'audio' | 'video';
    startedAt: number; // Timestamp when call was started
    isConnected?: boolean; // True when Agora has successfully connected
    isAnswering?: boolean; // True when we're in the process of answering (receiver side)
}

interface CallContextType {
    incomingCall: IncomingCall | null;
    activeCall: ActiveCall | null;
    setActiveCall: (call: ActiveCall | null) => void;
    markCallConnected: () => void; // Mark active call as connected via Agora
    answerCall: () => void;
    declineCall: () => void;
    clearIncomingCall: () => void;
    endCall: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCallContext = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCallContext must be used within a CallProvider');
    }
    return context;
};

interface CallProviderProps {
    children: React.ReactNode;
}

export const CallProvider: React.FC<CallProviderProps> = ({ children }) => {
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const router = useRouter();
    const cleanupRef = useRef<(() => void) | null>(null);
    const activeCallRef = useRef<ActiveCall | null>(null);
    const routerRef = useRef(router);
    const sseSetupRef = useRef(false);
    // Track handled call IDs to prevent showing the same incoming call multiple times
    // (can happen due to multiple SSE connections from hot-reload)
    const handledCallIdsRef = useRef<Set<string>>(new Set());

    // Keep refs in sync with state/router for use in callbacks
    useEffect(() => {
        activeCallRef.current = activeCall;
    }, [activeCall]);

    useEffect(() => {
        routerRef.current = router;
    }, [router]);

    // Stable callback that uses refs instead of dependencies
    const handleCallEvent = useCallback((event: string, data: any) => {
        console.log('[CallContext] Received event:', event, data);

        switch (event) {
            case 'incoming_call':
                // Check if we've already handled this call (prevents duplicate notifications
                // from multiple SSE connections due to hot-reload)
                if (handledCallIdsRef.current.has(data.callId)) {
                    console.log('[CallContext] Ignoring duplicate incoming_call event for:', data.callId);
                    break;
                }

                console.log('[CallContext] Incoming call from:', data.callerName, 'callId:', data.callId);
                setIncomingCall({
                    callId: data.callId,
                    callerId: data.callerId,
                    callerName: data.callerName,
                    callerAvatar: data.callerAvatar,
                    callType: data.callType,
                    channelName: data.channelName,
                    token: data.token,
                    uid: data.uid,
                    appId: data.appId,
                });

                // Show alert on web as a fallback notification
                if (Platform.OS === 'web') {
                    // Play a sound or show browser notification if possible
                    try {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification(`Incoming ${data.callType} call`, {
                                body: `${data.callerName} is calling...`,
                                icon: data.callerAvatar,
                            });
                        }
                    } catch (e) {
                        console.log('[CallContext] Browser notification not available');
                    }
                }
                break;

            case 'call_answered':
                // The callee answered the call - caller's Agora hook will transition
                // to 'connected' when it detects the callee joined the channel
                console.log('[CallContext] Call answered by callee:', data.calleeId);
                break;

            case 'user_busy':
                // The callee is busy in another call
                console.log('[CallContext] User is busy:', data.calleeId);
                // Don't need to do anything here - the startCall API already returns the error
                break;

            case 'call_ended':
            case 'call_declined':
            case 'call_missed':
                console.log('[CallContext] Call ended/declined/missed, activeCall:', activeCallRef.current, 'eventCallId:', data.callId, 'eventTimestamp:', data.timestamp);
                setIncomingCall(null);
                // Only redirect if the call ID matches our active call
                // When we have an activeCall with callId set, it must match exactly
                // Ignore stale events from before our current call started
                // IMPORTANT: Do NOT redirect if the call is already connected (Agora is active)
                if (activeCallRef.current) {
                    const hasCallId = !!activeCallRef.current.callId;

                    // If we don't have a callId yet, don't redirect on any event
                    if (!hasCallId) {
                        console.log('[CallContext] Ignoring event - no callId set on activeCall yet');
                        break;
                    }

                    // If the call is already connected via Agora, ignore missed/declined events
                    // These are stale events from before the call was established
                    if (activeCallRef.current.isConnected && (event === 'call_missed' || event === 'call_declined')) {
                        console.log('[CallContext] Ignoring', event, 'event - call is already connected via Agora');
                        break;
                    }

                    // If we're in the process of answering (receiver side), ignore missed/declined events
                    // The answer process is async and stale events could arrive before Agora connects
                    if (activeCallRef.current.isAnswering && (event === 'call_missed' || event === 'call_declined')) {
                        console.log('[CallContext] Ignoring', event, 'event - we are in the process of answering');
                        break;
                    }

                    const callIdMatches = activeCallRef.current.callId === data.callId;
                    // Check if this event is from after our call started (not a stale event)
                    const eventTimestamp = data.timestamp || 0;
                    const isRecentEvent = eventTimestamp >= (activeCallRef.current.startedAt || 0);

                    if (callIdMatches && isRecentEvent) {
                        console.log('[CallContext] Ending active call and redirecting (callId matched)');
                        const peerId = activeCallRef.current.peerId;
                        setActiveCall(null);
                        routerRef.current.replace(`/direct-messages/${peerId}`);
                    } else if (!callIdMatches) {
                        console.log('[CallContext] Ignoring event - callId does not match:', data.callId, 'vs', activeCallRef.current.callId);
                    } else if (!isRecentEvent) {
                        console.log('[CallContext] Ignoring stale event from before current call started');
                    }
                }
                break;
        }
    }, []); // No dependencies - uses refs for stability

    const answerCall = useCallback(() => {
        if (!incomingCall) return;

        // Mark this call as handled to prevent duplicate notifications
        handledCallIdsRef.current.add(incomingCall.callId);

        // Set active call for tracking (used for redirect on end)
        // Set isAnswering: true to prevent stale events from redirecting during answer process
        const newActiveCall = {
            callId: incomingCall.callId,
            peerId: incomingCall.callerId,
            peerName: incomingCall.callerName,
            callType: incomingCall.callType,
            startedAt: Date.now(),
            isAnswering: true,
        };
        setActiveCall(newActiveCall);
        // Update ref immediately so event handlers see the change right away
        activeCallRef.current = newActiveCall;

        // Navigate to the DM screen with the caller to handle the call
        // The DM screen's useAgoraCall hook will handle actually answering
        // Pass callType in URL since incomingCall will be null after navigation
        router.push(`/direct-messages/${incomingCall.callerId}?answerCall=${incomingCall.callId}&callType=${incomingCall.callType}`);
        setIncomingCall(null);
    }, [incomingCall, router]);

    const declineCall = useCallback(async () => {
        if (!incomingCall) return;

        // Mark this call as handled to prevent duplicate notifications
        handledCallIdsRef.current.add(incomingCall.callId);

        try {
            const { declineCall: apiDeclineCall } = await import('../lib/api');
            await apiDeclineCall(incomingCall.callId);
        } catch (err) {
            console.error('[CallContext] Failed to decline call:', err);
        }
        setIncomingCall(null);
    }, [incomingCall]);

    const clearIncomingCall = useCallback(() => {
        // Mark the current incoming call as handled before clearing
        if (incomingCall) {
            handledCallIdsRef.current.add(incomingCall.callId);
        }
        setIncomingCall(null);
    }, [incomingCall]);

    // Mark the active call as connected (prevents stale events from closing call)
    const markCallConnected = useCallback(() => {
        setActiveCall(prev => prev ? { ...prev, isConnected: true, isAnswering: false } : null);
        // Also update the ref immediately so event handlers see the change
        if (activeCallRef.current) {
            activeCallRef.current = { ...activeCallRef.current, isConnected: true, isAnswering: false };
        }
        console.log('[CallContext] Marked active call as connected');
    }, []);

    const endCall = useCallback(async () => {
        if (!activeCall) return;

        try {
            const { endCall: apiEndCall } = await import('../lib/api');
            await apiEndCall(activeCall.callId);
        } catch (err) {
            console.error('[CallContext] Failed to end call:', err);
        }

        // Redirect to DM chat
        const peerId = activeCall.peerId;
        setActiveCall(null);
        router.replace(`/direct-messages/${peerId}`);
    }, [activeCall, router]);

    useEffect(() => {
        // Prevent multiple SSE setups
        if (sseSetupRef.current) {
            console.log('[CallContext] SSE already setup, skipping');
            return;
        }

        let isMounted = true;
        sseSetupRef.current = true;

        const setupSSE = async () => {
            try {
                console.log('[CallContext] Setting up global call event subscription...');
                const cleanup = await subscribeToCallEventsAsync(handleCallEvent);
                if (isMounted) {
                    cleanupRef.current = cleanup;
                    console.log('[CallContext] Global call event subscription active');
                } else {
                    cleanup();
                }
            } catch (err) {
                console.error('[CallContext] Failed to subscribe to call events:', err);
            }
        };

        setupSSE();

        return () => {
            isMounted = false;
            cleanupRef.current?.();
            sseSetupRef.current = false;
        };
    }, [handleCallEvent]);

    return (
        <CallContext.Provider value={{ incomingCall, activeCall, setActiveCall, markCallConnected, answerCall, declineCall, clearIncomingCall, endCall }}>
            {children}
        </CallContext.Provider>
    );
};

export default CallProvider;
