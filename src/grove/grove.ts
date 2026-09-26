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
    'young tree', 'tree', 'full tree', 'mature tree', 'bearing fruit',
] as const;

/** Periods kept to reach each stage. Early stages come fast, the last takes a year. */
export const THRESHOLDS: Record<Cadence, number[]> = {
    daily: [0, 1, 3, 7, 14, 30, 60, 100, 180, 365],
    weekly: [0, 1, 2, 4, 8, 13, 20, 30, 40, 52],
};

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
