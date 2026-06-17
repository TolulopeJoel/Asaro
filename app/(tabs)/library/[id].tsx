import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeContext';
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { JournalEntry, getEntryById, deleteJournalEntry } from '@/src/data/database';
import { LoadingView } from '@/src/components/LoadingView';
import { Spacing } from '@/src/theme/spacing';
import { Share } from 'react-native';
import { useAlert } from '@/src/context/AlertContext';
import { CardFAB } from '@/src/components/CardFAB';

export default function JournalEntryDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showAlert } = useAlert();

    // Tab bar height (60) + bottom inset + extra spacing (Spacing.xl = 24)
    const bottomPosition = 60 + insets.bottom + Spacing.xl;

    useEffect(() => {
        const loadEntry = async () => {
            if (!id) return;
            try {
                const data = await getEntryById(Number(id));
                setEntry(data);
            } catch (error) {
                console.error('Failed to load entry:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadEntry();
    }, [id]);

    const handleEdit = (entry: JournalEntry) => {
        router.push({
            pathname: '/addEntry',
            params: { entryId: entry.id!.toString() }
        });
    };

    const handleDelete = (entry: JournalEntry) => {
        showAlert({
            title: "Delete Entry?",
            message: "Are you sure you want to delete this reflection? This cannot be undone.",
            buttons: [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await deleteJournalEntry(entry.id!);
                            router.replace('/library');
                        } catch (error) {
                            console.error("Error deleting entry:", error);
                        } finally {
                            setIsDeleting(false);
                        }
                    },
                },
            ]
        });
    };

    const handleClose = () => {
        router.back();
    };

    const handleShare = async (entry: JournalEntry) => {
        setIsSharing(true);
        try {
            // Simplified share logic for now, or we could import the helper if refactored
            const reference = `${entry.book_name} ${entry.chapter_start}${entry.verse_start ? ':' + entry.verse_start : ''}`;
            let content = `Reflection on ${reference}\n\n`;
            if (entry.reflection_1) content += `${entry.reflection_1}\n\n`;
            content += `🫶 Created with Àṣàrò`;

            await Share.share({
                message: content,
                title: reference,
            });
        } catch (error) {
            console.error("Error sharing entry:", error);
        } finally {
            setIsSharing(false);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <LoadingView size={48} />
            </View>
        );
    }

    if (!entry) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                {/* Could add an error state here */}
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <JournalEntryDetail
                entry={entry}
                onEdit={handleEdit}
                onDelete={() => handleDelete(entry)}
                onClose={handleClose}
            />

            <CardFAB
                onShare={() => handleShare(entry)}
                onEdit={() => handleEdit(entry)}
                onDelete={() => handleDelete(entry)}
                isSharing={isSharing}
                isDeleting={isDeleting}
                bottom={bottomPosition}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
