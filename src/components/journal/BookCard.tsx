import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { BibleBook } from '../../data/bibleBooks';
import { ScalePressable } from '../ScalePressable';
import { Spacing } from '../../theme/spacing';
import { Text } from '../ui';

export interface BookWithCount extends BibleBook {
    entryCount: number;
}

interface BookCardProps {
    book: BookWithCount;
    onNavigate: (book: BibleBook) => void;
}

/**
 * A book in the library's Books list.
 *
 * A panel carrying the book's name, its entry count as an ochre badge, and a
 * chevron. The comment here used to describe the opposite of all three — "a
 * hairline under it, no panel, no ochre badge and no chevron" — because it
 * was written for the Colossal row, which was deleted while the Cloth code it
 * sat above survived. A comment that contradicts the code beneath it is worse
 * than none: the next person trusts it.
 */
export const BookCard = React.memo(({ book, onNavigate }: BookCardProps) => {
    const { colors } = useTheme();

    return (
        <View style={styles.bookCardWrapper}>
            <ScalePressable
                style={[styles.bookCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                onPress={() => onNavigate(book)}
            >
                <View style={styles.bookCardContent}>
                    <View style={styles.bookCardTextContainer}>
                        <Text variant="subtitle">{book.name}</Text>
                    </View>
                    <View style={[styles.entryCountBadge, { backgroundColor: colors.accent + '15' }]}>
                        <Text variant="label" tone="accent">
                            {book.entryCount} {book.entryCount === 1 ? 'entry' : 'entries'}
                        </Text>
                    </View>
                </View>
                <ChevronRight size={16} color={colors.textTertiary} />
            </ScalePressable>
        </View>
    );
});

const styles = StyleSheet.create({
    bookCardWrapper: {
        marginBottom: 12,
    },
    bookCard: {
        borderRadius: Spacing.borderRadius.lg,
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
    entryCountBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Spacing.borderRadius.lg,
    },
});
