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

                if (aIsDaily && !bIsDaily) return -1;
                if (!aIsDaily && bIsDaily) return 1;

                if (aIsDaily && bIsDaily) {
                    const aTime = (a.trigger as any).hour * 60 + (a.trigger as any).minute;
                    const bTime = (b.trigger as any).hour * 60 + (b.trigger as any).minute;
                    return aTime - bTime;
                }

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
            const fileName = `asaro-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            const uri = `${documentDirectory || ''}${fileName}`;

            await writeAsStringAsync(uri, json);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/json',
                    dialogTitle: 'Share entries backup',
                });
            } else {
                Alert.alert(
                    'Backup created',
                    'Your entries backup has been saved on this device.',
                );
            }
        } catch (error: any) {
            console.error('Failed to export entries:', error);
            Alert.alert('Export failed', error?.message || 'Something went wrong while exporting your entries.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        if (isImporting) return;

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
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Stack.Screen options={{ title: 'Settings' }} />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
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
                                        backgroundColor: theme === mode ? colors.accent : colors.cardBackground,
                                        borderColor: theme === mode ? colors.accent : colors.cardBorder,
                                    }
                                ]}
                                onPress={() => setTheme(mode)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={
                                        mode === 'light' ? 'sunny' :
                                            mode === 'dark' ? 'moon' :
                                                'phone-portrait'
                                    }
                                    size={24}
                                    color={theme === mode ? colors.buttonPrimaryText : colors.textSecondary}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Backup & Restore */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Backup & Restore</Text>
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                {
                                    backgroundColor: colors.cardBackground,
                                    borderColor: colors.cardBorder,
                                },
                            ]}
                            onPress={handleExport}
                            disabled={isExporting}
                            activeOpacity={0.7}
                        >
                            {isExporting ? (
                                <ActivityIndicator color={colors.accent} />
                            ) : (
                                <Ionicons name="download" size={24} color={colors.accent} />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                {
                                    backgroundColor: colors.cardBackground,
                                    borderColor: colors.cardBorder,
                                },
                            ]}
                            onPress={handleImport}
                            disabled={isImporting}
                            activeOpacity={0.7}
                        >
                            {isImporting ? (
                                <ActivityIndicator color={colors.accent} />
                            ) : (
                                <Ionicons name="cloud-upload" size={24} color={colors.accent} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

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
                                            borderColor: colors.cardBorder,
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
    },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: Spacing.xxxl,
    },
    section: {
        marginBottom: Spacing.xxxl,
    },
    sectionTitle: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.semibold,
        marginBottom: Spacing.lg,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    refreshButton: {
        padding: Spacing.xs,
    },
    themeSelector: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    themeOption: {
        flex: 1,
        paddingVertical: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        aspectRatio: 1,
    },
    actionButton: {
        flex: 1,
        paddingVertical: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        aspectRatio: 1,
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
        letterSpacing: 0.2,
    },
    value: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.2,
    },
    // Notifications
    notificationsList: {
        gap: Spacing.md,
    },
    notificationsCount: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        marginBottom: Spacing.sm,
        letterSpacing: 0.3,
    },
    notificationItem: {
        padding: Spacing.lg,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        gap: Spacing.xs,
    },
    notificationTitle: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.2,
    },
    notificationBody: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.regular,
        letterSpacing: 0.2,
    },
    notificationTime: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
        letterSpacing: 0.2,
        marginTop: 2,
    },
    emptyText: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        textAlign: 'center',
        paddingVertical: Spacing.xl,
        letterSpacing: 0.2,
    },
});