/**
 * Ground colours for the land.
 *
 * These are the first colours in the app that are not theme tokens, so the
 * reason has to be good. It is this: every token in `colors.ts` names a ROLE
 * in a document — background, border, accent, danger. The land is not a
 * document. It is a depicted place, and a place needs ground that means
 * "turned earth" and a line that means "hedge", which are not roles any
 * screen full of text has ever needed. Bending `backgroundSubtle` to mean
 * soil would put a mud-coloured token into every card in the app.
 *
 * The metaphor, and it carries the whole screen without a legend:
 *
 *   mud    — a chapter you have not written about. Bare, workable ground.
 *            Not a hole and not a reproach: it is a field waiting.
 *   crop   — a chapter you HAVE written about. Green, because reading is what
 *            makes something grow here. Freshest at full strength.
 *   fade   — the same crop, left alone. It dries back toward the soil it grew
 *            out of and stops short of reaching it, which is the promise in
 *            `src/land/cloth.ts` made visible: nothing you did is ever taken
 *            away, it only stops being recent.
 *   meadow — beyond the holding. Wild grass, duller and bluer than the crop,
 *            so farmed land reads as farmed against it.
 *   hedge  — the line between one book and the next.
 *
 * Note what this frees up: OCHRE IS NO LONGER THE CROP. The accent means one
 * thing across the app — today, emphasis — and on this screen it is spent on
 * the selected parcel rather than on sixty-six fields at once.
 *
 * CLOTH ONLY. The land is not built for Colossal: that style is monochrome by
 * rule, weight carries its whole hierarchy, and a green field would be the
 * loudest thing in it. Rather than ship a grey shadow of this screen, the land
 * is simply a Cloth screen, and these are plain values instead of a palette
 * per style.
 */

export const TERRAIN = {
    /** Beyond the holding: the floor the verge grass grows out of. */
    meadow: '#3e4d2f',

    /**
     * The verge past the hedge: rough, untended grass.
     *
     * It carried bushes for a while — rounded clumps standing along the
     * boundary — and they were removed once the ragged edge existed, because
     * that is what actually stops the boundary reading as a ruled line. The
     * bushes were only ever hiding it.
     *
     * Darker and cooler than the sward on cleared ground. That contrast is
     * the whole point of the boundary: planted land should read as cultivated
     * the moment it meets what was there before.
     */
    vergeBack: '#41532f',
    vergeTip: '#66814a',

    /**
     * Bare earth inside a parcel — three tones, picked per book.
     *
     * A single brown makes sixty-six parcels into one lot with lines ruled on
     * it. Real farmland is a patchwork because neighbouring fields are turned
     * at different times, and three tones is enough to get that: adjacent
     * parcels almost always differ, so each block reads as its own field
     * before the hedge around it is even noticed. Picked by a hash of the
     * book's name, so Leviticus is the same earth every time it is opened —
     * a field that changes colour between visits is not a place.
     */
    mud: ['#8a6a45', '#93724c', '#82633f'] as const,

    /** Growth. Dyed over the mud at the tier's strength. */
    crop: '#5f9e4a',

    /**
     * Grass on cleared, planted ground, in two depths.
     *
     * Turf rather than thicket: short, fine, close-set and near enough
     * upright. Where the verge past the hedge is rough and uneven, this is
     * defined by evenness — which is exactly what makes ground look tended,
     * and what the eye reads as the difference between a field and what
     * surrounds it.
     *
     * Brighter and warmer than the verge, so the boundary carries even where
     * the hedge is thin.
     */
    swardBack: '#4d8a3a',
    swardTip: '#9fd071',

    /** The lit top edge of a parcel. What stops a tile reading as a rectangle. */
    lip: 'rgba(255, 255, 255, 0.2)',

    /**
     * The demarcation between parcels. Must read over earth AND over crop.
     *
     * Lifted off near-black. Against mud at `#8a6a45` the old `#3b2f1f` was a
     * hard, almost-black rule — the strongest mark on a screen whose subject
     * is the ground, not the fences. This is still darker than any soil it
     * crosses, so the boundary holds, but it now reads as a hedge lying on
     * the land rather than as ink drawn over it.
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
