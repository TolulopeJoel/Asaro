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
    return reference.replace(BETWEEN_DIGITS, '$1\u2013$2');
}

/** A reference inserted into an answer with the `@` picker: `[[Genesis 3:15]]`. */
const INLINE_REFERENCE = /\[\[.+?\]\]/g;

/**
 * Drop inline references from a piece of writing, leaving the writing.
 *
 * For analysis only — never for display, where the markers are what
 * `HyperlinkedText` turns into tappable links.
 *
 * A citation is the strongest-looking token in a sentence and says the least
 * about the person: two entries that both cite Genesis look alike to a model
 * whether or not they have a single thought in common, and the passage cited
 * is usually just whatever was on the reading plan that day. Themes built on
 * that drift back into describing the plan rather than the reader — the exact
 * failure the Themes empty state warns about — so clustering and labelling
 * both read the prose with the citations taken out.
 */
export function stripReferences(text: string): string {
    return text.replace(INLINE_REFERENCE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Keep the reference, lose the brackets: `[[Exodus 20:12]]` becomes
 * `Exodus 20:12`.
 *
 * `stripReferences` exists for the machinery — clustering and word counts,
 * where a citation is noise. This exists for anywhere the text is shown as
 * plain words, where a citation is the opposite of noise and the brackets are
 * the only part nobody meant to write. `HyperlinkedText` renders the markup
 * properly and needs neither; this is for the places that cannot, like a card
 * that quotes one line back.
 */
export function unwrapReferences(text: string): string {
    return text.replace(/\[\[(.+?)\]\]/g, '$1').replace(/\s+/g, ' ').trim();
}

/**
 * Small counts, written out.
 *
 * The mockup says "four chapters selected" and "of five questions", never
 * "4 chapters" — a screen that has already enlarged one numeral shouldn't
 * spend a second one on a count of the first.
 */
const SPELLED = [
    'no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'eleven', 'twelve',
];

export function spell(n: number): string {
    return SPELLED[n] ?? String(n);
}
