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
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6);
    return { from, to };
}

// ─── The reading week ─────────────────────────────────────────────────────────

/** Monday-first, so the week ends on the review day and Sunday sees it whole. */
export function weekdayIndex(date: Date): number {
    return (date.getDay() + 6) % 7;
}

/** The Monday that starts `date`'s week, at local midnight. */
export function weekStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekdayIndex(date));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A week's key: its Monday as a local "YYYY-MM-DD". Keys sort in date order. */
export function weekKey(date: Date): string {
    const d = weekStart(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Only current-format keys count; older "2026-W39" keys read as no week at all. */
export function isWeekKey(key: unknown): key is string {
    return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

const EMPTY_WEEK = () => [false, false, false, false, false, false, false];

/** The stored dots for the week containing `now`, or an empty week. */
export function weekDots(stored: unknown, storedWeek: unknown, now: Date): boolean[] {
    return storedWeek === weekKey(now) && Array.isArray(stored) && stored.length === 7
        ? stored.map(Boolean)
        : EMPTY_WEEK();
}

/**
 * The dots after reading on `date`, or null when a later week is already
 * stored — an older activity must not wipe the current week.
 */
export function markWeekDay(
    stored: unknown,
    storedWeek: unknown,
    date: Date,
): { weeklyActivity: boolean[]; weeklyActivityWeek: string } | null {
    const key = weekKey(date);
    if (isWeekKey(storedWeek) && storedWeek > key) return null;
    const weeklyActivity = weekDots(stored, storedWeek, date);
    weeklyActivity[weekdayIndex(date)] = true;
    return { weeklyActivity, weeklyActivityWeek: key };
}
