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

    const getDynamicStyle = (text: string) => {
        const length = text.length;
        if (length < 60) return { fontSize: 22, lineHeight: 28, padding: 24 };
        if (length < 120) return { fontSize: 18, lineHeight: 24, padding: 20 };
        return { fontSize: 15, lineHeight: 20, padding: 16 };
    };

    const dynamic = getDynamicStyle(item.study_further || '');

    return (
        <ScalePressable onPress={handlePress}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.cardBorder,
                        padding: dynamic.padding
                    }
                ]}
            >
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <Ionicons name="bookmark" size={14} color={colors.accentSecondary} />
                        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                            TOPIC TO STUDY FURTHER
                        </Text>
                    </View>
                    <Text style={[styles.dateText, { color: colors.textTertiary }]}>
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

                <Text style={[styles.topicText, { color: colors.textPrimary, fontSize: dynamic.fontSize, lineHeight: dynamic.lineHeight }]}>
                    {item.study_further}
                </Text>

                {item.study_further_reminder && new Date(item.study_further_reminder) > new Date() ? (
                    <View style={[styles.reminderContainer, { backgroundColor: colors.backgroundSubtle + '40', borderColor: colors.border + '30' }]}>
                        <Ionicons name="notifications-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.reminderText, { color: colors.textSecondary, opacity: 0.8 }]}>
                            {new Date(item.study_further_reminder).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                            })}
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
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        opacity: 0.7,
    },
    dateText: {
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.8,
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
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 28,
        letterSpacing: -0.3,
        marginTop: 4,
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
