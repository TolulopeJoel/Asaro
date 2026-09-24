/**
 * How long a practice has been kept.
 *
 * Pure on purpose — dates in, numbers out, no database and no clock of its
 * own. Streak arithmetic is where this kind of feature quietly goes wrong, and
 * a function that reads the clock itself cannot be tested at a boundary.
 *
 * Two rules shape everything here, and both come from what a streak is FOR.
 * It exists to encourage someone, so its failure mode must be generous: a
 * streak that breaks a few hours early, or that calls a day missed while the
 * reader still has the evening ahead of them, does the opposite of its job.
 *
 *   **Today is not yet owed.** A daily practice done yesterday but not yet
 *   today is still a live streak. The day is not over. Only once yesterday is
 *   also missed has the thread actually been dropped.
 *
 *   **A period lapses only after two.** A weekly practice does not need one
 *   completion in every calendar week — it needs the reader not to let a
 *   fortnight pass. Anchored windows would break a streak for somebody who
 *   did it late one week and early the next, which is enforcing a schedule
 *   they never set. The same rule gives a daily practice its grace day.
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
 * How many periods in a row this practice has been kept, counting back.
 *
 * `today` is passed in so the boundaries can be tested — the day a streak
 * breaks is exactly the case worth pinning, and it is unreachable if the
 * function reads `Date.now()` itself.
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
