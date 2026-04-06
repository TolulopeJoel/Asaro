import React, { useCallback, useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import {
    EnhancedActionItem,
    JournalEntry,
    getEntryById,
    getPinnedActionItems,
    getActionItemsForWindow,
} from '../data/database';
export type { EnhancedActionItem };
import { ScalePressable } from './ScalePressable';
import { getItemsForSlots, SlotKey } from '../utils/actionRemindersRotation';

// ─── Window definitions ──────────────────────────────────────────────────────
const WINDOWS: { slot: SlotKey; newerDays: number; olderDays: number; label: string }[] = [
    { slot: 'thisWeek', newerDays: 0, olderDays: 7, label: 'THIS WEEK' },
    { slot: 'lastWeek', newerDays: 7, olderDays: 14, label: 'LAST WEEK' },
    { slot: 'monthAgo', newerDays: 21, olderDays: 35, label: 'A MONTH AGO' },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface ActionRemindersProps {
    onEntryPress: (entry: JournalEntry) => void;
    pinnedItems?: EnhancedActionItem[];
    rotatingItems?: EnhancedActionItem[];
}

export const fetchActionRemindersData = async (): Promise<{ pinned: EnhancedActionItem[], rotating: EnhancedActionItem[] }> => {
    const [pinnedArray, ...windowResults] = await Promise.all([
        getPinnedActionItems(),
        ...WINDOWS.map(w => getActionItemsForWindow(w.newerDays, w.olderDays)),
    ]);

    const pinned = pinnedArray as EnhancedActionItem[];
    const pinnedIds = new Set(pinned.map(p => p.id));
    const rotating: EnhancedActionItem[] = [];
    const selectedIds = new Set<number>();

    // Build slot requests (filter pools first)
    const slotRequests: { slot: SlotKey; availableIds: number[]; pool: EnhancedActionItem[] }[] = [];
    for (let i = 0; i < WINDOWS.length; i++) {
        const { slot } = WINDOWS[i];
        const pool = (windowResults[i] as EnhancedActionItem[])
            .filter(item => !pinnedIds.has(item.id) && !selectedIds.has(item.id!));
        if (pool.length === 0) continue;
        const ids = pool.map(it => it.id!).filter(Boolean);
        slotRequests.push({ slot, availableIds: ids, pool });
    }

    // Single batched AsyncStorage read/write for all slots
    const slotResults = await getItemsForSlots(
        slotRequests.map(r => ({ slot: r.slot, availableIds: r.availableIds }))
    );

    for (const { slot, pool } of slotRequests) {
        const selectedId = slotResults.get(slot) ?? null;
        if (selectedId !== null) {
            const selected = pool.find(it => it.id === selectedId);
            if (selected) {
                rotating.push(selected);
                selectedIds.add(selected.id!);
            }
        }
    }

    return { pinned, rotating };
};

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
                        <Ionicons
                            name="flash"
                            size={14}
                            color={colors.accent}
                        />
                        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                            {isTopStacked
                                ? "WHAT YOU SAID YOU'D DO"
                                : windowLabel ?? "WHAT YOU SAID YOU'D DO"
                            }
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                            {formattedDate}
                        </Text>
                        {isPinned && (
                            <Svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill={colors.accent}
                                stroke={colors.accent}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ transform: [{ rotate: '30deg' }], marginLeft: 4 }}
                            >
                                <Path d="M12 17v5" />
                                <Path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                            </Svg>
                        )}
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

export const ActionReminders: React.FC<ActionRemindersProps> = React.memo(({ onEntryPress, pinnedItems: pinnedProp, rotatingItems: rotatingProp }) => {
    const { colors } = useTheme();
    const [pinnedItemsState, setPinnedItems] = useState<EnhancedActionItem[]>([]);
    const [rotatingItemsState, setRotatingItems] = useState<EnhancedActionItem[]>([]);
    const pinnedItems = pinnedProp || pinnedItemsState;
    const rotatingItems = rotatingProp || rotatingItemsState;
    const [isExpanded, setIsExpanded] = useState(false);
    const [topCardHeight, setTopCardHeight] = useState(200);

    const loadItems = useCallback(async () => {
        const { pinned, rotating } = await fetchActionRemindersData();
        setPinnedItems(pinned);
        setRotatingItems(rotating);
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (!pinnedProp && !rotatingProp) loadItems();
        }, [loadItems, pinnedProp, rotatingProp])
    );

    // Consolidate items for map rendering
    const allItems = useMemo(() => {
        const items: { item: EnhancedActionItem; isPinned: boolean; windowLabel: string }[] = [];

        pinnedItems.forEach(item => {
            items.push({ item, isPinned: true, windowLabel: 'PINNED REMINDER' });
        });

        rotatingItems.forEach(item => {
            const entryDate = new Date(item.created_at);
            const daysAgo = Math.floor((Date.now() - entryDate.getTime()) / 86_400_000);
            const windowLabel = WINDOWS.find(w => daysAgo >= w.newerDays && daysAgo <= w.olderDays)?.label ?? "WHAT YOU SAID YOU'D DO";
            items.push({ item, isPinned: false, windowLabel });
        });

        // Force the title to "WHAT YOU SAID YOU'D DO" if there is only one item and it is not pinned
        if (items.length === 1 && !items[0].isPinned) {
            items[0].windowLabel = "WHAT YOU SAID YOU'D DO";
        }

        return items;
    }, [pinnedItems, rotatingItems]);

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
