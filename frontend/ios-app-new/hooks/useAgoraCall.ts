/**
 * Agora Call Hook - Native Stub for Expo Go
 *
 * react-native-agora requires native linking and doesn't work in Expo Go.
 * This stub provides a graceful fallback that shows an informative message.
 *
 * For full native call support:
 * - Use a development build (expo prebuild && expo run:ios/android)
 * - Or use EAS Build to create a custom development client
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import {
    initiateDMCall,
    answerCall,
    declineCall,
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
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
    const [error, setError] = useState<string | null>('Calls require a native build. Use web for calls in Expo Go.');
    const [callDuration, setCallDuration] = useState(0);

    const showExpoGoAlert = useCallback(() => {
        Alert.alert(
            'Calls Not Available',
            'Voice and video calls require a native build. Please use the web version for calls, or build a standalone app.\n\nIn Expo Go, the Agora SDK is not available.',
            [{ text: 'OK' }]
        );
    }, []);

    const startCall = useCallback(async (calleeId: string, type: CallType = 'audio', subgridId?: string) => {
        showExpoGoAlert();
        options.onError?.(new Error('Calls not available in Expo Go. Use web version for calls.'));
        return null;
    }, [options, showExpoGoAlert]);

    const answer = useCallback(async (callId: string) => {
        showExpoGoAlert();
        try {
            await answerCall(callId);
        } catch (err: any) {
            console.error('Answer call failed:', err);
        }
        return null;
    }, [showExpoGoAlert]);

    const decline = useCallback(async (callId: string) => {
        try {
            await declineCall(callId);
        } catch (err: any) {
            console.error('Decline call failed:', err);
        }
    }, []);

    const hangup = useCallback(async () => {
        try {
            if (currentCall) {
                await apiEndCall(currentCall.callId);
            }

            setCallState('ended');
            setCurrentCall(null);
            setRemoteUsers([]);

            if (currentCall) {
                options.onCallEnded?.(currentCall.callId, 'user_ended');
            }
        } catch (err: any) {
            console.error('Hangup failed:', err);
        }
    }, [currentCall, options]);

    const toggleMute = useCallback(() => {
        setIsMuted(prev => !prev);
    }, []);

    const toggleVideo = useCallback(() => {
        setIsVideoEnabled(prev => !prev);
    }, []);

    const toggleSpeaker = useCallback(() => {
        setIsSpeakerOn(prev => !prev);
    }, []);

    const switchCamera = useCallback(() => {
        // No-op in Expo Go
    }, []);

    // Note: SSE call event subscription is now handled globally by CallContext
    // This hook only handles Agora-specific call actions

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

        // Engine reference (null in Expo Go)
        engine: null,
    };
};

export default useAgoraCall;
