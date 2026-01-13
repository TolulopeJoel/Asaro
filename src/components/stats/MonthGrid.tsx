import { useTheme } from '@/src/theme/ThemeContext';
import { formatDateToLocalString, getLocalMidnight, isSameDay } from '@/src/utils/dateUtils';
import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';

interface MonthGridProps {
    year: number;
    month: number;
    data: Record<string, number>;
    showTitle?: boolean;
}

export const MonthGrid = React.memo(({ year, month, data, showTitle = true }: MonthGridProps) => {
    const { colors } = useTheme();
    const today = getLocalMidnight();

    const days = React.useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

        const d = [];
        // Add empty slots for days before the 1st
        for (let i = 0; i < startDayOfWeek; i++) {
            d.push(null);
        }
        // Add actual days
        for (let i = 1; i <= daysInMonth; i++) {
            d.push(i);
        }
        return d;
    }, [year, month]);

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

                    // Hide future dates
                    if (isFuture) {
                        return <View key={`empty-future-${index}`} style={styles.dayCellEmpty} />;
                    }

                    const count = data[dateStr] || 0;
                    const isToday = isSameDay(dayDate, today);
                    const hasEntry = count > 0;

                    return (
                        <View key={day} style={styles.dayCellWrapper}>
                            <View style={[
                                styles.dayIndicator,
                                // Completed - filled with hairline precision
                                hasEntry && {
                                    backgroundColor: colors.textPrimary,
                                    borderColor: colors.textPrimary,
                                    borderWidth: 0.5,
                                },
                                // Missed - gentle outline, forgiving
                                !hasEntry && !isToday && {
                                    backgroundColor: 'transparent',
                                    borderColor: colors.textTertiary,
                                    borderWidth: 0.5,
                                    opacity: 0.3,
                                },
                                // Today - precise but warm invitation
                                isToday && !hasEntry && {
                                    borderColor: colors.textPrimary,
                                    borderWidth: 1,
                                    backgroundColor: colors.textPrimary + '08',
                                }
                            ]}>
                                {hasEntry ? (
                                    <Image
                                        source={require('@/assets/images/yaya.png')}
                                        style={{
                                            width: 15,
                                            height: 15,
                                            tintColor: colors.cardBackground,
                                        }}
                                        resizeMode="contain"
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
