/**
 * Àṣàrò — the character: a face with no body. Geometry and keyframes live in
 * src/theme/asaroRig.ts.
 *
 * Everything animates in Reanimated worklets on the UI thread. The idle life
 * (breath, blink, gaze) is irregular on purpose, so it never looks mechanical.
 */
import React, {
    forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
    Easing, ReduceMotion, cancelAnimation, useAnimatedProps, useSharedValue, withRepeat,
    withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, {
    Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Stop, type GProps,
} from 'react-native-svg';

import {
    ASARO_ACTIONS, ASARO_LOOKS, ASARO_REST, ASARO_RIG, ASARO_SINCERE_REST,
    type AsaroAction, type AsaroLook, type AsaroMood, type HairShape,
} from '../../theme/asaroRig';
import { useAsaroLook } from '../../storage/asaroLook';

/** `matrix` is the native group's transform prop; see `mat`. */
const AG = Animated.createAnimatedComponent(
    G as unknown as React.ComponentClass<GProps & { matrix?: number[] }>,
);
const APath = Animated.createAnimatedComponent(Path);
const AEllipse = Animated.createAnimatedComponent(Ellipse);

export type { AsaroAction, AsaroLook, AsaroMood };

export interface AsaroHandle {
    /** Play a performance once. Interrupts anything already running. */
    play: (action: AsaroAction) => void;
}

export interface AsaroProps {
    size?: number;
    /** Which look to show. Defaults to the reader's choice. */
    look?: AsaroLook;
    /** Play on mount, and again whenever this changes. */
    action?: AsaroAction;
    /** End `action` on its peak and stay there, for a face that is the message. */
    hold?: boolean;
    /** Where to look, each axis −1…1. Omit for his idle watch. */
    lookAt?: { x: number; y: number };
    /** How he holds his face between actions. Defaults to `knowing`. */
    mood?: AsaroMood;
    /** Crop to the face and drop the hair. Defaults on below 48px. */
    bust?: boolean;
    label?: string;
}

const R = ASARO_RIG;
const E = R.eye;
const M = R.mouth;
const H = R.hair;
const REST = ASARO_REST;
const SINCERE = ASARO_SINCERE_REST;

/** Stable ordering so a worklet can address an action by index. */
const ACTION_NAMES = Object.keys(ASARO_ACTIONS) as AsaroAction[];

/** Channels, transposed: one array per channel, indexed by action, so worklets can sample them. */
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
// Optional channel: an action without `press` gets a run of ones.
const C_PRESS = ACTION_NAMES.map(
    (n) => ASARO_ACTIONS[n].press ?? ASARO_ACTIONS[n].t.map(() => 1),
);
const C_CREST = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].crest);
const C_GX = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].gx);
const C_GY = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].gy);
const C_GW = ACTION_NAMES.map((n) => ASARO_ACTIONS[n].gw);

/** How far each keyframe is from rest, with every channel scaled by its own range. */
const POSE_SCORES = (() => {
    const channels = Object.keys(REST) as (keyof typeof REST)[];
    const scale = Object.fromEntries(channels.map((c) => [c, Math.max(1e-6, ...ACTION_NAMES.flatMap(
        (n) => ASARO_ACTIONS[n][c].map((v) => Math.abs(v - REST[c])),
    ))])) as Record<keyof typeof REST, number>;
    return ACTION_NAMES.map((n) => {
        const A = ASARO_ACTIONS[n];
        return A.t.map((_, k) => channels.reduce((sum, c) => sum + Math.abs(A[c][k] - REST[c]) / scale[c], 0));
    });
})();

/** Each action's fullest pose: where `hold` stops, and what reduced motion shows. */
const PEAK_T = ACTION_NAMES.map((n, i) => {
    const s = POSE_SCORES[i];
    return ASARO_ACTIONS[n].t[s.indexOf(Math.max(...s))];
});

/**
 * Where each action pauses: its last strong pose before settling. Not the
 * peak, which in a rhythmic gesture comes first and would stall it mid-rock.
 */
const BEAT_T = ACTION_NAMES.map((n, i) => {
    const authored = ASARO_ACTIONS[n].beat;
    if (authored !== undefined) return authored;
    const s = POSE_SCORES[i];
    const strong = 0.85 * Math.max(...s);
    let k = s.length - 1;
    while (k > 0 && s[k] < strong) k--;
    return ASARO_ACTIONS[n].t[k];
});

/** Wait for the screen to settle, so the first movement is seen. */
const START_DELAY_MS = 400;
/** How long each action holds its last strong pose. */
const BEAT_MS = 400;
/** The way back to rest runs this much slower, easing out, so he settles rather than snaps. */
const RETURN_STRETCH = 1.6;
/** A floor, for actions whose beat sits so late that the stretch alone leaves a snap. */
const RETURN_MIN_MS = 500;

/** The way back to rest, from the beat, for action `i`. */
function returnMs(i: number) {
    const stretched = ASARO_ACTIONS[ACTION_NAMES[i]].ms * (1 - BEAT_T[i]) * RETURN_STRETCH;
    return stretched > RETURN_MIN_MS ? stretched : RETURN_MIN_MS;
}

/** From `action` changing to him being back at rest. */
export function performanceMs(action: AsaroAction) {
    const i = ACTION_NAMES.indexOf(action);
    return START_DELAY_MS + ASARO_ACTIONS[action].ms * BEAT_T[i] + BEAT_MS + returnMs(i);
}

let reportedReduceMotion = false;

/** Cubic ease-in-out, applied inside each keyframe segment. */
function ease(t: number) {
    'worklet';
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Sample one channel, eased within each segment (linear looks mechanical). */
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

/**
 * A group transform as RNSVG's native `matrix`. Animated props skip the JS
 * render that turns `translateY`/`rotation`/`origin*` into one, so the native
 * group would ignore them. Same order as RNSVG: translate(t + o) · rotate ·
 * scale · translate(−o).
 */
function mat(tx: number, ty: number, rot = 0, sx = 1, sy = 1, ox = 0, oy = 0) {
    'worklet';
    const r = (rot * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const a = cos * sx;
    const b = sin * sx;
    const c = -sin * sy;
    const d = cos * sy;
    return { matrix: [a, b, c, d, tx + ox - (ox * a + oy * c), ty + oy - (ox * b + oy * d)] };
}

/** A lid value shifted toward the sincere rest by `s` (0…1), never below open. */
function lidAt(a: number, s: number, rest: number, sincere: number) {
    'worklet';
    const v = a + s * (sincere - rest);
    return v > 0 ? v : 0;
}

/** Rounds to one decimal to keep per-frame path strings short. */
function r1(v: number) {
    'worklet';
    return Math.round(v * 10) / 10;
}

/** The mouth lens for this frame, shared by the mouth and the tongue. */
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
        // The last fifth of the inner end rounds off instead of stopping square.
        const cap = s > 0.8 ? Math.sqrt(1 - ((s - 0.8) / 0.2) ** 2 * 0.75) : 1;
        const hw = ((w / 2) * (tail + (inner - tail) * s) * cap) / Math.hypot(dx, dy);
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
/** Where the lid edge meets the left eye's outline, as a screen angle in degrees. */
function lidCornerAngle(l: number) {
    const lidY = (x: number) => LID_EDGE + (E.lid.bow / 2) * (1 - ((x - E.lx) / 27) ** 2) + l * E.lidTravel;
    let a = 90;
    let b = 270;
    for (let i = 0; i < 30; i++) {
        const m = (a + b) / 2;
        const r = (m * Math.PI) / 180;
        if (E.cy + E.ry * Math.sin(r) - lidY(E.lx + E.rx * Math.cos(r)) > 0) a = m;
        else b = m;
    }
    return (a + b) / 2;
}

/** Lash turn from the rest lid, sampled over 0…`lid.hold`, so the lashes ride the lid edge. */
const LASH_STEPS = 16;
const LASH_TURN = Array.from({ length: LASH_STEPS + 1 }, (_, k) =>
    lidCornerAngle((k / LASH_STEPS) * E.lid.hold) - lidCornerAngle(REST.lidL));

function lashTurn(l: number) {
    'worklet';
    const u = l / E.lid.hold;
    const f = (u < 0 ? 0 : u > 1 ? 1 : u) * LASH_STEPS;
    const i = f >= LASH_STEPS ? LASH_STEPS - 1 : Math.floor(f);
    return LASH_TURN[i] + (LASH_TURN[i + 1] - LASH_TURN[i]) * (f - i);
}

const lidLinePath = (cx: number) => `M${cx - 27} ${LID_EDGE} Q${cx} ${LID_EDGE + E.lid.bow} ${cx + 27} ${LID_EDGE}`;

function AsaroBase(
    { size = 96, look, action, hold = false, lookAt, mood = 'knowing', bust, label }: AsaroProps,
    ref: React.Ref<AsaroHandle>,
) {
    const chosen = useAsaroLook();
    const resolved: AsaroLook = look ?? chosen;
    const C = ASARO_LOOKS[resolved] ?? ASARO_LOOKS.male;
    // The look's hair, or the fallback crest.
    const hair: HairShape = C.hair ?? {
        back: R.crest.d, sway: { back: 1, front: 1 }, px: R.crest.px, py: R.crest.py,
    };
    const swayBack = hair.sway.back;
    const swayFront = hair.sway.front;
    const brows = BROWS[resolved] ?? BROWS.male;
    const outline = C.head ?? R.face;

    const cropped = bust ?? size < 48;
    const box = cropped ? R.bustBox : R.viewBox;
    const [, , vw, vh] = box.split(' ').map(Number);

    /** Unique clip ids, so two faces on one screen do not collide. */
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const faceClip = `face${uid}`;
    const eyeLClip = `eyeL${uid}`;
    const eyeRClip = `eyeR${uid}`;
    const lidLClip = `lidL${uid}`;
    const lidRClip = `lidR${uid}`;
    const fadeFill = `fade${uid}`;
    const shadeFill = `shade${uid}`;

    const [reduceMotion, setReduceMotion] = useState(false);

    // Shared values live on the UI thread; nothing below runs per-frame in JS.
    const breath = useSharedValue(0);
    const blink = useSharedValue(0);
    const gazeX = useSharedValue(0);
    const gazeY = useSharedValue(0);
    const prog = useSharedValue(0);
    /** Index into ACTION_NAMES, or −1 when idle. */
    const act = useSharedValue(-1);
    /** 0 knowing … 1 sincere, eased. */
    const sincerity = useSharedValue(mood === 'sincere' ? 1 : 0);

    /** Held separately so a new action can cancel the previous one's reset. */
    const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let alive = true;
        AccessibilityInfo.isReduceMotionEnabled().then((on) => {
            if (__DEV__ && on && !reportedReduceMotion) {
                reportedReduceMotion = true;
                console.log('[Asaro] reduce motion is on: blink only, expressions held still');
            }
            if (alive) setReduceMotion(on);
        });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => { alive = false; sub.remove(); };
    }, []);

    useEffect(() => () => {
        if (actionTimer.current) clearTimeout(actionTimer.current);
    }, []);

    useEffect(() => {
        const to = mood === 'sincere' ? 1 : 0;
        sincerity.value = reduceMotion ? to : withTiming(to, { duration: 420 });
    }, [mood, reduceMotion, sincerity]);

    // Breath — a slow sine the whole face rides on.
    useEffect(() => {
        if (reduceMotion) { cancelAnimation(breath); breath.value = 0; return; }
        breath.value = 0;
        breath.value = withRepeat(
            withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false,
        );
        return () => cancelAnimation(breath);
    }, [reduceMotion, breath]);

    // Blink, on an irregular schedule. Kept under reduced motion: it travels
    // nowhere, and without it he reads as a picture rather than a face.
    useEffect(() => {
        let alive = true;
        let id: ReturnType<typeof setTimeout>;
        const loop = () => {
            if (!alive) return;
            blink.value = withSequence(
                withTiming(1, { duration: 95, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.Never }),
                withTiming(0, { duration: 130, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
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
    }, [blink]);

    // Gaze — follow a target, or watch when none is given. Depends on the
    // coordinates, not the object, so a new literal each render does not restart it.
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
        // He watches: mostly holds the reader's eye, sometimes darts off and back.
        const watch = () => {
            if (!alive) return;
            // No side glances when sincere.
            if (mood === 'knowing' && Math.random() < 0.3) {
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
    }, [aimX, aimY, mood, reduceMotion, gazeX, gazeY]);

    const play = useCallback((name: AsaroAction, keep: boolean, delay: number) => {
        const A = ASARO_ACTIONS[name];
        if (!A) return;
        if (actionTimer.current) clearTimeout(actionTimer.current);
        cancelAnimation(prog);
        const i = ACTION_NAMES.indexOf(name);
        act.value = i;
        if (reduceMotion) {
            // The pose, shown still rather than moved to.
            prog.value = PEAK_T[i];
        } else if (keep) {
            prog.value = 0;
            prog.value = withDelay(delay, withTiming(PEAK_T[i], {
                duration: A.ms * PEAK_T[i], easing: Easing.linear,
            }));
        } else {
            const b = BEAT_T[i];
            prog.value = 0;
            prog.value = withDelay(delay, withSequence(
                withTiming(b, { duration: A.ms * b, easing: Easing.linear }),
                withDelay(BEAT_MS, withTiming(1, { duration: returnMs(i), easing: Easing.out(Easing.cubic) })),
            ));
        }
        if (keep) return;
        actionTimer.current = setTimeout(() => {
            act.value = -1;
            actionTimer.current = null;
        }, (reduceMotion ? A.ms + BEAT_MS : A.ms * BEAT_T[i] + BEAT_MS + returnMs(i)) + delay + 40);
    }, [act, prog, reduceMotion]);

    // A replay is a reaction, never a held state.
    useImperativeHandle(ref, () => ({ play: (name) => play(name, false, 0) }), [play]);
    useEffect(() => { if (action) play(action, hold, START_DELAY_MS); }, [action, hold, play]);

    // ---- animated channels -------------------------------------------------

    const headProps = useAnimatedProps(() => {
        const br = Math.sin(breath.value * Math.PI * 2);
        const sway = Math.sin(breath.value * Math.PI * 2 * 0.37);
        const i = act.value;
        const p = prog.value;
        const sq = (1 + br * 0.016) * ch(i, p, C_SQ, REST.sq);
        return mat(
            ch(i, p, C_LEAN, REST.lean),
            br * 2.2 + ch(i, p, C_BOB, REST.bob),
            sway * 1.2 + ch(i, p, C_TIP, REST.tip),
            // Squash preserves area: as it flattens it also widens.
            2 - sq,
            sq,
            R.pivotX,
            R.pivotY,
        );
    });

    const hairPx = hair.px;
    const hairPy = hair.py;

    const hairBackProps = useAnimatedProps(() => {
        const sway = Math.sin(breath.value * Math.PI * 2 * 0.37);
        const rot = (sway * 1.8 + ch(act.value, prog.value, C_CREST, REST.crest)) * swayBack;
        return mat(0, 0, rot, 1, 1, hairPx, hairPy);
    }, [swayBack, hairPx, hairPy]);

    const hairFrontProps = useAnimatedProps(() => {
        const sway = Math.sin(breath.value * Math.PI * 2 * 0.37);
        const rot = (sway * 1.8 + ch(act.value, prog.value, C_CREST, REST.crest)) * swayFront;
        return mat(0, 0, rot, 1, 1, hairPx, hairPy);
    }, [swayFront, hairPx, hairPy]);

    const browLProps = useAnimatedProps(() => mat(
        0,
        ch(act.value, prog.value, C_BROWL, REST.browL),
        ch(act.value, prog.value, C_TILTL, REST.tiltL),
        1, 1, R.brow.lpx, R.brow.lpy,
    ));

    const browRProps = useAnimatedProps(() => {
        const s = sincerity.value;
        return mat(
            0,
            ch(act.value, prog.value, C_BROWR, REST.browR) + s * (SINCERE.browR - REST.browR),
            ch(act.value, prog.value, C_TILTR, REST.tiltR) + s * (SINCERE.tiltR - REST.tiltR),
            1, 1, R.brow.rpx, R.brow.rpy,
        );
    });

    // Blink and wink share one lid; the eye takes whichever is more closed.
    const lidLProps = useAnimatedProps(() => {
        const a = lidAt(
            ch(act.value, prog.value, C_LIDL, REST.lidL), sincerity.value, REST.lidL, SINCERE.lidL,
        );
        const b = blink.value;
        return mat(0, (a > b ? a : b) * E.lidTravel);
    });

    const lidRProps = useAnimatedProps(() => {
        const a = lidAt(
            ch(act.value, prog.value, C_LIDR, REST.lidR), sincerity.value, REST.lidR, SINCERE.lidR,
        );
        const b = blink.value;
        return mat(0, (a > b ? a : b) * E.lidTravel);
    });

    const lidLineLProps = useAnimatedProps(() => {
        const a = lidAt(
            ch(act.value, prog.value, C_LIDL, REST.lidL), sincerity.value, REST.lidL, SINCERE.lidL,
        );
        const l = a > blink.value ? a : blink.value;
        return mat(0, (l < E.lid.hold ? l : E.lid.hold) * E.lidTravel);
    });

    const lidLineRProps = useAnimatedProps(() => {
        const a = lidAt(
            ch(act.value, prog.value, C_LIDR, REST.lidR), sincerity.value, REST.lidR, SINCERE.lidR,
        );
        const l = a > blink.value ? a : blink.value;
        return mat(0, (l < E.lid.hold ? l : E.lid.hold) * E.lidTravel);
    });

    const lashLProps = useAnimatedProps(() => {
        const a = lidAt(
            ch(act.value, prog.value, C_LIDL, REST.lidL), sincerity.value, REST.lidL, SINCERE.lidL,
        );
        return mat(0, 0, lashTurn(a > blink.value ? a : blink.value), 1, 1, E.lx, E.cy);
    });

    const lashRProps = useAnimatedProps(() => {
        const a = lidAt(
            ch(act.value, prog.value, C_LIDR, REST.lidR), sincerity.value, REST.lidR, SINCERE.lidR,
        );
        return mat(0, 0, -lashTurn(a > blink.value ? a : blink.value), 1, 1, E.rx2, E.cy);
    });

    const squintLProps = useAnimatedProps(() => mat(
        0, -ch(act.value, prog.value, C_SQUINT, REST.squint) * E.squintTravel,
    ));

    const squintRProps = useAnimatedProps(() => mat(
        0, -ch(act.value, prog.value, C_SQUINT, REST.squint) * E.squintTravel,
    ));

    const irisLProps = useAnimatedProps(() => {
        const i = act.value;
        const p = prog.value;
        const w = ch(i, p, C_GW, REST.gw);
        return mat(
            (gazeX.value * (1 - w) + ch(i, p, C_GX, REST.gx) * w) * E.travelX,
            (gazeY.value * (1 - w) + ch(i, p, C_GY, REST.gy) * w) * E.travelY,
        );
    });

    const irisRProps = useAnimatedProps(() => {
        const i = act.value;
        const p = prog.value;
        const w = ch(i, p, C_GW, REST.gw);
        return mat(
            (gazeX.value * (1 - w) + ch(i, p, C_GX, REST.gx) * w) * E.travelX,
            (gazeY.value * (1 - w) + ch(i, p, C_GY, REST.gy) * w) * E.travelY,
        );
    });

    // One filled lens; shut, it is a line. The smirk tilts it, and sincerity removes the smirk.
    const mouthProps = useAnimatedProps(() => {
        const { w, lo, up } = lens(act.value, prog.value);
        const k = 1 - sincerity.value;
        const qx = M.cx + M.smirk.shift * k;
        const yl = M.cy + M.smirk.rise * k;
        const yr = M.cy - M.smirk.rise * k;
        return {
            d: `M${r1(M.cx - w)} ${yl} Q${qx} ${r1(lo)} ${r1(M.cx + w)} ${yr} `
                + `Q${qx} ${r1(up)} ${r1(M.cx - w)} ${yl} Z`,
        };
    });

    // Tongue: the middle half (t 0.25…0.75) of the lower edge, humped up as the mouth opens.
    const tongueProps = useAnimatedProps(() => {
        const { o, w, lo } = lens(act.value, prog.value);
        const d = lo - M.cy;
        const y0 = M.cy + 0.375 * d;
        const yc = M.cy + 0.625 * d;
        const top = yc - 2 * o * M.drop * M.tongue;
        const k = 1 - sincerity.value;
        const x0 = M.cx + 0.375 * M.smirk.shift * k;
        const qx = M.cx + 0.625 * M.smirk.shift * k;
        const yl = r1(y0 + (M.smirk.rise * k) / 2);
        const yr = r1(y0 - (M.smirk.rise * k) / 2);
        return {
            d: `M${r1(x0 - w / 2)} ${yl} Q${qx} ${r1(yc)} ${r1(x0 + w / 2)} ${yr} `
                + `Q${qx} ${r1(top)} ${r1(x0 - w / 2)} ${yl} Z`,
            opacity: o > 0.01 ? 1 : 0,
        };
    });

    const creaseProps = useAnimatedProps(() => {
        const { o, w } = lens(act.value, prog.value);
        const k = 1 - sincerity.value;
        const xr = M.cx + w;
        const yr = M.cy - M.smirk.rise * k;
        const open = 1 - o * 4;
        return {
            d: `M${r1(xr + 0.5)} ${r1(yr + 2)} Q${r1(xr + 3.8)} ${r1(yr + 0.2)} ${r1(xr + 3.4)} ${r1(yr - 4.2)}`,
            opacity: M.crease.opacity * k * (open > 0 ? open : 0),
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
        lashP: typeof lashLProps,
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

                {/* Eye rim, under the lids. Double width: the clip keeps the inner half. */}
                <Ellipse
                    cx={cx} cy={E.cy} rx={E.rx} ry={E.ry}
                    fill="none" stroke={C.eyeRim} strokeWidth={3}
                />
            </G>

            <G clipPath={`url(#${lidClip})`}>
                {/* Lower lid; its top edge bows up, so a squint makes a happy curve. */}
                <AG animatedProps={squintP}>
                    <Path
                        d={`M${cx - 28} ${E.cy + 26} Q${cx} ${E.cy - 2} ${cx + 28} ${E.cy + 26} `
                            + `L${cx + 28} ${E.cy + 84} L${cx - 28} ${E.cy + 84} Z`}
                        fill={C.face}
                    />
                </AG>

                {/* Upper lid and its line, which stops at `lid.hold`. */}
                <AG animatedProps={lidP}>
                    <Path d={lidPath(cx)} fill={C.face} />
                </AG>
                <AG animatedProps={lidLineP}>
                    <Path d={lidLinePath(cx)} fill="none" stroke={C.brow} strokeWidth={C.lidW} />
                </AG>
            </G>

            {/* Lashes at the outer corner, mirrored for the right eye; they turn with the lid. */}
            {C.lashes && !cropped && (
                <AG animatedProps={lashP}>
                    {R.lashes.strokes.map(([x1, y1, qx, qy, x2, y2]) => {
                        const flip = cx > R.lashes.mirror;
                        const X = (v: number) => (flip ? 2 * R.lashes.mirror - v : v);
                        return (
                            <Path
                                key={`${clip}-${x1}`}
                                d={`M${X(x1)} ${y1} Q${X(qx)} ${qy} ${X(x2)} ${y2}`}
                                fill="none" stroke={C.brow} strokeWidth={R.lashes.w}
                                strokeLinecap="round"
                            />
                        );
                    })}
                </AG>
            )}
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
                <LinearGradient id={shadeFill} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset={0} stopColor={C.shade} stopOpacity={0} />
                    <Stop offset={0.55} stopColor={C.shade} stopOpacity={C.shadeOpacity} />
                    <Stop offset={1} stopColor={C.shade} stopOpacity={C.shadeOpacity} />
                </LinearGradient>
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

            <AG animatedProps={headProps}>
                {/* Hair behind the head, swaying on the crest channel. */}
                {!cropped && hair.back && (
                    <AG animatedProps={hairBackProps}>
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

                {/* Ears, between the hair and the face. */}
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

                {/* Soft features, clipped to the face so nothing spills past the jaw. */}
                <G clipPath={`url(#${faceClip})`}>
                    <Path d={R.shade} fill={`url(#${shadeFill})`} />

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

                    {/* Ilà, for a look that wears them. */}
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

                    {/* Nose, dropped below 48px. */}
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
                    {!cropped && (
                        <APath
                            animatedProps={creaseProps} fill="none" stroke={C.contour}
                            strokeWidth={M.crease.w} strokeLinecap="round"
                        />
                    )}
                </G>

                <Path d={outline} fill="none" stroke={C.rim} strokeWidth={R.rimW} />

                {/* Hair in front: over the face outline, under the eyes and brows. */}
                {!cropped && hair.front && (
                    <AG animatedProps={hairFrontProps}>
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

                {eye(E.lx, eyeLClip, lidLClip, irisLProps, lidLProps, lidLineLProps, lashLProps, squintLProps)}
                {eye(E.rx2, eyeRClip, lidRClip, irisRProps, lidRProps, lidLineRProps, lashRProps, squintRProps)}

                <AG animatedProps={browLProps}>
                    <Path
                        d={brows.l} fill={C.brow} stroke={C.brow}
                        strokeWidth={1.2} strokeLinejoin="round"
                    />
                </AG>
                <AG animatedProps={browRProps}>
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
