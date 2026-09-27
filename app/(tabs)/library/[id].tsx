import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { JournalEntry, getEntryById, deleteJournalEntry } from '@/src/data/database';
import { emitMilestones, unpublishReading } from '@/src/groups/publish';
import { cancelStudyReminder } from '@/src/utils/notifications';
import { LoadingView } from '@/src/components/LoadingView';
import { Share } from 'react-native';
import { useAlert } from '@/src/context/AlertContext';

/** "John 3:16–21", "Genesis 12–15", "Genesis 12:4–13:2" — the passage as the entry records it. */
function entryReference(entry: JournalEntry): string {
    const { book_name, chapter_start: c1, verse_start: v1, verse_end: v2 } = entry;
    const c2 = entry.chapter_end && entry.chapter_end !== c1 ? entry.chapter_end : undefined;
    if (c2) {
        return v1 || v2
            ? `${book_name} ${c1}${v1 ? `:${v1}` : ''}–${c2}${v2 ? `:${v2}` : ''}`
            : `${book_name} ${c1}–${c2}`;
    }
    if (!v1) return `${book_name} ${c1}`;
    return `${book_name} ${c1}:${v1}${v2 && v2 !== v1 ? `–${v2}` : ''}`;
}

export default function JournalEntryDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showAlert } = useAlert();

    // Reloaded on every focus, so returning from an edit shows the saved text. The spinner is first-load only.
    useFocusEffect(useCallback(() => {
        let alive = true;
        const loadEntry = async () => {
            if (!id) return;
            try {
                const data = await getEntryById(Number(id));
                if (alive) setEntry(data);
            } catch (error) {
                console.error('Failed to load entry:', error);
            } finally {
                if (alive) setIsLoading(false);
            }
        };
        loadEntry();
        return () => { alive = false; };
    }, [id]));

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
                            void unpublishReading(entry.id!);
                            void emitMilestones();
                            void cancelStudyReminder(entry.id!).catch(() => {});
                            router.replace('/library');
                        } catch (error) {
                            console.error("Error deleting entry:", error);
                            showAlert({ title: 'Not deleted', message: 'This entry could not be deleted. Please try again.' });
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
            const reference = entryReference(entry);
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
        <>
            <Stack.Screen options={{ headerShown: false }} />
            {/* The detail owns the whole surface — band, content and the bar
                at its foot — so there is no <Screen> to wrap it in here. */}
            <JournalEntryDetail
                entry={entry}
                onEdit={handleEdit}
                onDelete={() => handleDelete(entry)}
                onClose={handleClose}
                onShare={() => handleShare(entry)}
                isSharing={isSharing}
                isDeleting={isDeleting}
                aboveTabBar
            />
        </>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
