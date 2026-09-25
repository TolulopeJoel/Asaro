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
}

export function PracticeHistory({ completions, cadence, today = getTodayDateString() }: Props) {
    const { colors } = useTheme();

    const count = cadence === 'weekly' ? WEEKLY_PERIODS : DAILY_PERIODS;
    const periods = recentPeriods(completions, cadence, today, count);
    const kept = periods.filter(Boolean).length;

    // Nothing kept in the window is not a finding, it is a new practice or a
    // dormant one. Neither wants a row of empty boxes pointed at it.
    if (kept === 0) return null;

    const unit = cadence === 'weekly' ? 'weeks' : 'days';

    return (
        <View style={styles.wrap}>
            <View style={styles.cells}>
                {periods.map((wasKept, index) => (
                    <View
                        key={index}
                        style={[
                            styles.cell,
                            {
                                backgroundColor: wasKept ? colors.accent : 'transparent',
                                borderColor: wasKept ? colors.accent : colors.border,
                            },
                        ]}
                    />
                ))}
            </View>
            <Text variant="meta" tone="tertiary">
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
});
