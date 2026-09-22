import { MonthGrid } from '@/src/components/stats/MonthGrid';
import { LoadingView } from '@/src/components/LoadingView';
import { getDailyEntryCounts, getFirstEntryDate } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { formatDateToLocalString, getLocalMidnight } from '@/src/utils/dateUtils';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Hero, Screen, Text as UIText } from '@/src/components/ui';

/**
 * The longest and current unbroken runs, with the dates they cover.
 *
 * design/all-screens.html #stats reads these off under the grid. They were
 * never computed — the screen showed a month's total and nothing about streaks
 * — so they are derived here from the same daily counts the grid draws.
 */
interface Run { days: number; from: Date; to: Date }

function runs(data: Record<string, number>): { longest: Run | null; current: Run | null } {
    const dates = Object.keys(data)
        .filter(d => data[d] > 0)
        .sort()
        .map(d => {
            const [y, m, day] = d.split('-').map(Number);
            return new Date(y, m - 1, day);
        });
    if (dates.length === 0) return { longest: null, current: null };

    const DAY = 24 * 60 * 60 * 1000;
    let best: Run | null = null;
    let run: Run = { days: 1, from: dates[0], to: dates[0] };

    const keep = (r: Run) => { if (!best || r.days > best.days) best = { ...r }; };

    for (let i = 1; i < dates.length; i++) {
        // Compare local midnights, so a DST shift doesn't break a run.
        const gap = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / DAY);
        if (gap === 1) {
            run = { days: run.days + 1, from: run.from, to: dates[i] };
        } else {
            keep(run);
            run = { days: 1, from: dates[i], to: dates[i] };
        }
    }
    keep(run);

    // The last run only counts as current if it reaches today or yesterday —
    // a run that ended last week is history, not a streak you are on.
    const today = getLocalMidnight();
    const sinceEnd = Math.round((today.getTime() - run.to.getTime()) / DAY);
    return { longest: best, current: sinceEnd <= 1 ? run : null };
}

const dayMonth = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

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
    const { colors, isLockedIn } = useTheme();
    const router = useRouter();
    const [state, setState] = useState<StatsState>({
        allTimeData: {},
        months: [],
        currentMonthStats: { completed: 0, total: 0 },
        isLoading: true
    });
    // The title used to live in the navigation bar. The mockup puts it in the
    // hero band, so it becomes state the screen owns.
    const [headerTitle, setHeaderTitle] = useState("What you've done");

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
        // Update the header emoji based on missed days in the current month
        const dayOfMonth = today.getDate(); // Current day of the month (1-31)
        const missedDays = Math.max(dayOfMonth - 1 - completedInCurrentMonth, 0);
        // Keep emojis encouraging (never demotivating)
        const moodEmoji =
            missedDays === 0 ? '🤩' :
                missedDays <= 5 ? '😌' : // small misses,
                    missedDays <= 14 ? '😎' : // a few more,
                        '😏'; // higher misses,
        setHeaderTitle(`What you've done ${moodEmoji}`);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [loadStats])
    );

    const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });

    const { longest, current } = React.useMemo(() => runs(state.allTimeData), [state.allTimeData]);

    /**
     * A run of unbroken days.
     *
     * Colossal sets it between rules with the dates hanging off the right;
     * Cloth gathers the same three lines into a `.cl-panel`. Both are what
     * their mockup draws.
     */
    const Run = ({ label, run, accent }: { label: string; run: Run | null; accent?: boolean }) => {
        const days = run ? `${run.days} ${run.days === 1 ? 'day' : 'days'}` : 'None yet';
        const when = run
            ? label === 'Current run'
                ? `since ${dayMonth(run.from)}`
                : `${dayMonth(run.from)}–${dayMonth(run.to)}`
            : null;

        if (!isLockedIn) {
            return (
                <View style={[styles.clothRunPanel, { backgroundColor: colors.backgroundSubtle }]}>
                    <UIText variant="label" style={styles.runLabel}>{label}</UIText>
                    <UIText variant="subtitle" tone={accent ? 'accent' : 'primary'}>{days}</UIText>
                    {when && <UIText variant="bodySmall" style={styles.clothRunWhen}>{when}</UIText>}
                </View>
            );
        }

        return (
            <>
                <View style={[styles.rule, { backgroundColor: colors.border }]} />
                <View style={styles.runRow}>
                    <View>
                        <UIText variant="label" style={styles.runLabel}>{label}</UIText>
                        <UIText variant="subtitle" tone={accent ? 'accent' : 'primary'}>{days}</UIText>
                    </View>
                    {when && <UIText variant="meta">{when}</UIText>}
                </View>
            </>
        );
    };

    const renderHeader = useCallback(() => (
        <View style={styles.monthHeader}>
            {/*
              * design/all-screens.html #stats, the `.cl` slot: two panels side
              * by side, each a numeral over its label. Cloth leads with the
              * figures rather than the grid — it has no colossal slot to spend,
              * so the two `.cl-statn` numerals carry the screen between them.
              */}
            <View style={styles.clothStatsRow}>
                <View style={[styles.clothStatPanel, { backgroundColor: colors.backgroundSubtle }]}>
                    <UIText variant="hero">{state.currentMonthStats.completed}</UIText>
                    <UIText variant="caption" tone="secondary" style={styles.clothStatLabel}>completed</UIText>
                </View>
                <View style={[styles.clothStatPanel, { backgroundColor: colors.backgroundSubtle }]}>
                    <UIText variant="hero" tone="secondary">{state.currentMonthStats.total}</UIText>
                    <UIText variant="caption" tone="secondary" style={styles.clothStatLabel}>total days</UIText>
                </View>
            </View>
            <UIText variant="label" style={styles.monthLabel}>{currentMonthName}</UIText>
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
        <Screen>
            {isLockedIn ? (
                /*
                 * design/all-screens.html #stats, the `.co` slot. The month is
                 * the mark, the count of days completed is the colossal
                 * element, and the runs sit under the grid between rules. The
                 * mood emoji Cloth carries in its title is dropped: it fights
                 * the monochrome, which is the same call the design makes on
                 * Group detail.
                 */
                <>
                    <View style={styles.colossalTop}>
                        <ScalePressable
                            onPress={() => router.back()}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                            hitSlop={Spacing.md}
                            style={styles.backArrow}
                        >
                            <ChevronLeft size={20} color={colors.textTertiary} strokeWidth={2} />
                        </ScalePressable>
                        <UIText variant="tab">{`${currentMonthName} ${new Date().getFullYear()}`}</UIText>
                    </View>
                    <View style={styles.colossalCount}>
                        <UIText variant="hero">{state.currentMonthStats.completed}</UIText>
                        <UIText variant="label" style={styles.giantLabel}>
                            {`completed of ${state.currentMonthStats.total} days`}
                        </UIText>
                    </View>
                </>
            ) : (
                <Hero>
                    <ScalePressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        hitSlop={Spacing.md}
                        style={styles.clothBack}
                    >
                        <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                    </ScalePressable>
                    <UIText variant="display" tone="onBand" style={styles.clothHeroTitle}>{headerTitle}</UIText>
                    <UIText variant="sub" tone="onHero" style={styles.heroSub}>
                        {`${currentMonthName} ${new Date().getFullYear()}`}
                    </UIText>
                </Hero>
            )}

            {state.isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <LoadingView size={48} />
                </View>
            ) : (
                <FlatList
                    data={state.months}
                    renderItem={renderItem}
                    keyExtractor={(item) => `${item.year}-${item.month}`}
                    contentContainerStyle={[
                        styles.scrollContent,
                        isLockedIn && styles.scrollContentColossal,
                    ]}
                    ListHeaderComponent={isLockedIn
                        ? <View style={[styles.rule, { backgroundColor: colors.border }]} />
                        : renderHeader}
                    ListFooterComponent={
                        <>
                            <Run label="Longest run" run={longest} />
                            <Run label="Current run" run={current} accent />
                        </>
                    }
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                />
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 40,
    },
    monthHeader: {
        marginBottom: Spacing.xl,
        gap: Spacing.lg,
    },
    statsCard: {},
    monthLabel: {},
    heroSub: {
        marginTop: Spacing.xs,
    },

    // ── Colossal ──────────────────────────────────────────────────────────
    colossalTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    backArrow: { marginLeft: -6 },
    colossalCount: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xl + 2,
    },
    giantLabel: { marginTop: 10 },
    scrollContentColossal: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
    },
    /** `.co-hr` */
    rule: { height: Spacing.border.hairline, marginVertical: Spacing.xl + 2 },
    runRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    runLabel: { marginBottom: 6 },
    /** `.cl-panel` × 2, side by side with a 12px gap. */
    clothBack: { marginLeft: -6, alignSelf: 'flex-start' },
    clothHeroTitle: { marginTop: 10 },
    clothStatsRow: { flexDirection: 'row', gap: Spacing.md },
    clothStatPanel: { flex: 1, padding: Spacing.layout.cardPadding },
    clothStatLabel: { marginTop: 6, textTransform: 'uppercase' },
    clothRunPanel: { padding: Spacing.layout.cardPadding, marginBottom: Spacing.md },
    clothRunWhen: { marginTop: 4 },
    monthTitleLarge: { marginBottom: Spacing.xl },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xl,
    },
    statDivider: {
        width: 1,
        height: 48,
        opacity: 0.3,
    },
});