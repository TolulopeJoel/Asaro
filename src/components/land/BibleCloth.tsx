/**
 * The cloth itself.
 *
 * Sixty-six blocks, one per book, each a grid of chapter cells. It is drawn as
 * adire rather than as a chart because it is one: repeated squares in ochre on
 * ecru is what the Cloth style already is, and a book someone has lived in
 * should look like worked cloth, not like a filled progress bar.
 *
 * Why blocks and not a single 1,189-cell field: the field would be prettier
 * and would say nothing. Broken into books, the negative space is legible —
 * a dense Gospels cluster beside an untouched Chronicles is a portrait of how
 * somebody actually reads, and no two readers produce the same one.
 *
 * The ramp is a single hue at five strengths, never a second colour. Two hues
 * would read as two categories — good and bad, kept and failed — and there is
 * no failure being depicted here. There is only more and less recent.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCloth, Tier } from '../../land/cloth';
import { ScalePressable } from '../ScalePressable';
import { Spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/ThemeContext';
import { Text } from '../ui';

/** Cells across a book block before it wraps to the next row. */
const COLUMNS = 8;
const CELL = 8;
const GAP = 2;

/**
 * Opacity per tier, faintest last.
 *
 * `FADE_FLOOR` is the point of the whole array. A chapter read years ago sits
 * at 0.22 and never goes lower, because it has to stay visibly *worked* — the
 * file this reads from exists to guarantee that nothing the reader did ever
 * disappears, and this is where that promise is either kept or quietly broken
 * by a designer reaching for a prettier gradient.
 */
const FADE_FLOOR = 0.22;
const TIER_ALPHA: Record<Exclude<Tier, 0>, number> = {
    1: 1,
    2: 0.72,
    3: 0.5,
    4: 0.34,
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

function BookBlock({ book, onPress }: { book: BookCloth; onPress?: (book: BookCloth) => void }) {
    const { colors } = useTheme();
    const untouched = book.worked === 0;

    return (
        <ScalePressable
            style={styles.block}
            onPress={onPress ? () => onPress(book) : undefined}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={`${book.name}, ${book.worked} of ${book.total} chapters`}
        >
            <View style={[styles.cells, { width: COLUMNS * CELL + (COLUMNS - 1) * GAP }]}>
                {book.cells.map((tier, index) => (
                    <View
                        key={index}
                        style={[
                            styles.cell,
                            tier === 0
                                ? { backgroundColor: 'transparent', borderColor: colors.borderSubtle }
                                : {
                                    backgroundColor: tint(colors.accent, TIER_ALPHA[tier]),
                                    borderColor: tint(colors.accent, TIER_ALPHA[tier]),
                                },
                        ]}
                    />
                ))}
            </View>
            <Text variant="meta" tone={untouched ? 'muted' : 'tertiary'} numberOfLines={1}>
                {book.abbrv}
            </Text>
        </ScalePressable>
    );
}

export function BibleCloth({
    books,
    onBookPress,
}: {
    books: BookCloth[];
    onBookPress?: (book: BookCloth) => void;
}) {
    return (
        <View style={styles.field}>
            {books.map(book => (
                <BookBlock key={book.name} book={book} onPress={onBookPress} />
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
            <Text variant="meta" tone="tertiary">Recent</Text>
            <View style={styles.legendCells}>
                {tiers.map(tier => (
                    <View
                        key={tier}
                        style={[
                            styles.cell,
                            {
                                backgroundColor: tint(colors.accent, TIER_ALPHA[tier]),
                                borderColor: tint(colors.accent, TIER_ALPHA[tier]),
                            },
                        ]}
                    />
                ))}
                <View style={[styles.cell, styles.legendGap, { borderColor: colors.borderSubtle }]} />
            </View>
            <Text variant="meta" tone="tertiary">Not yet</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    field: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    block: { gap: Spacing.xs },
    cells: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    cell: { width: CELL, height: CELL, borderWidth: 1 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    legendCells: { flexDirection: 'row', gap: GAP, alignItems: 'center' },
    legendGap: { marginLeft: Spacing.xs, backgroundColor: 'transparent' },
});
