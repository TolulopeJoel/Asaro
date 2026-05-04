import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { getRecentStudyTopics, JournalEntry } from '../data/database';
import { ScalePressable } from './ScalePressable';
import { HyperlinkedText } from './HyperlinkedText';

interface StudyRemindersProps {
    onEntryPress: (entry: JournalEntry) => void;
    topics?: JournalEntry[];
}

const BookmarkCard = React.memo(({ item, onEntryPress }: { item: JournalEntry, onEntryPress: (entry: JournalEntry) => void }) => {
    const { colors } = useTheme();

    const formattedDate = (() => {
        const date = new Date(item.created_at);
        const now = new Date();
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' })
        });
    })();

    return (
        <ScalePressable onPress={() => onEntryPress(item)}>
            <View style={[styles.bookmarkCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={[styles.accentLine, { backgroundColor: colors.accent + 'A5' }]} />

                <View style={styles.bookmarkContent}>
                    <View style={styles.bookmarkHeader}>
                        <View style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}>
                            <Text style={[styles.refText, { color: colors.accent + 'A5' }]}>
                                {item.book_name} {item.chapter_start}
                                {item.chapter_end && item.chapter_end !== item.chapter_start ? `–${item.chapter_end}` : ''}
                            </Text>
                        </View>
                        <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                            {formattedDate}
                        </Text>
                    </View>

                    <HyperlinkedText
                        style={[styles.bookmarkTopic, { color: colors.textPrimary }]}
                        numberOfLines={3}
                        text={item.study_further || ''}
                    />

                    {item.study_further_reminder && new Date(item.study_further_reminder) > new Date() && (
                        <View style={[styles.reminderContainer, { backgroundColor: colors.backgroundSubtle + '40', borderColor: colors.border + '30' }]}>
                            <Ionicons name="notifications-outline" size={12} color={colors.textTertiary} />
                            <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
                                {new Date(item.study_further_reminder).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                })}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </ScalePressable>
    );
});

BookmarkCard.displayName = 'BookmarkCard';

export const StudyReminders: React.FC<StudyRemindersProps> = React.memo(({ onEntryPress, topics }) => {
    const { colors } = useTheme();
    const [internalTopics, setTopics] = useState<JournalEntry[]>([]);

    const loadTopics = useCallback(async () => {
        const data = await getRecentStudyTopics(7);
        setTopics(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (!topics) loadTopics();
        }, [loadTopics, topics])
    );

    const displayTopics = (topics || internalTopics).slice(0, 3);
    if (displayTopics.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeaderRow}>
                <Ionicons name="bookmark" size={14} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    TOPICS TO STUDY FURTHER
                </Text>
            </View>

            <View style={styles.listContainer}>
                {displayTopics.map((item, index) => (
                    <BookmarkCard
                        key={`study-${item.id}-${index}`}
                        item={item}
                        onEntryPress={onEntryPress}
                    />
                ))}
            </View>
        </View>
    );
});

StudyReminders.displayName = 'StudyReminders';

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginVertical: Spacing.sm,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: Spacing.md,
        paddingHorizontal: Spacing.xs,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        opacity: 0.7,

    },
    listContainer: {
        gap: Spacing.md,
    },
    bookmarkCard: {
        flexDirection: 'row',
        borderTopRightRadius: Spacing.borderRadius.md,
        borderBottomRightRadius: Spacing.borderRadius.md,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderWidth: 1,
        overflow: 'hidden',
    },
    accentLine: {
        width: 2.5,
        height: '100%',
    },
    bookmarkContent: {
        flex: 1,
        padding: Spacing.md,
        gap: 6,
    },
    bookmarkHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    refBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Spacing.borderRadius.sm,
    },
    refText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.5,
    },
    dateText: {
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.8,
    },
    bookmarkTopic: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
        letterSpacing: -0.2,
    },
    reminderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Spacing.borderRadius.sm,
        borderWidth: 1,
        alignSelf: 'flex-start',
        marginTop: 4,
        gap: 4,
    },
    reminderText: {
        fontSize: 10,
        fontWeight: Typography.weight.medium,
        opacity: 0.8,
    },
});
