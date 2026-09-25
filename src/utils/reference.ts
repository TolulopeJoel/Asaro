/**
 * Chapter and verse ranges, set the way the design sets them. The mockup writes
 * every range with an en dash while the plan and database store a hyphen — at
 * Home's 108px giant that is half the width the design drew.
 *
 * Only touches a hyphen between two digits, so book names keep theirs.
 */
const BETWEEN_DIGITS = /(\d)\s*-\s*(\d)/g;

export function formatRange(reference: string): string {
    return reference.replace(BETWEEN_DIGITS, '$1\u2013$2');
}

/** A reference inserted into an answer with the `@` picker: `[[Genesis 3:15]]`. */
const INLINE_REFERENCE = /\[\[.+?\]\]/g;

/**
 * Drop inline references from a piece of writing, leaving the writing. For
 * ANALYSIS only — never display, where the markers become tappable links.
 *
 * A citation is the strongest-looking token in a sentence and says the least
 * about the person: two entries citing Genesis look alike to a model whether or
 * not they share a thought, and the passage is usually just that day's reading.
 * Themes built on that describe the plan rather than the reader.
 */
export function stripReferences(text: string): string {
    return text.replace(INLINE_REFERENCE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Keep the reference, lose the brackets: `[[Exodus 20:12]]` becomes
 * `Exodus 20:12`. For plain-text display, where a citation is the opposite of
 * noise and the brackets are the only part nobody meant to write.
 * `HyperlinkedText` renders the markup properly and needs neither.
 */
export function unwrapReferences(text: string): string {
    return text.replace(/\[\[(.+?)\]\]/g, '$1').replace(/\s+/g, ' ').trim();
}

/**
 * Small counts, written out. The mockup says "four chapters selected", never
 * "4 chapters" — a screen that has already enlarged one numeral should not
 * spend a second one counting the first.
 */
const SPELLED = [
    'no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'eleven', 'twelve',
];

export function spell(n: number): string {
    return SPELLED[n] ?? String(n);
}
