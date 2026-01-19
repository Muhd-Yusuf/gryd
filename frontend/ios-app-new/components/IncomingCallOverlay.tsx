/**
 * Incoming Call Overlay
 * Shows a full-screen overlay when there's an incoming call
 */

import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { useCallContext } from '../contexts/CallContext';
import UserAvatar from './UserAvatar';

export const IncomingCallOverlay: React.FC = () => {
    const { colors } = useTheme();
    const { incomingCall, answerCall, declineCall } = useCallContext();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Refs to store audio resources for cleanup
    const audioContextRef = useRef<AudioContext | null>(null);
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Function to stop ringtone
    const stopRingtone = useCallback(() => {
        console.log('[IncomingCallOverlay] Stopping ringtone');
        if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current);
            ringIntervalRef.current = null;
        }
        if (oscillatorRef.current) {
            try {
                oscillatorRef.current.stop();
            } catch (e) {
                // Already stopped
            }
            oscillatorRef.current = null;
        }
        if (audioContextRef.current) {
            try {
                audioContextRef.current.close();
            } catch (e) {
                // Already closed
            }
            audioContextRef.current = null;
        }
    }, []);

    // Wrap answerCall to stop ringtone first
    const handleAnswer = useCallback(() => {
        stopRingtone();
        answerCall();
    }, [stopRingtone, answerCall]);

    // Wrap declineCall to stop ringtone first
    const handleDecline = useCallback(() => {
        stopRingtone();
        declineCall();
    }, [stopRingtone, declineCall]);

    // Play ringtone effect (web only)
    useEffect(() => {
        if (!incomingCall) {
            // Clean up if incomingCall becomes null
            stopRingtone();
            return;
        }

        // On web, play a ringtone
        if (Platform.OS === 'web') {
            try {
                // Create a simple beep sound using Web Audio API
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 440;
                gainNode.gain.value = 0.1;

                oscillator.start();

                // Store refs for cleanup
                audioContextRef.current = audioContext;
                oscillatorRef.current = oscillator;

                // Ring pattern: beep for 1s, silence for 2s
                ringIntervalRef.current = setInterval(() => {
                    oscillator.frequency.value = oscillator.frequency.value === 440 ? 0 : 440;
                }, 1000);

                console.log('[IncomingCallOverlay] Ringtone started');

                return () => {
                    stopRingtone();
                };
            } catch (e) {
                console.log('[IncomingCallOverlay] Could not play ringtone:', e);
            }
        }
    }, [incomingCall, stopRingtone]);

    if (!incomingCall) {
        return null;
    }

    return (
        <Modal visible={true} animationType="slide" transparent={false} statusBarTranslucent>
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.label}>
                        Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
                    </Text>
                    <UserAvatar
                        uri={incomingCall.callerAvatar}
                        name={incomingCall.callerName}
                        style={styles.avatar}
                    />
                    <Text style={styles.name}>{incomingCall.callerName}</Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
                        <View style={styles.declineButtonCircle}>
                            <MaterialIcons name="call-end" size={32} color="#FFFFFF" />
                        </View>
                        <Text style={styles.buttonText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.answerButton} onPress={handleAnswer}>
                        <View style={styles.answerButtonCircle}>
                            <MaterialIcons
                                name={incomingCall.callType === 'video' ? 'videocam' : 'call'}
                                size={32}
                                color="#FFFFFF"
                            />
                        </View>
                        <Text style={styles.buttonText}>Answer</Text>
                    </TouchableOpacity>
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
            justifyContent: 'space-between',
            paddingVertical: 80,
            paddingHorizontal: 40,
        },
        content: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
        },
        label: {
            fontSize: 18,
            color: colors.textMuted,
            marginBottom: 20,
        },
        avatar: {
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 4,
            borderColor: colors.primary,
        },
        name: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.text,
            marginTop: 16,
        },
        actions: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 60,
        },
        declineButton: {
            alignItems: 'center',
            gap: 8,
        },
        declineButtonCircle: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#FF3B30',
            alignItems: 'center',
            justifyContent: 'center',
        },
        answerButton: {
            alignItems: 'center',
            gap: 8,
        },
        answerButtonCircle: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#34C759',
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonText: {
            fontSize: 14,
            color: colors.textMuted,
            marginTop: 4,
        },
    });

export default IncomingCallOverlay;
