import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { JournalEntry } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { formatWhen, getChapterText, getPreviewText } from './JournalCardHelpers';
import { Spacing } from '../../theme/spacing';
import { Text } from '../ui';

interface EntryCardProps {
    entry: JournalEntry;
    /**
     * On a book's own screen the header already names the book, so the row
     * reads "Chapters 12–15" rather than repeating "Genesis" down the list.
     */
    omitBookName?: boolean;
    onEntryPress: (entry: JournalEntry) => void;
}

/**
 * One entry in the library list.
 *
 * `.cl-row`: the reference, a one-line snippet under it, and how long ago on
 * the right, separated by a hairline. The type comes from the variant system —
 * `reference` is Fraunces 17, `bodySmall` 13, `meta` 10.5.
 *
 * No card border, date badge, chevron or reflection dots: none of that chrome
 * is in the mockup, where the library is a run of type on cloth.
 */
export const EntryCard = React.memo(({ entry, omitBookName = false, onEntryPress }: EntryCardProps) => {
    const { colors } = useTheme();
    const previewText = getPreviewText(entry);

    const reference = omitBookName
        ? `${entry.chapter_end && entry.chapter_end !== entry.chapter_start ? 'Chapters' : 'Chapter'} ${getChapterText(entry)}`
        : `${entry.book_name} ${getChapterText(entry)}`;

    return (
        <ScalePressable
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => onEntryPress(entry)}
            accessibilityRole="button"
            accessibilityLabel={`Open entry for ${reference}`}
        >
            <View style={styles.rowMain}>
                {entry.book_name ? <Text variant="reference">{reference}</Text> : null}
                <Text variant="bodySmall" numberOfLines={1} style={styles.rowSnippet}>
                    {previewText}
                </Text>
            </View>
            <Text variant="meta">{formatWhen(entry.created_at)}</Text>
        </ScalePressable>
    );
});

EntryCard.displayName = 'EntryCard';

const styles = StyleSheet.create({
    /**
     * `.cl-row{gap:14px; padding:16px 0}` against `.co-row{gap:12px; padding:15px 0}`.
     * The two are within a pixel of each other, so one row serves both and the
     * difference stays where the design puts it — in the type.
     */
    row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.md + 1,
        paddingVertical: Spacing.lg - 1,
        borderBottomWidth: Spacing.border.hairline,
    },
    rowMain: {
        flex: 1,
        minWidth: 0,
    },
    /** `.cl-snip{margin:4px 0 0}` / `.co-snip{margin:3px 0 0}` */
    rowSnippet: {
        marginTop: 3,
    },
});
