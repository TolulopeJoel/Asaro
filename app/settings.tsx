import { useTheme } from '@/src/theme/ThemeContext';
import {
    Asaro,
    Hero,
    Screen,
    type AsaroHandle,
    Text as UIText,
    ThemedButton,
    textStyle,
} from '@/src/components/ui';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { setupDailyNotifications, hasNotificationPermissions, openBatteryOptimizationSettings, openNotificationSettings, getNotificationDiagnostics, readSleepTime, saveSleepTime, formatSleepTimeValue, parseSleepTime } from '@/src/utils/notifications';
import { oemAutoStartLabel, openAutoStartSettings } from '@/src/utils/oemRestrictions';
import { exportJournalEntriesToJson, importJournalEntriesFromJson, getFirstEntryDate } from '@/src/data/database';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import { setAsaroLook, useAsaroLook } from '@/src/storage/asaroLook';
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
    ChevronLeft,
    Archive,
    Download,
} from 'lucide-react-native';
import { getFirestore, doc, setDoc, getDoc } from '@react-native-firebase/firestore';
import { useMyGroups } from '@/src/groups/hooks';
import { useAuth } from '@/src/context/AuthContext';
import { useFootPadding } from '@/src/hooks/useScreenInsets';
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

// ─── Name Card ───────────────────────────────────────────────────────────────
// Its own component for the same reason as the photo card: the draft lives
// here so typing never re-renders the screen.

const NameCard = ({ initialName, onSave, onCancel }: {
    initialName: string;
    onSave: (name: string) => Promise<void>;
    onCancel: () => void;
}) => {
    const { colors, style: themeStyle } = useTheme();
    const [draft, setDraft] = useState(initialName);
    const [saving, setSaving] = useState(false);
    const canSave = draft.trim().length > 0 && draft.trim() !== initialName && !saving;

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            await onSave(draft);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.nameCard}>
            <UIText variant="label">Your name</UIText>
            <TextInput
                style={[
                    styles.nameInput,
                    textStyle(themeStyle, 'body'),
                    { backgroundColor: colors.backgroundSubtle, borderColor: colors.border, color: colors.textPrimary },
                ]}
                value={draft}
                onChangeText={setDraft}
                autoFocus
                maxLength={40}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="done"
                onSubmitEditing={save}
                accessibilityLabel="Your name"
            />
            <View style={styles.nameActions}>
                <ThemedButton label="Cancel" variant="secondary" onPress={onCancel} style={styles.nameAction} />
                <ThemedButton label="Save name" onPress={save} disabled={!canSave} loading={saving} style={styles.nameAction} />
            </View>
        </View>
    );
};

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
    // design/all-screens.html #settings — label left, value right, nothing
    // else. No icon chip, no chevron: on the app's longest list, rows carrying
    // both read as texture rather than information.
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

/** Shows the face itself: a look is not something to choose by name. */
const AsaroLookRow = ({ colors }: { colors: any }) => {
    const look = useAsaroLook();
    const face = useRef<AsaroHandle>(null);
    const { showAlert } = useAlert();
    const next = look === 'female' ? 'male' : 'female';

    // The current look asks before it hands over.
    const confirmSwitch = () => showAlert({
        face: { look, action: 'sideEye' },
        title: `Wait o. You're a ${next === 'female' ? 'woman' : 'man'}?`,
        message: `Then ${next === 'female' ? 'she' : 'he'} should be the one disturbing you, not me.`,
        buttons: [
            {
                text: 'Yes, I am',
                onPress: () => {
                    void setAsaroLook(next);
                    face.current?.play('wave');
                },
            },
            { text: 'No, stay', style: 'cancel' },
        ],
    });

    return (
        <ScalePressable
            style={[styles.settingRow, styles.asaroRow, { borderBottomColor: colors.border }]}
            onPress={confirmSwitch}
            accessibilityRole="button"
            accessibilityLabel={`Àṣàrò, ${look === 'female' ? 'her' : 'him'}. Switch look.`}
        >
            <UIText variant="body" tone="primary" style={styles.settingRowLabel}>Àṣàrò</UIText>
            <UIText variant="meta" tone="secondary">{look === 'female' ? 'Her' : 'Him'}</UIText>
            <Asaro ref={face} size={52} />
        </ScalePressable>
    );
};

export default function Settings() {
    const { colors } = useTheme();
    const router = useRouter();
    const { showAlert } = useAlert();

    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const { user, displayName, updateName } = useAuth();
    const name = displayName || user?.displayName || 'Reader';
    const footPadding = useFootPadding(60);
    const db = getFirestore();
    // The photo editor is for anyone who runs a group.
    const { rows: groupRows } = useMyGroups();
    const isAdmin = groupRows.some(row => row.myRole === 'creator' || row.myRole === 'admin');
    const [photoURL, setPhotoURL] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [sleepTime, setSleepTime] = useState<string | null>(null);
    const [lastSleepChangeAt, setLastSleepChangeAt] = useState<string | null>(null);
    const [isUpdatingSleep, setIsUpdatingSleep] = useState(false);
    /*
     * The three things the mockup's Settings rows state that the screen never
     * knew: when you started reading, whether notifications are actually on,
     * and whether the name (and, for admins, photo) editor is open under the
     * profile row.
     */
    const [readingSince, setReadingSince] = useState<string | null>(null);
    const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
    const [showProfileEditor, setShowProfileEditor] = useState(false);

    const handleSaveName = useCallback(async (next: string) => {
        try {
            await updateName(next);
            setShowProfileEditor(false);
        } catch (error) {
            console.error('Failed to save name:', error);
            showAlert({ title: 'Couldn\'t save your name', message: 'Check your connection and try again.' });
        }
    }, [updateName, showAlert]);

    const handleSaveProfileURL = useCallback(async (url: string) => {
        if (!user?.uid) return;
        setIsSavingProfile(true);
        try {
            await setDoc(doc(db, 'users', user.uid), { photoURL: url.trim() }, { merge: true });
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
        readSleepTime().then(time => setSleepTime(time ? formatSleepTimeValue(time) : null)).catch(() => { });
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SLEEP_CHANGE_AT).then(val => setLastSleepChangeAt(val));

        if (user?.uid) {
            getDoc(doc(db, 'users', user.uid)).then(docSnap => {
                if (docSnap.exists()) {
                    setPhotoURL(docSnap.data()?.photoURL || '');
                }
            }).catch(() => { });
        }
    }, [user?.uid]);

    // One answer, not a readout: the first thing actually silencing
    // reminders, with the door that fixes it. A vendor auto-start list can't
    // be read back, so on those phones it is the last thing to check.
    const handleDeliveryCheck = async () => {
        const close = { text: 'Close', style: 'cancel' as const };
        try {
            const d = await getNotificationDiagnostics();
            if (!d.hasPermission) {
                showAlert({
                    title: 'Notifications are off',
                    message: 'Àṣàrò isn\'t allowed to send notifications. Turn them on in your phone\'s settings.',
                    buttons: [{ text: 'Open settings', onPress: openNotificationSettings }, close],
                });
                return;
            }
            if (d.channelBlocked) {
                showAlert({
                    title: 'Reminders are muted',
                    message: 'Notifications are on, but "Àṣàrò Reminders" is switched off in your phone\'s settings. Turn it back on there.',
                    buttons: [{ text: 'Open settings', onPress: openNotificationSettings }, close],
                });
                return;
            }
            if (d.batteryOptimised) {
                showAlert({
                    title: 'Battery saver is in the way',
                    message: 'Your phone is holding Àṣàrò back in the background, which delays or drops reminders. Let it run unrestricted.',
                    buttons: [{ text: 'Fix battery setting', onPress: () => { void openBatteryOptimizationSettings(); } }, close],
                });
                return;
            }
            // Nothing blocking, but nothing queued: put the schedule back.
            if (d.scheduledCount === 0) {
                await setupDailyNotifications(false, { force: true });
            }
            if (d.needsAutoStart) {
                showAlert({
                    title: `Check ${oemAutoStartLabel()}`,
                    message: `Everything on Àṣàrò's side looks right. But your phone has ${oemAutoStartLabel()}, which closes apps in the background and stops their reminders. Make sure Àṣàrò is allowed to auto-start there.`,
                    buttons: [{ text: `Open ${oemAutoStartLabel()}`, onPress: () => { openAutoStartSettings(); } }, close],
                });
                return;
            }
            showAlert({
                title: 'Everything looks right',
                message: 'Notifications are on and your reminders are scheduled. If one still doesn\'t arrive, restart your phone and open Àṣàrò once.',
                buttons: [close],
            });
        } catch (error) {
            console.error('Failed to read notification diagnostics:', error);
            showAlert({ title: 'Couldn\'t check', message: 'Something went wrong reading your reminder settings. Try again.', buttons: [close] });
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
                    face: { action: 'laugh' },
                    title: 'Patience o!',
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
                    { text: ':00', onPress: () => confirmSleepTime(h24, 0) },
                    { text: ':15', onPress: () => confirmSleepTime(h24, 15) },
                    { text: ':30', onPress: () => confirmSleepTime(h24, 30) },
                    { text: ':45', onPress: () => confirmSleepTime(h24, 45) },
                ],
                cancelable: true
            });
        };

        // Nothing is saved until this is answered: a slip on the stacked hour
        // buttons would otherwise hold the wrong reminders for a month.
        const confirmSleepTime = (h24: number, min: number) => {
            const label = formatSleepTime(formatSleepTimeValue({ hour: h24, minute: min }));
            showAlert({
                face: { action: 'sideEye' },
                title: `${label}? Sure?`,
                message: 'Your reminders are built around this, and once it is set you cannot change it again for 30 days.',
                buttons: [
                    { text: 'Lock it in', onPress: () => finalizeSleepTimeChange(h24, min) },
                    { text: 'Pick again', onPress: pickHour },
                    { text: 'Cancel', style: 'cancel' },
                ],
                cancelable: true
            });
        };

        const finalizeSleepTimeChange = async (h24: number, min: number) => {
            const time = { hour: h24, minute: min };
            const nowIso = new Date().toISOString();

            try {
                setIsUpdatingSleep(true);

                await saveSleepTime(time);
                await AsyncStorage.setItem(STORAGE_KEYS.LAST_SLEEP_CHANGE_AT, nowIso);

                setSleepTime(formatSleepTimeValue(time));
                setLastSleepChangeAt(nowIso);

                // The slot times are derived from sleep time, so the existing
                // schedule is now wrong and has to be rebuilt outright.
                const adjusted = await setupDailyNotifications(false, { force: true });
                showAlert(adjusted
                    ? { title: 'Success! ✅', message: 'Your sleep time has been locked in for the next month. I\'ve adjusted your notification schedule. Don\'t sleep too much o!' }
                    : { title: 'Saved', message: 'Your sleep time has been locked in for the next month, but I couldn\'t adjust your reminders. Tap "Why am I not getting reminders?" to see what\'s in the way.' });
            } catch (error) {
                console.error('Failed to save sleep time:', error);
                showAlert({ title: 'Error', message: 'Failed to save your new schedule. Please try again.' });
            } finally {
                setIsUpdatingSleep(false);
            }
        };

        function pickHour() {
            showAlert({
                face: { action: 'smug' },
                title: 'Select Sleep Hour',
                message: 'I only allow sleep after 8:00 PM. Anything earlier is just laziness! Choose well: it stays for 30 days.',
                buttons: [
                    { text: '08 PM', onPress: () => pickMinute(20, '08:00 PM') },
                    { text: '09 PM', onPress: () => pickMinute(21, '09:00 PM') },
                    { text: '10 PM', onPress: () => pickMinute(22, '10:00 PM') },
                    { text: '11 PM', onPress: () => pickMinute(23, '11:00 PM') },
                    { text: 'Cancel', style: 'cancel' }
                ],
                cancelable: true
            });
        }

        pickHour();
    };

    const formatSleepTime = (value: string | null) => {
        if (!value) return 'Not set';
        const time = parseSleepTime(value);
        if (!time) return 'Invalid';
        const m = time.minute.toString().padStart(2, '0');
        const p = time.hour >= 12 ? 'PM' : 'AM';
        return `${time.hour % 12 || 12}:${m} ${p}`;
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
                    { paddingBottom: footPadding },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* design/all-screens.html #settings, the `.cl` slot: one
                  * header band carrying the profile — avatar in ochre, name at
                  * 24px, time reading underneath. No screen title: the band is
                  * about you, not about the word "Settings". */}
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
                            onPress={() => setShowProfileEditor(v => !v)}
                            accessibilityRole="button"
                            accessibilityLabel={`${name}. Edit your name${isAdmin ? ' and photo' : ''}`}
                            style={styles.clothProfile}
                        >
                            <Avatar
                                id={user?.uid}
                                name={name}
                                url={photoURL}
                                size={52}
                                radius={26}
                            />
                            <View style={styles.clothProfileText}>
                                <UIText variant="title" tone="onBand">{name}</UIText>
                                {readingSince && (
                                    <UIText variant="sub" tone="onHero" style={styles.clothProfileSub}>
                                        {`Reading since ${readingSince}`}
                                    </UIText>
                                )}
                            </View>
                        </ScalePressable>
                </Hero>

                {/* design/all-screens.html #settings: labelled runs of plain
                  * rows — Reminders, Your data, About — with no
                  * panel anywhere, and no Appearance selector until there is a
                  * second Cloth palette to choose between. */}
                <View style={styles.clothBody}>
                    {/* The profile editors open under the band rather than as a
                        section the mockup never draws. */}
                    {showProfileEditor && (
                        <NameCard
                            initialName={displayName || user?.displayName || ''}
                            onSave={handleSaveName}
                            onCancel={() => setShowProfileEditor(false)}
                        />
                    )}
                    {isAdmin && showProfileEditor && (
                        <ProfilePhotoCard
                            user={user}
                            colors={colors}
                            initialURL={photoURL}
                            onSave={handleSaveProfileURL}
                            isSaving={isSavingProfile}
                        />
                    )}

                    {/* Who you are talking to, before what they do for you. */}
                    <UIText variant="label" style={styles.clothSectionLabel}>Àṣàrò</UIText>
                    <AsaroLookRow colors={colors} />

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
                    <SettingsItem
                        label="Why am I not getting reminders?"
                        icon={Bell}
                        onPress={handleDeliveryCheck}
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

                    {/* A line at the foot, not an About section of one row. */}
                    <UIText variant="caption" tone="secondary" style={styles.version}>
                        {`Àṣàrò ${Constants.expoConfig?.version || '1.0.0'}`}
                    </UIText>
                </View>

            </ScrollView>
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
    nameCard: { gap: Spacing.sm, paddingTop: 20 },
    /** `.cl-input{padding:12px 14px; border:1px solid var(--hair)}` */
    nameInput: {
        borderWidth: Spacing.border.hairline,
        paddingHorizontal: 14,
        paddingVertical: Spacing.md,
    },
    nameActions: { flexDirection: 'row', gap: Spacing.sm },
    nameAction: { flex: 1 },
    /** `.cl-label{margin:20px 0 4px}` */
    clothSectionLabel: { marginTop: 20, marginBottom: 4 },
    /** Cloth's body runs in its own 24px gutter, no top padding of its own —
     *  every .cl-label supplies its own 20px lead-in (clothSectionLabel). */
    clothBody: {
        paddingHorizontal: Spacing.layout.screenPadding,
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
    /** The face sets the row's height, so centre rather than baseline-align. */
    asaroRow: { alignItems: 'center', paddingVertical: Spacing.sm },
    version: { textAlign: 'center', marginTop: Spacing.xxl },

    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    // No marginBottom: Hero applies this style directly to the indigo band and
    // ClothStrip is its next sibling, so any margin here pushes ecru between
    // the two instead of letting them abut as `.cl-strip` assumes.
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