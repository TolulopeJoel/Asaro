/**
 * The land: one continuous holding, seen from above. The grid is uniform and
 * books take whatever shape their chapters land in — `src/land/plots.ts` does
 * that layout. Four rules this file implements:
 *
 *   **One cell is one chapter, everywhere.** The same square in Obadiah as in
 *   Psalms, so finishing a chapter fills in something the reader sees arrive.
 *
 *   **Books are outlined, not boxed.** A cell carries a hedge only on sides
 *   facing another book, so a boundary follows an L or a staircase exactly.
 *
 *   **Chapters within a book fuse.** No gap at all, so a read range runs
 *   together into one planted bed rather than into confetti.
 *
 *   **Names go on the widest run a book has**, dropped where there is no room.
 *   A field marked "1The…" is worse than one marked not at all.
 *
 * Colour is argued out in `terrain.ts`. Why the grid is uniform and what the
 * earlier layouts got wrong: design/DECISIONS.md#the-land
 */

import React, { useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';

import { BookCloth, ChapterRef, Tier } from '../../land/cloth';
import { Cell, layoutCells } from '../../land/plots';
import { useTheme } from '../../theme/ThemeContext';
import { Asaro, Text } from '../ui';
import { TERRAIN, mudFor } from './terrain';
import {
    Speck,
    Sprout,
    blend,
    edgeFringe,
    furrowPath,
    patchPath,
    speckPaths,
    swardPaths,
    vergePaths,
    weather,
} from './texture';

/**
 * How big one chapter wants to be, on a side, in points. A target, not a fixed
 * size — the field divides its measured width into whole columns.
 *
 * About a fingertip, and the most important number here: a chapter is a tile
 * the reader watches fill in, not a mark in a chart. It costs scroll (1,189
 * cells is roughly four and a half screens) and that trade is deliberate.
 */
const BED_SIZE = 30;

/**
 * The hedge between books. Light, because the irregular plot shapes already do
 * most of the work of telling one book from the next — a heavier line reads as
 * a grid drawn over the land rather than a boundary in it. Still not a
 * hairline: one point is visible in a mockup and gone on a phone.
 */
const HEDGE = 1.2;

/**
 * How the selected book is picked out: its boundary recoloured and thickened,
 * and every chapter inside given a line at about the weight of a plough furrow.
 *
 * Faint is the point. Full-strength inner lines turn a fifty-chapter book into
 * an orange grid over the land; no inner lines loses how many chapters it
 * holds. The outline says which, the furrows say how big.
 */
const HEDGE_SELECTED = 2;
const FURROW_SELECTED = 0.75;
const FURROW_SELECTED_ALPHA = 0.42;

/** Cells of unbroken run below which a book carries no name. */
const MIN_NAME_SPAN = 2;

/**
 * How strongly a book's name sits on its ground, bare and full. Two separate
 * decisions: it FADES as the land fills, because a planted book is already
 * distinct and the label would be ink on the one part worth looking at; and it
 * NEVER disappears, because dropping it would un-label exactly the books
 * someone knows best and goes looking for. Quieter, not gone.
 */
const NAME_ON_BARE = 0.62;
const NAME_ON_FULL = 0.3;

/**
 * Strength of the crop per tier, faintest last.
 *
 * `FADE_FLOOR` is the point of the array: a chapter worked years ago sits here
 * and goes no lower, so nothing the reader did ever disappears. Well clear of
 * zero because green over brown at low strength turns olive fast. Do not lower
 * it for a prettier gradient — see `src/land/cloth.ts`.
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
 * The ground colour of one chapter, weathered. Crop is resolved against the
 * book's soil rather than laid over it translucently, so the result is solid
 * and can be nudged — a translucent fill cannot be weathered, since the nudge
 * would land on whatever is beneath it.
 */
function groundOf(tier: Tier, mud: string, seed: number): string {
    const base = tier === 0 ? mud : blend(TERRAIN.crop, mud, TIER_ALPHA[tier]);
    return weather(base, seed);
}

/** Furrows at a quarter of a cell, so they land on chapter boundaries too. */
const FURROWS_PER_CELL = 4;

/**
 * Blades of sward per planted chapter, and where it thins. Higher than the
 * verge's blades per clump, because close-set evenness is what reads as
 * tended — but a fully-written Bible is 1,189 planted cells, and nobody can
 * count blades while everybody can feel a slow screen.
 */
const SWARD_BLADES = 5;
const SWARD_THIN_ABOVE = 500;

/**
 * Sowing pitch for the verge. Loose on purpose — this is untended ground, and
 * grass standing in ranks is the one thing it must not look like, since
 * evenness is what marks the field as cultivated.
 */
const VERGE_PITCH = 12;
const PATCH_PITCH = 26;
/**
 * Deep at the ends, slim down the flanks. An even border on four sides is a
 * frame around a picture; wild ground is not evenly distributed. The slim
 * sides also buy the depth — the side strips run the whole height of the map,
 * so a point of width there costs roughly ten times what it costs above.
 */
const VERGE_SIDE = 22;
const VERGE_DEPTH = 40;

/**
 * How raggedly the verge eats into the land, and how finely — the answer to a
 * boundary that reads as ruled. `FRINGE_BITE` is the deepest the grass comes in
 * over the crop; `FRINGE_STEP` is how often the edge changes its mind, small
 * enough to read as rough ground and large enough not to look serrated.
 */
const FRINGE_BITE = 9;
const FRINGE_STEP = 11;

/**
 * Àṣàrò standing where the reader picks up. 48 is the smallest size that keeps
 * his hair, and without the hair the two looks are the same face.
 */
const MARKER_SIZE = 48;

const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;

/**
 * The whole field as a handful of paths: one per ground colour, plus lips,
 * hedges and the selection. One native view per chapter took seconds to mount.
 * Weathering rounds to whole RGB steps, so the colours number in the low
 * hundreds, not 1,189.
 *
 * Every strip sits inside its cell, as a border would, and corners snap to the
 * pixel grid so neighbouring cells share an edge with no seam between them.
 */
function groundPaths(cells: Cell[], books: BookCloth[], size: number, selected: string | null) {
    const fills = new Map<string, string[]>();
    const lips: string[] = [];
    const hedges: string[] = [];
    const chosen: string[] = [];
    const furrows: string[] = [];
    const snap = PixelRatio.roundToNearestPixel;

    for (const cell of cells) {
        const book = books[cell.book];
        const x0 = snap(cell.column * size);
        const y0 = snap(cell.row * size);
        const w = snap((cell.column + 1) * size) - x0;
        const h = snap((cell.row + 1) * size) - y0;

        const colour = groundOf(book.cells[cell.chapter - 1] ?? 0, mudFor(book.name), cell.row * 8191 + cell.column);
        let run = fills.get(colour);
        if (!run) fills.set(colour, (run = []));
        run.push(rect(x0, y0, w, h));

        // Only sides facing another book carry a hedge, which lets a boundary
        // follow a staircase instead of squaring it off.
        const isChosen = book.name === selected;
        const edge = isChosen ? HEDGE_SELECTED : HEDGE;
        const outline = isChosen ? chosen : hedges;
        // Right and bottom only, so neighbouring chapters share one furrow.
        const inner = isChosen ? FURROW_SELECTED : 0;

        const top = cell.edgeTop ? edge : 0;
        const left = cell.edgeLeft ? edge : 0;
        const right = cell.edgeRight ? edge : inner;
        const bottom = cell.edgeBottom ? edge : inner;

        if (top) outline.push(rect(x0, y0, w, top));
        if (left) outline.push(rect(x0, y0, left, h));
        if (right) (cell.edgeRight ? outline : furrows).push(rect(x0 + w - right, y0, right, h));
        if (bottom) (cell.edgeBottom ? outline : furrows).push(rect(x0, y0 + h - bottom, w, bottom));

        // A lit top edge: what keeps a planted range from fusing into a slab,
        // so a chapter stays countable.
        lips.push(rect(x0 + left, y0 + top, w - left - right, 1));
    }

    return {
        fills: [...fills].map(([colour, parts]) => [colour, parts.join('')] as const),
        lips: lips.join(''),
        hedges: hedges.join(''),
        chosen: chosen.join(''),
        furrows: furrows.join(''),
    };
}

export function BibleCloth({
    books,
    selected,
    onBookPress,
    marker,
    onMarkerLayout,
}: {
    books: BookCloth[];
    /** Name of the holding currently identified, if any. */
    selected?: string | null;
    onBookPress?: (book: BookCloth) => void;
    /** The chapter Àṣàrò stands on. */
    marker?: ChapterRef | null;
    /** His offset from the top of the land, once placed. */
    onMarkerLayout?: (y: number) => void;
}) {
    // Measured, not assumed: the grid divides a real width into whole columns,
    // and a guess leaves a ragged strip down the side of every other phone.
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
     * Where the last row runs out. The chapter count rarely divides evenly, and
     * the field's rectangle covers the empty remainder — so without this the
     * holding ends in a hard bar of bare ground inside its own boundary.
     * Everything that grows around the land is told about the step instead.
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
        // Sown generously past the field's true edge, since the grass is
        // clipped to the fringe when drawn. Sowing only to the boundary leaves
        // the bitten strip as flat colour; any fixed depth past it puts blades
        // on bare field where the bite was shallow. The clip settles both.
        const band = VERGE_SIDE + FRINGE_BITE;
        const bandY = VERGE_DEPTH + FRINGE_BITE;
        // Clockwise, stepping around the empty tail of the last row — a plain
        // rectangle here puts a bar of bare ground inside the holding.
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
            // Cut where the field actually ends, not where the grass band
            // does — the band is wider so grass has somewhere to grow once the
            // edge has bitten inward.
            fringe: edgeFringe(meadow.width, meadow.height, outline, FRINGE_STEP, FRINGE_BITE),
        };
    }, [meadow.width, meadow.height, tail]);

    const { colors } = useTheme();

    const owner = useMemo(() => {
        const map = new Map<string, number>();
        for (const cell of cells) map.set(`${cell.row}:${cell.column}`, cell.book);
        return map;
    }, [cells]);

    // Built once per layout, not per cell: furrows and specks are two SVG
    // paths over the whole field, against several thousand extra views.
    const texture = useMemo(() => {
        if (size <= 0) return null;
        // Clods go on bare earth only — planted ground has actual stems, and
        // flecks under the crop just read as litter.
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

    const ground = useMemo(
        () => (size > 0 ? groundPaths(cells, books, size, selected ?? null) : null),
        [cells, books, size, selected],
    );

    const markerCell = useMemo(() => {
        if (!marker) return undefined;
        const book = books.findIndex(b => b.name === marker.bookName);
        return cells.find(cell => cell.book === book && cell.chapter === marker.chapter);
    }, [marker, books, cells]);

    const onFieldPress = (event: GestureResponderEvent) => {
        if (!onBookPress || size <= 0) return;
        const { locationX, locationY } = event.nativeEvent;
        const column = Math.floor(locationX / size);
        const row = Math.floor(locationY / size);
        const book = owner.get(`${row}:${column}`);
        if (book !== undefined) onBookPress(books[book]);
    };

    // The holding sits on open country, not on the page. Land has edges
    // something continues past; without the surround the field just stops.
    return (
        <View
            onLayout={onMeadowLayout}
            style={[styles.meadow, { backgroundColor: TERRAIN.meadow }]}
        >
            {/* Ground mottling, UNDER the land. A patch is a forty-point dot
              * in a twenty-two point verge, so drawn above it would bleed over
              * a chapter of the field. Down here it can be as broad as it
              * likes. */}
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
                {ground && (
                    <Svg
                        style={StyleSheet.absoluteFill}
                        width={columns * size}
                        height={rows * size}
                        pointerEvents="none"
                    >
                        {ground.fills.map(([colour, d]) => (
                            <Path key={colour} d={d} fill={colour} />
                        ))}
                        <Path d={ground.lips} fill={TERRAIN.lip} />
                        <Path d={ground.furrows} fill={colors.accent} fillOpacity={FURROW_SELECTED_ALPHA} />
                        <Path d={ground.hedges} fill={TERRAIN.hedge} />
                        <Path d={ground.chosen} fill={colors.accent} />
                    </Svg>
                )}

                {/* Above the ground, below the names: the weathering reads as
                  * part of the field and a book's name stays legible. */}
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
                        {/* Sward on cleared ground: fine, short and close —
                          * everything the verge is not, which makes the
                          * boundary read as cultivation, not a colour change. */}
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
              * The verge, drawn OVER the land: the fringe bites an irregular
              * piece out of the field's edge and the grass has to cover what it
              * took. Non-interactive throughout, so a chapter under the fringe
              * is still tappable. Order is the effect — bite first, then grass.
              */}
            {meadow.width > 0 && verge.grass.back !== '' && (
                <Svg
                    style={StyleSheet.absoluteFill}
                    width={meadow.width}
                    height={meadow.height}
                    pointerEvents="none"
                >
                    {/*
                      * Grass is CLIPPED to the shape the fringe cut. Clamping
                      * where blades may be sown cannot work: the bite varies
                      * along the edge, so any single limit either strands
                      * blades on bare field or leaves a bald gap. Clipping asks
                      * the real question — is this point verge?
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

            {/* Last, so the verge cannot grow over him on an edge chapter. He
              * stands on the chapter's middle, leaving its lower half showing. */}
            {markerCell && size > 0 && (
                <View
                    pointerEvents="none"
                    onLayout={event => onMarkerLayout?.(event.nativeEvent.layout.y)}
                    style={[
                        styles.marker,
                        {
                            left: VERGE_SIDE + (markerCell.column + 0.5) * size - MARKER_SIZE / 2,
                            top: VERGE_DEPTH + (markerCell.row + 0.5) * size - MARKER_SIZE,
                        },
                    ]}
                >
                    <Asaro size={MARKER_SIZE} action="point" />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    meadow: { paddingHorizontal: VERGE_SIDE, paddingVertical: VERGE_DEPTH },
    field: { position: 'relative' },
    nameBox: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
    marker: { position: 'absolute' },
    /* Opacity is set per book — see NAME_ON_BARE. */
    name: { letterSpacing: 0.4, fontWeight: '700' },
});
