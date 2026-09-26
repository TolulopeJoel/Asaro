/**
 * Àṣàrò — the character. A face with no body and no hands, which is the
 * constraint the rig is built around: `wave`, `point`, `thumbsUp` and `shrug`
 * are hand gestures on a normal character and here are performed by brow, lid,
 * pupil, mouth, cheek, head and crest. Keyframes live in src/theme/asaroRig.ts.
 *
 * Everything moves in Reanimated worklets on the UI thread — nothing runs
 * per-frame in JS, so a busy JS thread cannot make the face stutter. The idle
 * life (breath, blink, a watchful gaze) is deliberately irregular: a face that
 * blinks on a metronome reads as a machine.
 */
import React, {
    forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
    Easing, cancelAnimation, useAnimatedProps, useSharedValue, withRepeat,
    withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, {
    Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Stop,
} from 'react-native-svg';

import {
    ASARO_ACTIONS, ASARO_LOOKS, ASARO_REST, ASARO_RIG,
    type AsaroAction, type AsaroLook, type HairShape,
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
const H = R.hair;
const REST = ASARO_REST;

/** Stable ordering so a worklet can address an action by index. */
const ACTION_NAMES = Object.keys(ASARO_ACTIONS) as AsaroAction[];

/**
 * Channels, transposed. A worklet cannot index an object by a dynamic key
 * without dragging the whole table across the bridge, so each channel is one
 * array-of-arrays captured at module load and sampled by action index.
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
/*
 * Optional channel: an action that does not press its lips gets a flat run of
 * ones, so the eleven tables that predate it need no edit and no default
 * scattered through the worklet.
 */
const C_PRESS = ACTION_NAMES.map(
    (n) => ASARO_ACTIONS[n].press ?? ASARO_ACTIONS[n].t.map(() => 1),
);
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

/**
 * The mouth lens for the running frame: corner half-width, and the lower and
 * upper control heights. Shared by the mouth and the tongue so they cannot part.
 */
function lens(i: number, p: number) {
    'worklet';
    const c = ch(i, p, C_MOUTHC, REST.mouthC);
    const o = ch(i, p, C_MOUTHO, REST.mouthO);
    const bow = M.cy + c * M.bow;
    const lip = M.lip * ch(i, p, C_PRESS, 1);
    return { o, w: M.w + o * M.wOpen, lo: bow + o * M.drop + lip, up: bow - lip };
}

/** Mirrors an absolute M/L/Q/C path about x = `about`; every number pair is x, y. */
function mirrorX(d: string, about: number) {
    let k = 0;
    return d.replace(/-?\d+(\.\d+)?/g, (n) => (k++ % 2 === 0 ? String(2 * about - Number(n)) : n));
}

/** Fills a quadratic brow stroke as a shape, thick at the inner end, thin at the tail. */
function taperBrow(d: string, w: number) {
    const [x0, y0, qx, qy, x1, y1] = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const innerFirst = Math.abs(x0 - R.pivotX) < Math.abs(x1 - R.pivotX);
    const { inner, tail } = R.brow.taper;
    const top: string[] = [];
    const bottom: string[] = [];
    const N = 16;
    for (let k = 0; k <= N; k++) {
        const t = k / N;
        const x = (1 - t) ** 2 * x0 + 2 * t * (1 - t) * qx + t * t * x1;
        const y = (1 - t) ** 2 * y0 + 2 * t * (1 - t) * qy + t * t * y1;
        const dx = 2 * (1 - t) * (qx - x0) + 2 * t * (x1 - qx);
        const dy = 2 * (1 - t) * (qy - y0) + 2 * t * (y1 - qy);
        const s = innerFirst ? 1 - t : t;
        const hw = ((w / 2) * (tail + (inner - tail) * s)) / Math.hypot(dx, dy);
        top.push(`${r1(x - dy * hw)} ${r1(y + dx * hw)}`);
        bottom.unshift(`${r1(x + dy * hw)} ${r1(y - dx * hw)}`);
    }
    return `M${top.join(' L')} L${bottom.join(' L')} Z`;
}

const BROWS = Object.fromEntries(
    (Object.keys(ASARO_LOOKS) as AsaroLook[]).map((k) => {
        const w = R.brow.w * ASARO_LOOKS[k].browWeight;
        return [k, { l: taperBrow(R.brow.l, w), r: taperBrow(R.brow.r, w) }];
    }),
) as Record<AsaroLook, { l: string; r: string }>;

const EAR_R = mirrorX(R.ear.d, R.ear.mirror);
const EAR_INNER_R = mirrorX(R.ear.inner, R.ear.mirror);

/** Upper lid, parked above the eye, with its bowed lower edge. */
const LID_EDGE = E.cy - E.ry - E.lid.lift;
const lidPath = (cx: number) => `M${cx - 27} ${E.cy - E.ry - 58} L${cx + 27} ${E.cy - E.ry - 58} `
    + `L${cx + 27} ${LID_EDGE} Q${cx} ${LID_EDGE + E.lid.bow} ${cx - 27} ${LID_EDGE} Z`;
const lidLinePath = (cx: number) => `M${cx - 27} ${LID_EDGE} Q${cx} ${LID_EDGE + E.lid.bow} ${cx + 27} ${LID_EDGE}`;

function AsaroBase(
    { size = 96, look, action, lookAt, bust, label }: AsaroProps,
    ref: React.Ref<AsaroHandle>,
) {
    const resolved: AsaroLook = look ?? 'cloth';
    const C = ASARO_LOOKS[resolved] ?? ASARO_LOOKS.cloth;
    /* The look's own hair, or the crest the character was designed around. */
    const hair: HairShape = C.hair ?? {
        back: R.crest.d, sway: { back: 1, front: 1 }, px: R.crest.px, py: R.crest.py,
    };
    const swayBack = hair.sway.back;
    const swayFront = hair.sway.front;
    const brows = BROWS[resolved] ?? BROWS.cloth;
    const outline = C.head ?? R.face;

    const cropped = bust ?? size < 48;
    const box = cropped ? R.bustBox : R.viewBox;
    const [, , vw, vh] = box.split(' ').map(Number);

    /** Clip ids are document-global, so two Àṣàròs on one screen would collide. */
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const faceClip = `face${uid}`;
    const eyeLClip = `eyeL${uid}`;
    const eyeRClip = `eyeR${uid}`;
    const lidLClip = `lidL${uid}`;
    const lidRClip = `lidR${uid}`;
    const fadeFill = `fade${uid}`;

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

    // Gaze — follow a target, or watch when none is given. Depending on the
    // coordinates rather than the object keeps a fresh literal each render
    // from restarting the loop on every parent re-render.
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
        /*
         * He watches: the eyes mostly hold the reader, settling a little each
         * time, and now and then dart off to clock something and come back.
         * A wandering gaze reads as dreamy, which he is not.
         */
        const watch = () => {
            if (!alive) return;
            if (Math.random() < 0.3) {
                const side = Math.random() < 0.5 ? -1 : 1;
                const hold = 700 + Math.random() * 500;
                gazeX.value = withSequence(
                    withTiming(side * (0.65 + Math.random() * 0.25), { duration: 170 }),
                    withDelay(hold, withTiming((Math.random() - 0.5) * 0.2, { duration: 260 })),
                );
                gazeY.value = withSequence(
                    withTiming((Math.random() - 0.5) * 0.4, { duration: 170 }),
                    withDelay(hold, withTiming(0, { duration: 260 })),
                );
            } else {
                gazeX.value = withTiming((Math.random() - 0.5) * 0.24, { duration: 900 });
                gazeY.value = withTiming((Math.random() - 0.5) * 0.2, { duration: 900 });
            }
            id = setTimeout(watch, 2200 + Math.random() * 2400);
        };
        id = setTimeout(watch, 1300);
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

    const hairBackProps = useAnimatedProps(() => {
        const sway = Math.sin(breath.value * Math.PI * 2 * 0.37);
        return { rotation: (sway * 1.8 + ch(act.value, prog.value, C_CREST, REST.crest)) * swayBack };
    }, [swayBack]);

    const hairFrontProps = useAnimatedProps(() => {
        const sway = Math.sin(breath.value * Math.PI * 2 * 0.37);
        return { rotation: (sway * 1.8 + ch(act.value, prog.value, C_CREST, REST.crest)) * swayFront };
    }, [swayFront]);

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

    const lidLineLProps = useAnimatedProps(() => {
        const a = ch(act.value, prog.value, C_LIDL, REST.lidL);
        const l = a > blink.value ? a : blink.value;
        return { translateY: (l < E.lid.hold ? l : E.lid.hold) * E.lidTravel };
    });

    const lidLineRProps = useAnimatedProps(() => {
        const a = ch(act.value, prog.value, C_LIDR, REST.lidR);
        const l = a > blink.value ? a : blink.value;
        return { translateY: (l < E.lid.hold ? l : E.lid.hold) * E.lidTravel };
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
    // The smirk tilts the corners and leans both bows toward the raised one.
    const mouthProps = useAnimatedProps(() => {
        const { w, lo, up } = lens(act.value, prog.value);
        const qx = M.cx + M.smirk.shift;
        const yl = M.cy + M.smirk.rise;
        const yr = M.cy - M.smirk.rise;
        return {
            d: `M${r1(M.cx - w)} ${yl} Q${qx} ${r1(lo)} ${r1(M.cx + w)} ${yr} `
                + `Q${qx} ${r1(up)} ${r1(M.cx - w)} ${yl} Z`,
        };
    });

    // The middle half (t 0.25…0.75) of the lower edge, humped up by how far
    // the mouth is open. The hump stays under the upper edge at any opening.
    const tongueProps = useAnimatedProps(() => {
        const { o, w, lo } = lens(act.value, prog.value);
        const d = lo - M.cy;
        const y0 = M.cy + 0.375 * d;
        const yc = M.cy + 0.625 * d;
        const top = yc - 2 * o * M.drop * M.tongue;
        const x0 = M.cx + 0.375 * M.smirk.shift;
        const qx = M.cx + 0.625 * M.smirk.shift;
        const yl = r1(y0 + M.smirk.rise / 2);
        const yr = r1(y0 - M.smirk.rise / 2);
        return {
            d: `M${r1(x0 - w / 2)} ${yl} Q${qx} ${r1(yc)} ${r1(x0 + w / 2)} ${yr} `
                + `Q${qx} ${r1(top)} ${r1(x0 - w / 2)} ${yl} Z`,
            opacity: o > 0.01 ? 1 : 0,
        };
    });

    const cheekLProps = useAnimatedProps(() => {
        const c = ch(act.value, prog.value, C_MOUTHC, REST.mouthC);
        const smile = c - REST.mouthC;
        return { opacity: R.cheek.base + (smile > 0 ? smile : 0) * R.cheek.gain };
    });

    const cheekRProps = useAnimatedProps(() => {
        const c = ch(act.value, prog.value, C_MOUTHC, REST.mouthC);
        const smile = c - REST.mouthC;
        return { opacity: R.cheek.base + (smile > 0 ? smile : 0) * R.cheek.gain };
    });

    // ---- an eye ------------------------------------------------------------

    const eye = (
        cx: number,
        clip: string,
        lidClip: string,
        irisP: typeof irisLProps,
        lidP: typeof lidLProps,
        lidLineP: typeof lidLineLProps,
        squintP: typeof squintLProps,
    ) => (
        <React.Fragment key={clip}>
            <G clipPath={`url(#${clip})`}>
                <Ellipse cx={cx} cy={E.cy} rx={E.rx} ry={E.ry} fill={C.eyeWhite} />

                <AG animatedProps={irisP}>
                    <Circle cx={cx} cy={E.cy} r={E.iris} fill={C.iris} />
                    <Ellipse
                        cx={cx} cy={E.cy + E.irisLight.dy}
                        rx={E.irisLight.rx} ry={E.irisLight.ry}
                        fill={C.irisLight} opacity={E.irisLight.opacity}
                    />
                    <Circle cx={cx} cy={E.cy} r={E.pupil} fill={C.pupil} />
                    <Circle
                        cx={cx} cy={E.cy} r={E.iris - E.ring.inset}
                        fill="none" stroke={C.pupil} strokeWidth={E.ring.w}
                        opacity={E.ring.opacity}
                    />
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

                {/* Eye rim, under both lids so a lid covers it with the eye;
                    over the lids it rings a shut eye like a pair of glasses.
                    Double width, because the clip keeps only the inner half. */}
                <Ellipse
                    cx={cx} cy={E.cy} rx={E.rx} ry={E.ry}
                    fill="none" stroke={C.eyeRim} strokeWidth={3}
                />
            </G>

            <G clipPath={`url(#${lidClip})`}>
                {/* Lower lid. Its top edge bows upward, so a squint makes the
                    happy ^^ curve rather than just cutting the eye in half. */}
                <AG animatedProps={squintP}>
                    <Path
                        d={`M${cx - 28} ${E.cy + 26} Q${cx} ${E.cy - 2} ${cx + 28} ${E.cy + 26} `
                            + `L${cx + 28} ${E.cy + 84} L${cx - 28} ${E.cy + 84} Z`}
                        fill={C.face}
                    />
                </AG>

                {/* Upper lid, parked just above the eye and dropped to shut it.
                    Its lash line stops at `lid.hold`, so a shut eye still shows one. */}
                <AG animatedProps={lidP}>
                    <Path d={lidPath(cx)} fill={C.face} />
                </AG>
                <AG animatedProps={lidLineP}>
                    <Path d={lidLinePath(cx)} fill="none" stroke={C.brow} strokeWidth={C.lidW} />
                </AG>
            </G>

            {/* Lashes. Static, like the ilà — the eye beneath them performs,
                these say whose eye it is. Outer corner only, mirrored by which
                side of centre this eye sits on. */}
            {C.lashes && !cropped && R.lashes.strokes.map(([x1, y1, x2, y2]) => {
                const flip = cx > R.lashes.mirror;
                const X = (v: number) => (flip ? 2 * R.lashes.mirror - v : v);
                return (
                    <Path
                        key={`${clip}-${x1}`}
                        d={`M${X(x1)} ${y1} L${X(x2)} ${y2}`}
                        fill="none" stroke={C.brow} strokeWidth={R.lashes.w}
                        strokeLinecap="round"
                    />
                );
            })}
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
                <ClipPath id={faceClip}><Path d={outline} /></ClipPath>
                <ClipPath id={eyeLClip}>
                    <Ellipse cx={E.lx} cy={E.cy} rx={E.rx} ry={E.ry} />
                </ClipPath>
                <ClipPath id={eyeRClip}>
                    <Ellipse cx={E.rx2} cy={E.cy} rx={E.rx} ry={E.ry} />
                </ClipPath>
                <ClipPath id={lidLClip}>
                    <Ellipse cx={E.lx} cy={E.cy} rx={E.rx + E.lidBleed} ry={E.ry + E.lidBleed} />
                </ClipPath>
                <ClipPath id={lidRClip}>
                    <Ellipse cx={E.rx2} cy={E.cy} rx={E.rx + E.lidBleed} ry={E.ry + E.lidBleed} />
                </ClipPath>
                {hair.fade && (
                    <LinearGradient id={fadeFill} x1="0" y1="0" x2="0" y2="1">
                        {hair.fade.stops.map(([offset, opacity]) => (
                            <Stop
                                key={offset} offset={offset}
                                stopColor={C.crest} stopOpacity={opacity}
                            />
                        ))}
                    </LinearGradient>
                )}
            </Defs>

            <AG animatedProps={headProps} originX={R.pivotX} originY={R.pivotY}>
                {/* Hair behind the head, swaying on the crest channel. */}
                {!cropped && hair.back && (
                    <AG animatedProps={hairBackProps} originX={hair.px} originY={hair.py}>
                        <Path
                            d={hair.back} fill={C.crest} stroke={C.rim}
                            strokeWidth={H.rimW} strokeLinejoin="round"
                        />
                        {hair.under && (
                            <Path d={hair.under} fill={C.hairDark} opacity={H.underOpacity} />
                        )}
                        {hair.backStrands?.map((d) => (
                            <Path
                                key={d} d={d} fill="none" stroke={C.hairDark}
                                strokeWidth={H.strandW} strokeLinecap="round"
                                opacity={H.strandOpacity}
                            />
                        ))}
                    </AG>
                )}

                {/* Ears, between the hair and the face, which covers their inner half. */}
                {!cropped && [[R.ear.d, R.ear.inner], [EAR_R, EAR_INNER_R]].map(([d, inner], k) => (
                    <React.Fragment key={d}>
                        <Path
                            d={d} fill={C.face} stroke={C.rim}
                            strokeWidth={R.rimW} strokeLinejoin="round"
                        />
                        <Path
                            d={inner} fill="none" stroke={C.contour}
                            strokeWidth={R.ear.innerW} strokeLinecap="round"
                            opacity={R.ear.innerOpacity}
                        />
                        {C.studs && (
                            <Circle
                                cx={k ? 2 * R.ear.mirror - R.ear.stud.cx : R.ear.stud.cx}
                                cy={R.ear.stud.cy} r={R.ear.stud.r}
                                fill={C.studs} stroke={C.rim} strokeWidth={R.ear.stud.w}
                            />
                        )}
                    </React.Fragment>
                ))}

                <Path d={outline} fill={C.face} />

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
                    {!cropped && C.marks && R.marks.strokes.map(([x1, y1, x2, y2]) => (
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

                    {/* Nose. Dropped below 48px with the ears, where it would only be mud. */}
                    {!cropped && (
                        <>
                            <Ellipse
                                cx={R.nose.bridge.cx} cy={R.nose.bridge.cy}
                                rx={R.nose.bridge.rx} ry={R.nose.bridge.ry}
                                fill="#ffffff" opacity={R.nose.bridge.opacity}
                            />
                            <Path
                                d={R.nose.d} fill="none" stroke={C.contour}
                                strokeWidth={R.nose.w} strokeLinecap="round"
                                opacity={R.nose.opacity}
                            />
                        </>
                    )}

                    {!cropped && (
                        <Path
                            d={R.chin.d} fill="none" stroke={C.contour}
                            strokeWidth={R.chin.w} strokeLinecap="round" opacity={R.chin.opacity}
                        />
                    )}

                    <APath animatedProps={mouthProps} fill={C.mouth} />
                    <APath animatedProps={tongueProps} fill={C.tongue} />
                </G>

                <Path d={outline} fill="none" stroke={C.rim} strokeWidth={R.rimW} />

                {/*
                  * Hair in FRONT of the face: over its outline, so the rim does
                  * not run through the hair, but under the eyes and brows,
                  * which carry the expression and must never be covered.
                  */}
                {!cropped && hair.front && (
                    <AG animatedProps={hairFrontProps} originX={hair.px} originY={hair.py}>
                        {hair.fade?.d.map((d) => <Path key={d} d={d} fill={`url(#${fadeFill})`} />)}
                        <Path
                            d={hair.front} fill={C.crest}
                            stroke={hair.outline ? undefined : C.rim}
                            strokeWidth={H.rimW} strokeLinejoin="round"
                        />
                        {hair.soft && (
                            <Path
                                d={hair.soft} fill="none" stroke={C.crest}
                                strokeWidth={H.softW} strokeLinecap="round" opacity={H.softOpacity}
                            />
                        )}
                        {hair.outline?.map((d) => (
                            <Path
                                key={d} d={d} fill="none" stroke={C.rim}
                                strokeWidth={H.rimW} strokeLinecap="round" strokeLinejoin="round"
                            />
                        ))}
                        {hair.strands?.map((d) => (
                            <Path
                                key={d} d={d} fill="none" stroke={C.hairDark}
                                strokeWidth={H.strandW} strokeLinecap="round"
                                opacity={H.strandOpacity}
                            />
                        ))}
                        {hair.sheen?.d.map((d) => (
                            <Path
                                key={d} d={d} fill="none" stroke={C.hairLight}
                                strokeWidth={hair.sheen!.w} strokeLinecap="round"
                                opacity={hair.sheen!.opacity}
                            />
                        ))}
                    </AG>
                )}

                {eye(E.lx, eyeLClip, lidLClip, irisLProps, lidLProps, lidLineLProps, squintLProps)}
                {eye(E.rx2, eyeRClip, lidRClip, irisRProps, lidRProps, lidLineRProps, squintRProps)}

                <AG animatedProps={browLProps} originX={R.brow.lpx} originY={R.brow.lpy}>
                    <Path
                        d={brows.l} fill={C.brow} stroke={C.brow}
                        strokeWidth={1.2} strokeLinejoin="round"
                    />
                </AG>
                <AG animatedProps={browRProps} originX={R.brow.rpx} originY={R.brow.rpy}>
                    <Path
                        d={brows.r} fill={C.brow} stroke={C.brow}
                        strokeWidth={1.2} strokeLinejoin="round"
                    />
                </AG>
            </AG>
        </Svg>
    );
}

export const Asaro = forwardRef<AsaroHandle, AsaroProps>(AsaroBase);
Asaro.displayName = 'Asaro';
