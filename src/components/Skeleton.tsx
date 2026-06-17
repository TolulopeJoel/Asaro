import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
    style?: ViewStyle;
    circle?: boolean;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style,
    circle = false,
}) => {
    const { isDark } = useTheme();
    const shimmerValue = useSharedValue(0);

    useEffect(() => {
        shimmerValue.value = withRepeat(
            withTiming(1, { duration: 1500 }),
            -1,
            false
        );
    }, [shimmerValue]);

    const animatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            shimmerValue.value,
            [0, 1],
            [-150, 150]
        );
        return {
            transform: [{ translateX }],
        };
    });

    const baseColor = isDark ? '#2C2C2E' : '#E1E9EE';
    const highlightColor = isDark ? '#3A3A3C' : '#F2F8FC';

    return (
        <View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius: circle ? (typeof height === 'number' ? height / 2 : 999) : borderRadius,
                    backgroundColor: baseColor,
                },
                style,
            ]}
        >
            <AnimatedLinearGradient
                colors={['transparent', highlightColor, 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[StyleSheet.absoluteFill, animatedStyle]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    skeleton: {
        overflow: 'hidden',
    },
});

export default Skeleton;
