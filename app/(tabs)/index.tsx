import { Flashback } from '@/src/components/Flashback';
import { WeeklyStreak } from '@/src/components/WeeklyStreak';
import {
    getMissedDaysCount,
    getTotalEntryCount,
    JournalEntry,
    getReadingProgress,
    getLastCompletedReadingItemId,
    checkEntryCoversChapters,
    toggleReadingItem,
    getRecentStudyTopics, // Added import
} from "@/src/data/database";
import { READING_PLAN_DATA, ReadingItem } from "@/src/data/readingPlanData";
import { useTheme } from "@/src/theme/ThemeContext";
import { Spacing } from "@/src/theme/spacing";
import { Typography } from "@/src/theme/typography";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { DeviceEventEmitter, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { WavyAddIcon } from '@/src/components/WavyAddIcon';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { ScalePressable } from '@/src/components/ScalePressable';
import { LoadingView } from '@/src/components/LoadingView';
import { fetchWeeklyStreakData, DayStatus } from '@/src/components/WeeklyStreak';
import { ActionReminders, fetchActionRemindersData, EnhancedActionItem } from '@/src/components/ActionReminders';
import { StudyReminders } from '@/src/components/StudyReminders';
import { fetchFlashbackData } from '@/src/components/Flashback';
import { getDailyTitle } from '@/src/data/homeTitles';


const DRAFT_KEY = "reflection_draft";
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface StatCardProps {
    icon: IoniconName;
    value: number;
}

const AnimatedFlame = React.memo(({ size, color }: { size: number; color: string }) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.9);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 600 }),
                withTiming(1, { duration: 800 })
            ),
            -1,
            true
        );
        opacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 400 }),
                withTiming(0.7, { duration: 600 })
            ),
            -1,
            true
        );
    }, [scale, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={animatedStyle}>
            <Ionicons name="flame" size={size} color={color} />
        </Animated.View>
    );
});

const StatCard = React.memo(({ icon, value }: StatCardProps) => {
    const { colors } = useTheme();
    const isFlame = icon === 'flame' && value > 0;

    return (
        <View
            style={[
                styles.statCard,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.cardBorder,
                },
            ]}
        >
            <View style={[styles.statIconContainer, { backgroundColor: isFlame ? colors.accent + '20' : colors.accent + '10' }]}>
                {isFlame ? (
                    <AnimatedFlame size={20} color={colors.accent} />
                ) : (
                    <Ionicons
                        name={icon}
                        size={20}
                        color={colors.accent}
                    />
                )}
            </View>

            <View style={styles.statInfo}>
                <Text
                    style={[
                        styles.statValue,
                        { color: colors.textPrimary },
                    ]}
                >
                    {value}
                </Text>
            </View>
        </View>
    );
});

interface QuickStatsProps {
    totalEntries: number;
    missedDays: number;
}

const QuickStats = React.memo(({ totalEntries, missedDays }: QuickStatsProps) => {
    return (
        <View style={styles.statsContainer}>
            <StatCard icon="journal" value={totalEntries} />
            <StatCard icon="snow" value={missedDays} />
        </View>
    );
});

interface NextReadingProps {
    nextItem: ReadingItem | null;
    onRefresh: () => void;
}

const NextReading = React.memo(({ nextItem, onRefresh }: NextReadingProps) => {
    const { colors } = useTheme();
    const router = useRouter();

    const handlePress = useCallback(async () => {
        if (!nextItem) return;

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
    }, [nextItem, router, onRefresh]);

    if (!nextItem) return null;

    return (
        <View>
            <ScalePressable onPress={handlePress}>
                <View style={[styles.nextReadingCard, { backgroundColor: colors.accent }]}>
                    <View style={styles.nextReadingHeader}>
                        <View style={styles.nextReadingLabelContainer}>
                            <View style={[styles.nextReadingIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                <Ionicons name="book" size={12} color={colors.background} />
                            </View>
                            <Text style={[styles.nextReadingLabel, { color: colors.background }]}>NEXT READING</Text>
                        </View>
                        <View style={[styles.nextReadingSectionPill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                            <Text style={[styles.nextReadingSection, { color: colors.background }]} numberOfLines={1}>
                                {nextItem.section}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.nextReadingContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.nextReadingText, { color: colors.background }]}>
                                {nextItem.book} {nextItem.chapters}
                            </Text>
                        </View>
                        <View style={[styles.nextReadingGo, { backgroundColor: colors.background, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}>
                            <Ionicons name="arrow-forward" size={18} color={colors.accent} />
                        </View>
                    </View>
                </View>
            </ScalePressable>
        </View>
    );
});

const FloatingActionButton = React.memo(() => {
    const { colors, isDark } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    // Tab bar height (60) + bottom inset + extra spacing
    const bottomPosition = 60 + insets.bottom + Spacing.xl;

    // Use light neutral color in dark mode, dark in light mode
    const fabBackground = isDark ? colors.textPrimary : colors.textPrimary;
    const iconColor = isDark ? colors.background : '#FFFFFF';

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
            <Link href="/addEntry" asChild>
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
                        <Ionicons name="arrow-forward" size={Typography.size.xl} color={colors.accent} />
                    </View>
                </ScalePressable>
            </Link>
        </View>
    );
});

export default function Index() {
    const [stats, setStats] = useState({ totalEntries: 0, missedDays: 0 });
    const [nextReading, setNextReading] = useState<ReadingItem | null>(null);
    const [topics, setTopics] = useState<JournalEntry[]>([]);
    const [weekDays, setWeekDays] = useState<DayStatus[]>([]);
    const [actionReminders, setActionReminders] = useState<{ pinned: EnhancedActionItem[], rotating: EnhancedActionItem[] } | null>(null);
    const [flashbackEntry, setFlashbackEntry] = useState<{ entry: JournalEntry, type: 'year' | 'month' | 'random' } | null>(null);
    const [draftExists, setDraftExists] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);
    const { colors } = useTheme();
    const router = useRouter();

    const loadStats = useCallback(async () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const [totalEntries, missedDays] = await Promise.all([
            getTotalEntryCount(currentMonth),
            getMissedDaysCount(currentMonth),
        ]);
        return { totalEntries, missedDays };
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <Text
                            style={[styles.title, { color: colors.textPrimary }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.6}
                        >
                            {getDailyTitle()}
                        </Text>
                    </View>
                </View>

                {isLoading ? (
                    <View style={{ height: 400, justifyContent: 'center' }}>
                        <LoadingView size={48} />
                    </View>
                ) : (
                    <>
                        <QuickStats totalEntries={stats.totalEntries} missedDays={stats.missedDays} />
                        <NextReading nextItem={nextReading} onRefresh={loadHomeData} />
                        <StudyReminders topics={topics} onEntryPress={handleEntryPress} />
                        <WeeklyStreak weekDays={weekDays} />
                        <ActionReminders
                            pinnedItems={actionReminders?.pinned}
                            rotatingItems={actionReminders?.rotating}
                            onEntryPress={handleEntryPress}
                        />
                        <Flashback flashbackData={flashbackEntry} onEntryPress={handleEntryPress} />
                    </>
                )}
            </ScrollView>

            {!draftExists && <FloatingActionButton />}
            {draftExists && <DraftBar />}

            {/* Detail Modal */}
            <AnimatedModal
                visible={isDetailModalVisible}
                onRequestClose={() => setIsDetailModalVisible(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
                            onDelete={() => {
                                setIsDetailModalVisible(false);
                            }}
                            onClose={() => setIsDetailModalVisible(false)}
                        />
                    )}
                </SafeAreaView>
            </AnimatedModal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 185,
        gap: Spacing.layout.cardPadding,
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
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
    },

    statsContainer: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    statCard: {
        flex: 1,
        borderRadius: Spacing.borderRadius.md,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: "center",
        gap: Spacing.md,
        borderWidth: 1,
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
        left: Spacing.xl,
        right: Spacing.xl,
        borderRadius: Spacing.borderRadius.lg,
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
        right: Spacing.layout.screenPadding,
        width: 64,
        height: 64,
        borderRadius: 32,
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
        elevation: 5,
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
