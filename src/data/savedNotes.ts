/**
 * What Àṣàrò says when an entry is saved and there is no card to show — most
 * saves, since convergence is rare and commitment and study both need weeks.
 *
 * Fills that slot and ONLY that slot. Having no card is the condition, not a
 * coincidence: a line beside a convergence is two voices over one moment, and
 * design/ASARO-CHARACTER.md §6 warns that pressure kills a discovery.
 *
 * Low volume per §5 — somebody who journals daily sees this daily. Short, dry,
 * and never a consolation prize for having found nothing.
 *
 * Nothing here may comment on WHAT was written: the detectors have not run yet,
 * and implying otherwise says more than the data shows.
 */

const NOTES = [
    'Saved. I saw everything you wrote.',
    'Noted. As usual.',
    'Okay o. Today is handled.',
    "Written down. I don't forget these things.",
    'Ehen. That is one more.',
    'Good. We move.',
    'It is in the book now.',
    'Fine. I have no complaints today.',
    'Recorded. I was watching sha.',
    'That is settled then.',
];

/**
 * A line, picked by the entry it belongs to. Seeded rather than random so a
 * re-render cannot change it mid-read, and seeded on the ENTRY rather than the
 * day so two entries written the same afternoon do not repeat themselves.
 */
export function savedNote(seed: number | undefined): string {
    if (seed === undefined || !Number.isFinite(seed)) return NOTES[0];
    return NOTES[Math.abs(Math.trunc(seed)) % NOTES.length];
}

/** Exposed for the voice checks. */
export const SAVED_NOTES = NOTES;
