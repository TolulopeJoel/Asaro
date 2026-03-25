import React, { useCallback, useState } from 'react';
import { LoadingView } from '@/src/components/LoadingView';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { READING_PLAN_DATA, ReadingItem } from '@/src/data/readingPlanData';
import { getReadingProgress, toggleReadingItem, checkEntryCoversChapters } from '@/src/data/database';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';
import Animated, { LinearTransition } from 'react-native-reanimated';

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
    const progress = totalCount > 0 ? (completedCount / totalCount) : 0;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggle}
            style={[
                styles.sectionHeader,
                { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }
            ]}
        >
            <View style={styles.sectionTitleContainer}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title.toUpperCase()}</Text>
                <View style={[styles.sectionBadge, { backgroundColor: isDone ? colors.accent + '20' : colors.border }]}>
                    <Text style={[styles.sectionProgress, { color: isDone ? colors.accent : colors.textSecondary }]}>
                        {completedCount}/{totalCount}
                    </Text>
                </View>
            </View>
            <View style={styles.sectionHeaderRight}>
                {progress > 0 && !isDone && (
                    <View style={[styles.miniProgressTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.miniProgressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
                    </View>
                )}
                {isDone && <Ionicons name="checkmark-circle" size={16} color={colors.accent} />}
                <Ionicons
                    name={isCollapsed ? "chevron-forward" : "chevron-down"}
                    size={16}
                    color={colors.textTertiary}
                    style={{ marginLeft: 8 }}
                />
            </View>
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
                    borderColor: isCompleted ? colors.accent + '40' : colors.cardBorder,
                },
                item.isKey && !isCompleted && {
                    borderColor: colors.accentSecondary + '60',
                    backgroundColor: colors.accentSecondaryLight + '05',
                }
            ]}
            onPress={() => onToggle(item.id, !isCompleted)}
        >
            <View style={styles.cardContent}>
                <View style={styles.bookInfo}>
                    <View style={styles.bookHeader}>
                        {item.isKey && (
                            <View style={[styles.keyBadge, { backgroundColor: colors.accentSecondary + '15' }]}>
                                <Ionicons
                                    name="sparkles"
                                    size={10}
                                    color={colors.accentSecondary}
                                />
                            </View>
                        )}
                        <Text style={[
                            styles.bookName,
                            { color: isCompleted ? colors.textTertiary : colors.textPrimary },
                            isCompleted && { textDecorationLine: 'line-through' }
                        ]}>
                            {item.book}
                        </Text>
                    </View>
                    <Text style={[
                        styles.chapters,
                        { color: isCompleted ? colors.textMuted : colors.textSecondary }
                    ]}>
                        {item.chapters || "Full Book"}
                    </Text>
                </View>

                <View style={[
                    styles.checkbox,
                    {
                        backgroundColor: isCompleted ? colors.accent : 'transparent',
                        borderColor: isCompleted ? colors.accent : colors.border,
                    }
                ]}>
                    {isCompleted && <Ionicons name="checkmark" size={14} color={colors.background} />}
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
        setProgress(parseFloat(((progressIds.length / READING_PLAN_DATA.length) * 100).toFixed(2)));

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

            // Strip verse notation: "119:64-176" → start=119, end=119; "116-119:63" → start=116, end=119
            const rawChapters = item.chapters;
            const parts = rawChapters.split('-');
            const firstHasVerse = parts[0].includes(':');
            const planStart = parseInt(parts[0].split(':')[0], 10);

            let planEnd: number;
            if (parts.length > 1) {
                if (firstHasVerse) {
                    // If the FIRST part has a verse (119:64), the SECOND part is a verse in the same chapter
                    planEnd = planStart;
                } else {
                    // Example: "116-119:63" -> start is 116, end is 119
                    planEnd = parseInt(parts[parts.length - 1].split(':')[0], 10);
                }
            } else {
                planEnd = planStart;
            }

            if (isNaN(planStart)) {
                // Can't determine chapters (e.g. combined books with empty chapters), just toggle
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                setProgress(parseFloat(((newCompleted.size / READING_PLAN_DATA.length) * 100).toFixed(2)));
                return;
            }

            // Check if any existing journal entry fully covers this plan item's chapter range
            const isCovered = await checkEntryCoversChapters(item.book, planStart, planEnd);

            if (isCovered) {
                // Entry already covers it — just tick it off
                await toggleReadingItem(id, true);
                const newCompleted = new Set(completedItems);
                newCompleted.add(id);
                setCompletedItems(newCompleted);
                setProgress(parseFloat(((newCompleted.size / READING_PLAN_DATA.length) * 100).toFixed(2)));
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
            setProgress(parseFloat(((newCompleted.size / READING_PLAN_DATA.length) * 100).toFixed(2)));
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
            <Animated.View layout={LinearTransition}>
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
            </Animated.View>
        );
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.progressHeaderRow}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Bible Plan</Text>
                <Text style={[styles.progressPercentage, { color: colors.accent }]}>{parseFloat(progress.toFixed(2))}%</Text>
            </View>
            <View style={styles.progressCard}>
                <View style={[styles.progressBarBase, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {isInitialLoad ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <LoadingView size={48} />
                </View>
            ) : (
                <FlatList
                    data={READING_PLAN_DATA}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={renderHeader}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
    },
    progressCard: {
        gap: Spacing.sm,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    progressLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    progressBarBase: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    listContent: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 120, // Tab bar avoidance
    },
    sectionHeader: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },
    sectionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    sectionProgress: {
        fontSize: 10,
        fontWeight: '800',
    },
    miniProgressTrack: {
        width: 40,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    miniProgressFill: {
        height: '100%',
        borderRadius: 2,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: Spacing.xs,
        padding: 16,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bookInfo: {
        flex: 1,
        gap: 2,
    },
    bookHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bookName: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    chapters: {
        fontSize: 14,
        letterSpacing: 0.1,
    },
    checkbox: {
        width: 26,
        height: 26,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 5,
        borderRadius: 8,
    },
    progressHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    progressPercentage: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -1,
    },
});
