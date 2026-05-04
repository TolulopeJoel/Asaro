import React, { useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    withDelay,
    withRepeat,
    Easing,
} from 'react-native-reanimated';
import Svg, { Rect, Ellipse, Polygon } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const RAINBOW_COLORS = [
    '#FF3B30',
    '#FF9500',
    '#FFCC00',
    '#34C759',
    '#5AC8FA',
    '#5856D6',
    '#AF52DE',
    '#FF2D92', // hot pink for extra pop
    '#FF6B35', // deep orange
];

const NUM_PARTICLES = 100;

// Three cannons: left, center, right
const CANNONS = [
    { x: SCREEN_WIDTH * 0.15 },
    { x: SCREEN_WIDTH * 0.5 },
    { x: SCREEN_WIDTH * 0.85 },
];

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max));

type Shape = 'square' | 'rect' | 'strip' | 'dot' | 'diamond';
const SHAPES: Shape[] = ['square', 'rect', 'strip', 'dot', 'diamond'];

interface ParticleConfig {
    id: number;
    cannonX: number;
    color: string;
    shape: Shape;
    delay: number;
    size: number;
}

const Particle = ({ cannonX, color, shape, delay, size }: Omit<ParticleConfig, 'id'>) => {
    const translateX = useSharedValue(cannonX);
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const rotation = useSharedValue(rand(-60, 60));
    const opacity = useSharedValue(0);
    const scaleX = useSharedValue(1);

    useEffect(() => {
        const riseTime = rand(500, 850);
        const fallTime = rand(1000, 1600);
        const totalTime = riseTime + fallTime;

        // Wider angle range — some go nearly straight up, some arc hard sideways
        const angle = rand(-80, 80);
        const speed = rand(0.6, 1.0);
        const radians = (angle * Math.PI) / 180;

        // Higher peaks — fills more of the screen
        const peakHeight = rand(SCREEN_HEIGHT * 0.5, SCREEN_HEIGHT * 0.95);
        const lateralDistance = Math.sin(radians) * peakHeight * 1.3;

        // Air drift during fall
        const drift = rand(-120, 120);

        // Fade in fast, stay visible, fade out at end
        opacity.value = withDelay(
            delay,
            withSequence(
                withTiming(1, { duration: 60 }),
                withTiming(1, { duration: totalTime * 0.7 }),
                withTiming(0, { duration: totalTime * 0.3 })
            )
        );

        translateY.value = withDelay(
            delay,
            withSequence(
                withTiming(SCREEN_HEIGHT - peakHeight * speed, {
                    duration: riseTime,
                    easing: Easing.out(Easing.cubic),
                }),
                withTiming(SCREEN_HEIGHT + 150, {
                    duration: fallTime,
                    easing: Easing.in(Easing.quad),
                })
            )
        );

        translateX.value = withDelay(
            delay,
            withSequence(
                withTiming(cannonX + lateralDistance * speed, {
                    duration: riseTime,
                    easing: Easing.out(Easing.cubic),
                }),
                withTiming(cannonX + lateralDistance * speed + drift, {
                    duration: fallTime,
                    easing: Easing.inOut(Easing.sin),
                })
            )
        );

        // Full tumble rotation
        rotation.value = withDelay(
            delay,
            withTiming(rand(400, 800) * (Math.random() > 0.5 ? 1 : -1), {
                duration: totalTime,
                easing: Easing.linear,
            })
        );

        // Fake 3D flip by oscillating scaleX — simulates the piece catching light
        scaleX.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(-1, { duration: rand(200, 400), easing: Easing.linear }),
                    withTiming(1, { duration: rand(200, 400), easing: Easing.linear })
                ),
                -1,
                false
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: rotation.value + 'deg' },
            { scaleX: scaleX.value },
        ],
        opacity: opacity.value,
    }));

    const renderShape = () => {
        const w = size;
        const h = size;
        switch (shape) {
            case 'square':
                return (
                    <Svg width={w} height={w}>
                        <Rect width={w} height={w} fill={color} rx={1.5} />
                    </Svg>
                );
            case 'rect':
                return (
                    <Svg width={w * 1.5} height={w * 0.7}>
                        <Rect width={w * 1.5} height={w * 0.7} fill={color} rx={1} />
                    </Svg>
                );
            case 'strip':
                return (
                    <Svg width={w * 2.2} height={w * 0.4}>
                        <Rect width={w * 2.2} height={w * 0.4} fill={color} rx={1} />
                    </Svg>
                );
            case 'dot':
                return (
                    <Svg width={w} height={w}>
                        <Ellipse cx={w / 2} cy={w / 2} rx={w / 2} ry={w / 2} fill={color} />
                    </Svg>
                );
            case 'diamond':
                const half = w / 2;
                return (
                    <Svg width={w} height={w}>
                        <Polygon
                            points={`${half},0 ${w},${half} ${half},${w} 0,${half}`}
                            fill={color}
                        />
                    </Svg>
                );
        }
    };

    return <Animated.View style={animatedStyle}>{renderShape()}</Animated.View>;
};

interface ConfettiProps {
    onAnimationEnd?: () => void;
}

export interface ConfettiRef {
    start: () => void;
}

export const Confetti = forwardRef<ConfettiRef, ConfettiProps>(({ onAnimationEnd }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const [key, setKey] = useState(0);

    const start = useCallback(() => {
        setKey(prev => prev + 1);
        setIsVisible(true);
        setTimeout(() => {
            setIsVisible(false);
            onAnimationEnd?.();
        }, 4000);
    }, [onAnimationEnd]);

    useImperativeHandle(ref, () => ({ start }));

    const particles = React.useMemo(() =>
        Array.from({ length: NUM_PARTICLES }, (_, i) => {
            const cannon = CANNONS[i % CANNONS.length];
            return {
                id: i,
                // Small origin jitter so it doesn't look like 3 laser beams
                cannonX: cannon.x + rand(-25, 25),
                color: RAINBOW_COLORS[i % RAINBOW_COLORS.length],
                shape: SHAPES[randInt(0, SHAPES.length)] as Shape,
                // Tight burst window — feels like an explosion, not a drip
                delay: rand(0, 80),
                // Vary sizes for depth
                size: rand(6, 11),
            };
        }), [key]
    );

    if (!isVisible) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {particles.map(p => (
                <Particle key={p.id} {...p} />
            ))}
        </View>
    );
});

Confetti.displayName = 'Confetti';