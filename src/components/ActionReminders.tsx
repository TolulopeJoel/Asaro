import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { getRecentActionItems, EnhancedActionItem, JournalEntry, getEntryById } from '../data/database';
import { ScalePressable } from './ScalePressable';

interface ActionRemindersProps {
    onEntryPress: (entry: JournalEntry) => void;
}

export const ActionReminders: React.FC<ActionRemindersProps> = React.memo(({ onEntryPress }) => {
    const { colors } = useTheme();
    const [actions, setActions] = useState<EnhancedActionItem[]>([]);

    const loadActions = useCallback(async () => {
        const data = await getRecentActionItems(7); // Show actions from last 7 days
        setActions(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadActions();
        }, [loadActions])
    );

    if (actions.length === 0) return null;

    const item = actions[0];

    const handlePress = async () => {
        try {
            const entry = await getEntryById(item.entry_id!);
            if (entry) {
                onEntryPress(entry);
            }
        } catch (error) {
            console.error('Error loading entry:', error);
        }
    };

    const getDynamicStyle = (text: string) => {
        const length = text.length;
        if (length < 60) return { fontSize: 22, lineHeight: 28, padding: 24 };
        if (length < 120) return { fontSize: 18, lineHeight: 24, padding: 20 };
        return { fontSize: 15, lineHeight: 20, padding: 16 };
    };

    const dynamic = getDynamicStyle(item.action);

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
                        <Ionicons name="flash" size={14} color={colors.accent} />
                        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                            WHAT YOU SAID YOU'D DO
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
                    <View style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}>
                        <Text style={[styles.refText, { color: colors.accent }]}>
                            {item.book_name} {item.chapter_start}{item.chapter_end && item.chapter_end !== item.chapter_start ? `-${item.chapter_end}` : ''}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.actionText, { color: colors.textPrimary, fontSize: dynamic.fontSize, lineHeight: dynamic.lineHeight }]}>
                    {item.action}
                </Text>

                {item.motivation ? (
                    <View style={[styles.motivationContainer, { borderTopColor: colors.border + '30' }]}>
                        <Text style={[styles.motivationText, { color: colors.textSecondary, fontSize: Math.max(13, dynamic.fontSize - 3) }]}>
                            {item.motivation}
                        </Text>
                    </View>
                ) : null}
            </View>
        </ScalePressable>
    );
});


ActionReminders.displayName = 'ActionReminders';

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
    actionText: {
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 28,
        letterSpacing: -0.3,
        marginTop: 4,
    },
    motivationContainer: {
        marginTop: Spacing.xs,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        gap: 2,
    },
    motivationText: {
        fontSize: Typography.size.md,
        lineHeight: Typography.lineHeight.md,
        fontStyle: 'italic',
    },
});
