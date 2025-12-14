import { getDailyEntryCounts } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface DayStatus {
    date: Date;
    dayName: string;
    dayNumber: number;
    hasEntry: boolean;
    isToday: boolean;
    isFuture: boolean;
}

export const WeeklyStreak = () => {
    const { colors } = useTheme();
    const [weekDays, setWeekDays] = useState<DayStatus[]>([]);

    const fetchWeekData = useCallback(async () => {
        const today = new Date();
        const currentDay = today.getDay(); // 0 is Sunday

        // Start from Sunday (currentDay)
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDay);

        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);

        // Reset today for accurate comparison
        const todayReset = new Date();
        todayReset.setHours(0, 0, 0, 0);

        // Format dates for DB query
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const startDateStr = formatDate(sunday);
        const endDateStr = formatDate(saturday);

        try {
            const counts = await getDailyEntryCounts(startDateStr, endDateStr);

            const days: DayStatus[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(sunday);
                d.setDate(sunday.getDate() + i);
                d.setHours(0, 0, 0, 0);

                const dateStr = formatDate(d);
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

    return (
        <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.daysContainer}>
                {weekDays.map((day, index) => (
                    <View key={index} style={styles.dayItem}>
                        <Text style={[
                            styles.dayName,
                            {
                                color: day.isToday ? colors.accent : colors.textTertiary,
                                opacity: day.isFuture ? 0.05 : 1
                            }
                        ]}>
                            {day.dayName.charAt(0)}
                        </Text>
                        <View style={[
                            styles.dayIndicator,
                            // Completed day - vibrant success green
                            day.hasEntry && {
                                backgroundColor: '#10b981',
                                borderColor: '#10b981',
                            },
                            // Missed day - Judgment
                            // Stark, empty, "do better". A void.
                            !day.hasEntry && !day.isFuture && !day.isToday && {
                                backgroundColor: 'transparent',
                                borderColor: '#ef4444', // Red border
                                borderWidth: 1.5,
                                borderStyle: 'dashed', // "Broken" chain
                            },
                            // Today - energetic accent
                            day.isToday && !day.hasEntry && {
                                borderColor: colors.accent,
                                borderWidth: 2,
                            },
                            // Future - ghost (barely there)
                            day.isFuture && {
                                borderColor: 'transparent',
                                backgroundColor: 'transparent',
                                opacity: 0.05
                            }
                        ]}>
                            <Text style={[
                                styles.dayNumber,
                                { color: day.hasEntry ? '#ffffff' : (day.isToday ? colors.accent : (!day.isFuture && !day.hasEntry ? '#ef4444' : colors.textSecondary)) }
                            ]}>
                                {day.dayNumber}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
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
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dayIndicator: {
        width: 40,
        height: 40,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    dayNumber: {
        fontSize: 15,
        fontWeight: '700',
    },
});
