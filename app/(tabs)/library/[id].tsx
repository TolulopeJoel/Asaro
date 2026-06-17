import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeContext';
import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { JournalEntry, getEntryById } from '@/src/data/database';
import { LoadingView } from '@/src/components/LoadingView';

export default function JournalEntryDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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

    const handleDelete = () => {
        router.replace('/(tabs)/library');
    };

    const handleClose = () => {
        router.replace('/(tabs)/library');
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
