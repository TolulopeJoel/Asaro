import { Flashback } from '@/src/components/Flashback';
import { WeeklyStreak } from '@/src/components/WeeklyStreak';
import { getMissedDaysCount, getTotalEntryCount, JournalEntry } from "@/src/data/database";
import { useTheme } from "@/src/theme/ThemeContext";
import { Spacing } from "@/src/theme/spacing";
import { Typography } from "@/src/theme/typography";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { WavyAddIcon } from '@/src/components/WavyAddIcon';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { ScalePressable } from '@/src/components/ScalePressable';

const DRAFT_KEY = "reflection_draft";
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface StatCardProps {
    icon: IoniconName;
    value: number;
}

const StatCard = React.memo(({ icon, value }: StatCardProps) => {
    const { colors } = useTheme();
    return (
        <View
            style={[
                styles.statCard,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.cardBorder,
                },
            ]}
        >
            <Ionicons
                name={icon}
                size={Typography.size.xl}
                color={colors.accent}
            />

            <Text
                style={[
                    styles.statValue,
                    { color: colors.textPrimary },
                ]}
            >
                {value}
            </Text>
        </View>
    );
});

const QuickStats = React.memo(() => {
    const [stats, setStats] = useState({
        totalEntries: 0,
        missedDays: 0,
    });

    const loadStats = useCallback(async () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const [totalEntries, missedDays] = await Promise.all([
            getTotalEntryCount(currentMonth),
            getMissedDaysCount(currentMonth),
        ]);

        setStats({ totalEntries, missedDays });
    }, []);

    // Load stats on mount
    useEffect(() => {
        loadStats();
    }, [loadStats]);

    // Reload stats when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [loadStats])
    );

    const { totalEntries, missedDays } = stats;

    return (
        <View style={styles.statsContainer}>
            <StatCard icon="flame-outline" value={totalEntries} />
            <StatCard icon="rainy-outline" value={missedDays} />
        </View>
    );
});

const UpdateCard = React.memo(() => {
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const { colors } = useTheme();

    useEffect(() => {
        const animation = Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 40,
            friction: 7,
            delay: 200,
            useNativeDriver: true,
        });
        animation.start();

        return () => {
            animation.stop();
        };
    }, [scaleAnim]);

    return (
        <Animated.View style={[styles.updateCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <View style={[styles.updateCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                <View style={styles.updateHeader}>
                    <View style={[styles.updateBadge, { backgroundColor: colors.accentSecondaryLight, borderColor: colors.accentSecondary }]}>
                        <Ionicons name="sparkles" size={Typography.size.xs} color={colors.accentSecondaryDark} />
                        <Text style={[styles.updateBadgeText, { color: colors.accentSecondaryDark }]}>NEW</Text>
                    </View>
                    <Text style={[styles.updateDate, { color: colors.textTertiary }]}>Sept 6, 2025</Text>
                </View>

                <Text style={[styles.updateTitle, { color: colors.textPrimary }]}>
                    Quick Update 🏃‍♂️
                </Text>

                <Text style={[styles.updateContent, { color: colors.textSecondary }]}>
                    Meditation question no. 5 (what do I want to remember?) has been removed.
                    We're building a smarter feature with reminders to help you revisit topics from your readings.
                </Text>
            </View>
        </Animated.View>
    );
});

const FloatingActionButton = React.memo(() => {
    const { colors, isDark } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    // Tab bar height (60) + bottom inset + extra spacing
    const bottomPosition = 60 + insets.bottom + Spacing.xl;

    // Use light neutral color in dark mode, dark in light mode
    const fabBackground = isDark ? colors.textPrimary : colors.textPrimary;
    const iconColor = isDark ? colors.background : '#FFFFFF';

    return (
        <ScalePressable
            style={[styles.fab, { backgroundColor: fabBackground, bottom: bottomPosition, shadowColor: fabBackground }]}
            onPress={() => router.push("/addEntry")}
        >
            <WavyAddIcon size={Typography.size.display} color={iconColor} />
        </ScalePressable>
    );
});

const DraftBar = React.memo(() => {
    const slideAnim = useRef(new Animated.Value(100)).current;
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    // Tab bar height (60) + bottom inset + extra spacing
    const bottomPosition = 60 + insets.bottom + Spacing.xl;

    useEffect(() => {
        const animation = Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
        });
        animation.start();

        return () => {
            animation.stop();
        };
    }, [slideAnim]);

    return (
        <Animated.View
            style={[
                styles.draftBar,
                {
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: colors.draftBar,
                    borderColor: colors.draftBarBorder,
                    shadowColor: colors.accent,
                    bottom: bottomPosition,
                },
            ]}
        >
            <Link href="/addEntry" asChild>
                <ScalePressable style={styles.draftContent}>
                    <View style={styles.draftTextContainer}>
                        <Text style={[styles.draftLabel, { color: colors.textPrimary }]}>
                            Didn't finish?
                        </Text>
                        <Text style={[styles.draftSubtext, { color: colors.textSecondary }]}>
                            No worries, pick it up now
                        </Text>
                    </View>

                    <View style={[styles.draftIcon, { backgroundColor: colors.draftIconBg }]}>
                        <Ionicons name="arrow-forward" size={Typography.size.xl} color={colors.accent} />
                    </View>
                </ScalePressable>
            </Link>
        </Animated.View>
    );
});



export default function Index() {
    const [draftExists, setDraftExists] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const { colors } = useTheme();
    const router = useRouter();

    const checkDraft = useCallback(async () => {
        try {
            const draft = await AsyncStorage.getItem(DRAFT_KEY);
            setDraftExists(Boolean(draft && draft.trim()));
        } catch (error) {
            console.error('Error checking draft:', error);
            setDraftExists(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            // Small delay to ensure AsyncStorage operations complete
            const timer = setTimeout(() => {
                checkDraft();
            }, 100);

            return () => clearTimeout(timer);
        }, [checkDraft])
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <QuickStats />
                <UpdateCard />
                <WeeklyStreak />
                <Flashback
                    onEntryPress={useCallback((entry) => {
                        setSelectedEntry(entry);
                        setIsDetailModalVisible(true);
                    }, [])}
                />
            </ScrollView>

            {!draftExists && <FloatingActionButton />}
            {draftExists && <DraftBar />}

            {/* Detail Modal */}
            <AnimatedModal
                visible={isDetailModalVisible}
                onRequestClose={() => setIsDetailModalVisible(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    {selectedEntry && (
                        <JournalEntryDetail
                            entry={selectedEntry}
                            onEdit={(entry) => {
                                setIsDetailModalVisible(false);
                                router.push({
                                    pathname: '/addEntry',
                                    params: { entryId: entry.id!.toString() }
                                });
                            }}
                            onDelete={() => {
                                setIsDetailModalVisible(false);
                            }}
                            onClose={() => setIsDetailModalVisible(false)}
                        />
                    )}
                </SafeAreaView>
            </AnimatedModal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 120,
        gap: Spacing.layout.cardPadding,
    },

    statsContainer: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    statCard: {
        flex: 1,
        borderRadius: Spacing.borderRadius.md,
        paddingVertical: Spacing.layout.cardPadding,
        paddingHorizontal: Spacing.sm,
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.sm,
        borderWidth: 1,
    },
    statValue: {
        fontSize: Typography.size.xxl,
        fontWeight: Typography.weight.bold,
        letterSpacing: Typography.letterSpacing.wide,
    },

    /* Update card */
    updateCardWrapper: {
        width: "100%",
    },
    updateCard: {
        borderRadius: Spacing.borderRadius.md,
        padding: Spacing.layout.cardPadding,
        borderWidth: 1,
    },
    updateHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: Spacing.sm,
    },
    updateBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: Spacing.borderRadius.sm,
        borderWidth: 1,
    },
    updateBadgeText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: Typography.letterSpacing.wide,
    },
    updateDate: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
    },
    updateTitle: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        marginBottom: 6,
        letterSpacing: Typography.letterSpacing.wide,
    },
    updateContent: {
        fontSize: Typography.size.md,
        lineHeight: Typography.lineHeight.md,
        letterSpacing: Typography.letterSpacing.wide,
    },

    /* Draft bar */
    draftBar: {
        position: "absolute",
        left: Spacing.xl,
        right: Spacing.xl,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    draftContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: Spacing.layout.cardPadding,
        paddingHorizontal: Spacing.xl,
    },
    draftTextContainer: {
        flex: 1,
    },
    draftLabel: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        marginBottom: 2,
    },
    draftSubtext: {
        fontSize: Typography.size.md,
        letterSpacing: Typography.letterSpacing.wide,
    },
    draftIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },

    /* FAB */
    fab: {
        position: 'absolute',
        right: Spacing.layout.screenPadding,
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
});
