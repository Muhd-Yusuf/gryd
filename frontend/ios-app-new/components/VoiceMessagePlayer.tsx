/**
 * VoiceMessagePlayer Component
 * Reusable audio player with play/pause, progress bar, and duration display
 * Works on both web and mobile platforms
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Animated,
} from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';

interface VoiceMessagePlayerProps {
    source: string;
    durationMs?: number;
    colors: {
        primary: string;
        text: string;
        textMuted: string;
        surface: string;
        surfaceMuted: string;
    };
    compact?: boolean;
}

// Global audio manager to ensure only one audio plays at a time
let currentlyPlayingId: string | null = null;
let stopCurrentAudio: (() => void) | null = null;

const formatDuration = (ms?: number): string => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
    source,
    durationMs,
    colors,
    compact = false,
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(durationMs || 0);

    const soundRef = useRef<Audio.Sound | null>(null);
    const webAudioRef = useRef<HTMLAudioElement | null>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const playerId = useRef(`player-${Date.now()}-${Math.random()}`).current;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = useCallback(async () => {
        if (Platform.OS === 'web') {
            if (webAudioRef.current) {
                webAudioRef.current.pause();
                webAudioRef.current.src = '';
                webAudioRef.current = null;
            }
        } else {
            if (soundRef.current) {
                try {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                } catch (e) {
                    // Ignore cleanup errors
                }
                soundRef.current = null;
            }
        }
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        progressAnim.setValue(0);
    }, [progressAnim]);

    // Stop this player if another one starts
    useEffect(() => {
        if (currentlyPlayingId && currentlyPlayingId !== playerId && isPlaying) {
            cleanup();
        }
    }, [currentlyPlayingId, playerId, isPlaying, cleanup]);

    const handlePlayPause = async () => {
        if (!source) return;

        // Stop any other playing audio
        if (currentlyPlayingId && currentlyPlayingId !== playerId && stopCurrentAudio) {
            stopCurrentAudio();
        }

        if (isPlaying) {
            // Pause
            if (Platform.OS === 'web') {
                webAudioRef.current?.pause();
            } else {
                await soundRef.current?.pauseAsync();
            }
            setIsPlaying(false);
            currentlyPlayingId = null;
            stopCurrentAudio = null;
        } else {
            // Play
            setIsLoading(true);
            currentlyPlayingId = playerId;
            stopCurrentAudio = cleanup;

            try {
                if (Platform.OS === 'web') {
                    await playOnWeb();
                } else {
                    await playOnNative();
                }
            } catch (err) {
                console.error('[VoiceMessagePlayer] Failed to play audio:', err);
                setIsLoading(false);
                setIsPlaying(false);
                currentlyPlayingId = null;
                stopCurrentAudio = null;
            }
        }
    };

    const playOnWeb = async () => {
        if (!webAudioRef.current) {
            const audio = new (globalThis as any).Audio(source);
            webAudioRef.current = audio;

            audio.addEventListener('loadedmetadata', () => {
                setDuration(audio.duration * 1000);
                setIsLoading(false);
            });

            audio.addEventListener('timeupdate', () => {
                if (audio.duration) {
                    const prog = audio.currentTime / audio.duration;
                    setProgress(prog);
                    setCurrentTime(audio.currentTime * 1000);
                    progressAnim.setValue(prog);
                }
            });

            audio.addEventListener('ended', () => {
                setIsPlaying(false);
                setProgress(0);
                setCurrentTime(0);
                progressAnim.setValue(0);
                currentlyPlayingId = null;
                stopCurrentAudio = null;
            });

            audio.addEventListener('error', (e: any) => {
                console.error('[VoiceMessagePlayer] Web audio error:', e);
                setIsLoading(false);
                setIsPlaying(false);
            });
        }

        await webAudioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
    };

    const playOnNative = async () => {
        // Set audio mode for playback
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
        });

        if (!soundRef.current) {
            const { sound } = await Audio.Sound.createAsync(
                { uri: source },
                { shouldPlay: true },
                onPlaybackStatusUpdate
            );
            soundRef.current = sound;
        } else {
            // Resume from paused state
            await soundRef.current.playAsync();
        }
        setIsPlaying(true);
        setIsLoading(false);
    };

    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            if (status.error) {
                console.error('[VoiceMessagePlayer] Native audio error:', status.error);
            }
            return;
        }

        if (status.durationMillis) {
            setDuration(status.durationMillis);
        }

        if (status.positionMillis !== undefined && status.durationMillis) {
            const prog = status.positionMillis / status.durationMillis;
            setProgress(prog);
            setCurrentTime(status.positionMillis);
            progressAnim.setValue(prog);
        }

        if (status.didJustFinish) {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
            progressAnim.setValue(0);
            currentlyPlayingId = null;
            stopCurrentAudio = null;
            // Unload to allow replay from beginning
            soundRef.current?.unloadAsync();
            soundRef.current = null;
        }
    };

    const styles = createStyles(colors, compact);

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPause}
                disabled={isLoading}
            >
                {isLoading ? (
                    <View style={styles.loadingDot} />
                ) : isPlaying ? (
                    <Pause size={compact ? 20 : 24} color={colors.primary} />
                ) : (
                    <Play size={compact ? 20 : 24} color={colors.primary} />
                )}
            </TouchableOpacity>

            <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                    <Animated.View
                        style={[
                            styles.progressBarFill,
                            {
                                width: progressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%'],
                                }),
                            },
                        ]}
                    />
                </View>
                <View style={styles.waveformContainer}>
                    {Array.from({ length: compact ? 15 : 20 }).map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.waveformBar,
                                {
                                    height: Math.random() * (compact ? 12 : 16) + (compact ? 4 : 6),
                                    opacity: i / (compact ? 15 : 20) <= progress ? 1 : 0.3,
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>

            <Text style={styles.duration}>
                {isPlaying || currentTime > 0
                    ? formatDuration(currentTime)
                    : formatDuration(duration)}
            </Text>
        </View>
    );
};

const createStyles = (
    colors: VoiceMessagePlayerProps['colors'],
    compact: boolean
) =>
    StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceMuted,
            borderRadius: compact ? 16 : 20,
            paddingHorizontal: compact ? 8 : 12,
            paddingVertical: compact ? 6 : 10,
            gap: compact ? 8 : 10,
            minWidth: compact ? 140 : 180,
            maxWidth: 280,
        },
        playButton: {
            width: compact ? 28 : 36,
            height: compact ? 28 : 36,
            borderRadius: compact ? 14 : 18,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
        },
        loadingDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
            opacity: 0.6,
        },
        progressContainer: {
            flex: 1,
            height: compact ? 20 : 24,
            justifyContent: 'center',
        },
        progressBarBg: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            borderRadius: 2,
            overflow: 'hidden',
        },
        progressBarFill: {
            height: '100%',
            backgroundColor: `${colors.primary}15`,
            borderRadius: 2,
        },
        waveformContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '100%',
            paddingHorizontal: 2,
        },
        waveformBar: {
            width: compact ? 2 : 3,
            backgroundColor: colors.primary,
            borderRadius: 1,
        },
        duration: {
            fontSize: compact ? 11 : 12,
            color: colors.textMuted,
            fontWeight: '500',
            minWidth: compact ? 32 : 38,
            textAlign: 'right',
        },
    });

export default VoiceMessagePlayer;
