import { Platform } from 'react-native';

/**
 * Type for the styles.
 *
 *   Cloth     — Fraunces (display) over Work Sans (everything else).
 *   Classic   — the platform system face, as the app originally shipped.
 *
 * Font family names must match the keys passed to `useFonts` in app/_layout.tsx.
 *
 * Diacritics: the app is named Àṣàrò — s with dot below (U+1E63) and o with
 * grave. This is a hard constraint on the type, not a nicety: a face without
 * the full set (ṣ, ọ, ẹ and the graves) renders the app's own name broken.
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

    // Deprecated aliases for screens not yet migrated to <Text variant=…>.
    // Delete each one as its last caller moves over.
    regular: 'WorkSans_400Regular',
    medium: 'WorkSans_500Medium',
    bold: 'WorkSans_600SemiBold',
    serif: 'Fraunces_700Bold',
} as const;

/** One scale, eight steps. Every size in the app comes from here; screens
 * never set a raw `fontSize`. */
export const Typography = {
    fontFamily: FontFamily,

    size: {
        /**
         * Every step is a size design/all-screens.html actually uses. The
         * `Half`/`Plus` names are its half-steps — meta at 10.5, supporting
         * copy at 13.5 — and rounding those to whole steps makes the built
         * screens read heavier than the approved cloth. If a size is not in the
         * mockup, it does not belong in this scale.
         */
        xs: 10,
        /** Cloth's eyebrow and timestamp. */
        xsHalf: 10.5,
        /** Segment, tab and stat labels; Cloth's row counts. */
        xsPlus: 11,
        sm: 12,
        /** Cloth's row snippet and button. */
        smPlus: 13,
        /** Supporting line under a heading. */
        mdHalf: 13.5,
        md: 14,
        /** Grid cells, pills, book rows, avatar initials. */
        mdPlus: 15,
        lg: 16,
        /** Cloth's verse reference. */
        lgHalf: 17,
        /** Cloth's small head. */
        xlMinus: 19,
        xl: 20,
        /** Cloth's card heading. */
        xlPlus: 24,
        /** Cloth's hero title. */
        xxl: 29,
        /** Cloth's in-body headline, the one step above the hero band. */
        xxlPlus: 31,
        /** The stat numeral. */
        xxxl: 34,
        /** The onboarding hour, the one oversized numeral left in the app. */
        display: 40,
    },

    lineHeight: {
        /** Each one is its size times the mockup's multiplier, rounded to 1px. */
        xs: 14,
        xsHalf: 14,
        xsPlus: 15,
        sm: 16,
        smPlus: 19,
        mdHalf: 20,
        md: 20,
        mdPlus: 20,
        lg: 24,
        lgHalf: 20,
        xlMinus: 21,
        xl: 26,
        xlPlus: 27,
        xxl: 30,
        xxlPlus: 34,
        xxxl: 32,
        display: 41,
        /** Home's greeting: 15px set at 1.4. */
        mdPlusLead: 21,
    },

    letterSpacing: {
        tighter: -0.9,
        tight: -0.7,
        normal: 0,
        wide: 1.2,
        wider: 2.1,
        widest: 2.6,
    },

    /**
     * Tracking, in em, exactly as the mockup declares it. The mockup sets
     * letter-spacing in em so it scales with the size; React Native's
     * `letterSpacing` is absolute px. Keeping em here and multiplying by the
     * role's size at render (`track()` in ui/Text) makes the built type
     * provably the approved type rather than eyeballed px. Each key is a role.
     */
    tracking: {
        hero: -0.035,
        heroSmall: -0.035,
        display: -0.025,
        headline: -0.025,
        title: -0.025,
        subtitle: -0.025,
        reference: -0.015,
        /** The grid cells and pills carry no tracking; only the book rows do,
         *  and at 15px their -.01em is a sixth of a pixel. */
        cell: 0,
        label: 0.19,
        meta: 0.1,
        caption: 0.1,
        tab: 0.12,
        button: 0.07,
        body: 0,
        bodySmall: 0,
        sub: 0,
        quote: 0,
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
    | 'hero'        // the screen's one oversized element — Cloth's stat numeral
    | 'heroSmall'   // the same numeral at its smaller step
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
    | 'quote'       // flashback and scripture, italic
    | 'button';
