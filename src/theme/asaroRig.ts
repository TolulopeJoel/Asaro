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
    },

    cheek: { lx: 66, rx: 134, cy: 138, w: 14, h: 8.5 },

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

/** Per-look palette. Everything but `face` is the minimum needed to survive
 * the ground the character stands on; `face` is the signature colour. */
/** Hair geometry a look may substitute for the default crest. */
export interface HairShape {
    /** Behind the head, so length can fall past the jaw. */
    back: string;
    /** In front of the face. Omit for a silhouette with no fringe. */
    front?: string;
    /** Pivot for the sway, in viewBox units. */
    px: number;
    py: number;
}

export const ASARO_LOOKS: Record<AsaroLook, {
    face: string; shade: string; shadeOpacity: number;
    crest: string; rim: string; brow: string; mark: string;
    eyeWhite: string; eyeRim: string; iris: string; pupil: string;
    mouth: string; cheek: string; cheeks: boolean;
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
        marks: false,
        hair: {
            /*
             * Short hair reads from the HAIRLINE, not the outline — the
             * silhouette barely leaves the skull, so the shape lives in the
             * front piece and the mass is only a rim above the crown.
             */
            back: 'M100 32 C56 32 30 62 28 108 C32 78 58 56 100 56 '
                + 'C142 56 168 78 172 108 C170 62 144 32 100 32 Z',
            /** A high hairline, peaked right of centre. */
            front: 'M36 92 C38 54 64 38 102 38 C136 38 158 48 170 70 '
                + 'C158 60 146 58 138 62 C126 58 118 60 110 62 '
                + 'C84 65 54 74 36 92 Z',
            px: 100,
            py: 56,
        },
    },

    /**
     * The same rig under long pink hair.
     *
     * Only the hair and the colours that sit against it change. The eyes stay
     * where they are, the lids travel the same distance, and every one of the
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
        // The crest is unused here — `hair` replaces it — but a look must
        // carry the colour in case the shape is ever dropped back.
        crest: '#c4658c',
        rim: '#6f3f2f',
        brow: '#44271d',
        eyeWhite: '#ffffff',
        eyeRim: 'rgba(0,0,0,0.18)',
        iris: '#5a3426',
        pupil: '#180e0a',
        mouth: '#502e22',
        mark: '#6f3f2f',
        cheek: '#b85d52',
        cheeks: true,
        // No ilà. See `marks` above — they are his, not a default.
        marks: false,
        lashes: true,
        hair: {
            /*
             * Tight at the crown, full at the ends. Width carried all the way
             * up reads as a hood rather than hair; the volume belongs where it
             * falls. Ends scalloped, since a smooth arc reads as a hem.
             */
            back: 'M100 26 C56 26 28 60 26 104 C24 130 14 156 6 182 '
                + 'C16 176 26 180 32 190 C42 178 56 178 64 190 C74 178 90 178 100 190 '
                + 'C110 178 126 178 136 190 C144 178 158 178 168 190 C174 180 184 176 194 182 '
                + 'C186 156 176 130 174 104 C172 60 144 26 100 26 Z',
            /*
             * Corners tucked inside the mass at both ends — a fringe that
             * meets it edge to edge lets the page through as a pale wedge.
             * Swept lower on the left, so the hairline is not a plain arc.
             */
            front: 'M30 96 C34 58 62 36 100 36 C138 36 166 58 170 96 '
                + 'C160 74 140 62 114 64 C86 66 56 76 30 96 Z',
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
        browR: /*  */[0, -6, -11, -11, -11, -10, 0],
        tiltL: /*  */[0, 0, 0, 0, 0, 0, 0],
        tiltR: /*  */[0, -2, -5, -5, -5, -4, 0],
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
        lidL: /*   */[0, 0.16, 0.22, 0.22, 0.22, 0.2, 0],
        lidR: /*   */[0, 0.16, 0.22, 0.22, 0.22, 0.2, 0],
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
        browR: /*  */[0, 2, 3, 3, 1, 0],
        tiltL: /*  */[0, -2, -3, -3, -1, 0],
        tiltR: /*  */[0, 3, 5, 5, 2, 0],
        lidL: /*   */[0, 0.32, 0.46, 0.46, 0.24, 0],
        lidR: /*   */[0, 0.32, 0.46, 0.46, 0.24, 0],
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
        browR: /*  */[0, -5, -8, -8, -4, 0],
        tiltL: /*  */[0, 0, 0, 0, 0, 0],
        tiltR: /*  */[0, -2, -4, -4, -2, 0],
        lidL: /*   */[0, 0.3, 0.48, 0.48, 0.24, 0],
        lidR: /*   */[0, 0.3, 0.48, 0.48, 0.24, 0],
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
        browR: /*  */[0, -7, -10, -9, -4, 0],
        tiltL: /*  */[0, -5, -7, -6, -3, 0],
        tiltR: /*  */[0, 5, 7, 6, 3, 0],
        lidL: /*   */[0, 0.2, 0.3, 0.26, 0.12, 0],
        lidR: /*   */[0, 0.2, 0.3, 0.26, 0.12, 0],
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
