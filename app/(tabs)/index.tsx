import { Flashback } from '@/src/components/Flashback';
import { WeeklyStreak } from '@/src/components/WeeklyStreak';
import {
    getTotalEntryCount,
    JournalEntry,
    getReadingProgress,
    getLastCompletedReadingItemId,
    checkEntryCoversChapters,
    toggleReadingItem,
    getRecentStudyTopics,
} from "@/src/data/database";
import { READING_PLAN_DATA, ReadingItem } from "@/src/data/readingPlanData";
import { useTheme } from "@/src/theme/ThemeContext";
import { Spacing } from "@/src/theme/spacing";
import { Typography } from "@/src/theme/typography";
import { Book, Settings, ArrowRight, Notebook } from "lucide-react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { DeviceEventEmitter, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { WavyAddIcon } from '@/src/components/WavyAddIcon';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { ScalePressable } from '@/src/components/ScalePressable';
import { LoadingView } from '@/src/components/LoadingView';
import { CardFAB } from '@/src/components/CardFAB';
import { Share } from 'react-native';
import { useAlert } from '@/src/context/AlertContext';
import { deleteJournalEntry } from '@/src/data/database';
import { fetchWeeklyStreakData, DayStatus } from '@/src/components/WeeklyStreak';
import { ActionReminders, fetchActionRemindersData, EnhancedActionItem } from '@/src/components/ActionReminders';
import { StudyReminders } from '@/src/components/StudyReminders';
import { fetchFlashbackData } from '@/src/components/Flashback';
import { getDailyTitle } from '@/src/data/homeTitles';
import { Confetti, ConfettiRef } from '@/src/components/Confetti';
import { formatDateToLocalString } from '@/src/utils/dateUtils';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import {
    Card,
    ClothMark,
    Hero,
    Screen,
    Text as UIText,
    ThemedButton,
} from '@/src/components/ui';


const DRAFT_KEY = "reflection_draft";
import { LucideIcon } from "lucide-react-native";

interface StatCardProps {
    icon: LucideIcon;
    value: number;
    label: string;
    unit?: string;
}


const StatCard = React.memo(({ icon, value, label, unit }: StatCardProps) => {
    return (
        <Card style={styles.statCard}>
            <View style={styles.statRow}>
                <UIText variant="display">{value}</UIText>
                {unit ? <UIText variant="bodySmall" tone="secondary">{unit}</UIText> : null}
            </View>
            <UIText variant="label" tone="secondary">{label}</UIText>
        </Card>
    );
});

interface QuickStatsProps {
    totalEntries: number;
}

const QuickStats = React.memo(({ totalEntries }: QuickStatsProps) => {
    return (
        <View style={styles.statsContainer}>
            <StatCard icon={Notebook} value={totalEntries} label="Entries so far" />
        </View>
    );
});

// Shared by the normal NextReading card and LockedInHome so tapping "next reading"
// behaves identically in both modes.
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

interface NextReadingProps {
    nextItem: ReadingItem | null;
    onRefresh: () => void;
}

const NextReading = React.memo(({ nextItem, onRefresh }: NextReadingProps) => {
    const router = useRouter();

    const handlePress = useCallback(() => {
        if (!nextItem) return;
        handleNextReadingPress(nextItem, router, onRefresh);
    }, [nextItem, router, onRefresh]);

    if (!nextItem) return null;

    return (
        <View>
            <UIText variant="label">Today</UIText>
            <UIText variant="display" style={styles.readingTitle}>
                {nextItem.book} {nextItem.chapters}
            </UIText>
            <UIText variant="bodySmall" tone="secondary">{nextItem.section}</UIText>
            <ThemedButton
                label="Begin reflection"
                onPress={handlePress}
                block
                style={styles.readingCta}
                accessibilityHint={`Opens a reflection for ${nextItem.book} ${nextItem.chapters}`}
            />
        </View>
    );
});

const FloatingActionButton = React.memo(() => {
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    // Tab bar height (60) + bottom inset + extra spacing
    const bottomPosition = 60 + insets.bottom + Spacing.xl;

    // Both styles want maximum contrast against their own ground.
    const fabBackground = colors.textPrimary;
    const iconColor = colors.background;

    return (
        <ScalePressable
            style={[styles.fab, { backgroundColor: fabBackground, bottom: bottomPosition, shadowColor: fabBackground }]}
            onPress={() => router.push("/addEntry")}
        >
            <WavyAddIcon size={Typography.size.display} color={iconColor} />
        </ScalePressable>
    );
});

const DraftBar = React.memo(() => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    // Tab bar height (60) + bottom inset + extra spacing
    const bottomPosition = 60 + insets.bottom + Spacing.xl;

    return (
        <View
            style={[
                styles.draftBar,
                {
                    backgroundColor: colors.draftBar,
                    borderColor: colors.draftBarBorder,
                    shadowColor: colors.accent,
                    bottom: bottomPosition,
                },
            ]}
        >
            <Link href={{ pathname: "/addEntry", params: { resuming: 'true' } }} asChild>
                <ScalePressable style={styles.draftContent}>
                    <View style={styles.draftTextContainer}>
                        <Text style={[styles.draftLabel, { color: colors.textPrimary }]}>
                            Didn't finish?
                        </Text>
                        <Text style={[styles.draftSubtext, { color: colors.textSecondary }]}>
                            No worries, pick it up now
                        </Text>
                    </View>

                    <View style={[styles.draftIcon, { backgroundColor: colors.draftIconBg }]}>
                        <ArrowRight size={24} color={colors.accent} />
                    </View>
                </ScalePressable>
            </Link>
        </View>
    );
});

export default function Index() {
    const [stats, setStats] = useState({ totalEntries: 0 });
    const [nextReading, setNextReading] = useState<ReadingItem | null>(null);
    const [topics, setTopics] = useState<JournalEntry[]>([]);
    const [weekDays, setWeekDays] = useState<DayStatus[]>([]);
    const [actionReminders, setActionReminders] = useState<{ pinned: EnhancedActionItem[], rotating: EnhancedActionItem[] } | null>(null);
    const [flashbackEntry, setFlashbackEntry] = useState<{ entry: JournalEntry, type: 'year' | 'month' | 'random' } | null>(null);
    const [draftExists, setDraftExists] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showAlert } = useAlert();
    const scrollViewRef = useRef<ScrollView>(null);
    const confettiRef = useRef<ConfettiRef>(null);
    const { colors } = useTheme();
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

    const checkCelebration = useCallback(async (days: DayStatus[]) => {
        const isFullWeek = days.length === 7 && days.every(d => d.hasEntry);
        if (!isFullWeek) return;

        const today = new Date();
        const currentDay = today.getDay();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDay);
        sunday.setHours(0, 0, 0, 0);

        const weekKey = `celebrated_week_${formatDateToLocalString(sunday)}`;
        const hasCelebrated = await AsyncStorage.getItem(weekKey);

        if (!hasCelebrated) {
            // Short delay to let the screen content settle
            setTimeout(() => {
                confettiRef.current?.start();
            }, 500);
            await AsyncStorage.setItem(weekKey, 'true');
        }
    }, []);

    const loadHomeData = useCallback(async () => {
        try {
            const [
                newStats,
                newNextReading,
                newTopics,
                newWeekDays,
                newActionReminders,
                newFlashback
            ] = await Promise.all([
                loadStats(),
                loadNextReading(),
                getRecentStudyTopics(7),
                fetchWeeklyStreakData(),
                fetchActionRemindersData(),
                fetchFlashbackData()
            ]);

            setStats(newStats);
            setNextReading(newNextReading);
            setTopics(newTopics);
            setWeekDays(newWeekDays);
            setActionReminders(newActionReminders);
            setFlashbackEntry(newFlashback);

            // Check for weekly streak celebration
            checkCelebration(newWeekDays);
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
            const draft = await AsyncStorage.getItem(DRAFT_KEY);
            setDraftExists(Boolean(draft && draft.trim()));
        } catch (error) {
            console.error('Error checking draft:', error);
            setDraftExists(false);
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

    // Bottom position for FAB in the modal:
    // Insets bottom + extra spacing
    const insets = useSafeAreaInsets();
    const fabBottomPosition = insets.bottom + Spacing.xl;

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

    return (
        <Screen>
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Hero>
                    <View style={styles.headerTitleRow}>
                        <UIText
                            variant="display"
                            tone="inverse"
                            style={styles.title}
                            numberOfLines={2}
                        >
                            {getDailyTitle()}
                        </UIText>
                        <ScalePressable
                            style={styles.settingsButton}
                            onPress={() => router.push('/settings')}
                            accessibilityRole="button"
                            accessibilityLabel="Settings"
                        >
                            <Settings size={19} color={colors.accent} />
                        </ScalePressable>
                    </View>
                </Hero>

                <View style={styles.body}>
                {isLoading ? (
                    <View style={{ height: 400, justifyContent: 'center' }}>
                        <LoadingView size={48} />
                    </View>
                ) : (
                    <>
                        <QuickStats totalEntries={stats.totalEntries} />
                        <NextReading nextItem={nextReading} onRefresh={loadHomeData} />
                        <WeeklyStreak weekDays={weekDays} />
                        <ActionReminders
                            pinnedItems={actionReminders?.pinned}
                            rotatingItems={actionReminders?.rotating}
                            onEntryPress={handleEntryPress}
                        />
                        <StudyReminders topics={topics} onEntryPress={handleEntryPress} />
                        <Flashback flashbackData={flashbackEntry} onEntryPress={handleEntryPress} />
                    </>
                )}
                </View>
            </ScrollView>

            <Confetti ref={confettiRef} />

            {!draftExists && <FloatingActionButton />}
            {draftExists && <DraftBar />}

            {/* Detail Modal */}
            <AnimatedModal
                visible={isDetailModalVisible}
                onRequestClose={() => setIsDetailModalVisible(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    {selectedEntry && (
                        <>
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
                            />
                            <CardFAB
                                onShare={() => handleShare(selectedEntry)}
                                onEdit={() => {
                                    setIsDetailModalVisible(false);
                                    router.push({
                                        pathname: '/addEntry',
                                        params: { entryId: selectedEntry.id!.toString() }
                                    });
                                }}
                                onDelete={() => handleDelete(selectedEntry)}
                                isSharing={isSharing}
                                isDeleting={isDeleting}
                                bottom={fabBottomPosition}
                                rounded={true}
                            />
                        </>
                    )}
                </SafeAreaView>
            </AnimatedModal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingBottom: 185,
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
        borderRadius: 12,
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

    /* Draft bar */
    draftBar: {
        position: "absolute",
        left: Spacing.lg,
        right: Spacing.lg,
        marginBottom: 4,
        marginHorizontal: 1.5,
        borderRadius: Spacing.borderRadius.lg,
        borderBottomEndRadius: 4,
        borderBottomStartRadius: 4,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    draftContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: Spacing.layout.cardPadding,
        paddingHorizontal: Spacing.xl,
    },
    draftTextContainer: {
        flex: 1,
    },
    draftLabel: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        marginBottom: 2,
    },
    draftSubtext: {
        fontSize: Typography.size.md,
        letterSpacing: Typography.letterSpacing.wide,
    },
    draftIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },

    /* FAB */
    fab: {
        position: 'absolute',
        right: 16,
        width: 104.5,
        height: 75.8,
        marginBottom: 4,
        borderRadius: 20,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    /* Next Reading */
    nextReadingCard: {
        borderRadius: 20,
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
        borderRadius: 8,
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
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    nextReadingGo: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
