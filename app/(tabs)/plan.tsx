// app/(tabs)/plan.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { READING_PLAN_DATA, ReadingItem } from '@/src/data/readingPlanData';
import { getReadingProgress, toggleReadingItem, checkEntryCoversChapters } from '@/src/data/database';
import { useFocusEffect, useRouter } from 'expo-router';
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
    const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState(0);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [isInitialLoad, setIsInitialLoad] = useState(true);

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

        // Smart Focus: on initial load, expand only the section with the next uncompleted item
        if (isInitialLoad) {
            const nextItem = READING_PLAN_DATA.find(item => !completedSet.has(item.id));
            if (nextItem) {
                const allSections = Array.from(new Set(READING_PLAN_DATA.map(i => i.section)));
                const collapsed = new Set(allSections.filter(s => s !== nextItem.section));
                setCollapsedSections(collapsed);
            }
            setIsInitialLoad(false);
        }
    }, [isInitialLoad]);

    useFocusEffect(
        useCallback(() => {
            loadProgress();
        }, [loadProgress])
    );

    const handleToggle = async (id: number, completed: boolean) => {
        if (completed) {
            const item = READING_PLAN_DATA.find(i => i.id === id);
            if (!item) return;

            // Parse the plan item's chapter range, stripping verse notation (e.g. "119:64-176")
            const parts = item.chapters.split('-');
            const planStart = parseInt(parts[0].split(':')[0], 10);
            const planEnd = parts.length > 1
                ? parseInt(parts[parts.length - 1].split(':')[0], 10)
                : planStart;

            if (isNaN(planStart)) {
                // Can't determine chapters (e.g. combined books with empty chapters), just toggle
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                setProgress(Math.round((newCompleted.size / READING_PLAN_DATA.length) * 100));
                return;
            }

            // Check if any existing journal entry fully covers this plan item's chapter range
            const existingEntryId = await checkEntryCoversChapters(item.book, planStart, planEnd);

            if (existingEntryId) {
                // Entry already covers it — just tick it off
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                setProgress(Math.round((newCompleted.size / READING_PLAN_DATA.length) * 100));
            } else {
                // No entry yet — go write one
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
            // Un-mark: delete from progress table immediately
            await toggleReadingItem(id, false);
            const newCompleted = new Set(completedItems);
            newCompleted.delete(id);
            setCompletedItems(newCompleted);
            setProgress(Math.round((newCompleted.size / READING_PLAN_DATA.length) * 100));
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
                data={READING_PLAN_DATA}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
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
