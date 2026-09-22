/**
 * Àṣàrò's rig, as data.
 *
 * The character is a face. Not an animal, not a body — a face, with a single
 * tapered crest rising off the crown that gives the silhouette something to
 * own and gives the rig a limb to gesture with. That crest matters more than
 * it looks: the app calls eight actions by name and four of them (`wave`,
 * `point`, `thumbsUp`, `shrug`) are hand gestures on any normal character.
 * With no hands they have to be performed by brow, lid, pupil, mouth, cheek,
 * head and crest alone, and the crest is what keeps them from reading as the
 * same small nod four times over.
 *
 * Its colour is clay — #c97355 — and it stays clay in both themes. A soft,
 * unsaturated terracotta: warm enough to read as a face rather than an
 * object, quiet enough not to shout on a page about someone's reading.
 * What the look changes is only what the ground demands: a dark rim to hold
 * an edge against ecru, a light one against black, and less ornament in
 * Locked In, which does not do ornament.
 *
 *   fill against Cloth's #efe6d8 ground ......... 2.80:1
 *   rim  against Cloth's #efe6d8 ground ......... 6.99:1
 *   fill against Locked In's #000000 ground ..... 6.07:1
 *
 * The fill alone does not clear 3:1 on ecru, and does not need to. WCAG
 * 1.4.11 asks a graphical object for a 3:1 *boundary*, and the 3px rim is
 * that boundary at 6.99:1. This is the whole reason the rim exists as its
 * own token: reading the rule as "the fill must clear 3:1 on both grounds"
 * confines the character to a narrow mid-dark band — luminance 0.10 to
 * 0.233 — and everything in that band is muddy. Letting the rim carry the
 * edge is what buys a colour worth looking at.
 *
 * Keyframes are flattened into parallel numeric arrays because the animation
 * runs in Reanimated worklets on the UI thread, and a worklet wants arrays of
 * numbers rather than a tree of objects. Two invariants hold everywhere and
 * the component relies on both:
 *
 *   1. every channel array in an action is exactly as long as that action's
 *      `t`, so a channel can be sampled without a bounds check per frame;
 *   2. every channel starts and ends at its `ASARO_REST` value, so an action
 *      can be interrupted, replayed or cut short without the face snapping.
 *
 * design/asaro-face.html inlines these same numbers and must be kept in step
 * with this file — it is the prototype the character is judged in.
 */

export type AsaroAction =
    | 'wave' | 'nod' | 'point' | 'thumbsUp' | 'celebrate' | 'shrug' | 'sigh' | 'think';

export type AsaroLook = 'cloth' | 'lockedIn';

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
 * The neutral pose.
 *
 * `mouthC` is not zero. At rest the character carries a small smile, because
 * a face sitting at a dead-flat mouth reads as sullen rather than neutral,
 * and this one greets people. Every action begins and ends here.
 */
export const ASARO_REST = {
    tip: 0, bob: 0, sq: 1, lean: 0,
    browL: 0, browR: 0, tiltL: 0, tiltR: 0,
    lidL: 0, lidR: 0, squint: 0,
    mouthC: 0.3, mouthO: 0,
    crest: 0,
    gx: 0, gy: 0, gw: 0,
} as const;

/**
 * Geometry, in a 200×200 viewBox.
 *
 * `bustBox` is the crop used below 48px. It drops the crest and tightens onto
 * the face: a crest sliced off by the viewBox edge reads as a rendering bug,
 * and at 24px the fine end of it would be a single grey pixel anyway.
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

    /**
     * The crest. A tapered brushstroke off the crown, set right of centre so
     * the silhouette is never accidentally symmetrical.
     */
    crest: {
        d: 'M80 56 C84 22 114 4 150 12 C132 24 122 38 116 58 Z',
        px: 100,
        py: 54,
    },

    /**
     * Eyes. Large on purpose — they carry most of the expression, and they are
     * the last thing to survive as the character shrinks.
     */
    eye: {
        cy: 104,
        lx: 72,
        rx2: 128,
        rx: 22,
        ry: 24,
        iris: 12.5,
        pupil: 6.5,
        glint: { dx: -5, dy: -6, r: 4.6 },
        spark: { dx: 4.5, dy: 5, r: 2 },
        /** Pupil travel at full gaze deflection. Stays inside the lid: 12.5 + 7.5 < 22. */
        travelX: 7.5,
        travelY: 6,
        /** Distance the upper lid falls to shut the eye: 2·ry + 3. */
        lidTravel: 51,
        /** Distance the lower lid rises at squint 1. */
        squintTravel: 30,
    },

    brow: {
        l: 'M50 77 Q70 66 88 74',
        r: 'M112 74 Q130 66 150 77',
        lpx: 69, lpy: 71,
        rpx: 131, rpy: 71,
        w: 7.5,
    },

    /**
     * The mouth is generated, not stored — a single filled lens whose two
     * edges are pulled apart by `mouthO` and bowed by `mouthC`. Shut, the
     * lens collapses to a drawn line, which is what a closed mouth is.
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
    },

    cheek: { lx: 66, rx: 134, cy: 138, w: 14, h: 8.5 },

    /**
     * Ilà — Yoruba facial marks. Pélé: three near-vertical strokes a cheek.
     *
     * These are the one thing on the face that is not a performance. Every
     * other feature moves; these say who the character is. The app is called
     * Àṣàrò and speaks Yoruba-inflected English, and without them the face is
     * a warm blob that could belong to any app in any country.
     *
     * Vertical rather than horizontal on purpose. The eyes, brows and mouth
     * all run horizontally, so horizontal marks (abàjà) blend into them — at
     * 74px the lowest line merges with the mouth into a smudge. Running
     * against that grain is what keeps them legible as marks.
     *
     * Only the left cheek is stored; the right is this list mirrored about
     * `mirror`, so the two can never drift apart.
     */
    marks: {
        strokes: [
            [51, 133, 49, 150],
            [58, 132, 56, 152],
            [66, 133, 64, 151],
        ],
        mirror: 100,
        w: 3.2,
        /** Tonal, not graphic. Scarification catches light; drawn at full
         *  contrast these would read as war paint, which is the wrong register. */
        opacity: 0.62,
    },
} as const;

/**
 * Two grounds, one character.
 *
 * `face` is identical in both because that is the point of a signature
 * colour. Everything else is the minimum needed to survive the ground it is
 * standing on.
 */
export const ASARO_LOOKS: Record<AsaroLook, {
    face: string; shade: string; shadeOpacity: number;
    crest: string; rim: string; brow: string; mark: string;
    eyeWhite: string; eyeRim: string; iris: string; pupil: string;
    mouth: string; cheek: string; cheeks: boolean;
}> = {
    cloth: {
        face: '#c97355',
        shade: '#b1654b',
        shadeOpacity: 0.38,
        // Darker than the face, so the crest separates from it on a light ground.
        crest: '#a96147',
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
    },
    lockedIn: {
        face: '#c97355',
        shade: '#b1654b',
        // Locked In does one thing at a time; the volume is stated, not modelled.
        shadeOpacity: 0.25,
        // Same as the face: against black the silhouette should read as one mass.
        crest: '#c97355',
        rim: 'rgba(255,255,255,0.28)',
        brow: '#44271d',
        eyeWhite: '#ffffff',
        eyeRim: 'rgba(0,0,0,0.18)',
        iris: '#5a3426',
        pupil: '#180e0a',
        mouth: '#44271d',
        // Kept at full strength in Locked In even though the blush is dropped:
        // the marks are identity, not ornament, and that mode strips ornament.
        mark: '#6f3f2f',
        cheek: '#a44b43',
        cheeks: false,
    },
};

/**
 * The eight performances.
 *
 * Read the hand gestures carefully — they are the ones that had to be
 * re-invented. `wave` is a rocking head and an eye-smile; `point` is a
 * lean-in with one brow up and the pupils thrown at the target; `thumbsUp`
 * is a wink and a lopsided grin; `shrug` is a held tip with both inner brows
 * up and the gaze sent up and away. None of them share a shape.
 */
export const ASARO_ACTIONS: Record<AsaroAction, ActionTable> = {
    /** Hello. The head rocks, the eyes crease, the crest whips across. */
    wave: {
        ms: 920,
        t: /*      */[0, 0.15, 0.35, 0.55, 0.75, 1],
        tip: /*    */[0, -7, 8, -6, 4, 0],
        bob: /*    */[0, -3, -2, -3, -1, 0],
        sq: /*     */[1, 1.03, 1, 1.03, 1.01, 1],
        lean: /*   */[0, -2, 2, -2, 1, 0],
        browL: /*  */[0, -6, -5, -6, -3, 0],
        browR: /*  */[0, -6, -5, -6, -3, 0],
        tiltL: /*  */[0, -4, -3, -4, -2, 0],
        tiltR: /*  */[0, 4, 3, 4, 2, 0],
        lidL: /*   */[0, 0, 0, 0, 0, 0],
        lidR: /*   */[0, 0, 0, 0, 0, 0],
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
        browR: /*  */[0, 2, -3, 2, -2, 0],
        tiltL: /*  */[0, 0, 0, 0, 0, 0],
        tiltR: /*  */[0, 0, 0, 0, 0, 0],
        lidL: /*   */[0, 0.35, 0, 0.3, 0, 0],
        lidR: /*   */[0, 0.35, 0, 0.3, 0, 0],
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
        browR: /*  */[0, -9, -11, -10, -5, 0],
        tiltL: /*  */[0, 2, 3, 3, 1, 0],
        tiltR: /*  */[0, -7, -9, -8, -4, 0],
        lidL: /*   */[0, 0, 0, 0, 0, 0],
        lidR: /*   */[0, 0, 0, 0, 0, 0],
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
        browR: /*  */[0, -7, -9, -7, -3, 0],
        tiltL: /*  */[0, 0, 0, 0, 0, 0],
        tiltR: /*  */[0, -5, -6, -5, -2, 0],
        lidL: /*   */[0, 0.9, 1, 0.85, 0.2, 0],
        lidR: /*   */[0, 0, 0, 0, 0, 0],
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
        browR: /*  */[0, -11, -9, -11, -8, -4, 0],
        tiltL: /*  */[0, -3, -2, -3, -2, -1, 0],
        tiltR: /*  */[0, 3, 2, 3, 2, 1, 0],
        lidL: /*   */[0, 0, 0, 0, 0, 0, 0],
        lidR: /*   */[0, 0, 0, 0, 0, 0, 0],
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
        browR: /*  */[0, -7, -9, -8, -4, 0],
        // Inner ends up: the difference between puzzled and annoyed.
        tiltL: /*  */[0, -9, -11, -10, -5, 0],
        tiltR: /*  */[0, 9, 11, 10, 5, 0],
        // Half-lidded rather than creased — this is not a smile.
        lidL: /*   */[0, 0.28, 0.35, 0.32, 0.15, 0],
        lidR: /*   */[0, 0.28, 0.35, 0.32, 0.15, 0],
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
        browR: /*  */[0, -5, -6, 5, 3, 0],
        tiltL: /*  */[0, -3, -4, -7, -4, 0],
        tiltR: /*  */[0, 3, 4, 7, 4, 0],
        lidL: /*   */[0, 0.15, 0.1, 0.7, 0.45, 0],
        lidR: /*   */[0, 0.15, 0.1, 0.7, 0.45, 0],
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
        browR: /*  */[0, 4, 6, 6, 2, -12, 0],
        tiltL: /*  */[0, -5, -7, -7, -3, -3, 0],
        tiltR: /*  */[0, -3, -5, -5, -2, 4, 0],
        lidL: /*   */[0, 0.1, 0.15, 0.15, 0.08, 0, 0],
        lidR: /*   */[0, 0.3, 0.38, 0.38, 0.18, 0, 0],
        squint: /* */[0, 0.1, 0.15, 0.15, 0.08, 0.3, 0],
        mouthC: /* */[0.3, -0.1, -0.15, -0.15, 0.1, 0.85, 0.3],
        mouthO: /* */[0, 0.05, 0.08, 0.08, 0.05, 0.3, 0],
        crest: /*  */[0, 12, 16, 16, 6, -14, 0],
        gx: /*     */[0, -0.6, -0.8, -0.8, -0.4, 0, 0],
        gy: /*     */[0, -0.5, -0.7, -0.7, -0.35, -0.1, 0],
        gw: /*     */[0, 1, 1, 1, 0.7, 0.8, 0],
    },
};
