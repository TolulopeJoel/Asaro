import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { JournalEntryList } from '@/src/components/JournalEntryList';
import { JournalEntry } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedModal } from '@/src/components/AnimatedModal';


export default function PastEntriesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { colors } = useTheme();

    // Handle deep linking to specific entry from addEntry
    React.useEffect(() => {
        const checkOpenEntry = async () => {
            if (params.openEntryId) {
                try {
                    const entryId = Number(params.openEntryId);
                    const { getEntryById } = await import('@/src/data/database');
                    const entry = await getEntryById(entryId);
                    if (entry) {
                        setSelectedEntry(entry);
                        setIsDetailModalVisible(true);
                        // Clear the param so it doesn't reopen on refresh
                        router.setParams({ openEntryId: undefined });
                    }
                } catch (error) {
                    console.error('Error opening entry from params:', error);
                }
            }
        };

        checkOpenEntry();
    }, [params.openEntryId]);

    const handleEntryPress = (entry: JournalEntry) => {
        setSelectedEntry(entry);
        setIsDetailModalVisible(true);
    };

    const handleCloseDetail = () => {
        setIsDetailModalVisible(false);
        setSelectedEntry(null);
        // Trigger refresh when modal closes
        setRefreshTrigger(prev => prev + 1);
    };

    const handleDeleteEntry = () => {
        // Close the modal and refresh the list
        handleCloseDetail();
    };

    const handleEditEntry = (entry: JournalEntry) => {
        router.push({
            pathname: '/addEntry',
            params: { entryId: entry.id!.toString() }
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <JournalEntryList onEntryPress={handleEntryPress} refreshTrigger={refreshTrigger} />

            {/* Detail Modal */}
            <AnimatedModal
                visible={isDetailModalVisible}
                onRequestClose={handleCloseDetail}
            >
                <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                    {selectedEntry && (
                        <JournalEntryDetail
                            entry={selectedEntry}
                            onEdit={handleEditEntry}
                            onDelete={handleDeleteEntry}
                            onClose={handleCloseDetail}
                        />
                    )}
                </SafeAreaView>
            </AnimatedModal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    modalContainer: {
        flex: 1,
    },
});