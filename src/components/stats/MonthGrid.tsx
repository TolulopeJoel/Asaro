import { useTheme } from '@/src/theme/ThemeContext';
import { formatDateToLocalString, getLocalMidnight, isSameDay } from '@/src/utils/dateUtils';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '../../theme/spacing';
import { ClothMark } from '../ui/Cloth';
import { Text } from '../ui';

interface MonthGridProps {
    year: number;
    month: number;
    data: Record<string, number>;
    showTitle?: boolean;
    /** Weekday initials over the grid, for a calendar paged a month at a time. */
    weekdays?: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A month, as a shape. No day numbers or per-week celebration — the month reads
 * as a block of marks, and the one number worth reading is stated beside it.
 */
export const MonthGrid = React.memo(({ year, month, data, showTitle = true, weekdays = false }: MonthGridProps) => {
    const { colors } = useTheme();
    const today = getLocalMidnight();

    const days = React.useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();

        const d = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            d.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            d.push(i);
        }
        return d;
    }, [year, month]);

    /*
     * design/all-screens.html #stats, the `.cl` slot: the month as a grid of
     * woven squares. A day you wrote is the resist mark on a hairline square, a
     * day you missed is the bare panel, today is solid indigo, and a day still
     * to come is a dashed outline on the page's own ground. Four states, no day
     * numbers — the count above already says how many.
     */
    return (
        <View style={styles.monthContainer}>
            {showTitle && (
                <Text variant="label" style={styles.monthTitle}>
                    {new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
            )}
            {weekdays && (
                <View style={styles.monthGrid}>
                    {WEEKDAYS.map((letter, index) => (
                        <View key={`wd-${index}`} style={styles.weekday}>
                            <Text variant="meta" tone="secondary">{letter}</Text>
                        </View>
                    ))}
                </View>
            )}
            <View style={styles.monthGrid}>
                {days.map((day, index) => {
                    if (day === null) {
                        return <View key={`pad-${index}`} style={styles.monthCellSpacer} />;
                    }

                    const dayDate = new Date(year, month, day);
                    const isFuture = dayDate.getTime() > today.getTime();
                    const hasEntry = (data[formatDateToLocalString(dayDate)] || 0) > 0;
                    const isToday = isSameDay(dayDate, today);

                    return (
                        <View key={day} style={styles.monthCellWrapper}>
                            <View
                                style={[
                                    styles.monthCell,
                                    isFuture
                                        ? {
                                            backgroundColor: colors.background,
                                            borderWidth: Spacing.border.hairline,
                                            borderColor: colors.border,
                                            borderStyle: 'dashed',
                                        }
                                        : isToday
                                            ? { backgroundColor: colors.textPrimary }
                                            : hasEntry
                                                ? {
                                                    backgroundColor: colors.backgroundSubtle,
                                                    borderWidth: Spacing.border.hairline,
                                                    borderColor: colors.border,
                                                }
                                                : { backgroundColor: colors.backgroundSubtle },
                                ]}
                            >
                                {hasEntry && !isToday && !isFuture && <ClothMark />}
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
});

MonthGrid.displayName = 'MonthGrid';

const styles = StyleSheet.create({
    monthContainer: {
        width: '100%',
        marginBottom: 32,
    },
    monthTitle: { marginBottom: 16 },

    // ── The month as a grid of squares ────────────────────────────────────
    monthGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -3,
    },
    // The 6px gap of the mockup's grid, expressed as a 3px inset on each cell
    // so the seven columns still divide the width exactly.
    weekday: {
        width: `${100 / 7}%`,
        alignItems: 'center',
        paddingBottom: 6,
    },
    monthCellWrapper: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        padding: 3,
    },
    monthCellSpacer: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
    },
    monthCell: { flex: 1, overflow: 'hidden' },
    weekDaysRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    weekDayText: { flex: 1, textAlign: 'center', opacity: 0.4 },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCellWrapper: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        padding: 2,
    },
    dayCellEmpty: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
    },
    dayIndicator: {
        flex: 1,
        width: '100%',
        borderRadius: Spacing.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: 'transparent',
    },
    dayNumber: {
        fontSize: 12,
    },
});