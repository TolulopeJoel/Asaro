import { JournalEntry, getFlashbackEntry } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FlashbackProps {
    onEntryPress: (entry: JournalEntry) => void;
}

export const Flashback: React.FC<FlashbackProps> = ({ onEntryPress }) => {
    const { colors } = useTheme();
    const [flashbackData, setFlashbackData] = useState<{ entry: JournalEntry, type: 'year' | 'month' | 'random' } | null>(null);
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    const loadFlashback = useCallback(async () => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const cacheKey = `flashback_${today}`;
        const historyKey = 'flashback_history';
        const MAX_HISTORY = 30;

        // Try to get cached flashback for today
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsedCache = JSON.parse(cached);
                setFlashbackData(parsedCache);
                return;
            } catch (e) {
                // If parsing fails, continue to fetch new
            }
        }

        // Get history of recently shown entry IDs (queue of last 30)
        const historyJson = await AsyncStorage.getItem(historyKey);
        let history: number[] = [];
        if (historyJson) {
            try {
                history = JSON.parse(historyJson);
            } catch (e) {
                history = [];
            }
        }

        // Fetch new flashback (excluding recently shown)
        const data = await getFlashbackEntry(history);
        if (data) {
            // Add to history queue
            history.push(data.entry.id!);

            // Keep only last 30 entries (pop oldest if needed)
            if (history.length > MAX_HISTORY) {
                history.shift(); // Remove oldest
            }

            await AsyncStorage.setItem(historyKey, JSON.stringify(history));
            // Cache it for today
            await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        }
        setFlashbackData(data);
    }, []);

    useEffect(() => {
        loadFlashback();
    }, [loadFlashback]);

    useFocusEffect(
        useCallback(() => {
            loadFlashback();
        }, [loadFlashback])
    );

    useEffect(() => {
        if (flashbackData) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 40,
                friction: 7,
                delay: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [flashbackData]);

    const getTitle = () => {
        if (!flashbackData) return '';
        switch (flashbackData.type) {
            case 'year': return 'On this day last year';
            case 'month': return 'One month ago';
            case 'random': return 'From the archives';
        }
    };

    const getPreviewText = () => {
        if (!flashbackData) return '';
        const { entry } = flashbackData;
        const reflections = [entry.reflection_1, entry.reflection_2, entry.reflection_3, entry.reflection_4]
            .filter(r => r && r.trim().length > 0);

        const text = reflections[0] || entry.notes || "No content";
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
    };

    if (!flashbackData) return null;

    return (
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onEntryPress(flashbackData.entry)}
                style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            >
                <View style={styles.header}>
                    <Ionicons name="time-outline" size={16} color={colors.accentSecondaryDark} />
                    <Text style={[styles.headerText, { color: colors.textSecondary }]}>
                        {getTitle()}
                    </Text>
                </View>

                <Text style={[styles.preview, { color: colors.textPrimary }]}>
                    {getPreviewText()}
                </Text>

                <View style={styles.footer}>
                    <Text style={[styles.date, { color: colors.textTertiary }]}>
                        {new Date(flashbackData.entry.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    cardWrapper: {
        width: "100%",
        marginBottom: 28,
    },
    card: {
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    headerText: {
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 0.3,
        textTransform: "uppercase",
    },
    preview: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: "400",
        marginBottom: 16,
        letterSpacing: 0.1,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    date: {
        fontSize: 12,
        fontWeight: "500",
        letterSpacing: 0.2,
    },
});
