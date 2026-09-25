import { useTheme } from '@/src/theme/ThemeContext';
import {
    Hero,
    Screen,
    Text as UIText,
    ThemedButton,
} from '@/src/components/ui';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { getAllScheduledNotifications, setupDailyNotifications, sendTestNotification, hasNotificationPermissions, openNotificationSettings, getNotificationDiagnostics } from '@/src/utils/notifications';
import { oemAutoStartLabel, openAutoStartSettings } from '@/src/utils/oemRestrictions';
import { exportJournalEntriesToJson, importJournalEntriesFromJson, getFirstEntryDate } from '@/src/data/database';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from '@/src/components/Button';
import { ScalePressable } from '@/src/components/ScalePressable';
import {
    Bed,
    Bell,
    RefreshCw,
    ChevronLeft,
    Archive,
    Download,
} from 'lucide-react-native';
import { getFirestore, doc, setDoc, getDoc, writeBatch, query, where, onSnapshot, collectionGroup } from '@react-native-firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { Avatar } from '@/src/components/Avatar';
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
                    <UIText style={{ fontSize: Typography.size.lg, fontWeight: '700', color: colors.textPrimary }}>{user?.displayName}</UIText>
                    <UIText style={{ fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 1 }}>PRIVILEGED ADMIN</UIText>
                </View>
            </View>

            <View style={{ width: '100%', gap: 8 }}>
                <UIText style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary, letterSpacing: 1 }}>PROFILE PHOTO URL</UIText>
                <TextInput
                    style={{
                        backgroundColor: colors.buttonSecondary,
                        padding: 14,
                        borderRadius: Spacing.borderRadius.lg,
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
                style={{ borderRadius: Spacing.borderRadius.lg }}
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
    colors,
}: {
    label: string;
    value?: string;
    onPress: () => void;
    icon: LucideIcon;
    destructive?: boolean;
    showChevron?: boolean;
    colors: any;
}) => {
    /*
     * design/all-screens.html #settings — the label on the left, its value on
     * the right, and nothing else. No icon chip and no chevron; a list where
     * every row carries both reads as texture rather than as information, and
     * this is the longest list in the app. A value of "On" is the one thing
     * here worth the accent.
     */
    void icon; void showChevron;

    return (
        <ScalePressable
            style={[styles.settingRow, { borderBottomColor: colors.border }]}
            onPress={onPress}
            accessibilityRole="button"
        >
            <UIText
                variant="body"
                tone={destructive ? 'danger' : 'primary'}
                style={styles.settingRowLabel}
            >
                {label}
            </UIText>
            {value && (
                <UIText variant="meta" tone={value === 'On' ? 'accent' : 'secondary'}>{value}</UIText>
            )}
        </ScalePressable>
    );
};

export default function Settings() {
    const { colors } = useTheme();
    const router = useRouter();
    const { showAlert } = useAlert();

    const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [tapCount, setTapCount] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const { user } = useAuth();
    const db = getFirestore();
    const [isAdmin, setIsAdmin] = useState(false);
    const [photoURL, setPhotoURL] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [sleepTime, setSleepTime] = useState<string | null>(null);
    const [lastSleepChangeAt, setLastSleepChangeAt] = useState<string | null>(null);
    const [isUpdatingSleep, setIsUpdatingSleep] = useState(false);
    /*
     * The three things the mockup's Settings rows state that the screen never
     * knew: when you started reading, whether notifications are actually on,
     * and (for admins) whether the photo editor is open under the profile row.
     */
    const [readingSince, setReadingSince] = useState<string | null>(null);
    const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
    const [showPhotoEditor, setShowPhotoEditor] = useState(false);

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
            showAlert({ title: 'Done', message: 'Photo changed.' });
        } catch (error) {
            console.error('Failed to save profile:', error);
            showAlert({ title: 'Error', message: 'Failed to update profile photo' });
        } finally {
            setIsSavingProfile(false);
        }
    }, [user?.uid]);



    useEffect(() => {
        getFirstEntryDate().then(date => {
            if (date) setReadingSince(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
        }).catch(() => { });
        hasNotificationPermissions().then(setNotificationsOn).catch(() => setNotificationsOn(null));
        AsyncStorage.getItem(STORAGE_KEYS.SLEEP_TIME).then(val => setSleepTime(val));
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SLEEP_CHANGE_AT).then(val => setLastSleepChangeAt(val));

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

    /*
     * Six different settings can silence a reminder and they all look the same
     * from the outside. Rather than make someone guess which one their phone
     * turned off, read them all and say so — and on a phone with a vendor
     * auto-start list, offer the door to it, since that is the one the AOSP
     * battery whitelist does not cover.
     */
    const handleDeliveryCheck = async () => {
        try {
            const d = await getNotificationDiagnostics();
            const lines = [
                `Permission: ${d.hasPermission ? 'granted' : 'DENIED'}`,
                `Notification channel: ${d.channelBlocked ? 'BLOCKED — turn "Àṣàrò Reminders" back on in system settings' : 'on'}`,
                `Battery optimisation: ${d.batteryOptimised ? 'ON — this delays reminders' : 'off'}`,
                `Scheduled: ${d.scheduledCount}`,
                `Next: ${d.nextFireAt ? d.nextFireAt.toLocaleString() : 'none'}`,
                `Alarms last set: ${d.lastArmedAt ? d.lastArmedAt.toLocaleString() : 'never'}`,
            ];
            if (d.needsAutoStart) {
                lines.push(`Your phone also has ${oemAutoStartLabel()}, which closes apps behind your back. Àṣàrò must be allowed to auto-start there.`);
            }

            showAlert({
                title: 'Delivery check',
                message: lines.join('\n'),
                buttons: d.needsAutoStart
                    ? [
                        { text: `Open ${oemAutoStartLabel()}`, onPress: () => { openAutoStartSettings(); } },
                        { text: 'Close', style: 'cancel' as const },
                    ]
                    : [{ text: 'Close', style: 'cancel' as const }],
            });
        } catch (error) {
            console.error('Failed to read notification diagnostics:', error);
        }
    };

    const handleForceReschedule = async () => {
        setIsLoadingNotifications(true);
        try {
            // force: the point of this button is to re-register the alarms,
            // which is exactly what a full-looking schedule would skip.
            const success = await setupDailyNotifications(false, { force: true });
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
            await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP_DATE, nowIso);

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
                    message: `Trying to change your sleep time already? That's suspicious. You still have ${daysLeft} days to suffer your current schedule. Àṣàrò sees everything.`
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

                await AsyncStorage.setItem(STORAGE_KEYS.SLEEP_TIME, iso);
                await AsyncStorage.setItem(STORAGE_KEYS.LAST_SLEEP_CHANGE_AT, nowIso);

                setSleepTime(iso);
                setLastSleepChangeAt(nowIso);

                showAlert({ title: 'Success! ✅', message: 'Your sleep time has been locked in for the next month. I\'ve adjusted your notification schedule. Don\'t sleep too much o!' });
                // The slot times are derived from sleep time, so the existing
                // schedule is now wrong and has to be rebuilt outright.
                await setupDailyNotifications(false, { force: true });
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
        <Screen edges={[]}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    /*
                     * clothBody carries its own 24px gutter, so the scroll view
                     * must never add scrollContent's 24 on top: 24 + 24 sat the
                     * screen 48px in from the edge instead of the mockup's 24.
                     */
                    styles.scrollContentNoGutter,
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/*
                     * design/all-screens.html #settings, the `.cl` slot: Cloth
                     * drops to a single header band and puts the profile on it —
                     * the avatar in ochre, the name at 24px, and how long you
                     * have been reading underneath. No screen title: the band
                  * is about you, not about the word "Settings".
                  */}
                <Hero ownsTopInset>
                        <ScalePressable
                            onPress={() => router.back()}
                            style={styles.clothBack}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                            hitSlop={Spacing.md}
                        >
                            <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                        </ScalePressable>
                        <ScalePressable
                            disabled={!isAdmin}
                            onPress={() => setShowPhotoEditor(v => !v)}
                            accessibilityRole={isAdmin ? 'button' : undefined}
                            accessibilityLabel={isAdmin ? 'Edit profile photo' : undefined}
                            style={styles.clothProfile}
                        >
                            <Avatar
                                id={user?.uid}
                                name={user?.displayName || 'Reader'}
                                url={photoURL}
                                size={52}
                                radius={26}
                            />
                            <View style={styles.clothProfileText}>
                                <UIText variant="title" tone="onBand">{user?.displayName || 'Reader'}</UIText>
                                {readingSince && (
                                    <UIText variant="sub" tone="onHero" style={styles.clothProfileSub}>
                                        {`Reading since ${readingSince}`}
                                    </UIText>
                                )}
                            </View>
                        </ScalePressable>
                </Hero>

                {/*
                  * design/all-screens.html #settings.
                  *
                  * Settings is labelled runs of plain rows — Reminders, Your
                  * data, Engine Room, About — with no panel anywhere on the
                  * screen, and no Appearance selector: light/dark has no second
                  * Cloth palette to choose between yet. The profile rides on
                  * the hero band above.
                  */}
                <View style={styles.clothBody}>
                    {/* Admins keep the photo editor; it opens under the profile
                        rather than as a section neither mockup draws. */}
                    {isAdmin && showPhotoEditor && (
                        <ProfilePhotoCard
                            user={user}
                            colors={colors}
                            initialURL={photoURL}
                            onSave={handleSaveProfileURL}
                            isSaving={isSavingProfile}
                        />
                    )}

                    <UIText variant="label" style={styles.clothSectionLabel}>Reminders</UIText>
                    <SettingsItem
                        label="Sleep time"
                        value={formatSleepTime(sleepTime)}
                        icon={Bed}
                        onPress={handleUpdateSleepTime}
                        colors={colors}
                    />
                    <SettingsItem
                        label="Notifications"
                        value={notificationsOn === null ? '—' : notificationsOn ? 'On' : 'Off'}
                        icon={Bell}
                        onPress={openNotificationSettings}
                        colors={colors}
                    />

                    <UIText variant="label" style={styles.clothSectionLabel}>Your data</UIText>
                    <SettingsItem
                        label="Share entries backup"
                        value={isExporting ? 'Working…' : undefined}
                        icon={Archive}
                        onPress={handleExport}
                        colors={colors}
                    />
                    <SettingsItem
                        label="Import entries"
                        value={isImporting ? 'Working…' : undefined}
                        icon={Download}
                        onPress={handleImport}
                        colors={colors}
                    />


                    {/* Both mockups show these plainly rather than behind the
                        five-tap easter egg they used to hide under. */}
                    <UIText variant="label" style={styles.clothSectionLabel}>Engine Room</UIText>
                    <SettingsItem
                        label="Reschedule notifications"
                        value={isLoadingNotifications ? 'Working…' : undefined}
                        icon={RefreshCw}
                        onPress={handleForceReschedule}
                        colors={colors}
                    />
                    <SettingsItem
                        label="Send test notification"
                        icon={Bell}
                        onPress={handleTestNotification}
                        colors={colors}
                    />
                    <SettingsItem
                        label="Why am I not getting reminders?"
                        icon={Bell}
                        onPress={handleDeliveryCheck}
                        colors={colors}
                    />

                    {/*
                      * Version gets its own "About". No rule here — the
                      * mockup never draws `.cl-hr` anywhere on this screen;
                      * only the label's own margin-top:20 (clothSectionLabel)
                      * separates sections.
                      */}
                    <UIText variant="label" style={styles.clothSectionLabel}>About</UIText>
                    <SettingsItem
                        label="Version"
                        value={Constants.expoConfig?.version || '1.0.0'}
                        icon={Bell}
                        onPress={handleNotificationTitleTap}
                        colors={colors}
                    />

                    {showNotifications && scheduledNotifications.length > 0 && (
                        <UIText variant="bodySmall" style={styles.sectionLabel}>
                            {`${scheduledNotifications.length} scheduled`}
                        </UIText>
                    )}
                </View>

            </ScrollView>

            {/*
              * The mockup's footer. Every setting here already
              * persists the moment it changes — there is no pending state to
              * commit — so the button does the only honest thing left and
              * closes the screen.
              */}
            <View style={styles.footer}>
                <ThemedButton label="Save Changes" block onPress={() => router.back()} />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    /** Cloth's band: the arrow hangs into the gutter, the profile sits under it. */
    clothBack: { marginLeft: -6, alignSelf: 'flex-start' },
    clothProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md + 2,
        marginTop: Spacing.md,
    },
    clothProfileText: { flex: 1, minWidth: 0 },
    clothProfileSub: { marginTop: 3 },
    sectionLabel: { marginBottom: 10 },
    /** `.cl-label{margin:20px 0 4px}` */
    clothSectionLabel: { marginTop: 20, marginBottom: 4 },
    /** Cloth's body runs in its own 24px gutter, no top padding of its own —
     *  every .cl-label supplies its own 20px lead-in (clothSectionLabel). */
    clothBody: {
        paddingHorizontal: Spacing.layout.screenPadding,
    },
    footer: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.md + 2,
        paddingBottom: Spacing.layout.tabBarPadding,
    },
    /** `.cl-row{padding:16px 0}` */
    settingRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.md,
        paddingVertical: Spacing.md + 3,
        borderBottomWidth: Spacing.border.hairline,
    },
    /** The mockup lightens a settings label: it names a thing, not a heading. */
    settingRowLabel: { flex: 1, fontWeight: '500' },

    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    /*
     * marginBottom used to sit at Spacing.xl here. Hero applies this style
     * directly to the indigo band View, and ClothStrip renders as the very
     * next sibling — so that margin pushed 24px of ecru between the band and
     * the strip instead of letting them abut, as `.cl-strip` (no margin of
     * its own) assumes.
     */
    backButton: {
        width: Spacing.touchTarget,
        height: Spacing.touchTarget,
        justifyContent: 'center',
    },
    styleChoices: {
        gap: Spacing.sm,
        paddingHorizontal: Spacing.layout.cardPadding,
        paddingVertical: Spacing.md,
    },
    styleChoice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md + 2,
        borderWidth: Spacing.border.hairline,
        minHeight: Spacing.touchTarget + 12,
    },
    styleChoiceText: { flex: 1, gap: 2 },
    styleChoiceMark: {
        width: 20,
        height: 20,
        borderRadius: Spacing.borderRadius.round,
        borderWidth: Spacing.border.strong,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 60,
    },
    /** Cancels scrollContent's gutter — the header/body own it per style. */
    scrollContentNoGutter: {
        paddingHorizontal: 0,
        paddingTop: 0,
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
    title: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
    },
    group: {
        marginBottom: Spacing.xxl,
    },
    groupTitle: { marginBottom: Spacing.md, paddingHorizontal: 4 },
    groupContent: {
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
        borderRadius: Spacing.borderRadius.lg,
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
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        aspectRatio: 1,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        aspectRatio: 1.1,
    },
    buttonGroup: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
    },
    lastBackupText: { textAlign: 'center', paddingBottom: 12 },
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
    notificationsCount: { marginBottom: Spacing.sm },
    notificationItem: {
        padding: Spacing.lg,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        gap: Spacing.xs,
        marginBottom: 12,
    },
    notificationTime: { marginTop: 2 },
    emptyText: { textAlign: 'center', paddingVertical: Spacing.xl },
});