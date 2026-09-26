/**
 * Practices as trees: how far each has grown, how rooted it is, whether it is
 * thirsty or resting, and which tree it grows. Pure — periods in, facts out.
 *
 * A tree grows on periods kept and never shrinks. How rooted it is uses Loop
 * Habit Tracker's exponential smoothing: a kept period pulls it up, a missed one
 * lets it slip a little, and nothing starts it again from nothing.
 */

import type { Cadence } from '../data/actionKind';

export const STAGE_NAMES = [
    'seed', 'sprout', 'seedling', 'shoot', 'sapling',
    'young tree', 'first fruit', 'fruiting tree', 'full tree', 'heavy with fruit',
] as const;

/**
 * Periods kept to reach each stage. The first fruit comes after about a month
 * and more follows at every stage, so keeping a practice pays off while it is
 * still new rather than only after a year.
 */
export const THRESHOLDS: Record<Cadence, number[]> = {
    daily: [0, 1, 3, 7, 14, 21, 30, 50, 75, 100],
    weekly: [0, 1, 2, 3, 4, 5, 6, 9, 13, 18],
};

/** The first stage that bears fruit. */
export const FIRST_FRUIT_STAGE = 6;

/** From this stage on a tree takes its own species' shape; before it, all seedlings look alike. */
export const FIRST_TREE_STAGE = 5;

export const SPECIES = [
    { key: 'olive', name: 'Olive', reference: 'Psalm 52:8' },
    { key: 'fig', name: 'Fig', reference: 'Micah 4:4' },
    { key: 'cedar', name: 'Cedar', reference: 'Psalm 92:12' },
    { key: 'palm', name: 'Date palm', reference: 'Psalm 92:12' },
    { key: 'pomegranate', name: 'Pomegranate', reference: 'Numbers 13:23' },
    { key: 'almond', name: 'Almond', reference: 'Jeremiah 1:11' },
    { key: 'acacia', name: 'Acacia', reference: 'Exodus 25:10' },
    { key: 'mustard', name: 'Mustard', reference: 'Matthew 13:31' },
] as const;

export type SpeciesKey = (typeof SPECIES)[number]['key'];

/** How much one period moves the rooted score. Weekly moves more, having fewer periods. */
const ALPHA: Record<Cadence, number> = { daily: 0.052, weekly: 0.2 };

/**
 * Recent periods that must all be unkept for a tree to look thirsty — the
 * streak's own grace. Daily counts today, which is not owed yet, plus two days;
 * weekly is a fortnight.
 */
const THIRSTY_WINDOW: Record<Cadence, number> = { daily: 3, weekly: 2 };

/** Days untouched before a practice rests in the seed tray. */
export const RESTING_AFTER_DAYS = 30;

export interface Growth {
    stage: number;
    /** Periods kept to reach the next stage, or null at the last. */
    toNext: number | null;
    next: (typeof STAGE_NAMES)[number] | null;
}

export function growthOf(cadence: Cadence, kept: number): Growth {
    const tiers = THRESHOLDS[cadence];
    const stage = tiers.reduce((at, tier, i) => (kept >= tier ? i : at), 0);
    const nextTier = tiers[stage + 1];
    return {
        stage,
        toNext: nextTier === undefined ? null : nextTier - kept,
        next: nextTier === undefined ? null : STAGE_NAMES[stage + 1],
    };
}

/** The rooted score after each period, oldest first, from 0 to 1. */
export function rootedSeries(periods: boolean[], cadence: Cadence): number[] {
    const alpha = ALPHA[cadence];
    let score = 0;
    return periods.map(kept => (score = kept ? (1 - alpha) * score + alpha : (1 - alpha) * score));
}

/**
 * Thirsty: the last few periods went unkept. Judged on neglect, never on the
 * score, which is low for every young practice simply because it is young.
 */
export function isThirsty(periods: boolean[], cadence: Cadence): boolean {
    const window = THIRSTY_WINDOW[cadence];
    if (periods.length <= window) return false;
    return periods.slice(-window).every(kept => !kept);
}

/** Resting: nothing kept for a month, so it waits in the seed tray until kept again. */
export function isResting(daysSinceLastKept: number | null, daysSinceStart: number): boolean {
    if (daysSinceLastKept === null) return daysSinceStart >= RESTING_AFTER_DAYS;
    return daysSinceLastKept >= RESTING_AFTER_DAYS;
}

/**
 * Give each practice a species, keeping every one already given. A new one gets
 * the species no living tree has yet; past eight, the least grown-into.
 */
export function assignSpecies(ids: number[], given: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of ids) if (given[id] !== undefined) out[id] = given[id];
    for (const id of [...ids].sort((a, b) => a - b)) {
        if (out[id] !== undefined) continue;
        const counts = SPECIES.map((_, i) => Object.values(out).filter(s => s === i).length);
        const fewest = Math.min(...counts);
        out[id] = counts.indexOf(fewest);
    }
    return out;
}

/**
 * The stages worth a word when reached. Close together in the first month,
 * when a new practice is most likely to be dropped; spaced out once it holds.
 */
export const MOMENT_STAGES = [1, 3, 4, FIRST_TREE_STAGE, FIRST_FRUIT_STAGE, 7, 8, 9];

export interface GrowthMoment {
    kind: 'stage' | 'back';
    /** The stage reached. For `back`, the stage it stands at. */
    stage: number;
    title: string;
    line: string;
}

const WORDS: Record<number, string> = {
    2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
    13: 'Thirteen', 18: 'Eighteen', 30: 'Thirty', 50: 'Fifty', 75: 'Seventy-five', 100: 'A hundred',
};
/** "Thirty days", "Six weeks" — and a daily week or fortnight said as one. */
const counted = (n: number, cadence: Cadence) => {
    if (cadence === 'daily' && n === 7) return 'A week';
    if (cadence === 'daily' && n === 14) return 'Two weeks';
    return `${WORDS[n] ?? String(n)} ${cadence === 'daily' ? 'days' : 'weeks'}`;
};
const withArticle = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name.toLowerCase()}`;

/**
 * What keeping a practice just did, worth saying: a stage reached, or a thirsty
 * tree kept again. Null when a keep only added a day. Once-ever for stages is
 * the caller's to remember; coming back is worth saying every time it happens.
 */
export function momentOf(
    cadence: Cadence,
    keptBefore: number,
    keptAfter: number,
    species: number,
    wasThirsty: boolean,
): GrowthMoment | null {
    if (keptAfter <= keptBefore) return null;
    const before = growthOf(cadence, keptBefore).stage;
    const after = growthOf(cadence, keptAfter).stage;
    const tiers = THRESHOLDS[cadence];

    if (after > before && MOMENT_STAGES.includes(after)) {
        const span = counted(tiers[after], cadence);
        if (after === 1) return { kind: 'stage', stage: after, title: 'Planted', line: `Planted. Come back ${cadence === 'daily' ? 'tomorrow' : 'next week'} and water it.` };
        if (after === 3) return { kind: 'stage', stage: after, title: 'A shoot', line: `${span}. It has a stem now.` };
        if (after === 4) return { kind: 'stage', stage: after, title: 'A sapling', line: `${span}. It's standing up on its own.` };
        if (after === 7) return { kind: 'stage', stage: after, title: 'Fruiting', line: `${span}. More fruit than last time.` };
        if (after === 8) return { kind: 'stage', stage: after, title: 'A full tree', line: `${span}. A full tree now. It didn't get there by accident.` };
        if (after === FIRST_TREE_STAGE) {
            const name = withArticle(SPECIES[species % SPECIES.length].name);
            return { kind: 'stage', stage: after, title: `It's ${name}`, line: `It's ${name}. It was always going to be.` };
        }
        if (after === FIRST_FRUIT_STAGE) return { kind: 'stage', stage: after, title: 'First fruit', line: `First fruit. ${span} of it. I noticed.` };
        return { kind: 'stage', stage: after, title: 'Heavy with fruit', line: `Heavy with fruit. ${span}, and I watched every one.` };
    }
    if (wasThirsty) return backTo(after);
    return null;
}

/** Coming back says nothing about the gap — the tree lifting is the whole remark. */
export const backTo = (stage: number): GrowthMoment =>
    ({ kind: 'back', stage, title: 'Back to it', line: 'Back to it. It lifts already.' });

/**
 * Days after an anniversary it can still be marked. Past it the moment is
 * history, not news — and without it, every old practice would announce one on
 * its first keep after this shipped.
 */
export const ANNIVERSARY_WINDOW = 14;

/**
 * An anniversary of the practice, if one has just come round: six months, then
 * each year. The tree has stopped growing by then, so these are what a
 * long-kept practice still hears.
 */
export function anniversaryOf(daysSinceStart: number, stage: number): { id: string; moment: GrowthMoment } | null {
    const within = (day: number) => daysSinceStart >= day && daysSinceStart <= day + ANNIVERSARY_WINDOW;
    const years = Math.floor(daysSinceStart / 365);
    if (years >= 1 && within(years * 365)) {
        const line = years === 1
            ? "A year of it. I've stopped counting. I haven't."
            : `${WORDS[years] ?? String(years)} years of it. I was here for all of them.`;
        return { id: `y${years}`, moment: { kind: 'stage', stage, title: years === 1 ? 'A year' : `${years} years`, line } };
    }
    if (within(182)) return { id: 'm6', moment: { kind: 'stage', stage, title: 'Six months', line: "Six months. This one's yours now." } };
    return null;
}

const DAY = 86_400_000;
const dayOf = (value: string) => {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
};

/**
 * Periods kept since the practice began, for growth. Unlike the rolling windows
 * the streak and thirst use, these never move: a day is a day, and a week is a
 * fixed week from the day it began. So a tree only changes when a day is kept
 * or taken back — never because the calendar turned.
 */
export function keptCount(completions: string[], cadence: Cadence, startedOn: string): number {
    const start = dayOf(startedOn);
    const periods = new Set<number>();
    for (const day of completions) {
        const offset = Math.round((dayOf(day) - start) / DAY);
        if (offset < 0) continue;
        periods.add(cadence === 'daily' ? offset : Math.floor(offset / 7));
    }
    return periods.size;
}
