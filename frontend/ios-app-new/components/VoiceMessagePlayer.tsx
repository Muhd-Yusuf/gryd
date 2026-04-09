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
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, AudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../lib/theme';

interface VoiceMessagePlayerProps {
    /** Audio source URL */
    source?: string;
    /** Alias for source — accepted for backwards compatibility */
    value?: string;
    durationMs?: number;
    colors?: {
        primary: string;
        text: string;
        textMuted: string;
        surface: string;
        surfaceMuted: string;
        glassBorder?: string;
        glassShadow?: string;
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
    source: sourceProp,
    value,
    durationMs,
    colors: colorsProp,
    compact = false,
}) => {
    const { colors: themeColors } = useTheme();
    const colors = colorsProp ?? themeColors;
    const source = sourceProp ?? value ?? '';
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(durationMs || 0);

    const webAudioRef = useRef<HTMLAudioElement | null>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const playerId = useRef(`player-${Date.now()}-${Math.random()}`).current;

    // Use expo-audio player hook for native playback
    const player = useAudioPlayer(Platform.OS !== 'web' ? source : null);

    // Listen to player status changes on native
    useEffect(() => {
        if (Platform.OS === 'web' || !player) return;

        const updateStatus = () => {
            try {
                if (player.duration > 0) {
                    setDuration(player.duration * 1000);
                }
                if (player.duration > 0) {
                    const prog = player.currentTime / player.duration;
                    setProgress(prog);
                    setCurrentTime(player.currentTime * 1000);
                    progressAnim.setValue(prog);
                }
                setIsPlaying(player.playing);
                if (player.currentTime >= player.duration && player.duration > 0) {
                    setIsPlaying(false);
                    setProgress(0);
                    setCurrentTime(0);
                    progressAnim.setValue(0);
                    currentlyPlayingId = null;
                    stopCurrentAudio = null;
                }
            } catch (err) {
                // Player may be disposed - ignore errors
            }
        };

        const interval = setInterval(updateStatus, 100);
        return () => clearInterval(interval);
    }, [player, progressAnim]);

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
            // Wrap entire player access in try-catch to handle disposed native objects
            try {
                if (player && player.playing) {
                    player.pause();
                }
            } catch (err) {
                // Ignore errors during cleanup - the player may already be disposed
                // This is expected when the component unmounts while audio is playing
            }
        }
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        progressAnim.setValue(0);
    }, [progressAnim, player]);

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
                try {
                    player?.pause();
                } catch (err) {
                    console.log('[VoiceMessagePlayer] Pause error (safe to ignore):', err);
                }
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
        await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
        });

        if (player) {
            player.seekTo(0);
            player.play();
            setIsPlaying(true);
            setIsLoading(false);
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
                <LinearGradient
                    colors={isPlaying
                        ? ['rgba(120,175,255,0.45)', 'rgba(59,130,246,0.32)', 'rgba(37,99,235,0.24)']
                        : ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)']
                    }
                    style={StyleSheet.absoluteFill}
                />
                {isLoading ? (
                    <View style={styles.loadingDot} />
                ) : isPlaying ? (
                    <Pause size={compact ? 18 : 22} color={isPlaying ? '#FFFFFF' : colors.primary} />
                ) : (
                    <Play size={compact ? 18 : 22} color={colors.primary} />
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
            backgroundColor: (colors as any).glassBg ?? 'rgba(255,255,255,0.08)',
            borderRadius: compact ? 14 : 16,
            paddingHorizontal: compact ? 8 : 12,
            paddingVertical: compact ? 6 : 10,
            gap: compact ? 8 : 10,
            minWidth: compact ? 140 : 180,
            maxWidth: 280,
            borderWidth: 1,
            borderColor: (colors as any).glassBorder ?? 'rgba(255,255,255,0.08)',
            shadowColor: (colors as any).glassShadow ?? 'rgba(0,0,0,0.3)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 4,
        },
        playButton: {
            width: compact ? 30 : 38,
            height: compact ? 30 : 38,
            borderRadius: compact ? 10 : 12,
            borderWidth: 1,
            borderColor: (colors as any).glassBorder ?? 'rgba(255,255,255,0.22)',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
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
