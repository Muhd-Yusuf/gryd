/**
 * Global Incoming Call Overlay
 * Shows incoming call notification regardless of which screen the user is on
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Modal,
    Platform,
} from 'react-native';
import { Phone, Video, PhoneOff } from 'lucide-react-native';
import { useCallContextSafe } from '../contexts/CallContext';
import { useTheme } from '../lib/theme';
import UserAvatar from './UserAvatar';
import { GlassButton, GlassIconButton } from './glass';

const IncomingCallOverlay: React.FC = () => {
    const callContext = useCallContextSafe();
    const { colors } = useTheme();
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Extract values safely
    const incomingCall = callContext?.incomingCall || null;
    const answerCall = callContext?.answerCall || (() => {});
    const declineCall = callContext?.declineCall || (() => {});

    // Pulse animation for the call icon
    useEffect(() => {
        if (incomingCall) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
            return () => animation.stop();
        }
    }, [incomingCall, pulseAnim]);

    // Don't render if no incoming call or context not available
    if (!callContext || !incomingCall) {
        return null;
    }

    const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

    if (isMobile) {
        // Mobile: Top banner style
        return (
            <Modal
                visible={true}
                transparent
                animationType="slide"
                statusBarTranslucent
            >
                <View style={styles.bannerContainer}>
                    <View style={[styles.banner, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderWidth: 1 }]}>
                        <View style={styles.bannerLeft}>
                            <UserAvatar
                                uri={incomingCall.callerAvatar}
                                name={incomingCall.callerName}
                                style={[styles.bannerAvatar, { borderColor: colors.successText }]}
                            />
                            <View style={styles.bannerInfo}>
                                <Text style={[styles.bannerName, { color: colors.text }]} numberOfLines={1}>
                                    {incomingCall.callerName}
                                </Text>
                                <View style={styles.bannerType}>
                                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                        {incomingCall.callType === 'video' ? (
                                            <Video size={14} color={colors.successText} />
                                        ) : (
                                            <Phone size={14} color={colors.successText} />
                                        )}
                                    </Animated.View>
                                    <Text style={[styles.bannerTypeText, { color: colors.textMuted }]}>
                                        {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.bannerActions}>
                            <GlassIconButton
                                icon={<PhoneOff size={20} color={colors.dangerText} />}
                                onPress={declineCall}
                                variant="danger"
                                size="sm"
                            />
                            <GlassIconButton
                                icon={incomingCall.callType === 'video' ? (
                                    <Video size={20} color="#FFFFFF" />
                                ) : (
                                    <Phone size={20} color="#FFFFFF" />
                                )}
                                onPress={answerCall}
                                variant="active"
                                size="sm"
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    // Web: Centered card style
    return (
        <Modal
            visible={true}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.container}>
                <View style={[styles.backdrop, { backgroundColor: colors.overlay }]} />
                <View style={[styles.card, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderWidth: 1 }]}>
                    <View style={styles.header}>
                        <Text style={[styles.callLabel, { color: colors.textMuted }]}>
                            Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
                        </Text>
                    </View>

                    <View style={styles.callerInfo}>
                        <UserAvatar
                            uri={incomingCall.callerAvatar}
                            name={incomingCall.callerName}
                            style={[styles.avatar, { borderColor: colors.successText }]}
                        />
                        <Text style={[styles.callerName, { color: colors.text }]}>
                            {incomingCall.callerName}
                        </Text>
                        <Animated.View
                            style={[
                                styles.pulseIcon,
                                { backgroundColor: colors.successBg, transform: [{ scale: pulseAnim }] },
                            ]}
                        >
                            {incomingCall.callType === 'video' ? (
                                <Video size={24} color={colors.successText} />
                            ) : (
                                <Phone size={24} color={colors.successText} />
                            )}
                        </Animated.View>
                    </View>

                    <View style={styles.actions}>
                        <View style={styles.actionWrap}>
                            <GlassButton
                                label="Decline"
                                onPress={declineCall}
                                variant="danger"
                                size="md"
                                icon={<PhoneOff size={18} color={colors.dangerText} />}
                            />
                        </View>

                        <View style={styles.actionWrap}>
                            <GlassButton
                                label="Answer"
                                onPress={answerCall}
                                variant="primary"
                                size="md"
                                icon={incomingCall.callType === 'video' ? (
                                    <Video size={18} color="#FFFFFF" />
                                ) : (
                                    <Phone size={18} color="#FFFFFF" />
                                )}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    // Mobile banner styles
    bannerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 50,
        paddingHorizontal: 12,
        zIndex: 9999,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 15,
    },
    bannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    bannerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
    },
    bannerInfo: {
        marginLeft: 12,
        flex: 1,
    },
    bannerName: {
        fontSize: 16,
        fontWeight: '700',
    },
    bannerType: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    bannerTypeText: {
        fontSize: 13,
        fontWeight: '500',
    },
    bannerActions: {
        flexDirection: 'row',
        gap: 10,
        marginLeft: 12,
    },
    // Web centered card styles
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    card: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20,
    },
    header: {
        marginBottom: 24,
    },
    callLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    callerInfo: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
        borderWidth: 3,
    },
    callerName: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 12,
    },
    pulseIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
    },
    actionWrap: {
        alignItems: 'center',
    },
});

export default IncomingCallOverlay;
