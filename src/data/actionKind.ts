/**
 * What kind of thing an action item is.
 *
 * The entry wizard asks "How can I realistically apply this in my life?" and
 * prompts with "I will…". That invites a commitment about character, and the
 * answers bear it out — "I will be kinder to my parents", "I want to give
 * Jehovah my best", "I want to be quick to follow instructions". Nobody
 * completes those. A journal of forty-six entries produced ten such items and
 * not one was ever ticked, which was never a usage problem: the app was asking
 * a formational question and handing back a checkbox.
 *
 * Three genuinely different things live in this one column:
 *
 *   an **application** is who you are trying to be. It has no end, so it has
 *   no completion. What helps is meeting it again, with the reason you gave.
 *
 *   a **practice** is an application with a rhythm — "three things I'm
 *   grateful for each day", "ten minutes tidying each evening". It completes
 *   per occurrence, which is a log rather than a flag, so streaks and a widget
 *   become possible later.
 *
 *   an **action** is a task with a deadline. It completes once, and only this
 *   kind can meaningfully be overdue.
 *
 * The kind is DERIVED, never asked. A three-way picker in a wizard that
 * already runs five questions deep would be friction on the one surface that
 * was working, and people would classify wrong under it. Instead two optional
 * controls sit beside the motivation, and what the writer supplied decides:
 * a cadence makes it a practice, a date makes it an action, neither leaves it
 * an application. Every existing row has neither, so the whole journal reads
 * as applications — which is what it always was.
 */

/** How often a practice comes round. */
export type Cadence = 'daily' | 'weekly';

export type ActionKind = 'application' | 'practice' | 'action';

export interface KindFields {
    cadence?: Cadence | string | null;
    due_at?: string | null;
}

const CADENCES: Cadence[] = ['daily', 'weekly'];

export function isCadence(value: unknown): value is Cadence {
    return typeof value === 'string' && (CADENCES as string[]).includes(value);
}

/**
 * Derive the kind.
 *
 * Cadence wins over a date. A practice with a first occurrence is still a
 * practice — the date says when it starts, not when it is finished — and
 * reading that pair as a one-off task would quietly retire something the
 * writer meant to keep doing.
 */
export function actionKindOf(item: KindFields): ActionKind {
    if (isCadence(item.cadence)) return 'practice';
    if (item.due_at) return 'action';
    return 'application';
}

/**
 * Whether completion means anything for this kind.
 *
 * Applications answer no. That is the whole correction: an unticked box on
 * "I will be kinder to my parents" is not evidence of anything, and offering
 * the box at all invites the reader to feel they have failed at something the
 * app never had the standing to judge.
 */
export function completes(kind: ActionKind): boolean {
    return kind !== 'application';
}

/** The word the app shows. Singular; callers pluralise. */
export const KIND_LABEL: Record<ActionKind, string> = {
    application: 'Applying',
    practice: 'Practice',
    action: 'Action',
};

export const CADENCE_LABEL: Record<Cadence, string> = {
    daily: 'Every day',
    weekly: 'Every week',
};
