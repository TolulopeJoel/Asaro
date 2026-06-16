import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { JournalEntry } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { HyperlinkedText } from '../HyperlinkedText';
import { formatDate, getAnsweredStatus, getChapterText, getDynamicCardStyle, getPreviewText } from './JournalCardHelpers';

interface EntryCardProps {
    entry: JournalEntry;
    onEntryPress: (entry: JournalEntry) => void;
}

export const EntryCard = React.memo(({ entry, onEntryPress }: EntryCardProps) => {
    const { colors } = useTheme();
    const previewText = getPreviewText(entry);
    const dynamic = getDynamicCardStyle(previewText);

    return (
        <View>
            <ScalePressable
                style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                onPress={() => onEntryPress(entry)}
            >
                <View style={styles.entryHeader}>
                    <View style={styles.entryHeaderLeft}>
                        <Text style={[styles.entryDate, { color: colors.textTertiary }]}>
                            {formatDate(entry.created_at)}
                        </Text>
                        {entry.book_name && (
                            <View style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}>
                                <Text style={[styles.entryScripture, { color: colors.accent + 'A5' }]}>
                                    {entry.book_name} {getChapterText(entry)}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
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
    entryCard: {
        borderRadius: 12,
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
    entryDate: {
        fontSize: 12,
        fontWeight: '500',
    },
    refBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
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
        borderRadius: 4,
    },
});