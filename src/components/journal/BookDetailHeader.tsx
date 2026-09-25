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
 * How many distinct chapters of a book the entries actually cover.
 *
 * Entries overlap — two of them can both touch chapter 12 — so this counts the
 * union rather than summing ranges, which would claim more of a book read than
 * has been.
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
    clothStillAhead: { paddingTop: Spacing.lg },
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

export interface StillAheadProps {
    /** Chapter ranges from the reading plan that this book still has left. */
    ranges: string[];
}

/**
 * "Still ahead" — the plan's remaining readings for this book, as chips.
 *
 * It closes the screen on what is left rather than on what is done, which is
 * the same move the Plan tab makes by never showing you a backlog.
 */
export const StillAhead = React.memo(({ ranges }: StillAheadProps) => {
    const { colors } = useTheme();
    if (ranges.length === 0) return null;

    /*
     * Cloth gathers the chips into one `.cl-panel` — the chips are ecru
     * cut-outs of the page showing through the panel, which is the same
     * figure/ground move the grid cells make on the chapter picker.
     */
    return (
        <View style={styles.clothStillAhead}>
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

