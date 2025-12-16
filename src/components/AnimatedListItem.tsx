import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { LIST_ITEM_DURATION, LIST_ITEM_EASING, LIST_ITEM_STAGGER } from '../utils/transitionConfig';

interface AnimatedListItemProps {
    children: React.ReactNode;
    index?: number;
    delay?: number;
    onRemove?: () => void;
    isRemoving?: boolean;
}

/**
 * Animated wrapper for list items with entrance and exit animations
 * - Entrance: Fade + translateY (slide up from below)
 * - Exit: Scale + fade (collapse and fade out)
 */
export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
    children,
    index = 0,
    delay,
    onRemove,
    isRemoving = false,
}) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;
    const scale = useRef(new Animated.Value(1)).current;

    // Entrance animation on mount
    useEffect(() => {
        const animationDelay = delay !== undefined ? delay : index * LIST_ITEM_STAGGER;

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: LIST_ITEM_DURATION,
                delay: animationDelay,
                easing: LIST_ITEM_EASING,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: LIST_ITEM_DURATION,
                delay: animationDelay,
                easing: LIST_ITEM_EASING,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Exit animation when isRemoving changes
    useEffect(() => {
        if (isRemoving) {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: LIST_ITEM_DURATION,
                    easing: LIST_ITEM_EASING,
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 0.8,
                    duration: LIST_ITEM_DURATION,
                    easing: LIST_ITEM_EASING,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onRemove?.();
            });
        }
    }, [isRemoving]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity,
                    transform: [
                        { translateY },
                        { scale },
                    ],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
});
