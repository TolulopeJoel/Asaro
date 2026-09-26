/**
 * The last few periods of a practice, as cells.
 *
 * This exists because a streak alone is a bad witness. It reports one number,
 * and the morning after a broken fortnight that number is zero — true, and a
 * dreadful thing to put in front of someone who kept thirteen of those days.
 * The cells say what actually happened, and on a bad week they show the
 * thirteen rather than the break.
 *
 * So the summary line counts what was kept and never what was missed. "34 of
 * the last 40 days" and "you missed 6" are the same fact and not the same
 * sentence, and only one of them belongs in an app about someone's worship.
 *
 * Nothing here is losable. That is the whole design: a streak can be taken
 * away from you and a record of what you did cannot, so this is the surface
 * that can afford to be shown on the worst day.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Cadence } from '../../data/actionKind';
import { recentPeriods } from '../../data/practiceStreak';
import { getTodayDateString } from '../../utils/dateUtils';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Text } from '../ui';

/*
 * A fortnight of days, or eight weeks. Both are about the same width on a
 * phone, and both are short enough that the reader can still remember the
 * period at the far end — a year of cells is a heat map, which is a different
 * component making a different, much grander claim.
 */
const DAILY_PERIODS = 14;
const WEEKLY_PERIODS = 8;

interface Props {
    completions: string[];
    cadence: Cadence;
    /** Overridable so the row can be rendered at a fixed date in a test. */
    today?: string;
    /** Given, it draws as a card: the practice named over wide cells. */
    title?: string;
}

export function PracticeHistory({ completions, cadence, today = getTodayDateString(), title }: Props) {
    const { colors } = useTheme();

    const count = cadence === 'weekly' ? WEEKLY_PERIODS : DAILY_PERIODS;
    const periods = recentPeriods(completions, cadence, today, count);
    const kept = periods.filter(Boolean).length;

    // Nothing kept in the window is not a finding, it is a new practice or a
    // dormant one. Neither wants a row of empty boxes pointed at it.
    if (kept === 0) return null;

    const unit = cadence === 'weekly' ? 'weeks' : 'days';
    const card = title !== undefined;

    const cells = (
        <View style={[styles.cells, card && styles.cardCells]}>
            {periods.map((wasKept, index) => (
                <View
                    key={index}
                    style={[
                        card ? styles.cardCell : styles.cell,
                        {
                            backgroundColor: wasKept ? colors.accent : card ? colors.background : 'transparent',
                            borderColor: wasKept ? colors.accent : colors.border,
                        },
                    ]}
                />
            ))}
        </View>
    );

    if (!card) {
        return (
            <View style={styles.wrap}>
                {cells}
                <Text variant="meta" tone="tertiary">
                    {`Kept ${kept} of the last ${count} ${unit}`}
                </Text>
            </View>
        );
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.backgroundSubtle, borderBottomColor: colors.border }]}>
            <View style={styles.cardHead}>
                <Text variant="body" style={styles.cardTitle} numberOfLines={2}>{title}</Text>
                <Text variant="meta">{`${kept}/${count}`}</Text>
            </View>
            {cells}
            <Text variant="bodySmall" tone="secondary">
                {`Kept ${kept} of the last ${count} ${unit}`}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.xs },
    cells: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
    /* Square, and the same square the checkboxes use at a smaller size. The
     * cloth motifs are woven blocks, so a row of them reads as of a piece with
     * the rest of the app rather than as a chart dropped into it. */
    cell: { width: 9, height: 9, borderWidth: 1 },

    /* The card: a panel with the heavier lower edge the stat tiles use. */
    card: { padding: Spacing.md + 2, borderBottomWidth: 3, gap: Spacing.sm + 2 },
    cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.md },
    cardTitle: { flex: 1, fontWeight: '600' },
    cardCells: { flexWrap: 'nowrap' },
    cardCell: { flex: 1, height: 16, borderWidth: 1 },
});
