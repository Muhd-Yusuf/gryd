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
    Image,
    Platform,
    Animated,
    Modal,
    Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme } from '../../lib/theme';

// Common emoji set
const EMOJI_SET = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
    '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
    '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
    '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
    '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🙏',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '💯', '💢', '💥', '💫', '💦', '💨', '🔥', '✨', '⭐', '🌟',
];

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
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [message, setMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const recordingRef = useRef<Audio.Recording | null>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const waveformAnims = useRef(
        Array.from({ length: 20 }, () => new Animated.Value(0.3))
    ).current;

    const hasContent = message.trim().length > 0 || pendingAttachments.length > 0;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(() => {});
            }
        };
    }, []);

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

    const handleEmojiSelect = useCallback((emoji: string) => {
        setMessage(prev => prev + emoji);
    }, []);

    const startRecording = useCallback(async () => {
        if (Platform.OS === 'web') {
            // Web recording not fully supported
            return;
        }

        try {
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) return;

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingDuration(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording:', err);
        }
    }, []);

    const stopRecording = useCallback(async (send: boolean) => {
        if (!recordingRef.current) return;

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();

            if (send && uri && onSendVoice) {
                onSendVoice(uri, recordingDuration * 1000);
            }

            recordingRef.current = null;
            setIsRecording(false);
            setRecordingDuration(0);
        } catch (err) {
            console.error('Failed to stop recording:', err);
            setIsRecording(false);
            setRecordingDuration(0);
        }
    }, [recordingDuration, onSendVoice]);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Render recording UI
    if (isRecording) {
        return (
            <View style={[styles.container, { backgroundColor: colors.appBg }]}>
                <View style={styles.recordingContainer}>
                    <View style={styles.recordingRow}>
                        {/* Cancel button */}
                        <TouchableOpacity
                            style={[styles.recordingBtn, { backgroundColor: colors.surfaceMuted }]}
                            onPress={() => stopRecording(false)}
                        >
                            <MaterialIcons name="delete" size={24} color="#EF4444" />
                        </TouchableOpacity>

                        {/* Waveform or indicator */}
                        <View style={[styles.waveformContainer, { backgroundColor: colors.surfaceMuted }]}>
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
                            style={[styles.recordingBtn, { backgroundColor: '#22C55E' }]}
                            onPress={() => stopRecording(true)}
                        >
                            <MaterialIcons name="send" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.appBg }]}>
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
                                <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
                            ) : (
                                <View style={[styles.attachmentFileThumb, { backgroundColor: colors.surfaceMuted }]}>
                                    <MaterialIcons name="insert-drive-file" size={24} color={colors.textMuted} />
                                </View>
                            )}
                            {onRemoveAttachment && (
                                <TouchableOpacity
                                    style={styles.attachmentRemove}
                                    onPress={() => onRemoveAttachment(index)}
                                >
                                    <MaterialIcons name="close" size={14} color="#FFFFFF" />
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
                        style={[styles.iconButton, { backgroundColor: colors.surfaceMuted }]}
                        onPress={onAttachFile || onAttachImage}
                        disabled={disabled}
                    >
                        <MaterialIcons name="add" size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                )}

                {/* Input wrapper */}
                <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceMuted }]}>
                    {/* Emoji button */}
                    <TouchableOpacity
                        style={styles.inputIconBtn}
                        onPress={() => setShowEmojiPicker(true)}
                        disabled={disabled}
                    >
                        <MaterialIcons name="emoji-emotions" size={22} color={colors.textMuted} />
                    </TouchableOpacity>

                    {/* Text input */}
                    <TextInput
                        style={[styles.textInput, { color: colors.text }]}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textMuted}
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        maxLength={2000}
                        editable={!disabled}
                    />

                    {/* Image attachment */}
                    {onAttachImage && (
                        <TouchableOpacity
                            style={styles.inputIconBtn}
                            onPress={onAttachImage}
                            disabled={disabled}
                        >
                            <MaterialIcons name="image" size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Send or Mic button */}
                {hasContent ? (
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: colors.primary }]}
                        onPress={handleSend}
                        disabled={disabled}
                    >
                        <MaterialIcons name="send" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                ) : enableVoiceRecording && Platform.OS !== 'web' ? (
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: colors.surfaceMuted }]}
                        onPress={startRecording}
                        disabled={disabled}
                    >
                        <MaterialIcons name="mic" size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Emoji picker modal */}
            <Modal
                visible={showEmojiPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowEmojiPicker(false)}
            >
                <Pressable
                    style={styles.emojiOverlay}
                    onPress={() => setShowEmojiPicker(false)}
                >
                    <Pressable
                        style={[styles.emojiPicker, { backgroundColor: colors.surface }]}
                        onPress={e => e.stopPropagation()}
                    >
                        <View style={styles.emojiHeader}>
                            <Text style={[styles.emojiTitle, { color: colors.text }]}>Emoji</Text>
                            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                                <MaterialIcons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.emojiScroll}>
                            <View style={styles.emojiGrid}>
                                {EMOJI_SET.map((emoji, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.emojiBtn}
                                        onPress={() => {
                                            handleEmojiSelect(emoji);
                                            setShowEmojiPicker(false);
                                        }}
                                    >
                                        <Text style={styles.emojiText}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        composerRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
        },
        iconButton: {
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
        },
        inputWrapper: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            borderRadius: 24,
            paddingHorizontal: 4,
            minHeight: 48,
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
            paddingHorizontal: 4,
            ...(Platform.OS === 'web' ? { outline: 'none' } : {}),
        },
        sendButton: {
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
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
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
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
        // Emoji picker
        emojiOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        emojiPicker: {
            width: '90%',
            maxWidth: 400,
            maxHeight: 400,
            borderRadius: 20,
            padding: 16,
        },
        emojiHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        emojiTitle: {
            fontSize: 18,
            fontWeight: '600',
        },
        emojiScroll: {
            flex: 1,
        },
        emojiGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        emojiBtn: {
            width: '12.5%',
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        emojiText: {
            fontSize: 24,
        },
    });

export default MessageComposer;
