/**
 * Agora Call Hook - Native Entry Point
 *
 * This file detects whether react-native-agora is available and loads
 * the appropriate implementation:
 * - Native builds (APK/IPA): Uses useAgoraCall.native.ts with full Agora functionality
 * - Expo Go: Falls back to stub implementation with informative messages
 *
 * For web platform, useAgoraCall.web.ts is loaded by Metro's platform resolution.
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

// Check if react-native-agora is available (native build vs Expo Go)
let nativeAgoraAvailable = false;
let NativeAgoraHook: any = null;

try {
    // Try to import react-native-agora to check if it's available
    // This will throw an error in Expo Go where native modules aren't linked
    const agora = require('react-native-agora');
    if (agora && agora.createAgoraRtcEngine) {
        nativeAgoraAvailable = true;
        // Dynamically import the native implementation
        NativeAgoraHook = require('./useAgoraCall.native').useAgoraCall;
        console.log('[useAgoraCall] Native Agora SDK available - using native implementation');
    }
} catch (e) {
    console.log('[useAgoraCall] Native Agora SDK not available - using Expo Go stub');
    nativeAgoraAvailable = false;
}

/**
 * Stub implementation for Expo Go
 * Shows informative messages that calls require a native build
 */
const useAgoraCallStub = (options: UseAgoraCallOptions = {}) => {
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
            'Voice and video calls require a native build (APK/IPA). Please use the web version for calls, or build a standalone app with EAS Build.\n\nIn Expo Go, the Agora SDK is not available.',
            [{ text: 'OK' }]
        );
    }, []);

    const startCall = useCallback(async (calleeId: string, type: CallType = 'audio', subgridId?: string) => {
        showExpoGoAlert();
        options.onError?.(new Error('Calls not available in Expo Go. Use web version or build a native APK.'));
        return null;
    }, [options, showExpoGoAlert]);

    const answer = useCallback(async (callId: string, callTypeArg?: CallType) => {
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

/**
 * Main hook export - uses native implementation if available, otherwise stub
 */
export const useAgoraCall = nativeAgoraAvailable && NativeAgoraHook
    ? NativeAgoraHook
    : useAgoraCallStub;

export default useAgoraCall;
