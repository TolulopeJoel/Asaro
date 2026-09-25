/**
 * How hard Àṣàrò leans on ground that has gone unworked.
 *
 * `design/ASARO-CHARACTER.md`: any surface reacting to absence must follow the
 * softening curve — the longer someone has been away, the gentler he gets.
 * `WelcomeBack` does it in days, `echoesTone` in months, this in seasons. A
 * fallow book is one worked and not come back to, and four months of that is an
 * ordinary way to read a Bible, not a lapse.
 *
 * Headings are labels for what the reader did, never his dialogue, and this is
 * a LOW-volume surface — a permanent header walked past every visit. One dry
 * aside at the loud end, nothing at all by the quiet one.
 */

/** Past this, the ground has been resting long enough that teasing stops being fair. */
const RESTING_DAYS = 240;

/** Past this, it is a return after a long absence and he stands down entirely. */
const NO_RUSH_DAYS = 400;

/**
 * The heading for the fallow group, given the longest-quiet book in it. Keyed
 * on age, not count — counting would lean hardest on the reader who has worked
 * the MOST ground, which is exactly backwards.
 */
export function fallowHeading(quietestDays: number | null): string {
    if (quietestDays !== null && quietestDays >= NO_RUSH_DAYS) {
        // Deliberately the same note as WelcomeBack's 30-day and Echoes'
        // 90-day tiers: one app, not three opinions about an absence.
        return 'Still yours. Nothing here expired';
    }
    if (quietestDays !== null && quietestDays >= RESTING_DAYS) {
        return 'Resting';
    }
    return 'Lying fallow. Very restful';
}
