import { getTotalEntryCount } from "@/src/data/database";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const ENABLE_DRAFTS = true;
const DRAFT_KEY = "reflection_draft";
const { width } = Dimensions.get('window');

const StatCard = React.memo(({ icon, value, label }) => (
    <View style={styles.statCard}>
        <Ionicons name={icon} size={20} color="#8b7355" />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
));

const QuickStats = React.memo(() => (
    <View style={styles.statsContainer}>
        <StatCard icon="flame-outline" value="0" label="Days" />
        <StatCard icon="book-outline" value={getTotalEntryCount()} label="Entries" />
    </View>
));

const UpdateCard = React.memo(() => {
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

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
            <View style={styles.updateCard}>
                <View style={styles.updateHeader}>
                    <View style={styles.updateBadge}>
                        <Ionicons name="sparkles" size={12} color="#8b7355" />
                        <Text style={styles.updateBadgeText}>NEW</Text>
                    </View>
                    <Text style={styles.updateDate}>Sept 6, 2025</Text>
                </View>
                <Text style={styles.updateTitle}>Feature Update</Text>
                <Text style={styles.updateContent}>
                    Meditation question no. 5 (what do I want to remember?) has been removed. A simple text field won't help you remember research topics effectively.
                    {"\n"}{"\n"}We're building a smarter feature with reminders to help you revisit topics from your readings.
                </Text>
            </View>
        </Animated.View>
    );
});

const NavigationButtons = React.memo(() => {
    const button1Anim = useRef(new Animated.Value(0)).current;
    const button2Anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.stagger(100, [
            Animated.spring(button1Anim, {
                toValue: 1,
                tension: 40,
                friction: 7,
                delay: 400,
                useNativeDriver: true,
            }),
            Animated.spring(button2Anim, {
                toValue: 1,
                tension: 40,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={styles.buttonContainer}>
            <Animated.View style={{ opacity: button1Anim, transform: [{ scale: button1Anim }], width: '100%' }}>
                <Link href="/addEntry" asChild>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="add-circle-outline" size={14} color="#ffffff" />
                        <Text style={styles.primaryButtonText}>Add Entry</Text>
                    </TouchableOpacity>
                </Link>
            </Animated.View>

            <Animated.View style={{ opacity: button2Anim, transform: [{ scale: button2Anim }], width: '100%' }}>
                <Link href="/browse" asChild>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="library-outline" size={14} color="#8b7355" />
                        <Text style={styles.secondaryButtonText}>Past Entries</Text>
                    </TouchableOpacity>
                </Link>
            </Animated.View>
        </View>
    );
});

const DraftBar = React.memo(() => {
    const slideAnim = useRef(new Animated.Value(100)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

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
                { transform: [{ translateY: slideAnim }] },
            ]}
        >
            <Link href="/addEntry" asChild>
                <TouchableOpacity
                    style={styles.draftContent}
                    activeOpacity={0.85}
                >
                    <View style={styles.draftTextContainer}>
                        <Text style={styles.draftLabel}>Didn't finish?</Text>
                        <Text style={styles.draftSubtext}>No worries, pick it up now</Text>
                    </View>
                    <View style={styles.draftIcon}>
                        <Ionicons name="arrow-forward" size={20} color="#8b7355" />
                    </View>
                </TouchableOpacity>
            </Link>
        </Animated.View>
    );
});

export default function Index() {
    const [draftExists, setDraftExists] = useState(false);

    const checkDraft = useCallback(async () => {
        try {
            const draft = await AsyncStorage.getItem(DRAFT_KEY);
            setDraftExists(Boolean(draft && draft.trim()));
        } catch (e) {
            console.error("Failed to check draft:", e);
            setDraftExists(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (ENABLE_DRAFTS) {
                checkDraft();
            }
        }, [checkDraft])
    );

    return (
        <View style={styles.container}>
            <View style={styles.contentWrapper}>
                <QuickStats />
                <UpdateCard />
                <NavigationButtons />
            </View>

            {ENABLE_DRAFTS && draftExists && <DraftBar />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fafafa",
    },
    contentWrapper: {
        flex: 1,
        // justifyContent: "center",
        alignItems: "center",
        padding: 24,
        paddingBottom: 120,
    },
    titleContainer: {
        alignItems: "center",
        marginBottom: 40,
    },
    title: {
        fontSize: 44,
        fontWeight: "200",
        color: "#1a1a1a",
        letterSpacing: 6,
        textAlign: "center",
    },
    titleDivider: {
        width: 40,
        height: 1,
        backgroundColor: "#8b7355",
        marginVertical: 14,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: "400",
        color: "#666666",
        letterSpacing: 1.5,
    },
    statsContainer: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 28,
        width: "100%",
    },
    statCard: {
        flex: 1,
        backgroundColor: "#ffffff",
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: "#f0f0f0",
    },
    statValue: {
        fontSize: 18,
        fontWeight: "600",
        color: "#1a1a1a",
    },
    statLabel: {
        fontSize: 10,
        fontWeight: "500",
        color: "#999999",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    updateCardWrapper: {
        width: "100%",
        marginBottom: 28,
    },
    updateCard: {
        backgroundColor: "#ffffff",
        borderRadius: 14,
        padding: 18,
        borderWidth: 1,
        borderColor: "#f0f0f0",
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
        backgroundColor: "#faf9f7",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#f0ebe5",
    },
    updateBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#8b7355",
        letterSpacing: 0.5,
    },
    updateDate: {
        fontSize: 10,
        fontWeight: "500",
        color: "#999999",
    },
    updateTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1a1a1a",
        marginBottom: 6,
        letterSpacing: 0.2,
    },
    updateContent: {
        fontSize: 13,
        fontWeight: "400",
        color: "#666666",
        lineHeight: 19,
        letterSpacing: 0.1,
    },
    buttonContainer: {
        gap: 10,
        width: "100%",
    },
    primaryButton: {
        backgroundColor: "#4a4037",
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    primaryButtonText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
        letterSpacing: 0.3,
    },
    secondaryButton: {
        backgroundColor: "#ffffff",
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    secondaryButtonText: {
        color: "#8b7355",
        fontSize: 15,
        fontWeight: "600",
        letterSpacing: 0.3,
    },
    draftBar: {
        position: "absolute",
        bottom: 32,
        left: 20,
        right: 20,
        backgroundColor: "#faf9f7",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#d4c4b0",
        shadowColor: "#8b7355",
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