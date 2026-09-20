import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    ScrollView,
    TouchableOpacity,
    Platform,
    LayoutAnimation,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
    Clock,
    Library,
    Zap,
    Bookmark,
    Check,
    Plus,
    Notebook,
    LucideIcon,
    BookCopy
} from 'lucide-react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { ScalePressable } from '@/src/components/ScalePressable';
import { LoadingView } from '@/src/components/LoadingView';
import { BibleBook } from '@/src/data/bibleBooks';

// Journal imports
import { JournalEntryList } from '@/src/components/JournalEntryList';
import { JournalEntry } from '@/src/data/database';

// Plan imports
import { READING_PLAN_DATA, ReadingItem } from '@/src/data/readingPlanData';
import { getReadingProgress, toggleReadingItem, checkEntryCoversChapters } from '@/src/data/database';
import { useAlert } from '@/src/context/AlertContext';
import * as WebBrowser from 'expo-web-browser';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = 'recent' | 'books' | 'bookDetail' | 'actions' | 'topics';
/** 'bookDetail' is a drill-in from Books, not a tab of its own. */
export type Tab = ViewMode | 'plan';

type PlanListDataItem =
    | { type: 'sectionHeader'; section: string; id: string }
    | { type: 'reading'; item: ReadingItem; id: string };

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS: { key: Exclude<Tab, 'bookDetail'>; label: string; icon: LucideIcon }[] = [
    { key: 'recent', label: 'Entries', icon: Clock },
    { key: 'books', label: 'Books', icon: BookCopy },
    { key: 'actions', label: 'Actions', icon: Zap },
    { key: 'topics', label: 'Follow-ups', icon: Bookmark },
    { key: 'plan', label: 'Plan', icon: Library },
];

// ─── Plan Progress Bar ────────────────────────────────────────────────────────

function PlanProgressBar({ progress }: { progress: number }) {
    const { colors } = useTheme();
    if (progress === 0) return null;
    return (
        <View style={styles.planProgressRow}>
            <View style={[styles.planProgressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.planProgressFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
            </View>
            <Text style={[styles.planProgressPct, { color: colors.accent }]}>
                {parseFloat(progress.toFixed(2))}%
            </Text>
        </View>
    );
}

// ─── Plan Section Header ──────────────────────────────────────────────────────

const PlanSectionHeader = React.memo(({
    title,
    isCollapsed,
    onToggle,
    completedCount,
    totalCount
}: {
    title: string;
    isCollapsed: boolean;
    onToggle: () => void;
    completedCount: number;
    totalCount: number;
}) => {
    const { colors } = useTheme();
    const isDone = completedCount === totalCount && totalCount > 0;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggle}
            style={[
                styles.planSectionHeader,
                { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }
            ]}
        >
            <View style={styles.planSectionTitleContainer}>
                <Text style={[styles.planSectionTitle, { color: colors.textPrimary }]}>{title.toUpperCase()}</Text>
                <View style={[styles.planSectionBadge, { backgroundColor: isDone ? colors.accent + '20' : colors.border }]}>
                    <Text style={[styles.planSectionProgress, { color: isDone ? colors.accent : colors.textSecondary }]}>
                        {completedCount}/{totalCount}
                    </Text>
                </View>
            </View>

            <View style={styles.planSectionHeaderRight}>
                {isDone && <Ionicons name="checkmark-circle" size={16} color={colors.accent} />}
                <Ionicons
                    name={isCollapsed ? "chevron-forward" : "chevron-down"}
                    size={16}
                    color={colors.textTertiary}
                    style={{ marginLeft: 8 }}
                />
            </View>
        </TouchableOpacity>
    );
});

// ─── Reading Card ─────────────────────────────────────────────────────────────

const ReadingCard = React.memo(({
    item,
    isCompleted,
    onToggle
}: {
    item: ReadingItem;
    isCompleted: boolean;
    onToggle: (id: number, completed: boolean) => void;
}) => {
    const { colors } = useTheme();

    return (
        <ScalePressable
            style={[
                styles.planCard,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: isCompleted ? colors.accent + '30' : colors.cardBorder,
                },
                item.isKey && !isCompleted && {
                    borderColor: item.id <= 286 ? '#E53935' + '60' : '#1E88E560',
                    backgroundColor: item.id <= 286 ? '#E53935' + '05' : '#1E88E505',
                }
            ]}
            onPress={() => onToggle(item.id, !isCompleted)}
        >
            <View style={styles.planCardContent}>
                <View style={styles.planBookInfo}>
                    <View style={styles.planBookHeader}>
                        {item.isKey && item.id <= 286 && (
                            <View style={[styles.redDiamond, { backgroundColor: '#E53935' }]} />
                        )}
                        {item.isKey && item.id > 286 && (
                            <View style={[styles.blueDot, { backgroundColor: '#1E88E5' }]} />
                        )}
                        <Text style={[
                            styles.planBookName,
                            { color: isCompleted ? colors.textTertiary : colors.textPrimary },
                            isCompleted && { textDecorationLine: 'line-through' }
                        ]}>
                            {item.book}
                        </Text>
                    </View>
                    <Text style={[
                        styles.planChapters,
                        { color: isCompleted ? colors.textMuted : colors.textSecondary }
                    ]}>
                        {item.chapters || "Full Book"}
                    </Text>
                </View>

                <View style={[
                    styles.planCheckbox,
                    {
                        backgroundColor: isCompleted ? colors.accent : 'transparent',
                        borderColor: isCompleted ? colors.accent : colors.border,
                    }
                ]}>
                    {isCompleted && <Check size={14} color={colors.background} />}
                </View>
            </View>
        </ScalePressable>
    );
});

// ─── Journal Content ──────────────────────────────────────────────────────────

interface JournalContentProps {
    viewMode: ViewMode;
    searchQuery: string;
    selectedBook?: BibleBook;
    onViewModeChange: (mode: ViewMode) => void;
    onSearchChange: (q: string) => void;
    onSelectedBookChange: (book: BibleBook | undefined) => void;
    onCountChange: (count: number) => void;
}

function JournalContent({
    viewMode,
    searchQuery,
    selectedBook,
    onViewModeChange,
    onSearchChange,
    onSelectedBookChange,
    onCountChange,
}: JournalContentProps) {
    const router = useRouter();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleEntryPress = (entry: JournalEntry) => {
        router.push(`/library/${entry.id}`);
    };


    return (
        <View style={{ flex: 1 }}>
            <JournalEntryList
                onEntryPress={handleEntryPress}
                refreshTrigger={refreshTrigger}
                viewMode={viewMode}
                searchQuery={searchQuery}
                selectedBook={selectedBook}
                onViewModeChange={onViewModeChange}
                onSearchChange={onSearchChange}
                onSelectedBookChange={onSelectedBookChange}
                onCountChange={onCountChange}
            />
        </View>
    );
}

// ─── Plan Content ─────────────────────────────────────────────────────────────

function PlanContent({ onProgressChange }: { onProgressChange: (p: number) => void }) {
    const { colors } = useTheme();
    const router = useRouter();
    const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState(0);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const { showAlert } = useAlert();
    const flatListRef = useRef<FlatList>(null);

    const sectionData = React.useMemo(() => {
        const counts: Record<string, { completed: number; total: number }> = {};
        READING_PLAN_DATA.forEach(item => {
            if (!counts[item.section]) counts[item.section] = { completed: 0, total: 0 };
            counts[item.section].total++;
            if (completedItems.has(item.id)) counts[item.section].completed++;
        });
        return counts;
    }, [completedItems]);

    const updateProgress = useCallback((newCompleted: Set<number>) => {
        const p = parseFloat(((newCompleted.size / READING_PLAN_DATA.length) * 100).toFixed(2));
        setProgress(p);
        onProgressChange(p);
    }, [onProgressChange]);

    const loadProgress = useCallback(async () => {
        const progressIds = await getReadingProgress();
        const completedSet = new Set(progressIds);
        setCompletedItems(completedSet);
        updateProgress(completedSet);

        if (isInitialLoad) {
            const nextItem = READING_PLAN_DATA.find(item => !completedSet.has(item.id));
            if (nextItem) {
                const allSections = Array.from(new Set(READING_PLAN_DATA.map(i => i.section)));
                const collapsed = new Set(allSections.filter(s => s !== nextItem.section));
                setCollapsedSections(collapsed);
            }
            setIsInitialLoad(false);
        }
    }, [isInitialLoad, updateProgress]);

    useFocusEffect(useCallback(() => { loadProgress(); }, [loadProgress]));

    const handleToggle = useCallback(async (id: number, completed: boolean) => {
        if (completed) {
            const item = READING_PLAN_DATA.find(i => i.id === id);
            if (!item) return;

            const rawChapters = item.chapters;
            const parts = rawChapters.split('-');
            const firstHasVerse = parts[0].includes(':');
            const planStart = parseInt(parts[0].split(':')[0], 10);

            let planEnd: number;
            if (parts.length > 1) {
                planEnd = firstHasVerse ? planStart : parseInt(parts[parts.length - 1].split(':')[0], 10);
            } else {
                planEnd = planStart;
            }

            if (isNaN(planStart)) {
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                updateProgress(newCompleted);
                return;
            }

            const isCovered = await checkEntryCoversChapters(item.book, planStart, planEnd);
            if (isCovered) {
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                updateProgress(newCompleted);
            } else {
                const book = item.book;
                const chapters = item.chapters;
                showAlert({
                    title: 'Entry Required',
                    message: `To mark ${book}${chapters ? ` ${chapters}` : ''} as complete, you need an entry covering this reading.`,
                    icon: Notebook,
                    buttons: [
                        {
                            text: 'Add Entry',
                            icon: Plus,
                            onPress: () => router.push({
                                pathname: '/addEntry',
                                params: {
                                    readingItemId: item.id,
                                    bookName: book,
                                    chapters: chapters,
                                },
                            }),
                        },
                        { text: 'Cancel', style: 'cancel' },
                    ],
                });
            }
        } else {
            await toggleReadingItem(id, false);
            const newCompleted = new Set(completedItems);
            newCompleted.delete(id);
            setCompletedItems(newCompleted);
            updateProgress(newCompleted);
        }
    }, [completedItems, updateProgress]);

    const toggleSection = useCallback((section: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedSections(prev => {
            const newCollapsed = new Set(prev);
            if (newCollapsed.has(section)) newCollapsed.delete(section);
            else newCollapsed.add(section);
            return newCollapsed;
        });
    }, []);

    const flatListData = useMemo(() => {
        const result: PlanListDataItem[] = [];
        let lastSection = '';
        for (const item of READING_PLAN_DATA) {
            if (item.section !== lastSection) {
                result.push({ type: 'sectionHeader', section: item.section, id: `section-${item.section}` });
                lastSection = item.section;
            }
            if (!collapsedSections.has(item.section)) {
                result.push({ type: 'reading', item, id: `reading-${item.id}` });
            }
        }
        return result;
    }, [collapsedSections]);

    const renderItem = useCallback(({ item }: { item: PlanListDataItem }) => {
        if (item.type === 'sectionHeader') {
            const stats = sectionData[item.section] || { completed: 0, total: 0 };
            return (
                <PlanSectionHeader
                    title={item.section}
                    isCollapsed={collapsedSections.has(item.section)}
                    onToggle={() => toggleSection(item.section)}
                    completedCount={stats.completed}
                    totalCount={stats.total}
                />
            );
        }
        return (
            <ReadingCard
                item={item.item}
                isCompleted={completedItems.has(item.item.id)}
                onToggle={handleToggle}
            />
        );
    }, [sectionData, collapsedSections, completedItems, handleToggle, toggleSection]);

    const renderHeader = useCallback(() => {
        if (progress > 0) return null;

        return (
            <View style={[styles.planLegendContainer, { backgroundColor: colors.backgroundSubtle, marginBottom: Spacing.md }]}>
                <View style={styles.planLegendItem}>
                    <View style={[styles.redDiamond, { backgroundColor: '#E53935', marginTop: 4 }]} />
                    <Text style={[styles.planLegendText, { color: colors.textSecondary }]}>
                        Historical overview of God's dealings with the Israelites
                    </Text>
                </View>
                <View style={styles.planLegendItem}>
                    <View style={[styles.blueDot, { backgroundColor: '#1E88E5', marginTop: 4 }]} />
                    <Text style={[styles.planLegendText, { color: colors.textSecondary }]}>
                        Chronological overview of the development of the Christian congregation
                    </Text>
                </View>
            </View>
        );
    }, [colors, progress]);

    const renderFooter = useCallback(() => {
        const url = 'https://www.jw.org/en/library/series/more-topics/bible-reading-plan/';
        return (
            <View>
                {progress > 0 && (
                    <View style={[styles.planLegendContainer, { backgroundColor: colors.backgroundSubtle }]}>
                        <View style={styles.planLegendItem}>
                            <View style={[styles.redDiamond, { backgroundColor: '#E53935', marginTop: 4 }]} />
                            <Text style={[styles.planLegendText, { color: colors.textSecondary }]}>
                                Historical overview of God's dealings with the Israelites
                            </Text>
                        </View>
                        <View style={styles.planLegendItem}>
                            <View style={[styles.blueDot, { backgroundColor: '#1E88E5', marginTop: 4 }]} />
                            <Text style={[styles.planLegendText, { color: colors.textSecondary }]}>
                                Chronological overview of the development of the Christian congregation
                            </Text>
                        </View>
                    </View>
                )}
                <Text style={[styles.planFootnote, { color: colors.textSecondary, marginTop: Spacing.xl }]}>
                    * This reading plan was adapted from the Bible Reading Plan found on{' '}
                    <Text
                        style={{ textDecorationLine: 'underline', color: colors.accent }}
                        onPress={() => WebBrowser.openBrowserAsync(url)}
                    >
                        jw.org
                    </Text>
                </Text>
            </View>
        );
    }, [colors.textSecondary, colors.accent, colors.backgroundSubtle, progress]);

    const keyExtractor = useCallback((item: PlanListDataItem) => item.id, []);

    return (
        <View style={{ flex: 1 }}>
            {isInitialLoad ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <LoadingView size={48} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={flatListData}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.planListContent}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={15}
                    maxToRenderPerBatch={15}
                    windowSize={7}
                    removeClippedSubviews={Platform.OS === 'android'}
                />
            )}
        </View>
    );
}

// ─── Main Library Screen ──────────────────────────────────────────────────────

export default function LibraryScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();

    const [tab, setTab] = useState<Tab>((params.view as Tab) || 'recent');
    const [journalSearch, setJournalSearch] = useState('');
    const [journalSelectedBook, setJournalSelectedBook] = useState<BibleBook | undefined>();
    const [journalCount, setJournalCount] = useState(0);
    const [planProgress, setPlanProgress] = useState(0);

    // Books drills into bookDetail, so that view keeps the Books tab lit.
    const activeTabKey = tab === 'bookDetail' ? 'books' : tab;
    const showSearch = tab === 'recent' || tab === 'bookDetail';

    const handleNavigate = useCallback((next: Tab) => {
        setTab(next);
        setJournalSearch('');
        if (next !== 'bookDetail') setJournalSelectedBook(undefined);
    }, []);

    useEffect(() => {
        if (params.openEntryId) {
            const entryId = params.openEntryId as string;
            router.push(`/library/${entryId}`);
            router.setParams({ openEntryId: undefined });
        }
    }, [params.openEntryId]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>

            {/* ── Header Zone ───────────────────────────────────────────────── */}
            <View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsRow}
                >
                    {TABS.map(t => {
                        const isActive = activeTabKey === t.key;
                        return (
                            <ScalePressable
                                key={t.key}
                                style={[
                                    styles.tabPill,
                                    { backgroundColor: isActive ? colors.accent + '15' : colors.backgroundSubtle },
                                ]}
                                onPress={() => handleNavigate(t.key)}
                            >
                                {React.createElement(t.icon, {
                                    size: 16,
                                    color: isActive ? colors.accent : colors.textTertiary,
                                })}
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        { color: isActive ? colors.accent : colors.textSecondary },
                                    ]}
                                >
                                    {t.label}
                                </Text>
                            </ScalePressable>
                        );
                    })}
                </ScrollView>

                {tab === 'bookDetail' && journalSelectedBook && (
                    <View style={[styles.breadcrumbRow, { borderBottomColor: colors.border }]}>
                        <ScalePressable onPress={() => handleNavigate('books')}>
                            <Text style={[styles.breadcrumbText, { color: colors.textSecondary }]}>Books</Text>
                        </ScalePressable>
                        <Text style={[styles.breadcrumbSep, { color: colors.textTertiary }]}> / </Text>
                        <Text style={[styles.breadcrumbCurrent, { color: colors.textPrimary }]}>
                            {journalSelectedBook.name}
                        </Text>
                    </View>
                )}

                {showSearch && (
                    <View style={[styles.searchContainer, { borderBottomColor: colors.border, borderTopColor: colors.border }]}>
                        <TextInput
                            style={[styles.searchInput, {
                                backgroundColor: colors.searchBackground,
                                color: colors.textPrimary,
                                borderColor: colors.border,
                            }]}
                            placeholder={
                                tab === 'bookDetail' && journalSelectedBook
                                    ? `Search ${journalSelectedBook.name}...`
                                    : journalCount > 0
                                        ? `Search ${journalCount} entries...`
                                        : 'Search entries...'
                            }
                            placeholderTextColor={colors.textTertiary}
                            value={journalSearch}
                            onChangeText={setJournalSearch}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {journalSearch.length > 0 && (
                            <ScalePressable style={styles.clearSearch} onPress={() => setJournalSearch('')}>
                                <Text style={[styles.clearSearchText, { color: colors.textSecondary }]}>×</Text>
                            </ScalePressable>
                        )}
                    </View>
                )}

                {tab === 'plan' && <PlanProgressBar progress={planProgress} />}
            </View>

            {/* ── Content Zone ──────────────────────────────────────────────── */}
            {tab === 'plan' ? (
                <PlanContent onProgressChange={setPlanProgress} />
            ) : (
                <JournalContent
                    viewMode={tab}
                    searchQuery={journalSearch}
                    selectedBook={journalSelectedBook}
                    onViewModeChange={setTab}
                    onSearchChange={setJournalSearch}
                    onSelectedBookChange={setJournalSelectedBook}
                    onCountChange={setJournalCount}
                />
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },

    // ── Header: single tab row ─────────────────────────────────────
    tabsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 14,
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },

    // ── Header: title row ──────────────────────────────────────────

    // ── PixelPlay-style pill group ─────────────────────────────────

    // ── Study sort button ──────────────────────────────────────────

    // ── Floating dropdown ─────────────────────────────────────────

    // ── Segment pill row ────────────────────────────────────────────

    // ── Journal sub-tabs ───────────────────────────────────────────
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    breadcrumbText: { fontSize: 14, fontWeight: '400' },
    breadcrumbSep: { fontSize: 14, marginHorizontal: 6 },
    breadcrumbCurrent: { fontSize: 14, fontWeight: '600' },

    // ── Search bar ─────────────────────────────────────────────────
    searchContainer: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: 15,
        borderTopWidth: 0.5,
        borderBottomWidth: 0.5,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        borderWidth: 1,
        fontWeight: '500',
    },
    clearSearch: {
        marginLeft: 10, width: 32, height: 32,
        borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    },
    clearSearchText: { fontSize: 18, fontWeight: '300' },

    // ── Plan progress bar ──────────────────────────────────────────
    planProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: 10,
        gap: 12,
    },
    planProgressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    planProgressFill: { height: '100%', borderRadius: 3 },
    planProgressPct: { fontSize: 13, fontWeight: '800', letterSpacing: -0.5, minWidth: 46, textAlign: 'right' },

    // ── Study ──────────────────────────────────────────────────────

    // ── Plan ───────────────────────────────────────────────────────
    planListContent: { paddingHorizontal: Spacing.layout.screenPadding, paddingTop: 0, paddingBottom: 120 },
    planSectionHeader: {
        marginTop: Spacing.lg, marginBottom: Spacing.sm,
        paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: 14, borderWidth: 1,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    planSectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    planSectionTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, paddingRight: Spacing.md },
    planSectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, flexShrink: 1 },
    planSectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    planSectionProgress: { fontSize: 10, fontWeight: '800' },
    planCard: { borderRadius: 16, borderWidth: 1, marginBottom: Spacing.xs, padding: 16 },
    planCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    planBookInfo: { flex: 1, gap: 2 },
    planBookHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    planBookName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
    planChapters: { fontSize: 14, letterSpacing: 0.1 },
    planCheckbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    redDiamond: { width: 8, height: 8, transform: [{ rotate: '45deg' }] },
    blueDot: { width: 8, height: 8, borderRadius: 4 },
    planLegendContainer: { marginTop: Spacing.xl, gap: Spacing.md, padding: Spacing.md, borderRadius: 12 },
    planLegendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    planLegendText: { fontSize: 13, flex: 1, lineHeight: 18 },
    planFootnote: { fontSize: 10, lineHeight: 14, fontStyle: 'italic' },
});
