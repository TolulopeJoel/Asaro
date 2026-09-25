/**
 * When a group opens.
 *
 * Groups used to be a live feed: open the tab any hour of any day and watch
 * what everybody else is doing. That is the most engaging thing this app
 * could contain and also the most corrosive, because the engagement runs on
 * comparison — and comparison is a bad engine for somebody's worship. Reading
 * more than the person below you on a list is not the point of reading.
 *
 * So the group is a place you visit at the end of the week, not a stream you
 * check between meetings. Nothing about it is hidden in the sense of being
 * secret: the group, its name, its members and the day it opens are all
 * visible always. What waits for the end of the week is what everybody has
 * BEEN DOING — the feed and the per-member detail.
 *
 * Notifications are deliberately untouched by any of this. If somebody in
 * your group finishes a book, you hear about it when it happens, because that
 * is news rather than a scoreboard, and the whole design assumes that is the
 * channel where other people's reading reaches you day to day.
 *
 * Sunday, and all of it. The week in this app culminates at the weekend, and
 * a window that opened at a particular hour would be missed by anyone busy
 * that morning — which, on a Sunday, is most people it is built for.
 *
 * Pure, with `now` passed in. Every boundary here is a date boundary and none
 * of them is testable if the module reads the clock itself.
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
 * Whether the group is open, and when it next will be.
 *
 * `openDay` is a parameter rather than a constant read from module scope so a
 * test can drive every day of the week through it — and so the choice of
 * Sunday stays one value rather than an assumption spread through the file.
 */
export function reviewWindow(now: Date, openDay: number = REVIEW_DAY): ReviewWindow {
    const day = now.getDay();
    const open = day === openDay;

    /*
     * Whole days, counted from local midnight to local midnight rather than
     * from the current instant. "Opens in 2 days" on a Friday evening should
     * not become "opens in 1 day" simply because it is late — the reader is
     * being told which day, not how many hours.
     */
    const daysUntil = open ? 0 : (openDay - day + 7) % 7;

    return { open, daysUntil, dayName: DAY_NAMES[openDay] ?? 'Sunday' };
}

/**
 * "Opens Sunday", "Opens tomorrow", "Open today".
 *
 * Phrased around the reader's week rather than as a countdown. A number of
 * days is a wait; a day of the week is a plan.
 */
export function windowLabel(window: ReviewWindow): string {
    if (window.open) return 'Open today';
    if (window.daysUntil === 1) return 'Opens tomorrow';
    return `Opens ${window.dayName}`;
}

/**
 * The seven days the open window is reporting on.
 *
 * Inclusive of the opening day itself, so Sunday's window covers the Monday
 * before it up to and including Sunday. Anything that arrives later belongs
 * to next week's, which is what keeps a group from showing a partial day and
 * calling it a week.
 */
export function reviewRange(now: Date): { from: Date; to: Date } {
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const from = new Date(to.getTime() - 6 * DAY_MS);
    return { from, to };
}
