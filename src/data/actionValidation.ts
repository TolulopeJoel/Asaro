/**
 * An action needs a reason, and it is not a formality. `motivation` is the only
 * place in this schema where somebody writes *why* a thing matters, in their
 * own words — the commitment detector hands it back months later precisely
 * because the resolution is what people remember and the reason is what fades.
 *
 * The bar is PROSE, not characters: a length check passes anything. There is
 * deliberately no minimum length beyond that — a word count is gameable, and
 * calling someone's reason too short is not this app's place.
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
 * What counts as having said why: prose, or a citation. A bare
 * `[[Exodus 20:12]]` counts — for this audience a scripture reference is not a
 * shortcut to the reason, it IS the reason. Only nothing is refused: whitespace
 * or the punctuation left once citations are accounted for.
 *
 * The letter range runs past ASCII on purpose, covering Latin Extended
 * Additional (`ọ`, `ẹ`) as well as the À-ɏ block `themeNames.ts` uses — reasons
 * move between English and Yoruba mid-sentence, and an ASCII-only rule would
 * reject a reason written in someone's own language.
 */
const LETTER = /[a-zA-ZÀ-ɏḀ-ỿ]/;
const CITATION = /\[\[.+?\]\]/;

/** Whether a reason says something — in words, in scripture, or in both. */
export function hasReason(item: ActionLike): boolean {
    const motivation = item.motivation ?? '';
    return CITATION.test(motivation) || LETTER.test(stripReferences(motivation));
}

/**
 * The first action still missing its reason, or null when all have one. Returns
 * the item, not a boolean, so the message can quote it back — asking a question
 * someone can answer instead of sending them hunting for which.
 */
export function firstWithoutReason<T extends ActionLike>(items: T[]): T | null {
    return items.find(item => !isBlank(item) && !hasReason(item)) ?? null;
}
