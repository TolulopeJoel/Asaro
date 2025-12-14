import { useTheme } from '@/src/theme/ThemeContext';
import { getLocalMidnight, isSameDay } from '@/src/utils/dateUtils';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ALL_BIBLE_BOOKS, BibleBook } from '../data/bibleBooks';
import {
    JournalEntry,
    getEntriesByBook,
    getJournalEntries,
    searchEntries
} from '../data/database';

type ViewMode = 'recent' | 'books' | 'bookDetail';

interface NavigationBreadcrumb {
    label: string;
    onPress: () => void;
}

interface JournalEntryListProps {
    onEntryPress: (entry: JournalEntry) => void;
}

export const JournalEntryList: React.FC<JournalEntryListProps> = ({ onEntryPress }) => {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('recent');
    const [selectedBook, setSelectedBook] = useState<BibleBook>();
    const [bookEntries, setBookEntries] = useState<JournalEntry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
    const [availableBooks, setAvailableBooks] = useState<BibleBook[]>([]);
    const [tabAnimation] = useState(new Animated.Value(0));

    useEffect(() => {
        loadEntries();
    }, []);

    useEffect(() => {
        if (viewMode === 'recent') {
            filterEntries();
        }
    }, [searchQuery, entries]);

    useEffect(() => {
        if (viewMode === 'bookDetail' && selectedBook) {
            loadBookEntries();
        }
    }, [selectedBook, searchQuery]);

    useEffect(() => {
        const toValue = viewMode === 'recent' ? 0 : 1;
        Animated.spring(tabAnimation, {
            toValue,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
        }).start();
    }, [viewMode]);

    const loadEntries = async () => {
        try {
            const dbEntries = await getJournalEntries(100, 0);
            setEntries(dbEntries);

            // Get available books with entry counts
            const bookCounts = new Map<string, number>();
            dbEntries.forEach(entry => {
                bookCounts.set(entry.book_name, (bookCounts.get(entry.book_name) || 0) + 1);
            });

            const booksWithEntries = ALL_BIBLE_BOOKS
                .filter(book => bookCounts.has(book.name))
                .map(book => ({ ...book, entryCount: bookCounts.get(book.name) || 0 }))
                .sort((a, b) => b.entryCount - a.entryCount);

            setAvailableBooks(booksWithEntries);
        } catch (error) {
            console.error('Error loading entries:', error);
        }
    };

    const loadBookEntries = async () => {
        if (!selectedBook) return;

        try {
            let dbEntries: JournalEntry[] = [];

            if (searchQuery.trim()) {
                const allSearchResults = await searchEntries(searchQuery);
                dbEntries = allSearchResults.filter(entry => entry.book_name === selectedBook.name);
            } else {
                dbEntries = await getEntriesByBook(selectedBook.name);
            }

            setBookEntries(dbEntries);
        } catch (error) {
            console.error('Error loading book entries:', error);
        }
    };

    const filterEntries = async () => {
        if (!searchQuery.trim()) {
            setFilteredEntries(entries);
            return;
        }

        try {
            const searchResults = await searchEntries(searchQuery);
            setFilteredEntries(searchResults);
        } catch (error) {
            console.error('Error filtering entries:', error);
            setFilteredEntries([]);
        }
    };

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

    const navigateToBookDetail = (book: BibleBook) => {
        setSelectedBook(book);
        setViewMode('bookDetail');
        setSearchQuery('');
    };

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

    const getChapterText = (entry: JournalEntry): string => {
        if (entry.chapter_end && entry.chapter_end !== entry.chapter_start) {
            return `${entry.chapter_start}–${entry.chapter_end}`;
        }
        return entry.chapter_start?.toString() || '';
    };

    const getAnswerCount = (entry: JournalEntry): number => {
        return [entry.reflection_1, entry.reflection_2, entry.reflection_3, entry.reflection_4]
            .filter(r => (r ?? '').trim().length > 0).length;
    };

    const formatDate = (dateString?: string): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getPreviewText = (entry: JournalEntry): string => {
        const reflections = [entry.reflection_1, entry.reflection_2, entry.reflection_3, entry.reflection_4]
            .filter(r => r && r.trim().length > 0);

        const substantialReflection = reflections.sort((a, b) => (b?.length || 0) - (a?.length || 0))[0];

        if (substantialReflection) {
            return substantialReflection.length > 80
                ? substantialReflection.substring(0, 80) + '...'
                : substantialReflection;
        }

        if (entry.notes?.trim()) {
            return entry.notes.length > 80
                ? entry.notes.substring(0, 80) + '...'
                : entry.notes;
        }

        return 'No reflection recorded';
    };

    const groupEntriesByDate = (entries: JournalEntry[]) => {
        const today = getLocalMidnight();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);
        thisWeek.setHours(0, 0, 0, 0);
        const thisMonth = new Date(today);
        thisMonth.setDate(thisMonth.getDate() - 30);
        thisMonth.setHours(0, 0, 0, 0);

        const groups = {
            today: [] as JournalEntry[],
            yesterday: [] as JournalEntry[],
            thisWeek: [] as JournalEntry[],
            thisMonth: [] as JournalEntry[],
            older: [] as JournalEntry[]
        };

        entries.forEach(entry => {
            const entryDate = new Date(entry.created_at || '');
            const entryDateLocal = getLocalMidnight(entryDate);

            if (isSameDay(entryDateLocal, today)) {
                groups.today.push(entry);
            } else if (isSameDay(entryDateLocal, yesterday)) {
                groups.yesterday.push(entry);
            } else if (entryDateLocal.getTime() >= thisWeek.getTime()) {
                groups.thisWeek.push(entry);
            } else if (entryDateLocal.getTime() >= thisMonth.getTime()) {
                groups.thisMonth.push(entry);
            } else {
                groups.older.push(entry);
            }
        });

        return groups;
    };

    const renderEntryCard = (entry: JournalEntry) => (
        <TouchableOpacity
            key={entry.id}
            style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => onEntryPress(entry)}
        >
            <View style={styles.entryHeader}>
                <Text style={[styles.entryDate, { color: colors.textTertiary }]}>{formatDate(entry.created_at)}</Text>
                {entry.book_name && (
                    <Text style={[styles.entryScripture, { color: colors.textSecondary }]}>{entry.book_name} {getChapterText(entry)}</Text>
                )}
            </View>
            <Text style={[styles.entryPreview, { color: colors.textPrimary }]}>
                {getPreviewText(entry)}
            </Text>

            <View style={styles.entryFooter}>
                <View style={styles.reflectionIndicator}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.reflectionDot,
                                { backgroundColor: colors.border },
                                index < getAnswerCount(entry) && [styles.reflectionDotActive, { backgroundColor: colors.accentSecondary }]
                            ]}
                        />
                    ))}
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderDateGroup = (title: string, entries: JournalEntry[]) => {
        if (entries.length === 0) return null;

        return (
            <View key={title} style={styles.dateGroup}>
                <Text style={[styles.dateGroupTitle, { color: colors.textPrimary }]}>{title}</Text>
                {entries.map(entry => renderEntryCard(entry))}
            </View>
        );
    };

    const renderBooksGrid = () => {
        if (availableBooks.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textPrimary }]}>No books studied yet</Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                        Create your first reflection to see books here
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.booksGrid}>
                {availableBooks.map(book => (
                    <TouchableOpacity
                        key={book.name}
                        style={[styles.bookCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                        onPress={() => navigateToBookDetail(book)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.bookCardHeader}>
                            <Text style={[styles.bookCardName, { color: colors.textPrimary }]}>{book.name}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderBreadcrumbs = () => {
        const breadcrumbs = getBreadcrumbs();
        if (breadcrumbs.length === 0) return null;

        return (
            <View style={[styles.breadcrumbsContainer, { backgroundColor: colors.backgroundElevated, borderBottomColor: colors.border }]}>
                {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.label}>
                        {index > 0 && <Text style={[styles.breadcrumbSeparator, { color: colors.textTertiary }]}> / </Text>}
                        <TouchableOpacity
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
                        </TouchableOpacity>
                    </React.Fragment>
                ))}
            </View>
        );
    };

    const renderContent = () => {
        switch (viewMode) {
            case 'recent':
                if (filteredEntries.length === 0) {
                    return (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyStateText, { color: colors.text }]}>
                                {searchQuery ? 'No entries match your search' : 'No entries yet'}
                            </Text>
                            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                                {searchQuery
                                    ? 'Try adjusting your search terms'
                                    : 'Start your first reflection to see it here'
                                }
                            </Text>
                        </View>
                    );
                }

                if (searchQuery.trim()) {
                    // Show search results without grouping
                    return (
                        <View style={styles.entriesList}>
                            {filteredEntries
                                .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
                                .map(entry => renderEntryCard(entry))}
                        </View>
                    );
                }

                // Show grouped entries
                const sortedEntries = filteredEntries.sort(
                    (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
                );
                const groupedEntries = groupEntriesByDate(sortedEntries);

                return (
                    <View style={styles.entriesList}>
                        {renderDateGroup('Today', groupedEntries.today)}
                        {renderDateGroup('Yesterday', groupedEntries.yesterday)}
                        {renderDateGroup('This Week', groupedEntries.thisWeek)}
                        {renderDateGroup('This Month', groupedEntries.thisMonth)}
                        {renderDateGroup('Older', groupedEntries.older)}
                    </View>
                );

            case 'books':
                return renderBooksGrid();

            case 'bookDetail':
                if (bookEntries.length === 0) {
                    return (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyStateText, { color: colors.text }]}>
                                {searchQuery ? 'No entries match your search' : 'No entries for this book'}
                            </Text>
                            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                                {searchQuery
                                    ? 'Try adjusting your search terms'
                                    : 'Create your first entry for this book'
                                }
                            </Text>
                        </View>
                    );
                }

                return (
                    <View style={styles.entriesList}>
                        <View style={[styles.bookDetailHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.bookDetailTitle, { color: colors.textPrimary }]}>{selectedBook?.name}</Text>
                            <Text style={[styles.bookDetailSubtitle, { color: colors.textSecondary }]}>
                                {bookEntries.length} {bookEntries.length === 1 ? 'entry' : 'entries'}
                            </Text>
                        </View>
                        {bookEntries
                            .sort((a, b) => {
                                if (a.chapter_start !== b.chapter_start) {
                                    return (a.chapter_start || 0) - (b.chapter_start || 0);
                                }
                                return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
                            })
                            .map(entry => renderEntryCard(entry))}
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.backgroundElevated, borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Past Entries</Text>

                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                    <View style={styles.tabBackground}>
                        <Animated.View
                            style={[
                                styles.tabIndicator,
                                {
                                    backgroundColor: colors.accent,
                                    left: tabAnimation.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['2%', '50%'],
                                    }),
                                }
                            ]}
                        />
                        <TouchableOpacity
                            style={styles.tab}
                            onPress={navigateToRecent}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: colors.textSecondary },
                                viewMode === 'recent' && { color: colors.textPrimary, fontWeight: '500' }
                            ]}>Recent</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.tab}
                            onPress={navigateToBooks}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: colors.textSecondary },
                                (viewMode === 'books' || viewMode === 'bookDetail') && { color: colors.textPrimary, fontWeight: '500' }
                            ]}>Books</Text>
                        </TouchableOpacity>
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
                        <TouchableOpacity
                            style={styles.clearSearch}
                            onPress={() => setSearchQuery('')}
                        >
                            <Text style={[styles.clearSearchText, { color: colors.textSecondary }]}>×</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {renderContent()}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 4,
        borderBottomWidth: 0.5,
    },
    headerTitle: {
        fontSize: 24, // Slightly larger
        fontWeight: '600',
        marginBottom: 20,
        letterSpacing: 0.5,
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
        width: '50%',
        height: 2,
        borderRadius: 1,
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
    tabTextActive: {
        fontWeight: '600',
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
        height: 48,
        borderRadius: 6,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
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
        paddingBottom: 100,
    },
    entriesList: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    dateGroup: {
        marginBottom: 32,
    },
    dateGroupTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 16,
        letterSpacing: 1,
        textTransform: 'uppercase',
        opacity: 0.7,
    },
    entryCard: {
        borderRadius: 8, // Softened from 4
        padding: 24,
        marginBottom: 12,
        borderWidth: 1,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    entryDate: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    entryPreview: {
        fontSize: 16,
        lineHeight: 26,
        fontWeight: '400',
        marginBottom: 20,
        letterSpacing: 0.1,
    },
    entryFooter: {
        alignItems: 'flex-start',
    },
    reflectionIndicator: {
        flexDirection: 'row',
        gap: 8,
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
    booksGrid: {
        paddingHorizontal: 24,
        paddingTop: 24,
        justifyContent: 'space-between',
        gap: 12,
    },
    bookCard: {
        borderRadius: 8, // Softened
        padding: 20,
        marginBottom: 0, // Handled by gap
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    bookCardHeader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookCardName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    bookDetailHeader: {
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 0.5,
    },
    bookDetailTitle: {
        fontSize: 28,
        fontWeight: '600',
        marginBottom: 8,
        letterSpacing: 0.2,
    },
    bookDetailSubtitle: {
        fontSize: 14,
        fontWeight: '400',
        textTransform: 'lowercase',
        letterSpacing: 0.5,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 48,
        paddingVertical: 80,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: 0.2,
    },
    emptyStateSubtext: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '400',
    },
});
