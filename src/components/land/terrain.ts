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
    /** Beyond the holding: the floor the bush grows out of, not the bush. */
    meadow: '#3e4d2f',

    /**
     * The verge past the hedge: low grass with bushes standing in it.
     *
     * An earlier version made the whole strip one tangle, which is
     * undergrowth, not bush. A bush is a THING — a clump, rounded, sitting
     * clear of its neighbours and standing a good bit higher than what grows
     * around it. You can count them. That is why they are built as silhouettes
     * here rather than as strokes: a mound of overlapping lobes with a lit
     * crown on its upper side, and a few twigs breaking its outline so it does
     * not read as a blob.
     *
     * Everything here is darker and cooler than the sward on cleared ground.
     * That contrast is the whole point of the boundary — planted land should
     * read as cultivated the moment it meets what was there before.
     */
    vergeBack: '#41532f',
    vergeTip: '#66814a',

    /*
     * Held deliberately close to the verge around them.
     *
     * The first pass made the mound near-black against the grass, which gave
     * each bush a hard silhouette and turned the border into a row of cut-out
     * stickers — they read as objects placed on the ground rather than as
     * things growing out of it. A bush is the same stuff as the verge, only
     * more of it, so the whole range here sits within a few steps of
     * `vergeBack`: the shape comes from density and the crown, not from
     * contrast.
     *
     * They still stand out where they overhang the FIELD, and that is correct
     * — cleared ground is a different colour, which is the entire point of the
     * boundary.
     */
    bushMass: '#39492a',
    bushCrown: '#4d6435',
    bushTwig: '#57703e',

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
     * upright. Where bush is defined by mass and tangle, this is defined by
     * evenness — which is exactly what makes ground look tended, and what the
     * eye reads as the difference between a field and what surrounds it.
     *
     * Brighter and warmer than the bush, so the boundary carries even where
     * the hedge is thin.
     */
    swardBack: '#4d8a3a',
    swardTip: '#9fd071',

    /** The lit top edge of a parcel. What stops a tile reading as a rectangle. */
    lip: 'rgba(255, 255, 255, 0.2)',

    /** The demarcation between parcels. Must read over earth AND over crop. */
    hedge: '#3b2f1f',
};

/** Stable per-book choice among the earth tones. */
export function mudFor(bookName: string): string {
    let hash = 0;
    for (let index = 0; index < bookName.length; index++) {
        hash = (hash * 31 + bookName.charCodeAt(index)) >>> 0;
    }
    return TERRAIN.mud[hash % TERRAIN.mud.length];
}
