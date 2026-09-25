/**
 * What kind of thing an action item is. Three genuinely different things live
 * in one column:
 *
 *   an **application** is who you are trying to be. It has no end, so it has
 *   no completion — what helps is meeting it again, with the reason you gave.
 *
 *   a **practice** is an application with a rhythm ("ten minutes tidying each
 *   evening"). It completes per occurrence, which is a log rather than a flag.
 *
 *   an **action** is a task with a deadline. It completes once, and only this
 *   kind can meaningfully be overdue.
 *
 * The kind is DERIVED, never asked: a three-way picker in a wizard already five
 * questions deep is friction on the one surface that works, and people classify
 * wrong under it. A cadence makes it a practice, a date an action, neither an
 * application.
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
 * Derive the kind. Cadence wins over a date: a practice with a first occurrence
 * is still a practice, since the date says when it starts rather than when it
 * is finished.
 */
export function actionKindOf(item: KindFields): ActionKind {
    if (isCadence(item.cadence)) return 'practice';
    if (item.due_at) return 'action';
    return 'application';
}

/**
 * Whether completion means anything for this kind. Applications answer no: an
 * unticked box on "I will be kinder to my parents" is not evidence of anything,
 * and offering the box invites the reader to feel they failed at something the
 * app has no standing to judge.
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
