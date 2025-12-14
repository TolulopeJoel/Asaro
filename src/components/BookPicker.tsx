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
        backgroundColor: '#fefefe',
        borderWidth: 1,
        borderColor: '#f0ede8',
        borderRadius: 2,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#3d3528',
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
        fontSize: 16,
        fontWeight: '400',
        color: '#6b5b47',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#a39b90',
        fontWeight: '300',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    sectionLine: {
        height: 1,
        backgroundColor: '#f0ede8',
        width: 40,
    },
    booksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    GreekBooksGrid: {
        paddingTop: 12,
    },
    bookCard: {
        width: '31%',
        aspectRatio: 1.2,
        backgroundColor: '#fefefe',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#f0ede8',
        marginBottom: 8,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    bookCardSelected: {
        backgroundColor: '#f5f2ed',
        borderRadius: 7,
        borderColor: '#d6d3ce',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    searchResultCard: {
        paddingTop: 8,
    },
    bookAbbreviation: {
        fontSize: 13,
        fontWeight: '500',
        color: '#3d3528',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    bookAbbreviationSelected: {
        color: '#6b5b47',
        fontWeight: '600',
    },
    chapterCount: {
        fontSize: 11,
        color: '#a39b90',
        fontWeight: '300',
        letterSpacing: 0.3,
    },
    chapterCountSelected: {
        color: '#8b7355',
        fontWeight: '400',
    },
    selectedDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#8b7355',
    },
    searchResults: {
        flex: 1,
    },
    searchResultsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#756b5e',
        fontWeight: '400',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    emptyStateSubtext: {
        fontSize: 13,
        color: '#a39b90',
        fontWeight: '300',
        letterSpacing: 0.3,
    },
});