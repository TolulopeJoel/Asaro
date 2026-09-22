import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { JournalEntry } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { HyperlinkedText } from '../HyperlinkedText';
import { formatDate, formatWhen, getAnsweredStatus, getChapterText, getDynamicCardStyle, getPreviewText } from './JournalCardHelpers';
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
 * Colossal draws `.co-row`: the reference, a one-line snippet under it and
 * how long ago on the right, separated by a hairline. It carries no card, no
 * reference badge, no chevron and no reflection dots — the mockup's Locked In
 * library is six rows of type on a black ground and nothing else, and adding
 * the card chrome back is what made it read as a different screen.
 *
 * Cloth keeps its card, which is what its own mockup draws.
 */
export const EntryCard = React.memo(({ entry, omitBookName = false, onEntryPress }: EntryCardProps) => {
    const { colors, isLockedIn } = useTheme();
    const previewText = getPreviewText(entry);
    const dynamic = getDynamicCardStyle(previewText);

    if (isLockedIn) {
        return (
            <ScalePressable
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => onEntryPress(entry)}
            >
                <View style={styles.rowMain}>
                    {entry.book_name ? (
                        <Text variant="reference">
                            {omitBookName
                                ? `${entry.chapter_end && entry.chapter_end !== entry.chapter_start ? 'Chapters' : 'Chapter'} ${getChapterText(entry)}`
                                : `${entry.book_name} ${getChapterText(entry)}`}
                        </Text>
                    ) : null}
                    <Text variant="bodySmall" numberOfLines={1} style={styles.rowSnippet}>
                        {previewText}
                    </Text>
                </View>
                <Text variant="meta">{formatWhen(entry.created_at)}</Text>
            </ScalePressable>
        );
    }

    return (
        <View>
            <ScalePressable
                style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                onPress={() => onEntryPress(entry)}
            >
                <View style={styles.entryHeader}>
                    <View style={styles.entryHeaderLeft}>
                        <Text variant="bodySmall" tone="tertiary">
                            {formatDate(entry.created_at)}
                        </Text>
                        {entry.book_name && (
                            <View style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}>
                                <Text variant="label" style={{ color: colors.accent + 'A5' }}>
                                    {entry.book_name} {getChapterText(entry)}
                                </Text>
                            </View>
                        )}
                    </View>
                    <ChevronRight size={14} color={colors.textMuted} />
                </View>

                <HyperlinkedText
                    style={[
                        styles.entryPreview,
                        {
                            color: colors.textPrimary,
                            fontSize: dynamic.fontSize,
                            lineHeight: dynamic.lineHeight,
                            marginBottom: 10,
                        }
                    ]}
                    numberOfLines={3}
                    text={previewText}
                />

                <View style={styles.entryFooter}>
                    <View style={styles.reflectionIndicator}>
                        {getAnsweredStatus(entry).map((answered, idx) => (
                            <View
                                key={idx}
                                style={[
                                    styles.reflectionDot,
                                    { backgroundColor: colors.border },
                                    answered && { backgroundColor: colors.accentSecondary }
                                ]}
                            />
                        ))}
                    </View>
                </View>
            </ScalePressable>
        </View>
    );
});

const styles = StyleSheet.create({
    // .co-row
    row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.md,
        paddingVertical: Spacing.lg - 1,
        borderBottomWidth: Spacing.border.hairline,
    },
    // .co-rmain
    rowMain: {
        flex: 1,
        minWidth: 0,
    },
    // .co-snip
    rowSnippet: {
        marginTop: 3,
    },
    entryCard: {
        borderRadius: Spacing.borderRadius.lg,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    entryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    entryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    refBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Spacing.borderRadius.lg,
    },
    entryScripture: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    entryPreview: {
        fontWeight: '500',
    },
    entryFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    reflectionIndicator: {
        flexDirection: 'row',
        gap: 5,
    },
    reflectionDot: {
        width: 8,
        height: 8,
        borderRadius: Spacing.borderRadius.round,
    },
});