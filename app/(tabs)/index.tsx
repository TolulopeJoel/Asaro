import { getComebackDaysCount, getMissedDaysCount, getTotalEntryCount } from "@/src/data/database";
import { useTheme } from "@/src/theme/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

const DRAFT_KEY = "reflection_draft";
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface StatCardProps {
    icon: IoniconName;
    value: number;
    label: string;
}

const StatCard = React.memo(({ icon, value, label }: StatCardProps) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Ionicons name={icon} size={20} color={colors.accent} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
});

const QuickStats = React.memo(() => {
    const [stats, setStats] = useState({
        totalEntries: 0,
        missedDays: 0,
        comebackDays: 0,
    });

    const loadStats = useCallback(async () => {
        const [totalEntries, missedDays, comebackDays] = await Promise.all([
            getTotalEntryCount(),
            getMissedDaysCount(),
            getComebackDaysCount(),
        ]);

        setStats({ totalEntries, missedDays, comebackDays });
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

    const { totalEntries, missedDays, comebackDays } = stats;

    return (
        <View style={styles.statsContainer}>
            <StatCard
                icon="flame-outline"
                value={totalEntries}
                label={`${totalEntries === 1 ? 'Entry' : 'Entries'}`}
            />
            <StatCard
                icon="rainy-outline"
                value={missedDays}
                label={`${missedDays === 1 ? 'Missed Day' : 'Missed Days'}`}
            />
            <StatCard
                icon="leaf-outline"
                value={comebackDays}
                label={`${comebackDays === 1 ? 'Comeback' : 'Comebacks'}`}
            />
        </View>
    );
});

const UpdateCard = React.memo(() => {
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const { colors } = useTheme();

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 40,
            friction: 7,
            delay: 200,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={[styles.updateCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <View style={[styles.updateCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={styles.updateHeader}>
                    <View style={[styles.updateBadge, { backgroundColor: colors.accentSecondaryLight, borderColor: colors.accentSecondary }]}>
                        <Ionicons name="sparkles" size={12} color={colors.accentSecondaryDark} />
                        <Text style={[styles.updateBadgeText, { color: colors.accentSecondaryDark }]}>NEW</Text>
                    </View>
                    <Text style={[styles.updateDate, { color: colors.textTertiary }]}>Sept 6, 2025</Text>
                </View>
                <Text style={[styles.updateTitle, { color: colors.textPrimary }]}>Quick Update 🏃‍♂️</Text>
                <Text style={[styles.updateContent, { color: colors.textSecondary }]}>
                    Meditation question no. 5 (what do I want to remember?) has been removed. A simple text field won't help you remember research topics effectively.
                    {"\n"}{"\n"}We're building a smarter feature with reminders to help you revisit topics from your readings.
                </Text>
            </View>
        </Animated.View>
    );
});

const NavigationButtons = React.memo(() => {
    const { colors } = useTheme();

    return (
        <View style={styles.buttonContainer}>
            <Link href="/addEntry" asChild>
                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        {
                            backgroundColor: '#FF6B6B', // Bright red for visibility
                            borderWidth: 3,
                            borderColor: '#000000', // Black border
                        }
                    ]}
                    activeOpacity={0.9}
                >
                    <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
                    <Text style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>Add Entry</Text>
                </TouchableOpacity>
            </Link>
        </View>
    );
});

const DraftBar = React.memo(() => {
    const slideAnim = useRef(new Animated.Value(100)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const { colors } = useTheme();

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
        }).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.draftBar,
                {
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: colors.draftBar,
                    borderColor: colors.draftBarBorder,
                    shadowColor: colors.accent
                },
            ]}
        >
            <Link href="/addEntry" asChild>
                <TouchableOpacity
                    style={styles.draftContent}
                    activeOpacity={0.85}
                >
                    <View style={styles.draftTextContainer}>
                        <Text style={[styles.draftLabel, { color: colors.textPrimary }]}>Didn't finish?</Text>
                        <Text style={[styles.draftSubtext, { color: colors.textSecondary }]}>No worries, pick it up now</Text>
                    </View>
                    <View style={[styles.draftIcon, { backgroundColor: colors.draftIconBg }]}>
                        <Ionicons name="arrow-forward" size={20} color={colors.accent} />
                    </View>
                </TouchableOpacity>
            </Link>
        </Animated.View>
    );
});

export default function Index() {
    const [draftExists, setDraftExists] = useState(false);
    const { colors } = useTheme();

    const checkDraft = useCallback(async () => {
        const draft = await AsyncStorage.getItem(DRAFT_KEY);
        setDraftExists(Boolean(draft && draft.trim()));
    }, []);

    useFocusEffect(
        useCallback(() => {
            checkDraft();
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
                <NavigationButtons />
            </ScrollView>

            {draftExists && <DraftBar />}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        alignItems: "center",
        padding: 24,
        paddingBottom: 120,
    },
    statsContainer: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 28,
        width: "100%",
    },
    statCard: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
    },
    statValue: {
        fontSize: 18,
        fontWeight: "600",
    },
    statLabel: {
        fontSize: 10,
        fontWeight: "500",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    updateCardWrapper: {
        width: "100%",
        marginBottom: 28,
    },
    updateCard: {
        borderRadius: 14,
        padding: 18,
        borderWidth: 1,
    },
    updateHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    updateBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    updateBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    updateDate: {
        fontSize: 10,
        fontWeight: "500",
    },
    updateTitle: {
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 6,
        letterSpacing: 0.2,
    },
    updateContent: {
        fontSize: 13,
        fontWeight: "400",
        lineHeight: 19,
        letterSpacing: 0.1,
    },
    buttonContainer: {
        gap: 10,
        width: "100%",
        marginTop: 20,
    },
    primaryButton: {
        paddingVertical: 20,
        paddingHorizontal: 32,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        minHeight: 60,
    },
    primaryButtonText: {
        fontSize: 18,
        fontWeight: "600",
        letterSpacing: 0.3,
    },
    draftBar: {
        position: "absolute",
        bottom: 32,
        left: 20,
        right: 20,
        borderRadius: 16,
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
        paddingVertical: 18,
        paddingHorizontal: 20,
    },
    draftTextContainer: {
        flex: 1,
    },
    draftLabel: {
        color: "#2d2520",
        fontSize: 15,
        fontWeight: "600",
        letterSpacing: 0.2,
        marginBottom: 2,
    },
    draftSubtext: {
        color: "#6b5d52",
        fontSize: 13,
        fontWeight: "400",
        letterSpacing: 0.1,
    },
    draftIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#f0ebe3",
        justifyContent: "center",
        alignItems: "center",
    },
});