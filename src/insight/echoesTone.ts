/**
 * How hard Àṣàrò leans on an unanswered backlog.
 *
 * `WelcomeBack` established the law this implements: the longer someone has
 * been away, the *gentler* he gets. Three days earns a cheeky "Ehen. You are
 * back."; thirty earns "It has been a while, and that is genuinely fine.
 * Nothing here expired." Guilt is Duolingo's mechanic and this app does not
 * use it.
 *
 * Echoes had no equivalent. Its unanswered heading was fixed at "You've not
 * read these. What are you doing?", which is the right line for someone who
 * ignored a finding last Tuesday and exactly the wrong one for someone opening
 * the Library after two months to a wall of them. Same law, same curve, one
 * surface later.
 *
 * The clock runs in months here, not days, and that is deliberate. Reading is
 * a daily rhythm, so its reminders escalate within a single day. A convergence
 * is rare by construction — the detector wants four entries across at least
 * forty-five days and offers at most three candidates — so a finding sitting
 * unanswered for a fortnight is ordinary life, not avoidance. Leaning on
 * someone at that point would be inventing a lapse out of a slow feature.
 */

/** Past this, the backlog is old enough that the challenge stops being fair. */
const WAITING_DAYS = 30;

/** Past this, it is a return after a long absence and he stands down entirely. */
const NO_RUSH_DAYS = 90;

const DAY_MS = 86_400_000;

export interface OpenSection {
    title: string;
    /**
     * Whether to show even when unanswered is the only group.
     *
     * Echoes hides its headings when there is just one group, so a reader with
     * three findings sees a list rather than a taxonomy they did not ask for.
     * The softest tier overrides that, because at that point the heading has
     * stopped being a label and become reassurance — and a wall of findings
     * with nothing said about it is the situation the law exists to soften.
     * The two louder tiers do not override it: a heading that appears only to
     * tell someone off is the pile-on itself.
     */
    showAlone: boolean;
}

/**
 * Days since a finding was first put in front of the reader.
 *
 * `shownAt` falls back to `createdAt` the way the rows themselves do — an
 * observation that exists but has never been surfaced has not been waiting on
 * anybody, so treating its creation as the start of the wait is the reading
 * that cannot accuse someone of ignoring something they were never shown.
 */
export function daysWaiting(shownAt: string | null, createdAt: string, now: number): number | null {
    const raw = shownAt ?? createdAt;
    const at = new Date(raw).getTime();
    if (!Number.isFinite(at)) return null;
    return Math.max(0, Math.floor((now - at) / DAY_MS));
}

/**
 * The heading for the unanswered group, given the oldest wait in it.
 *
 * Oldest rather than the count. Volume is what it feels like, but age is what
 * it means: forty findings can only accumulate over months given how rarely
 * the detector fires, so the oldest one already carries the size of the pile —
 * and counting instead would lean hardest on the reader the app had most to
 * say to, which is precisely backwards.
 */
export function openSection(oldestDays: number | null): OpenSection {
    if (oldestDays !== null && oldestDays >= NO_RUSH_DAYS) {
        /*
         * Deliberately the same note as WelcomeBack's thirty-day tier —
         * "Nothing here expired." Someone coming back after this long should
         * meet one app, not two surfaces with different opinions about
         * whether their absence was a problem.
         */
        return { title: "Nothing here expired. Whenever you're ready", showAlone: true };
    }
    if (oldestDays !== null && oldestDays >= WAITING_DAYS) {
        return { title: 'These have been waiting for you', showAlone: false };
    }
    return { title: "You've not read these. What are you doing?", showAlone: false };
}
