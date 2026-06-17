import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { getAllScheduledNotifications, setupDailyNotifications, sendTestNotification } from '@/src/utils/notifications';
import { exportJournalEntriesToJson, importJournalEntriesFromJson } from '@/src/data/database';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/Button';
import { ScalePressable } from '@/src/components/ScalePressable';
import {
    Bed,
    Bell,
    RefreshCw,
    ChevronRight,
    ArrowLeft,
    Sun,
    Moon,
    Smartphone,
    Archive,
    Download,
    Settings as SettingsIcon,
    X
} from 'lucide-react-native';
import { LoadingView } from '@/src/components/LoadingView';
import { getFirestore, collection, doc, setDoc, getDoc, writeBatch, query, where, onSnapshot, collectionGroup } from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { Avatar } from './(tabs)/groups/[id]';
import { TextInput } from 'react-native';
import React from 'react';

// ─── Profile Photo Card ──────────────────────────────────────────────────────
// Isolated in its own component so typing the URL doesn't re-render the whole
// Settings screen (which would dismiss the keyboard on every keystroke).

const ProfilePhotoCard = React.memo(({
    user, colors, initialURL, onSave, isSaving,
}: {
    user: any; colors: any; initialURL: string;
    onSave: (url: string) => void; isSaving: boolean;
}) => {
    const [draft, setDraft] = useState(initialURL);

    // Keep draft in sync if the stored URL changes (e.g. first load)
    useEffect(() => { setDraft(initialURL); }, [initialURL]);

    return (
        <View style={{ padding: 20, alignItems: 'center', gap: 20 }}>
            <View style={{ alignItems: 'center', gap: 10 }}>
                <Avatar id={user?.uid} name={user?.displayName || 'User'} url={draft} size={80} radius={24} />
                <View style={{ alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>{user?.displayName}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent, letterSpacing: 1 }}>PRIVILEGED ADMIN</Text>
                </View>
            </View>

            <View style={{ width: '100%', gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 1 }}>PROFILE PHOTO URL</Text>
                <TextInput
                    style={{
                        backgroundColor: colors.buttonSecondary,
                        padding: 14,
                        borderRadius: 14,
                        color: colors.textPrimary,
                        fontSize: 14,
                        borderWidth: 1,
                        borderColor: colors.buttonSecondaryBorder,
                    }}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Paste a photo link here"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                />
            </View>

            <Button
                label={isSaving ? 'Saving...' : 'Save Changes'}
                onPress={() => onSave(draft)}
                disabled={isSaving}
                loading={isSaving}
                variant="primary"
                fullWidth
                size="md"
                style={{ borderRadius: 14 }}
            />
        </View>
    );
});

import { LucideIcon } from 'lucide-react-native';

const SettingsItem = ({
    label,
    value,
    onPress,
    icon,
    destructive,
    showChevron = true,
    colors
}: {
    label: string;
    value?: string;
    onPress: () => void;
    icon: LucideIcon;
    destructive?: boolean;
    showChevron?: boolean;
    colors: any;
}) => (
    <ScalePressable
        style={[styles.itemContainer, { borderBottomColor: colors.border + '50' }]}
        onPress={onPress}
    >
        <View style={[styles.itemIconWrap, { backgroundColor: destructive ? '#FF3B3010' : colors.accent + '10' }]}>
            {React.createElement(icon, { size: 18, color: destructive ? '#FF3B30' : colors.accent, strokeWidth: 2 })}
        </View>
        <View style={styles.itemContent}>
            <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>{label}</Text>
            {value && <Text style={[styles.itemValue, { color: colors.textTertiary }]}>{value}</Text>}
        </View>
        {showChevron && <ChevronRight size={16} color={colors.textMuted} />}
    </ScalePressable>
);

const SettingsGroup = ({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) => (
    <View style={styles.group}>
        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
        <View style={[styles.groupContent, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            {children}
        </View>
    </View>
);

export default function Settings() {
    const { colors, theme, setTheme } = useTheme();
    const router = useRouter();
    const { showAlert } = useAlert();

    const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [tapCount, setTapCount] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const { user } = useAuth();
    const db = getFirestore();
    const [isAdmin, setIsAdmin] = useState(false);
    const [photoURL, setPhotoURL] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [sleepTime, setSleepTime] = useState<string | null>(null);
    const [lastSleepChangeAt, setLastSleepChangeAt] = useState<string | null>(null);
    const [isUpdatingSleep, setIsUpdatingSleep] = useState(false);

    const handleSaveProfileURL = useCallback(async (url: string) => {
        if (!user?.uid) return;
        setIsSavingProfile(true);
        try {
            await setDoc(doc(db, 'users', user.uid), { photoURL: url.trim() }, { merge: true });
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const groupIds = userDoc.data()?.groupIds || [];
                if (groupIds.length > 0) {
                    const batch = writeBatch(db);
                    groupIds.forEach((groupId: string) => {
                        batch.set(
                            doc(db, 'groups', groupId, 'members', user.uid),
                            { photoURL: url.trim() }, { merge: true }
                        );
                    });
                    await batch.commit();
                }
            }
            setPhotoURL(url.trim());
            showAlert({ title: 'Success', message: 'Profile photo updated successfully' });
        } catch (error) {
            console.error('Failed to save profile:', error);
            showAlert({ title: 'Error', message: 'Failed to update profile photo' });
        } finally {
            setIsSavingProfile(false);
        }
    }, [user?.uid]);



    useEffect(() => {
        AsyncStorage.getItem('lastBackupDate').then(val => setLastBackupDate(val));
        AsyncStorage.getItem('sleep_time').then(val => setSleepTime(val));
        AsyncStorage.getItem('last_sleep_change_at').then(val => setLastSleepChangeAt(val));

        if (user?.uid) {
            // Check if user is an admin in any group
            const q = query(
                collectionGroup(db, 'members'),
                where('userId', '==', user.uid),
                where('role', '==', 'admin')
            );
            const unsubscribe = onSnapshot(q, snapshot => {
                setIsAdmin(!snapshot.empty);
            });

            // Fetch current user's photoURL
            getDoc(doc(db, 'users', user.uid)).then(docSnap => {
                if (docSnap.exists()) {
                    setPhotoURL(docSnap.data()?.photoURL || '');
                }
            });

            return () => unsubscribe();
        }
    }, [user?.uid]);

    const handleSaveProfile = async () => {
        if (!user?.uid) return;
        setIsSavingProfile(true);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                photoURL: photoURL.trim()
            }, { merge: true });

            // Update all groups the user is part of
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const groupIds = userDoc.data()?.groupIds || [];
                if (groupIds.length > 0) {
                    const batch = writeBatch(db);
                    groupIds.forEach((groupId: string) => {
                        const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
                        batch.set(memberRef, { photoURL: photoURL.trim() }, { merge: true });
                    });
                    await batch.commit();
                }
            }

            showAlert({ title: 'Success', message: 'Profile photo updated successfully' });
        } catch (error) {
            console.error('Failed to save profile:', error);
            showAlert({ title: 'Error', message: 'Failed to update profile photo' });
        } finally {
            setIsSavingProfile(false);
        }
    };

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
            showAlert({ title: 'Error', message: 'Failed to send test notification.' });
        }
    };

    const handleForceReschedule = async () => {
        setIsLoadingNotifications(true);
        try {
            const success = await setupDailyNotifications(false);
            if (success) {
                await loadScheduledNotifications();
                showAlert({ title: 'Success', message: 'Notifications have been rescheduled.' });
            } else {
                showAlert({ title: 'Error', message: 'Failed to reschedule notifications.' });
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
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.getHours().toString().padStart(2, '0') + '-' + now.getMinutes().toString().padStart(2, '0');
            const fileName = `AsaroBackup_${dateStr}_${timeStr}.json`;
            const uri = `${documentDirectory || ''}${fileName}`;

            await writeAsStringAsync(uri, json);

            const nowIso = now.toISOString();
            await AsyncStorage.setItem('lastBackupDate', nowIso);
            setLastBackupDate(nowIso);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/json',
                    dialogTitle: 'Share entries backup',
                });
            } else {
                showAlert({
                    title: 'Backup created',
                    message: 'Your entries backup has been saved on this device.',
                });
            }
        } catch (error: any) {
            console.error('Failed to export entries:', error);
            showAlert({ title: 'Export failed', message: error?.message || 'Something went wrong while exporting your entries.' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleUpdateSleepTime = async () => {
        if (isUpdatingSleep) return;

        // Check 30-day limit
        if (lastSleepChangeAt) {
            const lastChange = new Date(lastSleepChangeAt);
            const now = new Date();
            const diffDays = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays < 30) {
                const daysLeft = Math.ceil(30 - diffDays);
                showAlert({
                    title: 'Patience o! ✋',
                    message: `Trying to change your sleep time already? That's suspicious 🤨. You still have ${daysLeft} days to suffer your current schedule. Àṣàrò sees everything! 😉`
                });
                return;
            }
        }

        const pickMinute = (h24: number, hourLabel: string) => {
            showAlert({
                title: `Select Minute for ${hourLabel}`,
                message: 'Àṣàrò is waiting...',
                buttons: [
                    { text: ':00', onPress: () => finalizeSleepTimeChange(h24, 0) },
                    { text: ':15', onPress: () => finalizeSleepTimeChange(h24, 15) },
                    { text: ':30', onPress: () => finalizeSleepTimeChange(h24, 30) },
                    { text: ':45', onPress: () => finalizeSleepTimeChange(h24, 45) },
                ],
                cancelable: true
            });
        };

        const finalizeSleepTimeChange = async (h24: number, min: number) => {
            const now = new Date();
            const sleepDate = new Date(now);
            sleepDate.setHours(h24, min, 0, 0);

            try {
                setIsUpdatingSleep(true);
                const iso = sleepDate.toISOString();
                const nowIso = now.toISOString();

                await AsyncStorage.setItem('sleep_time', iso);
                await AsyncStorage.setItem('last_sleep_change_at', nowIso);

                setSleepTime(iso);
                setLastSleepChangeAt(nowIso);

                showAlert({ title: 'Success! ✅', message: 'Your sleep time has been locked in for the next month. I\'ve adjusted your notification schedule. Don\'t sleep too much o!' });
                await setupDailyNotifications(false);
            } catch (error) {
                console.error('Failed to save sleep time:', error);
                showAlert({ title: 'Error', message: 'Failed to save your new schedule. Please try again.' });
            } finally {
                setIsUpdatingSleep(false);
            }
        };

        showAlert({
            title: 'Select Sleep Hour',
            message: 'I only allow sleep after 8:00 PM. Anything earlier is just laziness! 😌',
            buttons: [
                { text: '08 PM', onPress: () => pickMinute(20, '08:00 PM') },
                { text: '09 PM', onPress: () => pickMinute(21, '09:00 PM') },
                { text: '10 PM', onPress: () => pickMinute(22, '10:00 PM') },
                { text: '11 PM', onPress: () => pickMinute(23, '11:00 PM') },
                { text: 'Cancel', style: 'cancel' }
            ],
            cancelable: true
        });
    };

    const formatSleepTime = (iso: string | null) => {
        if (!iso) return 'Not set';
        try {
            const date = new Date(iso);
            let h = date.getHours();
            const m = date.getMinutes().toString().padStart(2, '0');
            const p = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${p}`;
        } catch {
            return 'Invalid';
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

            const { importedEntries, skippedEntries, importedReadingItems, skippedReadingItems } =
                await importJournalEntriesFromJson(content);

            const entryMsg = skippedEntries > 0
                ? `${importedEntries} new entries (${skippedEntries} duplicates skipped)`
                : `${importedEntries} entries`;
            const readingMsg = importedReadingItems > 0 || skippedReadingItems > 0
                ? `\n${importedReadingItems} reading items (${skippedReadingItems} duplicates skipped)`
                : '';

            showAlert({ title: 'Import complete', message: `Imported ${entryMsg}.${readingMsg}` });
        } catch (error: any) {
            console.error('Failed to import entries:', error);
            showAlert({ title: 'Import failed', message: error?.message || 'Something went wrong while importing your backup.' });
        } finally {
            setIsImporting(false);
        }
    };


    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <ScalePressable onPress={() => router.back()} style={{ marginRight: 8 }}>
                            <ArrowLeft size={24} color={colors.textPrimary} />
                        </ScalePressable>
                        <Text style={[styles.title, { color: colors.textPrimary, flex: 1 }]}>Engine Room</Text>
                    </View>
                </View>

                {/* Profile Section for Admins */}
                {isAdmin && (
                    <SettingsGroup title="Profile" colors={colors}>
                        <ProfilePhotoCard
                            user={user}
                            colors={colors}
                            initialURL={photoURL}
                            onSave={handleSaveProfileURL}
                            isSaving={isSavingProfile}
                        />
                    </SettingsGroup>
                )}

                {/* Appearance */}
                <SettingsGroup title="Appearance" colors={colors}>
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
                                {React.createElement(
                                    mode === 'light' ? Sun : mode === 'dark' ? Moon : Smartphone,
                                    {
                                        size: 20,
                                        color: theme === mode ? colors.background : colors.textSecondary
                                    }
                                )}
                            </ScalePressable>
                        ))}
                    </View>
                </SettingsGroup>

                {/* Data Management */}
                <SettingsGroup title="Backup & Restore" colors={colors}>
                    <View style={styles.buttonGroup}>
                        <ScalePressable
                            onPress={handleExport}
                            disabled={isExporting}
                            style={[styles.actionButton, { backgroundColor: colors.buttonSecondary, borderColor: colors.buttonSecondaryBorder }]}
                        >
                            {isExporting ? <LoadingView size={20} /> : <Archive size={20} color={colors.textSecondary} />}
                        </ScalePressable>
                        <ScalePressable
                            onPress={handleImport}
                            disabled={isImporting}
                            style={[styles.actionButton, { backgroundColor: colors.buttonSecondary, borderColor: colors.buttonSecondaryBorder }]}
                        >
                            {isImporting ? <LoadingView size={20} /> : <Download size={20} color={colors.textSecondary} />}
                        </ScalePressable>
                    </View>
                    {lastBackupDate ? (
                        <View>
                            <Text style={[styles.lastBackupText, { color: colors.textMuted }]}>
                                Last backup: {new Date(lastBackupDate).toLocaleString()}
                            </Text>
                            {(new Date().getTime() - new Date(lastBackupDate).getTime() > 7 * 24 * 60 * 60 * 1000) && (
                                <Text style={[styles.lastBackupText, { color: colors.accentSecondary || '#E67E22', fontStyle: 'italic', marginTop: -8, paddingHorizontal: 20 }]}>
                                    It's been a while since your last backup! If your phone crashes, please don't cry to me
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text style={[styles.lastBackupText, { color: colors.accentSecondary || '#E67E22', fontStyle: 'italic', paddingHorizontal: 20 }]}>
                            You haven't backed up your data. If you lose everything, please don't cry to me
                        </Text>
                    )}
                </SettingsGroup>

                {/* Accountability */}
                <SettingsGroup title="Accountability" colors={colors}>
                    <SettingsItem
                        label="Sleep Time"
                        value={formatSleepTime(sleepTime)}
                        icon={Bed}
                        onPress={handleUpdateSleepTime}
                        colors={colors}
                    />
                    <Text style={[styles.lastBackupText, { color: colors.textTertiary, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 }]}>
                        Notifications won't be sent after this time.
                    </Text>
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
                    <SettingsGroup title="Scheduled Notifications" colors={colors}>
                        <View style={styles.notificationsHeaderRow}>
                            <View style={styles.headerTitleRow}>
                                <Bell size={14} color={colors.accent} />
                                <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                                    NOTIFICATIONS
                                </Text>
                            </View>
                            <View style={styles.headerActions}>
                                <Button
                                    variant="ghost"
                                    onPress={handleTestNotification}
                                    disabled={isLoadingNotifications}
                                    icon={Bell}
                                    size="sm"
                                />
                                <Button
                                    variant="ghost"
                                    onPress={handleForceReschedule}
                                    disabled={isLoadingNotifications}
                                    loading={isLoadingNotifications}
                                    icon={RefreshCw}
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
        aspectRatio: 1.1,
    },
    buttonGroup: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
    },
    lastBackupText: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
        paddingBottom: 12,
        letterSpacing: 0.2,
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