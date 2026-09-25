/**
 * How hard Àṣàrò leans on ground that has gone unworked.
 *
 * `design/ASARO-CHARACTER.md` states the law outright: **any new surface that
 * reacts to absence must follow the softening curve** — the longer somebody
 * has been away from something, the gentler he gets. `WelcomeBack` implements
 * it in days, `echoesTone` in months. The land's fallow list reacts to absence
 * too and shipped without it, which is how a rule written down in one file
 * stops being true in another.
 *
 * The clock here is slow even by Echoes' standards, and it has to be. A
 * fallow book is one the reader worked and has not come back to; four months
 * of that is a completely ordinary way to read a Bible, not a lapse. Leaning
 * on somebody for it would be inventing a failure out of the fact that
 * Leviticus is finite.
 *
 * Two further rules from the character doc shape the lines themselves.
 *
 * Headings are **labels for what the reader did, not his dialogue** — the
 * first person puts him in the room narrating over your shoulder, which is a
 * notification's privilege. And this is a **low-volume** surface: a permanent
 * section header you walk past every visit, so he is an accent here rather
 * than a character. One dry aside at the loud end, and nothing at all by the
 * quiet one.
 */

/** Past this, the ground has been resting long enough that teasing stops being fair. */
const RESTING_DAYS = 240;

/** Past this, it is a return after a long absence and he stands down entirely. */
const NO_RUSH_DAYS = 400;

/**
 * The heading for the fallow group, given the longest-quiet book in it.
 *
 * Longest rather than the count, for the same reason Echoes uses age: volume
 * is what it feels like, but age is what it means. Counting instead would
 * lean hardest on the reader who has worked the MOST ground, which is exactly
 * backwards.
 */
export function fallowHeading(quietestDays: number | null): string {
    if (quietestDays !== null && quietestDays >= NO_RUSH_DAYS) {
        /*
         * Deliberately the same note as WelcomeBack's thirty-day tier and
         * Echoes' ninety-day one — "Nothing here expired." Somebody coming
         * back after this long should meet one app, not three surfaces with
         * different opinions about whether their absence was a problem.
         */
        return 'Still yours. Nothing here expired';
    }
    if (quietestDays !== null && quietestDays >= RESTING_DAYS) {
        return 'Resting';
    }
    return 'Lying fallow. Very restful';
}
