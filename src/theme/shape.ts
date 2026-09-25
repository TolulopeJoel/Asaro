/**
 * Shape, per style.
 *
 * Cloth is flat and square — but shape stays a theme token rather than a
 * constant, because it is the axis a future style is most likely to move, and
 * a palette swap cannot express it.
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
    /** Gap between stacked cards. */
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
