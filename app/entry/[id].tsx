import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { getEntryById } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAlert } from '@/src/context/AlertContext';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JournalEntry } from '@/src/data/database';

export default function EntryDetailScreen() {
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();
    const params = useLocalSearchParams();
    const entryId = params.id ? Number(params.id) : undefined;
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadEntry = async () => {
            if (!entryId) {
                showAlert({ title: 'Error', message: 'Entry ID is missing' });
                router.back();
                return;
            }

            try {
                const loadedEntry = await getEntryById(entryId);
                if (!loadedEntry) {
                    showAlert({ title: 'Error', message: 'Entry not found' });
                    router.back();
                    return;
                }
                setEntry(loadedEntry);
            } catch (error) {
                console.error('Error loading entry:', error);
                showAlert({ title: 'Error', message: 'Failed to load entry' });
                router.back();
            } finally {
                setIsLoading(false);
            }
        };

        loadEntry();
    }, [entryId, router]);

    const handleEdit = (entry: JournalEntry) => {
        router.push({
            pathname: '/addEntry',
            params: { entryId: entry.id!.toString() }
        });
    };

    const handleDelete = () => {
        router.back();
    };

    const handleClose = () => {
        router.back();
    };

    if (isLoading || !entry) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Loading state - entry will be shown once loaded */}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <JournalEntryDetail
                entry={entry}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClose={handleClose}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

