/**
 * Centralized Message Composer Component
 * Unified input with emoji, attachments, and voice recording
 * Used across Member Web, Member Mobile, and CU Admin views
 */

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Platform,
    Animated,
    KeyboardAvoidingView,
    InputAccessoryView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, Send, File, X, Plus, Smile, Mic } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../../lib/theme';

export interface PendingAttachment {
    uri: string;
    name: string;
    type: string;
    size?: number;
}

export interface MessageComposerProps {
    onSend: (message: string, attachments: PendingAttachment[]) => void;
    onAttachImage?: () => void;
    onAttachFile?: () => void;
    placeholder?: string;
    disabled?: boolean;
    // Voice recording
    enableVoiceRecording?: boolean;
    onSendVoice?: (uri: string, duration: number) => void;
    // Attachments
    pendingAttachments?: PendingAttachment[];
    onRemoveAttachment?: (index: number) => void;
    // Waveform animation style (mobile style with bars)
    showWaveform?: boolean;
    // Safe area handling - when true, adds bottom padding for device safe area (iOS home indicator, Android nav buttons)
    useSafeArea?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
    onSend,
    onAttachImage,
    onAttachFile,
    placeholder = 'Type a message...',
    disabled = false,
    enableVoiceRecording = true,
    onSendVoice,
    pendingAttachments = [],
    onRemoveAttachment,
    showWaveform = true,
    useSafeArea = true,
}) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    // Calculate bottom padding: use safe area inset on mobile (iOS/Android), minimum 12px
    const bottomPadding = useSafeArea && Platform.OS !== 'web'
        ? Math.max(insets.bottom, 12)
        : 12;
    const styles = useMemo(() => createStyles(colors, bottomPadding), [colors, bottomPadding]);

    const [message, setMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const inputAccessoryViewID = 'messageComposerAccessory';
    const [recordingDuration, setRecordingDuration] = useState(0);

    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const waveformAnims = useRef(
        Array.from({ length: 20 }, () => new Animated.Value(0.3))
    ).current;

    // expo-audio recorder hook (for native platforms)
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

    const hasContent = message.trim().length > 0 || pendingAttachments.length > 0;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            if (audioRecorder.isRecording) {
                audioRecorder.stop().catch(() => {});
            }
        };
    }, [audioRecorder]);

    // Waveform animation
    useEffect(() => {
        if (isRecording && showWaveform) {
            const animations = waveformAnims.map((anim, i) =>
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: Math.random() * 0.7 + 0.3,
                            duration: 150 + Math.random() * 100,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0.3,
                            duration: 150 + Math.random() * 100,
                            useNativeDriver: true,
                        }),
                    ])
                )
            );
            animations.forEach(a => a.start());
            return () => animations.forEach(a => a.stop());
        }
    }, [isRecording, showWaveform, waveformAnims]);

    const handleSend = useCallback(() => {
        if (!hasContent) return;
        onSend(message.trim(), pendingAttachments);
        setMessage('');
    }, [message, pendingAttachments, hasContent, onSend]);


    const startRecording = useCallback(async () => {
        if (Platform.OS === 'web') {
            // Web recording not fully supported
            return;
        }

        try {
            const permission = await AudioModule.requestRecordingPermissionsAsync();
            if (!permission.granted) return;

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();

            setIsRecording(true);
            setRecordingDuration(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording:', err);
        }
    }, [audioRecorder]);

    const stopRecording = useCallback(async (send: boolean) => {
        if (!audioRecorder.isRecording) return;

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        try {
            await audioRecorder.stop();
            const uri = audioRecorder.uri;

            if (send && uri && onSendVoice) {
                onSendVoice(uri, recordingDuration * 1000);
            }

            setIsRecording(false);
            setRecordingDuration(0);
        } catch (err) {
            console.error('Failed to stop recording:', err);
            setIsRecording(false);
            setRecordingDuration(0);
        }
    }, [audioRecorder, recordingDuration, onSendVoice]);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Render recording UI
    if (isRecording) {
        return (
            <View style={styles.container}>
                <View style={styles.recordingContainer}>
                    <View style={styles.recordingRow}>
                        {/* Cancel button */}
                        <TouchableOpacity
                            style={[styles.recordingBtn, { borderColor: 'rgba(239,68,68,0.45)' }]}
                            onPress={() => stopRecording(false)}
                        >
                            <LinearGradient
                                colors={['rgba(239,68,68,0.28)', 'rgba(220,38,38,0.18)']}
                                style={StyleSheet.absoluteFill}
                            />
                            <Trash2 size={22} color="#EF4444" />
                        </TouchableOpacity>

                        {/* Waveform or indicator */}
                        <View style={[styles.waveformContainer, { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder }]}>
                            {showWaveform ? (
                                <View style={styles.waveformBars}>
                                    {waveformAnims.map((anim, i) => (
                                        <Animated.View
                                            key={i}
                                            style={[
                                                styles.waveformBar,
                                                {
                                                    backgroundColor: colors.primary,
                                                    transform: [{ scaleY: anim }],
                                                },
                                            ]}
                                        />
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.recordingIndicator}>
                                    <View style={styles.recordingDot} />
                                    <Text style={[styles.recordingText, { color: colors.text }]}>
                                        Recording
                                    </Text>
                                </View>
                            )}
                            <Text style={[styles.recordingTimer, { color: colors.textMuted }]}>
                                {formatDuration(recordingDuration)}
                            </Text>
                        </View>

                        {/* Send button */}
                        <TouchableOpacity
                            style={[styles.recordingBtn, { borderColor: 'rgba(34,197,94,0.55)' }]}
                            onPress={() => stopRecording(true)}
                        >
                            <LinearGradient
                                colors={['rgba(74,222,128,0.40)', 'rgba(34,197,94,0.30)', 'rgba(22,163,74,0.22)']}
                                style={StyleSheet.absoluteFill}
                            />
                            <Send size={22} color="#22C55E" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Pending attachments preview */}
            {pendingAttachments.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.attachmentPreview}
                    contentContainerStyle={styles.attachmentPreviewContent}
                >
                    {pendingAttachments.map((att, index) => (
                        <View key={index} style={styles.attachmentItem}>
                            {att.type.startsWith('image/') ? (
                                <Image source={{ uri: att.uri }} style={styles.attachmentThumb} cachePolicy="memory-disk" />
                            ) : (
                                <View style={[styles.attachmentFileThumb, { backgroundColor: colors.glassBg }]}>
                                    <File size={24} color={colors.textMuted} />
                                </View>
                            )}
                            {onRemoveAttachment && (
                                <TouchableOpacity
                                    style={styles.attachmentRemove}
                                    onPress={() => onRemoveAttachment(index)}
                                >
                                    <X size={14} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Composer row */}
            <View style={styles.composerRow}>
                {/* Add attachment button */}
                {(onAttachImage || onAttachFile) && (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={onAttachFile || onAttachImage}
                        disabled={disabled}
                    >
                        <LinearGradient
                            colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                            style={StyleSheet.absoluteFill}
                        />
                        <Plus size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                )}

                {/* Input wrapper */}
                <View style={[styles.inputWrapper, { backgroundColor: colors.glassBg }]}>
                    {/* Text input - uses native keyboard with emoji support */}
                    <TextInput
                        ref={inputRef}
                        style={[styles.textInput, { color: colors.text }]}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textMuted}
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        maxLength={2000}
                        editable={!disabled}
                        returnKeyType="default"
                        blurOnSubmit={false}
                        // Enable native emoji keyboard access
                        keyboardType="default"
                        // iOS InputAccessoryView ID for keyboard toolbar
                        inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined}
                    />

                    {/* Send button inside input wrapper - always visible */}
                    <TouchableOpacity
                        style={[
                            styles.inlineSendButton,
                            { borderColor: hasContent ? 'rgba(100,168,255,0.55)' : 'rgba(255,255,255,0.14)' },
                        ]}
                        onPress={handleSend}
                        disabled={disabled || !hasContent}
                    >
                        <LinearGradient
                            colors={hasContent
                                ? ['rgba(120,175,255,0.45)', 'rgba(59,130,246,0.35)', 'rgba(37,99,235,0.28)']
                                : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']}
                            style={StyleSheet.absoluteFill}
                        />
                        <Send size={18} color={hasContent ? '#FFFFFF' : colors.textSubtle} />
                    </TouchableOpacity>
                </View>

                {/* Mic button for voice recording - only on mobile when no content */}
                {Platform.OS !== 'web' && !hasContent && enableVoiceRecording && (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={startRecording}
                        disabled={disabled}
                    >
                        <LinearGradient
                            colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
                            style={StyleSheet.absoluteFill}
                        />
                        <Mic size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                )}

                {/* Send button - only show on web */}
                {Platform.OS === 'web' && hasContent && (
                    <TouchableOpacity
                        style={styles.sendButton}
                        onPress={handleSend}
                        disabled={disabled}
                    >
                        <LinearGradient
                            colors={['rgba(120,175,255,0.45)', 'rgba(59,130,246,0.35)', 'rgba(37,99,235,0.28)']}
                            style={StyleSheet.absoluteFill}
                        />
                        <Send size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* iOS InputAccessoryView - keeps send button visible above keyboard */}
            {Platform.OS === 'ios' && (
                <InputAccessoryView nativeID={inputAccessoryViewID}>
                    <View style={[styles.accessoryContainer, { backgroundColor: 'transparent', borderTopColor: colors.glassBorder }]}>
                        <View style={[styles.accessoryInputWrapper, { backgroundColor: colors.glassBg }]}>
                            <Text style={[styles.accessoryPreview, { color: colors.textMuted }]} numberOfLines={1}>
                                {message || placeholder}
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.accessorySendButton,
                                    { backgroundColor: hasContent ? colors.primary : colors.glassBg }
                                ]}
                                onPress={handleSend}
                                disabled={disabled || !hasContent}
                            >
                                <Send
                                    size={18}
                                    color={hasContent ? '#FFFFFF' : colors.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </InputAccessoryView>
            )}
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors'], bottomPadding: number = 12) =>
    StyleSheet.create({
        container: {
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: bottomPadding,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
            ...(Platform.OS === 'web' ? {
                // @ts-ignore
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
            } : {}),
        },
        composerRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
        },
        iconButton: {
            width: 44,
            height: 44,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.28)',
            overflow: 'hidden',
        },
        inputWrapper: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            borderRadius: 24,
            paddingHorizontal: 4,
            minHeight: 48,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            shadowColor: colors.glassShadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 3,
        },
        inputIconBtn: {
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
        },
        textInput: {
            flex: 1,
            fontSize: 15,
            maxHeight: 120,
            paddingVertical: 12,
            paddingHorizontal: 12,
            ...(Platform.OS === 'web' ? { outline: 'none' } : {}),
        },
        sendButton: {
            width: 44,
            height: 44,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(100,168,255,0.55)',
            overflow: 'hidden',
        },
        inlineSendButton: {
            width: 36,
            height: 36,
            borderRadius: 11,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 4,
            marginBottom: 6,
            borderWidth: 1,
            overflow: 'hidden',
        },
        // Attachment preview
        attachmentPreview: {
            marginBottom: 12,
        },
        attachmentPreviewContent: {
            gap: 8,
        },
        attachmentItem: {
            position: 'relative',
        },
        attachmentThumb: {
            width: 60,
            height: 60,
            borderRadius: 8,
        },
        attachmentFileThumb: {
            width: 60,
            height: 60,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
        },
        attachmentRemove: {
            position: 'absolute',
            top: -6,
            right: -6,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#EF4444',
            justifyContent: 'center',
            alignItems: 'center',
        },
        // Recording UI
        recordingContainer: {
            paddingVertical: 4,
        },
        recordingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        recordingBtn: {
            width: 44,
            height: 44,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            overflow: 'hidden',
        },
        waveformContainer: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 22,
            paddingHorizontal: 16,
            height: 44,
        },
        waveformBars: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            height: 24,
        },
        waveformBar: {
            width: 3,
            height: '100%',
            borderRadius: 1.5,
        },
        recordingIndicator: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        recordingDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#EF4444',
        },
        recordingText: {
            fontSize: 14,
            fontWeight: '500',
        },
        recordingTimer: {
            fontSize: 13,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            marginLeft: 12,
        },
        // iOS InputAccessoryView styles
        accessoryContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderTopWidth: 1,
        },
        accessoryInputWrapper: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        accessoryPreview: {
            flex: 1,
            fontSize: 14,
        },
        accessorySendButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 8,
        },
    });

export default MessageComposer;
