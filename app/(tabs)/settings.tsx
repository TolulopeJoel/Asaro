import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
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
                    <View style={{ height: Spacing.lg }} />
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
        padding: Spacing.xxl + Spacing.xs,
    },
    section: {
        marginBottom: Spacing.xxxl,
    },
    sectionTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.semibold,
        marginBottom: Spacing.lg + Spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: Typography.letterSpacing.wider + 0.5,
        opacity: 0.5,
    },
    themeSelector: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    themeOption: {
        flex: 1,
        paddingVertical: Spacing.md + 2,
        alignItems: 'center',
        borderRadius: Spacing.borderRadius.md - 2,
        borderWidth: 1.5,
    },
    themeOptionText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.normal,
    },
    actionButton: {
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xxl,
        borderRadius: Spacing.borderRadius.md - 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        minHeight: 52,
    },
    actionButtonText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.normal,
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    label: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        opacity: 0.5,
        letterSpacing: Typography.letterSpacing.normal,
    },
    value: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.normal,
    },
    // Notifications
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg + Spacing.xs,
    },
    refreshButton: {
        padding: Spacing.xs,
        opacity: 0.5,
    },
    notificationsList: {
        gap: Spacing.md,
    },
    notificationsCount: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        marginBottom: Spacing.sm,
        opacity: 0.5,
        letterSpacing: Typography.letterSpacing.normal,
    },
    notificationItem: {
        padding: Spacing.lg,
        borderRadius: Spacing.borderRadius.md - 2,
        borderWidth: 1,
        gap: Spacing.xs + 2,
    },
    notificationTitle: {
        fontSize: Typography.size.sm + 1,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.normal,
    },
    notificationBody: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        opacity: 0.7,
        letterSpacing: Typography.letterSpacing.normal,
    },
    notificationTime: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
        opacity: 0.5,
        letterSpacing: Typography.letterSpacing.normal,
        marginTop: 2,
    },
    emptyText: {
        fontSize: Typography.size.sm + 1,
        fontWeight: Typography.weight.medium,
        opacity: 0.5,
        textAlign: 'center',
        paddingVertical: Spacing.lg + Spacing.xs,
        letterSpacing: Typography.letterSpacing.normal,
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