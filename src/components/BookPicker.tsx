import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ALL_BIBLE_BOOKS, BibleBook, GREEK_BOOKS, HEBREW_BOOKS } from '../data/bibleBooks';
import { useTheme } from '../theme/ThemeContext';

interface BookPickerProps {
    selectedBook?: BibleBook;
    onBookSelect: (book: BibleBook) => void;
    availableBooks?: BibleBook[];
}

export const BookPicker: React.FC<BookPickerProps> = ({
    selectedBook,
    onBookSelect,
    availableBooks
}) => {
    const { colors } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');

    const getFilteredBooks = (books: BibleBook[]): BibleBook[] => {
        if (searchQuery.trim()) {
            return books.filter(book =>
                book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                book.abbrv.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return books;
    };

    const renderSectionHeader = (title: string, subtitle: string) => (
        <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
            <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
        </View>
    );

    const renderBookGrid = (books: BibleBook[], isGreekBooks = false) => {
        return (
            <View style={[
                styles.booksGrid,
                isGreekBooks && styles.GreekBooksGrid
            ]}>
                {books.map(book => {
                    const isSelected = selectedBook?.name === book.name;

                    return (
                        <TouchableOpacity
                            key={book.name}
                            style={[
                                styles.bookCard,
                                { backgroundColor: colors.cardBackground, borderColor: colors.border },
                                isSelected && [styles.bookCardSelected, { backgroundColor: colors.backgroundSubtle, borderColor: colors.accentSecondary }],
                            ]}
                            onPress={() => onBookSelect(book)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.bookAbbreviation,
                                { color: colors.text },
                                isSelected && [styles.bookAbbreviationSelected, { color: colors.textSecondary }]
                            ]}>
                                {book.abbrv}
                            </Text>
                            <Text style={[
                                styles.chapterCount,
                                { color: colors.textTertiary },
                                isSelected && [styles.chapterCountSelected, { color: colors.textSecondary }]
                            ]}>
                                {book.chapters}
                            </Text>
                            {isSelected && <View style={[styles.selectedDot, { backgroundColor: colors.textSecondary }]} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderSearchResults = () => {
        const filteredBooks = getFilteredBooks(ALL_BIBLE_BOOKS);

        if (filteredBooks.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>This Book no dey Bible o 👀😂</Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textTertiary }]}>
                        Check your spelling or try a different search term
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.searchResults}>
                <View style={styles.searchResultsGrid}>
                    {filteredBooks.map(book => {
                        const isSelected = selectedBook?.name === book.name;

                        return (
                            <TouchableOpacity
                                key={book.name}
                                style={[
                                    styles.bookCard,
                                    styles.searchResultCard,
                                    { backgroundColor: colors.cardBackground, borderColor: colors.border },
                                    isSelected && [styles.bookCardSelected, { backgroundColor: colors.backgroundSubtle, borderColor: colors.accentSecondary }],
                                ]}
                                onPress={() => onBookSelect(book)}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.bookAbbreviation,
                                    { color: colors.text },
                                    isSelected && [styles.bookAbbreviationSelected, { color: colors.textSecondary }]
                                ]}>
                                    {book.abbrv}
                                </Text>
                                <Text style={[
                                    styles.chapterCount,
                                    { color: colors.textTertiary },
                                    isSelected && [styles.chapterCountSelected, { color: colors.textSecondary }]
                                ]}>
                                    {book.chapters}
                                </Text>
                                {isSelected && <View style={[styles.selectedDot, { backgroundColor: colors.textSecondary }]} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderContent = () => {
        if (searchQuery.trim()) {
            return renderSearchResults();
        }

        if (availableBooks && availableBooks.length > 0) {
            return (
                <View style={styles.booksContainer}>
                    {renderBookGrid(availableBooks)}
                </View>
            )
        }

        const filteredHB = getFilteredBooks(HEBREW_BOOKS);
        const filteredGK = getFilteredBooks(GREEK_BOOKS);

        return (
            <View style={styles.booksContainer}>
                {/* Hebrew-Aramic Section */}
                {renderSectionHeader('Hebrew-Aramic Scriptures', '39 books')}
                {renderBookGrid(filteredHB, false)}

                {/* Greek Section */}
                {renderSectionHeader('Christian Greek Scriptures', '27 books')}
                {renderBookGrid(filteredGK, true)}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <TextInput
                style={[styles.searchInput, { backgroundColor: colors.searchBackground, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Search..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
            />

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
        minHeight: 400,
    },
    searchInput: {
        borderWidth: 1,
        borderRadius: 12, // Softened from 2
        paddingVertical: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 24,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    booksContainer: {
        flex: 1,
    },
    sectionHeader: {
        marginBottom: 16,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    sectionSubtitle: {
        fontSize: 12,
        fontWeight: '400',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    sectionLine: {
        height: 1,
        width: 40,
        borderRadius: 1,
    },
    booksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between', // Changed from space-around for better alignment
        marginBottom: 12,
        gap: 8, // Use gap for cleaner spacing
    },
    GreekBooksGrid: {
        paddingTop: 12,
    },
    bookCard: {
        width: '31%',
        aspectRatio: 1.3, // Slightly wider
        borderRadius: 16, // Softened from 2
        borderWidth: 1,
        marginBottom: 8,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    bookCardSelected: {
        borderRadius: 16,
        borderWidth: 1.5, // Slightly thicker border for selection
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchResultCard: {
        paddingTop: 8,
    },
    bookAbbreviation: {
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 2,
        letterSpacing: 0.3,
    },
    bookAbbreviationSelected: {
        fontWeight: '600',
    },
    chapterCount: {
        fontSize: 11,
        fontWeight: '400',
        letterSpacing: 0.3,
    },
    chapterCountSelected: {
        fontWeight: '500',
    },
    selectedDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    searchResults: {
        flex: 1,
    },
    searchResultsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
        letterSpacing: 0.2,
    },
    emptyStateSubtext: {
        fontSize: 14,
        fontWeight: '400',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
});