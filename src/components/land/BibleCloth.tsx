/**
 * The land, drawn as farmland seen from above.
 *
 * The first version of this was a grid of evenly spaced squares, which is a
 * contribution graph — and a contribution graph is exactly the wrong object
 * here. It says "units of output, logged", and the whole point of the land is
 * that it says "ground you have worked".
 *
 * Four things do the work of turning one into the other:
 *
 *   **Furrows, not tiles.** Cells are wider than they are tall and there is no
 *   gap between them along a row, so consecutive chapters fuse into one
 *   unbroken bed. Since people read in ranges, a real reader's plot comes out
 *   as long ploughed lines rather than as confetti. The gaps run only BETWEEN
 *   rows, which is where a furrow actually is.
 *
 *   **Parcels of different size and shape.** A book's plot is proportioned
 *   from its chapter count, and each row of the field is packed and then
 *   stretched to fill the width. Psalms is an estate, Obadiah is an allotment,
 *   and the field tiles the way land does instead of marching in a grid.
 *
 *   **Soil, not paper.** An unworked chapter is untilled GROUND, not an empty
 *   box: the plot is filled with earth and the worked parts are dyed over it.
 *   Nothing on this screen is a hole.
 *
 *   **Hedgerows.** A hairline round each parcel, and a path of background
 *   between them. It is what makes sixty-six plots read as a landholding
 *   rather than as a chart with unusual spacing.
 *
 * The ramp stays one hue at five strengths. Two hues would read as two
 * categories — good and bad — and there is no failure being depicted here,
 * only ground worked more and less recently.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCloth, Tier } from '../../land/cloth';
import { ScalePressable } from '../ScalePressable';
import { Spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/ThemeContext';
import { Text } from '../ui';

/** A single bed: wider than tall, so a run of them reads as a ploughed line. */
const BED_HEIGHT = 6;
/** The furrow between beds. The only gap inside a parcel. */
const FURROW = 2;
/** The track between parcels. */
const TRACK = Spacing.xs;

/**
 * Width of a parcel in abstract units before a row is stretched to fit.
 *
 * Square-root rather than linear: Psalms has a hundred and fifty times
 * Obadiah's chapters, and a parcel a hundred and fifty times as wide is not a
 * field, it is a corridor. The root keeps the ordering honest — bigger books
 * really are bigger plots — while holding every one of them on a phone.
 *
 * The floor of three is not aesthetic. It is the narrowest a parcel can be and
 * still carry its own name, and an unlabelled speck is not a plot of land, it
 * is a smudge.
 */
function unitsFor(chapters: number): number {
    return Math.min(14, Math.max(3, Math.ceil(Math.sqrt(chapters * 2))));
}

/**
 * Chapters per bed-row, balanced so the parcel stays a rectangle.
 *
 * Dividing evenly and letting the remainder trail would leave a ragged last
 * row on most books, and a field of parcels with bites out of their corners
 * looks like a rendering bug rather than like land. Spreading the remainder
 * gives rows that differ by one chapter, which shows up as beds of slightly
 * different width — which is what a real ploughed field looks like anyway.
 */
function bedRows(chapters: number, columns: number): number[] {
    const rows = Math.max(1, Math.ceil(chapters / columns));
    const base = Math.floor(chapters / rows);
    const extra = chapters % rows;
    return Array.from({ length: rows }, (_, index) => base + (index < extra ? 1 : 0));
}

/**
 * Opacity per tier, faintest last.
 *
 * `FADE_FLOOR` is the point of the whole array. A chapter worked years ago
 * sits here and goes no lower, because it has to stay visibly distinct from
 * untilled ground — `src/land/cloth.ts` exists to guarantee that nothing the
 * reader did ever disappears, and this is the line where that promise is kept
 * or quietly broken by someone reaching for a prettier gradient. It is higher
 * than it looks like it needs to be because it is dyed over soil rather than
 * over paper, and the soil already carries some of the hue.
 */
const FADE_FLOOR = 0.3;
const TIER_ALPHA: Record<Exclude<Tier, 0>, number> = {
    1: 1,
    2: 0.74,
    3: 0.56,
    4: 0.42,
    5: FADE_FLOOR,
};

/** `#c9762c` at a given strength. The accent is a hex in both themes. */
function tint(hex: string, alpha: number): string {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Parcel({ book, onPress }: { book: BookCloth; onPress?: (book: BookCloth) => void }) {
    const { colors } = useTheme();

    const columns = unitsFor(book.total);
    const rows = bedRows(book.total, columns);

    // Walk the chapters in order, handing each row its slice.
    let cursor = 0;
    const beds = rows.map(count => {
        const slice = book.cells.slice(cursor, cursor + count);
        cursor += count;
        return slice;
    });

    return (
        <ScalePressable
            style={[styles.parcel, { flexGrow: columns, flexBasis: 0 }]}
            onPress={onPress ? () => onPress(book) : undefined}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={`${book.name}, ${book.worked} of ${book.total} chapters`}
        >
            <View
                style={[
                    styles.ground,
                    { backgroundColor: colors.backgroundSubtle, borderColor: colors.border },
                ]}
            >
                {beds.map((bed, rowIndex) => (
                    <View key={rowIndex} style={styles.bedRow}>
                        {bed.map((tier, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.bed,
                                    /*
                                     * Untilled chapters are left transparent so
                                     * the parcel's own soil shows through — the
                                     * ground is continuous under the crop, which
                                     * is what stops an unread book reading as a
                                     * hole in the field.
                                     */
                                    tier !== 0 && { backgroundColor: tint(colors.accent, TIER_ALPHA[tier]) },
                                ]}
                            />
                        ))}
                    </View>
                ))}
            </View>
            {/*
              * Shrink-to-fit rather than truncate. The narrowest parcels are
              * three units wide and some of their names ("1Thess") do not fit
              * at full size — and a plot labelled "1The…" is worse than a plot
              * labelled small.
              */}
            <Text
                variant="meta"
                tone={book.worked === 0 ? 'muted' : 'tertiary'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
            >
                {book.abbrv}
            </Text>
        </ScalePressable>
    );
}

/**
 * Parcels packed into rows of the field.
 *
 * Canonical order is preserved — the holding is still the Bible, and reading
 * it as a map depends on Genesis being where Genesis goes. Rows simply break
 * when the next parcel would not fit, and then stretch, the way strips of land
 * meet a track.
 */
const ROW_UNITS = 30;

function packRows(books: BookCloth[]): BookCloth[][] {
    const rows: BookCloth[][] = [];
    let row: BookCloth[] = [];
    let used = 0;

    for (const book of books) {
        const units = unitsFor(book.total);
        if (row.length > 0 && used + units > ROW_UNITS) {
            rows.push(row);
            row = [];
            used = 0;
        }
        row.push(book);
        used += units;
    }
    if (row.length > 0) rows.push(row);
    return rows;
}

export function BibleCloth({
    books,
    onBookPress,
}: {
    books: BookCloth[];
    onBookPress?: (book: BookCloth) => void;
}) {
    const rows = packRows(books);

    return (
        <View style={styles.field}>
            {rows.map((row, index) => (
                <View key={index} style={styles.fieldRow}>
                    {row.map(book => (
                        <Parcel key={book.name} book={book} onPress={onBookPress} />
                    ))}
                </View>
            ))}
        </View>
    );
}

/** The ramp, spelled out. Without it the fade is just an inconsistency. */
export function ClothLegend() {
    const { colors } = useTheme();
    const tiers: Exclude<Tier, 0>[] = [1, 2, 3, 4, 5];

    return (
        <View style={styles.legend}>
            <Text variant="meta" tone="tertiary">Worked recently</Text>
            <View style={[styles.legendStrip, { borderColor: colors.border, backgroundColor: colors.backgroundSubtle }]}>
                {tiers.map(tier => (
                    <View
                        key={tier}
                        style={[styles.legendBed, { backgroundColor: tint(colors.accent, TIER_ALPHA[tier]) }]}
                    />
                ))}
                {/* Untilled, shown as the parcel soil it actually is. */}
                <View style={styles.legendBed} />
                <View style={styles.legendBed} />
            </View>
            <Text variant="meta" tone="tertiary">Untilled</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    field: { gap: TRACK },
    fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: TRACK },
    parcel: { gap: 2 },
    ground: { borderWidth: 1, padding: 1, gap: FURROW },
    bedRow: { flexDirection: 'row' },
    /* No horizontal gap: adjacent worked chapters must fuse into one bed. */
    bed: { flexGrow: 1, flexBasis: 0, height: BED_HEIGHT },
    legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    legendStrip: { flexDirection: 'row', borderWidth: 1, padding: 1, flex: 1 },
    legendBed: { flexGrow: 1, flexBasis: 0, height: BED_HEIGHT },
});
