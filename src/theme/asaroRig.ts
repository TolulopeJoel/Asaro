/**
 * Àṣàrò's rig, as data: geometry, looks and keyframes.
 *
 * Accessibility: the rim, not the fill, is the 3:1 boundary WCAG 1.4.11 asks
 * for (6.99:1 on the Cloth ground; the fill is 2.80:1).
 *
 * Keyframes are parallel number arrays so worklets can sample them. Every
 * action MUST keep two invariants:
 *   1. every channel is exactly as long as its `t`;
 *   2. every channel starts and ends at its `ASARO_REST` value.
 *
 * design/asaro-face.html inlines these numbers; keep it in step.
 */

export type AsaroAction =
    | 'wave' | 'nod' | 'point' | 'thumbsUp' | 'celebrate' | 'shrug' | 'sigh' | 'think'
    // Expressions: how he looks, one per permitted emoji.
    | 'deadpan' | 'sideEye' | 'smug' | 'sheepish' | 'laugh';

/** How he holds his face between actions: `knowing` by default, `sincere` for reassurance. */
export type AsaroMood = 'knowing' | 'sincere';

/** Rest values for `sincere`. The smirk goes to zero with it. */
export const ASARO_SINCERE_REST = { lidL: 0, lidR: 0, browR: 0, tiltR: 0 } as const;

/** The male and female looks of one character. See design/ASARO-CHARACTER.md §7. */
export type AsaroLook = 'male' | 'female';

/**
 * One action's keyframes. `t` runs 0…1. Angles are degrees, offsets viewBox
 * units, and 0…1 channels are fractions of travel distances in `ASARO_RIG`.
 */
export interface ActionTable {
    /** Wall-clock duration of the whole performance. */
    ms: number;
    t: number[];

    // Head
    /** Rotation, degrees. Negative tips the crown left. */
    tip: number[];
    /** Vertical offset. Positive is down. */
    bob: number[];
    /** Vertical scale. Width takes the inverse, so area is preserved. */
    sq: number[];
    /** Horizontal offset. Positive leans right, toward the reader. */
    lean: number[];

    // Brows — negative lifts, because it is a translateY.
    browL: number[]; browR: number[];
    /** Rotation. Negative raises the left brow's inner end, positive the right's. */
    tiltL: number[]; tiltR: number[];

    // Eyes
    /** Upper lid, 0 open … 1 shut. Separate per eye so the character can wink. */
    lidL: number[]; lidR: number[];
    /** Lower lid, 0 … 1. This is the eye-smile; a lid drop is not the same thing. */
    squint: number[];

    // Mouth
    /** −1 full frown … 0 flat … 1 full smile. */
    mouthC: number[];
    /** Lip press: 1 normal, 0 a hairline. Optional; omitted means 1. */
    press?: number[];
    /** 0 shut … 1 wide. */
    mouthO: number[];

    /** Crest bend, degrees. */
    crest: number[];

    // Gaze override
    /** Where the action wants to look, each axis −1…1. */
    gx: number[]; gy: number[];
    /** How much of the gaze the action takes: 0 leaves idle drift alone, 1 seizes it. */
    gw: number[];
}

/**
 * The knowing rest: lids a little lowered, right brow up, a slight smile.
 * Every action starts and ends here.
 */
export const ASARO_REST = {
    tip: 0, bob: 0, sq: 1, lean: 0,
    browL: 0, browR: -4, tiltL: 0, tiltR: -3,
    lidL: 0.15, lidR: 0.15, squint: 0,
    mouthC: 0.3, mouthO: 0,
    crest: 0,
    gx: 0, gy: 0, gw: 0,
} as const;

/** Geometry in a 200×200 viewBox. `bustBox` is the face-only crop used below 48px. */
export const ASARO_RIG = {
    viewBox: '0 0 200 200',
    bustBox: '26 38 148 148',

    /** Default face outline. */
    face: 'M100 46 C140 46 166 74 166 112 C166 152 138 176 100 176 C62 176 34 152 34 112 C34 74 60 46 100 46 Z',
    /** Shade low on the face, clipped to it; it fades in from above, so it has no hard edge. */
    shade: 'M20 158 C60 136 140 136 180 158 L180 200 L20 200 Z',
    /** Head transform origin: the centre of the face. */
    pivotX: 100,
    pivotY: 111,
    rimW: 3,

    /** Hair outline and the strokes laid over it. */
    hair: {
        rimW: 2.5,
        strandW: 2, strandOpacity: 0.7,
        softW: 2.4, softOpacity: 0.5,
        underOpacity: 0.4,
    },

    /** Fallback hair for a look without `hair`: a brushstroke off the crown. */
    crest: {
        d: 'M80 56 C84 22 114 4 150 12 C132 24 122 38 116 58 Z',
        px: 100,
        py: 54,
    },

    /** Eyes. Large, because they carry most of the expression. */
    eye: {
        cy: 104,
        lx: 72,
        rx2: 128,
        rx: 22,
        ry: 24,
        iris: 12.5,
        pupil: 6.5,
        /** Warm crescent low in the iris, under the pupil. */
        irisLight: { dy: 6, rx: 8.5, ry: 5.2, opacity: 0.8 },
        /** Dark limbal ring just inside the iris edge. */
        ring: { inset: 0.8, w: 1.6, opacity: 0.55 },
        glint: { dx: -5, dy: -6, r: 4 },
        spark: { dx: 4.5, dy: 5, r: 2 },
        /** Pupil travel at full gaze. Keeps the iris inside the eye. */
        travelX: 7.5,
        travelY: 6,
        /** Distance the upper lid falls to shut the eye: 2·ry + 3. */
        lidTravel: 51,
        /** Upper lid edge: `lift` above the eye, bowed by `bow`. Its line stops at `hold`. */
        lid: { lift: 2, bow: 6, hold: 0.7 },
        /** Lids clip this much wider than the eye, so a shut eye leaves no ring. */
        lidBleed: 1.5,
        /** Distance the lower lid rises at squint 1. */
        squintTravel: 30,
    },

    brow: {
        l: 'M50 77 Q70 66 88 74',
        r: 'M112 74 Q130 66 150 77',
        lpx: 69, lpy: 71,
        rpx: 131, rpy: 71,
        w: 7.5,
        /** Half-width multipliers at the inner end and the tail. */
        taper: { inner: 1.1, tail: 0.35 },
    },

    /** Broad nose line and a faint bridge highlight. */
    nose: {
        d: 'M95 127 C91.5 129.5 92.5 134 96.5 133.4 C98.5 134.6 101.5 134.6 103.5 133.4 '
            + 'C107.5 134 108.5 129.5 105 127',
        w: 2.6,
        opacity: 0.55,
        bridge: { cx: 100, cy: 120, rx: 2.6, ry: 5, opacity: 0.13 },
    },

    /** Left ear, behind the face; the right is mirrored about `mirror`. */
    ear: {
        d: 'M40 98 C27 93 21 108 25 118 C27 125 33 128 40 125 Z',
        inner: 'M34 104 C28 107 28 116 33 120',
        innerW: 2.4,
        innerOpacity: 0.6,
        stud: { cx: 29, cy: 127, r: 3.2, w: 1.4 },
        mirror: 100,
    },

    /** Generated mouth: a lens opened by `mouthO` and bowed by `mouthC`. */
    mouth: {
        cx: 100,
        cy: 142,
        w: 27,
        /** How far the corners spread as it opens. */
        wOpen: 3,
        /** Bow per unit of `mouthC`. */
        bow: 24,
        /** How far the lower edge drops per unit of `mouthO`. */
        drop: 30,
        /** Half-thickness of the shut lens. */
        lip: 4.6,
        /** Tongue height, as a fraction of the open drop. */
        tongue: 0.75,
        /** Standing smirk: right corner `rise` higher, bow shifted `shift` toward it. */
        smirk: { rise: 3, shift: 1.5 },
        /** Crease at the raised corner; fades as the mouth opens or he turns sincere. */
        crease: { w: 2, opacity: 0.55 },
    },

    /** Blush: `base` at rest, plus `gain` per unit of smile above rest. */
    cheek: { lx: 66, rx: 134, cy: 138, w: 14, h: 8.5, base: 0.03, gain: 0.42 },

    /** Tonal curve under the mouth. */
    chin: { d: 'M92.5 164.5 Q100 166.8 107.5 164.5', w: 2.2, opacity: 0.4 },

    /** Lashes at the left eye's outer corner, mirrored: [x1, y1, qx, qy, x2, y2]. */
    lashes: {
        strokes: [
            [57.9, 85.6, 54, 83.8, 51.5, 80],
            [53, 91.5, 49, 90.2, 45.5, 86.8],
            [50.5, 98.5, 46.6, 98.2, 43.6, 95.2],
        ],
        mirror: 100,
        w: 2.4,
    },

    /** Ilà (pélé): strokes on the left cheek, mirrored for the right. */
    marks: {
        strokes: [
            [51, 133, 49, 150],
            [58, 132, 56, 152],
            [66, 133, 64, 151],
        ],
        mirror: 100,
        w: 3.2,
        /** Tonal: at full contrast they read as war paint. */
        opacity: 0.62,
    },
} as const;

/**
 * Hair a look wears instead of the crest. `back` is behind the head; `front`
 * is over the face, under the eyes and brows.
 */
export interface HairShape {
    back?: string;
    /** Darker layer over `back`, in `hairDark`. */
    under?: string;
    /** Strokes over `back`, in `hairDark`. */
    backStrands?: string[];
    front?: string;
    /** Edges of `front` to stroke; omitted, the whole outline. */
    outline?: string[];
    /** Soft hairline edge, in `crest`. */
    soft?: string;
    /** Under `front`: `crest` fading downward by `stops` ([offset, opacity]). */
    fade?: { d: string[]; stops: [number, number][] };
    /** Strokes over `front`, in `hairDark`. */
    strands?: string[];
    /** Highlight strokes over `front`, in `hairLight`. */
    sheen?: { d: string[]; w: number; opacity: number };
    /** Fraction of the crest channel each layer turns by. */
    sway: { back: number; front: number };
    /** Pivot for the sway, in viewBox units. */
    px: number;
    py: number;
}

export const ASARO_LOOKS: Record<AsaroLook, {
    face: string; shade: string; shadeOpacity: number;
    crest: string; rim: string; brow: string; mark: string;
    /** Hair shadow and highlight, either side of `crest`. */
    hairDark: string; hairLight: string;
    eyeWhite: string; eyeRim: string; iris: string; pupil: string;
    mouth: string; cheek: string; cheeks: boolean;
    /** Tonal lines drawn in the skin: the nose and the inner ear. */
    contour: string;
    tongue: string;
    irisLight: string;
    /** Width of the moving lid-edge line, drawn in `brow`. */
    lidW: number;
    /** Brow thickness as a fraction of `ASARO_RIG.brow.w`. */
    browWeight: number;
    /** Ear studs. Omitted, the ears are bare. */
    studs?: string;
    /** Face outline; omitted, `ASARO_RIG.face`. Only the lower half may differ. */
    head?: string;
    /** Whether this look wears the ilà. */
    marks: boolean;
    /** Lashes at the outer eye corners — see `ASARO_RIG.lashes`. */
    lashes?: boolean;
    /** Hair; omitted, the look wears `ASARO_RIG.crest`. */
    hair?: HairShape;
}> = {
    male: {
        face: '#c97355',
        shade: '#b1654b',
        shadeOpacity: 0.38,
        // Near-black espresso.
        crest: '#3a241b',
        hairDark: '#24160f',
        hairLight: '#6b4634',
        rim: '#6f3f2f',
        // Darker than the iris, so the brows always read.
        brow: '#44271d',
        eyeWhite: '#fbf7f1',
        eyeRim: 'rgba(0,0,0,0.18)',
        iris: '#5a3426',
        pupil: '#180e0a',
        mouth: '#502e22',
        mark: '#6f3f2f',
        cheek: '#a44b43',
        cheeks: true,
        contour: '#8f4f39',
        tongue: '#a4544c',
        irisLight: '#8a5a40',
        lidW: 2.4,
        browWeight: 1,
        // A fuller, squarer jaw than hers.
        head: 'M100 46 C140 46 166 74 166 112 '
            + 'C166.5 159 147 178 100 178 C53 178 33.5 159 34 112 C34 74 60 46 100 46 Z',
        marks: false,
        hair: {
            // Smooth taper fade, grown from the face edge; sides fade to skin by the ear.
            front: 'M47.5 70 C46.5 66.7 48.5 60.5 49.6 58.6 C50.7 56.8 54.8 51.7 56.4 50.1 '
                + 'C58 48.6 63.3 44.5 65.2 43.3 C67.2 42.1 73.5 39.1 75.7 38.2 '
                + 'C77.9 37.4 84.9 35.5 87.4 35.1 C89.8 34.7 97.4 34 100 34 '
                + 'C102.6 34 110.2 34.7 112.6 35.1 C115.1 35.5 122.1 37.4 124.3 38.2 '
                + 'C126.5 39.1 132.8 42.1 134.8 43.3 C136.7 44.5 142 48.6 143.6 50.1 '
                + 'C145.2 51.7 149.3 56.8 150.4 58.6 C151.5 60.5 153.5 66.7 152.5 70 L150 66 '
                + 'Q148 60 140 58.5 C126 55.5 74 55.5 60 58.5 Q52 60 50 66 Z',
            outline: [
                'M47.5 70 C46.5 66.7 48.5 60.5 49.6 58.6 C50.7 56.8 54.8 51.7 56.4 50.1 '
                    + 'C58 48.6 63.3 44.5 65.2 43.3 C67.2 42.1 73.5 39.1 75.7 38.2 '
                    + 'C77.9 37.4 84.9 35.5 87.4 35.1 C89.8 34.7 97.4 34 100 34 '
                    + 'C102.6 34 110.2 34.7 112.6 35.1 C115.1 35.5 122.1 37.4 124.3 38.2 '
                    + 'C126.5 39.1 132.8 42.1 134.8 43.3 C136.7 44.5 142 48.6 143.6 50.1 '
                    + 'C145.2 51.7 149.3 56.8 150.4 58.6 C151.5 60.5 153.5 66.7 152.5 70',
            ],
            soft: 'M50 66 Q52 60 60 58.5 C74 55.5 126 55.5 140 58.5 Q148 60 150 66',
            fade: {
                d: [
                    'M47.5 70 C40.8 78.6 36.4 89.1 34.8 100.9 L42.8 100.9 C43.8 90 47 78 51 64 Z',
                    'M152.5 70 C159.2 78.6 163.6 89.1 165.2 100.9 L157.2 100.9 C156.2 90 153 78 149 64 Z',
                ],
                stops: [[0, 1], [0.4, 0.72], [1, 0]],
            },
            sheen: { d: ['M55.3 56.2 C65.7 48.2 78.2 42.6 92.4 39.8'], w: 5, opacity: 0.3 },
            sway: { back: 0, front: 0.08 },
            px: 100,
            py: 56,
        },
    },

    /** Same rig and performances as `male`; hair, colours and small details differ. */
    female: {
        // A little lighter and warmer than his.
        face: '#dd8f6f',
        shade: '#c67a5f',
        shadeOpacity: 0.34,
        crest: '#c4658c',
        hairDark: '#a44c6c',
        hairLight: '#e393b2',
        rim: '#6f3f2f',
        brow: '#44271d',
        eyeWhite: '#fbf7f1',
        eyeRim: 'rgba(0,0,0,0.18)',
        iris: '#5a3426',
        pupil: '#180e0a',
        // Muted rose, 3.49:1 on her face.
        mouth: '#743834',
        mark: '#6f3f2f',
        cheek: '#b85d52',
        cheeks: true,
        contour: '#a86049',
        tongue: '#b0605a',
        irisLight: '#8a5a40',
        // Heavier than his; with the lashes it reads as liner.
        lidW: 3,
        browWeight: 0.78,
        studs: '#d4a95e',
        // Softer and a touch narrower at the chin than his.
        head: 'M100 46 C140 46 166 74 166 112 '
            + 'C164 149 131 176.5 100 176.5 C69 176.5 36 149 34 112 C34 74 60 46 100 46 Z',
        marks: false,
        lashes: true,
        hair: {
            // Tight at the crown, full at the ends, which hang as rounded locks.
            back: 'M100 26 C56 26 28 60 26 104 C24 130 14 156 6 182 C8 194 24 197 31 185 '
                + 'C38 197 58 198 65 185 C72 198 92 198 100 185 C108 198 128 198 135 185 '
                + 'C142 198 162 198 169 185 C176 197 192 194 194 182 C186 156 176 130 174 104 '
                + 'C172 60 144 26 100 26 Z',
            under: 'M44 120 C42 150 38 170 36 184 C44 190 58 190 65 185 C72 191 92 191 100 185 '
                + 'C108 191 128 191 135 185 C142 190 156 190 164 184 C162 170 158 150 156 120 Z',
            backStrands: [
                'M27 112 C24 138 18 160 12 180',
                'M38 146 C36 162 32 174 30 184',
                'M173 112 C176 138 182 160 188 180',
                'M162 146 C164 162 168 174 170 184',
                'M100 178 L100 188',
                'M66 176 C66 181 65 184 64 187',
                'M134 176 C134 181 135 184 136 187',
            ],
            // Corners tucked inside the mass so no gap shows; parted right of centre.
            front: 'M31 104 C28 60 60 33 100 33 C140 33 172 60 169 100 C164 80 150 66 128 61 '
                + 'Q123 60 121 57.5 Q117 62 102 63 C84 65 64 69 50 80 C44 86 41 93 40 98 '
                + 'C38 101 34 103 31 104 Z',
            strands: [
                'M121 44 C104 48 80 57 62 72',
                'M110 38 C90 42 66 53 50 70',
                'M127 45 C142 49 156 60 163 78',
            ],
            sheen: {
                d: [
                    'M64 46 C76 38 90 35 104 35',
                    'M136 40 C146 44 154 50 159 57',
                ],
                w: 4,
                opacity: 0.45,
            },
            sway: { back: 0.6, front: 0.2 },
            px: 100,
            py: 60,
        },
    },
};

/** Every performance. The hand gestures are done with the face alone. */
export const ASARO_ACTIONS: Record<AsaroAction, ActionTable> = {
    /** "Interesting." Head still, one brow up, mouth flat and pressed, gaze held on you. */
    deadpan: {
        ms: 1400,
        // Snap in and hold: an expression still moving reads as a reaction.
        t: /*      */[0, 0.07, 0.18, 0.5, 0.62, 0.9, 1],
        tip: /*    */[0, 0, 0, 0, 0, 0, 0],
        bob: /*    */[0, 0, 0, 0, 0, 0, 0],
        sq: /*     */[1, 1, 1, 1, 1, 1, 1],
        lean: /*   */[0, 0, 0, 0, 0, 0, 0],
        browL: /*  */[0, 0, 0, 0, 0, 0, 0],
        browR: /*  */[-4, -6, -11, -11, -11, -10, -4],
        tiltL: /*  */[0, 0, 0, 0, 0, 0, 0],
        tiltR: /*  */[-3, -2, -5, -5, -5, -4, -3],
        // Lowered and held. No scripted blink; the idle blink still runs.
        lidL: /*   */[0.15, 0.16, 0.22, 0.22, 0.22, 0.2, 0.15],
        lidR: /*   */[0.15, 0.16, 0.22, 0.22, 0.22, 0.2, 0.15],
        squint: /* */[0, 0, 0, 0, 0, 0, 0],
        // Just below flat: the rest (0.3) is already a smile.
        mouthC: /* */[0.3, 0.05, -0.08, -0.08, -0.08, -0.06, 0.3],
        mouthO: /* */[0, 0, 0, 0, 0, 0, 0],
        // Held shut.
        press: /*  */[1, 0.8, 0.45, 0.45, 0.45, 0.6, 1],
        crest: /*  */[0, 2, 3, 3, 3, 2, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0, 0],
        gy: /*     */[0, 0, 0, 0, 0, 0, 0],
        gw: /*     */[0, 0.9, 0.95, 0.95, 0.95, 0.9, 0],
    },

    /** 👀 "I noticed." The head leans away while the eyes look the other way. */
    sideEye: {
        ms: 1500,
        t: /*      */[0, 0.18, 0.4, 0.72, 0.88, 1],
        tip: /*    */[0, 1, 2, 2, 1, 0],
        bob: /*    */[0, 0, 0, 0, 0, 0],
        sq: /*     */[1, 1, 1, 1, 1, 1],
        lean: /*   */[0, -2, -3, -3, -1, 0],
        browL: /*  */[0, -4, -6, -6, -3, 0],
        browR: /*  */[-4, 2, 3, 3, 1, -4],
        tiltL: /*  */[0, -2, -3, -3, -1, 0],
        tiltR: /*  */[-3, 3, 5, 5, 2, -3],
        lidL: /*   */[0.15, 0.32, 0.46, 0.46, 0.24, 0.15],
        lidR: /*   */[0.15, 0.32, 0.46, 0.46, 0.24, 0.15],
        squint: /* */[0, 0.08, 0.14, 0.14, 0.07, 0],
        // Flat: the rest is a smile.
        mouthC: /* */[0.3, 0.1, -0.04, -0.04, 0.08, 0.3],
        mouthO: /* */[0, 0, 0, 0, 0, 0],
        crest: /*  */[0, -5, -7, -7, -3, 0],
        // Held, not swept: a stare, not a glance.
        gx: /*     */[0, 0.65, 0.88, 0.88, 0.5, 0],
        gy: /*     */[0, 0.05, 0.08, 0.08, 0.04, 0],
        gw: /*     */[0, 1, 1, 1, 0.6, 0],
    },

    /** 😌 "I'll allow it." Half-lidded, chin up, gaze down, a small pressed smile. */
    smug: {
        ms: 1100,
        t: /*      */[0, 0.2, 0.45, 0.72, 0.9, 1],
        tip: /*    */[0, 2, 4, 4, 2, 0],
        // Negative is up: the chin lifts.
        bob: /*    */[0, -3, -5, -5, -2, 0],
        sq: /*     */[1, 1.01, 1.02, 1.01, 1, 1],
        lean: /*   */[0, 0, 0, 0, 0, 0],
        // One brow up, the other still. Two raised is surprise; one is a verdict.
        browL: /*  */[0, -1, -1, -1, 0, 0],
        browR: /*  */[-4, -5, -8, -8, -4, -4],
        tiltL: /*  */[0, 0, 0, 0, 0, 0],
        tiltR: /*  */[-3, -2, -4, -4, -2, -3],
        lidL: /*   */[0.15, 0.3, 0.48, 0.48, 0.24, 0.15],
        lidR: /*   */[0.15, 0.3, 0.48, 0.48, 0.24, 0.15],
        squint: /* */[0, 0.2, 0.32, 0.32, 0.15, 0],
        mouthC: /* */[0.3, 0.42, 0.55, 0.55, 0.42, 0.3],
        mouthO: /* */[0, 0, 0, 0, 0, 0],
        // Held closed.
        press: /*  */[1, 0.85, 0.7, 0.7, 0.85, 1],
        crest: /*  */[0, 5, 8, 8, 4, 0],
        gx: /*     */[0, 0.1, 0.16, 0.16, 0.08, 0],
        // Down while the chin goes up.
        gy: /*     */[0, 0.2, 0.3, 0.3, 0.14, 0],
        gw: /*     */[0, 0.85, 0.95, 0.95, 0.5, 0],
    },

    /** 😅 Inner brows up like `shrug`, but the gaze goes down and away. */
    sheepish: {
        ms: 1300,
        t: /*      */[0, 0.15, 0.4, 0.66, 0.86, 1],
        tip: /*    */[0, -4, -6, -5, -2, 0],
        bob: /*    */[0, 1, 2, 2, 1, 0],
        sq: /*     */[1, 0.99, 0.98, 0.99, 1, 1],
        lean: /*   */[0, -2, -3, -3, -1, 0],
        browL: /*  */[0, -7, -10, -9, -4, 0],
        browR: /*  */[-4, -7, -10, -9, -4, -4],
        tiltL: /*  */[0, -5, -7, -6, -3, 0],
        tiltR: /*  */[-3, 5, 7, 6, 3, -3],
        lidL: /*   */[0.15, 0.2, 0.3, 0.26, 0.12, 0.15],
        lidR: /*   */[0.15, 0.2, 0.3, 0.26, 0.12, 0.15],
        squint: /* */[0, 0.26, 0.42, 0.36, 0.18, 0],
        mouthC: /* */[0.3, 0.55, 0.7, 0.64, 0.45, 0.3],
        mouthO: /* */[0, 0.08, 0.13, 0.1, 0.04, 0],
        crest: /*  */[0, -9, -13, -11, -5, 0],
        gx: /*     */[0, -0.42, -0.62, -0.56, -0.3, 0],
        gy: /*     */[0, 0.22, 0.32, 0.28, 0.14, 0],
        gw: /*     */[0, 0.85, 0.95, 0.85, 0.45, 0],
    },

    /** 😂 The threat was a joke: bouncing in place, crescent eyes, mouth pulsing. */
    laugh: {
        ms: 1300,
        t: /*      */[0, 0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.85, 1],
        tip: /*    */[0, -4, 3, -3, 3, -2, 2, 1, 0],
        bob: /*    */[0, -4, 1, -3, 1, -2, 1, 0, 0],
        sq: /*     */[1, 1.04, 0.97, 1.03, 0.97, 1.02, 0.98, 1, 1],
        lean: /*   */[0, -2, -1, -2, -1, -1, 0, 0, 0],
        browL: /*  */[0, -8, -6, -8, -6, -7, -5, -3, 0],
        browR: /*  */[-4, -9, -7, -9, -7, -8, -6, -5, -4],
        tiltL: /*  */[0, -4, -3, -4, -3, -3, -2, -1, 0],
        tiltR: /*  */[-3, 3, 2, 3, 2, 2, 1, -1, -3],
        lidL: /*   */[0.15, 0.16, 0.18, 0.16, 0.18, 0.16, 0.15, 0.15, 0.15],
        lidR: /*   */[0.15, 0.16, 0.18, 0.16, 0.18, 0.16, 0.15, 0.15, 0.15],
        squint: /* */[0, 0.48, 0.55, 0.5, 0.55, 0.5, 0.44, 0.22, 0],
        mouthC: /* */[0.3, 1, 1, 1, 1, 0.95, 0.9, 0.6, 0.3],
        // One pulse per "ha".
        mouthO: /* */[0, 0.62, 0.42, 0.62, 0.42, 0.55, 0.32, 0.1, 0],
        crest: /*  */[0, -8, 6, -6, 5, -4, 3, 1, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0, 0, 0, 0],
        gy: /*     */[0, 0.2, 0.2, 0.2, 0.2, 0.2, 0.15, 0.05, 0],
        gw: /*     */[0, 0.6, 0.6, 0.6, 0.6, 0.6, 0.5, 0.3, 0],
    },

    /** Hello. The head rocks, the eyes crease, the crest whips across. */
    wave: {
        ms: 920,
        t: /*      */[0, 0.15, 0.35, 0.55, 0.75, 1],
        tip: /*    */[0, -7, 8, -6, 4, 0],
        bob: /*    */[0, -3, -2, -3, -1, 0],
        sq: /*     */[1, 1.03, 1, 1.03, 1.01, 1],
        lean: /*   */[0, -2, 2, -2, 1, 0],
        browL: /*  */[0, -6, -5, -6, -3, 0],
        browR: /*  */[-4, -6, -5, -6, -3, -4],
        tiltL: /*  */[0, -4, -3, -4, -2, 0],
        tiltR: /*  */[-3, 4, 3, 4, 2, -3],
        lidL: /*   */[0.15, 0, 0, 0, 0, 0.15],
        lidR: /*   */[0.15, 0, 0, 0, 0, 0.15],
        squint: /* */[0, 0.42, 0.5, 0.46, 0.25, 0],
        mouthC: /* */[0.3, 0.9, 1, 0.95, 0.7, 0.3],
        mouthO: /* */[0, 0.22, 0.3, 0.24, 0.1, 0],
        crest: /*  */[0, -16, 18, -12, 7, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0],
        gy: /*     */[0, 0, 0, 0, 0, 0],
        // Holds the gaze on you.
        gw: /*     */[0, 0.6, 0.6, 0.6, 0.3, 0],
    },

    /** Agreement. Two clean bobs, lids dipping on each down-beat. */
    nod: {
        ms: 760,
        t: /*      */[0, 0.2, 0.4, 0.6, 0.8, 1],
        tip: /*    */[0, 1, 0, 1, 0, 0],
        bob: /*    */[0, 7, -2, 6, -1, 0],
        sq: /*     */[1, 0.965, 1.02, 0.97, 1.01, 1],
        lean: /*   */[0, 0, 0, 0, 0, 0],
        browL: /*  */[0, 2, -3, 2, -2, 0],
        browR: /*  */[-4, 2, -3, 2, -2, -4],
        tiltL: /*  */[0, 0, 0, 0, 0, 0],
        tiltR: /*  */[-3, 0, 0, 0, 0, -3],
        lidL: /*   */[0.15, 0.35, 0, 0.3, 0, 0.15],
        lidR: /*   */[0.15, 0.35, 0, 0.3, 0, 0.15],
        squint: /* */[0, 0.1, 0.2, 0.12, 0.08, 0],
        mouthC: /* */[0.3, 0.5, 0.6, 0.55, 0.45, 0.3],
        mouthO: /* */[0, 0, 0.05, 0, 0, 0],
        crest: /*  */[0, 10, -6, 8, -3, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0],
        gy: /*     */[0, 0.35, 0, 0.3, 0, 0],
        gw: /*     */[0, 0.7, 0.7, 0.7, 0.4, 0],
    },

    /** Look there. A lean-in, one brow up, and the pupils thrown at the target. */
    point: {
        ms: 880,
        t: /*      */[0, 0.18, 0.4, 0.62, 0.82, 1],
        tip: /*    */[0, -3, -6, -5, -2, 0],
        bob: /*    */[0, -2, -4, -3, -1, 0],
        sq: /*     */[1, 1.04, 1.05, 1.03, 1.01, 1],
        lean: /*   */[0, 5, 9, 8, 3, 0],
        browL: /*  */[0, -1, -2, -2, -1, 0],
        browR: /*  */[-4, -9, -11, -10, -5, -4],
        tiltL: /*  */[0, 2, 3, 3, 1, 0],
        tiltR: /*  */[-3, -7, -9, -8, -4, -3],
        lidL: /*   */[0.15, 0, 0, 0, 0, 0.15],
        lidR: /*   */[0.15, 0, 0, 0, 0, 0.15],
        squint: /* */[0, 0.05, 0.12, 0.1, 0.05, 0],
        // Opens on the call, then settles into a knowing smile.
        mouthC: /* */[0.3, 0.15, 0.25, 0.75, 0.6, 0.3],
        mouthO: /* */[0, 0.3, 0.35, 0.12, 0.04, 0],
        crest: /*  */[0, -10, -16, -13, -6, 0],
        gx: /*     */[0, 0.8, 0.95, 0.9, 0.5, 0],
        gy: /*     */[0, 0.15, 0.2, 0.18, 0.1, 0],
        gw: /*     */[0, 1, 1, 1, 0.6, 0],
    },

    /** Well done. A wink and a lopsided grin — the hands-free thumbs-up. */
    thumbsUp: {
        ms: 820,
        t: /*      */[0, 0.2, 0.45, 0.65, 0.85, 1],
        tip: /*    */[0, -4, -5, -3, -1, 0],
        bob: /*    */[0, 3, -2, 2, 0, 0],
        sq: /*     */[1, 0.98, 1.03, 0.99, 1, 1],
        lean: /*   */[0, 0, 0, 0, 0, 0],
        // Left brow presses down into the wink while the right one lifts.
        browL: /*  */[0, 3, 4, 3, 1, 0],
        browR: /*  */[-4, -7, -9, -7, -3, -4],
        tiltL: /*  */[0, 0, 0, 0, 0, 0],
        tiltR: /*  */[-3, -5, -6, -5, -2, -3],
        lidL: /*   */[0.15, 0.9, 1, 0.85, 0.2, 0.15],
        lidR: /*   */[0.15, 0, 0, 0, 0, 0.15],
        squint: /* */[0, 0.15, 0.2, 0.18, 0.08, 0],
        mouthC: /* */[0.3, 0.85, 1, 0.95, 0.6, 0.3],
        mouthO: /* */[0, 0.08, 0.14, 0.1, 0.03, 0],
        crest: /*  */[0, -12, -14, -9, -4, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0],
        gy: /*     */[0, 0, 0, 0, 0, 0],
        gw: /*     */[0, 0.8, 0.8, 0.8, 0.4, 0],
    },

    /** Two whole-body jumps, brows up, mouth wide, crest thrown about. */
    celebrate: {
        ms: 1250,
        t: /*      */[0, 0.12, 0.3, 0.45, 0.62, 0.8, 1],
        tip: /*    */[0, -6, 5, -5, 4, -2, 0],
        bob: /*    */[0, -14, 2, -12, 1, -3, 0],
        sq: /*     */[1, 1.08, 0.94, 1.07, 0.96, 1.02, 1],
        lean: /*   */[0, -3, 3, -3, 2, -1, 0],
        browL: /*  */[0, -11, -9, -11, -8, -4, 0],
        browR: /*  */[-4, -11, -9, -11, -8, -4, -4],
        tiltL: /*  */[0, -3, -2, -3, -2, -1, 0],
        tiltR: /*  */[-3, 3, 2, 3, 2, 1, -3],
        lidL: /*   */[0.15, 0, 0, 0, 0, 0, 0.15],
        lidR: /*   */[0.15, 0, 0, 0, 0, 0, 0.15],
        // Eyes go wide on the launch, then crease shut at the top of each hop.
        squint: /* */[0, 0.1, 0.5, 0.15, 0.55, 0.35, 0],
        mouthC: /* */[0.3, 1, 1, 1, 1, 0.7, 0.3],
        mouthO: /* */[0, 0.85, 0.6, 0.9, 0.55, 0.2, 0],
        crest: /*  */[0, -22, 20, -18, 14, -6, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0, 0],
        gy: /*     */[0, -0.3, 0.2, -0.25, 0.15, 0, 0],
        gw: /*     */[0, 0.7, 0.7, 0.7, 0.7, 0.3, 0],
    },

    /** Who knows. A held tip, both inner brows up, gaze sent up and away. */
    shrug: {
        ms: 900,
        t: /*      */[0, 0.22, 0.45, 0.7, 0.88, 1],
        tip: /*    */[0, -9, -12, -11, -5, 0],
        bob: /*    */[0, 3, 4, 4, 2, 0],
        sq: /*     */[1, 0.97, 0.96, 0.97, 0.99, 1],
        lean: /*   */[0, -3, -4, -4, -2, 0],
        browL: /*  */[0, -7, -9, -8, -4, 0],
        browR: /*  */[-4, -7, -9, -8, -4, -4],
        // Inner ends up: the difference between puzzled and annoyed.
        tiltL: /*  */[0, -9, -11, -10, -5, 0],
        tiltR: /*  */[-3, 9, 11, 10, 5, -3],
        // Half-lidded rather than creased — this is not a smile.
        lidL: /*   */[0.15, 0.28, 0.35, 0.32, 0.15, 0.15],
        lidR: /*   */[0.15, 0.28, 0.35, 0.32, 0.15, 0.15],
        squint: /* */[0, 0, 0, 0, 0, 0],
        mouthC: /* */[0.3, 0.05, 0, 0.05, 0.15, 0.3],
        mouthO: /* */[0, 0.06, 0.08, 0.07, 0.03, 0],
        crest: /*  */[0, 14, 19, 17, 8, 0],
        gx: /*     */[0, 0.45, 0.6, 0.55, 0.3, 0],
        gy: /*     */[0, -0.5, -0.65, -0.6, -0.3, 0],
        gw: /*     */[0, 1, 1, 1, 0.5, 0],
    },

    /** A long inhale, then a longer let-go. The only action that goes sad. */
    sigh: {
        ms: 1450,
        t: /*      */[0, 0.28, 0.42, 0.7, 0.88, 1],
        tip: /*    */[0, -2, -2, 3, 2, 0],
        // Rises on the inhale, drops below neutral on the exhale.
        bob: /*    */[0, -6, -7, 8, 4, 0],
        sq: /*     */[1, 1.05, 1.06, 0.94, 0.97, 1],
        lean: /*   */[0, 0, 0, 0, 0, 0],
        browL: /*  */[0, -5, -6, 5, 3, 0],
        browR: /*  */[-4, -5, -6, 5, 3, -4],
        tiltL: /*  */[0, -3, -4, -7, -4, 0],
        tiltR: /*  */[-3, 3, 4, 7, 4, -3],
        lidL: /*   */[0.15, 0.15, 0.1, 0.7, 0.45, 0.15],
        lidR: /*   */[0.15, 0.15, 0.1, 0.7, 0.45, 0.15],
        squint: /* */[0, 0, 0, 0, 0, 0],
        mouthC: /* */[0.3, 0.2, 0.15, -0.4, -0.2, 0.3],
        mouthO: /* */[0, 0.12, 0.18, 0.3, 0.1, 0],
        crest: /*  */[0, -6, -8, 16, 9, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0],
        gy: /*     */[0, -0.2, -0.25, 0.6, 0.35, 0],
        gw: /*     */[0, 0.6, 0.6, 1, 0.5, 0],
    },

    /** Gaze up and off to one side, brows at odds — then a small "aha" at the end. */
    think: {
        ms: 1650,
        t: /*      */[0, 0.15, 0.35, 0.62, 0.78, 0.9, 1],
        tip: /*    */[0, 6, 8, 8, 2, -4, 0],
        bob: /*    */[0, 2, 3, 3, 0, -5, 0],
        sq: /*     */[1, 0.99, 0.98, 0.98, 1, 1.05, 1],
        lean: /*   */[0, -2, -3, -3, -1, 2, 0],
        // One brow questioning, the other furrowed — until both shoot up on the aha.
        browL: /*  */[0, -8, -10, -10, -5, -12, 0],
        browR: /*  */[-4, 4, 6, 6, 2, -12, -4],
        tiltL: /*  */[0, -5, -7, -7, -3, -3, 0],
        tiltR: /*  */[-3, -3, -5, -5, -2, 4, -3],
        lidL: /*   */[0.15, 0.1, 0.15, 0.15, 0.08, 0, 0.15],
        lidR: /*   */[0.15, 0.3, 0.38, 0.38, 0.18, 0, 0.15],
        squint: /* */[0, 0.1, 0.15, 0.15, 0.08, 0.3, 0],
        mouthC: /* */[0.3, -0.1, -0.15, -0.15, 0.1, 0.85, 0.3],
        mouthO: /* */[0, 0.05, 0.08, 0.08, 0.05, 0.3, 0],
        crest: /*  */[0, 12, 16, 16, 6, -14, 0],
        gx: /*     */[0, -0.6, -0.8, -0.8, -0.4, 0, 0],
        gy: /*     */[0, -0.5, -0.7, -0.7, -0.35, -0.1, 0],
        gw: /*     */[0, 1, 1, 1, 0.7, 0.8, 0],
    },
};
