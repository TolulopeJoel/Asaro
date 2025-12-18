import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {
    sendTestNotification,
    getAllScheduledNotifications,
    setupDailyNotifications,
    requestNotificationPermissions,
    cancelAllScheduledNotifications
} from '@/src/utils/notifications';

export default function NotificationDebugger() {
    const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
    const [scheduledCount, setScheduledCount] = useState<number>(0);
    const [isPhysicalDevice, setIsPhysicalDevice] = useState<boolean>(false);
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        // Check if physical device
        setIsPhysicalDevice(Device.isDevice);

        // Check permissions
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);

        // Check scheduled notifications
        const scheduled = await getAllScheduledNotifications();
        setScheduledCount(scheduled.length);
        setNotifications(scheduled);

        console.log('📊 Debug Info:');
        console.log('- Physical Device:', Device.isDevice);
        console.log('- Permission Status:', status);
        console.log('- Scheduled Count:', scheduled.length);
        console.log('- Notifications:', JSON.stringify(scheduled, null, 2));
    };

    const handleRequestPermissions = async () => {
        const granted = await requestNotificationPermissions();
        Alert.alert(
            'Permission Result',
            granted ? 'Permissions granted!' : 'Permissions denied'
        );
        await checkStatus();
    };

    const handleSendTest = async () => {
        await sendTestNotification();
        Alert.alert('Test Sent', 'Check if you received the notification');
    };

    const handleScheduleDaily = async () => {
        await setupDailyNotifications();
        Alert.alert('Scheduled', 'Daily notifications have been set up');
        await checkStatus();
    };

    const handleScheduleInOneMinute = async () => {
        const oneMinuteFromNow = new Date(Date.now() + 60 * 1000);
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Test in 1 minute ⏰",
                body: "If you see this, scheduled notifications work!",
                sound: true,
                priority: Platform.OS === 'android'
                    ? Notifications.AndroidNotificationPriority.HIGH
                    : undefined,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: oneMinuteFromNow,
                channelId: Platform.OS === 'android' ? 'asaro-reminders' : undefined,
            },
        });

        const timeStr = oneMinuteFromNow.toLocaleTimeString();
        Alert.alert(
            'Scheduled for ' + timeStr,
            'Close the app completely and lock your phone. Notification should arrive in 1 minute!'
        );
        await checkStatus();
    };

    const handleScheduleInTwoMinutes = async () => {
        const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000);
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "2 minute test ⏰",
                body: "Background notifications working!",
                sound: true,
                priority: Platform.OS === 'android'
                    ? Notifications.AndroidNotificationPriority.HIGH
                    : undefined,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: twoMinutesFromNow,
                channelId: Platform.OS === 'android' ? 'asaro-reminders' : undefined,
            },
        });

        const timeStr = twoMinutesFromNow.toLocaleTimeString();
        Alert.alert(
            'Scheduled for ' + timeStr,
            'Close app and wait 2 minutes with phone locked!'
        );
        await checkStatus();
    };

    const handleCancelAll = async () => {
        Alert.alert(
            'Cancel All?',
            'This will remove all scheduled notifications',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, Cancel All',
                    style: 'destructive',
                    onPress: async () => {
                        await cancelAllScheduledNotifications();
                        Alert.alert('Cleared', 'All notifications cancelled');
                        await checkStatus();
                    },
                },
            ]
        );
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

    return (
        <ScrollView style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.title}>Notification Debug Info</Text>

                <View style={styles.infoRow}>
                    <Text style={styles.label}>Physical Device:</Text>
                    <Text style={[styles.value, isPhysicalDevice ? styles.good : styles.bad]}>
                        {isPhysicalDevice ? '✅ Yes' : '❌ No (Emulator)'}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.label}>Permission Status:</Text>
                    <Text style={[styles.value, permissionStatus === 'granted' ? styles.good : styles.bad]}>
                        {permissionStatus === 'granted' ? '✅ Granted' : `❌ ${permissionStatus}`}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.label}>Scheduled Notifications:</Text>
                    <Text style={styles.value}>{scheduledCount}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.label}>Platform:</Text>
                    <Text style={styles.value}>{Platform.OS} (API {Platform.Version})</Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.subtitle}>Quick Tests</Text>

                <Button
                    title="1️⃣ Request Permissions"
                    onPress={handleRequestPermissions}
                />

                <View style={styles.spacer} />

                <Button
                    title="2️⃣ Send Test (Immediate)"
                    onPress={handleSendTest}
                    disabled={permissionStatus !== 'granted'}
                    color={permissionStatus !== 'granted' ? '#ccc' : '#007AFF'}
                />

                <View style={styles.spacer} />

                <Button
                    title="3️⃣ Schedule in 1 Minute"
                    onPress={handleScheduleInOneMinute}
                    disabled={permissionStatus !== 'granted'}
                    color={permissionStatus !== 'granted' ? '#ccc' : '#FF9500'}
                />

                <View style={styles.spacer} />

                <Button
                    title="4️⃣ Schedule in 2 Minutes"
                    onPress={handleScheduleInTwoMinutes}
                    disabled={permissionStatus !== 'granted'}
                    color={permissionStatus !== 'granted' ? '#ccc' : '#FF9500'}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.subtitle}>Daily Setup</Text>

                <Button
                    title="Setup All Daily Notifications"
                    onPress={handleScheduleDaily}
                    disabled={permissionStatus !== 'granted'}
                    color={permissionStatus !== 'granted' ? '#ccc' : '#34C759'}
                />

                <View style={styles.spacer} />

                <Button
                    title="Cancel All Notifications"
                    onPress={handleCancelAll}
                    color="#FF3B30"
                />

                <View style={styles.spacer} />

                <Button
                    title="🔄 Refresh Status"
                    onPress={checkStatus}
                />
            </View>

            {notifications.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>
                        Scheduled Notifications ({notifications.length})
                    </Text>
                    {notifications.map((notif, index) => (
                        <View key={notif.identifier || index} style={styles.notifItem}>
                            <Text style={styles.notifTitle}>
                                {index + 1}. {notif.content.title}
                            </Text>
                            <Text style={styles.notifBody}>
                                {notif.content.body}
                            </Text>
                            <Text style={styles.notifTime}>
                                {formatTrigger(notif.trigger)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {notifications.length === 0 && permissionStatus === 'granted' && (
                <View style={styles.section}>
                    <Text style={styles.emptyText}>
                        No scheduled notifications. Tap "Setup All Daily Notifications" to configure them.
                    </Text>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.warningTitle}>⚠️ Testing Checklist:</Text>
                <Text style={styles.warning}>
                    {'\n'}✅ Must be on a PHYSICAL device (not emulator)
                    {'\n'}✅ Permissions must be GRANTED
                    {'\n'}✅ Go to Settings → Apps → Asaro → Battery → "Unrestricted"
                    {'\n'}✅ CLOSE app completely after scheduling
                    {'\n'}✅ LOCK your phone and wait
                    {'\n'}
                    {'\n'}📱 Test Steps:
                    {'\n'}1. Tap "Schedule in 1 Minute"
                    {'\n'}2. Close this app completely
                    {'\n'}3. Lock your phone
                    {'\n'}4. Wait 1 minute
                    {'\n'}5. Notification should appear!
                </Text>
            </View>

            <View style={styles.spacer} />
            <View style={styles.spacer} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    section: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    label: {
        fontSize: 14,
        color: '#666',
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
    },
    good: {
        color: '#4CAF50',
    },
    bad: {
        color: '#F44336',
    },
    spacer: {
        height: 10,
    },
    notifItem: {
        padding: 12,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#8b7355',
    },
    notifTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
        color: '#333',
    },
    notifBody: {
        fontSize: 13,
        color: '#666',
        marginBottom: 6,
    },
    notifTime: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        fontStyle: 'italic',
        padding: 10,
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF9800',
    },
    warning: {
        fontSize: 13,
        color: '#666',
        lineHeight: 22,
    },
});