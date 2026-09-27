/** Three z's drifting up from a dozing face, out of step. Reduced motion shows them still. */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';

import { Text } from '../ui';

const RISE_MS = 2200;

function Z({ index }: { index: number }) {
    const reduceMotion = useReducedMotion();
    const p = useSharedValue(reduceMotion ? 0.5 : 0);
    useEffect(() => {
        if (reduceMotion) return;
        p.value = withDelay(index * (RISE_MS / 3), withRepeat(
            withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.quad) }), -1, false,
        ));
    }, [index, p, reduceMotion]);
    const style = useAnimatedStyle(() => ({
        opacity: p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85,
        transform: [
            { translateY: -p.value * 34 },
            { translateX: Math.sin(p.value * Math.PI * 2) * 4 + index * 7 },
            { scale: 0.7 + index * 0.2 },
        ],
    }));
    return (
        <Animated.View style={[styles.z, style]}>
            <Text variant="subtitle" tone="accent">z</Text>
        </Animated.View>
    );
}

export function Zzz() {
    return (
        <View pointerEvents="none" style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[0, 1, 2].map((i) => <Z key={i} index={i} />)}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', top: -6, right: -10, width: 36, height: 44 },
    z: { position: 'absolute', bottom: 0, left: 0 },
});
