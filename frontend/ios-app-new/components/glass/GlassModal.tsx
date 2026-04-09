import React from 'react';
import {
    Modal,
    ModalProps,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { SafeBlurView as BlurView } from '../SafeBlurView';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { useTheme } from '../../lib/theme';
import { BlurView as ExpoBlurView } from 'expo-blur';

interface GlassModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** Footer action buttons */
    footer?: React.ReactNode;
    /** Extra style on the panel */
    panelStyle?: ViewStyle;
    /** Scrollable body */
    scrollable?: boolean;
    animationType?: ModalProps['animationType'];
    /** Max width for web */
    maxWidth?: number;
}

const GlassModal = ({
    visible,
    onClose,
    title,
    children,
    footer,
    panelStyle,
    scrollable = false,
    animationType = 'fade',
    maxWidth = 520,
}: GlassModalProps) => {
    const { colors, mode } = useTheme();

    const panelBg = mode === 'dark'
        ? 'rgba(255,255,255,0.07)'
        : 'rgba(255,255,255,0.85)';

    const body = scrollable ? (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
        >
            {children}
        </ScrollView>
    ) : (
        <View style={styles.body}>{children}</View>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType={animationType}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            {/* Backdrop with blur */}
            <Pressable style={styles.backdrop} onPress={onClose}>
                {Platform.OS !== 'web' ? (
                    <ExpoBlurView
                        intensity={18}
                        tint={mode === 'dark' ? 'dark' : 'light'}
                        style={StyleSheet.absoluteFill}
                    />
                ) : (
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                // @ts-ignore
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                            },
                        ]}
                    />
                )}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: mode === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.35)' }]} />
            </Pressable>

            {/* Panel */}
            <View style={styles.centeredView} pointerEvents="box-none">
                <BlurView
                    intensity={colors.glassBlurIntensity}
                    tint={mode === 'dark' ? 'dark' : 'light'}
                    style={[
                        styles.panel,
                        { borderColor: colors.glassBorder, maxWidth },
                        panelStyle,
                    ]}
                >
                    {/* Panel background */}
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: panelBg, borderRadius: 20 }]} />

                    {/* Metallic gradient overlay */}
                    <LinearGradient
                        colors={mode === 'dark'
                            ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']
                            : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                    />

                    {/* Top edge highlight */}
                    <View style={styles.topHighlight} />

                    {/* Header */}
                    {title && (
                        <View style={[styles.header, { borderBottomColor: colors.glassBorder }]}>
                            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {!title && (
                        <TouchableOpacity onPress={onClose} style={styles.closeBtnAbsolute}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}

                    {/* Body */}
                    {body}

                    {/* Footer */}
                    {footer && (
                        <View style={[styles.footer, { borderTopColor: colors.glassBorder }]}>
                            {footer}
                        </View>
                    )}
                </BlurView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    centeredView: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    panel: {
        width: '100%',
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: 'rgba(0,0,0,0.6)',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 1,
        shadowRadius: 40,
        elevation: 20,
    },
    topHighlight: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.50)',
        borderRadius: 1,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.2,
        flex: 1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.10)',
    },
    closeBtnAbsolute: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.10)',
        zIndex: 10,
    },
    body: {
        padding: 20,
    },
    scrollContent: {
        padding: 20,
    },
    footer: {
        flexDirection: 'row',
        gap: 10,
        padding: 16,
        borderTopWidth: 1,
        justifyContent: 'flex-end',
    },
});

export default GlassModal;
