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
 *   **Periods count back from today**, in the same windows `recentPeriods`
 *   draws, so the number and the cells never disagree. Window 0 is the current
 *   period and may still be empty; the streak then counts from window 1.
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
    const days = completions.map(localDate).filter(ms => ms <= todayMs);
    if (days.length === 0) return 0;

    const period = cadence === 'daily' ? 1 : 7;
    const windows = new Set(days.map(ms => Math.floor(daysBetween(todayMs, ms) / period)));

    // The current period is not yet owed, so an empty one starts the count a period back.
    let back = windows.has(0) ? 0 : 1;
    let streak = 0;
    while (windows.has(back)) {
        streak++;
        back++;
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
