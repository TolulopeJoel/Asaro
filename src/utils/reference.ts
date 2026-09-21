/**
 * Chapter and verse ranges, set the way the design sets them.
 *
 * The mockup writes every range with an en dash — `Genesis 12–15`, `Genesis
 * 8–11`, `Chapters 1–4` — while the reading plan and the database store a
 * plain hyphen. At small sizes the difference is invisible; at Home's 108px
 * giant the hyphen is roughly half the width of the dash the design drew, so
 * the whole numeral line comes up short.
 *
 * This only touches a hyphen sitting between two digits, so book names that
 * legitimately contain one are left alone.
 */
const BETWEEN_DIGITS = /(\d)\s*-\s*(\d)/g;

export function formatRange(reference: string): string {
    return reference.replace(BETWEEN_DIGITS, '$1–$2');
}
