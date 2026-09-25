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

import { BookCloth, Tier } from '../../land/cloth';
import { Cell, layoutCells } from '../../land/plots';
import { Spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/ThemeContext';
import { Text } from '../ui';
import { TERRAIN, mudFor } from './terrain';

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
 * Heavier than a hairline on purpose. A one-point line is visible in a mockup
 * and disappears on a phone, and sixty-six holdings with invisible boundaries
 * is one undifferentiated field — being able to pick your own block out of it
 * is the entire reason the boundaries exist.
 */
const HEDGE = 1.5;

/** Cells of unbroken run below which a book carries no name. */
const MIN_NAME_SPAN = 2;

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

/** A hex at a given strength. */
function tint(hex: string, alpha: number): string {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ChapterProps {
    cell: Cell;
    tier: Tier;
    size: number;
    mud: string;
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
const Chapter = React.memo(({ cell, tier, size, mud, selected, selectionColor }: ChapterProps) => {
    return (
        <View
            style={[
                styles.cell,
                {
                    left: cell.column * size,
                    top: cell.row * size,
                    width: size,
                    height: size,
                    backgroundColor: tier === 0 ? mud : tint(TERRAIN.crop, TIER_ALPHA[tier]),
                    /*
                     * The outline. Only the sides facing another book carry a
                     * hedge, which is what lets a boundary follow a staircase
                     * instead of squaring it off.
                     */
                    borderTopWidth: cell.edgeTop ? HEDGE : 0,
                    borderRightWidth: cell.edgeRight ? HEDGE : 0,
                    borderBottomWidth: cell.edgeBottom ? HEDGE : 0,
                    borderLeftWidth: cell.edgeLeft ? HEDGE : 0,
                    borderColor: TERRAIN.hedge,
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

            {selected && (
                <View
                    style={[StyleSheet.absoluteFill, styles.selection, { borderColor: selectionColor }]}
                    pointerEvents="none"
                />
            )}
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

    const { colors } = useTheme();

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
    const owner = useMemo(() => {
        const map = new Map<string, number>();
        for (const cell of cells) map.set(`${cell.row}:${cell.column}`, cell.book);
        return map;
    }, [cells]);

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
        <View style={[styles.meadow, { backgroundColor: TERRAIN.meadow }]}>
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
                                tier={book.cells[cell.chapter - 1] ?? 0}
                                size={size}
                                mud={mudFor(book.name)}
                                selected={selected === book.name}
                                selectionColor={colors.accent}
                            />
                        );
                    })}

                {width > 0 &&
                    names
                        .filter(place => place.span >= MIN_NAME_SPAN)
                        .map(place => (
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
                                    style={[styles.name, { color: TERRAIN.hedge }]}
                                >
                                    {books[place.book].abbrv}
                                </Text>
                            </View>
                        ))}
            </Pressable>
        </View>
    );
}

/** The ramp, spelled out. Without it the fade is just an inconsistency. */
export function ClothLegend() {
    const tiers: Exclude<Tier, 0>[] = [1, 2, 3, 4, 5];

    return (
        <View style={styles.legend}>
            <Text variant="meta" tone="tertiary">Growing</Text>
            <View style={[styles.legendStrip, { borderColor: TERRAIN.hedge, backgroundColor: TERRAIN.mud[0] }]}>
                {tiers.map(tier => (
                    <View
                        key={tier}
                        style={[styles.legendBed, { backgroundColor: tint(TERRAIN.crop, TIER_ALPHA[tier]) }]}
                    />
                ))}
                {/* Bare earth, shown as the soil it actually is. */}
                <View style={styles.legendBed} />
                <View style={styles.legendBed} />
            </View>
            <Text variant="meta" tone="tertiary">Unplanted</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    meadow: { padding: Spacing.md },
    field: { position: 'relative' },
    cell: { position: 'absolute' },
    lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
    nameBox: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
    name: { opacity: 0.6, letterSpacing: 0.4, fontWeight: '700' },
    selection: { borderWidth: 2 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    legendStrip: { flexDirection: 'row', borderWidth: 1, flex: 1, height: 16 },
    legendBed: { flexGrow: 1, flexBasis: 0 },
});
