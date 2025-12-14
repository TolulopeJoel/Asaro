import { BackupPreview, exportBackup, getBackupPreview, importBackup, pickBackupFile } from '@/src/data/backup';
import { useTheme } from '@/src/theme/ThemeContext';
import { sendTestNotification } from '@/src/utils/notifications';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Settings() {
    const { colors, theme, setTheme } = useTheme();

    const handleTestNotification = async () => {
        try {
            await sendTestNotification();
            Alert.alert('Success', 'Notification sent! Check your notification center if you don\'t see it immediately.');
        } catch (error) {
            Alert.alert('Error', 'Failed to send notification. Please check permissions.');
        }
    };

    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
    const [selectedBackupFile, setSelectedBackupFile] = useState<string | null>(null);

    const handleExportBackup = async () => {
        setIsBackingUp(true);
        try {
            const result = await exportBackup();
            if (result.success) {
                Alert.alert('Backup Created', result.message);
            } else {
                Alert.alert('Backup Failed', result.message);
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred during backup.');
        } finally {
            setIsBackingUp(false);
        }
    };

    const handlePickBackup = async () => {
        try {
            const fileUri = await pickBackupFile();
            if (!fileUri) return;

            setIsRestoring(true);
            const preview = await getBackupPreview(fileUri);

            if (!preview.isValid) {
                Alert.alert('Invalid Backup', preview.errorMessage || 'The selected file is not a valid backup.');
                setIsRestoring(false);
                return;
            }

            setBackupPreview(preview);
            setSelectedBackupFile(fileUri);
            setShowRestoreModal(true);
            setIsRestoring(false);
        } catch (error) {
            setIsRestoring(false);
            Alert.alert('Error', 'Failed to pick backup file.');
        }
    };

    const handleRestore = async (mode: 'merge' | 'replace') => {
        if (!selectedBackupFile) return;

        setShowRestoreModal(false);
        setIsRestoring(true);

        try {
            const result = await importBackup(selectedBackupFile, mode);
            if (result.success) {
                Alert.alert('Restore Complete', result.message);
            } else {
                Alert.alert('Restore Failed', result.message);
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred during restore.');
        } finally {
            setIsRestoring(false);
            setBackupPreview(null);
            setSelectedBackupFile(null);
        }
    };



    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Stack.Screen options={{ title: 'Settings' }} />
            <ScrollView style={styles.scrollView}>
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.themeSelector}>
                            {(['light', 'dark', 'system'] as const).map((mode) => (
                                <TouchableOpacity
                                    key={mode}
                                    style={[
                                        styles.themeOption,
                                        {
                                            backgroundColor: theme === mode ? colors.accent : 'transparent',
                                            borderColor: colors.border
                                        }
                                    ]}
                                    onPress={() => setTheme(mode)}
                                >
                                    <Text style={[
                                        styles.themeOptionText,
                                        { color: theme === mode ? colors.buttonPrimaryText : colors.textPrimary }
                                    ]}>
                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.cardText, { color: colors.textSecondary }]}>
                            Test if notifications are working correctly on your device.
                        </Text>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.accent }]}
                            onPress={handleTestNotification}
                        >
                            <Text style={styles.buttonText}>Test Notification</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Backup & Restore</Text>
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.cardText, { color: colors.textSecondary }]}>
                            Export your journal entries to a file or restore from a previous backup.
                        </Text>

                        <View style={styles.buttonGroup}>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: colors.accent, flex: 1, marginRight: 8 }]}
                                onPress={handleExportBackup}
                                disabled={isBackingUp || isRestoring}
                            >
                                {isBackingUp ? (
                                    <ActivityIndicator color={colors.buttonPrimaryText} size="small" />
                                ) : (
                                    <Text style={[styles.buttonText, { color: colors.buttonPrimaryText }]}>Export Backup</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: colors.cardHover, flex: 1, marginLeft: 8, borderWidth: 1, borderColor: colors.border }]}
                                onPress={handlePickBackup}
                                disabled={isBackingUp || isRestoring}
                            >
                                {isRestoring ? (
                                    <ActivityIndicator color={colors.textPrimary} size="small" />
                                ) : (
                                    <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Import Backup</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.row}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>App Name</Text>
                            <Text style={[styles.value, { color: colors.textSecondary }]}>Àṣàrò</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <View style={styles.row}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>Version</Text>
                            <Text style={[styles.value, { color: colors.textSecondary }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <Modal
                visible={showRestoreModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRestoreModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Restore Backup</Text>

                        {backupPreview && (
                            <View style={styles.previewContainer}>
                                <View style={styles.previewRow}>
                                    <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Entries:</Text>
                                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>{backupPreview.totalEntries}</Text>
                                </View>
                                <View style={styles.previewRow}>
                                    <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Date Range:</Text>
                                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                                        {backupPreview.dateRange.earliest} - {backupPreview.dateRange.latest}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                            Choose how you want to restore your entries:
                        </Text>

                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: colors.accent }]}
                            onPress={() => handleRestore('merge')}
                        >
                            <Text style={[styles.modalButtonText, { color: colors.buttonPrimaryText }]}>Merge (Keep Existing)</Text>
                            <Text style={[styles.modalButtonSubtext, { color: 'rgba(255,255,255,0.8)' }]}>Adds new entries, skips duplicates</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: colors.cardHover, borderWidth: 1, borderColor: colors.border }]}
                            onPress={() => {
                                Alert.alert(
                                    'Replace All Entries?',
                                    'This will DELETE all current entries and replace them with the backup. This action cannot be undone.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Replace All', style: 'destructive', onPress: () => handleRestore('replace') }
                                    ]
                                );
                            }}
                        >
                            <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Replace All</Text>
                            <Text style={[styles.modalButtonSubtext, { color: colors.textSecondary }]}>Deletes current entries first</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowRestoreModal(false)}
                        >
                            <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardText: {
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    label: {
        fontSize: 16,
    },
    value: {
        fontSize: 16,
    },
    divider: {
        height: 1,
        marginVertical: 8,
    },
    themeSelector: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0', // This might need theming too if visible
        borderRadius: 8,
        padding: 4,
        gap: 4,
    },
    themeOption: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    themeOptionText: {
        fontSize: 14,
        fontWeight: '500',
    },
    buttonGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    previewContainer: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    previewLabel: {
        fontSize: 14,
    },
    previewValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    modalButton: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    modalButtonSubtext: {
        fontSize: 12,
    },
    modalCloseButton: {
        marginTop: 8,
        padding: 12,
        alignItems: 'center',
    },
    modalCloseText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
