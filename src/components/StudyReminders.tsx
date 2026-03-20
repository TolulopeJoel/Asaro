import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { getRecentStudyTopics, JournalEntry } from '../data/database';
import { ScalePressable } from './ScalePressable';

interface StudyRemindersProps {
    onEntryPress: (entry: JournalEntry) => void;
}

export const StudyReminders: React.FC<StudyRemindersProps> = React.memo(({ onEntryPress }) => {
    const { colors } = useTheme();
    const [topics, setTopics] = useState<JournalEntry[]>([]);

    const loadTopics = useCallback(async () => {
        const data = await getRecentStudyTopics(7); // Show topics from last 7 days
        setTopics(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadTopics();
        }, [loadTopics])
    );

    if (topics.length === 0) return null;

    const item = topics[0];

    const handlePress = () => {
        onEntryPress(item);
    };

    return (
        <ScalePressable onPress={handlePress}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.cardBorder
                    }
                ]}
            >
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Ionicons name="bookmark-outline" size={14} color={colors.accentSecondary} />
                        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                            TOPIC TO STUDY FURTHER
                        </Text>
                    </View>
                    <Text style={[styles.dateText, { color: colors.textTertiary, marginLeft: 'auto' }]}>
                        {(() => {
                            const date = new Date(item.created_at);
                            const now = new Date();
                            return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' })
                            });
                        })()}
                    </Text>
                </View>

                <View style={styles.cardHeader}>
                    <View style={[styles.refBadge, { backgroundColor: colors.accentSecondary + '15' }]}>
                        <Text style={[styles.refText, { color: colors.accentSecondary }]}>
                            {item.book_name} {item.chapter_start}{item.chapter_end && item.chapter_end !== item.chapter_start ? `-${item.chapter_end}` : ''}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.topicText, { color: colors.textPrimary }]}>
                    {item.study_further}
                </Text>

                {item.study_further_reminder && new Date(item.study_further_reminder) > new Date() ? (
                    <View style={[styles.reminderContainer, { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }]}>
                        <Ionicons name="notifications-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
                            Reminder: {new Date(item.study_further_reminder).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </Text>
                    </View>
                ) : null}
            </View>
        </ScalePressable>
    );
});

StudyReminders.displayName = 'StudyReminders';

const styles = StyleSheet.create({
    card: {
        width: '100%',
        borderRadius: Spacing.borderRadius.md,
        padding: Spacing.layout.cardPadding,
        borderWidth: 1,
        gap: Spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: Typography.letterSpacing.wider,
    },
    dateText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
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
    topicText: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        lineHeight: Typography.lineHeight.lg,
        letterSpacing: 0.2,
    },
    reminderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: Spacing.borderRadius.round,
        borderWidth: 1,
        alignSelf: 'flex-start',
        marginTop: Spacing.xs,
        gap: Spacing.xs,
    },
    reminderText: {
        fontSize: Typography.size.xs + 1,
        fontWeight: Typography.weight.medium,
    },
});
