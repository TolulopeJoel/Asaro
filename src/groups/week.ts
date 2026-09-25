/**
 * When a group opens.
 *
 * A group is a place you visit at the end of the week, never a live feed. A
 * stream you check between meetings runs on comparison, and comparison is a bad
 * engine for somebody's worship.
 *
 * Nothing is secret: the group, its name, its members and the day it opens are
 * always visible. What waits for the end of the week is what everybody has BEEN
 * DOING — the feed and the per-member detail.
 *
 * Notifications are deliberately untouched by this. Somebody finishing a book
 * is news rather than a scoreboard, and that is the channel where other
 * people's reading reaches you day to day.
 *
 * The whole of Sunday, not an hour of it: a window opening at a particular hour
 * is missed by anyone busy that morning.
 *
 * Pure, with `now` passed in — every boundary here is a date boundary and none
 * is testable if the module reads the clock itself.
 */

/** Sunday. `Date.getDay()` numbering, where 0 is Sunday. */
export const REVIEW_DAY = 0;

const DAY_MS = 86_400_000;

export interface ReviewWindow {
    /** Whether the group's activity is visible right now. */
    open: boolean;
    /** Whole days until it next opens. 0 while it is open. */
    daysUntil: number;
    /** The day it opens, for telling the reader. */
    dayName: string;
}

const DAY_NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

/**
 * Whether the group is open, and when it next will be. `openDay` is a parameter
 * rather than module scope so a test can drive every day through it, and so
 * Sunday stays one value rather than an assumption spread through the file.
 */
export function reviewWindow(now: Date, openDay: number = REVIEW_DAY): ReviewWindow {
    const day = now.getDay();
    const open = day === openDay;

    // Whole days, midnight to midnight rather than from the current instant:
    // the reader is being told which day, not how many hours.
    const daysUntil = open ? 0 : (openDay - day + 7) % 7;

    return { open, daysUntil, dayName: DAY_NAMES[openDay] ?? 'Sunday' };
}

/**
 * "Opens Sunday", "Opens tomorrow", "Open today" — phrased around the reader's
 * week rather than as a countdown. A number of days is a wait; a day is a plan.
 */
export function windowLabel(window: ReviewWindow): string {
    if (window.open) return 'Open today';
    if (window.daysUntil === 1) return 'Opens tomorrow';
    return `Opens ${window.dayName}`;
}

/**
 * The seven days the open window reports on, inclusive of the opening day — so
 * Sunday's window covers the Monday before up to and including Sunday. Anything
 * later belongs to next week's, which stops a partial day being called a week.
 */
export function reviewRange(now: Date): { from: Date; to: Date } {
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const from = new Date(to.getTime() - 6 * DAY_MS);
    return { from, to };
}
