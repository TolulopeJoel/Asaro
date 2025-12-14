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
                {/* Appearance */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
                    <View style={styles.themeSelector}>
                        {(['light', 'dark', 'system'] as const).map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    styles.themeOption,
                                    {
                                        backgroundColor: theme === mode ? colors.accent : 'transparent',
                                        borderColor: theme === mode ? colors.accent : colors.border,
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

                {/* Notifications */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
                    <TouchableOpacity
                        style={[styles.actionButton, {
                            borderColor: colors.accent,
                            backgroundColor: colors.accent + '08',
                        }]}
                        onPress={handleTestNotification}
                    >
                        <Text style={[styles.actionButtonText, { color: colors.accent }]}>
                            Test Notification
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Backup */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Backup & Restore</Text>
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={[styles.actionButton, { flex: 1, borderColor: colors.border }]}
                            onPress={handleExportBackup}
                            disabled={isBackingUp || isRestoring}
                        >
                            {isBackingUp ? (
                                <ActivityIndicator color={colors.textPrimary} size="small" />
                            ) : (
                                <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
                                    Export
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, { flex: 1, borderColor: colors.border }]}
                            onPress={handlePickBackup}
                            disabled={isBackingUp || isRestoring}
                        >
                            {isRestoring ? (
                                <ActivityIndicator color={colors.textPrimary} size="small" />
                            ) : (
                                <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
                                    Import
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Version</Text>
                        <Text style={[styles.value, { color: colors.textPrimary }]}>
                            {Constants.expoConfig?.version || '1.0.0'}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Restore Modal */}
            <Modal
                visible={showRestoreModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRestoreModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                            Restore Backup
                        </Text>

                        {backupPreview && (
                            <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                                <View style={styles.previewRow}>
                                    <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                                        Entries
                                    </Text>
                                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                                        {backupPreview.totalEntries}
                                    </Text>
                                </View>
                                <View style={styles.previewRow}>
                                    <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                                        Range
                                    </Text>
                                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                                        {backupPreview.dateRange.earliest} — {backupPreview.dateRange.latest}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.modalButton, {
                                backgroundColor: colors.accent,
                                borderWidth: 0,
                            }]}
                            onPress={() => handleRestore('merge')}
                        >
                            <Text style={[styles.modalButtonText, { color: colors.buttonPrimaryText }]}>
                                Merge
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalButton, { borderColor: colors.border, borderWidth: 1 }]}
                            onPress={() => {
                                Alert.alert(
                                    'Replace All Entries?',
                                    'This will delete all current entries. This action cannot be undone.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Replace', style: 'destructive', onPress: () => handleRestore('replace') }
                                    ]
                                );
                            }}
                        >
                            <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>
                                Replace
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowRestoreModal(false)}
                        >
                            <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>
                                Cancel
                            </Text>
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
        padding: 28,
    },
    section: {
        marginBottom: 48,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 20,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        opacity: 0.5,
    },
    themeSelector: {
        flexDirection: 'row',
        gap: 12,
    },
    themeOption: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1.5,
    },
    themeOptionText: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    actionButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        minHeight: 52,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.5,
        letterSpacing: 0.3,
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        borderRadius: 20,
        padding: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 24,
        letterSpacing: 0.3,
    },
    previewContainer: {
        borderRadius: 12,
        padding: 20,
        marginBottom: 28,
        borderWidth: 1,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    previewLabel: {
        fontSize: 13,
        fontWeight: '500',
        opacity: 0.5,
        letterSpacing: 0.3,
    },
    previewValue: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    modalButton: {
        padding: 18,
        borderRadius: 12,
        marginBottom: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    modalCloseButton: {
        marginTop: 8,
        padding: 14,
        alignItems: 'center',
    },
    modalCloseText: {
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.5,
        letterSpacing: 0.3,
    },
});