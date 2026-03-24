import React, { useCallback, useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import {
    EnhancedActionItem,
    JournalEntry,
    getEntryById,
    getPinnedActionItem,
    getActionItemsForWindow,
} from '../data/database';
import { ScalePressable } from './ScalePressable';
import { getItemForSlot, SlotKey } from '../utils/actionRemindersRotation';

// ─── Window definitions ──────────────────────────────────────────────────────
const WINDOWS: { slot: SlotKey; newerDays: number; olderDays: number; label: string }[] = [
    { slot: 'thisWeek', newerDays: 0, olderDays: 7, label: 'THIS WEEK' },
    { slot: 'lastWeek', newerDays: 7, olderDays: 14, label: 'LAST WEEK' },
    { slot: 'monthAgo', newerDays: 21, olderDays: 35, label: 'A MONTH AGO' },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface ActionRemindersProps {
    onEntryPress: (entry: JournalEntry) => void;
}

// ─── Single card ─────────────────────────────────────────────────────────────
interface ActionCardProps {
    item: EnhancedActionItem;
    isPinned: boolean;
    windowLabel?: string;
    stackedHeight?: number;
    isTopStacked?: boolean;
    onEntryPress: (entry: JournalEntry) => void;
}

const ActionCard = React.memo(({
    item,
    isPinned,
    windowLabel,
    stackedHeight,
    isTopStacked,
    onEntryPress,
}: ActionCardProps) => {
    const { colors } = useTheme();

    const handlePress = async () => {
        try {
            const entry = await getEntryById(item.entry_id!);
            if (entry) onEntryPress(entry);
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

    const formattedDate = (() => {
        const date = new Date(item.created_at);
        const now = new Date();
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
        });
    })();

    return (
        <ScalePressable onPress={handlePress}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: isPinned ? colors.accent : colors.cardBorder,
                        padding: dynamic.padding,
                        borderWidth: isPinned ? 1.5 : 1,
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
                        <Ionicons
                            name="flash"
                            size={14}
                            color={colors.accent}
                        />
                        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                            {isPinned
                                ? 'PINNED REMINDER'
                                : (isTopStacked ? "WHAT YOU SAID YOU'D DO" : windowLabel) ?? "WHAT YOU SAID YOU'D DO"
                            }
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                            {formattedDate}
                        </Text>
                    </View>
                </View>

                {/* ── Scripture badge ── */}
                <View style={styles.cardHeader}>
                    <View style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}>
                        <Text style={[styles.refText, { color: colors.accent }]}>
                            {item.book_name}{' '}
                            {item.chapter_start}
                            {item.chapter_end && item.chapter_end !== item.chapter_start
                                ? `–${item.chapter_end}`
                                : ''}
                        </Text>
                    </View>
                </View>

                {/* ── Action text ── */}
                <Text
                    style={[
                        styles.actionText,
                        {
                            color: colors.textPrimary,
                            fontSize: dynamic.fontSize,
                            lineHeight: dynamic.lineHeight,
                        },
                    ]}
                >
                    {item.action}
                </Text>

                {/* ── Motivation ── */}
                {item.motivation ? (
                    <View style={[styles.motivationContainer, { borderTopColor: colors.border + '30' }]}>
                        <Text
                            style={[
                                styles.motivationText,
                                {
                                    color: colors.textSecondary,
                                    fontSize: Math.max(13, dynamic.fontSize - 3),
                                },
                            ]}
                        >
                            {item.motivation}
                        </Text>
                    </View>
                ) : null}
            </View>
        </ScalePressable>
    );
});

ActionCard.displayName = 'ActionCard';

export const ActionReminders: React.FC<ActionRemindersProps> = React.memo(({ onEntryPress }) => {
    const { colors } = useTheme();
    const [pinnedItem, setPinnedItem] = useState<EnhancedActionItem | null>(null);
    const [rotatingItems, setRotatingItems] = useState<EnhancedActionItem[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [topCardHeight, setTopCardHeight] = useState(200);

    const loadItems = useCallback(async () => {
        const [pinned, ...windowResults] = await Promise.all([
            getPinnedActionItem(),
            ...WINDOWS.map(w => getActionItemsForWindow(w.newerDays, w.olderDays)),
        ]);

        setPinnedItem(pinned as EnhancedActionItem | null);

        const pinnedId = (pinned as EnhancedActionItem | null)?.id;
        const rotating: EnhancedActionItem[] = [];

        for (let i = 0; i < WINDOWS.length; i++) {
            const { slot } = WINDOWS[i];
            const pool = (windowResults[i] as EnhancedActionItem[])
                .filter(item => item.id !== pinnedId);

            if (pool.length === 0) continue;

            const ids = pool.map(it => it.id!).filter(Boolean);
            const selectedId = await getItemForSlot(slot, ids);
            if (selectedId !== null) {
                const selected = pool.find(it => it.id === selectedId);
                if (selected) rotating.push(selected);
            }
        }

        setRotatingItems(rotating);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadItems();
        }, [loadItems])
    );

    // Consolidate items for map rendering
    const allItems = useMemo(() => {
        const items: { item: EnhancedActionItem; isPinned: boolean; windowLabel: string }[] = [];

        if (pinnedItem) {
            items.push({ item: pinnedItem, isPinned: true, windowLabel: 'PINNED REMINDER' });
        }

        rotatingItems.forEach(item => {
            const entryDate = new Date(item.created_at);
            const daysAgo = Math.floor((Date.now() - entryDate.getTime()) / 86_400_000);
            const windowLabel = WINDOWS.find(w => daysAgo >= w.newerDays && daysAgo <= w.olderDays)?.label ?? "WHAT YOU SAID YOU'D DO";
            items.push({ item, isPinned: false, windowLabel });
        });

        return items;
    }, [pinnedItem, rotatingItems]);

    const PEEK_OFFSET = 14;
    const SCALE_STEP = 0.03;
    const OPACITY_STEP = 0.18;


    if (allItems.length === 0) return null;

    const totalCards = allItems.length;

    const toggleDeck = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(prev => !prev);
    };
    // Replace the return block in ActionReminders:

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
                {allItems.map(({ item, isPinned, windowLabel }, index) => {
                    const isStacked = !isExpanded && index > 0;
                    const clampedIndex = Math.min(index, 2);

                    return (
                        <View
                            key={`${isPinned ? 'pinned' : 'rotating'}-${item.id}-${index}`}
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
                            <ActionCard
                                item={item}
                                isPinned={isPinned}
                                windowLabel={windowLabel}
                                stackedHeight={isStacked ? topCardHeight : undefined}
                                isTopStacked={!isExpanded && index === 0 && totalCards > 1}
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
                        {isExpanded ? 'Collapse' : `${totalCards} reminders`}
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

ActionReminders.displayName = 'ActionReminders';

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
        minHeight: 160,           // ← was height: 200
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
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
