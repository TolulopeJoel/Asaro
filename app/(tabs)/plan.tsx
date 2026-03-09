// app/(tabs)/plan.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { READING_PLAN_DATA, ReadingItem } from '@/src/data/readingPlanData';
import { getReadingProgress, toggleReadingItem, checkEntryExists } from '@/src/data/database';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Alert } from 'react-native';

const SectionHeader = ({
    title,
    isCollapsed,
    onToggle,
    completedCount,
    totalCount
}: {
    title: string;
    isCollapsed: boolean;
    onToggle: () => void;
    completedCount: number;
    totalCount: number;
}) => {
    const { colors } = useTheme();
    const isDone = completedCount === totalCount && totalCount > 0;

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onToggle}
            style={[
                styles.sectionHeader,
                { borderBottomColor: isDone ? colors.textTertiary : colors.accent, opacity: isDone ? 0.6 : 1 }
            ]}
        >
            <View style={styles.sectionTitleContainer}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title.toUpperCase()}</Text>
                <Text style={[styles.sectionProgress, { color: colors.textSecondary }]}>
                    {completedCount}/{totalCount}
                </Text>
            </View>
            <Ionicons
                name={isCollapsed ? "chevron-forward" : "chevron-down"}
                size={16}
                color={colors.textSecondary}
            />
        </TouchableOpacity>
    );
};

const ReadingCard = ({
    item,
    isCompleted,
    onToggle
}: {
    item: ReadingItem;
    isCompleted: boolean;
    onToggle: (id: number, completed: boolean) => void
}) => {
    const { colors } = useTheme();

    return (
        <ScalePressable
            style={[
                styles.card,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: isCompleted ? colors.accent : colors.cardBorder,
                    opacity: isCompleted ? 0.7 : 1
                }
            ]}
            onPress={() => onToggle(item.id, !isCompleted)}
        >
            <View style={styles.cardContent}>
                <View style={styles.bookInfo}>
                    <View style={styles.bookHeader}>
                        {item.isKey && (
                            <Ionicons
                                name="sparkles"
                                size={14}
                                color={colors.accent}
                                style={{ marginRight: 4 }}
                            />
                        )}
                        <Text style={[styles.bookName, { color: colors.textPrimary }]}>{item.book}</Text>
                    </View>
                    <Text style={[styles.chapters, { color: colors.textSecondary }]}>{item.chapters || "Full Book"}</Text>
                </View>

                <View style={[
                    styles.checkbox,
                    {
                        backgroundColor: isCompleted ? colors.accent : 'transparent',
                        borderColor: isCompleted ? colors.accent : colors.textTertiary
                    }
                ]}>
                    {isCompleted && <Ionicons name="checkmark" size={16} color={colors.background} />}
                </View>
            </View>
        </ScalePressable>
    );
};

export default function PlanScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { scrollToId } = useLocalSearchParams<{ scrollToId?: string }>();
    const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState(0);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const flatListRef = React.useRef<FlatList>(null);

    // Group items by section for easier progress calculation
    const sectionData = React.useMemo(() => {
        const counts: Record<string, { completed: number; total: number }> = {};
        READING_PLAN_DATA.forEach(item => {
            if (!counts[item.section]) counts[item.section] = { completed: 0, total: 0 };
            counts[item.section].total++;
            if (completedItems.has(item.id)) counts[item.section].completed++;
        });
        return counts;
    }, [completedItems]);

    const loadProgress = useCallback(async () => {
        const progressIds = await getReadingProgress();
        const completedSet = new Set(progressIds);
        setCompletedItems(completedSet);
        setProgress(Math.round((progressIds.length / READING_PLAN_DATA.length) * 100));

        // Focus Mode logic: find the first uncompleted item and expand its section
        // OR if we have a scrollToId, focus that item
        if (isInitialLoad || scrollToId) {
            const idToFocus = scrollToId ? Number(scrollToId) : null;
            const targetItem = idToFocus
                ? READING_PLAN_DATA.find(item => item.id === idToFocus)
                : READING_PLAN_DATA.find(item => !completedSet.has(item.id));

            if (targetItem) {
                const allSections = Array.from(new Set(READING_PLAN_DATA.map(i => i.section)));
                const collapsed = new Set(allSections.filter(s => s !== targetItem.section));
                setCollapsedSections(collapsed);

                // If specific id requested, scroll to it
                if (idToFocus) {
                    const index = READING_PLAN_DATA.findIndex(item => item.id === idToFocus);
                    if (index !== -1) {
                        // Small delay to ensure state updates and render
                        setTimeout(() => {
                            flatListRef.current?.scrollToIndex({
                                index,
                                animated: true,
                                viewPosition: 0.3 // Center it a bit
                            });
                        }, 100);
                    }
                }
            }
            setIsInitialLoad(false);
        }
    }, [isInitialLoad, scrollToId]);

    useEffect(() => {
        if (scrollToId) {
            loadProgress();
            // Clear param to avoid re-triggering
            router.setParams({ scrollToId: undefined });
        }
    }, [scrollToId, loadProgress, router]);

    useFocusEffect(
        useCallback(() => {
            loadProgress();
        }, [loadProgress])
    );

    const handleToggle = async (id: number, completed: boolean) => {
        if (completed) {
            // If they are trying to mark it as completed, check if entry exists
            const item = READING_PLAN_DATA.find(i => i.id === id);
            if (!item) return;

            const [startStr, endStr] = item.chapters.split('-').map(s => s.trim());
            const start = Number(startStr);
            const end = endStr ? Number(endStr) : start;

            const existingEntryId = await checkEntryExists(item.book, start, end === start ? undefined : end);

            if (existingEntryId) {
                // If entry exists, just tick it immediately for a smoother experience
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                setProgress(Math.round((newCompleted.size / READING_PLAN_DATA.length) * 100));
            } else {
                router.push({
                    pathname: '/addEntry',
                    params: {
                        readingItemId: id,
                        bookName: item.book,
                        chapters: item.chapters
                    }
                });
            }
        } else {
            // If they are trying to UN-mark it, we allow it (delete from progress table)
            Alert.alert(
                'Remove Progress?',
                'This will only uncheck. Your entry will remain.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                            await toggleReadingItem(id, false);
                            const newCompleted = new Set(completedItems);
                            newCompleted.delete(id);
                            setCompletedItems(newCompleted);
                            setProgress(Math.round((newCompleted.size / READING_PLAN_DATA.length) * 100));
                        }
                    }
                ]
            );
        }
    };

    const toggleSection = (section: string) => {
        const newCollapsed = new Set(collapsedSections);
        if (newCollapsed.has(section)) {
            newCollapsed.delete(section);
        } else {
            newCollapsed.add(section);
        }
        setCollapsedSections(newCollapsed);
    };

    const renderItem = ({ item, index }: { item: ReadingItem; index: number }) => {
        const showHeader = index === 0 || READING_PLAN_DATA[index - 1].section !== item.section;
        const isCollapsed = collapsedSections.has(item.section);
        const sectionStats = sectionData[item.section] || { completed: 0, total: 0 };

        return (
            <View>
                {showHeader && (
                    <SectionHeader
                        title={item.section}
                        isCollapsed={isCollapsed}
                        onToggle={() => toggleSection(item.section)}
                        completedCount={sectionStats.completed}
                        totalCount={sectionStats.total}
                    />
                )}
                {!isCollapsed && (
                    <ReadingCard
                        item={item}
                        isCompleted={completedItems.has(item.id)}
                        onToggle={handleToggle}
                    />
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Bible Reading Plan</Text>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBarBase, { backgroundColor: colors.cardBackground }]}>
                        <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
                    </View>
                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>{progress}% Complete</Text>
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={READING_PLAN_DATA}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                onScrollToIndexFailed={(info) => {
                    // Fallback scroll if index fails due to item not being measured
                    flatListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: true,
                    });
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: Typography.size.xxl,
        fontWeight: Typography.weight.bold,
        marginBottom: Spacing.md,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    progressBarBase: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressText: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        minWidth: 80,
    },
    listContent: {
        padding: Spacing.layout.screenPadding,
        paddingTop: 0,
        paddingBottom: 100,
    },
    sectionHeader: {
        marginTop: Spacing.xl,
        marginBottom: Spacing.md,
        borderBottomWidth: 2,
        paddingBottom: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.sm,
    },
    sectionTitle: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.bold,
        letterSpacing: 1.5,
    },
    sectionProgress: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
        opacity: 0.7,
    },
    card: {
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        marginBottom: Spacing.sm,
        padding: Spacing.layout.cardPadding,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bookInfo: {
        flex: 1,
    },
    bookHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bookName: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
    },
    chapters: {
        fontSize: Typography.size.md,
        marginTop: 2,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
