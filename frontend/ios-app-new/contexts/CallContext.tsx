/**
 * Global Call Context
 * Provides app-wide call event subscription so users can receive calls from anywhere
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { subscribeToCallEventsAsync } from '../lib/api';
import { useWebSocketContext } from './WebSocketContext';

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
    startActiveCall: (call: ActiveCall) => void; // Use this when starting a call - manages activeCallIds
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

// Safe version that returns null instead of throwing - use for optional call features
export const useCallContextSafe = () => {
    return useContext(CallContext);
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
    const { subscribe } = useWebSocketContext();
    // Track handled call IDs to prevent showing the same incoming call multiple times
    // (can happen due to multiple SSE connections from hot-reload)
    const handledCallIdsRef = useRef<Set<string>>(new Set());
    // Track call IDs that we are actively answering/in-call with - used to ignore stale events
    const activeCallIdsRef = useRef<Set<string>>(new Set());

    // Keep refs in sync with state/router for use in callbacks
    useEffect(() => {
        activeCallRef.current = activeCall;
    }, [activeCall]);

    useEffect(() => {
        routerRef.current = router;
    }, [router]);

    // Stable callback that uses refs instead of dependencies
    const handleCallEvent = useCallback((event: string, data: any) => {
        switch (event) {
            case 'incoming_call':
                // Check if we've already handled this call (prevents duplicate notifications
                // from multiple SSE connections due to hot-reload)
                if (handledCallIdsRef.current.has(data.callId)) {
                    break;
                }
                // Skip if this call is already active (prevents race between state and ref)
                if (activeCallIdsRef.current.has(data.callId)) {
                    break;
                }
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
                        // Browser notification not available
                    }
                }
                break;

            case 'call_answered':
                // The callee answered the call - caller's Agora hook will transition
                // to 'connected' when it detects the callee joined the channel
                break;

            case 'user_busy':
                // The callee is busy in another call
                // Don't need to do anything here - the startCall API already returns the error
                break;

            case 'call_ended':
            case 'call_declined':
            case 'call_missed':
                setIncomingCall(null);

                // Check if we have an active call that matches this callId
                if (activeCallRef.current && activeCallRef.current.callId === data.callId) {
                    // If we're the answering party (receiver) and call is connected, ignore stale events
                    // This prevents late-arriving events from closing an active call
                    if (activeCallRef.current.isAnswering && activeCallRef.current.isConnected) {
                        break;
                    }

                    // If call is already connected via Agora, ignore stale events
                    // Only exception: call_ended should still work for connected calls
                    if (activeCallRef.current.isConnected && event !== 'call_ended') {
                        break;
                    }

                    // For caller receiving call_declined/call_missed while waiting (ringing state),
                    // or for any party receiving call_ended - end the call
                    activeCallIdsRef.current.delete(data.callId);
                    setActiveCall(null);
                    // Don't navigate - the user stays on the current DM page
                    // Navigation would cause unnecessary page reload
                }
                break;
        }
    }, []); // No dependencies - uses refs for stability

    const answerCall = useCallback(() => {
        if (!incomingCall) return;

        // Mark this call as handled to prevent duplicate notifications
        handledCallIdsRef.current.add(incomingCall.callId);
        // CRITICAL: Add to activeCallIds FIRST before anything else
        // This ensures that any stale call_missed/call_declined events are ignored
        activeCallIdsRef.current.add(incomingCall.callId);

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
        // Pass callType in URL since incomingCall will be null after navigation
        const navUrl = `/direct-messages/${incomingCall.callerId}?answerCall=${incomingCall.callId}&callType=${incomingCall.callType}`;
        router.push(navUrl);
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

    // Start an active call - this manages the activeCallIds set to protect against stale events
    // Use this when initiating a call (caller side)
    const startActiveCall = useCallback((call: ActiveCall) => {
        // Add to activeCallIds FIRST before setting state
        // This ensures any stale events for this callId are ignored
        activeCallIdsRef.current.add(call.callId);
        setActiveCall(call);
        activeCallRef.current = call;
    }, []);

    // Mark the active call as connected (prevents stale events from closing call)
    const markCallConnected = useCallback(() => {
        setActiveCall(prev => prev ? { ...prev, isConnected: true, isAnswering: false } : null);
        // Also update the ref immediately so event handlers see the change
        if (activeCallRef.current) {
            activeCallRef.current = { ...activeCallRef.current, isConnected: true, isAnswering: false };
        }
    }, []);

    const endCall = useCallback(async () => {
        if (!activeCall) return;

        try {
            const { endCall: apiEndCall } = await import('../lib/api');
            await apiEndCall(activeCall.callId);
        } catch (err) {
            console.error('[CallContext] Failed to end call:', err);
        }

        // Clean up activeCallIds
        activeCallIdsRef.current.delete(activeCall.callId);

        // Redirect to DM chat
        const peerId = activeCall.peerId;
        setActiveCall(null);
        router.replace(`/direct-messages/${peerId}`);
    }, [activeCall, router]);

    useEffect(() => {
        // Prevent multiple SSE setups
        if (sseSetupRef.current) return;

        let isMounted = true;
        let pendingCleanup: (() => void) | null = null;
        sseSetupRef.current = true;

        const setupSSE = async () => {
            try {
                const cleanup = await subscribeToCallEventsAsync(handleCallEvent);
                if (isMounted) {
                    cleanupRef.current = cleanup;
                } else {
                    // Component unmounted during async setup - cleanup immediately
                    cleanup();
                }
                pendingCleanup = cleanup;
            } catch (err) {
                console.error('[CallContext] Failed to subscribe to call events:', err);
            }
        };

        setupSSE();

        return () => {
            isMounted = false;
            // Clean up both the ref-stored cleanup and any pending cleanup
            cleanupRef.current?.();
            cleanupRef.current = null;
            pendingCleanup?.();
            sseSetupRef.current = false;
        };
    }, [handleCallEvent]);

    // On native platforms, subscribe to call events via WebSocket (SSE/EventSource is web-only)
    useEffect(() => {
        if (Platform.OS === 'web') return;

        const unsubs: (() => void)[] = [];

        unsubs.push(subscribe('incoming_call', (data: any) => {
            handleCallEvent('incoming_call', data);
        }));

        unsubs.push(subscribe('call_answered', (data: any) => {
            handleCallEvent('call_answered', data);
        }));

        unsubs.push(subscribe('call_ended', (data: any) => {
            handleCallEvent('call_ended', data);
        }));

        // call_declined and call_missed use the same handler as call_ended in handleCallEvent
        unsubs.push(subscribe('call_declined' as any, (data: any) => {
            handleCallEvent('call_declined', data);
        }));

        unsubs.push(subscribe('call_missed' as any, (data: any) => {
            handleCallEvent('call_missed', data);
        }));

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, [subscribe, handleCallEvent]);

    return (
        <CallContext.Provider value={{ incomingCall, activeCall, setActiveCall, startActiveCall, markCallConnected, answerCall, declineCall, clearIncomingCall, endCall }}>
            {children}
        </CallContext.Provider>
    );
};

export default CallProvider;
