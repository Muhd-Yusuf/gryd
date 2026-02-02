/**
 * Centralized Message Bubble Component
 * Used across Member Web, Member Mobile, and CU Admin views
 */

import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import UserAvatar from '../UserAvatar';
import VoiceMessagePlayer from '../VoiceMessagePlayer';

export interface Attachment {
    url: string;
    type: 'image' | 'video' | 'audio' | 'file' | 'emoji' | 'sticker';
    name?: string;
    mimeType?: string;
    size?: number;
    duration?: number;
    durationMs?: number;
}

export interface MessageBubbleProps {
    messageId: string;
    body?: string;
    attachments?: Attachment[];
    senderId?: string;
    senderName?: string;
    senderAvatar?: string;
    timestamp?: string;
    isSelf: boolean;
    showSenderName?: boolean;
    showAvatar?: boolean;
    // Call history support
    isCallHistory?: boolean;
    callType?: 'audio' | 'video' | 'voice';
    callDuration?: number;
    callStatus?: 'ended' | 'missed' | 'declined' | 'cancelled';
    isOutgoing?: boolean;
    // Actions
    onDelete?: (messageId: string) => void;
    onCallAgain?: (callType: 'audio' | 'video') => void;
    canDelete?: boolean;
}

const formatTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatCallDuration = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    messageId,
    body,
    attachments = [],
    senderId,
    senderName,
    senderAvatar,
    timestamp,
    isSelf,
    showSenderName = false,
    showAvatar = true,
    isCallHistory = false,
    callType,
    callDuration,
    callStatus,
    isOutgoing = false,
    onDelete,
    onCallAgain,
    canDelete = false,
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Render call history item
    if (isCallHistory || callType) {
        const isMissedOrDeclined = callStatus === 'missed' || callStatus === 'declined' || callStatus === 'cancelled';
        const callIcon = callType === 'video' ? 'videocam' : 'phone';
        const arrowIcon = isOutgoing ? 'call-made' : 'call-received';
        const arrowColor = isMissedOrDeclined ? '#EF4444' : '#22C55E';

        let callLabel = callType === 'video' ? 'Video call' : 'Voice call';
        if (callStatus === 'cancelled') callLabel = 'Cancelled';
        else if (callStatus === 'missed') callLabel = 'Missed';
        else if (callStatus === 'declined') callLabel = 'Declined';

        return (
            <View style={[styles.messageRow, isSelf && styles.messageRowSelf]}>
                <TouchableOpacity
                    style={styles.callHistoryItem}
                    onPress={() => onCallAgain?.(callType === 'video' ? 'video' : 'audio')}
                    activeOpacity={0.7}
                >
                    <View style={styles.callHistoryIconWrap}>
                        <MaterialIcons name={callIcon} size={20} color={colors.primary} />
                    </View>
                    <View style={styles.callHistoryInfo}>
                        <View style={styles.callHistoryRow}>
                            <MaterialIcons name={arrowIcon} size={14} color={arrowColor} />
                            <Text style={[styles.callHistoryLabel, { color: colors.text }]}>
                                {callLabel}
                            </Text>
                        </View>
                        <Text style={[styles.callHistoryTime, { color: colors.textMuted }]}>
                            {callDuration && callDuration > 0
                                ? formatCallDuration(callDuration)
                                : formatTime(timestamp)}
                        </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>
        );
    }

    // Render attachments
    const renderAttachments = () => {
        if (!attachments || attachments.length === 0) return null;

        return (
            <View style={styles.attachmentContainer}>
                {attachments.map((attachment, index) => {
                    const key = `${messageId}-attachment-${index}`;

                    // Audio/Voice message
                    if (attachment.type === 'audio') {
                        return (
                            <VoiceMessagePlayer
                                key={key}
                                value={attachment.url}
                                durationMs={attachment.durationMs || attachment.duration}
                            />
                        );
                    }

                    // Image or Sticker
                    if (attachment.type === 'image' || attachment.type === 'sticker' || attachment.type === 'emoji') {
                        const isSticker = attachment.type === 'sticker' || attachment.type === 'emoji';
                        return (
                            <Image
                                key={key}
                                source={{ uri: attachment.url }}
                                style={isSticker ? styles.stickerImage : styles.attachmentImage}
                                resizeMode="cover"
                            />
                        );
                    }

                    // File
                    if (attachment.type === 'file') {
                        return (
                            <TouchableOpacity
                                key={key}
                                style={[styles.fileBubble, { backgroundColor: isSelf ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' }]}
                                onPress={() => {
                                    if (Platform.OS === 'web') {
                                        window.open(attachment.url, '_blank');
                                    }
                                }}
                            >
                                <MaterialIcons
                                    name="insert-drive-file"
                                    size={20}
                                    color={isSelf ? 'rgba(255,255,255,0.8)' : colors.textMuted}
                                />
                                <Text
                                    style={[styles.fileName, { color: isSelf ? '#FFFFFF' : colors.text }]}
                                    numberOfLines={1}
                                >
                                    {attachment.name || 'File'}
                                </Text>
                            </TouchableOpacity>
                        );
                    }

                    return null;
                })}
            </View>
        );
    };

    return (
        <View style={[styles.messageRow, isSelf && styles.messageRowSelf]}>
            {/* Avatar for received messages */}
            {!isSelf && showAvatar && (
                <UserAvatar
                    uri={senderAvatar}
                    name={senderName || 'User'}
                    style={styles.avatar}
                />
            )}

            {/* Message bubble */}
            <View
                style={[
                    styles.messageBubble,
                    isSelf ? styles.messageBubbleSelf : styles.messageBubbleOther,
                    { backgroundColor: isSelf ? colors.primary : colors.surfaceMuted },
                ]}
            >
                {/* Sender name for group chats */}
                {showSenderName && !isSelf && senderName && (
                    <Text style={[styles.senderName, { color: colors.primary }]}>
                        {senderName}
                    </Text>
                )}

                {/* Attachments */}
                {renderAttachments()}

                {/* Message text */}
                {body && body.trim() && (
                    <Text style={[styles.messageText, isSelf && styles.messageTextSelf]}>
                        {body}
                    </Text>
                )}

                {/* Timestamp */}
                <Text style={[styles.timestamp, isSelf && styles.timestampSelf]}>
                    {formatTime(timestamp)}
                </Text>
            </View>

            {/* Delete button for own messages */}
            {isSelf && canDelete && onDelete && (
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => onDelete(messageId)}
                >
                    <MaterialIcons name="delete-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        messageRow: {
            flexDirection: 'row',
            marginBottom: 12,
            gap: 8,
            alignItems: 'flex-end',
            paddingHorizontal: 16,
        },
        messageRowSelf: {
            flexDirection: 'row-reverse',
        },
        avatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
        },
        messageBubble: {
            maxWidth: '75%',
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexShrink: 1,
        },
        messageBubbleSelf: {
            borderBottomRightRadius: 4,
        },
        messageBubbleOther: {
            borderBottomLeftRadius: 4,
        },
        senderName: {
            fontSize: 12,
            fontWeight: '600',
            marginBottom: 4,
        },
        messageText: {
            fontSize: 15,
            lineHeight: 22,
            color: colors.text,
        },
        messageTextSelf: {
            color: '#FFFFFF',
        },
        timestamp: {
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 4,
            alignSelf: 'flex-end',
        },
        timestampSelf: {
            color: 'rgba(255, 255, 255, 0.7)',
        },
        deleteButton: {
            padding: 4,
            marginLeft: 8,
        },
        // Attachments
        attachmentContainer: {
            marginBottom: 4,
            gap: 8,
        },
        attachmentImage: {
            width: 180,
            height: 140,
            borderRadius: 12,
        },
        stickerImage: {
            width: 80,
            height: 80,
        },
        fileBubble: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            borderRadius: 8,
        },
        fileName: {
            fontSize: 13,
            flex: 1,
        },
        // Call history
        callHistoryItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            gap: 12,
            maxWidth: '80%',
        },
        callHistoryIconWrap: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        callHistoryInfo: {
            flex: 1,
        },
        callHistoryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        callHistoryLabel: {
            fontSize: 14,
            fontWeight: '500',
        },
        callHistoryTime: {
            fontSize: 12,
            marginTop: 2,
        },
    });

export default MessageBubble;
