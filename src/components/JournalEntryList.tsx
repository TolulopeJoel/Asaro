import { useTheme } from '@/src/theme/ThemeContext';
import { getLocalMidnight, isSameDay } from '@/src/utils/dateUtils';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { ALL_BIBLE_BOOKS, BibleBook } from '../data/bibleBooks';

interface BookWithCount extends BibleBook {
    entryCount: number;
}
import {
    JournalEntry,
    getEntriesByBook,
    getJournalEntries,
    searchEntries,
    getAllActionItems,
    getAllStudyTopics,
    EnhancedActionItem,
    getEntryById,
    toggleStudyTopicCompletion,
    toggleActionItemPin
} from '../data/database';
import { ScalePressable } from './ScalePressable';
import { LoadingView } from './LoadingView';
import { openBibleReference } from '../utils/bibleUtils';
import { HyperlinkedText } from './HyperlinkedText';
import Animated, { LinearTransition } from 'react-native-reanimated';

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
    | { type: 'emptyState'; id: string };

interface JournalEntryListProps {
    onEntryPress: (entry: JournalEntry) => void;
    refreshTrigger?: number;
    initialViewMode?: ViewMode;
}

export const JournalEntryList: React.FC<JournalEntryListProps> = ({ onEntryPress, refreshTrigger, initialViewMode = 'recent' }) => {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
    const [selectedBook, setSelectedBook] = useState<BibleBook>();
    const [bookEntries, setBookEntries] = useState<JournalEntry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
    const [availableBooks, setAvailableBooks] = useState<BookWithCount[]>([]);
    const [actionsList, setActionsList] = useState<EnhancedActionItem[]>([]);
    const [topicsList, setTopicsList] = useState<JournalEntry[]>([]);
    const [isArchiveCollapsed, setIsArchiveCollapsed] = useState(true);
    const [tabContainerWidth, setTabContainerWidth] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const searchTimeoutRef = useRef<any>(null);
    const PAGE_SIZE = 30;

    const loadEntries = useCallback(async (reset = true) => {
        if (reset) setIsLoading(true);
        try {
            const offset = reset ? 0 : entries.length;
            const dbEntries = await getJournalEntries(PAGE_SIZE, offset);

            const updated = reset ? dbEntries : [...entries, ...dbEntries];
            setEntries(updated);
            setHasMore(dbEntries.length === PAGE_SIZE);

            // Get available books with entry counts
            const bookCounts = new Map<string, number>();
            updated.forEach(entry => {
                bookCounts.set(entry.book_name, (bookCounts.get(entry.book_name) || 0) + 1);
            });

            const booksWithEntries = ALL_BIBLE_BOOKS
                .filter(book => bookCounts.has(book.name))
                .map(book => ({ ...book, entryCount: bookCounts.get(book.name) || 0 }))
                .sort((a, b) => b.entryCount - a.entryCount);

            setAvailableBooks(booksWithEntries);
        } catch (error) {
            console.error('Error loading entries:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [entries]);

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
        setViewMode('recent');
        setSelectedBook(undefined);
        setSearchQuery('');
    };

    const navigateToBooks = () => {
        setViewMode('books');
        setSelectedBook(undefined);
        setSearchQuery('');
    };

    const navigateToActions = () => {
        setViewMode('actions');
        setSelectedBook(undefined);
        setSearchQuery('');
        loadActions();
    };

    const navigateToTopics = () => {
        setViewMode('topics');
        setSelectedBook(undefined);
        setSearchQuery('');
        loadTopics();
    };

    const navigateToBookDetail = (book: BibleBook) => {
        setSelectedBook(book);
        setViewMode('bookDetail');
        setSearchQuery('');
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

    const getChapterText = useCallback((entry: JournalEntry): string => {
        if (entry.chapter_end && entry.chapter_end !== entry.chapter_start) {
            return `${entry.chapter_start}–${entry.chapter_end}`;
        }
        return entry.chapter_start?.toString() || '';
    }, []);

    const getAnswerCount = useCallback((entry: JournalEntry): number => {
        let count = [entry.reflection_1, entry.reflection_2, entry.reflection_4]
            .filter(r => (r ?? '').trim().length > 0).length;
        // Count action items as Q3
        if (entry.action_items && entry.action_items.some(item => item.action.trim() || item.motivation.trim())) {
            count++;
        }
        return count;
    }, []);

    const formatDate = useCallback((dateString?: string): string => {
        if (!dateString) return '';
        // SQLite local time string 'YYYY-MM-DD HH:MM:SS' needs 'T' for robust parsing
        const date = new Date(dateString.replace(' ', 'T'));
        const isCurrentYear = date.getFullYear() === new Date().getFullYear();

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: isCurrentYear ? undefined : 'numeric',
        });
    }, []);

    const getPreviewText = useCallback((entry: JournalEntry): string => {
        const reflections = [entry.reflection_1, entry.reflection_2, entry.reflection_4]
            .filter(r => r && r.trim().length > 0);

        const substantialReflection = reflections.sort((a, b) => (b?.length || 0) - (a?.length || 0))[0];

        if (substantialReflection) {
            return substantialReflection.length > 80
                ? substantialReflection.substring(0, 80) + '...'
                : substantialReflection;
        }

        // Show action items preview
        if (entry.action_items && entry.action_items.length > 0) {
            const firstAction = entry.action_items.find(i => i.action.trim());
            if (firstAction) {
                const text = `→ ${firstAction.action.trim()}`;
                return text.length > 80 ? text.substring(0, 80) + '...' : text;
            }
        }

        if (entry.notes?.trim()) {
            return entry.notes.length > 80
                ? entry.notes.substring(0, 80) + '...'
                : entry.notes;
        }

        return 'No reflection recorded';
    }, []);

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

    const renderEntryCard = useCallback((entry: JournalEntry) => {
        const previewText = getPreviewText(entry);
        const dynamic = getDynamicCardStyle(previewText);

        return (
            <View>
                <ScalePressable
                    style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                    onPress={() => onEntryPress(entry)}
                >
                    <View style={styles.entryHeader}>
                        <View style={styles.entryHeaderLeft}>
                            <Text style={[styles.entryDate, { color: colors.textTertiary }]}>
                                {formatDate(entry.created_at)}
                            </Text>
                            {entry.book_name && (
                                <ScalePressable
                                    onPress={() => openBibleReference(
                                        entry.book_name,
                                        entry.chapter_start,
                                        entry.verse_start,
                                        entry.chapter_end,
                                        entry.verse_end
                                    )}
                                    style={[styles.refBadge, { backgroundColor: colors.accent + '12' }]}
                                >
                                    <Text style={[styles.entryScripture, { color: colors.accent }]}>
                                        {entry.book_name} {getChapterText(entry)}
                                    </Text>
                                </ScalePressable>
                            )}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </View>

                    <HyperlinkedText
                        style={[
                            styles.entryPreview,
                            {
                                color: colors.textPrimary,
                                fontSize: dynamic.fontSize,
                                lineHeight: dynamic.lineHeight,
                                marginBottom: 16
                            }
                        ]}
                        numberOfLines={3}
                        text={previewText}
                    />

                    <View style={styles.entryFooter}>
                        <View style={styles.reflectionIndicator}>
                            {Array.from({ length: 4 }).map((_, idx) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.reflectionDot,
                                        { backgroundColor: colors.border },
                                        idx < getAnswerCount(entry) && [styles.reflectionDotActive, { backgroundColor: colors.accentSecondary }]
                                    ]}
                                />
                            ))}
                        </View>
                    </View>
                </ScalePressable>
            </View>
        );
    }, [colors, onEntryPress, formatDate, getChapterText, getPreviewText, getAnswerCount]);

    const getDynamicCardStyle = (text: string) => {
        const length = text.length;
        if (length < 60) {
            return { fontSize: 18, lineHeight: 28, padding: 24 };
        } else if (length < 120) {
            return { fontSize: 16, lineHeight: 24, padding: 20 };
        } else {
            return { fontSize: 14, lineHeight: 22, padding: 16 };
        }
    };

    const renderActionCard = useCallback((item: EnhancedActionItem) => {
        const dynamic = getDynamicCardStyle(item.action);
        return (
            <View style={styles.bookCardWrapper}>
                <View style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, marginBottom: 0, padding: dynamic.padding }]}>
                    <View style={[styles.entryHeader, { marginBottom: 12 }]}>
                        <View style={styles.entryHeaderLeft}>
                            <Text style={[styles.entryDate, { color: colors.textTertiary }]}>{formatDate(item.created_at)}</Text>
                            <ScalePressable onPress={async () => {
                                try {
                                    const entry = await getEntryById(item.entry_id!);
                                    if (entry) onEntryPress(entry);
                                } catch (e) {
                                    console.error(e);
                                }
                            }}>
                                <ScalePressable onPress={() => openBibleReference(
                                    item.book_name,
                                    item.chapter_start,
                                    undefined,
                                    item.chapter_end,
                                    undefined
                                )}>
                                    <View style={[styles.refBadge, { backgroundColor: colors.accent + '12' }]}>
                                        <Text style={[styles.entryScripture, { color: colors.accent }]}>
                                            {item.book_name} {item.chapter_start}{item.chapter_end && item.chapter_end !== item.chapter_start ? `-${item.chapter_end}` : ''}
                                        </Text>
                                    </View>
                                </ScalePressable>
                            </ScalePressable>
                        </View>
                        <TouchableOpacity
                            onPress={() => handleTogglePin(item)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{ marginLeft: 'auto' }}
                        >
                            <Svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill={item.is_pinned ? colors.accent : 'none'}
                                stroke={item.is_pinned ? colors.accent : colors.textTertiary}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ transform: [{ rotate: '30deg' }] }}
                            >
                                <Path d="M12 17v5" />
                                <Path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                            </Svg>
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.entryPreview, { color: colors.textPrimary, fontWeight: '600', fontSize: dynamic.fontSize, lineHeight: dynamic.lineHeight, marginBottom: item.motivation ? 8 : 0 }]}>
                        {item.action}
                    </Text>
                    {item.motivation ? (
                        <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border + '30' }}>
                            <Text style={[styles.entryPreview, { color: colors.textSecondary, fontStyle: 'italic', marginBottom: 0, fontSize: Math.max(13, dynamic.fontSize - 2) }]}>
                                {item.motivation}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>
        );
    }, [colors, formatDate, onEntryPress, handleTogglePin]);

    const renderTopicCard = useCallback((item: JournalEntry) => {
        const dynamic = getDynamicCardStyle(item.study_further || '');
        const isCompleted = !!item.study_completed;

        return (
            <View style={styles.bookCardWrapper}>
                <View style={[
                    styles.entryCard,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.cardBorder,
                        marginBottom: 0,
                        padding: dynamic.padding,
                        opacity: isCompleted ? 0.6 : 1
                    }
                ]}>
                    <View style={[styles.entryHeader, { marginBottom: 12 }]}>
                        <View style={styles.entryHeaderLeft}>
                            <Text style={[styles.entryDate, { color: colors.textTertiary }]}>{formatDate(item.created_at)}</Text>
                            <ScalePressable onPress={() => onEntryPress(item)}>
                                <ScalePressable onPress={() => openBibleReference(
                                    item.book_name,
                                    item.chapter_start,
                                    undefined,
                                    item.chapter_end,
                                    undefined
                                )}>
                                    <View style={[styles.refBadge, { backgroundColor: colors.accentSecondary + '12' }]}>
                                        <Text style={[styles.entryScripture, { color: colors.accentSecondary }]}>
                                            {item.book_name} {item.chapter_start}{item.chapter_end && item.chapter_end !== item.chapter_start ? `-${item.chapter_end}` : ''}
                                        </Text>
                                    </View>
                                </ScalePressable>
                            </ScalePressable>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.topicContentContainer}>
                                <Text style={[
                                    styles.entryPreview,
                                    {
                                        color: colors.textPrimary,
                                        fontWeight: '600',
                                        fontSize: dynamic.fontSize,
                                        lineHeight: dynamic.lineHeight,
                                        marginBottom: item.study_further_reminder ? 8 : 0,
                                        textDecorationLine: isCompleted ? 'line-through' : 'none',
                                    }
                                ]}>
                                    {item.study_further}
                                </Text>
                                {isCompleted && (
                                    <View style={[styles.strikeThroughLine, { backgroundColor: colors.textPrimary, opacity: 0.4 }]} />
                                )}
                            </View>
                            {item.study_further_reminder && new Date(item.study_further_reminder) > new Date() ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, backgroundColor: colors.backgroundSubtle, borderColor: colors.border, alignSelf: 'flex-start', marginTop: 8, gap: 4 }}>
                                    <Ionicons name="notifications-outline" size={12} color={colors.textSecondary} />
                                    <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textSecondary }}>
                                        {new Date(item.study_further_reminder).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        <ScalePressable
                            onPress={() => handleToggleTopic(item)}
                            style={[
                                styles.checkCircle,
                                {
                                    borderColor: isCompleted ? colors.accentSecondary : colors.border,
                                    backgroundColor: isCompleted ? colors.accentSecondary + '20' : colors.backgroundSubtle + '40'
                                }
                            ]}
                        >
                            <Ionicons
                                name={isCompleted ? "checkmark-circle" : "checkmark"}
                                size={14}
                                color={isCompleted ? colors.accentSecondary : colors.textTertiary}
                            />
                        </ScalePressable>
                    </View>
                </View>
            </View>
        );
    }, [colors, formatDate, onEntryPress, handleToggleTopic]);

    const renderTopicHeader = useCallback((title: string, count: number) => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsArchiveCollapsed(!isArchiveCollapsed)}
            style={[styles.archiveHeader, { borderTopColor: colors.border }]}
        >
            <View style={styles.archiveHeaderContent}>
                <Text style={[styles.archiveHeaderText, { color: colors.textTertiary }]}>
                    {title} ({count})
                </Text>
                <Ionicons
                    name={isArchiveCollapsed ? "chevron-down" : "chevron-up"}
                    size={16}
                    color={colors.textTertiary}
                />
            </View>
        </TouchableOpacity>
    ), [colors, isArchiveCollapsed]);

    const renderDateGroupHeader = useCallback((title: string) => (
        <View style={styles.dateGroup}>
            <View style={styles.dateGroupContent}>
                <View style={[styles.dateGroupDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.dateGroupTitle, { color: colors.textPrimary }]}>{title}</Text>
            </View>
        </View>
    ), [colors]);

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
            return results;
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


    const renderBreadcrumbs = () => {
        const breadcrumbs = getBreadcrumbs();
        if (breadcrumbs.length === 0) return null;

        return (
            <View style={[styles.breadcrumbsContainer, { backgroundColor: colors.backgroundElevated, borderBottomColor: colors.border }]}>
                {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.label}>
                        {index > 0 && <Text style={[styles.breadcrumbSeparator, { color: colors.textTertiary }]}> / </Text>}
                        <ScalePressable
                            onPress={crumb.onPress}
                            disabled={index === breadcrumbs.length - 1}
                        >
                            <Text style={[
                                styles.breadcrumbText,
                                { color: colors.textSecondary },
                                index === breadcrumbs.length - 1 && [styles.breadcrumbTextCurrent, { color: colors.textPrimary }]
                            ]}>
                                {crumb.label}
                            </Text>
                        </ScalePressable>
                    </React.Fragment>
                ))}
            </View>
        );
    };

    const renderListItem = useCallback(({ item }: { item: ListItem }) => {
        switch (item.type) {
            case 'header':
                return renderDateGroupHeader(item.title);
            case 'entry':
                return renderEntryCard(item.entry);
            case 'action':
                return renderActionCard(item.action);
            case 'topic':
                return renderTopicCard(item.topic);
            case 'topicHeader':
                return renderTopicHeader(item.title, item.count);
            case 'emptyState':
                return renderEmptyState();
            case 'bookHeader':
                return (
                    <View style={[styles.bookDetailHeader, { borderBottomColor: colors.border, }]}></View>
                );
            case 'book':
                return (
                    <View style={styles.bookCardWrapper}>
                        <ScalePressable
                            style={[styles.bookCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                            onPress={() => navigateToBookDetail(item.book)}
                        >
                            <View style={styles.bookCardContent}>
                                <View style={styles.bookCardTextContainer}>
                                    <Text style={[styles.bookCardName, { color: colors.textPrimary }]}>{item.book.name}</Text>
                                </View>
                                <View style={[styles.entryCountBadge, { backgroundColor: colors.accent + '15' }]}>
                                    <Text style={[styles.entryCountText, { color: colors.accent }]}>
                                        {item.book.entryCount} {item.book.entryCount === 1 ? 'entry' : 'entries'}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </ScalePressable>
                    </View>
                );
            default:
                return null;
        }
    }, [colors, renderDateGroupHeader, renderEntryCard, renderActionCard, renderTopicCard, renderTopicHeader, navigateToBookDetail]);

    const renderEmptyState = useCallback(() => {
        let iconName: any = "journal-outline";
        let title = "It's awful quiet in here...";
        let subtext = "Don't just stare at the screen. Read your Bible and tell me about it!";

        if (viewMode === 'books') {
            iconName = "library-outline";
            title = "Empty shelves";
            subtext = "Read a book of the Bible so we can put something here.";
        } else if (viewMode === 'actions') {
            iconName = "flash-outline";
            title = "No actions recorded";
            subtext = "You didn't learn anything practical today? Write an action step";
        } else if (viewMode === 'topics') {
            iconName = "bookmark-outline";
            title = "No study topics";
            subtext = "Is there really nothing more you want to study? Add a topic.";
        } else if (debouncedSearchQuery) {
            iconName = "search-outline";
            title = "Nothing to see here";
            subtext = "I couldn't find what you're looking for. Try another search.";
        } else if (viewMode === 'bookDetail') {
            iconName = "book-outline";
            title = "Empty book";
            subtext = "You haven't read this book yet. Go read it!";
        }

        return (
            <View style={styles.emptyState}>
                <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSubtle }]}>
                    <Ionicons name={iconName} size={32} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyStateText, { color: colors.textPrimary }]}>{title}</Text>
                <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>{subtext}</Text>
            </View>
        );
    }, [viewMode, debouncedSearchQuery, colors]);

    const renderListHeader = () => (
        <View style={{ backgroundColor: colors.background }}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={styles.headerTitleRow}>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Journal</Text>
                </View>

                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                    <View
                        style={styles.tabBackground}
                        onLayout={(e) => {
                            const { width } = e.nativeEvent.layout;
                            if (width > 0 && tabContainerWidth !== width) {
                                setTabContainerWidth(width);
                            }
                        }}
                    >
                        <Animated.View
                            style={[
                                styles.tabIndicator,
                                {
                                    backgroundColor: colors.accent,
                                    width: '25%',
                                    left: viewMode === 'recent' ? '0%' : (viewMode === 'books' || viewMode === 'bookDetail') ? '25%' : viewMode === 'actions' ? '50%' : '75%',
                                }
                            ]}
                            layout={LinearTransition}
                        />
                        <ScalePressable style={styles.tab} onPress={navigateToRecent}>
                            <Ionicons name="time" size={20} color={viewMode === 'recent' ? colors.accent : colors.textTertiary} />
                        </ScalePressable>

                        <ScalePressable style={styles.tab} onPress={navigateToBooks}>
                            <Ionicons name="library" size={20} color={(viewMode === 'books' || viewMode === 'bookDetail') ? colors.accent : colors.textTertiary} />
                        </ScalePressable>

                        <ScalePressable style={styles.tab} onPress={navigateToActions}>
                            <Ionicons name="flash" size={20} color={viewMode === 'actions' ? colors.accent : colors.textTertiary} />
                        </ScalePressable>

                        <ScalePressable style={styles.tab} onPress={navigateToTopics}>
                            <Ionicons name="bookmark" size={20} color={viewMode === 'topics' ? colors.accent : colors.textTertiary} />
                        </ScalePressable>
                    </View>
                </View>
            </View>

            {renderBreadcrumbs()}

            {/* Search */}
            {(viewMode === 'recent' || viewMode === 'bookDetail') && (
                <View style={[styles.searchContainer, { backgroundColor: colors.backgroundElevated, borderBottomColor: colors.border }]}>
                    <TextInput
                        style={[styles.searchInput, { backgroundColor: colors.searchBackground, color: colors.textPrimary, borderColor: colors.border }]}
                        placeholder={
                            viewMode === 'bookDetail' && selectedBook
                                ? `Search ${selectedBook.name}...`
                                : "Search entries..."
                        }
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <ScalePressable
                            style={styles.clearSearch}
                            onPress={() => setSearchQuery('')}
                        >
                            <Text style={[styles.clearSearchText, { color: colors.textSecondary }]}>×</Text>
                        </ScalePressable>
                    )}
                </View>
            )}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {isLoading && entries.length === 0 ? (
                <View style={{ flex: 1 }}>
                    {renderListHeader()}
                    <LoadingView style={{ marginTop: 100 }} />
                </View>
            ) : (
                <Animated.FlatList
                    data={getFlatListData}
                    renderItem={renderListItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={[
                        styles.scrollContent,
                        getFlatListData.length === 0 && styles.emptyContainer
                    ]}
                    ListHeaderComponent={renderListHeader}
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
        padding: 20,
        paddingBottom: 120,
    },
    emptyContainer: {
        flexGrow: 1,
    },
    entriesList: {
        // No extra horizontal padding here, handled by scrollContent
    },
    dateGroup: {
        marginTop: 24,
        marginBottom: 16,
    },
    dateGroupContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dateGroupDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dateGroupTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        opacity: 0.5,
    },
    entryCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    entryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    entryDate: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    entryPreview: {
        fontSize: 16,
        lineHeight: 26,
        fontWeight: '500',
        marginBottom: 20,
        letterSpacing: -0.1,
    },
    entryFooter: {
        alignItems: 'flex-start',
    },
    reflectionIndicator: {
        flexDirection: 'row',
        gap: 8,
    },
    refBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    entryScripture: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    reflectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    reflectionDotActive: {
        // Color handled in component
    },
    bookCardWrapper: {
        marginBottom: 12,
    },
    bookCard: {
        borderRadius: 8,
        padding: 20,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bookCardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bookCardTextContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    bookCardName: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    entryCountBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    entryCountText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    archiveHeader: {
        marginTop: 24,
        paddingTop: 16,
        paddingBottom: 8,
        borderTopWidth: 0.5,
    },
    archiveHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    archiveHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    topicContentContainer: {
        position: 'relative',
        alignSelf: 'flex-start',
    },
    strikeThroughLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: 1.5,
        borderRadius: 1,
    },
});
