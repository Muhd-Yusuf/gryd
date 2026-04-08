import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/theme';

interface ShimmerOverlayProps {
    width: number;
    height: number;
    style?: ViewStyle;
    /** If false, shimmer stops */
    isActive?: boolean;
    /** Loop continuously or sweep once */
    loop?: boolean;
}

const ShimmerOverlay = ({ width, height, style, isActive = true, loop = true }: ShimmerOverlayProps) => {
    const { colors } = useTheme();
    const translateX = useRef(new Animated.Value(-width)).current;

    useEffect(() => {
        if (!isActive) {
            translateX.setValue(-width);
            return;
        }

        const anim = loop
            ? Animated.loop(
                Animated.timing(translateX, {
                    toValue: width,
                    duration: 1400,
                    useNativeDriver: true,
                })
            )
            : Animated.timing(translateX, {
                toValue: width,
                duration: 700,
                useNativeDriver: true,
            });

        anim.start();
        return () => anim.stop();
    }, [isActive, width, loop]);

    if (!isActive) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 12 }, style]}>
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    { transform: [{ translateX }] },
                ]}
            >
                <LinearGradient
                    colors={colors.metallicShimmer as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: width * 2, height }}
                />
            </Animated.View>
        </View>
    );
};

export default ShimmerOverlay;
