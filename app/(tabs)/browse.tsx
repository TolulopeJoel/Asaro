import { JournalEntryDetail } from '@/src/components/JournalEntryDetail';
import { JournalEntryList } from '@/src/components/JournalEntryList';
import { JournalEntry } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PastEntriesScreen() {
    const router = useRouter();
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { colors } = useTheme();

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
            <Modal
                visible={isDetailModalVisible}
                animationType="slide"
                statusBarTranslucent={true}
                presentationStyle="pageSheet"
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
            </Modal>
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