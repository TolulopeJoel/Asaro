/** Who may start a group. App-enforced by design; see design/GROUPS.md#who-can-start-a-group. Pure. */

import { parseLocalDateTime } from './derive';
import { checkpointItems } from './milestones';
import { weekKey } from './week';

/** A quarter of the plan: the plan's own 25% checkpoint. */
export const CREATE_PLAN_MARK = 25;
export const CREATE_WEEKS = 6;
export const CREATE_GROUP_DAYS = 21;

const DAY = 86_400_000;

export interface EligibilityInput {
    /** Plan items done, counted as the checkpoints count them. */
    planCompleted: number;
    planLength: number;
    /** Local `YYYY-MM-DD` (or SQLite local datetime) of each entry. */
    entryDates: string[];
    /** Earliest `joinedAt` across the reader's current groups, in ms; null when in none. */
    earliestJoinedAt: number | null;
    /** `users/{uid}.canCreateGroups === true`. */
    override: boolean;
    now: number;
}

export interface Progress {
    have: number;
    need: number;
}

export interface Eligibility {
    eligible: boolean;
    readings: Progress;
    weeks: Progress;
    /** Whole weeks in a group, out of three. */
    groupWeeks: Progress & { inGroup: boolean };
}

export function createEligibility(input: EligibilityInput): Eligibility {
    const readings = { have: input.planCompleted, need: checkpointItems(input.planLength, CREATE_PLAN_MARK) };
    const keys = new Set(input.entryDates.flatMap(day => {
        const date = parseLocalDateTime(day);
        return date ? [weekKey(date)] : [];
    }));
    const weeks = { have: keys.size, need: CREATE_WEEKS };
    const days = input.earliestJoinedAt === null ? 0 : Math.max(0, Math.floor((input.now - input.earliestJoinedAt) / DAY));
    const groupWeeks = {
        have: Math.floor(days / 7),
        need: CREATE_GROUP_DAYS / 7,
        inGroup: input.earliestJoinedAt !== null,
    };
    const met = readings.have >= readings.need
        && weeks.have >= weeks.need
        && groupWeeks.inGroup && days >= CREATE_GROUP_DAYS;
    return { eligible: input.override || met, readings, weeks, groupWeeks };
}

/** The same shape, for a reader who is signed out. */
export const signedOutEligibility = (planLength: number): Eligibility => ({
    eligible: false,
    readings: { have: 0, need: checkpointItems(planLength, CREATE_PLAN_MARK) },
    weeks: { have: 0, need: CREATE_WEEKS },
    groupWeeks: { have: 0, need: CREATE_GROUP_DAYS / 7, inGroup: false },
});
