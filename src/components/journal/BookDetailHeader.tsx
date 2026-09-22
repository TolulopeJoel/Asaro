/**
 * The head of a book's own screen, in Colossal.
 *
 * The design's note on this screen is the reason it looks the way it does:
 * there is no single number here worth enlarging, so the book's name takes the
 * colossal slot instead. Everything under it is small — how much of the book
 * you have covered, then the entries themselves.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { JournalEntry } from '../../data/database';
import { FontFamily, Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Text } from '../ui';

const { size, lineHeight, tracking } = Typography;

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

export const BookDetailHeader = React.memo(({
    bookName,
    totalChapters,
    coveredCount,
    entryCount,
}: BookDetailHeaderProps) => {
    const { colors, isLockedIn } = useTheme();

    // Cloth keeps its own header; the breadcrumb row above already names the book.
    if (!isLockedIn) return null;

    const chapters = totalChapters
        ? `${coveredCount} of ${totalChapters} chapters`
        : `${coveredCount} ${coveredCount === 1 ? 'chapter' : 'chapters'}`;
    const entries = `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`;

    return (
        <View style={styles.header}>
            <Text style={[styles.giant, { color: colors.textPrimary }]}>{bookName}</Text>
            <Text variant="label" style={styles.stats}>{`${chapters} · ${entries}`}</Text>
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
            <Text variant="label">Your entries</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    // .co-body's own 26px lead-in, now that the screen starts here.
    header: {
        paddingTop: Spacing.xl + 2,
    },
    giant: {
        fontFamily: FontFamily.monoBlack,
        fontSize: size.giantName,
        lineHeight: lineHeight.giantName,
        letterSpacing: Math.round(size.giantName * tracking.giant[1] * 10) / 10,
    },
    // .co-giantl
    stats: {
        marginTop: Spacing.md + 2,
    },
    // .co-hr
    rule: {
        height: StyleSheet.hairlineWidth,
        marginVertical: Spacing.xl + 2,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs + 2,
        marginTop: Spacing.md,
    },
    chip: {
        paddingVertical: Spacing.sm - 1,
        paddingHorizontal: Spacing.md - 1,
        borderWidth: Spacing.border.hairline,
    },
    /*
     * The mockup sets these chips inline rather than as a class, which is the
     * design saying they belong to this screen. Kept as a local style for the
     * same reason — a one-off is not a system role.
     */
    chipLabel: {
        fontFamily: FontFamily.monoBold,
        fontSize: size.sm,
        lineHeight: lineHeight.sm,
    },
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
    const { colors, isLockedIn } = useTheme();
    if (!isLockedIn || ranges.length === 0) return null;

    return (
        <View>
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
            <Text variant="label">Still ahead</Text>
            <View style={styles.chips}>
                {ranges.map((range) => (
                    <View
                        key={range}
                        style={[
                            styles.chip,
                            { backgroundColor: colors.backgroundElevated, borderColor: colors.border },
                        ]}
                    >
                        <Text style={[styles.chipLabel, { color: colors.textPrimary }]}>{range}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
});

