import { getDailyEntryCounts } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatDateToLocalString, getLocalMidnight } from '@/src/utils/dateUtils';
import { ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { ScalePressable } from './ScalePressable';
import { Spacing } from '../theme/spacing';

export interface DayStatus {
    date: Date;
    dayName: string;
    dayNumber: number;
    hasEntry: boolean;
    isToday: boolean;
    isFuture: boolean;
}

// A completed week is still celebrated — but with the theme's own ramp rather
// than seven iOS system hues, which belonged to no palette. It reads as cloth
// taken deeper into the indigo vat with each dip. See `celebration` in
// src/theme/colors.ts.

export const fetchWeeklyStreakData = async (): Promise<DayStatus[]> => {
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
    return days;
};

export const WeeklyStreak = React.memo(({
    weekDays: weekDaysProp,
    onPress,
}: {
    weekDays?: DayStatus[];
    /** Overrides the default navigate-to-/stats behavior. */
    onPress?: () => void;
}) => {
    const { colors } = useTheme();
    const [weekDaysState, setWeekDays] = useState<DayStatus[]>([]);
    const weekDays = weekDaysProp || weekDaysState;
    const hasAnimated = useRef(false);

    const fetchWeekData = useCallback(async () => {
        try {
            const days = await fetchWeeklyStreakData();
            setWeekDays(days);
            hasAnimated.current = true;
        } catch (error) {
            console.error('Error fetching weekly streak:', error);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (!weekDaysProp) fetchWeekData();
            else hasAnimated.current = true;
        }, [fetchWeekData, weekDaysProp])
    );

    const router = useRouter();
    const pulseValue = useSharedValue(1);

    React.useEffect(() => {
        pulseValue.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1500 }),
                withTiming(1, { duration: 1500 })
            ),
            -1,
            true
        );
    }, [pulseValue]);

    const todayPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseValue.value }],
    }));

    const isFullWeek = weekDays.length === 7 && weekDays.every(d => d.hasEntry);

    const cardContent = (
        <>
            <View style={styles.header}>
                <ChevronRight size={16} color={colors.textTertiary} />
            </View>

            <View style={styles.daysContainer}>
                {weekDays.map((day, index) => {
                    const dayColor = colors.celebration[index];

                    return (
                        <Animated.View
                            key={index}
                            entering={hasAnimated.current ? undefined : FadeInDown.delay(index * 60).duration(400)}
                            style={styles.dayItem}
                        >
                            <Text style={[
                                styles.dayName,
                                {
                                    color: isFullWeek ? dayColor : (day.isToday ? colors.textPrimary : colors.textTertiary),
                                    opacity: day.isFuture ? 0.35 : 1,
                                    fontWeight: day.isToday ? '600' : '500',
                                    letterSpacing: 1,
                                }
                            ]}>
                                {day.dayName.charAt(0)}
                            </Text>

                            {isFullWeek && day.hasEntry ? (
                                // Each day gets its own rainbow color
                                <View style={[styles.dayIndicator, { backgroundColor: dayColor }]}>
                                    <View style={[styles.dot, { backgroundColor: colors.background }]} />
                                </View>
                            ) : (
                                <Animated.View style={[
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
                                    },
                                    day.isToday && !day.hasEntry && todayPulseStyle,
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
                                                fontWeight: '500',
                                            }
                                        ]}>
                                            {day.dayNumber}
                                        </Text>
                                    )}
                                </Animated.View>
                            )}
                        </Animated.View>
                    );
                })}
            </View>
        </>
    );

    // Full week: wrap in the celebration gradient.
    if (isFullWeek) {
        return (
            <ScalePressable onPress={() => router.push('/stats')}>
                <LinearGradient
                    colors={colors.celebration as unknown as readonly [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBorder}
                >
                    <View style={[styles.container, { backgroundColor: colors.cardBackground, borderWidth: 0 }]}>
                        {cardContent}
                    </View>
                </LinearGradient>
            </ScalePressable>
        );
    }

    return (
        <ScalePressable
            style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            onPress={onPress ?? (() => router.push('/stats'))}
        >
            {cardContent}
        </ScalePressable>
    );
});

WeeklyStreak.displayName = 'WeeklyStreak';

const styles = StyleSheet.create({
    gradientBorder: {
        borderRadius: Spacing.borderRadius.lg,
        padding: 1,
    },
    container: {
        padding: 20,
        borderRadius: Spacing.borderRadius.lg,
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
        borderRadius: Spacing.borderRadius.lg,
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
        borderRadius: Spacing.borderRadius.round,
    },
});