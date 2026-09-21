import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BibleBook, GREEK_BOOKS, HEBREW_BOOKS } from '../data/bibleBooks';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ScalePressable } from './ScalePressable';
import { Text } from './ui';

interface BookPickerProps {
    selectedBook?: BibleBook;
    onBookSelect: (book: BibleBook) => void;
    availableBooks?: BibleBook[];
}

interface BookCardProps {
    book: BibleBook;
    isSelected: boolean;
    colors: any;
    onBookSelect: (book: BibleBook) => void;
}

const BookCard = React.memo(({ book, isSelected, colors, onBookSelect }: BookCardProps) => (
    <ScalePressable
        style={[
            styles.bookCard,
            { backgroundColor: colors.cardBackground, borderColor: colors.border + '50' },
            isSelected && [styles.bookCardSelected, { backgroundColor: colors.accent + '08', borderColor: colors.accent }],
        ]}
        onPress={() => onBookSelect(book)}
    >
        <Text
            variant="cell"
            style={[
                styles.bookAbbreviation,
                { color: isSelected ? colors.textPrimary : colors.textSecondary },
            ]}
        >
            {book.abbrv}
        </Text>
        <Text
            variant="caption"
            style={{ color: isSelected ? colors.accent : colors.textTertiary }}
        >
            {book.chapters}
        </Text>
    </ScalePressable>
));

export const BookPicker: React.FC<BookPickerProps> = React.memo(({
    selectedBook,
    onBookSelect,
    availableBooks
}) => {
    const { colors } = useTheme();

    const getFilteredBooks = (books: BibleBook[]): BibleBook[] => {
        return books;
    };

    const renderSectionHeader = (title: string, subtitle: string) => (
        <View style={styles.sectionHeader}>
            <Text variant="label" tone="secondary" style={styles.sectionTitle}>{title}</Text>
            <Text variant="caption" style={styles.sectionSubtitle}>{subtitle}</Text>
            <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
        </View>
    );

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
                        colors={colors}
                        onBookSelect={onBookSelect}
                    />
                ))}
            </View>
        );
    };

    const renderContent = () => {
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
    sectionTitle: { marginBottom: Spacing.xs },
    sectionSubtitle: { marginBottom: Spacing.sm },
    sectionLine: {
        height: 1,
        width: 40,
        borderRadius: Spacing.borderRadius.none,
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
        borderWidth: 1.5,
    },
    bookAbbreviation: {
        textAlign: 'center',
        marginBottom: 2,
    },
    bookAbbreviationSelected: {
        fontWeight: Typography.weight.semibold,
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
        borderRadius: Spacing.borderRadius.round,
    },
});