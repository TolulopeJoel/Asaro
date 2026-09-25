/**
 * Which chapters, and optionally which verses.
 *
 * design/all-screens.html #chapters: a six-column grid of cells, a rule, then
 * the verse row. A range is drawn by its two ends — `.co-cell.cap` in ochre —
 * with everything between them filled `.co-cell.on`, so the shape of what you
 * picked is readable at a glance instead of spelled out in a sentence.
 *
 * The verse fields sit under the grid in one row rather than sprouting beside
 * whichever cell you tapped: the old layout reflowed the grid as you typed,
 * which moved the cell you were aiming at.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { BibleBook, getChapterNumbers } from '../data/bibleBooks';
import { ScalePressable } from './ScalePressable';
import { ClothMark } from './ui/Cloth';
import { Text, textStyle } from './ui';

interface ChapterRange {
    start: number;
    end?: number;
}

interface VerseRange {
    start: string;
    end: string;
}

interface ChapterPickerProps {
    selectedBook?: BibleBook;
    selectedChapters?: ChapterRange;
    onChapterSelect: (chapters: ChapterRange) => void;
    allowRange?: boolean;
    onVerseRangeChange?: (verses: VerseRange | null) => void;
}

/** Six to a row, as the mockup's grid-template-columns says. */
const COLUMNS = 6;
const CELL_GAP = 6;

export const ChapterPicker: React.FC<ChapterPickerProps> = React.memo(({
    selectedBook,
    selectedChapters,
    onChapterSelect,
    allowRange = true,
    onVerseRangeChange,
}) => {
    const { colors, style: themeStyle } = useTheme();
    /*
     * Cells are sized in pixels rather than percentages: the grid's gaps are
     * in px, and a percentage width can't subtract them, so six 16.6% cells
     * plus five gaps overflow the row and wrap to five-and-a-bit.
     */
    const [gridWidth, setGridWidth] = useState(0);
    const [readVerses, setReadVerses] = useState(false);
    const [startVerse, setStartVerse] = useState('1');
    const [endVerse, setEndVerse] = useState('');

    useEffect(() => {
        // Reset verse state when chapters change
        setStartVerse('1');
        setEndVerse('');
    }, [selectedChapters]);

    useEffect(() => {
        if (!onVerseRangeChange) return;
        onVerseRangeChange(readVerses ? { start: startVerse, end: endVerse } : null);
    }, [readVerses, startVerse, endVerse, onVerseRangeChange]);

    const chapters = getChapterNumbers(selectedBook?.name || 'Philippians');

    const handleChapterPress = useCallback((chapter: number) => {
        if (!allowRange) {
            onChapterSelect({ start: chapter });
            return;
        }
        if (!selectedChapters || selectedChapters.start === 0) {
            onChapterSelect({ start: chapter });
            return;
        }

        const { start } = selectedChapters;
        const end = selectedChapters.end || start;

        // Tapping inside what's already chosen collapses it to that one chapter;
        // tapping outside it stretches the range to reach.
        if (chapter >= start && chapter <= end) {
            onChapterSelect({ start: chapter });
        } else if (chapter < start) {
            onChapterSelect({ start: chapter, end });
        } else {
            onChapterSelect({ start, end: chapter });
        }
    }, [allowRange, selectedChapters, onChapterSelect]);

    const cellWidth = gridWidth > 0
        ? (gridWidth - CELL_GAP * (COLUMNS - 1)) / COLUMNS
        : undefined;

    const hasSelection = !!selectedChapters && selectedChapters.start > 0;
    const start = selectedChapters?.start ?? 0;
    const end = selectedChapters?.end || start;

    return (
        <View style={styles.container}>
            <View
                style={styles.grid}
                onLayout={e => setGridWidth(e.nativeEvent.layout.width)}
            >
                {chapters.map(chapter => {
                    const selected = hasSelection && chapter >= start && chapter <= end;
                    // The two ends of a range carry the mark; a lone chapter is
                    // both ends at once, so it carries it too.
                    const isCap = selected && (chapter === start || chapter === end);

                    /*
                     * Cloth weaves the interior with the resist mark and caps
                     * the ends in solid indigo — `.cl-cell.on` carries
                     * `--mark-img`, `.cl-cell.cap` is `--deep`. The ends are
                     * the heavy thing.
                     */
                    const capFill = colors.textPrimary;
                    const interiorFill = colors.backgroundSubtle;
                    const woven = selected && !isCap;

                    return (
                        <ScalePressable
                            key={chapter}
                            onPress={() => handleChapterPress(chapter)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            style={[
                                styles.cell,
                                { width: cellWidth, backgroundColor: colors.backgroundElevated, borderColor: colors.border },
                                selected && { backgroundColor: interiorFill, borderColor: woven ? colors.accent : interiorFill },
                                isCap && { backgroundColor: capFill, borderColor: capFill },
                            ]}
                        >
                            {woven && <ClothMark />}
                            <Text
                                variant="cell"
                                style={{
                                    color: isCap
                                        ? colors.textInverse
                                        : woven
                                            ? colors.textPrimary
                                            : selected
                                                ? colors.textInverse
                                                : colors.textSecondary,
                                }}
                            >
                                {chapter}
                            </Text>
                        </ScalePressable>
                    );
                })}
            </View>

            <View style={[styles.rule, { backgroundColor: colors.border }]} />

            {/* ── verses, if you read them ─────────────────────────────────── */}
            <View style={styles.verseToggleRow}>
                <ScalePressable
                    onPress={() => setReadVerses(v => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: readVerses }}
                    hitSlop={Spacing.md}
                    style={[
                        styles.checkbox,
                        readVerses
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : { borderColor: colors.borderStrong },
                    ]}
                >
                    {readVerses && (
                        <Svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={colors.textInverse} strokeWidth="3.6" strokeLinecap="round">
                            <Path d="M5 12l5 5L19 7" />
                        </Svg>
                    )}
                </ScalePressable>
                <Text variant="reference">I read verses</Text>
                {hasSelection && (
                    <ScalePressable
                        onPress={() => onChapterSelect({ start: 0 })}
                        style={styles.clear}
                        accessibilityRole="button"
                        accessibilityLabel="Clear chapter selection"
                    >
                        <Text variant="tab" tone="secondary">Clear</Text>
                    </ScalePressable>
                )}
            </View>

            {readVerses && (
                <View style={styles.verseRow}>
                    <TextInput
                        style={[
                            styles.verseInput,
                            textStyle(themeStyle, 'subtitle'),
                            { backgroundColor: colors.backgroundElevated, borderColor: colors.border, color: colors.textPrimary },
                        ]}
                        value={startVerse}
                        onChangeText={setStartVerse}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Start verse"
                    />
                    <Text variant="body" tone="tertiary">–</Text>
                    <TextInput
                        style={[
                            styles.verseInput,
                            textStyle(themeStyle, 'subtitle'),
                            { backgroundColor: colors.backgroundElevated, borderColor: colors.border, color: colors.textPrimary },
                        ]}
                        value={endVerse}
                        onChangeText={setEndVerse}
                        keyboardType="numeric"
                        placeholder="—"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="End verse"
                    />
                    <Text variant="label">verses</Text>
                </View>
            )}
        </View>
    );
});

ChapterPicker.displayName = 'ChapterPicker';

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CELL_GAP,
    },
    cell: {
        height: Spacing.touchTarget + 2,
        overflow: 'hidden',
        borderWidth: Spacing.border.hairline,
        alignItems: 'center',
        justifyContent: 'center',
    },
    /** `.co-hr` */
    rule: {
        height: Spacing.border.hairline,
        marginVertical: Spacing.xl + 2,
    },
    verseToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    checkbox: {
        width: 17,
        height: 17,
        borderWidth: Spacing.border.hairline,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clear: { marginLeft: 'auto' },
    verseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
    },
    verseInput: {
        width: 80,
        textAlign: 'center',
        borderWidth: Spacing.border.hairline,
        paddingVertical: Spacing.md + 2,
    },
});
