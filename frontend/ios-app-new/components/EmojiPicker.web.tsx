/**
 * EmojiPicker - Web version using emoji-mart
 * Provides a WhatsApp-like emoji picker experience
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../lib/theme';

// Import emoji-mart dynamically for web
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface EmojiPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelectEmoji: (emoji: string) => void;
}

export default function EmojiPicker({ visible, onClose, onSelectEmoji }: EmojiPickerProps) {
    const { colors, mode } = useTheme();
    const pickerRef = useRef<HTMLDivElement>(null);

    const handleEmojiSelect = (emoji: any) => {
        // emoji-mart returns an object with native property containing the emoji
        onSelectEmoji(emoji.native);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.container, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Emojis</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.pickerContainer}>
                        <Picker
                            data={data}
                            onEmojiSelect={handleEmojiSelect}
                            theme={mode}
                            previewPosition="none"
                            skinTonePosition="search"
                            navPosition="bottom"
                            perLine={8}
                            emojiSize={28}
                            emojiButtonSize={36}
                            maxFrequentRows={2}
                            searchPosition="sticky"
                            set="native"
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        maxWidth: 352,
        maxHeight: 450,
        width: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
    pickerContainer: {
        flex: 1,
    },
});
