import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { getRecentActionItems, EnhancedActionItem } from '../data/database';
import { ScalePressable } from './ScalePressable';

export const ActionReminders: React.FC = React.memo(() => {
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                    WHAT YOU SAID YOU'D DO
                </Text>
            </View>

            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.cardBorder
                    }
                ]}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}>
                        <Text style={[styles.refText, { color: colors.accent }]}>
                            {item.book_name} {item.chapter_start}{item.chapter_end && item.chapter_end !== item.chapter_start ? `-${item.chapter_end}` : ''}
                        </Text>
                    </View>
                    <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                </View>

                <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                    {item.action}
                </Text>

                {item.motivation ? (
                    <View style={[styles.motivationContainer, { borderTopColor: colors.border + '50' }]}>
                        <Text style={[styles.motivationLabel, { color: colors.textTertiary }]}>
                            MOTIVATION
                        </Text>
                        <Text style={[styles.motivationText, { color: colors.textSecondary }]}>
                            {item.motivation}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
});


ActionReminders.displayName = 'ActionReminders';

const styles = StyleSheet.create({
    container: {
        width: '100%',
        gap: Spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.xs,
    },
    headerTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: Typography.letterSpacing.wider,
    },

    card: {
        borderRadius: Spacing.borderRadius.md,
        padding: Spacing.layout.cardPadding,
        borderWidth: 1,
        gap: Spacing.sm,
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
    dateText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
    },
    actionText: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        lineHeight: Typography.lineHeight.lg,
        letterSpacing: 0.2,
    },
    motivationContainer: {
        marginTop: Spacing.xs,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        gap: 2,
    },
    motivationLabel: {
        fontSize: Typography.size.xs - 1,
        fontWeight: Typography.weight.bold,
        letterSpacing: 1,
    },
    motivationText: {
        fontSize: Typography.size.md,
        lineHeight: Typography.lineHeight.md,
        fontStyle: 'italic',
    },
});
