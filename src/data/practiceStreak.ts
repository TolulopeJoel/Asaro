/**
 * How long a practice has been kept. Pure — dates in, numbers out, no database
 * and no clock of its own, since a function that reads the clock cannot be
 * tested at the boundary where a streak breaks.
 *
 * A streak exists to encourage, so its failure mode must be generous:
 *
 *   **Today is not yet owed.** A daily practice done yesterday but not yet
 *   today is still live — the day is not over.
 *
 *   **A period lapses only after two.** A weekly practice needs the reader not
 *   to let a fortnight pass, not one completion per calendar week. Anchored
 *   windows would break a streak for doing it late one week and early the next,
 *   enforcing a schedule nobody set. The same rule gives daily its grace day.
 */

import { Cadence } from './actionKind';

/** Local date strings, `YYYY-MM-DD`, as the completions log stores them. */
export type CompletedOn = string;

const DAY_MS = 86_400_000;

/** Parse `YYYY-MM-DD` as a local midnight, not a UTC instant. */
function localDate(value: CompletedOn): number {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1).getTime();
}

/** Whole days between two local dates, ignoring any time component. */
function daysBetween(laterMs: number, earlierMs: number): number {
    return Math.round((laterMs - earlierMs) / DAY_MS);
}

/**
 * How many periods in a row this practice has been kept, counting back. `today`
 * is passed in so the day a streak breaks can be tested.
 */
export function streakOf(
    completions: CompletedOn[],
    cadence: Cadence,
    today: CompletedOn,
): number {
    if (completions.length === 0) return 0;

    const todayMs = localDate(today);

    // Newest first, deduped — the log's primary key should prevent duplicates,
    // but a streak is not the place to discover that it did not.
    const days = [...new Set(completions)]
        .map(localDate)
        .filter(ms => ms <= todayMs)
        .sort((a, b) => b - a);

    if (days.length === 0) return 0;

    const period = cadence === 'daily' ? 1 : 7;

    /*
     * Where the count starts. If the current period has no completion yet, the
     * streak is measured from the previous one rather than broken — the reader
     * still has today, or this week, in front of them.
     */
    const sinceLatest = daysBetween(todayMs, days[0]);
    if (sinceLatest >= period * 2) return 0;

    let streak = 1;
    for (let i = 1; i < days.length; i++) {
        const gap = daysBetween(days[i - 1], days[i]);
        if (gap === 0) continue;
        /*
         * Any gap inside one period is the same period — two completions on
         * consecutive days of a weekly practice are one week kept, not two.
         */
        if (gap < period) continue;
        if (gap <= period * 2 - 1) streak++;
        else break;
    }

    return streak;
}

/**
 * Whether each of the last `count` periods was kept, oldest first — the honest
 * counterweight to the streak, which reads zero the morning after a fortnight
 * breaks and says nothing about the thirteen days kept.
 *
 * Oldest first because it is drawn left to right as time passing, so the last
 * cell is the current period — the only one that can still change.
 */
export function recentPeriods(
    completions: CompletedOn[],
    cadence: Cadence,
    today: CompletedOn,
    count: number,
): boolean[] {
    if (count <= 0) return [];

    const todayMs = localDate(today);
    const period = cadence === 'daily' ? 1 : 7;

    /*
     * Completions as whole days back from today — 0 is today, 1 yesterday.
     * Going through `daysBetween` rather than dividing raw milliseconds is
     * what keeps a DST change from shifting a day into the wrong cell.
     */
    const offsets = new Set(
        completions.map(day => daysBetween(todayMs, localDate(day))).filter(offset => offset >= 0),
    );

    const periods: boolean[] = [];
    for (let index = count - 1; index >= 0; index--) {
        const newest = index * period;
        const oldest = newest + period - 1;
        let kept = false;
        for (const offset of offsets) {
            if (offset >= newest && offset <= oldest) {
                kept = true;
                break;
            }
        }
        periods.push(kept);
    }
    return periods;
}

/** Whether the current period already has a completion. */
export function doneThisPeriod(
    completions: CompletedOn[],
    cadence: Cadence,
    today: CompletedOn,
): boolean {
    if (cadence === 'daily') return completions.includes(today);

    const todayMs = localDate(today);
    return completions.some(day => {
        const gap = daysBetween(todayMs, localDate(day));
        return gap >= 0 && gap < 7;
    });
}
