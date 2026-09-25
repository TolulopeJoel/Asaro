/**
 * The head of a book's own screen.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { JournalEntry } from '../../data/database';
import { Spacing } from '../../theme/spacing';
import { Text } from '../ui';

/**
 * How many distinct chapters of a book the entries actually cover. Counts the
 * UNION, since entries overlap — summing ranges claims more read than was.
 */
export function coveredChapters(entries: JournalEntry[]): number {
    const seen = new Set<number>();
    for (const entry of entries) {
        const start = entry.chapter_start;
        if (!start) continue;
        const end = entry.chapter_end && entry.chapter_end > start ? entry.chapter_end : start;
        for (let chapter = start; chapter <= end; chapter++) seen.add(chapter);
    }
    return seen.size;
}

export interface BookDetailHeaderProps {
    bookName: string;
    /** Chapters in the book, so the line can read "17 of 50 chapters". */
    totalChapters?: number;
    coveredCount: number;
    entryCount: number;
}

/*
 * Cloth puts the book's name and its stats on the hero band (see the library
 * screen's header zone), so all that is left for the list is the `.cl-label`
 * that opens the run of entries.
 */
export const BookDetailHeader = React.memo((_: BookDetailHeaderProps) => (
    <View style={styles.clothHeader}>
        <Text variant="label">Your entries</Text>
    </View>
));

const styles = StyleSheet.create({
    /** `.cl-body.tight` opens straight onto its label. */
    clothHeader: { paddingTop: Spacing.md },
    /* Its space goes underneath at the top of a screen and above it at the
     * bottom — the gap belongs between the strip and the entries either way. */
    clothStillAheadTop: { paddingTop: Spacing.md, paddingBottom: Spacing.lg },
    clothStillAheadBottom: { paddingTop: Spacing.lg },
    clothStillAheadLabel: { marginBottom: Spacing.sm },
    /** `.cl-panel` holding the chips, wrapped at a 6px gap. */
    clothChipPanel: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs + 2,
        padding: Spacing.layout.cardPadding,
    },
    clothChip: {
        paddingVertical: Spacing.sm - 2,
        paddingHorizontal: Spacing.md - 1,
    },
    clothChipLabel: { fontWeight: '600' },
});

/**
 * Where the strip sits, which depends on how long it is — see `AHEAD_AT_TOP`.
 * It only changes the padding here; the list decides the position.
 */
export type StillAheadPlace = 'top' | 'bottom';

export interface StillAheadProps {
    /** Chapter ranges from the reading plan that this book still has left. */
    ranges: string[];
    place: StillAheadPlace;
}

/**
 * How many readings may sit above the entries before the strip moves down. The
 * real cost is VERTICAL ROWS — chips wrap about five to a row, so ten is two
 * rows and still reads as a heading while seventeen is four and pushes the
 * entries off screen. Counting items is the cheap proxy for measuring them.
 */
export const AHEAD_AT_TOP = 10;

/**
 * "Still ahead" — the plan's remaining readings for this book, as chips. OPENS
 * the screen: it says what to read next, which is the one thing worth seeing
 * before scrolling. As a footer it is unreachable on a book with twenty entries.
 */
export const StillAhead = React.memo(({ ranges, place }: StillAheadProps) => {
    const { colors } = useTheme();
    if (ranges.length === 0) return null;

    /*
     * Cloth gathers the chips into one `.cl-panel` — the chips are ecru
     * cut-outs of the page showing through the panel, which is the same
     * figure/ground move the grid cells make on the chapter picker.
     */
    return (
        <View style={place === 'top' ? styles.clothStillAheadTop : styles.clothStillAheadBottom}>
            <Text variant="label" style={styles.clothStillAheadLabel}>Still ahead</Text>
            <View style={[styles.clothChipPanel, { backgroundColor: colors.backgroundSubtle }]}>
                {ranges.map((range) => (
                    <View key={range} style={[styles.clothChip, { backgroundColor: colors.background }]}>
                        <Text variant="bodySmall" tone="primary" style={styles.clothChipLabel}>{range}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
});

