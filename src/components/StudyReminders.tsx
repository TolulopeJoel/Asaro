import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { getRecentStudyTopics, JournalEntry } from '../data/database';
import { ScalePressable } from './ScalePressable';

interface StudyRemindersProps {
    onEntryPress: (entry: JournalEntry) => void;
    topics?: JournalEntry[];
}

interface StudyCardProps {
    item: JournalEntry;
    isTopStacked?: boolean;
    stackedHeight?: number;
    totalCards: number;
    onEntryPress: (entry: JournalEntry) => void;
}

const StudyCard = React.memo(({
    item,
    isTopStacked,
    stackedHeight,
    totalCards,
    onEntryPress
}: StudyCardProps) => {
    const { colors } = useTheme();

    const getDynamicStyle = (text: string) => {
        const length = text.length;
        if (length < 60) return { fontSize: 22, lineHeight: 28, padding: 24 };
        if (length < 120) return { fontSize: 18, lineHeight: 24, padding: 20 };
        return { fontSize: 15, lineHeight: 20, padding: 16 };
    };

    const dynamic = getDynamicStyle(item.study_further || '');

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
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.cardBorder,
                        padding: dynamic.padding,
                        borderWidth: 1,
                    },
                    stackedHeight !== undefined && {
                        height: stackedHeight,
                        overflow: 'hidden',
                    },
                ]}
            >
                {/* ── Header row ── */}
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <Ionicons name="bookmark" size={14} color={colors.accentSecondary} />
                        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                            TOPIC{totalCards > 1 ? 'S' : ''} TO STUDY FURTHER
                        </Text>
                        {totalCards > 1 && isTopStacked && (
                            <View style={[styles.pillBadge, { backgroundColor: colors.accentSecondary + '20' }]}>
                                <Text style={[styles.pillText, { color: colors.accentSecondary }]}>
                                    1 OF {totalCards}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                        {formattedDate}
                    </Text>
                </View>

                {/* ── Scripture badge ── */}
                <View style={styles.cardHeader}>
                    <View style={[styles.refBadge, { backgroundColor: colors.accentSecondary + '15' }]}>
                        <Text style={[styles.refText, { color: colors.accentSecondary }]}>
                            {item.book_name} {item.chapter_start}
                            {item.chapter_end && item.chapter_end !== item.chapter_start ? `–${item.chapter_end}` : ''}
                        </Text>
                    </View>
                </View>

                {/* ── Topic text ── */}
                <Text
                    style={[
                        styles.topicText,
                        {
                            color: colors.textPrimary,
                            fontSize: dynamic.fontSize,
                            lineHeight: dynamic.lineHeight
                        }
                    ]}
                    numberOfLines={stackedHeight !== undefined ? 2 : undefined}
                >
                    {item.study_further}
                </Text>

                {/* ── Notes ── */}
                {item.notes ? (
                    <View style={[styles.notesContainer, { borderTopColor: colors.border + '20' }]}>
                        <Text
                            style={[
                                styles.notesText,
                                {
                                    color: colors.textSecondary,
                                    fontSize: Math.max(13, dynamic.fontSize - 10)
                                }
                            ]}
                            numberOfLines={stackedHeight !== undefined ? 2 : undefined}
                        >
                            {item.notes}
                        </Text>
                    </View>
                ) : null}

                {/* ── Reminder ── */}
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

StudyCard.displayName = 'StudyCard';

export const StudyReminders: React.FC<StudyRemindersProps> = React.memo(({ onEntryPress, topics }) => {
    const { colors } = useTheme();
    const [internalTopics, setTopics] = useState<JournalEntry[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [topCardHeight, setTopCardHeight] = useState(200);

    const loadTopics = useCallback(async () => {
        const data = await getRecentStudyTopics(7); // Show topics from last 7 days
        setTopics(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (!topics) loadTopics();
        }, [loadTopics, topics])
    );

    const PEEK_OFFSET = 14;
    const SCALE_STEP = 0.03;
    const OPACITY_STEP = 0.18;

    const displayTopics = (topics || internalTopics).slice(0, 3);
    const totalCards = displayTopics.length;

    if (displayTopics.length === 0) return null;

    const toggleDeck = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(prev => !prev);
    };

    return (
        <View style={styles.container}>
            <View
                style={[
                    styles.stackWrapper,
                    !isExpanded && {
                        height: topCardHeight + (Math.min(totalCards, 3) - 1) * PEEK_OFFSET,
                    },
                ]}
            >
                {displayTopics.map((item, index) => {
                    const isStacked = !isExpanded && index > 0;
                    const clampedIndex = Math.min(index, 2);

                    return (
                        <View
                            key={`study-${item.id}-${index}`}
                            onLayout={index === 0 ? (e) => setTopCardHeight(e.nativeEvent.layout.height) : undefined}
                            style={[
                                styles.cardWrapper,
                                { zIndex: totalCards - index },
                                isStacked
                                    ? {
                                        position: 'absolute',
                                        top: clampedIndex * PEEK_OFFSET,
                                        left: clampedIndex * 4,
                                        right: clampedIndex * 4,
                                        transform: [{ scale: 1 - clampedIndex * SCALE_STEP }],
                                        opacity: 1 - clampedIndex * OPACITY_STEP,
                                        height: topCardHeight,
                                        overflow: 'hidden',
                                        borderRadius: Spacing.borderRadius.md,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: 0.12,
                                        shadowRadius: 16,
                                        elevation: totalCards - index,
                                    }
                                    : {
                                        marginBottom: index < totalCards - 1 ? Spacing.md : 0,
                                        ...(!isExpanded && totalCards > 1 && index === 0 && {
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 6 },
                                            shadowOpacity: 0.12,
                                            shadowRadius: 16,
                                            elevation: totalCards,
                                        }),
                                    },
                            ]}
                        >
                            <StudyCard
                                item={item}
                                isTopStacked={!isExpanded && index === 0 && totalCards > 1}
                                stackedHeight={isStacked ? topCardHeight : undefined}
                                totalCards={totalCards}
                                onEntryPress={index === 0 || isExpanded ? onEntryPress : () => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setIsExpanded(true);
                                }}
                            />
                        </View>
                    );
                })}
            </View>

            {/* Toggle — always below the stack, never overlapping */}
            {totalCards > 1 && (
                <TouchableOpacity
                    style={styles.expandButton}
                    onPress={toggleDeck}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.expandText, { color: colors.textSecondary }]}>
                        {isExpanded ? 'Collapse' : `${totalCards} topics`}
                    </Text>
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.textSecondary}
                    />
                </TouchableOpacity>
            )}
        </View>
    );
});

StudyReminders.displayName = 'StudyReminders';

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    stackWrapper: {
        width: '100%',
        position: 'relative',
    },
    cardWrapper: {
        width: '100%',
    },
    card: {
        minHeight: 160,
        width: '100%',
        borderRadius: Spacing.borderRadius.md,
        gap: Spacing.sm,
        overflow: 'hidden',
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
        flex: 1,
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
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 28,
        letterSpacing: -0.3,
        marginTop: 4,
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
    notesContainer: {
        marginTop: Spacing.xs,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        gap: 2,
    },
    notesText: {
        lineHeight: 18,
        fontStyle: 'italic',
        opacity: 0.8,
    },
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.md,
        gap: 6,
        paddingVertical: Spacing.xs,
    },
    expandText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
