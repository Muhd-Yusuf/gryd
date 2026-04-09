import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../lib/theme';

export const NetworkIndicator: React.FC = () => {
    const { colors } = useTheme();
    const [isOffline, setIsOffline] = useState(false);
    const [opacity] = useState(new Animated.Value(0));

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            const offline = !(state.isConnected && state.isInternetReachable !== false);
            setIsOffline(offline);
            Animated.timing(opacity, {
                toValue: offline ? 1 : 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        });
        return () => unsubscribe();
    }, [opacity]);

    if (!isOffline) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity,
                    backgroundColor: colors.dangerBg,
                    borderColor: colors.glassBorder,
                    top: Platform.OS === 'ios' ? 50 : 30,
                },
            ]}
        >
            <Text style={[styles.text, { color: colors.dangerText }]}>No internet connection</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        borderRadius: 8,
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
    },
});
