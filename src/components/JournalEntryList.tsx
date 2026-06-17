import { useTheme } from '@/src/theme/ThemeContext';
import { getLocalMidnight, isSameDay } from '@/src/utils/dateUtils';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    View,
} from 'react-native';
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
import { TopicCard } from './journal/TopicCard';
import { BookCard, BookWithCount } from './journal/BookCard';
import { DateGroupHeader, TopicHeader } from './journal/JournalHeaders';

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
    getBookEntryCounts,
} from '../data/database';
import { LoadingView } from './LoadingView';
import Animated from 'react-native-reanimated';

type ViewMode = 'recent' | 'books' | 'bookDetail' | 'actions' | 'topics';

interface NavigationBreadcrumb {
    label: string;
    onPress: () => void;
}

type ListItem =
    | { type: 'header'; title: string; id: string }
    | { type: 'entry'; entry: JournalEntry; id: number }
    | { type: 'bookHeader'; bookName: string; entryCount: number; id: string }
    | { type: 'book'; book: BookWithCount; id: string }
    | { type: 'action'; action: EnhancedActionItem; id: string }
    | { type: 'topic'; topic: JournalEntry; id: string }
    | { type: 'topicHeader'; title: string; count: number; id: string }
    | { type: 'emptyState'; id: string }
    | { type: 'searchSpacer'; id: string };

interface JournalEntryListProps {
    onEntryPress: (entry: JournalEntry) => void;
    refreshTrigger?: number;
    viewMode: ViewMode;
    searchQuery: string;
    selectedBook?: BibleBook;
    onViewModeChange: (mode: ViewMode) => void;
    onSearchChange: (query: string) => void;
    onSelectedBookChange: (book?: BibleBook) => void;
    onCountChange?: (count: number) => void;
}


export const JournalEntryList: React.FC<JournalEntryListProps> = ({
    onEntryPress,
    refreshTrigger,
    viewMode,
    searchQuery,
    selectedBook,
    onViewModeChange,
    onSearchChange,
    onSelectedBookChange,
    onCountChange,
}) => {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [bookEntries, setBookEntries] = useState<JournalEntry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
    const [availableBooks, setAvailableBooks] = useState<BookWithCount[]>([]);
    const [actionsList, setActionsList] = useState<EnhancedActionItem[]>([]);
    const [topicsList, setTopicsList] = useState<JournalEntry[]>([]);
    const [isArchiveCollapsed, setIsArchiveCollapsed] = useState(true);
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
        try {
            await toggleStudyTopicCompletion(item.id!, !item.study_completed);
            // Refresh the list
            loadTopics();
        } catch (error) {
            console.error('Error toggling study topic:', error);
        }
    }, [loadTopics]);

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

    const navigateToRecent = () => {
        onViewModeChange('recent');
        onSelectedBookChange(undefined);
        onSearchChange('');
    };

    const navigateToBooks = () => {
        onViewModeChange('books');
        onSelectedBookChange(undefined);
        onSearchChange('');
    };

    const navigateToActions = () => {
        onViewModeChange('actions');
        onSelectedBookChange(undefined);
        onSearchChange('');
        loadActions();
    };

    const navigateToTopics = () => {
        onViewModeChange('topics');
        onSelectedBookChange(undefined);
        onSearchChange('');
        loadTopics();
    };

    const navigateToBookDetail = (book: BibleBook) => {
        onSelectedBookChange(book);
        onViewModeChange('bookDetail');
        onSearchChange('');
    };

    // Note: useFocusEffect below handles initial + subsequent loads

    // Refresh entries when screen comes into focus (e.g., after edit/delete)
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

    // Refresh when refreshTrigger changes (e.g., after modal close)
    useEffect(() => {
        if (refreshTrigger !== undefined && refreshTrigger > 0) {
            loadEntries(true);
            if (viewMode === 'bookDetail' && selectedBook) {
                loadBookEntries();
            }
            if (viewMode === 'actions') loadActions();
            if (viewMode === 'topics') loadTopics();
        }
    }, [refreshTrigger]);


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

    const getBreadcrumbs = (): NavigationBreadcrumb[] => {
        const breadcrumbs: NavigationBreadcrumb[] = [];

        if (viewMode === 'bookDetail' && selectedBook) {
            breadcrumbs.push({
                label: 'Books',
                onPress: navigateToBooks
            });
            breadcrumbs.push({
                label: selectedBook.name,
                onPress: () => { }
            });
        }

        return breadcrumbs;
    };

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
            return sortedActions.map(action => ({ type: 'action' as const, action, id: `action-${action.id}` }));
        }

        if (viewMode === 'topics') {
            const activeTopics = topicsList.filter(t => !t.study_completed);
            const completedTopics = topicsList.filter(t => !!t.study_completed);

            const items: ListItem[] = [];

            if (activeTopics.length === 0) {
                items.push({ type: 'emptyState', id: 'empty-topics' });
            } else {
                activeTopics.forEach(topic => {
                    items.push({ type: 'topic' as const, topic, id: `topic-${topic.id}` });
                });
            }

            if (completedTopics.length > 0) {
                items.push({
                    type: 'topicHeader',
                    title: 'COMPLETED TOPICS',
                    count: completedTopics.length,
                    id: 'completed-topics-header'
                });

                if (!isArchiveCollapsed) {
                    completedTopics.forEach(topic => {
                        items.push({ type: 'topic' as const, topic, id: `topic-${topic.id}` });
                    });
                }
            }

            return items;
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
    }, [viewMode, filteredEntries, debouncedSearchQuery, availableBooks, bookEntries, selectedBook, groupEntriesByDate, actionsList, topicsList, isArchiveCollapsed]);

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
            title = "No study topics";
            subtext = "Is there really nothing more you want to study? Add a topic.";
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
            <View style={styles.emptyState}>
                <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSubtle }]}>
                    {React.createElement(iconName, { size: 32, color: colors.textTertiary })}
                </View>
                <Text style={[styles.emptyStateText, { color: colors.textPrimary }]}>{title}</Text>
                <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>{subtext}</Text>
            </View>
        );
    }, [viewMode, debouncedSearchQuery, colors]);

    const renderListItem = useCallback(({ item }: { item: ListItem }) => {
        switch (item.type) {
            case 'header':
                return <DateGroupHeader title={item.title} />;
            case 'entry':
                return <EntryCard entry={item.entry} onEntryPress={onEntryPress} />;
            case 'action':
                return <ActionCard item={item.action} onEntryPress={onEntryPress} handleTogglePin={handleTogglePin} />;
            case 'topic':
                return <TopicCard item={item.topic} onEntryPress={onEntryPress} handleToggleTopic={handleToggleTopic} />;
            case 'topicHeader':
                return <TopicHeader title={item.title} count={item.count} isArchiveCollapsed={isArchiveCollapsed} onToggleCollapse={() => setIsArchiveCollapsed(!isArchiveCollapsed)} />;
            case 'emptyState':
                return renderEmptyState();
            case 'searchSpacer':
                return <View style={[styles.bookDetailHeader, { borderBottomColor: colors.border }]} />;
            case 'bookHeader':
                return <View style={[styles.bookDetailHeader, { borderBottomColor: colors.border, }]}></View>;
            case 'book':
                return <BookCard book={item.book} onNavigate={navigateToBookDetail} />;
            default:
                return null;
        }
    }, [colors, isArchiveCollapsed, onEntryPress, handleTogglePin, handleToggleTopic, navigateToBookDetail, renderEmptyState]);

    // Memoize the header element so FlatList receives a stable reference.
    // Passing renderListHeader() (a call) would produce a new element every render
    // and cause FlatList to unmount/remount the header unnecessarily.

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
                            paddingHorizontal: 20,
                            paddingBottom: 120,
                            paddingTop: (viewMode === 'recent' || viewMode === 'bookDetail') ? 0 : 20,
                        },
                        getFlatListData.length === 0 && styles.emptyContainer
                    ]}
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
        borderRadius: 1.5,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        zIndex: 1,
    },
    tabText: {
        fontSize: 15,
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
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        fontWeight: '500',
    },
    clearSearch: {
        marginLeft: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearSearchText: {
        fontSize: 18,
        fontWeight: '300',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,        // ← was part of padding: 20
        paddingBottom: 120,
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
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 48,
        paddingVertical: 100,
    },
    emptyIconContainer: {
        width: 84,
        height: 84,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.2,
    },
    emptyStateSubtext: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '400',
    },
});
