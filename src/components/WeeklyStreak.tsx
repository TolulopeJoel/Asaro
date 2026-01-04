import { getDailyEntryCounts } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatDateToLocalString, getLocalMidnight } from '@/src/utils/dateUtils';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScalePressable } from './ScalePressable';

interface DayStatus {
    date: Date;
    dayName: string;
    dayNumber: number;
    hasEntry: boolean;
    isToday: boolean;
    isFuture: boolean;
}

export const WeeklyStreak = React.memo(() => {
    const { colors } = useTheme();
    const [weekDays, setWeekDays] = useState<DayStatus[]>([]);

    const fetchWeekData = useCallback(async () => {
        const today = new Date();
        const currentDay = today.getDay();

        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDay);
        sunday.setHours(0, 0, 0, 0);

        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        saturday.setHours(0, 0, 0, 0);

        const todayReset = getLocalMidnight();

        const startDateStr = formatDateToLocalString(sunday);
        const endDateStr = formatDateToLocalString(saturday);

        try {
            const counts = await getDailyEntryCounts(startDateStr, endDateStr);

            const days: DayStatus[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(sunday);
                d.setDate(sunday.getDate() + i);
                d.setHours(0, 0, 0, 0);

                const dateStr = formatDateToLocalString(d);
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

                days.push({
                    date: d,
                    dayName,
                    dayNumber: d.getDate(),
                    hasEntry: (counts[dateStr] || 0) > 0,
                    isToday: d.getTime() === todayReset.getTime(),
                    isFuture: d.getTime() > todayReset.getTime()
                });
            }
            setWeekDays(days);
        } catch (error) {
            console.error('Error fetching weekly streak:', error);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchWeekData();
        }, [fetchWeekData])
    );

    const router = useRouter();

    return (
        <ScalePressable
            style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/stats')}
        >
            <View style={styles.header}>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>

            <View style={styles.daysContainer}>
                {weekDays.map((day, index) => (
                    <View key={index} style={styles.dayItem}>
                        <Text style={[
                            styles.dayName,
                            {
                                color: day.isToday ? colors.textPrimary : colors.textTertiary,
                                opacity: day.isFuture ? 0.35 : 1,
                                fontWeight: day.isToday ? '600' : '500',
                                letterSpacing: 1
                            }
                        ]}>
                            {day.dayName.charAt(0)}
                        </Text>
                        <View style={[
                            styles.dayIndicator,
                            // Completed - filled with hairline precision
                            day.hasEntry && {
                                backgroundColor: colors.textPrimary,
                                borderColor: colors.textPrimary,
                                borderWidth: 0.5,
                            },
                            // Missed - gentle outline, forgiving
                            !day.hasEntry && !day.isFuture && !day.isToday && {
                                backgroundColor: 'transparent',
                                borderColor: colors.textTertiary,
                                borderWidth: 0.5,
                                opacity: 0.3,
                            },
                            // Today - precise but warm invitation
                            day.isToday && !day.hasEntry && {
                                borderColor: colors.textPrimary,
                                borderWidth: 1,
                                backgroundColor: colors.textPrimary + '08',
                            },
                            // Future - minimal presence
                            day.isFuture && {
                                borderColor: colors.border,
                                borderWidth: 0.5,
                                backgroundColor: 'transparent',
                                opacity: 0.2,
                            }
                        ]}>
                            {day.hasEntry ? (
                                <View style={[styles.dot, { backgroundColor: colors.cardBackground }]} />
                            ) : (
                                <Text style={[
                                    styles.dayNumber,
                                    {
                                        color: day.isToday
                                            ? colors.textPrimary
                                            : colors.textSecondary,
                                        opacity: day.isFuture ? 0.3 : (day.isToday ? 0.7 : 0.45),
                                        fontWeight: '500'
                                    }
                                ]}>
                                    {day.dayNumber}
                                </Text>
                            )}
                        </View>
                    </View>
                ))}
            </View>
        </ScalePressable>
    );
});

WeeklyStreak.displayName = 'WeeklyStreak';

const styles = StyleSheet.create({
    container: {
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 16,
    },
    daysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayItem: {
        alignItems: 'center',
        gap: 10,
    },
    dayName: {
        fontSize: 10,
        textTransform: 'uppercase',
    },
    dayIndicator: {
        width: 40,
        height: 40,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: 'transparent',
    },
    dayNumber: {
        fontSize: 14,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});