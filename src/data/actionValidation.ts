/**
 * An action needs a reason. That is the rule, and it is not a formality.
 *
 * `motivation` is the only place in this schema where somebody writes *why* a
 * thing matters to them, in their own words, unmediated by the passage that
 * prompted it. Everything downstream depends on it: the commitment detector
 * hands it back months later precisely because the resolution is the part
 * people remember and the reason is the part that fades, and a practice
 * without one is a habit tracker rather than something born of a passage.
 *
 * A real journal showed what optional gets you — of ten action items, two had
 * no reason at all and two more held nothing but scripture references. Forty
 * per cent carried nothing to hand back.
 *
 * Which is why the bar is prose, not characters. "[[Exodus 20:12]]" clears any
 * length check and is a pointer, not a reason: it tells you where to look, not
 * what it meant. Deliberately no minimum length beyond that — a word count is
 * gameable and treating someone's reason as too short is not this app's place.
 */

import { stripReferences } from '../utils/reference';

export interface ActionLike {
    action?: string | null;
    motivation?: string | null;
}

/** Whether an item has been written in at all. Blank pairs are simply dropped. */
export function isBlank(item: ActionLike): boolean {
    return !item.action?.trim() && !item.motivation?.trim();
}

/**
 * What counts as having said why.
 *
 * Prose, or a citation. The first draft of this rejected a bare
 * `[[Exodus 20:12]]` on the grounds that a pointer is not a reason — true in
 * general, wrong here. In this app a citation is one tap from the verse, and
 * for this reader a scripture reference is not a shortcut to the reason, it is
 * the reason. Rejecting it would be imposing an idea of explanation the
 * audience does not share.
 *
 * What is still refused is nothing: whitespace, or the punctuation left behind
 * once citations are accounted for. `[[Leviticus 10:1]],[[Leviticus 10:2]]`
 * has two reasons in it; `,` on its own has none.
 *
 * The letter range runs past ASCII on purpose. This writer's reasons move
 * between English and Yoruba mid-sentence — "wọn o ní arojinlẹ rara" — and `ọ`
 * and `ẹ` live in Latin Extended Additional, outside the À-ɏ block that
 * `themeNames.ts` uses. A rule that only counted ASCII letters would reject a
 * reason written in someone's own language, which is the worst way for this
 * check to be wrong.
 */
const LETTER = /[a-zA-ZÀ-ɏḀ-ỿ]/;
const CITATION = /\[\[.+?\]\]/;

/** Whether a reason says something — in words, in scripture, or in both. */
export function hasReason(item: ActionLike): boolean {
    const motivation = item.motivation ?? '';
    return CITATION.test(motivation) || LETTER.test(stripReferences(motivation));
}

/**
 * The first action still missing its reason, or null when all of them have one.
 *
 * Returns the item rather than a boolean so the message can quote it back —
 * "Why does 'I will be kinder to my parents' matter?" asks a question someone
 * can answer, where "an action is missing a motivation" asks them to go
 * hunting for which.
 */
export function firstWithoutReason<T extends ActionLike>(items: T[]): T | null {
    return items.find(item => !isBlank(item) && !hasReason(item)) ?? null;
}
