/**
 * Àṣàrò's rig, as data.
 *
 * The character is a face with a single tapered crest off the crown. The crest
 * carries more than it looks: four of the named actions (`wave`, `point`,
 * `thumbsUp`, `shrug`) are hand gestures on a normal character, and with no
 * hands they must be performed by brow, lid, pupil, mouth, cheek, head and
 * crest alone. The crest is what stops them reading as the same small nod.
 *
 * ACCESSIBILITY: the fill (#c97355) is 2.80:1 on Cloth's #efe6d8 ground and
 * does not need to clear 3:1. WCAG 1.4.11 asks a graphical object for a 3:1
 * *boundary*, and the 3px rim is that boundary at 6.99:1. This is why the rim
 * is its own token — requiring the fill itself to clear 3:1 confines the
 * character to a narrow mid-dark band where everything is muddy.
 *
 * Keyframes are flattened into parallel numeric arrays because the animation
 * runs in Reanimated worklets, which want arrays of numbers rather than a tree
 * of objects. Two invariants the component relies on:
 *
 *   1. every channel array is exactly as long as its action's `t`, so a
 *      channel can be sampled without a per-frame bounds check;
 *   2. every channel starts and ends at its `ASARO_REST` value, so an action
 *      can be interrupted, replayed or cut short without the face snapping.
 *
 * design/asaro-face.html inlines these same numbers and must be kept in step —
 * it is the prototype the character is judged in.
 */

export type AsaroAction =
    | 'wave' | 'nod' | 'point' | 'thumbsUp' | 'celebrate' | 'shrug' | 'sigh' | 'think'
    /*
     * Expressions rather than gestures. The eight above are things he DOES; his
     * personality on the page is carried by how he LOOKS, and the character doc
     * defines him through five permitted emoji, every one a face. These are
     * keyframes only — per-eye lids, squint and gaze weight already exist.
     */
    | 'deadpan' | 'sideEye' | 'smug' | 'sheepish';

/**
 * Which character is on screen.
 *
 * This used to name the THEME a look belonged to, back when there were two
 * styles; with Colossal gone it had one value and no job. It now names the
 * character variant the reader has chosen, which is what the reader actually
 * cares about.
 *
 * `pink` is a working name for the visible difference, not a character name —
 * whether she is Àṣàrò with different hair or somebody with her own name is a
 * decision about the product, not the rig.
 */
export type AsaroLook = 'cloth' | 'pink';

/**
 * One action's keyframes.
 *
 * `t` is normalised 0…1 and shared by every channel. Angles are degrees,
 * offsets are viewBox units, and the 0…1 channels are fractions of a travel
 * distance that lives in `ASARO_RIG` rather than here — so retuning how far
 * a lid closes does not mean rewriting eight tables.
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
    /**
     * Lip press: 1 the normal lens, below 1 a thinner line, 0 a hairline.
     *
     * Optional, because eleven of the twelve actions have no use for it — a
     * table that omits it presses not at all.
     *
     * It exists because "more closed" had nowhere to go. `mouthO` already
     * bottoms out at 0, so a shut mouth is still a lens of fixed thickness,
     * and the only remaining lever was `mouthC` — which makes a FROWN rather
     * than a tighter mouth. Pressed lips are their own expression: somebody
     * declining to say the thing, which is exactly what a deadpan is.
     */
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
 * The neutral pose. Every action begins and ends here. `mouthC` is not zero:
 * a dead-flat mouth reads as sullen rather than neutral.
 *
 * It is a KNOWING rest, not a blank one: lids a little lowered and the right
 * brow a touch higher, so at rest he has already noticed something. Wide-open
 * eyes and level brows read as an eager helper, which he is not.
 */
export const ASARO_REST = {
    tip: 0, bob: 0, sq: 1, lean: 0,
    browL: 0, browR: -4, tiltL: 0, tiltR: -3,
    lidL: 0.15, lidR: 0.15, squint: 0,
    mouthC: 0.3, mouthO: 0,
    crest: 0,
    gx: 0, gy: 0, gw: 0,
} as const;

/**
 * Geometry, in a 200×200 viewBox. `bustBox` is the crop used below 48px — it
 * drops the crest and tightens onto the face, since a crest sliced off by the
 * viewBox edge reads as a rendering bug.
 */
export const ASARO_RIG = {
    viewBox: '0 0 200 200',
    bustBox: '26 38 148 148',

    /** The face. A soft squircle, a touch wider at the cheek than the crown. */
    face: 'M100 46 C140 46 166 74 166 112 C166 152 138 176 100 176 C62 176 34 152 34 112 C34 74 60 46 100 46 Z',
    /** Bottom-weighted shade, clipped to the face, to keep it from reading flat. */
    shade: 'M20 166 C60 146 140 146 180 166 L180 200 L20 200 Z',
    /** Head transform origin — the centre of the face, not of the viewBox. */
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

    /**
     * The crest. A tapered brushstroke off the crown, set right of centre so
     * the silhouette is never accidentally symmetrical.
     */
    crest: {
        d: 'M80 56 C84 22 114 4 150 12 C132 24 122 38 116 58 Z',
        px: 100,
        py: 54,
    },

    /** Eyes. Large on purpose — they carry most of the expression and are the
     * last thing to survive as the character shrinks. */
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
        glint: { dx: -5, dy: -6, r: 4.6 },
        spark: { dx: 4.5, dy: 5, r: 2 },
        /** Pupil travel at full gaze deflection. Stays inside the lid: 12.5 + 7.5 < 22. */
        travelX: 7.5,
        travelY: 6,
        /** Distance the upper lid falls to shut the eye: 2·ry + 3. */
        lidTravel: 51,
        /**
         * Upper lid edge: parked `lift` above the eye, bowed down by `bow` so a
         * half-lid reads as a lid rather than a cut. Its lash line follows the
         * lid down to `hold` and stops there, so a shut eye keeps a visible line.
         */
        lid: { lift: 2, bow: 6, hold: 0.7 },
        /** Heavier arc over the top of each eye, `deg` short of the corners. */
        liner: { deg: 12 },
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

    /** Broad, soft nose: nostril wings in one line, and a faint bridge highlight. */
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

    /**
     * The mouth is generated, not stored: a filled lens whose edges are pulled
     * apart by `mouthO` and bowed by `mouthC`. Shut, it collapses to a line.
     */
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
        /** Half-thickness of the lens when shut, so it reads as a line not a gap. */
        lip: 5.5,
        /**
         * Tongue height as a fraction of the open drop. It sits on the middle
         * half of the lower edge and vanishes when the mouth shuts.
         */
        tongue: 0.75,
        /**
         * A standing smirk: the right corner sits `rise` higher than the left
         * and the bow leans `shift` toward it. Constant, so every performance
         * keeps the same lopsided mouth.
         */
        smirk: { rise: 3, shift: 3 },
    },

    /**
     * Blush rises with the smile, `gain` per unit of `mouthC` above rest, and
     * is all but gone at rest. Resting blush is a baby-face cue he does not want.
     */
    cheek: { lx: 66, rx: 134, cy: 138, w: 14, h: 8.5, base: 0.03, gain: 0.42 },

    /** A tonal curve under the mouth: structure in the lower face. */
    chin: { d: 'M94 163.5 Q100 167 106 163.5', w: 2.2, opacity: 0.45 },

    /**
     * Ilà — Yoruba facial marks. Pélé: three near-vertical strokes a cheek. The
     * one thing on the face that is not a performance; every other feature
     * moves, these say who the character is.
     *
     * Vertical, not horizontal: eyes, brows and mouth all run horizontally, so
     * abàjà marks blend into them — at 74px the lowest line merges with the
     * mouth into a smudge. Running against that grain keeps them legible.
     *
     * Only the left cheek is stored; the right is mirrored about `mirror`, so
     * the two can never drift apart.
     */
    /**
     * Lashes, on the OUTER corner of the left eye and mirrored for the right.
     *
     * The cartoon shorthand for a girl's face, and the reference leans on it
     * hard. Outer corner only: lashes all the way round read as a doll, and
     * three short strokes angled up and out is the whole convention.
     */
    lashes: {
        /** Outer corner of the left eye, mirrored for the right. */
        strokes: [
            [56, 91, 50, 86],
            [51, 99, 44, 96],
            [50, 107, 43, 107],
        ],
        mirror: 100,
        /** Finer than a brow, which it would otherwise compete with. */
        w: 2,
    },

    marks: {
        strokes: [
            [51, 133, 49, 150],
            [58, 132, 56, 152],
            [66, 133, 64, 151],
        ],
        mirror: 100,
        w: 3.2,
        /** Tonal, not graphic. Scarification catches light; at full contrast
         *  these read as war paint, which is the wrong register. */
        opacity: 0.62,
    },
} as const;

/**
 * Hair geometry a look may substitute for the default crest.
 *
 * `back` sits behind the head; `front` sits over the face and its outline,
 * under the eyes and brows. Each carries its own detail strokes, and each
 * sways on the crest channel scaled by `sway`: hair attached at the scalp
 * barely moves, while length can swing.
 */
export interface HairShape {
    back?: string;
    /** Darker layer over `back`, in `hairDark`: depth behind the neck. */
    under?: string;
    /** Strokes over `back`, in `hairDark`. */
    backStrands?: string[];
    front?: string;
    /** Edges of `front` to stroke. Omitted, the whole outline is; a fade must not have a hard edge. */
    outline?: string[];
    /** A soft edge along the hairline, in `crest`, where an outline would read as a cap. */
    soft?: string;
    /** Under `front`: `crest` fading top to bottom by `stops` ([offset, opacity]). */
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
    /** Upper-rim arc (`ASARO_RIG.eye.liner`) colour and width. */
    liner: string; linerW: number;
    /** Width of the moving lid-edge line, drawn in `brow`. */
    lidW: number;
    /** Brow thickness as a fraction of `ASARO_RIG.brow.w`. */
    browWeight: number;
    /** Ear studs. Omitted, the ears are bare. */
    studs?: string;
    /**
     * Face outline. Omitted, `ASARO_RIG.face`. Only the lower half may differ:
     * the hair, the fade and the hairline are drawn against the shared upper half.
     */
    head?: string;
    /**
     * Whether this look wears the ilà.
     *
     * Per-look rather than per-rig because the marks are identity, not
     * decoration — the render comment calls them the thing that "states who
     * the character is". A look that does not wear them is a different
     * person, which is exactly what a second character is.
     */
    marks: boolean;
    /** Lashes at the outer eye corners — see `ASARO_RIG.lashes`. */
    lashes?: boolean;
    /**
     * Alternate hair. Omitted, the look wears `ASARO_RIG.crest` — the single
     * tapered brushstroke the character was designed around.
     *
     * It lives on the LOOK rather than in the rig because it is the thing that
     * distinguishes one character from another. Everything else in the rig —
     * where the eyes sit, how far a lid travels, what a nod does — is shared,
     * which is the point: they are the same performance in two faces.
     */
    hair?: HairShape;
}> = {
    cloth: {
        face: '#c97355',
        shade: '#b1654b',
        shadeOpacity: 0.38,
        // Near-black espresso: his hair, not a second skin tone.
        crest: '#3a241b',
        hairDark: '#24160f',
        hairLight: '#6b4634',
        rim: '#6f3f2f',
        // Darker than the iris. A brow the face can swallow cannot carry an
        // expression, and the brow is this character's loudest channel.
        brow: '#44271d',
        eyeWhite: '#ffffff',
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
        liner: '#6f3f2f',
        linerW: 2,
        lidW: 2.4,
        browWeight: 1,
        // A fuller, squarer jaw than hers.
        head: 'M100 46 C140 46 166 74 166 112 '
            + 'C167 162 150 179 100 179 C50 179 33 162 34 112 C34 74 60 46 100 46 Z',
        marks: false,
        hair: {
            /*
             * Smooth taper fade: one clean shape grown from the face edge —
             * flush at the temples, full at the crown — so it reads as his
             * hair, not a cap. Soft line-up edge, and sides that fade to skin
             * by the ear along the face edge.
             */
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

    /**
     * The same rig under long pink hair.
     *
     * Only the hair, colours and static details (lashes, liner, studs)
     * change. The eyes stay where they are, the lids travel the same
     * distance, and every one of the
     * twelve actions plays identically — which is the whole reason this is a
     * look rather than a second rig. A reader who picks her gets the same
     * character doing the same performances, not a second character who would
     * need her own twelve tables and her own voice.
     *
     * The skin is unchanged. Two faces in the same palette read as two people
     * rather than as one person and a recolour of them.
     */
    pink: {
        /*
         * A little lighter than his, and warmer with it. Far enough apart to
         * read as two people at a glance, close enough that they are plainly
         * the same clay — a large gap would make them look like a diversity
         * swatch rather than a pair.
         */
        face: '#dd8f6f',
        shade: '#c67a5f',
        shadeOpacity: 0.34,
        crest: '#c4658c',
        hairDark: '#a44c6c',
        hairLight: '#e393b2',
        rim: '#6f3f2f',
        brow: '#44271d',
        eyeWhite: '#ffffff',
        eyeRim: 'rgba(0,0,0,0.18)',
        iris: '#5a3426',
        pupil: '#180e0a',
        // Muted rose, 3.49:1 on her face. It is the mouth's inside too, so it stays dark.
        mouth: '#743834',
        mark: '#6f3f2f',
        cheek: '#b85d52',
        cheeks: true,
        contour: '#a86049',
        tongue: '#b0605a',
        irisLight: '#8a5a40',
        // Heavier than his and in the brow colour: with the lashes, it reads as liner.
        liner: '#44271d',
        linerW: 2.8,
        lidW: 3,
        browWeight: 0.78,
        studs: '#d4a95e',
        // Softer and a touch narrower at the chin than his.
        head: 'M100 46 C140 46 166 74 166 112 '
            + 'C164 149 131 176.5 100 176.5 C69 176.5 36 149 34 112 C34 74 60 46 100 46 Z',
        // No ilà. See `marks` above — they are his, not a default.
        marks: false,
        lashes: true,
        hair: {
            /*
             * Tight at the crown, full at the ends. Width carried all the way
             * up reads as a hood rather than hair; the volume belongs where it
             * falls. Ends hang as rounded locks with notches between them.
             */
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
            /*
             * Corners tucked inside the mass at both ends — a fringe that
             * meets it edge to edge lets the page through as a pale wedge.
             * Parted right of centre and swept lower on the left.
             */
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
 * Every performance, gestures and expressions alike.
 *
 * The hand gestures are the ones that had to be re-invented without hands:
 * `wave` is a rocking head and an eye-smile, `point` a lean-in with one brow up
 * and the pupils thrown at the target, `thumbsUp` a wink and a lopsided grin,
 * `shrug` a held tip with both inner brows up and the gaze sent up and away.
 * None of them share a shape.
 */
export const ASARO_ACTIONS: Record<AsaroAction, ActionTable> = {
    /**
     * "Interesting." The stillness IS the performance — every other action
     * moves the head, this one refuses. The mouth flattens below rest, one brow
     * holds up, and the only event is a single slow blink. The gaze seizes dead
     * centre: he is looking at you, waiting.
     */
    deadpan: {
        ms: 1400,
        /*
         * Snap in, hold a long time, leave. Most actions ease through their
         * middle; this one has to ARRIVE and then refuse to move, because the
         * expression is the absence of reaction and an expression still
         * travelling reads as one.
         */
        t: /*      */[0, 0.07, 0.18, 0.5, 0.62, 0.9, 1],
        tip: /*    */[0, 0, 0, 0, 0, 0, 0],
        bob: /*    */[0, 0, 0, 0, 0, 0, 0],
        sq: /*     */[1, 1, 1, 1, 1, 1, 1],
        lean: /*   */[0, 0, 0, 0, 0, 0, 0],
        browL: /*  */[0, 0, 0, 0, 0, 0, 0],
        browR: /*  */[-4, -6, -11, -11, -11, -10, -4],
        tiltL: /*  */[0, 0, 0, 0, 0, 0, 0],
        tiltR: /*  */[-3, -2, -5, -5, -5, -4, -3],
        /*
         * Lowered and held — no scripted blink.
         *
         * There was one, mid-hold, and it was wrong twice. A brow held up is
         * a look being sustained, and blinking under it breaks exactly the
         * sustain the expression is made of. It was also redundant: the
         * involuntary blink runs on its own irregular schedule and the eye
         * takes whichever lid is more closed, so the face blinks here anyway
         * — at a natural moment rather than a scheduled one, which is the
         * whole reason that loop is irregular.
         */
        lidL: /*   */[0.15, 0.16, 0.22, 0.22, 0.22, 0.2, 0.15],
        lidR: /*   */[0.15, 0.16, 0.22, 0.22, 0.22, 0.2, 0.15],
        squint: /* */[0, 0, 0, 0, 0, 0, 0],
        /*
         * BELOW flat, and held there.
         *
         * `mouthC` rests at 0.3, which is already a smile — the face is
         * pleasant by default. A deadpan that only eases to 0.06 is still
         * curving upward, so he sits there grinning through the one
         * expression whose entire content is that he is not amused. Flat is
         * 0; this goes just past it and stays.
         */
        mouthC: /* */[0.3, 0.05, -0.08, -0.08, -0.08, -0.06, 0.3],
        mouthO: /* */[0, 0, 0, 0, 0, 0, 0],
        // Held thin. The mouth is shut either way; this is it being held shut.
        press: /*  */[1, 0.8, 0.45, 0.45, 0.45, 0.6, 1],
        crest: /*  */[0, 2, 3, 3, 3, 2, 0],
        gx: /*     */[0, 0, 0, 0, 0, 0, 0],
        gy: /*     */[0, 0, 0, 0, 0, 0, 0],
        gw: /*     */[0, 0.9, 0.95, 0.95, 0.95, 0.9, 0],
    },

    /**
     * 👀 Watching — "I noticed. I always notice." The head leans AWAY while the
     * eyes go the other way, which is what makes a look sly rather than
     * curious; `point` leans in with the same channels.
     */
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
        // Flat, for the same reason as deadpan: 0.3 is a smile, not neutral.
        mouthC: /* */[0.3, 0.1, -0.04, -0.04, 0.08, 0.3],
        mouthO: /* */[0, 0, 0, 0, 0, 0],
        crest: /*  */[0, -5, -7, -7, -3, 0],
        // Held, not swept. A look that travels is a glance; one that stays is a stare.
        gx: /*     */[0, 0.65, 0.88, 0.88, 0.5, 0],
        gy: /*     */[0, 0.05, 0.08, 0.08, 0.04, 0],
        gw: /*     */[0, 1, 1, 1, 0.6, 0],
    },

    /**
     * 😌 Smug. "I'll allow it."
     *
     * The first attempt was closed eyes and a broad grin, and it read as
     * CONTENT — a different feeling entirely. Bliss and self-satisfaction use
     * the same parts arranged oppositely:
     *
     *   **Half-lidded, not shut.** Closed eyes are enjoyment turned inward.
     *   Smugness is aimed at somebody, so the eyes stay open enough to aim.
     *
     *   **Chin up, gaze down.** The head lifts while the eyes drop — looking
     *   down your nose at a person, the whole posture in two channels, and
     *   the thing the first version missed entirely.
     *
     *   **A small mouth, pressed.** A wide smile is joy. This is a contained
     *   curve held closed, because he is enjoying something he is not saying.
     */
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
        // Held closed — he is enjoying something he is not going to say.
        press: /*  */[1, 0.85, 0.7, 0.7, 0.85, 1],
        crest: /*  */[0, 5, 8, 8, 4, 0],
        gx: /*     */[0, 0.1, 0.16, 0.16, 0.08, 0],
        // Down, while the head goes up. This is the line that makes it smug.
        gy: /*     */[0, 0.2, 0.3, 0.3, 0.14, 0],
        gw: /*     */[0, 0.85, 0.95, 0.95, 0.5, 0],
    },

    /**
     * 😅 He knows he is being a lot — the softening the character doc says
     * always arrives last. Both inner brows go up like `shrug`, but the gaze
     * goes DOWN and away rather than up: the difference between "who knows" and
     * "yes, alright, I hear myself".
     */
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
        // Holds the gaze dead centre: a greeting looks at you, it does not wander.
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
