/**
 * Àṣàrò — the character.
 *
 * A face. There is no body and there are no hands, which is the constraint
 * the whole rig is built around: the app asks for `wave`, `point`,
 * `thumbsUp` and `shrug` by name, and every one of those is a hand gesture
 * on a normal character. Here they are performed by brow, lid, pupil, mouth,
 * cheek, head and the crest on the crown — see src/theme/asaroRig.ts, where
 * the eight performances live as keyframe data.
 *
 * It is clay — a soft, unsaturated terracotta — and it stays clay in both
 * themes. What the theme changes is only what the ground demands. The rim,
 * not the fill, is what holds its edge on the light ground; see
 * src/theme/asaroRig.ts for why that trade buys a better colour.
 *
 * Everything moves in Reanimated worklets on the UI thread. Nothing here
 * runs per-frame in JS, so a busy JS thread — a list re-rendering, a sync
 * landing — cannot make the face stutter. The idle life (breath, blink,
 * gaze drift) is deliberately irregular; a face that blinks on a metronome
 * reads as a machine.
 */
import React, {
    forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
    Easing, cancelAnimation, useAnimatedProps, useSharedValue, withRepeat,
    withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import {
    ASARO_ACTIONS, ASARO_LOOKS, ASARO_REST, ASARO_RIG,
    type AsaroAction, type AsaroLook,
} from '../../theme/asaroRig';

const AG = Animated.createAnimatedComponent(G);
const APath = Animated.createAnimatedComponent(Path);
const AEllipse = Animated.createAnimatedComponent(Ellipse);

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
    /** Crop to the face and drop the crest. Defaults on below 48px. */
    bust?: boolean;
    label?: string;
}

const R = ASARO_RIG;
const E = R.eye;
const M = R.mouth;
const REST = ASARO_REST;

/** Stable ordering so a worklet can address an action by index. */
const ACTION_NAMES = Object.keys(ASARO_ACTIONS) as AsaroAction[];

/**
 * Channels, transposed.
 *
 * A worklet cannot index an object by a dynamic key without dragging the
 * whole table across the bridge, so each channel becomes one array-of-arrays
 * captured once at module load and sampled by action index.
 */
const T = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].t);
const C_TIP = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].tip);
const C_BOB = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].bob);
const C_SQ = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].sq);
const C_LEAN = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].lean);
const C_BROWL = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].browL);
const C_BROWR = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].browR);
const C_TILTL = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].tiltL);
const C_TILTR = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].tiltR);
const C_LIDL = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].lidL);
const C_LIDR = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].lidR);
const C_SQUINT = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].squint);
const C_MOUTHC = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].mouthC);
const C_MOUTHO = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].mouthO);
const C_CREST = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].crest);
const C_GX = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].gx);
const C_GY = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].gy);
const C_GW = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].gw);

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
function seg(p: number, times: number[], vals: number[]) {
    'worklet';
    const n = times.length;
    if (n === 0) return 0;
    if (p <= times[0]) return vals[0];
    if (p >= times[n - 1]) return vals[n - 1];
    for (let k = 1; k < n; k++) {
        if (p <= times[k]) {
            const span = times[k] - times[k - 1];
            const u = span <= 0 ? 1 : (p - times[k - 1]) / span;
            return vals[k - 1] + (vals[k] - vals[k - 1]) * ease(u);
        }
    }
    return vals[n - 1];
}

/** Sample a channel for the running action, or hold the rest value when idle. */
function ch(i: number, p: number, table: number[][], rest: number) {
    'worklet';
    if (i < 0 || i >= table.length) return rest;
    return seg(p, T[i], table[i]);
}

/** Keeps generated path strings short — a worklet builds one per frame. */
function r1(v: number) {
    'worklet';
    return Math.round(v * 10) / 10;
}

function AsaroBase(
    { size = 96, look, action, lookAt, bust, label }: AsaroProps,
    ref: React.Ref<AsaroHandle>,
) {
    const resolved: AsaroLook = look ?? 'cloth';
    const C = ASARO_LOOKS[resolved] ?? ASARO_LOOKS.cloth;

    const cropped = bust ?? size < 48;
    const box = cropped ? R.bustBox : R.viewBox;
    const [, , vw, vh] = box.split(' ').map(Number);

    /** Clip ids are document-global, so two Àṣàròs on one screen would collide. */
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const faceClip = `face${uid}`;
    const eyeLClip = `eyeL${uid}`;
    const eyeRClip = `eyeR${uid}`;

    const [reduceMotion, setReduceMotion] = useState(false);

    // Shared values live on the UI thread; nothing below runs per-frame in JS.
    const breath = useSharedValue(0);
    const blink = useSharedValue(0);
    const gazeX = useSharedValue(0);
    const gazeY = useSharedValue(0);
    const prog = useSharedValue(0);
    /** Index into ACTION_NAMES, or −1 when idle. */
    const act = useSharedValue(-1);

    /** Held separately so a new action can cancel the previous one's reset. */
    const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let alive = true;
        AccessibilityInfo.isReduceMotionEnabled().then((on) => { if (alive) setReduceMotion(on); });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => { alive = false; sub.remove(); };
    }, []);

    useEffect(() => () => {
        if (actionTimer.current) clearTimeout(actionTimer.current);
    }, []);

    // Breath — a slow sine the whole face rides on.
    useEffect(() => {
        if (reduceMotion) { cancelAnimation(breath); breath.value = 0; return; }
        breath.value = 0;
        breath.value = withRepeat(
            withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false,
        );
        return () => cancelAnimation(breath);
    }, [reduceMotion, breath]);

    // Blink, on an irregular schedule — a metronome blink reads as a machine.
    useEffect(() => {
        if (reduceMotion) { cancelAnimation(blink); blink.value = 0; return; }
        let alive = true;
        let id: ReturnType<typeof setTimeout>;
        const loop = () => {
            if (!alive) return;
            blink.value = withSequence(
                withTiming(1, { duration: 95, easing: Easing.in(Easing.quad) }),
                withTiming(0, { duration: 130, easing: Easing.out(Easing.quad) }),
            );
            id = setTimeout(loop, 2400 + Math.random() * 4600);
        };
        id = setTimeout(loop, 1000 + Math.random() * 1800);
        return () => {
            alive = false;
            clearTimeout(id);
            cancelAnimation(blink);
            blink.value = 0;
        };
    }, [reduceMotion, blink]);

    // Gaze — follow a target, or drift when none is given. Depending on the
    // coordinates rather than the object keeps a fresh literal each render
    // from restarting the drift on every parent re-render.
    const aimX = lookAt?.x;
    const aimY = lookAt?.y;
    useEffect(() => {
        if (aimX !== undefined && aimY !== undefined) {
            const m = Math.hypot(aimX, aimY);
            const k = m > 1 ? 1 / m : 1;
            gazeX.value = withTiming(aimX * k, { duration: 340 });
            gazeY.value = withTiming(aimY * k, { duration: 340 });
            return;
        }
        if (reduceMotion) {
            cancelAnimation(gazeX); cancelAnimation(gazeY);
            gazeX.value = 0; gazeY.value = 0;
            return;
        }
        let alive = true;
        let id: ReturnType<typeof setTimeout>;
        const drift = () => {
            if (!alive) return;
            gazeX.value = withTiming((Math.random() - 0.5) * 1.3, { duration: 1600 });
            gazeY.value = withTiming((Math.random() - 0.5) * 1.0, { duration: 1600 });
            id = setTimeout(drift, 2800 + Math.random() * 3400);
        };
        id = setTimeout(drift, 1300);
        return () => {
            alive = false;
            clearTimeout(id);
            cancelAnimation(gazeX);
            cancelAnimation(gazeY);
        };
    }, [aimX, aimY, reduceMotion, gazeX, gazeY]);

    const play = useCallback((name: AsaroAction) => {
        const A = ASARO_ACTIONS[name];
        if (!A) return;
        if (actionTimer.current) clearTimeout(actionTimer.current);
        cancelAnimation(prog);
        act.value = ACTION_NAMES.indexOf(name);
        prog.value = 0;
        const ms = reduceMotion ? 1 : A.ms;
        prog.value = withTiming(1, { duration: ms, easing: Easing.linear });
        actionTimer.current = setTimeout(() => {
            act.value = -1;
            actionTimer.current = null;
        }, ms + 40);
    }, [act, prog, reduceMotion]);

    useImperativeHandle(ref, () => ({ play }), [play]);
    useEffect(() => { if (action) play(action); }, [action, play]);

    // ---- animated channels -------------------------------------------------

    const headProps = useAnimatedProps(() => {
        const br = Math.sin(breath.value * Math.PI * 2);
        const sway = Math.sin(breath.value * Math.PI * 2 * 0.37);
        const i = act.value;
        const p = prog.value;
        const sq = (1 + br * 0.016) * ch(i, p, C_SQ, REST.sq);
        return {
            translateX: ch(i, p, C_LEAN, REST.lean),
            translateY: br * 2.2 + ch(i, p, C_BOB, REST.bob),
            rotation: sway * 1.2 + ch(i, p, C_TIP, REST.tip),
            // Squash preserves area: as it flattens it also widens.
            scaleX: 2 - sq,
            scaleY: sq,
        };
    });

    const crestProps = useAnimatedProps(() => {
        const sway = Math.sin(breath.value * Math.PI * 2 * 0.37);
        return { rotation: sway * 1.8 + ch(act.value, prog.value, C_CREST, REST.crest) };
    });

    const browLProps = useAnimatedProps(() => ({
        translateY: ch(act.value, prog.value, C_BROWL, REST.browL),
        rotation: ch(act.value, prog.value, C_TILTL, REST.tiltL),
    }));

    const browRProps = useAnimatedProps(() => ({
        translateY: ch(act.value, prog.value, C_BROWR, REST.browR),
        rotation: ch(act.value, prog.value, C_TILTR, REST.tiltR),
    }));

    // The involuntary blink and a deliberate wink share one lid, so the eye
    // takes whichever is more closed rather than letting them cancel out.
    const lidLProps = useAnimatedProps(() => {
        const a = ch(act.value, prog.value, C_LIDL, REST.lidL);
        const b = blink.value;
        return { translateY: (a > b ? a : b) * E.lidTravel };
    });

    const lidRProps = useAnimatedProps(() => {
        const a = ch(act.value, prog.value, C_LIDR, REST.lidR);
        const b = blink.value;
        return { translateY: (a > b ? a : b) * E.lidTravel };
    });

    const squintLProps = useAnimatedProps(() => ({
        translateY: -ch(act.value, prog.value, C_SQUINT, REST.squint) * E.squintTravel,
    }));

    const squintRProps = useAnimatedProps(() => ({
        translateY: -ch(act.value, prog.value, C_SQUINT, REST.squint) * E.squintTravel,
    }));

    const irisLProps = useAnimatedProps(() => {
        const i = act.value;
        const p = prog.value;
        const w = ch(i, p, C_GW, REST.gw);
        return {
            translateX: (gazeX.value * (1 - w) + ch(i, p, C_GX, REST.gx) * w) * E.travelX,
            translateY: (gazeY.value * (1 - w) + ch(i, p, C_GY, REST.gy) * w) * E.travelY,
        };
    });

    const irisRProps = useAnimatedProps(() => {
        const i = act.value;
        const p = prog.value;
        const w = ch(i, p, C_GW, REST.gw);
        return {
            translateX: (gazeX.value * (1 - w) + ch(i, p, C_GX, REST.gx) * w) * E.travelX,
            translateY: (gazeY.value * (1 - w) + ch(i, p, C_GY, REST.gy) * w) * E.travelY,
        };
    });

    // One filled lens. Shut, its two edges collapse onto each other and it
    // reads as a drawn line, which is what a closed mouth actually is.
    const mouthProps = useAnimatedProps(() => {
        const i = act.value;
        const p = prog.value;
        const c = ch(i, p, C_MOUTHC, REST.mouthC);
        const o = ch(i, p, C_MOUTHO, REST.mouthO);
        const w = M.w + o * M.wOpen;
        const bow = M.cy + c * M.bow;
        const lo = bow + o * M.drop + M.lip;
        const up = bow - M.lip;
        return {
            d: `M${r1(M.cx - w)} ${M.cy} Q${M.cx} ${r1(lo)} ${r1(M.cx + w)} ${M.cy} `
                + `Q${M.cx} ${r1(up)} ${r1(M.cx - w)} ${M.cy} Z`,
        };
    });

    const cheekLProps = useAnimatedProps(() => {
        const c = ch(act.value, prog.value, C_MOUTHC, REST.mouthC);
        return { opacity: 0.12 + (c > 0 ? c : 0) * 0.2 };
    });

    const cheekRProps = useAnimatedProps(() => {
        const c = ch(act.value, prog.value, C_MOUTHC, REST.mouthC);
        return { opacity: 0.12 + (c > 0 ? c : 0) * 0.2 };
    });

    // ---- an eye ------------------------------------------------------------

    const eye = (
        cx: number,
        clip: string,
        irisP: typeof irisLProps,
        lidP: typeof lidLProps,
        squintP: typeof squintLProps,
    ) => (
        <React.Fragment key={clip}>
            <G clipPath={`url(#${clip})`}>
                <Ellipse cx={cx} cy={E.cy} rx={E.rx} ry={E.ry} fill={C.eyeWhite} />

                <AG animatedProps={irisP}>
                    <Circle cx={cx} cy={E.cy} r={E.iris} fill={C.iris} />
                    <Circle cx={cx} cy={E.cy} r={E.pupil} fill={C.pupil} />
                    <Circle
                        cx={cx + E.glint.dx} cy={E.cy + E.glint.dy} r={E.glint.r}
                        fill="#ffffff" opacity={0.92}
                    />
                    {!cropped && (
                        <Circle
                            cx={cx + E.spark.dx} cy={E.cy + E.spark.dy} r={E.spark.r}
                            fill="#ffffff" opacity={0.55}
                        />
                    )}
                </AG>

                {/* Lower lid. Its top edge bows upward, so a squint makes the
                    happy ^^ curve rather than just cutting the eye in half. */}
                <AG animatedProps={squintP}>
                    <Path
                        d={`M${cx - 28} ${E.cy + 26} Q${cx} ${E.cy - 2} ${cx + 28} ${E.cy + 26} `
                            + `L${cx + 28} ${E.cy + 84} L${cx - 28} ${E.cy + 84} Z`}
                        fill={C.face}
                    />
                </AG>

                {/* Upper lid, parked just above the eye and dropped to shut it. */}
                <AG animatedProps={lidP}>
                    <Rect
                        x={cx - 27} y={E.cy - E.ry - 58} width={54} height={58}
                        fill={C.face}
                    />
                </AG>
            </G>

            <Ellipse
                cx={cx} cy={E.cy} rx={E.rx} ry={E.ry}
                fill="none" stroke={C.eyeRim} strokeWidth={1.5}
            />
        </React.Fragment>
    );

    return (
        <Svg
            width={size}
            height={Math.round((size * vh) / vw)}
            viewBox={box}
            accessibilityRole="image"
            accessibilityLabel={label ?? 'Àṣàrò'}
        >
            <Defs>
                <ClipPath id={faceClip}><Path d={R.face} /></ClipPath>
                <ClipPath id={eyeLClip}>
                    <Ellipse cx={E.lx} cy={E.cy} rx={E.rx} ry={E.ry} />
                </ClipPath>
                <ClipPath id={eyeRClip}>
                    <Ellipse cx={E.rx2} cy={E.cy} rx={E.rx} ry={E.ry} />
                </ClipPath>
            </Defs>

            <AG animatedProps={headProps} originX={R.pivotX} originY={R.pivotY}>
                {!cropped && (
                    <AG animatedProps={crestProps} originX={R.crest.px} originY={R.crest.py}>
                        <Path d={R.crest.d} fill={C.crest} />
                    </AG>
                )}

                <Path d={R.face} fill={C.face} />

                {/* Everything soft is clipped to the face, so no extreme of any
                    action can push a cheek or an open mouth past the jaw. */}
                <G clipPath={`url(#${faceClip})`}>
                    <Path d={R.shade} fill={C.shade} opacity={C.shadeOpacity} />

                    {C.cheeks && !cropped && (
                        <>
                            <AEllipse
                                animatedProps={cheekLProps}
                                cx={R.cheek.lx} cy={R.cheek.cy}
                                rx={R.cheek.w} ry={R.cheek.h} fill={C.cheek}
                            />
                            <AEllipse
                                animatedProps={cheekRProps}
                                cx={R.cheek.rx} cy={R.cheek.cy}
                                rx={R.cheek.w} ry={R.cheek.h} fill={C.cheek}
                            />
                        </>
                    )}

                    {/* Ilà. Static: every other feature performs, these state
                        who the character is. Dropped with the crest below 48px,
                        where three strokes a cheek would only be mud. */}
                    {!cropped && R.marks.strokes.map(([x1, y1, x2, y2]) => (
                        <React.Fragment key={x1}>
                            <Path
                                d={`M${x1} ${y1} L${x2} ${y2}`} fill="none"
                                stroke={C.mark} strokeWidth={R.marks.w}
                                strokeLinecap="round" opacity={R.marks.opacity}
                            />
                            <Path
                                d={`M${2 * R.marks.mirror - x1} ${y1} `
                                    + `L${2 * R.marks.mirror - x2} ${y2}`}
                                fill="none" stroke={C.mark} strokeWidth={R.marks.w}
                                strokeLinecap="round" opacity={R.marks.opacity}
                            />
                        </React.Fragment>
                    ))}

                    <APath animatedProps={mouthProps} fill={C.mouth} />
                </G>

                <Path d={R.face} fill="none" stroke={C.rim} strokeWidth={R.rimW} />

                {eye(E.lx, eyeLClip, irisLProps, lidLProps, squintLProps)}
                {eye(E.rx2, eyeRClip, irisRProps, lidRProps, squintRProps)}

                <AG animatedProps={browLProps} originX={R.brow.lpx} originY={R.brow.lpy}>
                    <Path
                        d={R.brow.l} fill="none" stroke={C.brow}
                        strokeWidth={R.brow.w} strokeLinecap="round"
                    />
                </AG>
                <AG animatedProps={browRProps} originX={R.brow.rpx} originY={R.brow.rpy}>
                    <Path
                        d={R.brow.r} fill="none" stroke={C.brow}
                        strokeWidth={R.brow.w} strokeLinecap="round"
                    />
                </AG>
            </AG>
        </Svg>
    );
}

export const Asaro = forwardRef<AsaroHandle, AsaroProps>(AsaroBase);
Asaro.displayName = 'Asaro';
