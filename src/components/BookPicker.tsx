/**
 * All 66 books, in two sections.
 *
 * design/all-screens.html #books draws this as a list of rows — the name, and
 * the chapter count hanging off the right edge — not a grid of abbreviations.
 * The grid was the reason a reader had to know "1Th" meant 1 Thessalonians;
 * rows have room for the whole name, which is what both styles now use.
 *
 * The screen around the list (its mark, the filter field and the giant that
 * enlarges what you typed) lives in BookStep, since it belongs to the screen
 * rather than to the list.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BibleBook, GREEK_BOOKS, HEBREW_BOOKS } from '../data/bibleBooks';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { ScalePressable } from './ScalePressable';
import { Text } from './ui';

interface BookPickerProps {
    selectedBook?: BibleBook;
    onBookSelect: (book: BibleBook) => void;
    availableBooks?: BibleBook[];
    /** What the reader has typed into the filter, if anything. */
    query?: string;
}

/** Does this book answer to what's been typed? Name or abbreviation, either way. */
export function matchesQuery(book: BibleBook, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return book.name.toLowerCase().includes(q) || book.abbrv.toLowerCase().includes(q);
}

/** How many of the 66 a filter leaves standing. */
export function countMatches(query: string): number {
    return [...HEBREW_BOOKS, ...GREEK_BOOKS].filter(b => matchesQuery(b, query)).length;
}

/** `.co-book` / `.cl-book` — a row with the count hanging off its right edge. */
const BookRow = React.memo(({ book, isSelected, onBookSelect }: {
    book: BibleBook;
    isSelected: boolean;
    onBookSelect: (book: BibleBook) => void;
}) => {
    const { colors } = useTheme();
    return (
        <ScalePressable
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => onBookSelect(book)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
        >
            <Text variant="cell" tone={isSelected ? 'accent' : 'primary'}>{book.name}</Text>
            <Text variant="caption" style={styles.count}>{book.chapters} ch</Text>
        </ScalePressable>
    );
});

BookRow.displayName = 'BookRow';

/**
 * A section heading over a run of books.
 *
 * Cloth splits it — the canon's name on the left, "39 books" hanging off the
 * right on the same baseline. The mockup is explicit about it.
 */
function SectionHeading({ name, count, spaced }: { name: string; count: number; spaced?: boolean }) {
    return (
        <View style={[styles.clothSection, spaced && styles.sectionAfter]}>
            <Text variant="label">{name}</Text>
            <Text variant="caption" tone="secondary" style={styles.clothSectionCount}>
                {`${count} books`}
            </Text>
        </View>
    );
}

export const BookPicker: React.FC<BookPickerProps> = React.memo(({
    selectedBook,
    onBookSelect,
    availableBooks,
    query = '',
}) => {
    const hebrew = useMemo(() => HEBREW_BOOKS.filter(b => matchesQuery(b, query)), [query]);
    const greek = useMemo(() => GREEK_BOOKS.filter(b => matchesQuery(b, query)), [query]);

    const rows = (books: BibleBook[]) => books.map(book => (
        <BookRow
            key={book.name}
            book={book}
            isSelected={selectedBook?.name === book.name}
            onBookSelect={onBookSelect}
        />
    ));

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {availableBooks && availableBooks.length > 0 ? (
                rows(availableBooks.filter(b => matchesQuery(b, query)))
            ) : (
                <>
                    {hebrew.length > 0 && (
                        <>
                            <SectionHeading
                                name="Hebrew-Aramaic Scriptures"
                                count={HEBREW_BOOKS.length}
                            />
                            {rows(hebrew)}
                        </>
                    )}
                    {greek.length > 0 && (
                        <>
                            <SectionHeading
                                name="Christian Greek Scriptures"
                                count={GREEK_BOOKS.length}
                                spaced={hebrew.length > 0}
                            />
                            {rows(greek)}
                        </>
                    )}
                </>
            )}

            {/* The mockup's own line for a filter that has cut the list down. */}
            {query.trim().length > 0 && (
                <Text variant="bodySmall" style={styles.note}>
                    {hebrew.length + greek.length === 0
                        ? `Nothing matches “${query.trim()}”. Clear the filter to see all 66.`
                        : 'Clear the filter to see all 66.'}
                </Text>
            )}
        </ScrollView>
    );
});

BookPicker.displayName = 'BookPicker';

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: Spacing.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        height: Spacing.touchTarget + 2,
        borderBottomWidth: Spacing.border.hairline,
    },
    count: { marginLeft: 'auto' },
    /** `.cl-label` left, `.cl-sublabel` right, on one baseline. */
    clothSection: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    clothSectionCount: { textTransform: 'uppercase' },
    sectionAfter: { marginTop: Spacing.xl - 2 },
    note: { paddingTop: Spacing.xl + 2 },
});
