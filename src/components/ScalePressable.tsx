import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ScalePressableProps extends PressableProps {
    children: React.ReactNode;
    scaleTo?: number;
    activeOpacity?: number;
    style?: StyleProp<ViewStyle>;
}

export const ScalePressable: React.FC<ScalePressableProps> = ({
    children,
    scaleTo = 0.96,
    activeOpacity = 0.9,
    style,
    disabled,
    onPressIn,
    onPressOut,
    ...props
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = (event: any) => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: scaleTo,
                useNativeDriver: true,
                speed: 20,
                bounciness: 4,
            }),
            Animated.timing(opacityAnim, {
                toValue: activeOpacity,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
        onPressIn?.(event);
    };

    const handlePressOut = (event: any) => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 20,
                bounciness: 4,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
        onPressOut?.(event);
    };

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            style={[
                style,
                {
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                },
            ]}
            {...props}
        >
            {children}
        </AnimatedPressable>
    );
};
