import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: any;
}

const SkeletonItem: React.FC<SkeletonProps> = ({ width = '100%', height = 16, borderRadius = 8, style }) => {
    const { colors } = useTheme();
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [opacity]);

    return (
        <Animated.View style={[{ width: width as any, height, borderRadius, backgroundColor: colors.border, opacity }, style]} />
    );
};

export const MessageSkeleton: React.FC = () => (
    <View style={skStyles.messageRow}>
        <SkeletonItem width={36} height={36} borderRadius={18} />
        <View style={skStyles.messageContent}>
            <SkeletonItem width={100} height={12} />
            <SkeletonItem width="80%" height={14} style={{ marginTop: 6 }} />
            <SkeletonItem width="50%" height={14} style={{ marginTop: 4 }} />
        </View>
    </View>
);

export const ChannelSkeleton: React.FC = () => (
    <View style={skStyles.channelRow}>
        <SkeletonItem width={20} height={20} borderRadius={4} />
        <SkeletonItem width={120} height={14} />
    </View>
);

export const CardSkeleton: React.FC = () => (
    <View style={skStyles.card}>
        <SkeletonItem width="60%" height={16} />
        <SkeletonItem width="100%" height={12} style={{ marginTop: 8 }} />
        <SkeletonItem width="40%" height={12} style={{ marginTop: 4 }} />
    </View>
);

export const FeedSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <View style={skStyles.feedContainer}>
        {Array.from({ length: count }).map((_, i) => (
            <View key={i} style={skStyles.feedItem}>
                <View style={skStyles.feedHeader}>
                    <SkeletonItem width={40} height={40} borderRadius={20} />
                    <View style={{ flex: 1, gap: 4 }}>
                        <SkeletonItem width={120} height={14} />
                        <SkeletonItem width={80} height={10} />
                    </View>
                </View>
                <SkeletonItem width="100%" height={60} style={{ marginTop: 12 }} borderRadius={8} />
                <View style={skStyles.feedActions}>
                    <SkeletonItem width={60} height={12} />
                    <SkeletonItem width={60} height={12} />
                    <SkeletonItem width={60} height={12} />
                </View>
            </View>
        ))}
    </View>
);

const skStyles = StyleSheet.create({
    messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
    messageContent: { flex: 1, gap: 2 },
    channelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 16 },
    card: { padding: 16, borderRadius: 12, marginBottom: 12 },
    feedContainer: { padding: 16, gap: 16 },
    feedItem: { padding: 16, borderRadius: 12, gap: 4 },
    feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    feedActions: { flexDirection: 'row', gap: 24, marginTop: 12 },
});

export default SkeletonItem;
