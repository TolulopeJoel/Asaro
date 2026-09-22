import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { StyleSheet, View, FlatList, ScrollView, TouchableOpacity, Platform, LayoutAnimation, TextInput } from 'react-native';
import {
    Clock,
    Library,
    Zap,
    Bookmark,
    Check,
    Plus,
    Notebook,
    LucideIcon,
    BookCopy,
    Sparkles,
    ChevronLeft
} from 'lucide-react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { formatRange } from '@/src/utils/reference';
import { scheduleLabel } from '@/src/data/planSchedule';
import { ScalePressable } from '@/src/components/ScalePressable';
import { LoadingView } from '@/src/components/LoadingView';
import { BibleBook } from '@/src/data/bibleBooks';
import {
    Hero,
    Screen,
    Segments,
    Text as UIText,
    textStyle,
} from '@/src/components/ui';

// Journal imports
import { JournalEntryList } from '@/src/components/JournalEntryList';
import { JournalEntry } from '@/src/data/database';
import { ThemesContent } from '@/src/components/ThemesContent';

// Plan imports
import { READING_PLAN_DATA, ReadingItem } from '@/src/data/readingPlanData';
import { getReadingProgress, toggleReadingItem, checkEntryCoversChapters } from '@/src/data/database';
import { useAlert } from '@/src/context/AlertContext';
import * as WebBrowser from 'expo-web-browser';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = 'recent' | 'books' | 'bookDetail' | 'actions' | 'topics';
/** 'bookDetail' is a drill-in from Books, not a tab of its own. */
export type Tab = ViewMode | 'plan' | 'themes';

type PlanListDataItem =
    | { type: 'sectionHeader'; section: string; id: string }
    | { type: 'reading'; item: ReadingItem; id: string };

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS: { key: Exclude<Tab, 'bookDetail'>; label: string; icon: LucideIcon }[] = [
    { key: 'recent', label: 'Recent', icon: Clock },
    { key: 'books', label: 'Books', icon: BookCopy },
    { key: 'actions', label: 'Actions', icon: Zap },
    { key: 'topics', label: 'Follow-ups', icon: Bookmark },
    { key: 'themes', label: 'Themes', icon: Sparkles },
    { key: 'plan', label: 'Plan', icon: Library },
];

/**
 * The `.co-mark` over each tab — the small caps line the mockup puts where
 * Cloth puts its hero band. Books drills into a screen with its own header, so
 * it never reads this.
 */
const MARK: Partial<Record<Tab, string>> = {
    recent: 'Library',
    books: 'Library',
    plan: 'Library · Plan',
    actions: 'Library · Actions',
    topics: 'Library · Follow-ups',
    themes: 'Library · Themes',
};

// ─── Plan Progress Bar ────────────────────────────────────────────────────────

function PlanProgressBar({ progress }: { progress: number }) {
    const { colors, isLockedIn } = useTheme();
    if (progress === 0) return null;

    return (
        <View style={[
            styles.planProgressRow,
            /*
             * The mockup breathes between the bar and the filters — it sets the
             * gap as `.co-segs{padding-top:22px}` on this screen. Carrying it
             * here instead keeps the shared Segments component on its base rule.
             */
            isLockedIn && {
                paddingHorizontal: Spacing.layout.screenPaddingTight,
                paddingTop: Spacing.xl - 4,
                paddingBottom: Spacing.xl - 2,
            },
        ]}>
            <View style={[styles.planProgressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.planProgressFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
            </View>
            {!isLockedIn && (
                <UIText variant="label">
                    {parseFloat(progress.toFixed(2))}%
                </UIText>
            )}
        </View>
    );
}

// ─── Plan Section Header ──────────────────────────────────────────────────────

const PlanSectionHeader = React.memo(({
    title,
    onToggle,
}: {
    title: string;
    isCollapsed: boolean;
    onToggle: () => void;
    completedCount: number;
    totalCount: number;
}) => {
    const { isLockedIn } = useTheme();

    /*
     * design/all-screens.html #plan: `.cl-label{margin:18px 0 10px}` and
     * `.co-label{margin:18px 0 12px}` are both a BARE section name — no panel,
     * no completion badge, no chevron, no checkmark. Cloth used to draw all
     * four; it still collapses on press, the design just carries no affordance
     * for that interaction in either style.
     */
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggle}
            style={isLockedIn ? styles.colossalSection : styles.clothPlanSectionHeader}
        >
            <UIText variant="label">{title}</UIText>
        </TouchableOpacity>
    );
});

// ─── Reading Card ─────────────────────────────────────────────────────────────

const ReadingCard = React.memo(({
    item,
    isCompleted,
    queueIndex,
    onToggle
}: {
    item: ReadingItem;
    isCompleted: boolean;
    /**
     * Where this reading sits in the queue of readings still to do — 0 is the
     * next one up. Undefined for a completed reading, which has no next date.
     */
    queueIndex?: number;
    onToggle: (id: number, completed: boolean) => void;
}) => {
    const { colors, isLockedIn } = useTheme();

    /*
     * Colossal draws `.co-row`: a marker, the reference on one line, and the
     * state on the right — "Done" in grey, "Today" in ochre. Completed rows
     * strike through and drop to 45%, which is the whole completion signal;
     * the filled checkbox the card used is chrome the design doesn't have.
     */
    // "Today", "Tomorrow", "Thu", "Oct 12" — counted from today down the
    // readings still left, so falling behind moves the dates rather than
    // stacking up overdue ones.
    const schedule = !isCompleted && queueIndex !== undefined ? scheduleLabel(queueIndex) : null;

    if (isLockedIn) {
        const marker = item.id <= HEBREW_SCRIPTURES_END ? styles.markerDiamond : styles.markerDot;
        const markerInk = item.id <= HEBREW_SCRIPTURES_END ? colors.accent : colors.textPrimary;

        return (
            <ScalePressable
                style={[styles.colossalRow, { borderBottomColor: colors.border }, isCompleted && styles.rowDone]}
                onPress={() => onToggle(item.id, !isCompleted)}
            >
                <View style={[marker, { backgroundColor: markerInk }]} />
                <View style={styles.colossalRowMain}>
                    {/*
                      * A finished reading drops to the same ink as its "Done"
                      * tag, so the whole row reads as one settled thing rather
                      * than a bright reference with a quiet label beside it.
                      */}
                    <UIText
                        variant="reference"
                        tone={isCompleted ? 'tertiary' : undefined}
                        style={isCompleted ? styles.struck : undefined}
                    >
                        {`${item.book}${item.chapters ? ` ${formatRange(item.chapters)}` : ''}`}
                    </UIText>
                    {!item.chapters && <UIText variant="bodySmall">Full Book</UIText>}
                </View>
                {isCompleted ? (
                    <UIText variant="meta">Done</UIText>
                ) : schedule ? (
                    <UIText variant="meta" tone={schedule.urgent ? 'accent' : undefined}>
                        {schedule.text}
                    </UIText>
                ) : null}
            </ScalePressable>
        );
    }

    /*
     * design/all-screens.html #plan, the `.cl` slot.
     *
     * Cloth draws each reading as a `.cl-panel` carrying the same two markers —
     * an ochre diamond through the Hebrew Scriptures, an indigo dot for the
     * Greek — with the book in the serif and its chapters beneath. Today's
     * reading takes a 3px ochre rail, which is the only place the accent lands
     * on this screen besides the markers and the progress bar.
     */
    const isDiamond = item.id <= HEBREW_SCRIPTURES_END;

    return (
        <ScalePressable
            style={[
                styles.clothPlanRow,
                { backgroundColor: colors.backgroundSubtle },
                schedule?.urgent && { borderLeftWidth: Spacing.border.marker, borderLeftColor: colors.accent },
                isCompleted && styles.clothPlanDone,
            ]}
            onPress={() => onToggle(item.id, !isCompleted)}
            accessibilityRole="button"
            accessibilityState={{ checked: isCompleted }}
        >
            <View
                style={[
                    isDiamond ? styles.markerDiamond : styles.markerDot,
                    { backgroundColor: isDiamond ? colors.accent : colors.textPrimary },
                ]}
            />
            <View style={styles.colossalRowMain}>
                <UIText
                    variant="subtitle"
                    tone={isCompleted ? 'tertiary' : 'primary'}
                    style={isCompleted ? styles.struck : undefined}
                >
                    {item.book}
                </UIText>
                <UIText variant="bodySmall" tone={isCompleted ? 'muted' : 'secondary'} style={styles.clothPlanSub}>
                    {item.chapters
                        ? `${formatRange(item.chapters)}${schedule?.urgent ? ' · today' : ''}`
                        : 'Full Book'}
                </UIText>
            </View>
            {/* `.cl-panel`'s 19px box: filled indigo with an ecru tick when done. */}
            <View
                style={[
                    styles.clothPlanBox,
                    isCompleted
                        ? { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                ]}
            >
                {isCompleted && <Check size={11} color={colors.textInverse} strokeWidth={3.4} />}
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
    onOpenActionCountChange: (count: number) => void;
    onOpenTopicCountChange: (count: number) => void;
    onCoveredChange: (covered: number) => void;
    onBookEntryCountChange: (count: number) => void;
}

function JournalContent({
    viewMode,
    searchQuery,
    selectedBook,
    onViewModeChange,
    onSearchChange,
    onSelectedBookChange,
    onCountChange,
    onOpenActionCountChange,
    onOpenTopicCountChange,
    onCoveredChange,
    onBookEntryCountChange,
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
                onOpenActionCountChange={onOpenActionCountChange}
                onOpenTopicCountChange={onOpenTopicCountChange}
                onCoveredChange={onCoveredChange}
                onBookEntryCountChange={onBookEntryCountChange}
            />
        </View>
    );
}

// ─── Plan Content ─────────────────────────────────────────────────────────────

export interface PlanProgress {
    completed: number;
    total: number;
    percent: number;
}

function PlanContent({ onProgressChange }: { onProgressChange: (p: PlanProgress) => void }) {
    const { colors, isLockedIn } = useTheme();
    const router = useRouter();
    const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState(0);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const { showAlert } = useAlert();
    const flatListRef = useRef<FlatList>(null);

    /**
     * Each outstanding reading's place in the queue — 0 is the next one up.
     * Rebuilt whenever a reading is ticked, so the dates shuffle forward with
     * you rather than being pinned to when you started.
     */
    const queueIndexById = React.useMemo(() => {
        const queue = new Map<number, number>();
        READING_PLAN_DATA.filter(item => !completedItems.has(item.id))
            .forEach((item, index) => queue.set(item.id, index));
        return queue;
    }, [completedItems]);

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
        onProgressChange({
            completed: newCompleted.size,
            total: READING_PLAN_DATA.length,
            percent: p,
        });
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
                queueIndex={queueIndexById.get(item.item.id)}
                onToggle={handleToggle}
            />
        );
    }, [sectionData, collapsedSections, completedItems, queueIndexById, handleToggle, toggleSection]);

    const renderHeader = useCallback(() => {
        if (progress > 0) return null;

        return (
            <View style={[styles.planLegendContainer, { backgroundColor: colors.backgroundSubtle, marginBottom: Spacing.md }]}>
                <View style={styles.planLegendItem}>
                    <View style={[styles.keyDiamond, { backgroundColor: colors.accent, marginTop: 4 }]} />
                    <UIText variant="bodySmall" tone="secondary" style={styles.planLegendText}>
                        Historical overview of God's dealings with the Israelites
                    </UIText>
                </View>
                <View style={styles.planLegendItem}>
                    <View style={[styles.keyDot, { backgroundColor: colors.accentSecondary, marginTop: 4 }]} />
                    <UIText variant="bodySmall" tone="secondary" style={styles.planLegendText}>
                        Chronological overview of the development of the Christian congregation
                    </UIText>
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
                            <View style={[styles.keyDiamond, { backgroundColor: colors.accent, marginTop: 4 }]} />
                            <UIText variant="bodySmall" tone="secondary" style={styles.planLegendText}>
                                Historical overview of God's dealings with the Israelites
                            </UIText>
                        </View>
                        <View style={styles.planLegendItem}>
                            <View style={[styles.keyDot, { backgroundColor: colors.accentSecondary, marginTop: 4 }]} />
                            <UIText variant="bodySmall" tone="secondary" style={styles.planLegendText}>
                                Chronological overview of the development of the Christian congregation
                            </UIText>
                        </View>
                    </View>
                )}
                <UIText style={[styles.planFootnote, { color: colors.textSecondary, marginTop: Spacing.xl }]}>
                    * This reading plan was adapted from the Bible Reading Plan found on{' '}
                    <UIText
                        style={{ textDecorationLine: 'underline', color: colors.accent }}
                        onPress={() => WebBrowser.openBrowserAsync(url)}
                    >
                        jw.org
                    </UIText>
                </UIText>
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
                    contentContainerStyle={[
                        styles.planListContent,
                        {
                            paddingHorizontal: isLockedIn
                                ? Spacing.layout.screenPaddingTight
                                : Spacing.layout.screenPadding,
                        },
                    ]}
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
    const { colors, style: themeStyle, isLockedIn } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();

    const [tab, setTab] = useState<Tab>((params.view as Tab) || 'recent');
    const [journalSearch, setJournalSearch] = useState('');
    const [journalSelectedBook, setJournalSelectedBook] = useState<BibleBook | undefined>();
    const [journalCount, setJournalCount] = useState(0);
    const [openActionCount, setOpenActionCount] = useState(0);
    const [openTopicCount, setOpenTopicCount] = useState(0);
    const [coveredCount, setCoveredCount] = useState(0);
    /** Entries against the open book — not the app-wide journalCount. */
    const [bookEntryCount, setBookEntryCount] = useState(0);
    const [themeCount, setThemeCount] = useState<number | null>(null);
    const [planProgress, setPlanProgress] = useState<PlanProgress>({ completed: 0, total: READING_PLAN_DATA.length, percent: 0 });

    // Books drills into bookDetail, so that view keeps the Books tab lit.
    const activeTabKey = tab === 'bookDetail' ? 'books' : tab;
    const showSearch = tab === 'recent' || (tab === 'bookDetail' && !isLockedIn);

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

    /**
     * Colossal's one number for the tab you are on.
     *
     * `null` means this tab has nothing worth enlarging right now — Themes
     * before it has clustered anything, where the mockup gives the slot to the
     * empty state instead.
     */
    /** "17 of 50 chapters" for Cloth's book band. */
    const bookCoverage = journalSelectedBook?.chapters
        ? `${coveredCount} of ${journalSelectedBook.chapters} chapters`
        : `${coveredCount} ${coveredCount === 1 ? 'chapter' : 'chapters'}`;

    const giant: { value: number; label: string } | null = (() => {
        switch (tab) {
            case 'plan':
                return {
                    value: planProgress.completed,
                    label: `of ${planProgress.total} readings · ${planProgress.percent}%`,
                };
            case 'actions':
                return {
                    value: openActionCount,
                    label: openActionCount === 1 ? 'action still open' : 'actions still open',
                };
            case 'topics':
                return {
                    value: openTopicCount,
                    label: openTopicCount === 1 ? 'follow-up open' : 'follow-ups open',
                };
            case 'themes':
                return themeCount === null ? null : {
                    value: themeCount,
                    label: `${themeCount === 1 ? 'pattern' : 'patterns'} across ${journalCount} entries`,
                };
            default:
                return {
                    value: journalCount,
                    label: journalCount === 1 ? 'entry written' : 'entries written',
                };
        }
    })();

    /**
     * The search field. Cloth renders it on the hero band in the translucent
     * `.onhero` treatment; Colossal renders it on the page under the giant.
     */
    const searchField = (
        <>
            <TextInput
                style={[
                    styles.searchInput,
                    textStyle(themeStyle, 'body'),
                    isLockedIn
                        ? {
                            backgroundColor: colors.searchBackground,
                            color: colors.textPrimary,
                            borderColor: colors.border,
                        }
                        : {
                            backgroundColor: colors.textInverse + '1A',
                            color: colors.textInverse,
                            borderColor: colors.textInverse + '47',
                        },
                ]}
                placeholder={
                    tab === 'bookDetail' && journalSelectedBook
                        ? `Search ${journalSelectedBook.name}…`
                        : journalCount > 0
                            ? `Search ${journalCount} entries…`
                            : 'Search entries…'
                }
                placeholderTextColor={isLockedIn ? colors.textTertiary : colors.textOnHero}
                value={journalSearch}
                onChangeText={setJournalSearch}
                autoCapitalize="none"
                autoCorrect={false}
            />
            {journalSearch.length > 0 && (
                <ScalePressable style={styles.clearSearch} onPress={() => setJournalSearch('')}>
                    <UIText variant="title" tone={isLockedIn ? 'secondary' : 'inverse'}>×</UIText>
                </ScalePressable>
            )}
        </>
    );

    return (
        <Screen edges={isLockedIn ? ['top'] : []}>

            {/* ── Header Zone ───────────────────────────────────────────────── */}
            {isLockedIn && tab === 'bookDetail' ? (
                /*
                 * A book takes the whole screen in Colossal.
                 *
                 * The mockup gives Book detail its own `.co-top` — a back arrow
                 * and the word "Books" — and nothing else above it: no count, no
                 * search, no filters. It reads as a place you went to rather than
                 * a filter you applied, and the arrow is the way back. Cloth keeps
                 * the breadcrumb, which is what its own mockup draws.
                 */
                <View style={styles.colossalTopRow}>
                    <ScalePressable
                        onPress={() => handleNavigate('books')}
                        accessibilityRole="button"
                        accessibilityLabel="Back to books"
                        hitSlop={Spacing.md}
                        style={styles.backArrow}
                    >
                        <ChevronLeft size={20} color={colors.textTertiary} strokeWidth={2} />
                    </ScalePressable>
                    <UIText variant="tab">Books</UIText>
                </View>
            ) : (
            <View>
                {isLockedIn ? (
                    <>
                        <View style={styles.colossalTop}>
                            <UIText variant="tab">{MARK[tab] ?? 'Library'}</UIText>
                        </View>
                        {/*
                          * The giant states whatever the current tab counts —
                          * entries written on Recent, readings completed on
                          * Plan, actions still open on Actions. Each tab gets
                          * one number, which is the rule the style is built on;
                          * Themes gets none until it has patterns to count,
                          * because its other two states own the slot themselves.
                          */}
                        {giant && (
                            <View style={styles.colossalCount}>
                                <UIText variant="hero">{giant.value}</UIText>
                                <UIText variant="label">{giant.label}</UIText>
                            </View>
                        )}
                    </>
                ) : (
                    <Hero ownsTopInset>
                        {tab === 'bookDetail' && journalSelectedBook ? (
                            /*
                             * design/all-screens.html #book, the `.cl` slot: a
                             * book takes over the band. The arrow hangs into
                             * the gutter, the breadcrumb sits above the name,
                             * and the coverage line replaces the search — the
                             * screen is about one book, not about finding one.
                             */
                            <>
                                <ScalePressable
                                    onPress={() => handleNavigate('books')}
                                    accessibilityRole="button"
                                    accessibilityLabel="Back to books"
                                    hitSlop={Spacing.md}
                                    style={styles.heroBack}
                                >
                                    <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                                </ScalePressable>
                                <UIText variant="label" tone="onHero" style={styles.heroCrumb}>
                                    {`Books / ${journalSelectedBook.name}`}
                                </UIText>
                                <UIText variant="display" tone="onBand" style={styles.heroBookName}>
                                    {journalSelectedBook.name}
                                </UIText>
                                <UIText variant="sub" tone="onHero">
                                    {`${bookCoverage} · ${bookEntryCount} ${bookEntryCount === 1 ? 'entry' : 'entries'}`}
                                </UIText>
                            </>
                        ) : (
                            <>
                                <UIText variant="display" tone="onBand">Library</UIText>
                                {/*
                                  * `.cl-input.onhero` — the search sits ON the
                                  * indigo band, not under it, so the header
                                  * reads as one block of cloth rather than a
                                  * title with a field beneath.
                                  */}
                                {showSearch && <View style={styles.heroSearch}>{searchField}</View>}
                            </>
                        )}
                    </Hero>
                )}

                {showSearch && isLockedIn && (
                    <View style={styles.searchContainer}>{searchField}</View>
                )}

                {tab === 'plan' && <PlanProgressBar progress={planProgress.percent} />}

                {/*
                  * Neither mockup draws `.cl-segs` / `.co-segs` on Book detail
                  * — its `.cl-hero` runs straight into `.cl-strip` then
                  * `.cl-body tight`, and Colossal's early return above already
                  * skips this block entirely. Cloth fell through to here and
                  * drew the six-tab strip under its own book band.
                  */}
                {tab !== 'bookDetail' && (
                    <Segments
                        items={TABS.map(t => ({ key: t.key, label: t.label }))}
                        value={activeTabKey}
                        onChange={(key) => handleNavigate(key as Exclude<Tab, 'bookDetail'>)}
                        scrollable
                    />
                )}
            </View>
            )}

            {/* ── Content Zone ──────────────────────────────────────────────── */}
            {tab === 'plan' ? (
                <PlanContent onProgressChange={setPlanProgress} />
            ) : tab === 'themes' ? (
                <ThemesContent onPatternCountChange={setThemeCount} />
            ) : (
                <JournalContent
                    viewMode={tab}
                    searchQuery={journalSearch}
                    selectedBook={journalSelectedBook}
                    onViewModeChange={setTab}
                    onSearchChange={setJournalSearch}
                    onSelectedBookChange={setJournalSelectedBook}
                    onCountChange={setJournalCount}
                    onOpenActionCountChange={setOpenActionCount}
                    onOpenTopicCountChange={setOpenTopicCount}
                    onCoveredChange={setCoveredCount}
                    onBookEntryCountChange={setBookEntryCount}
                />
            )}
        </Screen>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

/**
 * The plan's markers, in-palette.
 *
 * The two shapes used to be hardcoded #E53935 and #1E88E5 — imported iOS red
 * and blue that survive neither palette. The distinction the design keeps is
 * shape and hue within the theme: an ochre diamond through the Hebrew
 * Scriptures, a foreground dot for the Greek.
 */
const HEBREW_SCRIPTURES_END = 286;

const styles = StyleSheet.create({
    // .co-label over a run of rows: margin:18px 0 12px
    colossalSection: {
        paddingTop: Spacing.lg + 2,
        paddingBottom: Spacing.md,
    },
    // .cl-label over a run of rows: margin:18px 0 10px
    clothPlanSectionHeader: {
        paddingTop: Spacing.lg + 2,
        paddingBottom: Spacing.sm + 2,
    },
    // .co-row, centred rather than baseline — these rows carry a marker.
    colossalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.lg - 1,
        borderBottomWidth: Spacing.border.hairline,
    },
    colossalRowMain: {
        flex: 1,
        minWidth: 0,
    },
    rowDone: {
        opacity: 0.45,
    },
    /** `.cl-panel` as a plan row: 18px, an 8px gap under it, markers at the head. */
    clothPlanRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.layout.cardPadding,
        marginBottom: Spacing.sm,
    },
    clothPlanDone: { opacity: 0.6 },
    clothPlanSub: { marginTop: 2 },
    clothPlanBox: {
        width: 19,
        height: 19,
        borderWidth: Spacing.border.hairline,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerDiamond: {
        width: 8,
        height: 8,
        transform: [{ rotate: '45deg' }],
    },
    markerDot: {
        width: 8,
        height: 8,
        borderRadius: Spacing.borderRadius.round,
    },
    // .co-top with a back arrow, for a screen you navigated into.
    colossalTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    // The mockup hangs the arrow into the gutter so the glyph, not its box,
    // lines up with the text below it.
    backArrow: {
        marginLeft: -6,
    },
    // .co-top — a mark, not a screen title.
    /** `.cl-input.onhero{margin-top:18px}` */
    heroSearch: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.layout.cardPadding },
    /** The arrow hangs into the gutter so the glyph lines up with the name. */
    heroBack: { marginLeft: -6, alignSelf: 'flex-start' },
    heroCrumb: { marginTop: 10 },
    heroBookName: { marginTop: Spacing.sm },
    colossalTop: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    // .co-giant.n over .co-giantl
    colossalCount: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xl + 2,
        gap: Spacing.sm + 2,
    },
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
        borderRadius: Spacing.borderRadius.lg,
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
    /*
     * The mockup's search sits in bare padding — the only line in this region
     * is the one under the segments below it. The rules that used to bracket
     * it read as a toolbar the design doesn't have.
     */
    searchContainer: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xl - 4,
        paddingBottom: Spacing.lg + 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    // .co-input — a uniform 14px box; size and face come from textStyle('body').
    searchInput: {
        flex: 1,
        padding: Spacing.md + 2,
        borderWidth: Spacing.border.hairline,
    },
    clearSearch: {
        marginLeft: 10, width: 32, height: 32,
        borderRadius: Spacing.borderRadius.round, alignItems: 'center', justifyContent: 'center',
    },
    clearSearchText: { fontSize: 16, fontWeight: '300' },

    // ── Plan progress bar ──────────────────────────────────────────
    planProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: 10,
        gap: 12,
    },
    // A square 6px block, not a pill — the design has no rounded meters.
    planProgressTrack: { flex: 1, height: 6, overflow: 'hidden' },
    planProgressFill: { height: '100%', borderRadius: Spacing.borderRadius.sm },
    planProgressPct: { fontSize: 12, fontWeight: '800', letterSpacing: -0.5, minWidth: 46, textAlign: 'right' },

    // ── Study ──────────────────────────────────────────────────────

    // ── Plan ───────────────────────────────────────────────────────
    planListContent: { paddingTop: 0, paddingBottom: Spacing.xxl },
    planCard: { borderRadius: Spacing.borderRadius.lg, borderWidth: 1, marginBottom: Spacing.xs, padding: 16 },
    planCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    planBookInfo: { flex: 1, gap: 2 },
    planBookHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    planBookName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
    planChapters: { fontSize: 14, letterSpacing: 0.1 },
    planCheckbox: { width: 26, height: 26, borderRadius: Spacing.borderRadius.lg, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    // Shape is the signal: a diamond for the first half of the plan, a dot for
    // the second. Colour only reinforces it, so the pair still reads in Locked
    // In and for anyone who can't separate the old red from the old blue.
    keyDiamond: { width: 8, height: 8, transform: [{ rotate: '45deg' }] },
    keyDot: { width: 8, height: 8, borderRadius: Spacing.borderRadius.round },
    struck: { textDecorationLine: 'line-through' },
    planLegendContainer: { marginTop: Spacing.xl, gap: Spacing.md, padding: Spacing.md, borderRadius: Spacing.borderRadius.lg },
    planLegendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    planLegendText: { flex: 1 },
    planFootnote: { fontSize: 10, lineHeight: 14, fontStyle: 'italic' },
});
