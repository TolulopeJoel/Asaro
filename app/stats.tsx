import { MonthGrid } from '@/src/components/stats/MonthGrid';
import { StatTile } from '@/src/components/stats/StatTile';
import { AchievementRow } from '@/src/components/stats/AchievementRow';
import { PracticeHistory } from '@/src/components/journal/PracticeHistory';
import { actionKindOf, isCadence } from '@/src/data/actionKind';
import { PracticeProgress, practiceProgress } from '@/src/data/practiceRepository';
import { LoadingView } from '@/src/components/LoadingView';
import {
    EnhancedActionItem, getAllActionItems, getChapterCoverage, getDailyEntryCounts,
    getFirstEntryDate, getReadingProgress,
} from '@/src/data/database';
import { ALL_BIBLE_BOOKS } from '@/src/data/bibleBooks';
import { READING_PLAN_DATA } from '@/src/data/readingPlanData';
import { weaveCloth } from '@/src/land/cloth';
import { AchievementKey, achievements } from '@/src/stats/achievements';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { formatDateToLocalString, getLocalMidnight } from '@/src/utils/dateUtils';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
    BookCheck, BookOpen, CalendarCheck, ChevronLeft, ChevronRight, FileText, Flame, LucideIcon, Map, Trophy,
} from 'lucide-react-native';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Asaro, Hero, Screen, Text as UIText } from '@/src/components/ui';

/**
 * The record, played like a game: design/all-screens.html #stats. Nothing here
 * counts days missed, and every achievement levels on a figure that only rises.
 */

/** An unbroken run of days with an entry. */
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

    // Only a run that reaches today or yesterday is current.
    const today = getLocalMidnight();
    const sinceEnd = Math.round((today.getTime() - run.to.getTime()) / DAY);
    return { longest: best, current: sinceEnd <= 1 ? run : null };
}

interface Month { year: number; month: number }

const ACHIEVEMENT_ICONS: Record<AchievementKey, LucideIcon> = {
    faithful: Flame,
    books: BookOpen,
    chapters: FileText,
    plan: Map,
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface StatsState {
    data: Record<string, number>;
    firstEntry: Date | null;
    chapters: number;
    books: number;
    planDone: number;
}

export default function StatsScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const [state, setState] = useState<StatsState | null>(null);
    /** Months back from this one, for the calendar's pager. */
    const [monthsBack, setMonthsBack] = useState(0);

    const load = useCallback(async () => {
        const today = new Date();
        const firstEntry = await getFirstEntryDate();
        const start = firstEntry ?? new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const [data, coverage, done] = await Promise.all([
            getDailyEntryCounts(formatDateToLocalString(start), formatDateToLocalString(end)),
            getChapterCoverage(),
            getReadingProgress(),
        ]);
        const cloth = weaveCloth(coverage, ALL_BIBLE_BOOKS, Date.now());

        setState({
            data,
            firstEntry,
            chapters: cloth.worked,
            books: cloth.books.filter(b => b.total > 0 && b.worked >= b.total).length,
            planDone: done.length,
        });
    }, []);

    useFocusEffect(useCallback(() => { load().catch(() => { }); }, [load]));

    // Practices live here rather than on their Library cards: the Library is
    // where the reader manages what they carry, and "how has this gone" is a
    // different question that belongs beside the other records.
    const [practices, setPractices] = useState<
        { item: EnhancedActionItem; progress: PracticeProgress }[]
    >([]);

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            (async () => {
                try {
                    const all = await getAllActionItems(200);
                    const live = all.filter(
                        item => !item.archived_at && actionKindOf(item) === 'practice' && isCadence(item.cadence),
                    );
                    const withProgress = await Promise.all(
                        live.map(async item => ({
                            item,
                            progress: await practiceProgress(item.id!, item.cadence),
                        })),
                    );
                    // Kept longest first: the established ones are the record.
                    withProgress.sort((a, b) => b.progress.streak - a.progress.streak);
                    if (alive) setPractices(withProgress);
                } catch {
                    // Stats never breaks for this.
                    if (alive) setPractices([]);
                }
            })();
            return () => {
                alive = false;
            };
        }, []),
    );

    const { longest, current } = useMemo(() => runs(state?.data ?? {}), [state?.data]);
    const daysWritten = useMemo(
        () => Object.values(state?.data ?? {}).filter(n => n > 0).length,
        [state?.data],
    );

    /** Every month from the first entry to this one, newest first. */
    const months = useMemo<Month[]>(() => {
        const now = new Date();
        const first = state?.firstEntry ?? now;
        const list: Month[] = [];
        let y = now.getFullYear();
        let m = now.getMonth();
        while (y > first.getFullYear() || (y === first.getFullYear() && m >= first.getMonth())) {
            list.push({ year: y, month: m });
            if (--m < 0) { m = 11; y--; }
        }
        return list.length ? list : [{ year: now.getFullYear(), month: now.getMonth() }];
    }, [state?.firstEntry]);

    const shown = months[Math.min(monthsBack, months.length - 1)];
    const monthCaption = useMemo(() => {
        const prefix = `${shown.year}-${String(shown.month + 1).padStart(2, '0')}`;
        const kept = Object.keys(state?.data ?? {}).filter(d => d.startsWith(prefix) && (state?.data[d] ?? 0) > 0).length;
        if (monthsBack > 0) return plural(kept, 'day', 'days');
        const elapsed = new Date().getDate();
        return `${kept} of ${plural(elapsed, 'day', 'days')} so far`;
    }, [shown, state?.data, monthsBack]);

    const list = useMemo(() => achievements({
        bestRun: longest?.days ?? 0,
        booksFinished: state?.books ?? 0,
        chaptersWorked: state?.chapters ?? 0,
        planDone: state?.planDone ?? 0,
        planTotal: READING_PLAN_DATA.length,
    }), [longest, state]);

    const since = state?.firstEntry
        ? `Reading since ${state.firstEntry.getDate()} ${state.firstEntry.toLocaleDateString('en-GB', {
            month: 'long',
            ...(state.firstEntry.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
        })}`
        : new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // A run that can be lost gets a tile only while it is running.
    const tiles: { icon: LucideIcon; value: number; label: string; accent?: boolean }[] = [
        ...(current ? [{ icon: Flame, value: current.days, label: 'Day run', accent: true }] : []),
        { icon: Trophy, value: longest?.days ?? 0, label: 'Best run' },
        { icon: CalendarCheck, value: daysWritten, label: 'Days written' },
        { icon: BookOpen, value: state?.chapters ?? 0, label: 'Chapters' },
        ...(current ? [] : [{ icon: BookCheck, value: state?.books ?? 0, label: 'Books' }]),
    ];

    const older = monthsBack < months.length - 1;
    const newer = monthsBack > 0;

    return (
        <Screen edges={[]}>
            <Hero ownsTopInset>
                <ScalePressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={Spacing.md}
                    style={styles.back}
                >
                    <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                </ScalePressable>
                <UIText variant="display" tone="onBand" style={styles.heroTitle}>What you&apos;ve done</UIText>
                <UIText variant="sub" tone="onHero" style={styles.heroSub}>{since}</UIText>
            </Hero>

            {!state ? (
                <View style={styles.loading}>
                    <LoadingView size={48} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                    {/* His ledger. Idle: the page is visited too often for an action not to wear out. */}
                    <View style={styles.ledger}>
                        <Asaro size={64} label="Àṣàrò" />
                        <View style={styles.ledgerText}>
                            <UIText variant="subtitle">
                                {daysWritten > 0 ? 'I keep receipts.' : 'Nothing to keep yet.'}
                            </UIText>
                            <UIText variant="bodySmall" tone="secondary" style={styles.ledgerLine}>
                                {daysWritten === 0
                                    ? "Write one and I'll start counting."
                                    : daysWritten === 1
                                        ? 'Here it is. One day, and counting.'
                                        : `Here they are. All ${daysWritten.toLocaleString('en-GB')} days of them.`}
                            </UIText>
                        </View>
                    </View>

                    <View>
                        <UIText variant="label" style={styles.sectionLabel}>Statistics</UIText>
                        <View style={styles.tiles}>
                            {[0, 2].map(row => (
                                <View key={row} style={styles.tileRow}>
                                    {tiles.slice(row, row + 2).map(tile => <StatTile key={tile.label} {...tile} />)}
                                </View>
                            ))}
                        </View>
                    </View>

                    <View>
                        <View style={styles.pager}>
                            <ScalePressable
                                onPress={() => setMonthsBack(n => n + 1)}
                                disabled={!older}
                                hitSlop={Spacing.md}
                                accessibilityRole="button"
                                accessibilityLabel="Previous month"
                            >
                                <ChevronLeft size={22} color={older ? colors.accent : colors.border} strokeWidth={1.9} />
                            </ScalePressable>
                            <UIText variant="subtitle">
                                {new Date(shown.year, shown.month).toLocaleDateString('en-GB', {
                                    month: 'long',
                                    ...(shown.year !== new Date().getFullYear() ? { year: 'numeric' } : {}),
                                })}
                            </UIText>
                            <ScalePressable
                                onPress={() => setMonthsBack(n => Math.max(0, n - 1))}
                                disabled={!newer}
                                hitSlop={Spacing.md}
                                accessibilityRole="button"
                                accessibilityLabel="Next month"
                            >
                                <ChevronRight size={22} color={newer ? colors.accent : colors.border} strokeWidth={1.9} />
                            </ScalePressable>
                        </View>
                        <MonthGrid
                            year={shown.year}
                            month={shown.month}
                            data={state.data}
                            showTitle={false}
                            weekdays
                        />
                        <UIText variant="bodySmall" tone="secondary" style={styles.monthCaption}>{monthCaption}</UIText>
                    </View>

                    <View>
                        <UIText variant="label">Achievements</UIText>
                        {list.map((achievement, index) => (
                            <AchievementRow
                                key={achievement.key}
                                achievement={achievement}
                                icon={ACHIEVEMENT_ICONS[achievement.key]}
                                last={index === list.length - 1}
                            />
                        ))}
                    </View>

                    {practices.length > 0 && (
                        <View>
                            <UIText variant="label" style={styles.sectionLabel}>Practices</UIText>
                            <View style={styles.practices}>
                                {practices.map(({ item, progress }) => isCadence(item.cadence) && (
                                    <PracticeHistory
                                        key={item.id}
                                        title={item.action}
                                        completions={progress.completions}
                                        cadence={item.cadence}
                                    />
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    back: { marginLeft: -6, alignSelf: 'flex-start' },
    heroTitle: { marginTop: 10 },
    /** `.cl-hsub{margin:8px 0 0}` */
    heroSub: { marginTop: Spacing.sm },
    loading: { flex: 1, justifyContent: 'center' },
    body: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 40,
        gap: Spacing.xl,
    },
    ledger: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md + 2 },
    ledgerText: { flex: 1, minWidth: 0 },
    ledgerLine: { marginTop: 3 },
    sectionLabel: { marginBottom: Spacing.sm + 2 },
    tiles: { gap: 10 },
    tileRow: { flexDirection: 'row', gap: 10 },
    pager: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm + 2,
    },
    monthCaption: { textAlign: 'center', marginTop: -Spacing.md },
    practices: { gap: 10 },
});
