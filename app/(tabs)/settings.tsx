import { useTheme } from '@/src/theme/ThemeContext';
import { getAllScheduledNotifications } from '@/src/utils/notifications';
import { exportJournalEntriesToJson, importJournalEntriesFromJson } from '@/src/data/database';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { Ionicons } from '@expo/vector-icons';

export default function Settings() {
    const { colors, theme, setTheme } = useTheme();

    const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [tapCount, setTapCount] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const handleNotificationTitleTap = () => {
        const newCount = tapCount + 1;
        setTapCount(newCount);

        if (newCount >= 5) {
            setShowNotifications(true);
            if (!isLoadingNotifications && scheduledNotifications.length === 0) {
                loadScheduledNotifications();
            }
        }
    };

    const loadScheduledNotifications = async () => {
        setIsLoadingNotifications(true);
        try {
            const notifications = await getAllScheduledNotifications();

            // Sort notifications: daily/repeating first, then by date
            const sorted = notifications.sort((a, b) => {
                const aIsDaily = a.trigger && 'hour' in a.trigger && a.trigger.hour !== undefined;
                const bIsDaily = b.trigger && 'hour' in b.trigger && b.trigger.hour !== undefined;

                // If one is daily and the other is date-based, daily comes first
                if (aIsDaily && !bIsDaily) return -1;
                if (!aIsDaily && bIsDaily) return 1;

                // Both are daily - sort by time
                if (aIsDaily && bIsDaily) {
                    const aTime = (a.trigger as any).hour * 60 + (a.trigger as any).minute;
                    const bTime = (b.trigger as any).hour * 60 + (b.trigger as any).minute;
                    return aTime - bTime;
                }

                // Both are date-based - sort by date
                if (a.trigger && 'value' in a.trigger && b.trigger && 'value' in b.trigger) {
                    const aDate = new Date((a.trigger as any).value).getTime();
                    const bDate = new Date((b.trigger as any).value).getTime();
                    return aDate - bDate;
                }

                return 0;
            });

            setScheduledNotifications(sorted);
        } catch (error) {
            console.error('Failed to load scheduled notifications:', error);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    const formatTrigger = (trigger: any) => {
        if (trigger.type === 'date') {
            return new Date(trigger.value).toLocaleString();
        } else if (trigger.hour !== undefined) {
            const hour = trigger.hour.toString().padStart(2, '0');
            const minute = trigger.minute.toString().padStart(2, '0');
            return `Daily at ${hour}:${minute}${trigger.repeats ? ' (Repeating)' : ''}`;
        }
        return JSON.stringify(trigger);
    };

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const json = await exportJournalEntriesToJson();
            const fileName = `journal-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            const uri = `${documentDirectory || ''}${fileName}`;

            await writeAsStringAsync(uri, json);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/json',
                    dialogTitle: 'Share journal backup',
                });
            } else {
                Alert.alert(
                    'Backup created',
                    'Your journal backup has been saved on this device.',
                );
            }
        } catch (error: any) {
            console.error('Failed to export journal entries:', error);
            Alert.alert('Export failed', error?.message || 'Something went wrong while exporting your journal entries.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        if (isImporting) return;

        Alert.alert(
            'Replace existing entries?',
            'Importing a backup will replace all existing journal entries with those from the backup file.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: async () => {
                        setIsImporting(true);
                        try {
                            const result = await DocumentPicker.getDocumentAsync({
                                type: 'application/json',
                                copyToCacheDirectory: true,
                            });

                            if (result.canceled || !result.assets || result.assets.length === 0) {
                                setIsImporting(false);
                                return;
                            }

                            const asset = result.assets[0];
                            const content = await readAsStringAsync(asset.uri);

                            const { imported } = await importJournalEntriesFromJson(content);

                            Alert.alert(
                                'Import complete',
                                `Imported ${imported} journal entries from backup.`,
                            );
                        } catch (error: any) {
                            console.error('Failed to import journal entries:', error);
                            Alert.alert('Import failed', error?.message || 'Something went wrong while importing your backup.');
                        } finally {
                            setIsImporting(false);
                        }
                    },
                },
            ],
        );
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

                {/* Notifications - Easter Egg */}
                {showNotifications && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
                            <TouchableOpacity
                                onPress={loadScheduledNotifications}
                                disabled={isLoadingNotifications}
                                style={styles.refreshButton}
                            >
                                {isLoadingNotifications ? (
                                    <ActivityIndicator color={colors.textSecondary} size="small" />
                                ) : (
                                    <Ionicons name="refresh" size={16} color={colors.textSecondary} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {scheduledNotifications.length > 0 ? (
                            <View style={styles.notificationsList}>
                                <Text style={[styles.notificationsCount, { color: colors.textSecondary }]}>
                                    {scheduledNotifications.length} scheduled
                                </Text>
                                {scheduledNotifications.map((notif, index) => (
                                    <View
                                        key={notif.identifier || index}
                                        style={[styles.notificationItem, {
                                            backgroundColor: colors.cardBackground,
                                            borderColor: colors.border,
                                        }]}
                                    >
                                        <Text style={[styles.notificationTitle, { color: colors.textPrimary }]}>
                                            {notif.content.title}
                                        </Text>
                                        <Text style={[styles.notificationBody, { color: colors.textSecondary }]}>
                                            {notif.content.body}
                                        </Text>
                                        <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
                                            {formatTrigger(notif.trigger)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No scheduled notifications
                            </Text>
                        )}
                    </View>
                )}

                {/* About */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Version</Text>
                        <TouchableOpacity onPress={handleNotificationTitleTap} activeOpacity={0.7}>
                            <Text style={[styles.value, { color: colors.textPrimary }]}>
                                {Constants.expoConfig?.version || '1.0.0'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ height: 16 }} />
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                {
                                    backgroundColor: colors.cardBackground,
                                    borderColor: colors.border,
                                },
                            ]}
                            onPress={handleExport}
                            disabled={isExporting}
                        >
                            {isExporting ? (
                                <ActivityIndicator color={colors.textSecondary} />
                            ) : (
                                <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
                                    Export journal
                                </Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                {
                                    backgroundColor: colors.cardBackground,
                                    borderColor: colors.border,
                                },
                            ]}
                            onPress={handleImport}
                            disabled={isImporting}
                        >
                            {isImporting ? (
                                <ActivityIndicator color={colors.textSecondary} />
                            ) : (
                                <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
                                    Import journal
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
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
    // Notifications
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    refreshButton: {
        padding: 4,
        opacity: 0.5,
    },
    notificationsList: {
        gap: 12,
    },
    notificationsCount: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 8,
        opacity: 0.5,
        letterSpacing: 0.3,
    },
    notificationItem: {
        padding: 16,
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
    },
    notificationTitle: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    notificationBody: {
        fontSize: 12,
        fontWeight: '500',
        opacity: 0.7,
        letterSpacing: 0.2,
    },
    notificationTime: {
        fontSize: 11,
        fontWeight: '500',
        opacity: 0.5,
        letterSpacing: 0.2,
        marginTop: 2,
    },
    emptyText: {
        fontSize: 13,
        fontWeight: '500',
        opacity: 0.5,
        textAlign: 'center',
        paddingVertical: 20,
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