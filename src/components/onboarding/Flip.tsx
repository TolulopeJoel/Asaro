/**
 * A cartoon flip: the child spins in edge-on from "another world" with a
 * springy overshoot and a puff of ochre, and flips out and back when `flipKey`
 * changes. Reduced motion shows the child still.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
    Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../theme/ThemeContext';

const OUT_MS = 170;
const SPRING = { damping: 9, stiffness: 170, mass: 0.8 };

export function Flip({ flipKey, delay = 0, stretch = false, puff: withPuff = true, style, children }: {
    /** Change it to flip to the new children. */
    flipKey: string | number;
    /** Before the first flip in. */
    delay?: number;
    /** Fill the parent's width rather than hug the child. */
    stretch?: boolean;
    /** The ochre ring; off for thin things like list rows. */
    puff?: boolean;
    style?: ViewStyle;
    children: React.ReactNode;
}) {
    const { colors } = useTheme();
    const reduceMotion = useReducedMotion();
    // The key whose children are on screen. It trails `flipKey` only while the old
    // children turn away; the rest of the time they are the live ones, so a
    // button inside that enables itself later does.
    const [shownKey, setShownKey] = useState(flipKey);
    const outgoing = useRef(children);
    if (shownKey === flipKey) outgoing.current = children;
    const first = useRef(true);

    const turn = useSharedValue(reduceMotion ? 0 : -90);
    const pop = useSharedValue(reduceMotion ? 1 : 0.6);
    const puff = useSharedValue(0);

    const flipIn = (wait: number) => {
        turn.value = -90;
        pop.value = 0.6;
        turn.value = withDelay(wait, withSpring(0, SPRING));
        pop.value = withDelay(wait, withSpring(1, SPRING));
        puff.value = withDelay(wait, withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) }),
        ));
    };

    useEffect(() => {
        if (reduceMotion) {
            setShownKey(flipKey);
            return;
        }
        if (first.current) {
            first.current = false;
            flipIn(delay);
            return;
        }
        turn.value = withTiming(90, { duration: OUT_MS, easing: Easing.in(Easing.quad) });
        pop.value = withTiming(0.8, { duration: OUT_MS });
        const id = setTimeout(() => {
            setShownKey(flipKey);
            flipIn(0);
        }, OUT_MS);
        return () => clearTimeout(id);
        // Only a new key flips; the content swaps edge-on, mid-turn.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flipKey, reduceMotion]);

    const card = useAnimatedStyle(() => ({
        opacity: Math.abs(turn.value) > 88 ? 0 : 1,
        transform: [{ perspective: 800 }, { rotateY: `${turn.value}deg` }, { scale: pop.value }],
    }));
    const ring = useAnimatedStyle(() => ({
        opacity: puff.value <= 0 || puff.value >= 1 ? 0 : 0.5 * (1 - puff.value),
        transform: [{ scale: 0.4 + puff.value * 1.1 }],
    }));

    return (
        <View style={[styles.wrap, stretch && styles.stretch, style]}>
            {withPuff && <Animated.View pointerEvents="none" style={[styles.puff, { borderColor: colors.accent }, ring]} />}
            <Animated.View style={[stretch && styles.stretchChild, card]}>{shownKey === flipKey ? children : outgoing.current}</Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    stretch: { alignSelf: 'stretch', alignItems: 'stretch' },
    stretchChild: { alignSelf: 'stretch' },
    puff: {
        position: 'absolute',
        alignSelf: 'center',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 3,
    },
});
