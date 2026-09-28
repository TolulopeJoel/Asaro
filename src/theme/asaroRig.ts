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
    | 'wave' | 'nod' | 'point' | 'thumbsUp' | 'celebrate' | 'shrug' | 'sigh' | 'think' | 'doze'
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
    /** Where on `t` it pauses. Omitted, its last strong pose. */
    beat?: number;

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
    /** How far the right corner rises past the rest: 1 the standing smirk. Optional; omitted means 1. */
    smirk?: number[];
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

    /** Strokes over a thinking cap (`ASARO_CAPS`); it drops in from `drop` above the head. */
    cap: {
        shadowOpacity: 0.45,
        /** A back layer's pleats: `ringW` creases, every other layer shaded by `bandOpacity`. */
        ringW: 2, ringOpacity: 0.8, bandOpacity: 0.35, ringSheenW: 2.4, ringSheenOpacity: 0.6,
        /** Each stripe is a bold `stripe` with a fine `pin` beside it, `pinDx` to the right. */
        stripeW: 5, pinW: 1.6, pinDx: 7, pinOpacity: 0.8,
        creaseW: 2.2, creaseOpacity: 0.8,
        sheenW: 4, sheenOpacity: 0.5,
        drop: 70,
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
        /**
         * Standing smirk: right corner `rise` higher, bow shifted `shift` toward
         * it. The `smirk` channel scales the raised side only, which also pulls
         * out by `pull` per unit past rest, so it grows lopsided, not tilted.
         */
        smirk: { rise: 3, shift: 1.5, pull: 2 },
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
    crest: string; rim: string; brow: string;
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
    /** Lashes at the outer eye corners — see `ASARO_RIG.lashes`. */
    lashes?: boolean;
    hair: HairShape;
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

/**
 * The thinking cap a look wears through the first run, drawn over the brows,
 * in the cloth the reader picks. See design/asaro-face.html#thinking-cap.
 */
export interface CapShape {
    name: string;
    d: string;
    /** Woven stripes, clipped to `d`. */
    stripes?: string[];
    /** A folded-over panel, drawn over the body with its own `flapStripes`. */
    flap?: string;
    flapStripes?: string[];
    /** Behind the head, between the hair and the ears. */
    back?: { d: string; rings: string[]; bands: string[]; sheen: string[] };
    /** Covers the hair, which fades out as it goes on. */
    hidesHair?: boolean;
    /** Shade the cloth casts on itself, in `dark`. */
    shadow?: string[];
    creases: string[];
    sheen: string[];
}

export interface CapCloth {
    id: string;
    label: string;
    fill: string; dark: string; light: string;
    /** Stripe colours; needed by a cap with `stripes`. */
    stripe?: string; pin?: string;
}

export const ASARO_CAPS: Record<AsaroLook, CapShape> = {
    male: {
        // Aso-oke cut on the bias: an upright band, its crown pushed down into a flap folded to his
        // left. Band stripes run one way and the flap's the other, meeting in a chevron at the fold.
        name: 'fila',
        d: 'M47 59 C44 46 43 28 45 16 C46 8 51 4 60 4 C80 3 100 4 114 7 C136 11 156 20 166 32 '
            + 'C171 38 170 45 164 47 L158 47 C156 51 155 55 153 59 Q100 65 47 59 Z',
        stripes: [
            'M-4 72 L32 -6',
            'M18 72 L54 -6',
            'M40 72 L76 -6',
            'M62 72 L98 -6',
            'M84 72 L120 -6',
            'M106 72 L142 -6',
            'M128 72 L164 -6',
            'M150 72 L186 -6',
            'M172 72 L208 -6',
        ],
        flap: 'M46 13 C76 22 120 36 158 47 L164 47 C170 45 171 38 166 32 C156 20 136 11 114 7 '
            + 'C100 4 80 3 60 4 C51 4 46 8 46 13 Z',
        flapStripes: [
            'M14 -6 L48 56',
            'M34 -6 L68 56',
            'M54 -6 L88 56',
            'M74 -6 L108 56',
            'M94 -6 L128 56',
            'M114 -6 L148 56',
            'M134 -6 L168 56',
            'M154 -6 L188 56',
            'M174 -6 L208 56',
        ],
        // Under the flap's edge, and the round of the band away from the light.
        shadow: [
            'M45 19 C76 29 120 43 156 54 L158 47 C120 36 76 22 46 13 Z',
            'M142 46 C150 48 155 49 158 47 C156 51 155 55 153 59 C149 60 145 61 140 61 Z',
        ],
        creases: [],
        sheen: ['M50 12 C62 7 82 6 100 7'],
    },
    female: {
        // A round gele: pleated layers stepping out from the brow into a halo that frames the face
        // to the jaw, its edge pinked.
        name: 'gele',
        hidesHair: true,
        back: {
            d: 'M40.9 174.9 L39.8 172.3 L37.1 171.7 L36.1 169.1 L33.4 168.4 L32.6 165.8 L29.9 164.9 L29.3 162.2 '
            + 'L26.6 161.3 L26.1 158.6 L23.5 157.4 L23.2 154.7 L20.6 153.5 L20.4 150.7 L18 149.3 L17.9 146.6 '
            + 'L15.5 145.1 L15.6 142.3 L13.3 140.7 L13.5 137.9 L11.3 136.2 L11.6 133.5 L9.5 131.6 L10 128.9 L8 '
            + '127 L8.6 124.3 L6.7 122.2 L7.4 119.6 L5.6 117.4 L6.5 114.8 L4.8 112.6 L5.9 110 L4.3 107.7 L5.5 '
            + '105.2 L4 102.8 L5.3 100.4 L4 97.9 L5.5 95.5 L4.3 93 L5.8 90.7 L4.8 88.1 L6.4 85.9 L5.5 83.3 L7.3 '
            + '81.2 L6.5 78.5 L8.4 76.4 L7.7 73.7 L9.7 71.8 L9.2 69.1 L11.3 67.2 L11 64.5 L13.2 62.7 L12.9 60 '
            + 'L15.2 58.4 L15.1 55.6 L17.5 54.1 L17.6 51.3 L20 49.9 L20.2 47.2 L22.7 45.9 L23.1 43.2 L25.6 42 '
            + 'L26.1 39.3 L28.8 38.3 L29.4 35.6 L32.1 34.8 L32.9 32.1 L35.6 31.4 L36.5 28.8 L39.2 28.2 L40.3 '
            + '25.6 L43.1 25.2 L44.3 22.7 L47 22.4 L48.4 19.9 L51.2 19.8 L52.6 17.4 L55.4 17.4 L57 15.1 L59.8 '
            + '15.2 L61.5 13 L64.3 13.3 L66.1 11.1 L68.8 11.6 L70.7 9.5 L73.5 10.1 L75.5 8.1 L78.2 8.8 L80.3 7 '
            + 'L83 7.9 L85.2 6.1 L87.8 7.1 L90.1 5.5 L92.7 6.6 L95 5.1 L97.6 6.4 L100 5 L102.5 6.4 L105.1 5.1 '
            + 'L107.5 6.6 L110.2 5.5 L112.5 7.1 L115.3 6.1 L117.5 7.9 L120.3 7 L122.4 8.8 L125.2 8.1 L127.3 '
            + '10.1 L130.1 9.5 L132.1 11.6 L135 11.1 L136.8 13.3 L139.7 13 L141.4 15.2 L144.3 15.1 L145.9 17.4 '
            + 'L148.8 17.4 L150.3 19.8 L153.2 19.9 L154.5 22.4 L157.4 22.7 L158.6 25.2 L161.5 25.6 L162.6 28.2 '
            + 'L165.4 28.8 L166.4 31.4 L169.2 32.1 L170 34.8 L172.7 35.6 L173.4 38.3 L176.1 39.3 L176.6 42 '
            + 'L179.2 43.2 L179.6 45.9 L182.2 47.2 L182.4 49.9 L184.9 51.3 L185 54.1 L187.4 55.6 L187.3 58.4 '
            + 'L189.7 60 L189.5 62.7 L191.7 64.5 L191.3 67.2 L193.5 69.1 L193 71.8 L195 73.7 L194.4 76.4 L196.3 '
            + '78.5 L195.5 81.2 L197.3 83.3 L196.4 85.9 L198.1 88.1 L197 90.7 L198.6 93 L197.4 95.5 L198.9 97.9 '
            + 'L197.5 100.4 L198.8 102.8 L197.3 105.2 L198.6 107.7 L196.9 110 L198 112.6 L196.3 114.8 L197.2 '
            + '117.4 L195.3 119.6 L196.1 122.2 L194.2 124.3 L194.8 127 L192.7 128.9 L193.2 131.6 L191.1 133.5 '
            + 'L191.4 136.2 L189.1 137.9 L189.3 140.7 L187 142.3 L187 145.1 L184.6 146.6 L184.5 149.3 L182 '
            + '150.7 L181.7 153.5 L179.1 154.7 L178.8 157.4 L176.1 158.6 L175.6 161.3 L172.9 162.2 L172.2 164.9 '
            + 'L169.4 165.8 L168.6 168.4 L165.8 169.1 L164.8 171.7 L162 172.3 L160.9 174.9 Q100 150 40.9 174.9 '
            + 'Z',
            rings: [
                'M52.7 152.8 C50.8 151.2 44.7 146.7 41.3 143.2 C37.9 139.7 34.9 135.8 32.4 131.8 C29.9 127.8 27.9 '
                    + '123.4 26.4 119 C24.9 114.6 23.9 110 23.5 105.5 C23 100.9 23.1 96.2 23.8 91.6 C24.5 87.1 25.7 '
                    + '82.5 27.4 78.2 C29.1 73.9 31.4 69.6 34.1 65.7 C36.7 61.7 40 58 43.5 54.6 C47.1 51.2 51.1 48.1 '
                    + '55.4 45.5 C59.7 42.8 64.4 40.5 69.2 38.6 C74 36.8 79.1 35.4 84.3 34.4 C89.4 33.5 94.7 33 100 33 '
                    + 'C105.3 33 110.9 33.5 116.2 34.4 C121.5 35.4 126.8 36.8 131.8 38.6 C136.7 40.5 141.5 42.8 145.9 '
                    + '45.5 C150.3 48.1 154.5 51.2 158.2 54.6 C161.8 58 165.2 61.7 167.9 65.7 C170.7 69.6 173 73.9 '
                    + '174.8 78.2 C176.6 82.5 177.8 87.1 178.5 91.6 C179.2 96.2 179.3 100.9 178.8 105.5 C178.4 110 '
                    + '177.4 114.6 175.8 119 C174.3 123.4 172.2 127.8 169.6 131.8 C167.1 135.8 163.9 139.7 160.4 143.2 '
                    + 'C157 146.7 150.7 151.2 148.7 152.8',
                'M49.8 158.3 C47.7 156.5 41.2 151.6 37.6 147.7 C34 143.9 30.8 139.6 28.2 135.1 C25.5 130.7 23.3 '
                    + '125.9 21.8 121 C20.2 116.2 19.1 111.1 18.7 106 C18.2 101 18.3 95.8 19 90.8 C19.7 85.7 21 80.7 '
                    + '22.8 75.9 C24.7 71.1 27.1 66.4 29.9 62.1 C32.8 57.7 36.2 53.6 40 49.8 C43.8 46.1 48.1 42.7 52.6 '
                    + '39.8 C57.2 36.8 62.1 34.3 67.2 32.2 C72.4 30.2 77.8 28.6 83.3 27.6 C88.7 26.5 94.3 26 100 26 '
                    + 'C105.7 26 111.6 26.5 117.2 27.6 C122.9 28.6 128.5 30.2 133.7 32.2 C139 34.3 144.1 36.8 148.8 '
                    + '39.8 C153.5 42.7 157.9 46.1 161.8 49.8 C165.7 53.6 169.2 57.7 172.2 62.1 C175.1 66.4 177.6 71.1 '
                    + '179.5 75.9 C181.3 80.7 182.7 85.7 183.4 90.8 C184.1 95.8 184.2 101 183.8 106 C183.3 111.1 182.2 '
                    + '116.2 180.6 121 C179 125.9 176.7 130.7 174 135.1 C171.3 139.6 167.9 143.9 164.2 147.7 C160.5 '
                    + '151.6 153.8 156.5 151.7 158.3',
                'M46.8 163.8 C44.7 161.9 37.8 156.5 34 152.2 C30.2 148 26.8 143.3 24 138.4 C21.1 133.6 18.8 128.3 '
                    + '17.2 123 C15.5 117.7 14.4 112.1 13.9 106.6 C13.4 101.1 13.5 95.4 14.3 89.9 C15 84.4 16.4 78.9 '
                    + '18.3 73.6 C20.2 68.4 22.8 63.2 25.8 58.5 C28.8 53.7 32.5 49.2 36.5 45.1 C40.5 41 45 37.3 49.8 '
                    + '34.1 C54.6 30.8 59.9 28 65.3 25.8 C70.7 23.6 76.5 21.9 82.3 20.7 C88.1 19.6 94 19 100 19 C106 19 '
                    + '112.3 19.6 118.2 20.7 C124.2 21.9 130.2 23.6 135.7 25.8 C141.3 28 146.7 30.8 151.7 34.1 C156.6 '
                    + '37.3 161.3 41 165.4 45.1 C169.6 49.2 173.3 53.7 176.4 58.5 C179.5 63.2 182.2 68.4 184.1 73.6 '
                    + 'C186.1 78.9 187.5 84.4 188.3 89.9 C189.1 95.4 189.2 101.1 188.7 106.6 C188.2 112.1 187.1 117.7 '
                    + '185.3 123 C183.6 128.3 181.2 133.6 178.3 138.4 C175.4 143.3 171.9 148 168 152.2 C164.1 156.5 157 '
                    + '161.9 154.8 163.8',
                'M43.9 169.3 C41.6 167.2 34.3 161.4 30.3 156.8 C26.3 152.2 22.7 147.1 19.7 141.8 C16.8 136.5 14.3 '
                    + '130.8 12.6 125 C10.8 119.2 9.6 113.2 9.1 107.2 C8.6 101.2 8.7 95 9.5 89 C10.3 83.1 11.7 77 13.8 '
                    + '71.4 C15.8 65.7 18.5 60.1 21.7 54.9 C24.9 49.7 28.7 44.8 32.9 40.4 C37.2 35.9 42 31.9 47 28.4 '
                    + 'C52.1 24.9 57.7 21.8 63.4 19.4 C69.1 17 75.2 15.1 81.3 13.9 C87.4 12.6 93.7 12 100 12 C106.3 12 '
                    + '113 12.6 119.3 13.9 C125.5 15.1 131.8 17 137.7 19.4 C143.6 21.8 149.3 24.9 154.5 28.4 C159.8 '
                    + '31.9 164.7 35.9 169.1 40.4 C173.4 44.8 177.4 49.7 180.7 54.9 C184 60.1 186.7 65.7 188.8 71.4 '
                    + 'C190.9 77 192.4 83.1 193.2 89 C194 95 194.1 101.2 193.6 107.2 C193.1 113.2 191.9 119.2 190.1 125 '
                    + 'C188.2 130.8 185.7 136.5 182.7 141.8 C179.6 147.1 175.9 152.2 171.8 156.8 C167.6 161.4 160.2 '
                    + '167.2 157.8 169.3',
            ],
            bands: [
                'M53 152.5 C51.1 150.9 45 146.5 41.6 143 C38.2 139.5 35.2 135.7 32.7 131.6 C30.3 127.6 28.2 123.3 '
                    + '26.7 118.9 C25.2 114.6 24.3 110 23.8 105.4 C23.4 100.9 23.5 96.2 24.2 91.7 C24.8 87.2 26 82.6 '
                    + '27.7 78.3 C29.4 74 31.7 69.7 34.4 65.8 C37.1 61.9 40.3 58.2 43.8 54.8 C47.4 51.5 51.4 48.4 55.6 '
                    + '45.7 C59.9 43.1 64.5 40.8 69.3 38.9 C74.1 37.1 79.2 35.7 84.3 34.8 C89.4 33.8 94.7 33.3 100 33.3 '
                    + 'C105.3 33.3 110.9 33.8 116.1 34.8 C121.4 35.7 126.7 37.1 131.6 38.9 C136.5 40.8 141.3 43.1 145.7 '
                    + '45.7 C150.1 48.4 154.2 51.5 157.9 54.8 C161.5 58.2 164.8 61.9 167.6 65.8 C170.3 69.7 172.7 74 '
                    + '174.4 78.3 C176.2 82.6 177.4 87.2 178.1 91.7 C178.8 96.2 178.9 100.9 178.4 105.4 C178 110 177 '
                    + '114.6 175.5 118.9 C173.9 123.3 171.8 127.6 169.3 131.6 C166.7 135.7 163.6 139.5 160.1 143 C156.7 '
                    + '146.5 150.4 150.9 148.5 152.5 L145.7 147.3 C147.5 145.9 153.4 141.8 156.7 138.7 C159.9 135.6 '
                    + '162.9 132.1 165.3 128.5 C167.7 124.9 169.7 121 171.1 117 C172.5 113.1 173.5 109 173.9 104.9 '
                    + 'C174.3 100.8 174.2 96.6 173.6 92.5 C172.9 88.4 171.8 84.3 170.1 80.5 C168.5 76.6 166.3 72.8 '
                    + '163.7 69.2 C161.1 65.7 158 62.4 154.5 59.3 C151.1 56.3 147.2 53.5 143.1 51.2 C138.9 48.8 134.4 '
                    + '46.7 129.8 45 C125.1 43.4 120.2 42.1 115.2 41.3 C110.2 40.4 105 40 100 40 C95 40 90.1 40.4 85.2 '
                    + '41.3 C80.4 42.1 75.6 43.4 71.1 45 C66.6 46.7 62.2 48.8 58.2 51.2 C54.2 53.5 50.4 56.3 47.1 59.3 '
                    + 'C43.7 62.4 40.7 65.7 38.2 69.2 C35.7 72.8 33.5 76.6 31.9 80.5 C30.3 84.3 29.2 88.4 28.6 92.5 '
                    + 'C27.9 96.6 27.8 100.8 28.2 104.9 C28.6 109 29.6 113.1 31 117 C32.4 121 34.3 124.9 36.6 128.5 C39 '
                    + '132.1 41.8 135.6 45 138.7 C48.2 141.8 53.9 145.9 55.7 147.3 Z',
                'M47.1 163.5 C44.9 161.6 38.1 156.2 34.3 152 C30.5 147.8 27.1 143.1 24.3 138.3 C21.5 133.4 19.2 '
                    + '128.2 17.6 122.9 C15.9 117.6 14.8 112 14.3 106.6 C13.8 101.1 14 95.4 14.7 89.9 C15.4 84.5 16.8 '
                    + '79 18.7 73.8 C20.6 68.6 23.2 63.4 26.2 58.7 C29.2 54 32.8 49.4 36.8 45.4 C40.8 41.3 45.3 37.6 '
                    + '50.1 34.4 C54.9 31.2 60.1 28.4 65.5 26.2 C70.9 24 76.6 22.2 82.4 21.1 C88.1 20 94 19.4 100 19.4 '
                    + 'C106 19.4 112.2 20 118.2 21.1 C124.1 22.2 130 24 135.5 26.2 C141.1 28.4 146.5 31.2 151.4 34.4 '
                    + 'C156.3 37.6 161 41.3 165.1 45.4 C169.2 49.4 172.9 54 176 58.7 C179.1 63.4 181.8 68.6 183.7 73.8 '
                    + 'C185.7 79 187.1 84.5 187.9 89.9 C188.6 95.4 188.7 101.1 188.3 106.6 C187.8 112 186.6 117.6 184.9 '
                    + '122.9 C183.2 128.2 180.8 133.4 177.9 138.3 C175.1 143.1 171.6 147.8 167.7 152 C163.8 156.2 156.7 '
                    + '161.6 154.5 163.5 L151.7 158.3 C153.8 156.5 160.5 151.6 164.2 147.7 C167.9 143.9 171.3 139.6 174 '
                    + '135.1 C176.7 130.7 179 125.9 180.6 121 C182.2 116.2 183.3 111.1 183.8 106 C184.2 101 184.1 95.8 '
                    + '183.4 90.8 C182.7 85.7 181.3 80.7 179.5 75.9 C177.6 71.1 175.1 66.4 172.2 62.1 C169.2 57.7 165.7 '
                    + '53.6 161.8 49.8 C157.9 46.1 153.5 42.7 148.8 39.8 C144.1 36.8 139 34.3 133.7 32.2 C128.5 30.2 '
                    + '122.9 28.6 117.2 27.6 C111.6 26.5 105.7 26 100 26 C94.3 26 88.7 26.5 83.3 27.6 C77.8 28.6 72.4 '
                    + '30.2 67.2 32.2 C62.1 34.3 57.2 36.8 52.6 39.8 C48.1 42.7 43.8 46.1 40 49.8 C36.2 53.6 32.8 57.7 '
                    + '29.9 62.1 C27.1 66.4 24.7 71.1 22.8 75.9 C21 80.7 19.7 85.7 19 90.8 C18.3 95.8 18.2 101 18.7 106 '
                    + 'C19.1 111.1 20.2 116.2 21.8 121 C23.3 125.9 25.5 130.7 28.2 135.1 C30.8 139.6 34 143.9 37.6 '
                    + '147.7 C41.2 151.6 47.7 156.5 49.8 158.3 Z',
                'M41.2 174.5 C38.8 172.2 31.2 165.9 27 161 C22.8 156 19 150.5 15.9 144.9 C12.8 139.2 10.3 133 8.4 '
                    + '126.8 C6.6 120.7 5.3 114.1 4.8 107.7 C4.3 101.3 4.4 94.6 5.2 88.2 C6 81.8 7.6 75.3 9.7 69.2 '
                    + 'C11.8 63.1 14.6 57.1 18 51.6 C21.3 46 25.3 40.7 29.8 35.9 C34.2 31.2 39.2 26.8 44.5 23 C49.8 '
                    + '19.3 55.7 16 61.7 13.4 C67.6 10.8 74 8.8 80.4 7.5 C86.8 6.2 93.4 5.5 100 5.5 C106.6 5.5 113.6 '
                    + '6.2 120.2 7.5 C126.8 8.8 133.3 10.8 139.5 13.4 C145.7 16 151.7 19.3 157.1 23 C162.6 26.8 167.8 '
                    + '31.2 172.3 35.9 C176.9 40.7 181 46 184.5 51.6 C187.9 57.1 190.8 63.1 193 69.2 C195.2 75.3 196.8 '
                    + '81.8 197.6 88.2 C198.5 94.6 198.6 101.3 198.1 107.7 C197.5 114.1 196.2 120.7 194.3 126.8 C192.4 '
                    + '133 189.8 139.2 186.6 144.9 C183.4 150.5 179.5 156 175.2 161 C170.8 165.9 163 172.2 160.6 174.5 '
                    + 'L157.8 169.3 C160.2 167.2 167.6 161.4 171.8 156.8 C175.9 152.2 179.6 147.1 182.7 141.8 C185.7 '
                    + '136.5 188.2 130.8 190.1 125 C191.9 119.2 193.1 113.2 193.6 107.2 C194.1 101.2 194 95 193.2 89 '
                    + 'C192.4 83.1 190.9 77 188.8 71.4 C186.7 65.7 184 60.1 180.7 54.9 C177.4 49.7 173.4 44.8 169.1 '
                    + '40.4 C164.7 35.9 159.8 31.9 154.5 28.4 C149.3 24.9 143.6 21.8 137.7 19.4 C131.8 17 125.5 15.1 '
                    + '119.3 13.9 C113 12.6 106.3 12 100 12 C93.7 12 87.4 12.6 81.3 13.9 C75.2 15.1 69.1 17 63.4 19.4 '
                    + 'C57.7 21.8 52.1 24.9 47 28.4 C42 31.9 37.2 35.9 32.9 40.4 C28.7 44.8 24.9 49.7 21.7 54.9 C18.5 '
                    + '60.1 15.8 65.7 13.8 71.4 C11.7 77 10.3 83.1 9.5 89 C8.7 95 8.6 101.2 9.1 107.2 C9.6 113.2 10.8 '
                    + '119.2 12.6 125 C14.3 130.8 16.8 136.5 19.7 141.8 C22.7 147.1 26.3 152.2 30.3 156.8 C34.3 161.4 '
                    + '41.6 167.2 43.9 169.3 Z',
            ],
            sheen: [
                'M30.2 77.9 C31.1 76.2 33.5 71 35.7 67.8 C37.8 64.5 40.3 61.4 43.1 58.5 C45.8 55.7 48.9 53 52.2 '
                    + '50.6 C55.5 48.2 59.1 46 62.9 44.1 C66.6 42.3 70.5 40.7 74.6 39.4 C78.6 38.1 82.9 37.1 87.1 36.5 '
                    + 'C91.3 35.8 95.6 35.5 100 35.5 C104.4 35.5 108.9 35.8 113.3 36.5 C117.7 37.1 122 38.1 126.2 39.4 '
                    + 'C130.3 40.7 136.2 43.3 138.3 44.1',
                'M25.7 75.5 C26.6 73.7 29.2 67.8 31.5 64.2 C33.8 60.7 36.5 57.2 39.4 54 C42.3 50.9 45.6 47.9 49.2 '
                    + '45.2 C52.7 42.6 56.5 40.1 60.5 38.1 C64.4 36 68.6 34.2 72.9 32.8 C77.2 31.4 81.8 30.3 86.3 29.6 '
                    + 'C90.8 28.9 95.4 28.5 100 28.5 C104.6 28.5 109.5 28.9 114.1 29.6 C118.8 30.3 123.4 31.4 127.9 '
                    + '32.8 C132.3 34.2 138.6 37.2 140.7 38.1',
                'M21.2 73.2 C22.2 71.1 24.9 64.7 27.3 60.7 C29.8 56.8 32.6 53 35.7 49.5 C38.9 46.1 42.3 42.8 46.1 '
                    + '39.9 C49.8 36.9 53.8 34.3 58.1 32 C62.3 29.7 66.7 27.8 71.3 26.2 C75.9 24.7 80.6 23.5 85.4 22.7 '
                    + 'C90.2 21.9 95.1 21.5 100 21.5 C104.9 21.5 110.1 21.9 115 22.7 C119.9 23.5 124.9 24.7 129.6 26.2 '
                    + 'C134.3 27.8 140.9 31.1 143.2 32',
                'M16.6 70.8 C17.7 68.5 20.6 61.5 23.2 57.2 C25.8 53 28.8 48.8 32.1 45 C35.4 41.3 39.1 37.7 43 '
                    + '34.5 C46.9 31.3 51.2 28.4 55.7 26 C60.1 23.5 64.8 21.3 69.7 19.7 C74.5 18 79.5 16.7 84.6 15.8 '
                    + 'C89.7 14.9 94.8 14.5 100 14.5 C105.2 14.5 110.7 14.9 115.9 15.8 C121.1 16.7 126.3 18 131.2 19.7 '
                    + 'C136.2 21.3 143.3 24.9 145.7 26',
            ],
        },
        // The innermost layer, over the brow from temple to temple.
        d: 'M30.1 114.5 C29.8 112.7 28.4 107.4 28.1 103.8 C27.9 100.2 28 96.5 28.5 92.9 C29 89.3 29.9 85.7 '
        + '31.2 82.3 C32.5 78.8 34.2 75.4 36.2 72.2 C38.2 69 40.6 65.9 43.3 63.1 C45.9 60.2 49 57.5 52.2 '
        + '55.1 C55.4 52.7 59 50.5 62.7 48.7 C66.4 46.8 70.4 45.2 74.4 43.9 C78.5 42.6 82.7 41.6 87 41 '
        + 'C91.3 40.3 95.6 40 100 40 C104.4 40 109 40.3 113.4 41 C117.8 41.6 122.2 42.6 126.3 43.9 C130.5 '
        + '45.2 134.6 46.8 138.4 48.7 C142.2 50.5 145.9 52.7 149.2 55.1 C152.6 57.5 155.7 60.2 158.4 63.1 '
        + 'C161.2 65.9 163.7 69 165.7 72.2 C167.8 75.4 169.5 78.8 170.8 82.3 C172.2 85.7 173.1 89.3 173.6 '
        + '92.9 C174.2 96.5 174.3 100.2 174 103.8 C173.7 107.4 172.3 112.7 172 114.5 L162.1 115.1 C162.4 '
        + '113.8 163.6 109.7 163.9 106.9 C164.1 104.1 164 101.3 163.5 98.6 C163.1 95.8 162.3 93 161.1 90.4 '
        + 'C160 87.8 158.5 85.1 156.7 82.7 C154.9 80.2 152.8 77.9 150.4 75.7 C148.1 73.5 145.4 71.4 142.5 '
        + '69.6 C139.6 67.8 136.4 66.1 133.2 64.7 C129.9 63.2 126.3 62 122.7 61 C119.1 60 115.3 59.3 111.6 '
        + '58.8 C107.8 58.3 103.9 58 100 58 C96.1 58 92.2 58.3 88.4 58.8 C84.7 59.3 80.9 60 77.3 61 C73.7 '
        + '62 70.1 63.2 66.8 64.7 C63.6 66.1 60.4 67.8 57.5 69.6 C54.6 71.4 51.9 73.5 49.6 75.7 C47.2 77.9 '
        + '45.1 80.2 43.3 82.7 C41.5 85.1 40 87.8 38.9 90.4 C37.7 93 36.9 95.8 36.5 98.6 C36 101.3 35.9 '
        + '104.1 36.1 106.9 C36.4 109.7 37.6 113.8 37.9 115.1 Z',
        creases: [
            'M34.2 106.1 C34.2 104.3 34 99.1 34.6 95.6 C35.2 92.2 36.3 88.7 37.8 85.5 C39.3 82.2 41.3 79 43.6 '
                + '76 C45.9 73.1 48.7 70.2 51.7 67.7 C54.8 65.2 58.2 62.8 61.9 60.9 C65.6 58.9 69.6 57.1 73.7 55.7 '
                + 'C77.8 54.3 82.2 53.3 86.6 52.6 C90.9 51.9 95.5 51.5 100 51.5 C104.5 51.5 109.1 51.9 113.4 52.6 '
                + 'C117.8 53.3 122.2 54.3 126.3 55.7 C130.4 57.1 134.4 58.9 138.1 60.9 C141.8 62.8 145.2 65.2 148.3 '
                + '67.7 C151.3 70.2 154.1 73.1 156.4 76 C158.7 79 160.7 82.2 162.2 85.5 C163.7 88.7 164.8 92.2 '
                + '165.4 95.6 C166 99.1 165.8 104.3 165.8 106.1',
            'M31.2 104.9 C31.2 103 31 97.2 31.6 93.5 C32.3 89.8 33.4 86 35 82.5 C36.5 78.9 38.6 75.4 41 72.2 '
                + 'C43.4 69 46.3 65.9 49.5 63.1 C52.7 60.4 56.4 57.9 60.2 55.7 C64 53.5 68.2 51.6 72.5 50.1 C76.8 '
                + '48.6 81.4 47.4 85.9 46.7 C90.5 45.9 95.3 45.5 100 45.5 C104.7 45.5 109.5 45.9 114.1 46.7 C118.6 '
                + '47.4 123.2 48.6 127.5 50.1 C131.8 51.6 136 53.5 139.8 55.7 C143.6 57.9 147.3 60.4 150.5 63.1 '
                + 'C153.7 65.9 156.6 69 159 72.2 C161.4 75.4 163.5 78.9 165 82.5 C166.6 86 167.7 89.8 168.4 93.5 '
                + 'C169 97.2 168.8 103 168.8 104.9',
        ],
        sheen: [
            'M39.7 81.2 C40.9 79.8 44.1 75.3 46.8 72.7 C49.5 70.1 52.7 67.6 56.2 65.4 C59.6 63.2 63.4 61.3 '
                + '67.4 59.7 C71.4 58.1 75.7 56.7 80 55.7 C84.4 54.7 88.9 54.1 93.5 53.7 C98 53.4 102.7 53.4 107.2 '
                + '53.8 C111.8 54.1 116.4 54.9 120.7 55.9 C125 56.9 131.2 59.3 133.2 59.9',
        ],
    },
};

/** The cloths a reader chooses between, after aso-oke they'd see worn. Muted; never violet. */
export const ASARO_CAP_CLOTHS: Record<AsaroLook, CapCloth[]> = {
    male: [
        { id: 'navy', label: 'Navy', fill: '#34466a', dark: '#222f4a', light: '#8193b5', stripe: '#b14c4f', pin: '#d9cfc0' },
        { id: 'stone', label: 'Stone', fill: '#b8ab95', dark: '#857a68', light: '#e2d9c8', stripe: '#4a453e', pin: '#f1ebe0' },
        { id: 'coal', label: 'Charcoal', fill: '#3c3e44', dark: '#26282c', light: '#7d8088', stripe: '#d6d2ca', pin: '#8f9299' },
    ],
    female: [
        { id: 'gold', label: 'Gold', fill: '#d1a65c', dark: '#a07b3b', light: '#ecd29d' },
        { id: 'teal', label: 'Teal', fill: '#4a817c', dark: '#325f5b', light: '#84b3ad' },
        { id: 'night', label: 'Night', fill: '#3a3c44', dark: '#1f2126', light: '#c3c6cf' },
    ],
};

/** A look's cloth by id; an id from the other look's set falls back to its first. */
export function capCloth(look: AsaroLook, id: string | null): CapCloth {
    const set = ASARO_CAP_CLOTHS[look] ?? ASARO_CAP_CLOTHS.male;
    return set.find((c) => c.id === id) ?? set[0];
}

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
        // Barely more smile: the smirk is one corner, not both.
        mouthC: /* */[0.3, 0.32, 0.34, 0.34, 0.32, 0.3],
        mouthO: /* */[0, 0, 0, 0, 0, 0],
        // Held closed.
        press: /*  */[1, 0.85, 0.7, 0.7, 0.85, 1],
        smirk: /*  */[1, 1.8, 2.6, 2.6, 1.6, 1],
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

    /** 😂 The threat was a joke, at your expense: aimed at the reader, three snickers, then the smirk. */
    laugh: {
        ms: 1400,
        // The pause belongs on the smirk, not mid-snicker.
        beat: 0.8,
        t: /*      */[0, 0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.8, 1],
        // A cocky tilt, held.
        tip: /*    */[0, 4, 5, 4, 5, 4, 5, 4, 0],
        // Chin up, with a small kick on each snicker.
        bob: /*    */[0, -4, -6, -4, -6, -4, -5, -3, 0],
        sq: /*     */[1, 1.02, 0.98, 1.02, 0.98, 1.02, 0.99, 1.01, 1],
        // Toward the reader: he is laughing at you, not near you.
        lean: /*   */[0, 3, 4, 3, 4, 3, 4, 2, 0],
        // One brow pressed, one up. Both up is delight; this is mischief.
        browL: /*  */[0, 2, 3, 2, 3, 2, 3, 2, 0],
        browR: /*  */[-4, -8, -10, -9, -10, -9, -10, -9, -4],
        tiltL: /*  */[0, 2, 3, 2, 3, 2, 3, 2, 0],
        tiltR: /*  */[-3, -5, -6, -5, -6, -5, -6, -5, -3],
        // Narrowed, not crescents; the pressed side narrower.
        lidL: /*   */[0.15, 0.4, 0.45, 0.4, 0.45, 0.4, 0.45, 0.42, 0.15],
        lidR: /*   */[0.15, 0.3, 0.35, 0.3, 0.35, 0.3, 0.35, 0.32, 0.15],
        squint: /* */[0, 0.3, 0.38, 0.32, 0.38, 0.32, 0.38, 0.3, 0],
        mouthC: /* */[0.3, 0.7, 0.75, 0.72, 0.75, 0.72, 0.75, 0.4, 0.3],
        // Short bursts with a tight grin between them.
        mouthO: /* */[0, 0.12, 0.45, 0.12, 0.45, 0.12, 0.38, 0, 0],
        // The smirk closes the mouth.
        press: /*  */[1, 1, 1, 1, 1, 1, 1, 0.8, 1],
        // Lopsided throughout; strongest once the mouth shuts.
        smirk: /*  */[1, 1.8, 2, 2, 2, 2, 2, 3, 1],
        crest: /*  */[0, 4, 7, 5, 7, 5, 6, 4, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0, 0, 0, 0],
        // Down the nose, while the chin is up.
        gy: /*     */[0, 0.12, 0.16, 0.14, 0.16, 0.14, 0.16, 0.14, 0],
        // Locked on the reader.
        gw: /*     */[0, 0.9, 1, 1, 1, 1, 1, 0.9, 0],
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
        // A touch less smile than before, so the lopsidedness reads.
        mouthC: /* */[0.3, 0.75, 0.88, 0.82, 0.55, 0.3],
        mouthO: /* */[0, 0.08, 0.14, 0.1, 0.03, 0],
        smirk: /*  */[1, 1.6, 2.2, 2, 1.3, 1],
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
    /** Nodding off: lids droop and the head sinks, then he jerks awake. Looped on the battery ask. */
    doze: {
        ms: 2600,
        t: /*      */[0, 0.25, 0.5, 0.7, 0.78, 0.86, 1],
        // Pauses on the jerk awake, the "huh?", not on the droop.
        beat: 0.78,
        tip: /*    */[0, 3, 6, 9, -3, -2, 0],
        bob: /*    */[0, 3, 6, 9, -6, -3, 0],
        sq: /*     */[1, 1, 0.99, 0.97, 1.05, 1.02, 1],
        lean: /*   */[0, 0, 0, 0, 0, 0, 0],
        browL: /*  */[0, 1, 2, 3, -7, -4, 0],
        browR: /*  */[-4, -2, 0, 1, -9, -6, -4],
        tiltL: /*  */[0, 0, 0, 0, -3, -2, 0],
        tiltR: /*  */[-3, -2, -1, 0, 3, 2, -3],
        lidL: /*   */[0.15, 0.45, 0.72, 0.9, 0, 0.05, 0.15],
        lidR: /*   */[0.15, 0.45, 0.72, 0.9, 0, 0.05, 0.15],
        squint: /* */[0, 0, 0, 0, 0, 0, 0],
        mouthC: /* */[0.3, 0.15, 0.05, 0, -0.1, 0.1, 0.3],
        mouthO: /* */[0, 0.05, 0.12, 0.2, 0.25, 0.1, 0],
        crest: /*  */[0, 3, 6, 9, -10, -5, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0, 0],
        gy: /*     */[0, 0.3, 0.5, 0.6, -0.1, 0, 0],
        gw: /*     */[0, 0.5, 0.8, 0.9, 1, 0.6, 0],
    },
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
