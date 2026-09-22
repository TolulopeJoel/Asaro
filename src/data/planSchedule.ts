/**
 * When each outstanding reading comes up next.
 *
 * The plan is 364 readings — 52 weeks of 7 — so it runs one a day. The dates
 * are counted from today down the list of readings you have left: the next one
 * is today, the one after is tomorrow, and so on.
 *
 * That means the schedule re-projects every time you open it. Miss a fortnight
 * and the plan does not greet you with a fortnight of red — the next reading is
 * simply today's, and the rest follow from there. The date is here to tell you
 * what comes next, not to keep score against you.
 */
import { getLocalMidnight } from '../utils/dateUtils';

const DAY_MS = 86400000;

/** The day the `index`-th outstanding reading comes up, at local midnight. */
export function upcomingDate(index: number): Date {
    return new Date(getLocalMidnight().getTime() + index * DAY_MS);
}

/**
 * The `.co-when` label for an outstanding reading, by its place in the queue.
 *
 * Only today is emphasised — it is the one the screen is asking you to do.
 * Everything after it is a plain date, so the column reads as a horizon rather
 * than a list of demands.
 */
export function scheduleLabel(index: number): { text: string; urgent: boolean } {
    if (index === 0) return { text: 'Today', urgent: true };
    if (index === 1) return { text: 'Tomorrow', urgent: false };

    const date = upcomingDate(index);
    if (index < 7) {
        return { text: date.toLocaleDateString('en-US', { weekday: 'short' }), urgent: false };
    }
    return {
        text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        urgent: false,
    };
}
