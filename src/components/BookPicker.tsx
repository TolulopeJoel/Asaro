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
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

interface BookPickerProps {
    selectedBook?: BibleBook;
    onBookSelect: (book: BibleBook) => void;
    availableBooks?: BibleBook[];
}

export const BookPicker: React.FC<BookPickerProps> = React.memo(({
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

    const BookCard = React.memo(({ book, isSelected }: { book: BibleBook, isSelected: boolean }) => (
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
    ));

    const renderBookGrid = (books: BibleBook[], isGreekBooks = false) => {
        return (
            <View style={[
                styles.booksGrid,
                isGreekBooks && styles.GreekBooksGrid
            ]}>
                {books.map(book => (
                    <BookCard
                        key={book.name}
                        book={book}
                        isSelected={selectedBook?.name === book.name}
                    />
                ))}
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
                    {filteredBooks.map(book => (
                        <BookCard
                            key={book.name}
                            book={book}
                            isSelected={selectedBook?.name === book.name}
                        />
                    ))}
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
});

BookPicker.displayName = 'BookPicker';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 400,
    },
    searchInput: {
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.lg,
        paddingVertical: 14,
        paddingHorizontal: Spacing.lg,
        fontSize: Typography.size.md,
        marginBottom: Spacing.xl,
        fontWeight: Typography.weight.regular,
        letterSpacing: 0.2,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: Spacing.xl,
    },
    booksContainer: {
        flex: 1,
    },
    sectionHeader: {
        marginBottom: Spacing.lg,
        marginTop: Spacing.sm,
    },
    sectionTitle: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
        marginBottom: Spacing.xs,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    sectionSubtitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.regular,
        letterSpacing: 0.5,
        marginBottom: Spacing.sm,
    },
    sectionLine: {
        height: 1,
        width: 40,
        borderRadius: 1,
    },
    booksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    GreekBooksGrid: {
        paddingTop: Spacing.md,
    },
    bookCard: {
        width: '31%',
        aspectRatio: 1.3,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        marginBottom: Spacing.sm,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    bookCardSelected: {
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1.5,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchResultCard: {
        paddingTop: Spacing.sm,
    },
    bookAbbreviation: {
        fontSize: 15, // Keeping slightly custom for specific card fit
        fontWeight: Typography.weight.medium,
        textAlign: 'center',
        marginBottom: 2,
        letterSpacing: 0.3,
    },
    bookAbbreviationSelected: {
        fontWeight: Typography.weight.semibold,
    },
    chapterCount: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.regular,
        letterSpacing: 0.3,
    },
    chapterCountSelected: {
        fontWeight: Typography.weight.medium,
    },
    selectedDot: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
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
        gap: Spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxxl,
    },
    emptyStateText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        marginBottom: Spacing.sm,
        letterSpacing: 0.2,
    },
    emptyStateSubtext: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.regular,
        letterSpacing: 0.3,
        textAlign: 'center',
    },
});