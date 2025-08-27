import { JournalEntry } from '@/src/data/database';
import React, { useState } from 'react';
import { Modal, SafeAreaView, StyleSheet } from 'react-native';
import { JournalEntryDetail } from '../src/components/JournalEntryDetail';
import { JournalEntryList } from '../src/components/JournalEntryList';

export default function BrowseScreen() {
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

    const handleEntryPress = (entry: JournalEntry) => {
        setSelectedEntry(entry);
        setIsDetailModalVisible(true);
    };

    const handleCloseDetail = () => {
        setIsDetailModalVisible(false);
        setSelectedEntry(null);
    };

    const handleDeleteEntry = () => {
        // Close the modal and refresh the list
        handleCloseDetail();
        // The list will automatically refresh when the modal closes
    };

    const handleEditEntry = (entry: JournalEntry) => {
        // TODO: Navigate to edit screen when we build it
        console.log('Edit entry:', entry.id);
        handleCloseDetail();
    };

    return (
        <SafeAreaView style={styles.container}>
            <JournalEntryList onEntryPress={handleEntryPress} />

            {/* Detail Modal */}
            <Modal
                visible={isDetailModalVisible}
                animationType="slide"
                statusBarTranslucent={true}
                presentationStyle="pageSheet"
                onRequestClose={handleCloseDetail}
            >
                <SafeAreaView style={styles.modalContainer}>
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
        backgroundColor: '#ffffff',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
});