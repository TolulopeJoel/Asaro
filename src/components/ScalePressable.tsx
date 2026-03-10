import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface ScalePressableProps extends PressableProps {
    children: React.ReactNode;
    activeOpacity?: number;
    style?: StyleProp<ViewStyle>;
}

export const ScalePressable: React.FC<ScalePressableProps> = ({
    children,
    activeOpacity = 0.7,
    style,
    disabled,
    ...props
}) => {
    return (
        <Pressable
            disabled={disabled}
            style={({ pressed }) => [
                style as any,
                {
                    opacity: pressed ? activeOpacity : 1,
                },
            ]}
            {...props}
        >
            {children}
        </Pressable>
    );
};
