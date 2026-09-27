/** Which group milestones a reader has earned, and which are new. Pure; see design/GROUPS.md#milestones. */

import type { Cadence } from '../data/actionKind';
import { FIRST_FRUIT_STAGE, growthOf } from '../grove/grove';
import { weekKey } from './week';
import type { MilestoneKind } from './model';

export const PLAN_CHECKPOINTS = [25, 50, 75, 100] as const;

const CHECKPOINT_LABEL: Record<number, string> = {
    25: 'A quarter of the reading plan',
    50: 'Halfway through the reading plan',
    75: 'Three quarters of the reading plan',
    100: 'Finished the reading plan',
};

export interface MilestoneInput {
    books: { name: string; worked: number; total: number }[];
    plan: { id: number; section: string }[];
    planDone: Iterable<number>;
    firstEntry: Date | null;
    practices: { itemId: number; cadence: Cadence; kept: number; action: string }[];
    /** Practices shared with the groups: only these are named on a first-fruit milestone. */
    sharedItemIds?: ReadonlySet<number>;
    now: Date;
}

export interface EarnedMilestone {
    key: string;
    kind: MilestoneKind;
    label: string;
}

/** A doc-id-safe key part: "1 John" → "1-john". */
export const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Every milestone the reader holds right now, earned whenever. */
export function earnedMilestones(input: MilestoneInput): EarnedMilestone[] {
    const earned: EarnedMilestone[] = [];

    for (const book of input.books) {
        if (book.total > 0 && book.worked >= book.total) {
            earned.push({ key: `book-${slug(book.name)}`, kind: 'book', label: `Finished ${book.name}` });
        }
    }

    const done = new Set(input.planDone);
    const sections = new Map<string, number[]>();
    for (const item of input.plan) sections.set(item.section, [...(sections.get(item.section) ?? []), item.id]);
    for (const [section, ids] of sections) {
        if (ids.every(id => done.has(id))) {
            earned.push({ key: `section-${slug(section)}`, kind: 'section', label: `Finished ${section}` });
        }
    }

    const planDone = input.plan.filter(item => done.has(item.id)).length;
    const percent = input.plan.length ? (planDone / input.plan.length) * 100 : 0;
    for (const mark of PLAN_CHECKPOINTS) {
        if (percent >= mark) earned.push({ key: `plan-${mark}`, kind: 'plan', label: CHECKPOINT_LABEL[mark] });
    }

    for (const practice of input.practices) {
        if (growthOf(practice.cadence, practice.kept).stage < FIRST_FRUIT_STAGE) continue;
        const named = input.sharedItemIds?.has(practice.itemId) && practice.action.trim();
        earned.push({
            key: `fruit-${practice.itemId}`,
            kind: 'fruit',
            label: named ? `First fruit on “${practice.action.trim()}”` : 'A practice bore its first fruit',
        });
    }

    const first = input.firstEntry;
    if (first && new Date(first.getFullYear() + 1, first.getMonth(), first.getDate()) <= input.now) {
        earned.push({ key: 'year-1', kind: 'year', label: 'One year with Àṣàrò' });
    }

    return earned;
}

/** Keys already dealt with. `at` is when it was earned, or null for one never to be posted. */
export type PostedMilestones = Record<string, { at: number | null; kind: MilestoneKind; label: string }>;

/**
 * The first run records everything already held and posts nothing; later runs
 * post only what is new. Plan checkpoints crossed together post only the highest.
 */
export function nextMilestones(
    posted: PostedMilestones | null,
    earned: EarnedMilestone[],
    now: Date,
): { posted: PostedMilestones; post: EarnedMilestone[] } {
    const next: PostedMilestones = { ...(posted ?? {}) };
    const fresh = earned.filter(m => !(m.key in next));
    const stamp = posted ? now.getTime() : null;
    for (const m of fresh) next[m.key] = { at: stamp, kind: m.kind, label: m.label };
    if (!posted) return { posted: next, post: [] };

    const plans = fresh.filter(m => m.kind === 'plan');
    const top = plans[plans.length - 1];
    for (const m of plans) if (m !== top) next[m.key] = { ...next[m.key], at: null };
    return { posted: next, post: fresh.filter(m => m.kind !== 'plan' || m === top) };
}

/** Milestones posted this week, which a group joined mid-week also gets. */
export function postedInWeek(posted: PostedMilestones, now: Date): EarnedMilestone[] {
    const key = weekKey(now);
    return Object.entries(posted)
        .filter(([, m]) => m.at !== null && weekKey(new Date(m.at)) === key)
        .map(([k, m]) => ({ key: k, kind: m.kind, label: m.label }));
}
