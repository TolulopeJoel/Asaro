/**
 * Ground colours for the land — the only colours in the app that are not theme
 * tokens. Every token in `colors.ts` names a ROLE in a document; the land is a
 * depicted place, and "turned earth" and "hedge" are not roles a screen full of
 * text has ever needed. Bending `backgroundSubtle` to mean soil would put a
 * mud-coloured token into every card in the app.
 *
 * The metaphor carries the screen without a legend:
 *
 *   mud    — a chapter not yet written about. Bare, workable ground; a field
 *            waiting, not a reproach.
 *   crop   — a chapter that HAS been written about. Freshest at full strength.
 *   fade   — the same crop left alone, drying back toward the soil and stopping
 *            short of reaching it. See `src/land/cloth.ts`.
 *   meadow — beyond the holding. Wild grass, duller and bluer than the crop.
 *   hedge  — the line between one book and the next.
 *
 * The accent is NOT the crop: it means today/emphasis everywhere else, so here
 * it is spent on the selected parcel rather than on sixty-six fields at once.
 *
 * CLOTH ONLY — a monochrome style cannot carry this screen, so these are plain
 * values rather than a palette per style.
 */

export const TERRAIN = {
    /** Beyond the holding: the floor the verge grass grows out of. */
    meadow: '#3e4d2f',

    /**
     * The verge past the hedge: rough, untended grass. Darker and cooler than
     * the sward on cleared ground — that contrast is the boundary, so planted
     * land reads as cultivated the moment it meets what was there before.
     */
    vergeBack: '#41532f',
    vergeTip: '#66814a',

    /**
     * Bare earth inside a parcel — three tones, picked per book. A single brown
     * makes sixty-six parcels one lot with lines ruled on it; three is enough
     * that adjacent parcels almost always differ. Chosen by hash of the book's
     * name, so a field is the same earth every visit.
     */
    mud: ['#8a6a45', '#93724c', '#82633f'] as const,

    /** Growth. Dyed over the mud at the tier's strength. */
    crop: '#5f9e4a',

    /**
     * Grass on cleared, planted ground, in two depths. Turf rather than
     * thicket: short, fine, close-set and near enough upright. Evenness is what
     * makes ground look tended. Brighter and warmer than the verge, so the
     * boundary carries even where the hedge is thin.
     */
    swardBack: '#4d8a3a',
    swardTip: '#9fd071',

    /** The lit top edge of a parcel. What stops a tile reading as a rectangle. */
    lip: 'rgba(255, 255, 255, 0.2)',

    /**
     * The demarcation between parcels. Must read over earth AND over crop, so
     * it stays darker than any soil it crosses — but off near-black, or it
     * becomes the strongest mark on a screen whose subject is the ground.
     */
    hedge: '#4a3b27',
};

/** Stable per-book choice among the earth tones. */
export function mudFor(bookName: string): string {
    let hash = 0;
    for (let index = 0; index < bookName.length; index++) {
        hash = (hash * 31 + bookName.charCodeAt(index)) >>> 0;
    }
    return TERRAIN.mud[hash % TERRAIN.mud.length];
}
