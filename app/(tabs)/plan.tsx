// app/(tabs)/plan.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { READING_PLAN_DATA, ReadingItem } from '@/src/data/readingPlanData';
import { getReadingProgress, toggleReadingItem } from '@/src/data/database';
import { useFocusEffect } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';

const SectionHeader = ({ title }: { title: string }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.sectionHeader, { borderBottomColor: colors.accent }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title.toUpperCase()}</Text>
        </View>
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
    const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState(0);

    const loadProgress = useCallback(async () => {
        const progressIds = await getReadingProgress();
        setCompletedItems(new Set(progressIds));
        setProgress(Math.round((progressIds.length / READING_PLAN_DATA.length) * 100));
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadProgress();
        }, [loadProgress])
    );

    const handleToggle = async (id: number, completed: boolean) => {
        await toggleReadingItem(id, completed);
        const newCompleted = new Set(completedItems);
        if (completed) {
            newCompleted.add(id);
        } else {
            newCompleted.delete(id);
        }
        setCompletedItems(newCompleted);
        setProgress(Math.round((newCompleted.size / READING_PLAN_DATA.length) * 100));
    };

    const renderItem = ({ item, index }: { item: ReadingItem; index: number }) => {
        const showHeader = index === 0 || READING_PLAN_DATA[index - 1].section !== item.section;

        return (
            <View>
                {showHeader && <SectionHeader title={item.section} />}
                <ReadingCard
                    item={item}
                    isCompleted={completedItems.has(item.id)}
                    onToggle={handleToggle}
                />
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
    },
    sectionTitle: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.bold,
        letterSpacing: 1.5,
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
