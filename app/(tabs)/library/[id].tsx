import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { JournalEntry, getEntryById, deleteJournalEntry } from '@/src/data/database';
import { emitMilestones, unpublishReading } from '@/src/groups/publish';
import { syncStudyReminders } from '@/src/utils/notifications';
import { LoadingView } from '@/src/components/LoadingView';
import { shareEntry } from '@/src/utils/shareEntry';
import { useAlert } from '@/src/context/AlertContext';
import { useTour } from '@/src/onboarding/tour';
import { DEMO_ENTRIES } from '@/src/onboarding/demo';

export default function JournalEntryDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showAlert } = useAlert();
    // The walk's example entries have negative ids and live only in memory.
    const { active: touring } = useTour();
    const demo = touring && Number(id) < 0;

    // Reloaded on every focus, so returning from an edit shows the saved text. The spinner is first-load only.
    useFocusEffect(useCallback(() => {
        let alive = true;
        const loadEntry = async () => {
            if (!id) return;
            if (demo) {
                setEntry(DEMO_ENTRIES.find(e => e.id === Number(id)) ?? null);
                setIsLoading(false);
                return;
            }
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
    }, [id, demo]));

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
                            void syncStudyReminders();
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
            await shareEntry(entry);
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
                // An example can be read, not edited, deleted or shared.
                onEdit={demo ? undefined : handleEdit}
                onDelete={demo ? undefined : () => handleDelete(entry)}
                onClose={handleClose}
                onShare={demo ? undefined : () => handleShare(entry)}
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
