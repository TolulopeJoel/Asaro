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
        xs: 10,
        sm: 12,
        md: 14,
        lg: 16,
        xl: 20,
        xxl: 26,
        xxxl: 34,
        display: 46,
        colossal: 96,
    },

    lineHeight: {
        xs: 14,
        sm: 16,
        md: 20,
        lg: 24,
        xl: 26,
        xxl: 30,
        xxxl: 38,
        display: 48,
        colossal: 84,
    },

    letterSpacing: {
        colossal: -0.07,
        tighter: -0.9,
        tight: -0.4,
        normal: 0,
        wide: 1.2,
        wider: 2.1,
        widest: 2.6,
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
    | 'hero'        // the one colossal element, Colossal only
    | 'display'     // screen title in the hero band
    | 'title'       // section / card heading
    | 'subtitle'    // supporting heading
    | 'body'        // running text
    | 'bodySmall'
    | 'label'       // uppercase eyebrow, letterspaced
    | 'caption'     // meta, timestamps, references
    | 'quote'       // flashback and scripture, italic in Cloth
    | 'button';
