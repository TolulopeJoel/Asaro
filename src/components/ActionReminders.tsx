import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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

    const router = useRouter();

    if (actions.length === 0) return null;

    const item = actions[0];

    const handlePress = () => {
        router.push({
            pathname: '/browse',
            params: { view: 'actions' }
        });
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
                    <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                        WHAT YOU SAID YOU'D DO
                    </Text>
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
                    <View style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}>
                        <Text style={[styles.refText, { color: colors.accent }]}>
                            {item.book_name} {item.chapter_start}{item.chapter_end && item.chapter_end !== item.chapter_start ? `-${item.chapter_end}` : ''}
                        </Text>
                    </View>
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
        marginBottom: 8,
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
