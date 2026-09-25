import { useTheme } from '@/src/theme/ThemeContext';
import { getLocalMidnight, isSameDay } from '@/src/utils/dateUtils';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
    BookCopy,
    Bookmark,
    Search,
    Notebook,
    Zap
} from 'lucide-react-native';
import { ALL_BIBLE_BOOKS, BibleBook } from '../data/bibleBooks';
import { EntryCard } from './journal/EntryCard';
import { ActionCard } from './journal/ActionCard';
import { ActionKind, actionKindOf } from '../data/actionKind';
import { ActionEditor } from './journal/ActionEditor';
import { AnimatedModal } from './AnimatedModal';
import { PracticeProgress, markPracticeDone, practiceProgress, unmarkPracticeDone } from '../data/practiceRepository';
import { setActionItemArchived, updateActionItem } from '../data/journalRepository';
import { TopicCard } from './journal/TopicCard';
import { BookCard, BookWithCount } from './journal/BookCard';
import { ActionSectionHeader, DateGroupHeader } from './journal/JournalHeaders';
import { AHEAD_AT_TOP, BookDetailHeader, StillAhead, coveredChapters } from './journal/BookDetailHeader';
import { READING_PLAN_DATA } from '../data/readingPlanData';
import { planItemCoversBook } from '../data/journalRepository';
import { getReadingProgress } from '../data/database';
import { formatRange } from '../utils/reference';

import {
    JournalEntry,
    getEntriesByBook,
    getJournalEntries,
    getTotalJournalCount,
    searchEntries,
    getAllActionItems,
    getAllStudyTopics,
    EnhancedActionItem,
    toggleStudyTopicCompletion,
    toggleActionItemPin,
    toggleActionItemCompletion,
    getBookEntryCounts,
} from '../data/database';
import { LoadingView } from './LoadingView';
import Animated from 'react-native-reanimated';
import { Spacing } from '../theme/spacing';
import { Text } from './ui';

type ViewMode = 'recent' | 'books' | 'bookDetail' | 'actions' | 'topics';

type ListItem =
    | { type: 'header'; title: string; id: string }
    | { type: 'entry'; entry: JournalEntry; id: number }
    | { type: 'bookHeader'; bookName: string; entryCount: number; id: string }
    | { type: 'book'; book: BookWithCount; id: string }
    | { type: 'action'; action: EnhancedActionItem; id: string }
    | { type: 'actionHeader'; title: string; accent: boolean; id: string }
    | { type: 'topic'; topic: JournalEntry; id: string }
    | { type: 'emptyState'; id: string }
    | { type: 'searchSpacer'; id: string };

/**
 * How long an answered question stays on screen before it goes. Long enough to
 * notice the tick landed and take it back, short enough not to keep a record
 * nobody asked for — the same bargain a send-undo makes.
 */
const LINGER_MS = 10_000;

interface JournalEntryListProps {
    onEntryPress: (entry: JournalEntry) => void;
    viewMode: ViewMode;
    searchQuery: string;
    selectedBook?: BibleBook;
    onViewModeChange: (mode: ViewMode) => void;
    onSearchChange: (query: string) => void;
    onSelectedBookChange: (book?: BibleBook) => void;
    onCountChange?: (count: number) => void;
    /** Distinct chapters of the open book that entries cover — Cloth's hero line. */
    onCoveredChange?: (covered: number) => void;
    /** Entries against the open book — Cloth's hero band. */
    onBookEntryCountChange?: (count: number) => void;
}


export const JournalEntryList: React.FC<JournalEntryListProps> = ({
    onEntryPress,
    viewMode,
    searchQuery,
    selectedBook,
    onViewModeChange,
    onSearchChange,
    onSelectedBookChange,
    onCountChange,
    onCoveredChange,
    onBookEntryCountChange,
}) => {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [bookEntries, setBookEntries] = useState<JournalEntry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
    const [availableBooks, setAvailableBooks] = useState<BookWithCount[]>([]);
    const [actionsList, setActionsList] = useState<EnhancedActionItem[]>([]);
    const [practiceProgressMap, setPracticeProgress] = useState<Map<number, PracticeProgress>>(new Map());
    // A ref beside the state: the toggle handler needs to know whether today
    // is done, and reading it from state would rebuild the whole list on every
    // completion.
    const practiceProgressRef = useRef(practiceProgressMap);
    /** Which commitment is open for editing, if any. */
    const [editingAction, setEditingAction] = useState<EnhancedActionItem | null>(null);
    practiceProgressRef.current = practiceProgressMap;
    const [topicsList, setTopicsList] = useState<JournalEntry[]>([]);

/*
     * Questions just answered, still on screen. A ticked question leaves the
     * list for good — a list of answered questions is a graveyard — but leaving
     * instantly makes a mis-tap unrecoverable, so it lingers and the checkbox
     * stays live. Ticking again inside the window cancels the exit.
     *
     * Nothing is destroyed either way: the question still reads on its entry.
     */
    const [lingering, setLingering] = useState<Set<number>>(new Set());
    const lingerTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    useEffect(() => {
        const timers = lingerTimers.current;
        return () => {
            timers.forEach(clearTimeout);
            timers.clear();
        };
    }, []);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const searchTimeoutRef = useRef<any>(null);
    // Stable ref so loadEntries doesn't need entries in its useCallback deps
    const entriesRef = useRef<JournalEntry[]>([]);
    const PAGE_SIZE = 30;

    const loadEntries = useCallback(async (reset = true) => {
        if (reset) setIsLoading(true);
        try {
            const offset = reset ? 0 : entriesRef.current.length;
            const dbEntries = await getJournalEntries(PAGE_SIZE, offset);

            const updated = reset ? dbEntries : [...entriesRef.current, ...dbEntries];
            // Keep ref and state in sync
            entriesRef.current = updated;
            setEntries(updated);
            setHasMore(dbEntries.length === PAGE_SIZE);

            // Fetch book counts from DB (covers ALL entries, not just the current page)
            const bookCounts = await getBookEntryCounts();
            const totalCount = await getTotalJournalCount();

            if (onCountChange) {
                onCountChange(totalCount);
            }

            const booksWithEntries = ALL_BIBLE_BOOKS
                .filter(book => bookCounts[book.name] !== undefined)
                .map(book => ({ ...book, entryCount: bookCounts[book.name] }))
                .sort((a, b) => b.entryCount - a.entryCount);

            setAvailableBooks(booksWithEntries);
        } catch (error) {
            console.error('Error loading entries:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
        // entriesRef is a stable ref — no dep needed. PAGE_SIZE is a module constant.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        onCoveredChange?.(coveredChapters(bookEntries));
        onBookEntryCountChange?.(bookEntries.length);
    }, [bookEntries, onCoveredChange, onBookEntryCountChange]);

    const loadBookEntries = useCallback(async () => {
        if (!selectedBook) return;

        try {
            let dbEntries: JournalEntry[] = [];

            if (debouncedSearchQuery.trim()) {
                const allSearchResults = await searchEntries(debouncedSearchQuery);
                dbEntries = allSearchResults.filter(entry => entry.book_name === selectedBook.name);
            } else {
                dbEntries = await getEntriesByBook(selectedBook.name);
            }

            setBookEntries(dbEntries);
        } catch (error) {
            console.error('Error loading book entries:', error);
        }
    }, [selectedBook, debouncedSearchQuery]);

    const loadActions = useCallback(async () => {
        try {
            const data = await getAllActionItems(200);
            setActionsList(data);

            // Only practices need progress: an application has nothing to
            // count and an action is a boolean already on the row.
            const practices = data.filter(item => actionKindOf(item) === 'practice');
            const progress = await Promise.all(
                practices.map(async item => [item.id!, await practiceProgress(item.id!, item.cadence)] as const),
            );
            setPracticeProgress(new Map(progress));

        } catch (error) {
            console.error('Error loading actions:', error);
        }
    }, []);

    const loadTopics = useCallback(async () => {
        try {
            const data = await getAllStudyTopics();
            setTopicsList(data);
        } catch (error) {
            console.error('Error loading topics:', error);
        }
    }, []);

    const handleToggleTopic = useCallback(async (item: JournalEntry) => {
        const id = item.id!;
        const answering = !item.study_completed;
        try {
            await toggleStudyTopicCompletion(id, answering);

            const existing = lingerTimers.current.get(id);
            if (existing) {
                clearTimeout(existing);
                lingerTimers.current.delete(id);
            }

            if (answering) {
                setLingering(prev => new Set(prev).add(id));
                lingerTimers.current.set(id, setTimeout(() => {
                    lingerTimers.current.delete(id);
                    setLingering(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }, LINGER_MS));
            } else {
                setLingering(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }

            loadTopics();
        } catch (error) {
            console.error('Error toggling study topic:', error);
        }
    }, [loadTopics]);

    const handleToggleAction = useCallback(async (item: EnhancedActionItem) => {
        try {
            // A practice is done for a day, not for ever: ticking writes today
            // into the completion log. Only an action flips the row's boolean.
            if (actionKindOf(item) === 'practice') {
                const current = practiceProgressRef.current.get(item.id!);
                if (current?.doneNow) await unmarkPracticeDone(item.id!);
                else await markPracticeDone(item.id!);
            } else {
                await toggleActionItemCompletion(item.id!, !item.is_completed);
            }
            loadActions();
        } catch (error) {
            console.error('Error toggling action:', error);
        }
    }, [loadActions]);

    const handleTogglePin = useCallback(async (item: EnhancedActionItem) => {
        try {
            await toggleActionItemPin(item.id!, !item.is_pinned);
            loadActions();
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    }, [loadActions]);

    const filterEntries = useCallback(async () => {
        if (!debouncedSearchQuery.trim()) {
            setFilteredEntries(entries);
            return;
        }

        try {
            const searchResults = await searchEntries(debouncedSearchQuery);
            setFilteredEntries(searchResults);
        } catch (error) {
            console.error('Error filtering entries:', error);
            setFilteredEntries([]);
        }
    }, [debouncedSearchQuery, entries]);

    const navigateToBookDetail = (book: BibleBook) => {
        onSelectedBookChange(book);
        onViewModeChange('bookDetail');
        onSearchChange('');
    };

    // Note: useFocusEffect below handles initial + subsequent loads

    // Refresh entries when screen comes into focus (e.g., after edit/delete)
    // The only reload path. Entries open as a route (`/library/[id]`), not a
    // modal, so returning from one pops the stack and focus comes back here.
    useFocusEffect(
        useCallback(() => {
            loadEntries(true);
            if (viewMode === 'bookDetail' && selectedBook) {
                loadBookEntries();
            }
            if (viewMode === 'actions') loadActions();
            if (viewMode === 'topics') loadTopics();
        }, [viewMode, selectedBook, loadBookEntries, loadActions, loadTopics])
    );


    // Debounce search query
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    useEffect(() => {
        if (viewMode === 'recent') {
            filterEntries();
        }
    }, [debouncedSearchQuery, entries, viewMode, filterEntries]);

    useEffect(() => {
        if (viewMode === 'bookDetail' && selectedBook) {
            loadBookEntries();
        }
    }, [selectedBook, debouncedSearchQuery, viewMode, loadBookEntries]);

    // Helper functions moved outside component scope

    const groupEntriesByDate = useCallback((entries: JournalEntry[]) => {
        const today = getLocalMidnight();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);

        const thisMonth = new Date(today);
        thisMonth.setDate(thisMonth.getDate() - 30);

        const groups = {
            today: [] as JournalEntry[],
            yesterday: [] as JournalEntry[],
            thisWeek: [] as JournalEntry[],
            thisMonth: [] as JournalEntry[],
            older: [] as JournalEntry[]
        };

        entries.forEach(entry => {
            if (!entry.created_at) return;
            // Ensure SQLite local time string is parsed correctly
            const entryDate = new Date(entry.created_at.replace(' ', 'T'));
            const entryDateLocal = getLocalMidnight(entryDate);

            const time = entryDateLocal.getTime();

            if (isSameDay(entryDateLocal, today)) {
                groups.today.push(entry);
            } else if (isSameDay(entryDateLocal, yesterday)) {
                groups.yesterday.push(entry);
            } else if (time >= thisWeek.getTime()) {
                groups.thisWeek.push(entry);
            } else if (time >= thisMonth.getTime()) {
                groups.thisMonth.push(entry);
            } else {
                groups.older.push(entry);
            }
        });

        return groups;
    }, []);

    // Card components moved to React.memo outside component scope

    // Convert grouped entries to flat list format
    const getFlatListData = useMemo(() => {
        if (viewMode === 'actions') {
            const sortedActions = [...actionsList].sort((a, b) => {
                const aPinned = !!a.is_pinned;
                const bPinned = !!b.is_pinned;
                // Pinned items float to the top
                if (aPinned !== bPinned) return aPinned ? -1 : 1;
                // Among pinned items: most recently pinned first
                if (aPinned && bPinned) {
                    const aTime = a.pinned_at ? new Date(a.pinned_at.replace(' ', 'T')).getTime() : (a.id ?? 0);
                    const bTime = b.pinned_at ? new Date(b.pinned_at.replace(' ', 'T')).getTime() : (b.id ?? 0);
                    return bTime - aTime;
                }
                // Among unpinned: most recently created entry first
                return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
            });

            if (sortedActions.length === 0) {
                return [{ type: 'emptyState' as const, id: 'empty-actions' }];
            }

            // "Pinned" and "All actions". With nothing pinned there is one run
            // and no heading — a lone label would name a distinction the screen
            // is not making.
            const pinned = sortedActions.filter(a => !!a.is_pinned);
            const rest = sortedActions.filter(a => !a.is_pinned);
            const row = (action: EnhancedActionItem) =>
                ({ type: 'action' as const, action, id: `action-${action.id}` });

            const items: ListItem[] = [];
            if (pinned.length > 0) {
                items.push({ type: 'actionHeader', title: 'Pinned', accent: true, id: 'actions-pinned' });
                items.push(...pinned.map(row));
            }

            /*
             * Grouped by what each thing IS, ordered by what it asks today:
             * practices first (something to do now), actions next (a
             * deadline), applications last — they ask for nothing and are there
             * to be met again, not worked through. One flat list is what lets a
             * formational answer read as an unfinished chore.
             *
             * A heading appears only with more than one group, so a journal of
             * nothing but applications sees no taxonomy it did not ask for.
             */
            const groups: { kind: ActionKind | 'archived'; title: string; rows: EnhancedActionItem[] }[] = [
                { kind: 'practice', title: 'Practices', rows: [] },
                { kind: 'action', title: 'With a date', rows: [] },
                { kind: 'application', title: 'Applying', rows: [] },
                // Last, never mixed in. Archived means it served its purpose,
                // not that it never happened.
                { kind: 'archived', title: 'Archived', rows: [] },
            ];
            for (const action of rest) {
                const bucket = action.archived_at ? 'archived' : actionKindOf(action);
                groups.find(g => g.kind === bucket)!.rows.push(action);
            }

            const populated = groups.filter(g => g.rows.length > 0);
            const needsHeadings = populated.length > 1 || pinned.length > 0;

            for (const group of populated) {
                if (needsHeadings) {
                    items.push({
                        type: 'actionHeader',
                        title: group.title,
                        accent: false,
                        id: `actions-${group.kind}`,
                    });
                }
                items.push(...group.rows.map(row));
            }
            return items;
        }

        if (viewMode === 'topics') {
            // Open questions, plus any just answered and still inside their
            // undo window. No "completed" section: this place says what you are
            // carrying, not what you are not.
            const shown = topicsList.filter(t => !t.study_completed || lingering.has(t.id!));

            if (shown.length === 0) {
                return [{ type: 'emptyState' as const, id: 'empty-topics' }];
            }

            return shown.map(topic => ({ type: 'topic' as const, topic, id: `topic-${topic.id}` }));
        }

        if (viewMode === 'books') {
            if (availableBooks.length === 0) {
                return [{ type: 'emptyState' as const, id: 'empty-books' }];
            }
            return availableBooks.map(book => ({ type: 'book' as const, book, id: book.name }));
        }

        if (viewMode === 'bookDetail') {
            const items: ListItem[] = [];
            if (selectedBook) {
                items.push({
                    type: 'bookHeader',
                    bookName: selectedBook.name,
                    entryCount: bookEntries.length,
                    id: `header-${selectedBook.name}`
                });
            }
            const sorted = [...bookEntries].sort((a, b) => {
                if (a.chapter_start !== b.chapter_start) {
                    return (a.chapter_start || 0) - (b.chapter_start || 0);
                }
                return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
            });

            if (sorted.length === 0) {
                items.push({ type: 'emptyState', id: 'empty-book-detail' });
            } else {
                sorted.forEach(entry => {
                    items.push({ type: 'entry', entry, id: entry.id! });
                });
            }
            return items;
        }

        // Recent view
        if (debouncedSearchQuery.trim()) {
            // Search results - no grouping
            const results = filteredEntries
                .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
                .map(entry => ({ type: 'entry' as const, entry, id: entry.id! }));

            if (results.length === 0) {
                return [{ type: 'emptyState' as const, id: 'empty-search' }];
            }
            return [{ type: 'searchSpacer' as const, id: 'search-spacer' }, ...results];
        }

        // Grouped entries
        const sortedEntries = [...filteredEntries].sort(
            (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );
        const grouped = groupEntriesByDate(sortedEntries);
        const items: ListItem[] = [];

        const sections = [
            { title: 'Today', entries: grouped.today },
            { title: 'Yesterday', entries: grouped.yesterday },
            { title: 'This Week', entries: grouped.thisWeek },
            { title: 'This Month', entries: grouped.thisMonth },
            { title: 'Older', entries: grouped.older },
        ];

        sections.forEach(section => {
            if (section.entries.length > 0) {
                items.push({ type: 'header', title: section.title, id: `header-${section.title}` });
                section.entries.forEach(entry => {
                    items.push({ type: 'entry', entry, id: entry.id! });
                });
            }
        });

        if (items.length === 0) {
            items.push({ type: 'emptyState', id: 'empty-recent' });
        }

        return items;
    }, [viewMode, filteredEntries, debouncedSearchQuery, availableBooks, bookEntries, selectedBook, groupEntriesByDate, actionsList, topicsList, lingering]);

    /*
     * Nothing here yet. Eight of these, and for Questions and Commitments they
     * are often the only thing on screen for weeks, so the copy carries the
     * voice and the layout gets out of its way.
     *
     * The glyph stays bare on the stroke at 34px — no icon well. None of the
     * eight gets a button: what fills them is already on screen.
     */
    const renderEmptyState = useCallback(() => {
        let iconName: any = Notebook;
        let title = "It's awful quiet in here...";
        let subtext = "Don't just stare at the screen. Read your Bible and tell me about it!";

        if (viewMode === 'books') {
            iconName = BookCopy;
            title = "Empty shelves";
            subtext = "Read a book of the Bible so we can put something here.";
        } else if (viewMode === 'actions') {
            iconName = Zap;
            title = "No actions recorded";
            subtext = "You didn't learn anything practical today? Write an action step";
        } else if (viewMode === 'topics') {
            iconName = Bookmark;
            title = "No follow-ups";
            subtext = "Is there really nothing more you want to study? Add one to an entry.";
        } else if (debouncedSearchQuery) {
            iconName = Search;
            title = "Nothing to see here";
            subtext = "I couldn't find what you're looking for. Try another search.";
        } else if (viewMode === 'bookDetail') {
            iconName = Notebook;
            title = "Empty book";
            subtext = "You haven't read this book yet. Go read it!";
        }

        return (
            <View style={[styles.emptyState, styles.emptyCloth]}>
                {React.createElement(iconName, {
                    size: 34,
                    color: colors.textTertiary,
                    strokeWidth: 1.5,
                })}
                <Text variant="title" style={styles.centred}>{title}</Text>
                <Text variant="body" tone="secondary" style={styles.centred}>
                    {subtext}
                </Text>
            </View>
        );
    }, [viewMode, debouncedSearchQuery, colors]);

    const [completedPlanIds, setCompletedPlanIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (viewMode !== 'bookDetail') return;
        let active = true;
        getReadingProgress().then(ids => {
            if (active) setCompletedPlanIds(new Set(ids));
        });
        return () => { active = false; };
    }, [viewMode, selectedBook]);

    /**
     * The plan's outstanding readings for the book on screen.
     *
     * MUST use `planItemCoversBook`, not `item.book === name`: the plan groups
     * eleven short books into shared readings ("Obadiah/Jonah",
     * "Titus/Philemon", "2 John/3 John/Jude"), and no book is called
     * "Obadiah/Jonah", so a strict comparison shows those eleven nothing.
     *
     * Consequence worth knowing: a reading shown on Jonah's page covers Obadiah
     * too, so completing it completes both. They share a day by design.
     */
    const stillAhead = React.useMemo(() => {
        if (viewMode !== 'bookDetail' || !selectedBook) return [];
        return READING_PLAN_DATA
            .filter(item => planItemCoversBook(item.book, selectedBook.name) && !completedPlanIds.has(item.id))
            // A reading with no chapter range covers the whole book, which is
            // how the plan files the short ones. `formatRange` returns '' for
            // those, which `filter(Boolean)` would drop.
            .map(item => formatRange(item.chapters) || 'Full book')
            .filter(Boolean);
    }, [viewMode, selectedBook, completedPlanIds]);

    const renderListItem = useCallback(({ item }: { item: ListItem }) => {
        switch (item.type) {
            case 'header':
                return <DateGroupHeader title={item.title} />;
            case 'entry':
                return (
                    <EntryCard
                        entry={item.entry}
                        omitBookName={viewMode === 'bookDetail'}
                        onEntryPress={onEntryPress}
                    />
                );
            case 'action':
                return (
                    <ActionCard
                        item={item.action}
                        onEntryPress={onEntryPress}
                        handleTogglePin={handleTogglePin}
                        handleToggleAction={handleToggleAction}
                        progress={practiceProgressMap.get(item.action.id!)}
                        onEdit={setEditingAction}
                    />
                );
            case 'actionHeader':
                return <ActionSectionHeader title={item.title} accent={item.accent} />;
            case 'topic':
                return <TopicCard item={item.topic} onEntryPress={onEntryPress} handleToggleTopic={handleToggleTopic} />;
            case 'emptyState':
                return renderEmptyState();
            case 'searchSpacer':
                return <View style={[styles.bookDetailHeader, { borderBottomColor: colors.border }]} />;
            case 'bookHeader':
                return (
                    <BookDetailHeader
                        bookName={item.bookName}
                        totalChapters={selectedBook?.chapters}
                        coveredCount={coveredChapters(bookEntries)}
                        entryCount={item.entryCount}
                    />
                );
            case 'book':
                return <BookCard book={item.book} onNavigate={navigateToBookDetail} />;
            default:
                return null;
        }
    }, [colors, viewMode, selectedBook, bookEntries, onEntryPress, handleTogglePin, handleToggleAction, handleToggleTopic, navigateToBookDetail, renderEmptyState]);

    // Memoized so FlatList gets a stable reference — calling renderListHeader()
    // inline makes a new element each render and remounts the header.

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {isLoading && entries.length === 0 ? (
                <View style={{ flex: 1 }}>
                    <LoadingView style={{ marginTop: 100 }} />
                </View>
            ) : (
                <Animated.FlatList
                    data={getFlatListData}
                    renderItem={renderListItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={[
                        {
                            // The list runs in the screen's own gutter, not a
                            // third value.
                            paddingHorizontal: Spacing.layout.screenPadding,
                            paddingBottom: Spacing.xxl,
                            paddingTop: (viewMode === 'recent' || viewMode === 'bookDetail') ? 0 : 20,
                        },
                        getFlatListData.length === 0 && styles.emptyContainer
                    ]}
                    /*
                     * "Still ahead" changes ends depending on its length: a
                     * short remainder leads, a long one follows. As a footer it
                     * is unreachable on a book with twenty entries; as a header
                     * seventeen chips is four rows that push the reader's own
                     * writing off screen.
                     */
                    ListHeaderComponent={
                        viewMode === 'bookDetail' && stillAhead.length <= AHEAD_AT_TOP
                            ? <StillAhead ranges={stillAhead} place="top" />
                            : null
                    }
                    ListFooterComponent={
                        viewMode === 'bookDetail' && stillAhead.length > AHEAD_AT_TOP
                            ? <StillAhead ranges={stillAhead} place="bottom" />
                            : null
                    }
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    onEndReached={() => {
                        if (viewMode === 'recent' && !debouncedSearchQuery.trim() && hasMore && !isLoadingMore) {
                            setIsLoadingMore(true);
                            loadEntries(false);
                        }
                    }}
                    onEndReachedThreshold={0.5}
                />
            )}

            <AnimatedModal visible={!!editingAction} onRequestClose={() => setEditingAction(null)}>
                {editingAction && (
                    <ActionEditor
                        item={editingAction}
                        onClose={() => setEditingAction(null)}
                        onSave={async fields => {
                            await updateActionItem(editingAction.id!, fields);
                            setEditingAction(null);
                            loadActions();
                        }}
                        onArchive={async archived => {
                            await setActionItemArchived(editingAction.id!, archived);
                            setEditingAction(null);
                            loadActions();
                        }}
                    />
                )}
            </AnimatedModal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    tabContainer: {
        marginBottom: 20,
    },
    tabBackground: {
        flexDirection: 'row',
        backgroundColor: 'transparent',
        padding: 0,
        position: 'relative',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '25%',
        height: 3,
        borderRadius: Spacing.borderRadius.round,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        zIndex: 1,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    breadcrumbsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 0.5,
    },
    breadcrumbText: {
        fontSize: 14,
        fontWeight: '400',
        letterSpacing: 0.1,
    },
    breadcrumbTextCurrent: {
        fontWeight: '600',
    },
    breadcrumbSeparator: {
        fontSize: 14,
        marginHorizontal: 8,
        fontWeight: '300',
    },
    searchContainer: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 0.5,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        height: 52,
        borderRadius: Spacing.borderRadius.lg,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        fontWeight: '500',
    },
    clearSearch: {
        marginLeft: 12,
        width: 32,
        height: 32,
        borderRadius: Spacing.borderRadius.round,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearSearchText: {
        fontSize: 16,
        fontWeight: '300',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,        // ← was part of padding: 20
        paddingBottom: Spacing.xxl,
    },
    emptyContainer: {
        flexGrow: 1,
    },
    entriesList: {
        // No extra horizontal padding here, handled by scrollContent
    },
    bookDetailHeader: {
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 0.5,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        gap: Spacing.lg,
        paddingVertical: 100,
    },
    /** Centred under its glyph, in from the gutter so the line breaks early. */
    emptyCloth: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xxl + 2,
    },
    /** Set left, like everything else on the page. */
    centred: { textAlign: 'center' },
});
