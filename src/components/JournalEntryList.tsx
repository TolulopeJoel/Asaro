import { StatusBar } from 'expo-status-bar';
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

    const getAnswerCount = (entry: JournalEntry): number => {
        return entry.reflections.filter(answer => (answer ?? '').trim().length > 0).length;
    };


    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
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
            const entryDate = new Date(entry.dateCreated);
            if (entryDate.toDateString() === today.toDateString()) {
                groups.today.push(entry);
            } else if (entryDate.toDateString() === yesterday.toDateString()) {
                groups.yesterday.push(entry);
            } else if (entryDate >= thisWeek) {
                groups.thisWeek.push(entry);
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
                <Text style={styles.entryDate}>{formatDate(entry.dateCreated)}</Text>
                {entry.bookName && (
                    <Text style={styles.entryScripture}>{entry.bookName} {getChapterText(entry)}</Text>
                )}
            </View>
            <Text style={styles.entryPreview}>
                {getPreviewText(entry)}
            </Text>

            <View style={styles.entryFooter}>
                <View style={styles.reflectionIndicator}>
                    {Array.from({ length: 5 }).map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.reflectionDot,
                                index < getAnswerCount(entry) && styles.reflectionDotActive
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
            <StatusBar hidden={true} />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Past Entries</Text>

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
        backgroundColor: '#f7f6f3', // Warm off-white, like handmade paper
    },
    header: {
        backgroundColor: '#fefdfb', // Pure but warm white
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: '#e6e2db', // Subtle stone
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '400', // Lighter weight for elegance
        color: '#3d3a33', // Deep warm charcoal
        marginBottom: 20,
        letterSpacing: 0.3,
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
        height: 1.5,
        backgroundColor: '#4a453c', // Subtle underline
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
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
        color: '#8a8074', // Muted taupe
        letterSpacing: 0.2,
    },
    tabTextActive: {
        color: '#4a453c', // Deep warm tone
        fontWeight: '500',
    },
    breadcrumbsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#fefdfb',
        borderBottomWidth: 0.5,
        borderBottomColor: '#e6e2db',
    },
    breadcrumbText: {
        fontSize: 13,
        color: '#7a6f5f', // Muted earth tone
        fontWeight: '400',
        letterSpacing: 0.1,
    },
    breadcrumbTextCurrent: {
        color: '#4a453c',
        fontWeight: '500',
    },
    breadcrumbSeparator: {
        fontSize: 13,
        color: '#b8aea0', // Soft stone
        marginHorizontal: 6,
        fontWeight: '300',
    },
    searchContainer: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#fefdfb',
        borderBottomWidth: 0.5,
        borderBottomColor: '#e6e2db',
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#f2f0ed', // Subtle warm grey
        borderRadius: 6, // More refined corners
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#4a453c',
        borderWidth: 0.5,
        borderColor: 'transparent',
    },
    clearSearch: {
        marginLeft: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearSearchText: {
        fontSize: 16,
        color: '#8a8074',
        fontWeight: '300',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    entriesList: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    dateGroup: {
        marginBottom: 32,
    },
    dateGroupTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#4a453c',
        marginBottom: 16,
        letterSpacing: 0.2,
        textTransform: 'capitalize',
    },
    entryCard: {
        backgroundColor: '#fefdfb',
        borderRadius: 4,
        // paddingVertical: 24,
        // paddingHorizontal: 8,
        padding: 20,
        marginBottom: 1,
        borderWidth: 0.5,
        borderColor: '#ede8e0', // Very subtle border

        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    entryDate: {
        fontSize: 12,
        color: '#9b9185', // Muted stone
        // marginRight: 12,
        minWidth: 70,
        lineHeight: 16,
        fontWeight: '400',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    entryPreview: {
        fontSize: 15,
        color: '#4a453c',
        lineHeight: 24,
        fontWeight: '300',
        marginBottom: 16,
    },
    entryFooter: {
        alignItems: 'flex-start',
    },
    reflectionIndicator: {
        flexDirection: 'row',
        gap: 6,
    },
    entryScripture: {
        fontSize: 14,
        color: '#8a8074',
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    reflectionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#e8e8e8',
    },
    reflectionDotActive: {
        backgroundColor: '#2c2c2c',
    },




    booksGrid: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    bookCard: {
        backgroundColor: '#fefdfb',
        borderRadius: 8,
        padding: 20,
        marginBottom: 16,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
        borderWidth: 0.5,
        borderColor: '#ede8e0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    bookCardHeader: {
        flex: 1,
    },
    bookCardName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#4a453c',
        marginBottom: 6,
        letterSpacing: 0.1,
    },
    bookDetailHeader: {
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ede8e0',
    },
    bookDetailTitle: {
        fontSize: 20,
        fontWeight: '500',
        color: '#4a453c',
        marginBottom: 6,
        letterSpacing: 0.2,
    },
    bookDetailSubtitle: {
        fontSize: 12,
        color: '#8a8074',
        fontWeight: '400',
        textTransform: 'lowercase',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 48,
        paddingVertical: 80,
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '400',
        color: '#4a453c',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: 0.1,
    },
    emptyStateSubtext: {
        fontSize: 13,
        color: '#8a8074',
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '400',
    },
});