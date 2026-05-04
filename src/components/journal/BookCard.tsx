import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { BibleBook } from '../../data/bibleBooks';
import { ScalePressable } from '../ScalePressable';

export interface BookWithCount extends BibleBook {
    entryCount: number;
}

interface BookCardProps {
    book: BookWithCount;
    onNavigate: (book: BibleBook) => void;
}

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
                        <Text style={[styles.bookCardName, { color: colors.textPrimary }]}>{book.name}</Text>
                    </View>
                    <View style={[styles.entryCountBadge, { backgroundColor: colors.accent + '15' }]}>
                        <Text style={[styles.entryCountText, { color: colors.accent }]}>
                            {book.entryCount} {book.entryCount === 1 ? 'entry' : 'entries'}
                        </Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </ScalePressable>
        </View>
    );
});

const styles = StyleSheet.create({
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
});
