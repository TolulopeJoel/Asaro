import { ReadingItem } from '@/src/data/readingPlanData';
import { getLockedInTitle } from '@/src/data/homeTitles';
import { Colors } from '@/src/theme/colors';
import { Spacing } from '@/src/theme/spacing';
import { Settings } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScalePressable } from './ScalePressable';
import { DayStatus, WeeklyStreak } from './WeeklyStreak';

// Locked In Mode always uses the stark, high-contrast palette regardless of
// light/dark theme preference — the mode is meant to look different at a
// glance, not just have fewer cards.
const colors = Colors.lockedIn;

interface LockedInHomeProps {
    daysCompleted: number;
    dayOfMonth: number;
    nextItem: ReadingItem | null;
    weekDays: DayStatus[];
    onNextReadingPress: () => void;
    onSettingsPress: () => void;
    onStatsPress: () => void;
}

export const LockedInHome = React.memo(({
    daysCompleted,
    dayOfMonth,
    nextItem,
    weekDays,
    onNextReadingPress,
    onSettingsPress,
    onStatsPress,
}: LockedInHomeProps) => {
    const handlePress = useCallback(() => {
        if (nextItem) onNextReadingPress();
    }, [nextItem, onNextReadingPress]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={2}>
                    {getLockedInTitle()}
                </Text>
                <ScalePressable
                    style={[styles.settingsButton, { backgroundColor: colors.backgroundSubtle }]}
                    onPress={onSettingsPress}
                >
                    <Settings size={18} color={colors.textSecondary} />
                </ScalePressable>
            </View>

            <View style={styles.content}>
                <View style={styles.statBlock}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text style={[styles.bigNumber, { color: colors.textPrimary }]}>
                            {daysCompleted}/{dayOfMonth}
                        </Text>
                    </View>
                    <Text style={[styles.smallLabel, { color: colors.textTertiary }]}>
                        days this month
                    </Text>
                </View>

                <ScalePressable onPress={handlePress} disabled={!nextItem} style={styles.nextBlock}>
                    <Text style={[styles.smallLabel, { color: colors.textTertiary }]}>
                        next reading
                    </Text>
                    <Text style={[styles.nextReadingText, { color: colors.accent }]} numberOfLines={1}>
                        {nextItem ? `${nextItem.book} ${nextItem.chapters}` : 'All caught up'}
                    </Text>
                </ScalePressable>

                <View style={styles.streakBlock}>
                    <WeeklyStreak
                        weekDays={weekDays}
                        lockedIn
                        onPress={onStatsPress}
                    />
                </View>
            </View>
        </View>
    );
});

LockedInHome.displayName = 'LockedInHome';

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.lg,
    },
    title: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.3,
        lineHeight: 18,
        paddingTop: 10,
    },
    settingsButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xxl,
        paddingHorizontal: Spacing.layout.screenPadding,
    },
    statBlock: {
        alignItems: 'center',
        gap: Spacing.xs,
    },
    bigNumber: {
        fontSize: 72,
        fontWeight: '800',
        letterSpacing: -2,
    },
    smallLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    nextBlock: {
        alignItems: 'center',
        gap: Spacing.xs,
    },
    nextReadingText: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    streakBlock: {
        width: '100%',
    },
});
