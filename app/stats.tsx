import { getDailyEntryCounts } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MonthlyHeatmap = ({ data }: { data: Record<string, number> }) => {
    const { colors } = useTheme();
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

    const days = [];
    // Add empty slots for days before the 1st
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null);
    }
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <View style={styles.calendarContainer}>
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

                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const count = data[dateStr] || 0;
                    const isToday = day === today.getDate();
                    const isPast = day < today.getDate();
                    const isFuture = day > today.getDate();

                    return (
                        <View key={day} style={styles.dayCellWrapper}>
                            <View
                                style={[
                                    styles.dayCell,
                                    // Completed - solid accent with building intensity
                                    count > 0 && {
                                        backgroundColor: colors.textPrimary,
                                        borderColor: colors.textPrimary,
                                        borderWidth: 1,
                                    },
                                    // Missed past day - hollow judgment
                                    count === 0 && isPast && {
                                        backgroundColor: 'transparent',
                                        borderColor: colors.textPrimary,
                                        borderWidth: 1.5,
                                        opacity: 0.3,
                                    },
                                    // Today - magnetic pull
                                    isToday && count === 0 && {
                                        backgroundColor: colors.textPrimary + '08',
                                        borderColor: colors.textPrimary,
                                        borderWidth: 2,
                                        opacity: 1,
                                    },
                                    // Future - ghost
                                    isFuture && {
                                        backgroundColor: 'transparent',
                                        borderColor: colors.borderSubtle,
                                        borderWidth: 0.5,
                                        opacity: 0.15,
                                    }
                                ]}
                            >
                                <Text style={[
                                    styles.dayText,
                                    {
                                        color: count > 0
                                            ? colors.background
                                            : (isToday
                                                ? colors.textPrimary
                                                : colors.textSecondary
                                            ),
                                        opacity: isFuture ? 0.15 : (count > 0 || isToday ? 1 : 0.4),
                                        fontWeight: isToday ? '700' : '500',
                                    }
                                ]}>
                                    {day}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const StatCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => {
    const { colors } = useTheme();

    return (
        <View style={styles.statCard}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
};

export default function StatsScreen() {
    const { colors } = useTheme();
    const [monthlyData, setMonthlyData] = useState<Record<string, number>>({});

    const loadStats = useCallback(async () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const data = await getDailyEntryCounts(startDate, endDate);
        setMonthlyData(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [loadStats])
    );

    // Calculate stats
    const totalDays = Object.keys(monthlyData).length;
    const completedDays = Object.values(monthlyData).filter(count => count > 0).length;
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Month Overview */}
                <View style={styles.monthHeader}>
                    <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>
                        {currentMonth}
                    </Text>
                    <View style={styles.statsRow}>
                        <StatCard
                            label="completed"
                            value={completedDays}
                            color={colors.textPrimary}
                        />
                        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                        <StatCard
                            label="total days"
                            value={totalDays}
                            color={colors.textSecondary}
                        />
                    </View>
                </View>

                {/* Heatmap */}
                <View style={styles.heatmapSection}>
                    <MonthlyHeatmap data={monthlyData} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 28,
    },
    monthHeader: {
        marginBottom: 40,
    },
    monthTitle: {
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 24,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    statCard: {
        flex: 1,
    },
    statValue: {
        fontSize: 40,
        fontWeight: '700',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        opacity: 0.5,
    },
    statDivider: {
        width: 1,
        height: 48,
        opacity: 0.3,
    },
    heatmapSection: {
        marginTop: 12,
    },
    calendarContainer: {
        width: '100%',
    },
    weekDaysRow: {
        flexDirection: 'row',
        marginBottom: 16,
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
    dayCell: {
        flex: 1,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
});