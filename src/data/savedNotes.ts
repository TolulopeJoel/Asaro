/**
 * What Àṣàrò says when an entry is saved and there is no card to show.
 *
 * The save screen is hero, then the observation, then the buttons. On most
 * saves there is no observation — convergence is rare by construction, a
 * commitment needs eight weeks, a study topic three — so the middle of the
 * screen was simply empty. The reader finished writing and the app said
 * nothing at all, at the one moment it could be certain they had done the
 * thing it spends all day asking for.
 *
 * This fills that slot, and ONLY that slot. `design/ASARO-CHARACTER.md` §6
 * warns that pressure applied to a moment of discovery kills it, and a line
 * sitting next to a convergence would be exactly that — two voices competing
 * over one moment. Having no card is the condition, not a coincidence.
 *
 * Low volume, per §5: somebody who journals daily sees this daily, so it is
 * an accent and never a performance. Short, dry, and nothing that reads as a
 * consolation prize for the app not having found anything — he is
 * acknowledging the writing, not apologising for the silence.
 *
 * And nothing here may comment on WHAT was written. The app has not read it,
 * the detectors have not run on it yet, and a line implying otherwise would
 * be the one thing `render.ts` forbids: saying more than the data shows.
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
 * A line, picked by the entry it belongs to.
 *
 * Seeded rather than random, so a re-render cannot change it mid-read — and
 * seeded on the ENTRY rather than the day, so two entries written on the same
 * afternoon do not repeat themselves at each other.
 */
export function savedNote(seed: number | undefined): string {
    if (seed === undefined || !Number.isFinite(seed)) return NOTES[0];
    return NOTES[Math.abs(Math.trunc(seed)) % NOTES.length];
}

/** Exposed for the voice checks. */
export const SAVED_NOTES = NOTES;
