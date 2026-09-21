/**
 * Shape, per style.
 *
 * Colour and type were already themed; shape was not, because the first two
 * styles are both flat and square and a shared constant was enough. Restoring
 * Classic changed that — its whole character is rounded cards with soft
 * borders and a little lift, which no palette swap can express.
 *
 * So radius, border weight and elevation move here, and a screen asks the
 * theme for them the same way it asks for a colour.
 */
import { Spacing } from './spacing';

export interface ThemeShape {
    /** Panels, cards, sheets. */
    card: number;
    /** Buttons and pills. */
    button: number;
    /** Text fields and search. */
    input: number;
    /** Small chips, badges, tags. */
    chip: number;
    /** Hairline weight for dividers and card borders. */
    hairline: number;
    /** Whether cards draw a border at all. */
    cardBorder: boolean;
    /** Lift under cards. Flat styles use `none`. */
    elevation: typeof Spacing.elevation.none | typeof Spacing.elevation.overlay;
    /** Gap between stacked cards; Classic is airier than the flat styles. */
    stackGap: number;
}

/** Cloth — flat, square, separated by colour blocks and hairlines. */
export const clothShape: ThemeShape = {
    card: Spacing.borderRadius.none,
    button: Spacing.borderRadius.none,
    input: Spacing.borderRadius.none,
    chip: Spacing.borderRadius.none,
    hairline: Spacing.border.hairline,
    cardBorder: false,
    elevation: Spacing.elevation.none,
    stackGap: Spacing.lg,
};

/** Colossal — flat and square too; weight does the separating. */
export const colossalShape: ThemeShape = {
    card: Spacing.borderRadius.none,
    button: Spacing.borderRadius.none,
    input: Spacing.borderRadius.none,
    chip: Spacing.borderRadius.none,
    hairline: Spacing.border.hairline,
    cardBorder: false,
    elevation: Spacing.elevation.none,
    stackGap: Spacing.lg,
};

/**
 * Classic — the original app.
 *
 * Rounded, bordered, lightly lifted. These are the radii the app actually
 * shipped with (12 for cards, 16 for larger panels, 8 for chips) rather than
 * the full set of 23, which were drift rather than intent.
 */
export const classicShape: ThemeShape = {
    card: 12,
    button: 12,
    input: 12,
    chip: 8,
    hairline: Spacing.border.hairline,
    cardBorder: true,
    elevation: Spacing.elevation.none,
    stackGap: Spacing.layout.cardPadding,
};
