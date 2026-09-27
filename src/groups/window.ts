/**
 * When a group is open, in the group's own time zone: Sunday 00:00 to Monday
 * 12:00. `firestore.rules` enforces the same window from server time, so this
 * only decides what to ask for. Pure; `nowMs` is passed in.
 */

/** The window closes at this hour on Monday. */
export const CLOSES_HOUR = 12;

const MINUTE = 60_000;
const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** The device's offset from UTC in minutes, east positive (Lagos is 60). */
export const deviceOffsetMinutes = (date: Date = new Date()) => -date.getTimezoneOffset();

/** Real offsets run from UTC−12 to UTC+14. */
export const isOffset = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= -720 && (n as number) <= 840;

/** `nowMs` as wall-clock time in the zone, read with the UTC getters. */
const zoned = (nowMs: number, offset: number) => new Date(nowMs + offset * MINUTE);

const keyOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Midnight of the zoned day, as a zoned Date. */
const midnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function isOpenAt(nowMs: number, offset: number): boolean {
    const d = zoned(nowMs, offset);
    return d.getUTCDay() === 0 || (d.getUTCDay() === 1 && d.getUTCHours() < CLOSES_HOUR);
}

/** This week's key in the zone: its Monday as `YYYY-MM-DD`. */
export function weekKeyAt(nowMs: number, offset: number): string {
    const d = midnight(zoned(nowMs, offset));
    return keyOf(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY));
}

/** The week the window shows: this one, except on Monday morning, when it is the week that just ended. */
export function reviewKeyAt(nowMs: number, offset: number): string {
    const d = zoned(nowMs, offset);
    const mondayMorning = d.getUTCDay() === 1 && d.getUTCHours() < CLOSES_HOUR;
    return weekKeyAt(mondayMorning ? nowMs - DAY : nowMs, offset);
}

export interface GroupWindow {
    open: boolean;
    /** The week in progress, for the weekday count. */
    weekKey: string;
    /** The week the open window shows. */
    reviewKey: string;
    /** "Open today", "Open until noon", "Opens tomorrow" or "Opens Sunday". */
    label: string;
}

export function groupWindow(nowMs: number, offset: number): GroupWindow {
    const day = zoned(nowMs, offset).getUTCDay();
    const open = isOpenAt(nowMs, offset);
    const label = open
        ? (day === 0 ? 'Open today' : 'Open until noon')
        : (day === 6 ? 'Opens tomorrow' : 'Opens Sunday');
    return { open, weekKey: weekKeyAt(nowMs, offset), reviewKey: reviewKeyAt(nowMs, offset), label };
}

/** The next instant any of `groupWindow`'s fields can change: Sunday 00:00, Monday 00:00 or Monday 12:00. */
export function nextWindowChange(nowMs: number, offset: number): number {
    const now = zoned(nowMs, offset).getTime();
    const start = midnight(zoned(nowMs, offset)).getTime();
    for (let i = 0; i <= 8; i++) {
        const day = new Date(start + i * DAY);
        const marks = day.getUTCDay() === 0 ? [0] : day.getUTCDay() === 1 ? [0, CLOSES_HOUR] : [];
        for (const hour of marks) {
            const at = day.getTime() + hour * 3_600_000;
            if (at > now) return at - offset * MINUTE;
        }
    }
    return nowMs + DAY;
}

/** "UTC+01:00", "UTC−05:30". */
export function offsetLabel(offset: number): string {
    const sign = offset < 0 ? '−' : '+';
    const abs = Math.abs(offset);
    return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
