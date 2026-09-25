/**
 * What Àṣàrò says on the land, and — mostly — when he says nothing.
 *
 * A screen opened repeatedly, so LOW volume per design/ASARO-CHARACTER.md §5:
 * an accent, not a character. He speaks at the two ends and stays out of the
 * middle, because only at the ends has the number stopped being information —
 * everywhere between, the count IS what the screen exists to give.
 *
 * Nothing here comments on what finishing a book means for anybody's standing
 * with Jehovah (§4①). Completing a BOOK is deliberately absent too: the
 * milestone card already does that, at full volume, where it happened.
 */

/** The line under "Your land" when no parcel is selected. */
export function landSubtitle(worked: number, total: number): string {
    if (total <= 0) return 'Every chapter you have planted';

    // Bush, not "0 chapters": leading with a zero makes the screen a report on
    // a shortfall rather than an invitation to start.
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
