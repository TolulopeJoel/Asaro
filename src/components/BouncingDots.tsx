import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

interface BouncingDotsProps {
    color?: string;
    size?: number;
}

const Dot = ({ index, color, size }: { index: number; color: string; size: number }) => {
    const translateY = useSharedValue(0);

    useEffect(() => {
        translateY.value = withDelay(
            index * 200,
            withRepeat(
                withSequence(
                    withTiming(-size, { duration: 300 }),
                    withTiming(0, { duration: 300 }),
                    withTiming(0, { duration: 400 }) // Pause at bottom
                ),
                -1,
                false
            )
        );
    }, [index, size]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View
            style={[
                styles.dot,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                },
                animatedStyle,
            ]}
        />
    );
};

export const BouncingDots: React.FC<BouncingDotsProps> = ({
    color = '#FFFFFF',
    size = 6,
}) => {
    return (
        <View style={styles.container}>
            {[0, 1, 2].map((i) => (
                <Dot key={i} index={i} color={color} size={size} />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 24, // Consistent height for the bouncing area
    },
    dot: {
        marginHorizontal: 1,
    },
});

export default BouncingDots;
