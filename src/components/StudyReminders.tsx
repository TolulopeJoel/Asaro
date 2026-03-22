import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeOut, Layout, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { getRecentStudyTopics, JournalEntry, toggleStudyTopicCompletion } from '../data/database';
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

    if (topics.length === 0) return null;

    const handlePress = (item: JournalEntry) => {
        onEntryPress(item);
    };

    const getDynamicStyle = (text: string) => {
        const length = text.length;
        if (length < 60) return { fontSize: 22, lineHeight: 28, padding: 24 };
        if (length < 120) return { fontSize: 18, lineHeight: 24, padding: 20 };
        return { fontSize: 15, lineHeight: 20, padding: 16 };
    };

    const renderCard = (item: JournalEntry, index: number) => {
        const dynamic = getDynamicStyle(item.study_further || '');
        const isTop = index === 0;

        return (
            <Animated.View
                key={item.id}
                entering={FadeInDown.delay(index * 100)}
                exiting={FadeOut}
                layout={Layout.springify()}
                style={[
                    styles.cardWrapper,
                    {
                        zIndex: 10 - index,
                        marginTop: index === 0 ? 0 : -styles.card.height + (index * 12),
                        transform: [{ scale: 1 - (index * 0.04) }],
                        opacity: 1 - (index * 0.25),
                    }
                ]}
            >
                <ScalePressable onPress={() => handlePress(item)} disabled={!isTop}>
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
                                    TOPIC{topics.length > 1 ? 'S' : ''} TO STUDY FURTHER
                                </Text>
                                {topics.length > 1 && isTop && (
                                    <View style={[styles.pillBadge, { backgroundColor: colors.accentSecondary + '20' }]}>
                                        <Text style={[styles.pillText, { color: colors.accentSecondary }]}>
                                            1 OF {topics.length}
                                        </Text>
                                    </View>
                                )}
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

                        <Text style={[styles.topicText, { color: colors.textPrimary, fontSize: dynamic.fontSize, lineHeight: dynamic.lineHeight }]} numberOfLines={isTop ? undefined : 2}>
                            {item.study_further}
                        </Text>

                        {item.study_further_reminder && new Date(item.study_further_reminder) > new Date() && isTop ? (
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
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.stackContainer}>
                {topics.slice(0, 3).map((item, index) => renderCard(item, index))}
            </View>
        </View>
    );
});

StudyReminders.displayName = 'StudyReminders';

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    stackContainer: {
        width: '100%',
        // height: 220, // Adjusted for 180 height card + 40px offsets
        justifyContent: 'flex-start',
    },
    cardWrapper: {
        width: '100%',
        position: 'relative',
    },
    card: {
        height: 200,
        width: '100%',
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        gap: Spacing.sm,
        justifyContent: 'center',
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
    pillBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 4,
    },
    pillText: {
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5,
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
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    reminderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Spacing.borderRadius.round,
        borderWidth: 1,
        alignSelf: 'flex-start',
        marginTop: 6,
        gap: 4,
    },
    reminderText: {
        fontSize: 9,
        fontWeight: Typography.weight.medium,
    },
});
