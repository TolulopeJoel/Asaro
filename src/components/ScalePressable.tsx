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
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: withSpring(interpolate(pressed.value, [0, 1], [1, scaleTo]), { damping: 15, stiffness: 300 }) }],
            opacity: withSpring(interpolate(pressed.value, [0, 1], [1, activeOpacity])),
        };
    });

    const handlePressIn = (e: any) => {
        if (!disabled) pressed.value = 1;
        onPressIn?.(e);
    };

    const handlePressOut = (e: any) => {
        pressed.value = 0;
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
