/** The reading week: Monday to Sunday, keyed by its Monday's local date. Pure. */

/** Monday-first, so the week ends on Sunday. */
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
