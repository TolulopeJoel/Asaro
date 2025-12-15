import { MonthGrid } from '@/src/components/stats/MonthGrid';
import { StatCard } from '@/src/components/stats/StatCard';
import { getDailyEntryCounts, getFirstEntryDate } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatDateToLocalString } from '@/src/utils/dateUtils';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface MonthData {
    year: number;
    month: number;
    name: string;
}

interface StatsState {
    allTimeData: Record<string, number>;
    months: MonthData[];
    currentMonthStats: {
        completed: number;
        total: number;
    };
    isLoading: boolean;
}

export default function StatsScreen() {
    const { colors } = useTheme();
    const [state, setState] = useState<StatsState>({
        allTimeData: {},
        months: [],
        currentMonthStats: { completed: 0, total: 0 },
        isLoading: true
    });

    const loadStats = useCallback(async () => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const firstEntryDate = await getFirstEntryDate();

        const startDate = firstEntryDate || new Date(currentYear, currentMonth, 1);
        const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0);

        const data = await getDailyEntryCounts(
            formatDateToLocalString(startDate),
            formatDateToLocalString(lastDayOfCurrentMonth)
        );

        // Calculate current month stats
        const daysInCurrentMonth = lastDayOfCurrentMonth.getDate();
        const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const completedInCurrentMonth = Object.keys(data)
            .filter(date => date.startsWith(currentMonthPrefix) && data[date] > 0)
            .length;

        // Generate months list from start to current
        const monthList: MonthData[] = [];
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();

        let year = startYear;
        let month = startMonth;

        while (year < currentYear || (year === currentYear && month <= currentMonth)) {
            monthList.unshift({
                year,
                month,
                name: new Date(year, month).toLocaleDateString('en-US', { month: 'long' })
            });

            month++;
            if (month > 11) {
                month = 0;
                year++;
            }
        }

        setState({
            allTimeData: data,
            months: monthList,
            currentMonthStats: {
                completed: completedInCurrentMonth,
                total: daysInCurrentMonth
            },
            isLoading: false
        });
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [loadStats])
    );

    const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });

    const renderHeader = useCallback(() => (
        <View style={styles.monthHeader}>
            <Text style={[styles.monthTitleLarge, { color: colors.textPrimary }]}>
                {currentMonthName}
            </Text>
            <View style={styles.statsRow}>
                <StatCard
                    label="completed"
                    value={state.currentMonthStats.completed}
                    color={colors.textPrimary}
                />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <StatCard
                    label="total days"
                    value={state.currentMonthStats.total}
                    color={colors.textSecondary}
                />
            </View>
        </View>
    ), [colors, currentMonthName, state.currentMonthStats]);

    const renderItem = useCallback(({ item, index }: { item: MonthData; index: number }) => {
        const isCurrentMonth = index === 0;
        return (
            <MonthGrid
                year={item.year}
                month={item.month}
                data={state.allTimeData}
                showTitle={!isCurrentMonth}
            />
        );
    }, [state.allTimeData]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={state.months}
                renderItem={renderItem}
                keyExtractor={(item) => `${item.year}-${item.month}`}
                contentContainerStyle={styles.scrollContent}
                ListHeaderComponent={renderHeader}
                showsVerticalScrollIndicator={false}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 28,
        paddingBottom: 40,
    },
    monthHeader: {
        marginBottom: 40,
    },
    monthTitleLarge: {
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
    statDivider: {
        width: 1,
        height: 48,
        opacity: 0.3,
    },
});