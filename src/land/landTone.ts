/**
 * What Àṣàrò says on the land, and — mostly — when he says nothing.
 *
 * The land was the app's largest mute surface: a whole screen about the
 * reader's own reading, narrated by nobody. But it is also a screen somebody
 * opens repeatedly, which `design/ASARO-CHARACTER.md` §5 puts at LOW volume —
 * an accent, not a character. A line that performs every visit stops being a
 * voice and becomes furniture, and the surface already has furniture.
 *
 * So he speaks at the two ends and stays out of the middle.
 *
 * At the ends, the number has stopped being information. "0 of 1,189 chapters
 * planted" tells a new reader nothing they cannot see — the field is bare —
 * and "1,189 of 1,189" is not a statistic, it is the end of a very long road.
 * Both are moments. Everywhere between them the count IS the information, and
 * replacing it with a joke would cost the reader the one fact the screen
 * exists to give them.
 *
 * Nothing here says a word about what finishing a book or a Bible means for
 * anybody's standing with Jehovah (§4①). It is ground worked, and that is all
 * this screen has ever known.
 *
 * Completing a BOOK is deliberately absent: the milestone card already does
 * that, at full volume, on the save where it happened. Two surfaces
 * congratulating the same act is how praise stops landing.
 */

/** The line under "Your land" when no parcel is selected. */
export function landSubtitle(worked: number, total: number): string {
    if (total <= 0) return 'Every chapter you have planted';

    /*
     * Bush, not "0 chapters". The count is the least interesting thing about
     * an empty holding, and leading with a zero makes the screen a report on
     * a shortfall rather than an invitation to start.
     */
    if (worked === 0) return 'All of it bush. We start somewhere.';

    /* The whole Bible. He is allowed to be impressed exactly once. */
    if (worked >= total) return 'Every chapter. The whole thing. \u{1F60C}';

    /* Both grouped, or you get "1188 of 1,189" — which reads as a typo. */
    return `${worked.toLocaleString()} of ${total.toLocaleString()} chapters planted`;
}

/** The line when a parcel is tapped, given that book's tally. */
export function parcelLine(
    name: string,
    worked: number,
    total: number,
    lastWorked: string,
): string {
    if (worked === 0) return `${name} — ${total} chapters. Nothing there yet.`;
    if (worked >= total) return `${name} — all ${total}. Finished. \u{1F60C}`;
    return `${name} — ${worked} of ${total}, last ${lastWorked}`;
}
