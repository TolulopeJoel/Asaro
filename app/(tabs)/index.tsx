import {
    getTotalEntryCount,
    JournalEntry,
    getReadingProgress,
    getLastCompletedReadingItemId,
    checkEntryCoversChapters,
    toggleReadingItem,
} from "@/src/data/database";
import { READING_PLAN_DATA, ReadingItem } from "@/src/data/readingPlanData";
import { useTheme } from "@/src/theme/ThemeContext";
import { Spacing } from "@/src/theme/spacing";
import { Typography } from "@/src/theme/typography";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { DeviceEventEmitter, ScrollView, StyleSheet, View } from "react-native";
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { LoadingView } from '@/src/components/LoadingView';
import { Share } from 'react-native';
import { useAlert } from '@/src/context/AlertContext';
import { deleteJournalEntry } from '@/src/data/database';
import { fetchWeeklyStreakData, DayStatus } from '@/src/components/WeeklyStreak';
import { fetchFlashbackData } from '@/src/components/Flashback';
import { useObservation } from '@/src/insight/useObservation';
import { useToday } from '@/src/hooks/useToday';
import { TodayStrip } from '@/src/components/home/TodayStrip';
import { ObservationCard } from '@/src/components/insight/ObservationCard';
import { ObservationReceipts } from '@/src/components/insight/ObservationReceipts';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { getDailyTitle } from '@/src/data/homeTitles';
import { LockedInHome } from '@/src/components/home/LockedInHome';
import { ClothHome } from '@/src/components/home/ClothHome';
import { formatDateToLocalString } from '@/src/utils/dateUtils';
import { Screen } from '@/src/components/ui';
import { DraftSummary, summariseDraft } from '@/src/hooks/useEntryHooks';


const DRAFT_KEY = "reflection_draft";

// Shared by both home compositions so tapping "next reading" behaves identically.
async function handleNextReadingPress(
    nextItem: ReadingItem,
    router: ReturnType<typeof useRouter>,
    onRefresh: () => void
) {
    // Strip verse notation: "119:64-176" → start=119, end=119; "116-119:63" → start=116, end=119
    const rawChapters = nextItem.chapters;
    const parts = rawChapters.split('-');
    const firstHasVerse = parts[0].includes(':');
    const planStart = parseInt(parts[0].split(':')[0], 10);

    let planEnd: number;
    if (parts.length > 1) {
        if (firstHasVerse) {
            // If the FIRST part has a verse (119:64), the SECOND part is a verse in the same chapter
            planEnd = planStart;
        } else {
            // Example: "116-119:63" -> start is 116, end is 119
            planEnd = parseInt(parts[parts.length - 1].split(':')[0], 10);
        }
    } else {
        planEnd = planStart;
    }

    const isCovered = !isNaN(planStart)
        ? await checkEntryCoversChapters(nextItem.book, planStart, planEnd)
        : false;

    if (isCovered) {
        // Entry already covers this — mark as completed and move on
        await toggleReadingItem(nextItem.id, true);
        onRefresh();
    } else {
        // No entry yet — go write one
        router.push({
            pathname: '/addEntry' as any,
            params: {
                readingItemId: nextItem.id,
                bookName: nextItem.book,
                chapters: nextItem.chapters
            }
        });
    }
}

export default function Index() {
    const [stats, setStats] = useState({ totalEntries: 0 });
    const [nextReading, setNextReading] = useState<ReadingItem | null>(null);
    const [weekDays, setWeekDays] = useState<DayStatus[]>([]);
    const [flashbackEntry, setFlashbackEntry] = useState<{ entry: JournalEntry, type: 'year' | 'month' | 'random' } | null>(null);
    const [draft, setDraft] = useState<DraftSummary | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    /*
     * A noticing, when there is one and the quiet period has passed.
     * Gated on the journal being loaded so detection never races the DB, and
     * on there being entries at all — the graph has nothing to converge on
     * before someone has written.
     */
    const echo = useObservation(!isLoading && stats.totalEntries > 0);
    const [receiptsOpen, setReceiptsOpen] = useState(false);

    const observationCard =
        echo.rendered && !receiptsOpen ? (
            <ObservationCard
                observation={echo.rendered}
                onSeen={echo.seen}
                onOpen={() => {
                    echo.open();
                    setReceiptsOpen(true);
                }}
                onDismiss={() => echo.dismiss()}
            />
        ) : null;

    /*
     * What is live today. Absent on most days — a practice already kept and an
     * application are both silent, so this renders nothing unless there is
     * genuinely something to do in fifteen seconds.
     */
    const today = useToday(!isLoading);
    const todayStrip =
        today.items.length > 0 ? (
            <TodayStrip
                items={today.items}
                onKeep={entry => today.keep(entry.item)}
                onUndo={entry => today.undo(entry.item)}
                // The strip is a prompt, not a place — tapping through goes
                // to where these actually live.
                onOpen={() => router.push({ pathname: '/(tabs)/library', params: { view: 'actions' } })}
            />
        ) : null;

    /*
     * Progress through the plan, replacing the entry count.
     *
     * A count of entries only goes up and nothing follows from it. "34 of 364"
     * is a goal with an end, and it is the core activity rather than a
     * by-product of it.
     */
    const [planProgress, setPlanProgress] = useState<{ completed: number; total: number; percent: number } | null>(null);
    useEffect(() => {
        (async () => {
            try {
                const done = await getReadingProgress();
                const total = READING_PLAN_DATA.length;
                const completed = done.length;
                setPlanProgress({ completed, total, percent: Math.round((completed / total) * 100) });
            } catch {
                setPlanProgress(null);
            }
        })();
    }, [isLoading]);

    /*
     * The receipts, as an element rather than a component.
     *
     * Declaring a component inside render gives it a new identity on every
     * pass, so React unmounts and remounts the whole modal subtree — which
     * here would drop the loaded entries and reset the sheet mid-read. An
     * element has no identity to lose.
     */
    const echoReceipts = (
        <AnimatedModal
            visible={receiptsOpen && !!echo.observation}
            onRequestClose={() => setReceiptsOpen(false)}
        >
            {echo.observation && echo.rendered && (
                <ObservationReceipts
                    observation={echo.observation}
                    rendered={echo.rendered}
                    onClose={() => setReceiptsOpen(false)}
                    onFollow={() => echo.follow()}
                    onVerdict={agreed => {
                        setReceiptsOpen(false);
                        echo.verdict(agreed);
                    }}
                    onOpenEntry={entry => {
                        setReceiptsOpen(false);
                        handleEntryPress(entry);
                    }}
                />
            )}
        </AnimatedModal>
    );

    const [isSharing, setIsSharing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showAlert } = useAlert();
    const scrollViewRef = useRef<ScrollView>(null);
    const { isLockedIn } = useTheme();
    const router = useRouter();

    const loadStats = useCallback(async () => {
        // Must be the LOCAL month: the queries filter on
        // strftime('%Y-%m', created_at, 'localtime'). toISOString() is UTC, so near a
        // month boundary it asked for the wrong month (e.g. 00:30 on Nov 1 in Lagos
        // returned October's count while dayOfMonth rendered 1).
        const currentMonth = formatDateToLocalString(new Date()).slice(0, 7);
        const totalEntries = await getTotalEntryCount(currentMonth);
        return { totalEntries };
    }, []);

    const loadNextReading = useCallback(async () => {
        const [completedIds, lastCompletedId] = await Promise.all([
            getReadingProgress(),
            getLastCompletedReadingItemId(),
        ]);
        const completedSet = new Set(completedIds);
        let nextItem: ReadingItem | undefined;

        if (lastCompletedId != null) {
            const lastIndex = READING_PLAN_DATA.findIndex(item => item.id === lastCompletedId);
            if (lastIndex >= 0) {
                nextItem = READING_PLAN_DATA.slice(lastIndex + 1).find(item => !completedSet.has(item.id));
            }
        }

        if (!nextItem) {
            nextItem = READING_PLAN_DATA.find(item => !completedSet.has(item.id));
        }

        return nextItem || null;
    }, []);

    const loadHomeData = useCallback(async () => {
        try {
            const [
                newStats,
                newNextReading,
                newWeekDays,
                newFlashback,
            ] = await Promise.all([
                loadStats(),
                loadNextReading(),
                fetchWeeklyStreakData(),
                fetchFlashbackData(),
            ]);

            setStats(newStats);
            setNextReading(newNextReading);
            setWeekDays(newWeekDays);
            setFlashbackEntry(newFlashback);
        } catch (error) {
            console.error('Error loading home data:', error);
        }
    }, [loadStats, loadNextReading]);

    // Scroll to top on tab press
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('tab-press-top-index', () => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        });
        return () => subscription.remove();
    }, []);

    const handleEntryPress = useCallback((entry: JournalEntry) => {
        setSelectedEntry(entry);
        setIsDetailModalVisible(true);
    }, []);

    const checkDraft = useCallback(async () => {
        try {
            const draftJson = await AsyncStorage.getItem(DRAFT_KEY);
            setDraft(summariseDraft(draftJson));
        } catch (error) {
            console.error('Error checking draft:', error);
            setDraft(null);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadHomeData();
            checkDraft();

            // Simulate initial load if it's very fast
            if (isLoading) {
                const timer = setTimeout(() => setIsLoading(false), 400);
                return () => clearTimeout(timer);
            }
        }, [loadHomeData, checkDraft, isLoading])
    );

    const handleShare = async (entry: JournalEntry) => {
        setIsSharing(true);
        try {
            const reference = `${entry.book_name} ${entry.chapter_start}${entry.verse_start ? ':' + entry.verse_start : ''}`;
            let content = `Reflection on ${reference}\n\n`;
            if (entry.reflection_1) content += `${entry.reflection_1}\n\n`;
            content += `🫶 Created with Àṣàrò`;

            await Share.share({
                message: content,
                title: reference,
            });
        } catch (error) {
            console.error("Error sharing entry:", error);
        } finally {
            setIsSharing(false);
        }
    };

    const handleDelete = (entry: JournalEntry) => {
        showAlert({
            title: "Delete Entry?",
            message: "Are you sure you want to delete this reflection? This cannot be undone.",
            buttons: [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await deleteJournalEntry(entry.id!);
                            setIsDetailModalVisible(false);
                            loadHomeData(); // Refresh data
                        } catch (error) {
                            console.error("Error deleting entry:", error);
                        } finally {
                            setIsDeleting(false);
                        }
                    },
                },
            ]
        });
    };


    /**
     * Today's reading, opened the same way the Cloth card opens it — the
     * plan bookkeeping in `handleNextReadingPress` has to run either way.
     */
    const handleBeginReflection = useCallback(() => {
        if (!nextReading) return;
        handleNextReadingPress(nextReading, router, loadHomeData);
    }, [nextReading, router, loadHomeData]);

    /**
     * "Sunday, 21 September" — the date under Cloth's hero title.
     *
     * The band says what day it is because Cloth's home is the one screen that
     * greets you; Colossal states the reading instead and skips the date.
     */
    const homeDateLine = useMemo(
        () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
        []
    );

    /**
     * The flashback, flattened to the three strings both home screens show.
     */
    const flashbackForLockedIn = useMemo(() => {
        if (!flashbackEntry) return null;
        const { entry, type } = flashbackEntry;
        const text = [entry.reflection_1, entry.reflection_2, entry.reflection_4, entry.notes]
            .find((r) => r && r.trim().length > 0)?.trim();
        if (!text) return null;

        return {
            text: text.length > 120 ? text.slice(0, 120) + '…' : text,
            reference: `${entry.book_name} ${entry.chapter_start}${
                entry.chapter_end && entry.chapter_end !== entry.chapter_start ? `–${entry.chapter_end}` : ''
            }`,
            when: type === 'year' ? 'a year ago' : type === 'month' ? 'a month ago' : 'from the archives',
        };
    }, [flashbackEntry]);

    /** The entry detail sheet, shared by both compositions. */
    const HomeDetailModal = () => (
        <>
        {/* Detail Modal */}
        <AnimatedModal
            visible={isDetailModalVisible}
            onRequestClose={() => setIsDetailModalVisible(false)}
        >
            {selectedEntry && (
                <JournalEntryDetail
                    entry={selectedEntry}
                    onEdit={(entry) => {
                        setIsDetailModalVisible(false);
                        router.push({
                            pathname: '/addEntry',
                            params: { entryId: entry.id!.toString() }
                        });
                    }}
                    onDelete={() => handleDelete(selectedEntry)}
                    onClose={() => setIsDetailModalVisible(false)}
                    onShare={() => handleShare(selectedEntry)}
                    isSharing={isSharing}
                    isDeleting={isDeleting}
                />
            )}
        </AnimatedModal>
        </>
    );

    /**
     * Colossal is a different screen, not a restyle.
     *
     * The mockup's Locked In home is five elements on a black ground with no
     * hero band, no entry count, no reminders and no add button. Branching the
     * whole composition here — rather than threading `isLockedIn` through eight
     * shared components — is what keeps each style honest to its own design.
     */
    if (isLockedIn) {
        return (
            <Screen>
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <LoadingView size={48} />
                    </View>
                ) : (
                    <LockedInHome
                        greeting={getDailyTitle()}
                        reading={nextReading}
                        readingNumber={nextReading?.id}
                        weekDays={weekDays}
                        flashback={observationCard ? null : flashbackForLockedIn}
                        today={todayStrip}
                        planProgress={planProgress}
                        onProgressPress={() => router.push('/land')}
                        onBeginReflection={handleBeginReflection}
                        onSettings={() => router.push('/settings')}
                        onWeekPress={() => router.push('/stats')}
                        onFlashbackPress={
                            flashbackEntry ? () => handleEntryPress(flashbackEntry.entry) : undefined
                        }
                        observation={observationCard}
                        draft={draft}
                        onResumeDraft={() =>
                            router.push({ pathname: '/addEntry', params: { resuming: 'true' } })
                        }
                        onAddEntry={() => router.push('/addEntry')}
                    />
                )}
                <HomeDetailModal />
                {echoReceipts}
            </Screen>
        );
    }

    return (
        /*
         * No top inset here: ClothHome's <Hero ownsTopInset> takes that space
         * into the indigo band itself, so the cloth runs to the top of the
         * screen rather than sitting under a strip of bare ecru.
         */
        <Screen edges={[]}>
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <View style={{ height: 400, justifyContent: 'center' }}>
                        <LoadingView size={48} />
                    </View>
                ) : (
                    /*
                     * design/all-screens.html #home, the `.cl` slot: four blocks
                     * under the band, in this order. WelcomeBack, the action
                     * reminders and the study reminders are drawn on neither
                     * style's Home — the design lists exactly "daily title, next
                     * reading, weekly streak, entry count and the flashback" —
                     * so they no longer render here.
                     */
                    <ClothHome
                        greeting={getDailyTitle()}
                        dateLine={homeDateLine}
                        reading={nextReading}
                        readingNumber={nextReading?.id}
                        weekDays={weekDays}
                        entryCount={stats.totalEntries}
                        flashback={observationCard ? null : flashbackForLockedIn}
                        today={todayStrip}
                        planProgress={planProgress}
                        onProgressPress={() => router.push('/land')}
                        onBeginReflection={handleBeginReflection}
                        onSettings={() => router.push('/settings')}
                        onWeekPress={() => router.push('/stats')}
                        onFlashbackPress={
                            flashbackEntry ? () => handleEntryPress(flashbackEntry.entry) : undefined
                        }
                        observation={observationCard}
                        draft={draft}
                        onResumeDraft={() =>
                            router.push({ pathname: '/addEntry', params: { resuming: 'true' } })
                        }
                        onAddEntry={() => router.push('/addEntry')}
                    />
                )}
            </ScrollView>

            <HomeDetailModal />
            {echoReceipts}

        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingBottom: Spacing.xxl,
    },
    header: {
        marginBottom: Spacing.xs,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        flex: 1,
        paddingRight: Spacing.md,
    },
    settingsButton: {
        width: Spacing.touchTarget,
        height: Spacing.touchTarget,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },

    statsContainer: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.xs + 1,
    },
    readingTitle: {
        marginTop: Spacing.sm + 1,
    },
    readingCta: {
        marginTop: Spacing.lg,
    },
    body: {
        padding: Spacing.layout.screenPadding,
        gap: Spacing.lg,
    },
    statCard: {
        flex: 1,
        gap: Spacing.xs,
    },
    statIconContainer: {
        width: 38,
        height: 38,
        borderRadius: Spacing.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statInfo: {
        flex: 1,
        gap: 0,
    },
    statValue: {
        fontSize: 20,
        fontWeight: Typography.weight.bold,
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: -2,
    },
    statUnit: {
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.6,
    },
    /* Update card */
    updateCardWrapper: {
        width: "100%",
    },
    updateCard: {
        borderRadius: Spacing.borderRadius.md,
        padding: Spacing.layout.cardPadding,
        borderWidth: 1,
    },
    updateHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: Spacing.sm,
    },
    updateBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: Spacing.borderRadius.sm,
        borderWidth: 1,
    },
    updateBadgeText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: Typography.letterSpacing.wide,
    },
    updateDate: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
    },
    updateTitle: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        marginBottom: 6,
        letterSpacing: Typography.letterSpacing.wide,
    },
    updateContent: {
        fontSize: Typography.size.md,
        lineHeight: Typography.lineHeight.md,
        letterSpacing: Typography.letterSpacing.wide,
    },
    /* Next Reading */
    nextReadingCard: {
        borderRadius: Spacing.borderRadius.lg,
        padding: 20,
        gap: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 2,
    },
    nextReadingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    nextReadingLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nextReadingIconWrap: {
        width: 24,
        height: 24,
        borderRadius: Spacing.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextReadingLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    nextReadingSectionPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Spacing.borderRadius.round,
        flexShrink: 1,
    },
    nextReadingSection: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
        flexShrink: 1,
    },
    nextReadingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    nextReadingText: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    nextReadingGo: {
        width: 44,
        height: 44,
        borderRadius: Spacing.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
