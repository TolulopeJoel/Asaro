import { useTheme } from '@/src/theme/ThemeContext';
import { formatDateToLocalString, getLocalMidnight, isSameDay } from '@/src/utils/dateUtils';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clover } from '../Clover';
import { useFocusEffect } from 'expo-router';

interface MonthGridProps {
    year: number;
    month: number;
    data: Record<string, number>;
    showTitle?: boolean;
}

// One color per day of the week, Sunday → Saturday
const RAINBOW_COLORS = [
    '#FF3B30', // Sun — red
    '#FF9500', // Mon — orange
    '#FFCC00', // Tue — yellow
    '#34C759', // Wed — green
    '#5AC8FA', // Thu — sky blue
    '#5856D6', // Fri — indigo
    '#AF52DE', // Sat — purple
];

export const MonthGrid = React.memo(({ year, month, data, showTitle = true }: MonthGridProps) => {
    const { colors } = useTheme();
    const today = getLocalMidnight();
    const [rotating, setRotating] = useState(false);

    useFocusEffect(
        useCallback(() => {
            setRotating(true);
            return () => setRotating(false);
        }, [])
    );


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

    // Determine which week rows are fully complete (all non-null, non-future days have entries)
    const completeWeekRows = React.useMemo(() => {
        const rows: boolean[] = [];
        for (let rowStart = 0; rowStart < days.length; rowStart += 7) {
            const rowDays = days.slice(rowStart, rowStart + 7);
            const realDays = rowDays.filter(d => d !== null) as number[];

            if (realDays.length === 0) {
                rows.push(false);
                continue;
            }

            const allComplete = realDays.every(d => {
                const dayDate = new Date(year, month, d);
                const isFuture = dayDate.getTime() > today.getTime();
                if (isFuture) return false; // incomplete week if any future days remain
                const dateStr = formatDateToLocalString(dayDate);
                return (data[dateStr] || 0) > 0;
            });

            rows.push(allComplete);
        }
        return rows;
    }, [days, year, month, data, today]);

    const weekDays = React.useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

    return (
        <View style={styles.monthContainer}>
            {showTitle && (
                <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>
                    {new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
            )}

            <View style={styles.weekDaysRow}>
                {weekDays.map((day, index) => (
                    <Text key={index} style={[styles.weekDayText, { color: colors.textTertiary }]}>
                        {day}
                    </Text>
                ))}
            </View>

            <View style={styles.daysGrid}>
                {days.map((day, index) => {
                    if (day === null) {
                        return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                    }

                    const dayDate = new Date(year, month, day);
                    const dateStr = formatDateToLocalString(dayDate);
                    const isFuture = dayDate.getTime() > today.getTime();

                    if (isFuture) {
                        return <View key={`empty-future-${index}`} style={styles.dayCellEmpty} />;
                    }

                    const count = data[dateStr] || 0;
                    const isToday = isSameDay(dayDate, today);
                    const hasEntry = count > 0;

                    const rowIndex = Math.floor(index / 7);
                    const dayOfWeek = index % 7;
                    const isCompleteWeek = completeWeekRows[rowIndex];
                    const dayColor = RAINBOW_COLORS[dayOfWeek];

                    return (
                        <View key={day} style={styles.dayCellWrapper}>
                            <View style={[
                                styles.dayIndicator,
                                hasEntry && {
                                    backgroundColor: colors.textPrimary,
                                    borderColor: colors.textPrimary,
                                    borderWidth: 0.5,
                                },
                                !hasEntry && !isToday && {
                                    backgroundColor: 'transparent',
                                    borderColor: colors.textTertiary,
                                    borderWidth: 0.5,
                                    opacity: 0.3,
                                },
                                isToday && !hasEntry && {
                                    borderColor: colors.textPrimary,
                                    borderWidth: 1,
                                    backgroundColor: colors.textPrimary + '08',
                                }
                            ]}>
                                {hasEntry ? (
                                    <Clover
                                        color={isCompleteWeek ? dayColor : colors.cardBackground}
                                        size={isCompleteWeek ? 18 : 15}
                                        shouldRotate={isCompleteWeek && rotating}
                                    />
                                ) : (
                                    <Text style={[
                                        styles.dayNumber,
                                        {
                                            color: isToday
                                                ? colors.textPrimary
                                                : colors.textSecondary,
                                            opacity: isToday ? 0.7 : 0.45,
                                            fontWeight: '500'
                                        }
                                    ]}>
                                        {day}
                                    </Text>
                                )}
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
    monthTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 16,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    weekDaysRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.4,
    },
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
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: 'transparent',
    },
    dayNumber: {
        fontSize: 13,
    },
});