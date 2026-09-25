/**
 * The land: one continuous holding, seen from above.
 *
 * Five earlier versions got this wrong in instructive ways, and every one of
 * the mistakes is easy to make again.
 *
 * A grid of evenly spaced squares is a contribution graph — it says "units of
 * output, logged", where the land has to say "ground you have worked". Giving
 * each book a floating plot with a track of background around it reads as a
 * chart with unusual spacing: sixty-six objects rather than one place. Giving
 * every plot the same height and varying only its width is boxing each book
 * into a rectangle — a big holding is big in both directions. And then the
 * subtlest one: making each book a TIDY rectangle by spreading its remainder
 * across its rows, which keeps the corners square only by making Genesis's
 * beds a different size from Leviticus's.
 *
 * So the grid is uniform and the books take whatever shape their chapters land
 * in. `src/land/plots.ts` does that, and what it leaves for this file is:
 *
 *   **One cell is one chapter, everywhere.** The same square in Obadiah as in
 *   Psalms, about thirty points on a side, so finishing a chapter tonight
 *   fills in something the reader can actually see arrive. That is the whole
 *   requirement the map exists to meet.
 *
 *   **Books are outlined, not boxed.** A cell carries a hedge on each side
 *   where its neighbour belongs to another book. The boundary therefore
 *   follows an L or a staircase exactly, because that is the shape a run of
 *   fifty chapters across eleven columns genuinely has.
 *
 *   **Chapters within a book fuse.** No gap between cells of the same book at
 *   all, so a read range runs together into one planted bed rather than into
 *   separate tiles. Since people read in ranges, real reading comes out as
 *   worked ground rather than as confetti.
 *
 *   **Names go on the widest run a book has**, and are dropped where there is
 *   no room. A map does not label a sliver, and a field marked "1The…" is
 *   worse than one marked not at all — tapping it names it.
 *
 * Colour is argued out in `terrain.ts`: earth for a chapter not yet written
 * about, green for one that has been, drying back toward the earth as it ages
 * and never quite arriving. One crop hue at five strengths — two would read as
 * two categories, good and bad, and there is no failure depicted here.
 */

import React, { useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';

import { BookCloth, Tier } from '../../land/cloth';
import { Cell, layoutCells } from '../../land/plots';
import { useTheme } from '../../theme/ThemeContext';
import { Text } from '../ui';
import { TERRAIN, mudFor } from './terrain';
import {
    Speck,
    Sprout,
    blend,
    edgeFringe,
    furrowPath,
    patchPath,
    rgba,
    speckPaths,
    swardPaths,
    vergePaths,
    weather,
} from './texture';

/**
 * How big one chapter wants to be, on a side, in points.
 *
 * A target rather than a fixed size: the field divides its measured width into
 * whole columns, so the cell that actually gets drawn is a little either side
 * of this. It is the most important number in the file — a chapter is a tile
 * the reader should watch fill in, not a mark in a chart, and at seventeen
 * points it was shading. Thirty is about a fingertip.
 *
 * It buys that with scroll: the map is 1,189 of these, so the field runs to
 * roughly four and a half screens. Worth it. A map you pan through reads as
 * territory; a map you cannot find your last chapter on reads as nothing.
 */
const BED_SIZE = 30;

/**
 * The hedge between books.
 *
 * It was 1.5 in near-black, set when book plots were rectangles all of one
 * height and the line was the ONLY thing telling one from the next. It is not
 * any more: plots are irregular now, so Genesis is an L and Mark starts on a
 * step, and the shapes do most of the work the weight used to. A heavy line
 * on top of that reads as a grid drawn over the land rather than as a
 * boundary in it.
 *
 * Still not a hairline. One point is visible in a mockup and gone on a phone,
 * and being able to pick your own block out of sixty-six is why boundaries
 * exist at all.
 */
const HEDGE = 1.2;

/**
 * How the book currently identified is picked out.
 *
 * Its own boundary is recoloured and thickened, and every chapter inside it
 * gets a line too — but a faint one, at about the weight of a plough furrow.
 *
 * The balance is the point. An earlier version drew a full-strength ring
 * inside every cell, which on a fifty-chapter book meant fifty ochre
 * rectangles: an orange grid laid over the land, obliterating the very thing
 * the tap was asking about. Dropping the inner lines entirely fixed that and
 * lost something real — you could see WHICH book was selected but no longer
 * how many chapters it held. Faint keeps both: the outline says which, the
 * furrows say how big, and neither shouts over the ground.
 */
const HEDGE_SELECTED = 2;
const FURROW_SELECTED = 0.75;
const FURROW_SELECTED_ALPHA = 0.42;

/** Cells of unbroken run below which a book carries no name. */
const MIN_NAME_SPAN = 2;

/**
 * How strongly a book's name sits on its ground, bare and full.
 *
 * It fades as the land fills, and it never goes away. Those are two separate
 * decisions and both matter.
 *
 * It fades because a name is worth least where it is needed least. A planted
 * book is already distinct — green among brown, textured among bare — so its
 * label is largely restating what the ground says, and at full strength it is
 * ink sitting on the one part of the map worth looking at. A bare parcel is
 * identical to the forty around it, and the name is the only way in.
 *
 * It never goes away because the name is how the reader FINDS things.
 * Dropping it on completion would un-label exactly the books someone knows
 * best — the ones they are most likely to go looking for — and a map that
 * hides the places you have been is backwards. Quieter, not gone.
 */
const NAME_ON_BARE = 0.62;
const NAME_ON_FULL = 0.3;

/**
 * Strength of the crop per tier, faintest last.
 *
 * `FADE_FLOOR` is the point of the whole array. A chapter worked years ago
 * sits here and goes no lower, because the crop has to stay visibly distinct
 * from the bare earth it is dyed over — `src/land/cloth.ts` exists to
 * guarantee that nothing the reader did ever disappears, and this is the line
 * where that promise is kept or quietly broken by someone reaching for a
 * prettier gradient. It is well clear of zero because green over brown at low
 * strength turns olive fast.
 */
const FADE_FLOOR = 0.34;
const TIER_ALPHA: Record<Exclude<Tier, 0>, number> = {
    1: 1,
    2: 0.78,
    3: 0.6,
    4: 0.46,
    5: FADE_FLOOR,
};

/**
 * The ground colour of one chapter, weathered.
 *
 * Bare earth is the book's own soil; planted ground is crop resolved against
 * that same soil rather than laid over it translucently, so the result is a
 * solid colour that can then be nudged. See `texture.ts` — a translucent fill
 * cannot be weathered, because the nudge would land on whatever is beneath it.
 */
function groundOf(tier: Tier, mud: string, seed: number): string {
    const base = tier === 0 ? mud : blend(TERRAIN.crop, mud, TIER_ALPHA[tier]);
    return weather(base, seed);
}

/** Furrows at a quarter of a cell, so they land on chapter boundaries too. */
const FURROWS_PER_CELL = 4;

/**
 * Blades of sward per planted chapter, and the point at which it thins.
 *
 * Turf wants to be close-set — that evenness is what reads as tended — so
 * this is higher than the verge's blades per clump. A reader who has written
 * about the whole Bible has 1,189 planted cells, though, so past the
 * threshold the sowing drops two blades per cell. Nobody can count blades,
 * and everybody can feel a slow screen.
 */
const SWARD_BLADES = 5;
const SWARD_THIN_ABOVE = 500;

/**
 * The verge around the holding.
 *
 * Deep above and below, slim down the sides. What made an earlier version
 * feel like a box was not that the land had a border — it is that the border
 * was even, and an even border on four sides is a frame around a picture.
 * Wild ground is not evenly distributed: there is a good stretch of it where
 * your holding begins and ends, and a verge where it runs up against the next
 * one's.
 *
 * Slim sides are also what buys the depth at top and bottom. The side strips
 * run the whole height of the map — three thousand points of it — so every
 * point of width there costs roughly ten times what the same point costs
 * above or below.
 */
/* Loose on purpose. This is untended ground: grass that stands in ranks is
 * the one thing the verge must not look like, since evenness is what marks
 * the field as cultivated. */
const VERGE_PITCH = 12;
const PATCH_PITCH = 26;
/*
 * Deeper at the ends than down the flanks. An even border on four sides is a
 * frame around a picture, and the side strips run the whole height of the map
 * — three thousand points of it — so every point of width there costs roughly
 * ten times what the same point costs above or below.
 */
const VERGE_SIDE = 22;
const VERGE_DEPTH = 40;

/**
 * How raggedly the verge eats into the land, and how finely.
 *
 * The answer to a boundary that reads as ruled. Bushes along the edge were
 * tried first and only ever hid the line; this breaks it — and once it did,
 * the bushes had nothing left to do and were removed.
 *
 * `FRINGE_BITE` is the deepest the grass comes in over the crop, and
 * `FRINGE_STEP` is how often the edge changes its mind — small enough to read
 * as rough ground, large enough not to look serrated.
 */
const FRINGE_BITE = 9;
const FRINGE_STEP = 11;


/*
 * The verge is drawn OVER the land, not behind it.
 *
 * It has to be: the fringe cuts an irregular bite out of the field's edge,
 * and the grass then has to cover what it bit off. Non-interactive
 * throughout, so a chapter under the fringe is still tappable — the data is
 * exactly where it was, and only the last few points of the outermost
 * chapters are hidden.
 */

interface ChapterProps {
    cell: Cell;
    size: number;
    ground: string;
    selected: boolean;
    selectionColor: string;
}

/*
 * A plain View, deliberately.
 *
 * There are 1,189 of these. Making each one pressable puts 1,189 touch
 * responders on a single screen, which Android does not enjoy and which buys
 * nothing — every cell of a book does the same thing when tapped. The field
 * takes one press handler instead and works out which cell was hit from the
 * touch coordinates, since the grid is uniform and that is just division.
 */
const Chapter = React.memo(({ cell, size, ground, selected, selectionColor }: ChapterProps) => {
    const edge = selected ? HEDGE_SELECTED : HEDGE;
    const edgeColor = selected ? selectionColor : TERRAIN.hedge;

    /*
     * Inner lines are drawn on the right and bottom only, so two neighbouring
     * chapters share one line rather than stacking two and doubling its
     * weight — the same rule the hedges follow between books.
     */
    const inner = selected ? FURROW_SELECTED : 0;
    const innerColor = rgba(selectionColor, FURROW_SELECTED_ALPHA);

    return (
        <View
            style={[
                styles.cell,
                {
                    left: cell.column * size,
                    top: cell.row * size,
                    width: size,
                    height: size,
                    backgroundColor: ground,
                    /*
                     * The outline. Only the sides facing another book carry a
                     * hedge, which is what lets a boundary follow a staircase
                     * instead of squaring it off.
                     */
                    borderTopWidth: cell.edgeTop ? edge : 0,
                    borderLeftWidth: cell.edgeLeft ? edge : 0,
                    borderRightWidth: cell.edgeRight ? edge : inner,
                    borderBottomWidth: cell.edgeBottom ? edge : inner,
                    borderTopColor: edgeColor,
                    borderLeftColor: edgeColor,
                    borderRightColor: cell.edgeRight ? edgeColor : innerColor,
                    borderBottomColor: cell.edgeBottom ? edgeColor : innerColor,
                },
            ]}
            pointerEvents="none"
        >
            {/*
              * A lit top edge on every chapter. One line, and it is the
              * difference between a flat field of colour and ground with rows
              * in it — it is also what keeps a planted range from fusing into
              * an undifferentiated slab, so a chapter stays countable.
              */}
            <View style={[styles.lip, { backgroundColor: TERRAIN.lip }]} pointerEvents="none" />

        </View>
    );
});
Chapter.displayName = 'Chapter';

export function BibleCloth({
    books,
    selected,
    onBookPress,
}: {
    books: BookCloth[];
    /** Name of the holding currently identified, if any. */
    selected?: string | null;
    onBookPress?: (book: BookCloth) => void;
}) {
    /*
     * Measured rather than assumed. The grid divides a real width into whole
     * columns — guessing it would leave a ragged column of meadow down one
     * side of every phone that is not the one it was guessed on.
     */
    const [width, setWidth] = useState(0);
    const onLayout = (event: LayoutChangeEvent) => {
        const measured = event.nativeEvent.layout.width;
        if (measured > 0 && Math.abs(measured - width) > 0.5) setWidth(measured);
    };

    /* The surround: the field plus its verges, measured as one. */
    const [meadow, setMeadow] = useState({ width: 0, height: 0 });
    const onMeadowLayout = (event: LayoutChangeEvent) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        if (Math.abs(w - meadow.width) > 0.5 || Math.abs(h - meadow.height) > 0.5) {
            setMeadow({ width: w, height: h });
        }
    };
    const columns = Math.max(1, Math.floor(width / BED_SIZE));
    const size = width > 0 ? width / columns : 0;
    const { cells, rows, names } = useMemo(
        () => layoutCells(books.map(book => book.total), columns),
        [books, columns],
    );

    /*
     * Which book owns each grid position, so a touch can be resolved without
     * asking 1,189 views which of them was hit.
     */
    /*
     * Where the last row runs out.
     *
     * 1,189 chapters in rows of eleven leaves ten empty cells at the end, and
     * the field's rectangle covers them — so without this the holding ends in
     * a hard bar of bare ground sitting inside its own boundary. Everything
     * that grows around the land is told about the step instead.
     */
    const tailCells = cells.length % columns;
    const tail = useMemo(
        () =>
            tailCells === 0 || size <= 0
                ? undefined
                : {
                    fromX: VERGE_SIDE + tailCells * size,
                    fromY: VERGE_DEPTH + (rows - 1) * size,
                },
        [tailCells, size, rows],
    );

    const verge = useMemo(() => {
        /*
         * Sown generously past the field's true edge, because the grass is
         * clipped to the fringe when it is drawn. Sowing only to the boundary
         * would leave the bitten strip as flat colour — a ragged edge made of
         * bare paint, which is worse than a straight one — and sowing to any
         * fixed depth past it puts blades on bare field wherever the bite
         * happened to be shallow. The clip settles both.
         */
        const band = VERGE_SIDE + FRINGE_BITE;
        const bandY = VERGE_DEPTH + FRINGE_BITE;
        /*
         * The land's outline, clockwise, stepping around the empty tail of
         * the last row. A rectangle here is what put a bar of bare ground
         * inside the holding.
         */
        const right = meadow.width - VERGE_SIDE;
        const bottom = meadow.height - VERGE_DEPTH;
        const outline: [number, number][] = tail
            ? [
                [VERGE_SIDE, VERGE_DEPTH],
                [right, VERGE_DEPTH],
                [right, tail.fromY],
                [tail.fromX, tail.fromY],
                [tail.fromX, bottom],
                [VERGE_SIDE, bottom],
            ]
            : [
                [VERGE_SIDE, VERGE_DEPTH],
                [right, VERGE_DEPTH],
                [right, bottom],
                [VERGE_SIDE, bottom],
            ];

        return {
            grass: vergePaths(meadow.width, meadow.height, VERGE_PITCH, band, bandY, tail),
            patches: patchPath(meadow.width, meadow.height, PATCH_PITCH, band, bandY, tail),
            /*
             * The ragged edge, cut where the field actually ends rather than
             * where the grass band does — the band is drawn wider so the
             * grass has something to grow in once the edge has bitten inward.
             */
            fringe: edgeFringe(meadow.width, meadow.height, outline, FRINGE_STEP, FRINGE_BITE),
        };
    }, [meadow.width, meadow.height, tail]);

    const { colors } = useTheme();

    const owner = useMemo(() => {
        const map = new Map<string, number>();
        for (const cell of cells) map.set(`${cell.row}:${cell.column}`, cell.book);
        return map;
    }, [cells]);

    /*
     * The texture, built once per layout rather than per cell.
     *
     * Furrows and specks are two SVG paths covering the whole field. Drawn as
     * views they would be several thousand extra nodes on a screen that
     * already carries twelve hundred; as paths they are two.
     */
    const texture = useMemo(() => {
        if (size <= 0) return null;
        /*
         * Clods go on bare earth only. Planted ground used to get pale flecks
         * as a stand-in for growth; it has actual stems now, and keeping both
         * just put litter under the crop.
         */
        const specks: Speck[] = cells.map(cell => ({
            column: cell.column,
            row: cell.row,
            planted: (books[cell.book].cells[cell.chapter - 1] ?? 0) !== 0,
        }));
        const sprouts: Sprout[] = [];
        for (const cell of cells) {
            const tier = books[cell.book].cells[cell.chapter - 1] ?? 0;
            if (tier !== 0) sprouts.push({ column: cell.column, row: cell.row, tier });
        }

        return {
            furrows: furrowPath(columns * size, rows * size, size / FURROWS_PER_CELL),
            ...speckPaths(specks, size),
            sward: swardPaths(
                sprouts,
                size,
                sprouts.length > SWARD_THIN_ABOVE ? SWARD_BLADES - 2 : SWARD_BLADES,
            ),
        };
    }, [cells, books, columns, rows, size]);

    const onFieldPress = (event: GestureResponderEvent) => {
        if (!onBookPress || size <= 0) return;
        const { locationX, locationY } = event.nativeEvent;
        const column = Math.floor(locationX / size);
        const row = Math.floor(locationY / size);
        const book = owner.get(`${row}:${column}`);
        if (book !== undefined) onBookPress(books[book]);
    };

    /*
     * The holding sits on open country rather than on the page. The band of
     * meadow around it is what turns a rectangle of data into somewhere: land
     * has edges that something continues past, and without the surround the
     * field just stops where the component does.
     */
    return (
        <View
            onLayout={onMeadowLayout}
            style={[styles.meadow, { backgroundColor: TERRAIN.meadow }]}
        >
            {/*
              * Ground mottling, UNDER the land.
              *
              * It was briefly drawn with the rest of the verge, which moved on
              * top of the field when the ragged edge arrived — and a patch is
              * a forty-point round dot in a twenty-two point verge, so every
              * one of them bled a whole chapter of somebody's land. It is
              * texture for the meadow floor and has no business above
              * anything: down here it can be as broad and soft as it likes.
              */}
            {meadow.width > 0 && verge.patches !== '' && (
                <Svg
                    style={StyleSheet.absoluteFill}
                    width={meadow.width}
                    height={meadow.height}
                    pointerEvents="none"
                >
                    <Path
                        d={verge.patches}
                        stroke={TERRAIN.vergeBack}
                        strokeWidth={PATCH_PITCH * 1.6}
                        strokeLinecap="round"
                        strokeOpacity={0.35}
                    />
                </Svg>
            )}

            <Pressable
                onLayout={onLayout}
                onPress={onFieldPress}
                disabled={!onBookPress}
                accessibilityRole={onBookPress ? 'button' : undefined}
                accessibilityLabel="Your land. Tap a field to name it."
                style={[styles.field, { height: rows * size }]}
            >
                {width > 0 &&
                    cells.map(cell => {
                        const book = books[cell.book];
                        return (
                            <Chapter
                                key={`${cell.book}:${cell.chapter}`}
                                cell={cell}
                                size={size}
                                ground={groundOf(
                                    book.cells[cell.chapter - 1] ?? 0,
                                    mudFor(book.name),
                                    cell.row * 8191 + cell.column,
                                )}
                                selected={selected === book.name}
                                selectionColor={colors.accent}
                            />
                        );
                    })}

                {/*
                  * Texture sits above the ground and below the names, so the
                  * weathering reads as part of the field while a book's name
                  * stays legible over it.
                  */}
                {texture && (
                    <Svg
                        style={StyleSheet.absoluteFill}
                        width={columns * size}
                        height={rows * size}
                        pointerEvents="none"
                    >
                        <Path d={texture.furrows} stroke="#000" strokeWidth={1} strokeOpacity={0.07} />
                        <Path
                            d={texture.earth}
                            stroke="#000"
                            strokeWidth={1.6}
                            strokeLinecap="round"
                            strokeOpacity={0.14}
                        />
                        {/*
                          * The sward on cleared ground. Fine, short and close
                          * — everything the verge past the hedge is not, which
                          * is what makes the boundary read as cultivation
                          * rather than as a change of colour.
                          */}
                        <Path
                            d={texture.sward.back}
                            stroke={TERRAIN.swardBack}
                            strokeWidth={1.3}
                            strokeLinecap="round"
                            strokeOpacity={0.9}
                            fill="none"
                        />
                        <Path
                            d={texture.sward.tip}
                            stroke={TERRAIN.swardTip}
                            strokeWidth={1.1}
                            strokeLinecap="round"
                            strokeOpacity={0.9}
                            fill="none"
                        />
                    </Svg>
                )}

                {width > 0 &&
                    names
                        .filter(place => place.span >= MIN_NAME_SPAN)
                        .map(place => {
                            const book = books[place.book];
                            const planted = book.total > 0 ? book.worked / book.total : 0;
                            return (
                                <View
                                    key={place.book}
                                    pointerEvents="none"
                                    style={[
                                        styles.nameBox,
                                        {
                                            left: place.column * size,
                                            top: place.row * size,
                                            width: place.span * size,
                                            height: size,
                                        },
                                    ]}
                                >
                                    <Text
                                        variant="meta"
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.6}
                                        style={[
                                            styles.name,
                                            {
                                                color: TERRAIN.hedge,
                                                opacity:
                                                    NAME_ON_BARE - (NAME_ON_BARE - NAME_ON_FULL) * planted,
                                            },
                                        ]}
                                    >
                                        {book.abbrv}
                                    </Text>
                                </View>
                            );
                        })}
            </Pressable>

            {/*
              * The whole verge, drawn OVER the land.
              *
              * It has to be: the fringe cuts an irregular bite out of the
              * field's edge, and everything that grows in the verge then has
              * to cover what it bit off. Non-interactive throughout, so a
              * chapter under the fringe is still tappable — the data is
              * exactly where it was, only the last few points of the outermost
              * chapters are hidden.
              *
              * Order is the effect: the bite first, then the grass growing
              * in what it took.
              */}
            {meadow.width > 0 && verge.grass.back !== '' && (
                <Svg
                    style={StyleSheet.absoluteFill}
                    width={meadow.width}
                    height={meadow.height}
                    pointerEvents="none"
                >
                    {/*
                      * The grass is CLIPPED to the same shape the fringe cut.
                      *
                      * Clamping where blades may be sown was the obvious fix
                      * and it cannot work: the bite varies along the edge, so
                      * any single limit is either past it somewhere — blades
                      * standing on bare field — or short of it everywhere,
                      * which leaves a bald gap between the grass and the land.
                      * Clipping asks the real question instead: is this point
                      * verge? Blades may then be sown generously past the
                      * boundary, and each one shows exactly as far as the
                      * ground it grows on actually reaches.
                      *
                      */}
                    <Defs>
                        <ClipPath id="verge-ground">
                            <Path d={verge.fringe} clipRule="evenodd" />
                        </ClipPath>
                    </Defs>

                    <Path d={verge.fringe} fill={TERRAIN.meadow} fillRule="evenodd" />

                    <G clipPath="url(#verge-ground)">
                        <Path d={verge.grass.back} stroke={TERRAIN.vergeBack} strokeWidth={1.4} strokeLinecap="round" fill="none" />
                        <Path d={verge.grass.tip} stroke={TERRAIN.vergeTip} strokeWidth={1.2} strokeLinecap="round" fill="none" />
                    </G>
                </Svg>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    meadow: { paddingHorizontal: VERGE_SIDE, paddingVertical: VERGE_DEPTH },
    field: { position: 'relative' },
    cell: { position: 'absolute' },
    lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
    nameBox: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
    /* Opacity is set per book — see NAME_ON_BARE. */
    name: { letterSpacing: 0.4, fontWeight: '700' },
});
