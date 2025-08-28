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
import { ALL_BIBLE_BOOKS, BibleBook, getBookByName } from '../data/bibleBooks';
import {
    JournalEntry as DBJournalEntry,
    getEntriesByBook,
    getJournalEntries,
    searchEntries
} from '../data/database';

interface JournalEntry {
    id: string;
    dateCreated: string;
    bookName: string;
    chapterStart: number;
    chapterEnd?: number;
    reflections: string[];
    notes: string;
    testament: 'Old' | 'New';
}

type ViewMode = 'recent' | 'books' | 'bookDetail';

interface NavigationBreadcrumb {
    label: string;
    onPress: () => void;
}

interface JournalEntryListProps {
    onEntryPress: (entry: DBJournalEntry) => void;
}

export const JournalEntryList: React.FC<JournalEntryListProps> = ({ onEntryPress }) => {
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

    // Animate tab indicator
    useEffect(() => {
        const toValue = viewMode === 'recent' ? 0 : 1;
        Animated.spring(tabAnimation, {
            toValue,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
        }).start();
    }, [viewMode]);

    const transformDbEntry = (dbEntry: DBJournalEntry): JournalEntry => {
        const book = getBookByName(dbEntry.book_name);
        return {
            id: dbEntry.id?.toString() || '',
            dateCreated: dbEntry.date_created,
            bookName: dbEntry.book_name,
            chapterStart: dbEntry.chapter_start || 1,
            chapterEnd: dbEntry.chapter_end,
            reflections: [
                dbEntry.reflection_1 || '',
                dbEntry.reflection_2 || '',
                dbEntry.reflection_3 || '',
                dbEntry.reflection_4 || '',
                dbEntry.reflection_5 || '',
            ],
            notes: dbEntry.notes || '',
            testament: book?.testament || 'New'
        };
    };

    const loadEntries = async () => {
        try {
            const dbEntries = getJournalEntries(100, 0);
            const transformedEntries = dbEntries.map(transformDbEntry);
            setEntries(transformedEntries);

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
            let dbEntries: DBJournalEntry[] = [];

            if (searchQuery.trim()) {
                const allSearchResults = searchEntries(searchQuery);
                dbEntries = allSearchResults.filter(entry => entry.book_name === selectedBook.name);
            } else {
                dbEntries = getEntriesByBook(selectedBook.name);
            }

            const transformedEntries = dbEntries.map(transformDbEntry);
            setBookEntries(transformedEntries);
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
            const searchResults = searchEntries(searchQuery);
            const transformedResults = searchResults.map(transformDbEntry);
            setFilteredEntries(transformedResults);
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
                onPress: () => { } // Current page, no action needed
            });
        }

        return breadcrumbs;
    };

    const handleEntryPress = (entry: JournalEntry) => {
        const dbEntry: DBJournalEntry = {
            id: parseInt(entry.id),
            date_created: entry.dateCreated,
            book_name: entry.bookName,
            chapter_start: entry.chapterStart,
            chapter_end: entry.chapterEnd,
            reflection_1: entry.reflections[0],
            reflection_2: entry.reflections[1],
            reflection_3: entry.reflections[2],
            reflection_4: entry.reflections[3],
            reflection_5: entry.reflections[4],
            notes: entry.notes,
        };
        onEntryPress(dbEntry);
    };

    const getChapterText = (entry: JournalEntry): string => {
        if (entry.chapterEnd && entry.chapterEnd !== entry.chapterStart) {
            return `${entry.chapterStart}–${entry.chapterEnd}`;
        }
        return entry.chapterStart.toString();
    };

    const getRelativeDate = (dateString: string): string => {
        const date = new Date(dateString);
        const today = new Date();
        const diffTime = today.getTime() - date.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    };

    const getPreviewText = (entry: JournalEntry): string => {
        const substantialReflection = entry.reflections
            .filter(r => r.trim().length > 0)
            .sort((a, b) => b.length - a.length)[0];

        if (substantialReflection) {
            return substantialReflection.length > 80
                ? substantialReflection.substring(0, 80) + '...'
                : substantialReflection;
        }

        if (entry.notes.trim()) {
            return entry.notes.length > 80
                ? entry.notes.substring(0, 80) + '...'
                : entry.notes;
        }

        return 'No reflection recorded';
    };

    const groupEntriesByDate = (entries: JournalEntry[]) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);

        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 14);

        const thisMonth = new Date(today);
        thisMonth.setDate(thisMonth.getDate() - 30);

        const groups = {
            today: [] as JournalEntry[],
            yesterday: [] as JournalEntry[],
            thisWeek: [] as JournalEntry[],
            lastWeek: [] as JournalEntry[],
            thisMonth: [] as JournalEntry[],
            older: [] as JournalEntry[]
        };

        entries.forEach(entry => {
            const entryDate = new Date(entry.dateCreated);
            if (entryDate.toDateString() === today.toDateString()) {
                groups.today.push(entry);
            } else if (entryDate.toDateString() === yesterday.toDateString()) {
                groups.yesterday.push(entry);
            } else if (entryDate >= thisWeek) {
                groups.thisWeek.push(entry);
            } else if (entryDate >= lastWeek) {
                groups.lastWeek.push(entry);
            } else if (entryDate >= thisMonth) {
                groups.thisMonth.push(entry);
            } else {
                groups.older.push(entry);
            }
        });

        return groups;
    };

    const renderEntryCard = (entry: JournalEntry, showDate: boolean = true) => (
        <TouchableOpacity
            key={entry.id}
            style={styles.entryCard}
            activeOpacity={0.7}
            onPress={() => handleEntryPress(entry)}
        >
            <View style={styles.entryHeader}>
                {showDate && (
                    <Text style={styles.entryDate}>{getRelativeDate(entry.dateCreated)}</Text>
                )}
                <View style={styles.entryReference}>
                    <Text style={styles.bookName}>{entry.bookName}</Text>
                    <Text style={styles.chapterText}>{getChapterText(entry)}</Text>
                </View>
                <Text style={styles.testamentBadge}>
                    {entry.testament === 'Old' ? 'OT' : 'NT'}
                </Text>
            </View>

            <Text style={styles.entryPreview}>
                {getPreviewText(entry)}
            </Text>
        </TouchableOpacity>
    );

    const renderDateGroup = (title: string, entries: JournalEntry[]) => {
        if (entries.length === 0) return null;

        return (
            <View key={title} style={styles.dateGroup}>
                <Text style={styles.dateGroupTitle}>{title}</Text>
                {entries.map(entry => renderEntryCard(entry, false))}
            </View>
        );
    };

    const renderBooksGrid = () => {
        if (availableBooks.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No books studied yet</Text>
                    <Text style={styles.emptyStateSubtext}>
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
                        style={styles.bookCard}
                        onPress={() => navigateToBookDetail(book)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.bookCardHeader}>
                            <Text style={styles.bookCardName}>{book.name}</Text>
                            <Text style={styles.bookCardTestament}>
                                {book.testament === 'Old' ? 'OT' : 'NT'}
                            </Text>
                        </View>
                        <Text style={styles.bookCardCount}>
                            236 entries
                        </Text>
                        <Text style={styles.bookCardChevron}>→</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderBreadcrumbs = () => {
        const breadcrumbs = getBreadcrumbs();
        if (breadcrumbs.length === 0) return null;

        return (
            <View style={styles.breadcrumbsContainer}>
                {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.label}>
                        {index > 0 && <Text style={styles.breadcrumbSeparator}> / </Text>}
                        <TouchableOpacity
                            onPress={crumb.onPress}
                            disabled={index === breadcrumbs.length - 1}
                        >
                            <Text style={[
                                styles.breadcrumbText,
                                index === breadcrumbs.length - 1 && styles.breadcrumbTextCurrent
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
                            <Text style={styles.emptyStateText}>
                                {searchQuery ? 'No entries match your search' : 'No entries yet'}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
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
                                .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
                                .map(entry => renderEntryCard(entry, true))}
                        </View>
                    );
                }

                // Show grouped entries
                const sortedEntries = filteredEntries.sort(
                    (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
                );
                const groupedEntries = groupEntriesByDate(sortedEntries);

                return (
                    <View style={styles.entriesList}>
                        {renderDateGroup('Today', groupedEntries.today)}
                        {renderDateGroup('Yesterday', groupedEntries.yesterday)}
                        {renderDateGroup('This Week', groupedEntries.thisWeek)}
                        {renderDateGroup('Last Week', groupedEntries.lastWeek)}
                        {renderDateGroup('Older', groupedEntries.older)}
                    </View>
                );

            case 'books':
                return renderBooksGrid();

            case 'bookDetail':
                if (bookEntries.length === 0) {
                    return (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>
                                {searchQuery ? 'No entries match your search' : 'No entries for this book'}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
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
                        <View style={styles.bookDetailHeader}>
                            <Text style={styles.bookDetailTitle}>{selectedBook?.name}</Text>
                            <Text style={styles.bookDetailSubtitle}>
                                {bookEntries.length} {bookEntries.length === 1 ? 'entry' : 'entries'}
                            </Text>
                        </View>
                        {bookEntries
                            .sort((a, b) => {
                                if (a.chapterStart !== b.chapterStart) {
                                    return a.chapterStart - b.chapterStart;
                                }
                                return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
                            })
                            .map(entry => renderEntryCard(entry, true))}
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Study Journal</Text>

                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                    <View style={styles.tabBackground}>
                        <Animated.View
                            style={[
                                styles.tabIndicator,
                                {
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
                                viewMode === 'recent' && styles.tabTextActive
                            ]}>Recent</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.tab}
                            onPress={navigateToBooks}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.tabText,
                                (viewMode === 'books' || viewMode === 'bookDetail') && styles.tabTextActive
                            ]}>Books</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Breadcrumbs */}
            {renderBreadcrumbs()}

            {/* Search */}
            {(viewMode === 'recent' || viewMode === 'bookDetail') && (
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder={
                            viewMode === 'bookDetail' && selectedBook
                                ? `Search ${selectedBook.name}...`
                                : "Search entries..."
                        }
                        placeholderTextColor="#a39b90"
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
                            <Text style={styles.clearSearchText}>×</Text>
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
        backgroundColor: '#f8f7f4',
    },
    header: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#e8e5e0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2c2a26',
        marginBottom: 16,
    },
    tabContainer: {
        marginBottom: 16,
    },
    tabBackground: {
        flexDirection: 'row',
        backgroundColor: '#f1efeb',
        borderRadius: 12,
        padding: 2,
        position: 'relative',
    },
    tabIndicator: {
        position: 'absolute',
        top: 2,
        width: '46%',
        height: '90%',
        backgroundColor: '#ffffff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        zIndex: 1,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6b6b6b',
    },
    tabTextActive: {
        color: '#2c2a26',
    },
    breadcrumbsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e8e5e0',
    },
    breadcrumbText: {
        fontSize: 14,
        color: '#8b4513',
        fontWeight: '500',
    },
    breadcrumbTextCurrent: {
        color: '#2c2a26',
        fontWeight: '600',
    },
    breadcrumbSeparator: {
        fontSize: 14,
        color: '#a39b90',
        marginHorizontal: 4,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e8e5e0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        height: 40,
        backgroundColor: '#f1efeb',
        borderRadius: 20,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#2c2a26',
    },
    clearSearch: {
        marginLeft: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e8e5e0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearSearchText: {
        fontSize: 18,
        color: '#6b6b6b',
        fontWeight: '300',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    entriesList: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    dateGroup: {
        marginBottom: 24,
    },
    dateGroupTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c2a26',
        marginBottom: 12,
    },
    entryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    entryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    entryDate: {
        fontSize: 12,
        color: '#a39b90',
        marginRight: 8,
        minWidth: 60,
    },
    entryReference: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    bookName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8b4513',
        marginRight: 4,
    },
    chapterText: {
        fontSize: 14,
        color: '#6b6b6b',
    },
    testamentBadge: {
        fontSize: 10,
        fontWeight: '700',
        color: '#8b4513',
        backgroundColor: '#f1efeb',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    entryPreview: {
        fontSize: 14,
        color: '#2c2a26',
        lineHeight: 20,
    },
    booksGrid: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    bookCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    bookCardHeader: {
        flex: 1,
    },
    bookCardName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c2a26',
        marginBottom: 2,
    },
    bookCardTestament: {
        fontSize: 10,
        fontWeight: '700',
        color: '#8b4513',
        backgroundColor: '#f1efeb',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    bookCardCount: {
        fontSize: 14,
        color: '#6b6b6b',
        marginRight: 12,
    },
    bookCardChevron: {
        fontSize: 16,
        color: '#a39b90',
    },
    bookDetailHeader: {
        marginBottom: 20,
    },
    bookDetailTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2c2a26',
        marginBottom: 4,
    },
    bookDetailSubtitle: {
        fontSize: 14,
        color: '#6b6b6b',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c2a26',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#6b6b6b',
        textAlign: 'center',
        lineHeight: 20,
    },
});