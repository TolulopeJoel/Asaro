import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { getAllScheduledNotifications, setupDailyNotifications, sendTestNotification } from '@/src/utils/notifications';
import { exportJournalEntriesToJson, importJournalEntriesFromJson } from '@/src/data/database';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/Button';
import { ScalePressable } from '@/src/components/ScalePressable';
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

    const handleTestNotification = async () => {
        try {
            await sendTestNotification();
        } catch (error) {
            console.error('Failed to send test notification:', error);
            Alert.alert('Error', 'Failed to send test notification.');
        }
    };

    const handleForceReschedule = async () => {
        setIsLoadingNotifications(true);
        try {
            const success = await setupDailyNotifications(false);
            if (success) {
                await loadScheduledNotifications();
                Alert.alert('Success', 'Notifications have been rescheduled.');
            } else {
                Alert.alert('Error', 'Failed to reschedule notifications.');
            }
        } catch (error) {
            console.error('Failed to reschedule notifications:', error);
        } finally {
            setIsLoadingNotifications(false);
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

            const { imported, skipped } = await importJournalEntriesFromJson(content);

            Alert.alert(
                'Import complete',
                skipped > 0
                    ? `Imported ${imported} new entries. Skipped ${skipped} duplicates.`
                    : `Imported ${imported} entries from backup.`,
            );
        } catch (error: any) {
            console.error('Failed to import entries:', error);
            Alert.alert('Import failed', error?.message || 'Something went wrong while importing your backup.');
        } finally {
            setIsImporting(false);
        }
    };

    const SettingsItem = ({
        label,
        value,
        onPress,
        icon,
        destructive,
        showChevron = true
    }: {
        label: string;
        value?: string;
        onPress: () => void;
        icon: React.ComponentProps<typeof Ionicons>['name'];
        destructive?: boolean;
        showChevron?: boolean;
    }) => (
        <ScalePressable
            style={[styles.itemContainer, { borderBottomColor: colors.border + '50' }]}
            onPress={onPress}
        >
            <View style={[styles.itemIconWrap, { backgroundColor: destructive ? '#FF3B3010' : colors.accent + '10' }]}>
                <Ionicons name={icon} size={18} color={destructive ? '#FF3B30' : colors.accent} />
            </View>
            <View style={styles.itemContent}>
                <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>{label}</Text>
                {value && <Text style={[styles.itemValue, { color: colors.textTertiary }]}>{value}</Text>}
            </View>
            {showChevron && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
        </ScalePressable>
    );

    const SettingsGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
            <View style={[styles.groupContent, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                {children}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Stack.Screen options={{ title: 'Settings' }} />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Engine Room</Text>
                    </View>
                </View>

                {/* Appearance */}
                <SettingsGroup title="Appearance">
                    <View style={styles.themeSelector}>
                        {(['light', 'dark', 'system'] as const).map((mode) => (
                            <ScalePressable
                                key={mode}
                                onPress={() => setTheme(mode)}
                                style={[
                                    styles.themeOption,
                                    { backgroundColor: theme === mode ? colors.accent : colors.buttonSecondary },
                                    { borderColor: theme === mode ? 'transparent' : colors.buttonSecondaryBorder }
                                ]}
                            >
                                <Ionicons
                                    name={mode === 'light' ? 'sunny' : mode === 'dark' ? 'moon' : 'phone-portrait'}
                                    size={20}
                                    color={theme === mode ? colors.background : colors.textSecondary}
                                />
                            </ScalePressable>
                        ))}
                    </View>
                </SettingsGroup>

                {/* Data Management */}
                <SettingsGroup title="Backup & Restore">
                    <View style={styles.buttonGroup}>
                        <ScalePressable
                            onPress={handleExport}
                            disabled={isExporting}
                            style={[styles.actionButton, { backgroundColor: colors.buttonSecondary, borderColor: colors.buttonSecondaryBorder }]}
                        >
                            {isExporting ? <ActivityIndicator size="small" color={colors.textSecondary} /> : <Ionicons name="download" size={20} color={colors.textSecondary} />}
                        </ScalePressable>
                        <ScalePressable
                            onPress={handleImport}
                            disabled={isImporting}
                            style={[styles.actionButton, { backgroundColor: colors.buttonSecondary, borderColor: colors.buttonSecondaryBorder }]}
                        >
                            {isImporting ? <ActivityIndicator size="small" color={colors.textSecondary} /> : <Ionicons name="cloud-upload" size={20} color={colors.textSecondary} />}
                        </ScalePressable>
                    </View>
                </SettingsGroup>

                {/* About */}
                <View style={styles.group}>
                    <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>ABOUT</Text>
                    <View style={[styles.row, { paddingHorizontal: 4 }]}>
                        <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>Version</Text>
                        <TouchableOpacity onPress={handleNotificationTitleTap} activeOpacity={0.7}>
                            <Text style={[styles.itemValue, { color: colors.textTertiary }]}>
                                {Constants.expoConfig?.version || '1.0.0'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Notifications - Easter Egg */}
                {showNotifications && (
                    <SettingsGroup title="Scheduled Notifications">
                        <View style={styles.notificationsHeaderRow}>
                            <View style={styles.headerTitleRow}>
                                <Ionicons name="notifications" size={14} color={colors.accent} />
                                <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                                    NOTIFICATIONS
                                </Text>
                            </View>
                            <View style={styles.headerActions}>
                                <Button
                                    variant="ghost"
                                    onPress={handleTestNotification}
                                    disabled={isLoadingNotifications}
                                    icon="notifications-outline"
                                    size="sm"
                                />
                                <Button
                                    variant="ghost"
                                    onPress={handleForceReschedule}
                                    disabled={isLoadingNotifications}
                                    loading={isLoadingNotifications}
                                    icon="refresh"
                                    size="sm"
                                />
                            </View>
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
                    </SettingsGroup>
                )}
            </ScrollView>
        </SafeAreaView >
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
        paddingBottom: 60,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    headerTitle: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
    },
    group: {
        marginBottom: Spacing.xxl,
    },
    groupTitle: {
        fontSize: 10,
        fontWeight: '800',
        marginBottom: Spacing.md,
        letterSpacing: 1.5,
        paddingHorizontal: 4,
    },
    groupContent: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    itemIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginRight: 8,
    },
    itemLabel: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    itemValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    themeSelector: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
    },
    themeOption: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: 1,
        aspectRatio: 1,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: 1,
        aspectRatio: 1,
    },
    buttonGroup: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
    },
    notificationsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 4,
    },
    // Notifications styles
    notificationsList: {
        gap: Spacing.md,
        padding: 16,
    },
    notificationsCount: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        marginBottom: Spacing.sm,
        letterSpacing: 0.3,
    },
    notificationItem: {
        padding: Spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        gap: Spacing.xs,
        marginBottom: 12,
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