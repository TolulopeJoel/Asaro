/**
 * Àṣàrò — the character.
 *
 * Not a person: a bound bundle of àdìrẹ cloth. Onikọ resist-dyeing works by
 * bunching fabric and tying it so the dye cannot reach what the binding
 * covers, and what comes out is a field of concentric rings. This is that
 * object, alive — a pebble of dyed cloth with rings radiating from a centre,
 * plus two unattached hands that can gesture from anywhere.
 *
 * The centre of the rings is the gaze. Inner rings track a target almost
 * fully while outer ones barely shift, and that parallax is what makes the
 * form read as looking at you. It needs no eyes, so it answers none of the
 * questions a drawn person would have to — age, gender, build, dress — and
 * has nothing to get uncanny about.
 *
 * Geometry and keyframes come from src/theme/asaroRig.ts, generated from the
 * same source as design/asaro-abstract.html, so the app and the prototype
 * cannot move differently. Animation runs in Reanimated worklets on the UI
 * thread, so a busy JS thread cannot make it stutter.
 */
import React, {
    forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
    Easing, cancelAnimation, useAnimatedProps, useSharedValue, withRepeat,
    withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '../../theme/ThemeContext';
import {
    ASARO_ACTIONS, ASARO_LOOKS, ASARO_POSES, ASARO_RIG,
    type AsaroAction, type AsaroLook,
} from '../../theme/asaroRig';

const AG = Animated.createAnimatedComponent(G);
const ACircle = Animated.createAnimatedComponent(Circle);

export type { AsaroAction, AsaroLook };

export interface AsaroHandle {
    /** Play a performance once. Interrupts anything already running. */
    play: (action: AsaroAction) => void;
}

export interface AsaroProps {
    size?: number;
    /** Overrides the active theme's look. Rarely wanted outside the picker. */
    look?: AsaroLook;
    /** Play on mount, and again whenever this changes. */
    action?: AsaroAction;
    /** Where to look, each axis −1…1. Omit for a slow idle drift. */
    lookAt?: { x: number; y: number };
    /** Crop to the bundle and drop the hands. Defaults on below 48px. */
    bust?: boolean;
    label?: string;
}

const R = ASARO_RIG;
const REST = ASARO_POSES.rest;

/** Stable ordering so a worklet can address an action by index. */
const ACTION_NAMES = Object.keys(ASARO_ACTIONS) as AsaroAction[];
const TABLES = ACTION_NAMES.map((n) => ASARO_ACTIONS[n]);

/** Cubic ease-in-out, applied inside each keyframe segment. */
function ease(t: number) {
    'worklet';
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Sample one channel with per-segment easing.
 *
 * Reanimated's own `interpolate` is linear between stops, which makes a wave
 * look mechanical. Easing within each segment is what gives motion weight.
 */
function seg(p: number, times: readonly number[], vals: readonly number[]) {
    'worklet';
    let i = 0;
    while (i < times.length - 2 && p > times[i + 1]) i += 1;
    const span = Math.max(1e-6, times[i + 1] - times[i]);
    const k = ease(Math.min(1, Math.max(0, (p - times[i]) / span)));
    return vals[i] + (vals[i + 1] - vals[i]) * k;
}

type SV = SharedValue<number>;

/**
 * One element of the resist field — a ring, the core, or the glint.
 *
 * A component rather than a helper so each calls exactly one hook. Building
 * these in a loop inside the parent would break the rules of hooks the moment
 * a look rendered a different number of rings, which Locked In does.
 */
function Field({
    par, blink, gazeX, gazeY, cx, cy, r, fill, stroke, strokeWidth, opacity,
}: {
    par: number; blink: SV; gazeX: SV; gazeY: SV;
    cx: number; cy: number; r: number;
    fill: string; stroke?: string; strokeWidth?: number; opacity?: number;
}) {
    const animatedProps = useAnimatedProps(() => {
        // Blink is the whole field flattening — no eyelid, which is the
        // advantage of not having an eye in the first place.
        const k = 1 - blink.value * 0.94;
        return {
            translateX: gazeX.value * R.gaze.travelX * par,
            translateY: gazeY.value * R.gaze.travelY * par,
            scaleY: k,
        };
    });

    return (
        <ACircle
            animatedProps={animatedProps}
            originX={R.gaze.cx} originY={R.gaze.cy}
            cx={cx} cy={cy} r={r}
            fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity}
        />
    );
}

/** One of the two unattached hands. No arm, so a pose is just a coordinate. */
function Hand({
    side, fill, hi, act, prog, breath,
}: {
    side: 'L' | 'R'; fill: string; hi: string; act: SV; prog: SV; breath: SV;
}) {
    const animatedProps = useAnimatedProps(() => {
        const rest = side === 'L' ? REST.L : REST.R;
        let dx = rest[0];
        let dy = rest[1];
        const i = act.value;
        if (i >= 0) {
            const A = TABLES[i];
            dx = side === 'L' ? seg(prog.value, A.t, A.lx) : seg(prog.value, A.t, A.rx);
            dy = side === 'L' ? seg(prog.value, A.t, A.ly) : seg(prog.value, A.t, A.ry);
        }
        // Hands ride the breath at a fraction of the body, so they trail it.
        const br = Math.sin(breath.value * Math.PI * 2) * 1.56;
        return { translateX: R.bodyCx + dx, translateY: R.bodyCy + dy + br };
    });

    return (
        <AG animatedProps={animatedProps}>
            <Ellipse rx={R.hand.rx} ry={R.hand.ry} fill={fill} />
            <Ellipse rx={R.hand.rx * 0.46} ry={R.hand.ry * 0.46} cx={-2.4} cy={-2.2} fill={hi} />
        </AG>
    );
}

function AsaroBase(
    { size = 96, look, action, lookAt, bust, label }: AsaroProps,
    ref: React.Ref<AsaroHandle>,
) {
    const { style: themeStyle } = useTheme();
    const resolved: AsaroLook = look ?? (themeStyle === 'colossal' ? 'lockedIn' : 'cloth');
    const C = ASARO_LOOKS[resolved] ?? ASARO_LOOKS.cloth;

    const cropped = bust ?? size < 48;
    const box = cropped ? R.bustBox : R.viewBox;
    const [, , vw, vh] = box.split(' ').map(Number);

    const [reduceMotion, setReduceMotion] = useState(false);

    // Shared values live on the UI thread; nothing below runs per-frame in JS.
    const breath = useSharedValue(0);
    const blink = useSharedValue(0);
    const gazeX = useSharedValue(0);
    const gazeY = useSharedValue(0);
    const prog = useSharedValue(0);
    /** Index into ACTION_NAMES, or −1 when idle. */
    const act = useSharedValue(-1);

    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const clearTimers = useCallback(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    }, []);

    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => sub.remove();
    }, []);

    useEffect(() => () => clearTimers(), [clearTimers]);

    // Breath — a slow sine the whole body rides on.
    useEffect(() => {
        if (reduceMotion) { cancelAnimation(breath); breath.value = 0; return; }
        breath.value = 0;
        breath.value = withRepeat(
            withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false,
        );
        return () => cancelAnimation(breath);
    }, [reduceMotion, breath]);

    // Blink, on an irregular schedule — a metronome blink reads as a machine.
    useEffect(() => {
        if (reduceMotion) return;
        let alive = true;
        const loop = () => {
            if (!alive) return;
            blink.value = withSequence(
                withTiming(1, { duration: 105, easing: Easing.in(Easing.quad) }),
                withTiming(0, { duration: 135, easing: Easing.out(Easing.quad) }),
            );
            timers.current.push(setTimeout(loop, 2400 + Math.random() * 4600));
        };
        timers.current.push(setTimeout(loop, 1000 + Math.random() * 1800));
        return () => { alive = false; };
    }, [reduceMotion, blink]);

    // Gaze — follow a target, or drift when none is given.
    useEffect(() => {
        if (lookAt) {
            const m = Math.hypot(lookAt.x, lookAt.y);
            const k = m > 1 ? 1 / m : 1;
            gazeX.value = withTiming(lookAt.x * k, { duration: 340 });
            gazeY.value = withTiming(lookAt.y * k, { duration: 340 });
            return;
        }
        if (reduceMotion) { gazeX.value = 0; gazeY.value = 0; return; }
        let alive = true;
        const drift = () => {
            if (!alive) return;
            gazeX.value = withTiming((Math.random() - 0.5) * 1.3, { duration: 1600 });
            gazeY.value = withTiming((Math.random() - 0.5) * 1.0, { duration: 1600 });
            timers.current.push(setTimeout(drift, 2800 + Math.random() * 3400));
        };
        timers.current.push(setTimeout(drift, 1300));
        return () => { alive = false; };
    }, [lookAt, reduceMotion, gazeX, gazeY]);

    const play = useCallback((name: AsaroAction) => {
        const A = ASARO_ACTIONS[name];
        if (!A) return;
        act.value = ACTION_NAMES.indexOf(name);
        prog.value = 0;
        const ms = reduceMotion ? 1 : A.ms;
        prog.value = withTiming(1, { duration: ms, easing: Easing.linear });
        timers.current.push(setTimeout(() => { act.value = -1; }, ms + 40));
    }, [act, prog, reduceMotion]);

    useImperativeHandle(ref, () => ({ play }), [play]);
    useEffect(() => { if (action) play(action); }, [action, play]);

    const bundleProps = useAnimatedProps(() => {
        const br = Math.sin(breath.value * Math.PI * 2);
        const sway = Math.sin(breath.value * Math.PI * 2 * 0.37);
        const i = act.value;
        let tip = sway * 1.4;
        let bob = br * 2.6;
        let sq = 1 + br * 0.018;
        if (i >= 0) {
            const A = TABLES[i];
            tip += seg(prog.value, A.t, A.tip);
            bob += seg(prog.value, A.t, A.bob);
            sq *= seg(prog.value, A.t, A.sq);
        }
        // Squash preserves area: as it flattens it also widens.
        return { translateY: bob, rotation: tip, scaleX: 2 - sq, scaleY: sq };
    });

    return (
        <Svg
            width={size}
            height={Math.round((size * vh) / vw)}
            viewBox={box}
            accessibilityRole="image"
            accessibilityLabel={label ?? 'Àṣàrò'}
        >
            <Defs>
                <ClipPath id="bundleClip"><Path d={R.body} /></ClipPath>
                <RadialGradient id="bodyGrad" cx="36%" cy="28%" r="82%">
                    <Stop offset="0%" stopColor={C.bodyHi} />
                    <Stop offset="100%" stopColor={C.bodyLo} />
                </RadialGradient>
            </Defs>

            {!cropped && <Hand side="L" fill={C.hand} hi={C.handHi} act={act} prog={prog} breath={breath} />}
            {!cropped && <Hand side="R" fill={C.hand} hi={C.handHi} act={act} prog={prog} breath={breath} />}

            <AG animatedProps={bundleProps} originX={R.bodyCx} originY={R.bodyCy}>
                <Path d={R.body} fill="url(#bodyGrad)" />

                <G clipPath="url(#bundleClip)">
                    {R.rings.slice(0, C.ringCount).map((ring) => (
                        <Field
                            key={ring.r} par={ring.par} blink={blink} gazeX={gazeX} gazeY={gazeY}
                            cx={R.gaze.cx} cy={R.gaze.cy} r={ring.r}
                            fill="none" stroke={C.ring} strokeWidth={ring.w} opacity={0.9}
                        />
                    ))}
                    <Field
                        par={R.core.par} blink={blink} gazeX={gazeX} gazeY={gazeY}
                        cx={R.gaze.cx} cy={R.gaze.cy} r={R.core.r} fill={C.core}
                    />
                    <Field
                        par={R.glint.par} blink={blink} gazeX={gazeX} gazeY={gazeY}
                        cx={R.gaze.cx + R.glint.dx} cy={R.gaze.cy + R.glint.dy}
                        r={R.glint.r} fill="#ffffff" opacity={0.85}
                    />
                </G>

                <Path d={R.body} fill="none" stroke={C.rim} strokeWidth={2} />

                {C.tieVisible && (
                    <>
                        <Path d={R.tie.band} fill={C.tie} />
                        {R.tie.tails.map((d) => (
                            <Path key={d} d={d} fill="none" stroke={C.tie} strokeWidth={3.2} strokeLinecap="round" />
                        ))}
                    </>
                )}
            </AG>
        </Svg>
    );
}

export const Asaro = forwardRef<AsaroHandle, AsaroProps>(AsaroBase);
Asaro.displayName = 'Asaro';
