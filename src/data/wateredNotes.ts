/**
 * What Àṣàrò says when the last of today's practices is kept. Low volume per
 * design/ASARO-CHARACTER.md §5: someone with several practices may see it
 * daily. About the garden, never the reader's standing — it is watered, that is all.
 */

const NOTES = [
    'All watered for today.',
    "Everything's watered. I'll check again tomorrow.",
    'The whole garden, done. I saw.',
    'Nothing left to water today. I checked twice.',
    'All of them, today. Every one.',
    'Done. The garden can rest now, and so can you.',
    "Every one kept. I'm writing it down.",
    'All watered. See you tomorrow.',
];

/** A line for the day. Seeded on the date, so it holds all day and changes tomorrow. */
export function wateredNote(date: string): string {
    let hash = 0;
    for (const ch of date) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return NOTES[hash % NOTES.length];
}

/** Exposed for the voice checks. */
export const WATERED_NOTES = NOTES;
