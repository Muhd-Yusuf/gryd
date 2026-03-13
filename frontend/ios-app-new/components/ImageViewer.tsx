import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Dimensions, Platform, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { X, Download } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface ImageViewerProps {
    visible: boolean;
    imageUrl: string;
    onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ visible, imageUrl, onClose }) => {
    const { width, height } = Dimensions.get('window');

    const handleDownload = async () => {
        if (Platform.OS === 'web') {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `image_${Date.now()}.jpg`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        try {
            const filename = `image_${Date.now()}.jpg`;
            const fileUri = FileSystem.documentDirectory + filename;
            await FileSystem.downloadAsync(imageUrl, fileUri);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            }
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={[styles.overlay, { width, height }]}>
                <StatusBar barStyle="light-content" />
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <X size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                    <Download size={24} color="#fff" />
                </TouchableOpacity>
                <Image
                    source={{ uri: imageUrl }}
                    style={{ width: width * 0.95, height: height * 0.75 }}
                    resizeMode="contain"
                    cachePolicy="memory-disk"
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
    downloadButton: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 8 },
});
