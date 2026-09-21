import { Platform } from 'react-native';

/**
 * Type for all three styles.
 *
 *   Cloth     — Fraunces (display) over Work Sans (everything else).
 *   Classic   — the platform system face, as the app originally shipped.
 *   Colossal  — Archivo throughout; weight does the hierarchy.
 *
 * Font family names must match the keys passed to `useFonts` in app/_layout.tsx.
 *
 * Diacritics: the app is named Àṣàrò — s with dot below (U+1E63) and o with
 * grave. This is a hard constraint on the type, not a nicety: Colossal was
 * drawn in Schibsted Grotesk, which turned out to have no U+1E63 at all, so
 * Locked In would have rendered the app's own name broken. Archivo carries the
 * full set (ṣ, ọ, ẹ and the graves) and is the reason it won the slot.
 *
 * `npm run check:glyphs` asserts coverage across every bundled face. Run it
 * before swapping any font, and still check a physical Android device — the
 * simulator's fallback chain is more forgiving than a real handset's.
 */

export const FontFamily = {
    // Cloth
    display: 'Fraunces_700Bold',
    displayHeavy: 'Fraunces_900Black',
    displayItalic: 'Fraunces_700Bold_Italic',
    body: 'WorkSans_400Regular',
    bodyMedium: 'WorkSans_500Medium',
    bodySemibold: 'WorkSans_600SemiBold',

    /**
     * Classic — the platform face, exactly as the original app used it.
     * `undefined` means "the system default", which is what React Native
     * renders when no family is named. Georgia/serif is the one the original
     * declared for quotes and then never actually used.
     */
    system: undefined,
    systemSerif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),

    // Colossal
    mono: 'Archivo_400Regular',
    monoMedium: 'Archivo_500Medium',
    monoBold: 'Archivo_700Bold',
    monoBlack: 'Archivo_900Black',

    // Deprecated aliases for screens not yet migrated to <Text variant=…>.
    // Delete each one as its last caller moves over.
    regular: 'WorkSans_400Regular',
    medium: 'WorkSans_500Medium',
    bold: 'WorkSans_600SemiBold',
    serif: 'Fraunces_700Bold',
} as const;

/**
 * One scale, eight steps. Every size in the app comes from here — the previous
 * code used 13 different raw `fontSize` values, which is why nothing lined up.
 */
export const Typography = {
    fontFamily: FontFamily,

    size: {
        /**
         * Every step is a size the mockup actually uses (design/all-screens.html).
         * The `Half`/`Plus` names are the half-steps that file leans on — Cloth
         * sets meta at 10.5 and supporting copy at 13.5, and rounding those to
         * the nearest whole step is what made the built screens read heavier
         * than the approved cloth. Nothing here is invented: if a size is not
         * in the mockup, it is not in this scale.
         */
        xs: 10,
        /** Cloth's eyebrow and timestamp. */
        xsHalf: 10.5,
        /** Segment, tab and stat labels; Cloth's row counts. */
        xsPlus: 11,
        sm: 12,
        /** Colossal's row snippet. */
        smHalf: 12.5,
        /** Cloth's row snippet and button. */
        smPlus: 13,
        /** Supporting line under a heading, both styles. */
        mdHalf: 13.5,
        md: 14,
        /** Grid cells, pills, book rows, avatar initials. */
        mdPlus: 15,
        lg: 16,
        /** Cloth's verse reference. */
        lgHalf: 17,
        /** Shared heading floor: Colossal's small head. */
        lgPlus: 18,
        /** Cloth's small head. */
        xlMinus: 19,
        xl: 20,
        /** Cloth's card heading. */
        xlPlus: 24,
        /** Colossal's mid heading — deliberately larger than Cloth's. */
        xl2: 26,
        /** Cloth's hero title. */
        xxl: 29,
        /** Cloth's in-body headline, the one step above the hero band. */
        xxlPlus: 31,
        /** The stat numeral. */
        xxxl: 34,
        /** Colossal's large heading. */
        display: 40,
        /** The colossal slot, smaller variant — a question number. */
        colossalSm: 92,
        /** The colossal slot — one per screen, at most. */
        colossal: 116,
        /**
         * Home's giant is set in two parts — the book name over the chapter
         * range — so it carries its own pair of steps rather than `colossal`.
         * The mockup sets these inline on the Home screen, which is the design
         * saying they belong to that one composition.
         */
        giantBook: 74,
        giantRef: 108,
    },

    lineHeight: {
        /** Each one is its size times the mockup's multiplier, rounded to 1px. */
        xs: 14,
        xsHalf: 14,
        xsPlus: 15,
        sm: 16,
        smHalf: 18,
        smPlus: 19,
        mdHalf: 20,
        md: 20,
        mdPlus: 20,
        lg: 24,
        lgHalf: 20,
        /** .co-h.sm is set at 1.02 — a heading line, not a reading line. */
        lgPlus: 18,
        xlMinus: 21,
        xl: 26,
        xlPlus: 27,
        xl2: 31,
        xxl: 30,
        xxlPlus: 34,
        xxxl: 32,
        display: 41,
        colossalSm: 72,
        colossal: 90,
        /** 0.82 and 0.80 of their sizes — the mockup's own multipliers. */
        giantBook: 61,
        giantRef: 86,
        /** Home's greeting: 15px set at 1.4. */
        mdPlusLead: 21,
    },

    letterSpacing: {
        colossal: -0.07,
        tighter: -0.9,
        tight: -0.7,
        normal: 0,
        wide: 1.2,
        wider: 2.1,
        widest: 2.6,
    },

    /**
     * Tracking, in em, exactly as the mockup declares it.
     *
     * The mockup sets letter-spacing in em, so it scales with the size; React
     * Native's `letterSpacing` is absolute px. Keeping the em value here and
     * multiplying by the role's size at render (see `track()` in ui/Text) is
     * what makes the built type provably the approved type, rather than a set
     * of px numbers someone once eyeballed and can no longer justify.
     *
     * Each key is a role; the two numbers are [cloth, colossal].
     */
    tracking: {
        hero: [-0.035, -0.07],
        display: [-0.025, -0.04],
        headline: [-0.025, -0.04],
        title: [-0.025, -0.028],
        subtitle: [-0.025, -0.02],
        reference: [-0.015, -0.01],
        /** The grid cells and pills carry no tracking; only the book rows do,
         *  and at 15px their -.01em is a sixth of a pixel. */
        cell: [0, 0],
        label: [0.19, 0.2],
        meta: [0.1, 0.13],
        caption: [0.1, 0.13],
        tab: [0.12, 0.15],
        button: [0.07, 0.14],
        /** Home's two-part giant. */
        giant: [0, -0.06],
        /** The series line under Home's giant. */
        series: [0, 0.16],
        body: [0, 0],
        bodySmall: [0, 0],
        sub: [0, 0],
        quote: [0, 0],
    },

    weight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        black: '900',
    },
} as const;

/** Semantic roles. Components ask for a role, never a size. */
export type TextVariant =
    | 'meta'        // uppercase timestamps and "when" columns
    | 'hero'        // the one colossal element — Colossal's giant, Cloth's stat numeral
    | 'display'     // screen title in the hero band
    | 'headline'    // the in-body big head, one step above the hero title
    | 'title'       // section / card heading
    | 'subtitle'    // supporting heading
    | 'reference'   // a verse reference at the head of a row
    | 'body'        // running text and inputs
    | 'bodySmall'   // row snippets
    | 'sub'         // the supporting line under a heading
    | 'label'       // uppercase eyebrow, letterspaced
    | 'caption'     // small meta: counts, references, secondary numbers
    | 'tab'         // segmented controls and the tab bar
    | 'cell'        // grid cells, pills, book rows, avatar initials
    | 'quote'       // flashback and scripture, italic in Cloth
    | 'button';
