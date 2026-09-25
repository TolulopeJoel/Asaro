/**
 * How hard Àṣàrò leans on an unanswered backlog.
 *
 * Implements the same law as `WelcomeBack`: the longer someone has been away,
 * the *gentler* he gets. Guilt is not a mechanic this app uses.
 *
 * The clock runs in months, not days. Reading is a daily rhythm so its
 * reminders escalate within a day, but a convergence is rare by construction —
 * four entries across 45+ days — so a finding unanswered for a fortnight is
 * ordinary life, not avoidance.
 */

/** Past this, the backlog is old enough that the challenge stops being fair. */
const WAITING_DAYS = 30;

/** Past this, it is a return after a long absence and he stands down entirely. */
const NO_RUSH_DAYS = 90;

const DAY_MS = 86_400_000;

export interface OpenSection {
    title: string;
    /**
     * Whether to show even when unanswered is the only group. Echoes otherwise
     * hides headings for a single group. Only the softest tier overrides that,
     * where the heading is reassurance rather than a label — a heading that
     * appears only to tell someone off would be the pile-on itself.
     */
    showAlone: boolean;
}

/**
 * Days since a finding was first put in front of the reader. `shownAt` falls
 * back to `createdAt` so a never-surfaced observation cannot accuse someone of
 * ignoring something they were never shown.
 */
export function daysWaiting(shownAt: string | null, createdAt: string, now: number): number | null {
    const raw = shownAt ?? createdAt;
    const at = new Date(raw).getTime();
    if (!Number.isFinite(at)) return null;
    return Math.max(0, Math.floor((now - at) / DAY_MS));
}

/**
 * The heading for the unanswered group, given the oldest wait in it. Keyed on
 * age, not count: findings only accumulate over months given how rarely
 * detectors fire, so the oldest already carries the size of the pile — and
 * counting would lean hardest on the reader the app had most to say to.
 */
export function openSection(oldestDays: number | null): OpenSection {
    if (oldestDays !== null && oldestDays >= NO_RUSH_DAYS) {
        // Deliberately echoes WelcomeBack's 30-day tier: someone returning
        // should meet one app, not two opinions about their absence.
        return { title: "Nothing here expired. Whenever you're ready", showAlone: true };
    }
    if (oldestDays !== null && oldestDays >= WAITING_DAYS) {
        return { title: 'These have been waiting for you', showAlone: false };
    }
    return { title: "You've not read these. What are you doing?", showAlone: false };
}
