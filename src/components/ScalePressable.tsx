import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ScalePressableProps extends PressableProps {
    children?: React.ReactNode;
    activeOpacity?: number;
    scaleTo?: number;
    style?: StyleProp<ViewStyle>;
}

export const ScalePressable: React.FC<ScalePressableProps> = ({
    children,
    activeOpacity = 0.9,
    scaleTo = 0.96,
    style,
    disabled,
    onPressIn,
    onPressOut,
    ...props
}) => {
    const progress = useSharedValue(0);
    const config = { damping: 15, stiffness: 300 };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: interpolate(progress.value, [0, 1], [1, scaleTo]) }],
            opacity: interpolate(progress.value, [0, 1], [1, activeOpacity]),
        };
    });

    const handlePressIn = (e: any) => {
        if (!disabled) progress.value = withSpring(1, config);
        onPressIn?.(e);
    };

    const handlePressOut = (e: any) => {
        progress.value = withSpring(0, config);
        onPressOut?.(e);
    };

    return (
        <AnimatedPressable
            disabled={disabled}
            style={[style as any, animatedStyle]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            {...props}
        >
            {children}
        </AnimatedPressable>
    );
};
