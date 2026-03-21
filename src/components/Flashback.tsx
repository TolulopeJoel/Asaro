import { getFlashbackEntry, JournalEntry } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { StyleSheet, Text, View } from 'react-native';
import { ScalePressable } from './ScalePressable';

interface FlashbackProps {
    onEntryPress: (entry: JournalEntry) => void;
}

export const Flashback: React.FC<FlashbackProps> = React.memo(({ onEntryPress }) => {
    const { colors } = useTheme();
    const [flashbackData, setFlashbackData] = useState<{ entry: JournalEntry, type: 'year' | 'month' | 'random' } | null>(null);

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
            } catch {
                // If parsing fails, continue to fetch new
            }
        }

        // Get history of recently shown entry IDs (queue of last 30)
        const historyJson = await AsyncStorage.getItem(historyKey);
        let history: number[] = [];
        if (historyJson) {
            try {
                history = JSON.parse(historyJson);
            } catch {
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

    useFocusEffect(
        useCallback(() => {
            loadFlashback();
        }, [loadFlashback])
    );


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
        const reflections = [entry.reflection_1, entry.reflection_2, entry.reflection_4]
            .filter(r => r && r.trim().length > 0);

        let text = reflections[0] || "";

        if (!text && entry.action_items && entry.action_items.length > 0) {
            const firstAction = entry.action_items.find(i => i.action.trim());
            if (firstAction) {
                text = `→ ${firstAction.action.trim()}`;
            }
        }

        if (!text) {
            text = entry.notes || "No content";
        }

        return text.length > 100 ? text.substring(0, 100) + '...' : text;
    };

    if (!flashbackData) return null;

    return (
        <ScalePressable
            onPress={() => onEntryPress(flashbackData.entry)}
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
        >
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <Ionicons name="time" size={14} color={colors.accentSecondary} />
                    <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                        {getTitle().toUpperCase()}
                    </Text>
                </View>
                <Text style={[styles.date, { color: colors.textTertiary }]}>
                    {(() => {
                        const date = new Date(flashbackData.entry.created_at || '');
                        const now = new Date();
                        return date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' })
                        });
                    })()}
                </Text>
            </View>

            <Text style={[styles.preview, { color: colors.textPrimary }]}>
                {getPreviewText()}
            </Text>
        </ScalePressable>
    );
});

Flashback.displayName = 'Flashback';

const styles = StyleSheet.create({
    card: {
        borderRadius: Spacing.borderRadius.md,
        padding: Spacing.layout.cardPadding,
        borderWidth: 1,
        width: '100%',
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        opacity: 0.7,
    },
    preview: {
        fontSize: 18,
        lineHeight: 26,
        fontWeight: "500",
        letterSpacing: -0.2,
        fontStyle: 'italic',
        opacity: 0.9,
    },
    date: {
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.8,
    },
});
