import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    Easing,
    interpolate
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

interface LoadingViewProps {
    style?: ViewStyle;
    size?: number;
}

export const LoadingView: React.FC<LoadingViewProps> = ({
    style,
    size = 40
}) => {
    const { colors } = useTheme();
    const pulse = useSharedValue(0);

    useEffect(() => {
        pulse.value = withRepeat(
            withTiming(1, {
                duration: 1200,
                easing: Easing.bezier(0.4, 0, 0.2, 1)
            }),
            -1,
            true
        );
    }, [pulse]);

    const dotStyle = useAnimatedStyle(() => {
        const scale = interpolate(pulse.value, [0, 1], [0.8, 1.2]);
        const opacity = interpolate(pulse.value, [0, 1], [0.3, 0.7]);

        return {
            transform: [{ scale }],
            opacity,
        };
    });

    const ringStyle = useAnimatedStyle(() => {
        const scale = interpolate(pulse.value, [0, 1], [1, 2]);
        const opacity = interpolate(pulse.value, [0, 1], [0.4, 0]);

        return {
            transform: [{ scale }],
            opacity,
        };
    });

    return (
        <View style={[styles.container, style]}>
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                {/* Outer pulsing ring */}
                <Animated.View
                    style={[
                        styles.ring,
                        {
                            width: size / 2,
                            height: size / 2,
                            borderRadius: size / 4,
                            backgroundColor: colors.accent
                        },
                        ringStyle
                    ]}
                />

                {/* Inner solid dot */}
                <Animated.View
                    style={[
                        styles.dot,
                        {
                            width: size / 3,
                            height: size / 3,
                            borderRadius: size / 6,
                            backgroundColor: colors.accent
                        },
                        dotStyle
                    ]}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        position: 'absolute',
    },
    ring: {
        position: 'absolute',
    },
});

export default LoadingView;
