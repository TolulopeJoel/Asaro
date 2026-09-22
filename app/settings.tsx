import { THEME_STYLES, useTheme } from '@/src/theme/ThemeContext';
import {
    Card,
    Hero,
    Screen,
    Text as UIText,
} from '@/src/components/ui';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { getAllScheduledNotifications, setupDailyNotifications, sendTestNotification } from '@/src/utils/notifications';
import { exportJournalEntriesToJson, importJournalEntriesFromJson } from '@/src/data/database';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button } from '@/src/components/Button';
import { ScalePressable } from '@/src/components/ScalePressable';
import {
    Bed,
    Bell,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    Sun,
    Moon,
    Smartphone,
    Archive,
    Download,
    Check,
} from 'lucide-react-native';
import { LoadingView } from '@/src/components/LoadingView';
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
    isLockedIn,
}: {
    label: string;
    value?: string;
    onPress: () => void;
    icon: LucideIcon;
    destructive?: boolean;
    showChevron?: boolean;
    colors: any;
    isLockedIn?: boolean;
}) => {
    if (isLockedIn) {
        /*
         * design/all-screens.html #settings, the `.co` slot: the label on the
         * left and its value on the right, and nothing else. No icon chip and
         * no chevron — a list where every row carries both reads as texture
         * rather than as information, and this is the longest list in the app.
         * A value of "On" is the one thing here worth the accent.
         */
        return (
            <ScalePressable
                style={[styles.colossalRow, { borderBottomColor: colors.border }]}
                onPress={onPress}
                accessibilityRole="button"
            >
                <UIText
                    variant="reference"
                    tone={destructive ? 'danger' : 'primary'}
                    style={styles.colossalRowLabel}
                >
                    {label}
                </UIText>
                {value && (
                    <UIText variant="meta" tone={value === 'On' ? 'accent' : 'tertiary'}>{value}</UIText>
                )}
            </ScalePressable>
        );
    }

    return (
        <ScalePressable
            style={[styles.itemContainer, { borderBottomColor: colors.border + '50' }]}
            onPress={onPress}
        >
            <View style={[styles.itemIconWrap, { backgroundColor: destructive ? colors.dangerSurface : colors.backgroundSubtle }]}>
                {React.createElement(icon, { size: 18, color: destructive ? colors.danger : colors.accent, strokeWidth: 2 })}
            </View>
            <View style={styles.itemContent}>
                <UIText variant="body" tone={destructive ? 'danger' : 'primary'}>{label}</UIText>
                {value && <UIText variant="caption">{value}</UIText>}
            </View>
            {showChevron && <ChevronRight size={16} color={colors.textMuted} />}
        </ScalePressable>
    );
};

/**
 * A settings section.
 *
 * The design sets these as an eyebrow over hairline-separated rows on the page
 * ground (`.cl-label` + `.cl-row`), not as a bordered card — Settings is the
 * one screen in the mockup with no panel on it at all. `colors` is still taken
 * so callers need not change; the section itself no longer paints anything.
 */
const SettingsGroup = ({ title, children }: { title: string; children: React.ReactNode; colors?: any }) => (
    <View style={styles.group}>
        <UIText variant="label" style={styles.groupTitle}>{title}</UIText>
        <View style={styles.groupContent}>
            {children}
        </View>
    </View>
);

export default function Settings() {
    const { colors, shape, theme, setTheme, style: themeStyle, setStyle: setThemeStyle, isLockedIn } = useTheme();
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
        AsyncStorage.getItem(STORAGE_KEYS.LAST_BACKUP_DATE).then(val => setLastBackupDate(val));
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
            await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP_DATE, nowIso);
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
        <Screen>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {isLockedIn ? (
                    /*
                     * Settings is the one screen with nothing worth enlarging,
                     * so Colossal uses no colossal element at all — the design's
                     * rule is at most one per screen, never always one.
                     */
                    <View style={styles.colossalTop}>
                        <ScalePressable
                            onPress={() => router.back()}
                            style={styles.colossalBack}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                            hitSlop={Spacing.md}
                        >
                            <ChevronLeft size={20} color={colors.textTertiary} strokeWidth={2} />
                        </ScalePressable>
                        <UIText variant="tab">Settings</UIText>
                    </View>
                ) : (
                    <Hero style={styles.hero}>
                        <View style={styles.headerTitleRow}>
                            <ScalePressable
                                onPress={() => router.back()}
                                style={styles.backButton}
                                accessibilityRole="button"
                                accessibilityLabel="Back"
                            >
                                <ArrowLeft size={22} color={colors.textInverse} />
                            </ScalePressable>
                            <UIText variant="display" tone="inverse" style={{ flex: 1 }}>Engine Room</UIText>
                        </View>
                    </Hero>
                )}

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

                {/* Light / dark / follow the system */}
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

                {/* Cloth or Locked In */}
                <SettingsGroup title="Style" colors={colors}>
                    <View style={styles.styleChoices}>
                        {THEME_STYLES.map(option => {
                            const active = themeStyle === option.key;
                            return (
                                <ScalePressable
                                    key={option.key}
                                    onPress={() => setThemeStyle(option.key)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: active }}
                                    accessibilityLabel={`${option.label}. ${option.blurb}`}
                                    style={[
                                        styles.styleChoice,
                                        {
                                            borderRadius: shape.card,
                                            borderColor: active ? colors.accent : colors.border,
                                            backgroundColor: active ? colors.accent + '12' : 'transparent',
                                        },
                                    ]}
                                >
                                    <View style={styles.styleChoiceText}>
                                        <UIText variant="body" tone={active ? 'accent' : 'primary'}>
                                            {option.label}
                                        </UIText>
                                        <UIText variant="caption">{option.blurb}</UIText>
                                    </View>
                                    <View
                                        style={[
                                            styles.styleChoiceMark,
                                            { borderColor: active ? colors.accent : colors.borderStrong },
                                            active && { backgroundColor: colors.accent },
                                        ]}
                                    >
                                        {active && <Check size={12} color={colors.background} strokeWidth={3} />}
                                    </View>
                                </ScalePressable>
                            );
                        })}
                    </View>
                </SettingsGroup>

                {/* Data Management */}
                <SettingsGroup title={isLockedIn ? 'Your data' : 'Backup & Restore'} colors={colors}>
                    {isLockedIn ? (
                        /*
                         * The mockup names these rather than drawing them as two
                         * unlabelled icon buttons — "Share entries backup" and
                         * "Import entries" are the strings it uses, and on the
                         * longest list in the app a row you can read beats a
                         * glyph you have to recognise.
                         */
                        <>
                            <SettingsItem
                                isLockedIn
                                label="Share entries backup"
                                value={isExporting ? 'Working…' : undefined}
                                icon={Archive}
                                onPress={handleExport}
                                colors={colors}
                            />
                            <SettingsItem
                                isLockedIn
                                label="Import entries"
                                value={isImporting ? 'Working…' : undefined}
                                icon={Download}
                                onPress={handleImport}
                                colors={colors}
                            />
                        </>
                    ) : (
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
                    )}
                    {lastBackupDate ? (
                        <View>
                            <UIText variant="caption" tone="muted" style={styles.lastBackupText}>
                                Last backup: {new Date(lastBackupDate).toLocaleString()}
                            </UIText>
                            {(new Date().getTime() - new Date(lastBackupDate).getTime() > 7 * 24 * 60 * 60 * 1000) && (
                                <UIText style={[styles.lastBackupText, { color: colors.warning, fontStyle: 'italic', marginTop: -8, paddingHorizontal: 20 }]}>
                                    It's been a while since your last backup! If your phone crashes, please don't cry to me
                                </UIText>
                            )}
                        </View>
                    ) : (
                        <UIText style={[styles.lastBackupText, { color: colors.warning, fontStyle: 'italic', paddingHorizontal: 20 }]}>
                            You haven't backed up your data. If you lose everything, please don't cry to me
                        </UIText>
                    )}
                </SettingsGroup>

                {/* Accountability */}
                <SettingsGroup title="Accountability" colors={colors}>
                    <SettingsItem
                        isLockedIn={isLockedIn}
                        label="Sleep Time"
                        value={formatSleepTime(sleepTime)}
                        icon={Bed}
                        onPress={handleUpdateSleepTime}
                        colors={colors}
                    />
                    <UIText style={[styles.lastBackupText, { color: colors.textTertiary, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 }]}>
                        Notifications won't be sent after this time.
                    </UIText>
                </SettingsGroup>

                {/* About */}
                <View style={styles.group}>
                    <UIText variant="caption" tone="secondary" style={styles.groupTitle}>ABOUT</UIText>
                    <TouchableOpacity
                        onPress={handleNotificationTitleTap}
                        activeOpacity={0.7}
                        style={isLockedIn
                            ? [styles.colossalRow, { borderBottomColor: colors.border }]
                            : [styles.row, { paddingHorizontal: 4 }]}
                    >
                        <UIText
                            variant={isLockedIn ? 'reference' : 'subtitle'}
                            style={isLockedIn ? styles.colossalRowLabel : undefined}
                        >
                            Version
                        </UIText>
                        <UIText variant={isLockedIn ? 'meta' : 'body'} tone="tertiary">
                            {Constants.expoConfig?.version || '1.0.0'}
                        </UIText>
                    </TouchableOpacity>
                </View>

                {/* Notifications - Easter Egg */}
                {showNotifications && (
                    <SettingsGroup title="Scheduled Notifications" colors={colors}>
                        <View style={styles.notificationsHeaderRow}>
                            <View style={styles.headerTitleRow}>
                                <Bell size={14} color={colors.accent} />
                                <UIText variant="caption" tone="secondary">
                                    NOTIFICATIONS
                                </UIText>
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
                                <UIText variant="bodySmall" tone="secondary" style={styles.notificationsCount}>
                                    {scheduledNotifications.length} scheduled
                                </UIText>
                                {scheduledNotifications.map((notif, index) => (
                                    <View
                                        key={notif.identifier || index}
                                        style={[styles.notificationItem, {
                                            backgroundColor: colors.cardBackground,
                                            borderColor: colors.cardBorder,
                                        }]}
                                    >
                                        <UIText variant="body">
                                            {notif.content.title}
                                        </UIText>
                                        <UIText variant="bodySmall" tone="secondary">
                                            {notif.content.body}
                                        </UIText>
                                        <UIText variant="caption" style={styles.notificationTime}>
                                            {formatTrigger(notif.trigger)}
                                        </UIText>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <UIText variant="bodySmall" tone="secondary" style={styles.emptyText}>
                                No scheduled notifications
                            </UIText>
                        )}
                    </SettingsGroup>
                )}
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    // ── Colossal ──────────────────────────────────────────────────────────
    colossalTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xl - 2,
    },
    colossalBack: { marginLeft: -6 },
    colossalRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.md,
        paddingVertical: Spacing.md + 3,
        borderBottomWidth: Spacing.border.hairline,
    },
    /** The mockup lightens a settings label: it names a thing, not a heading. */
    colossalRowLabel: { flex: 1, fontWeight: '500' },

    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    hero: {
        marginHorizontal: -Spacing.layout.screenPadding,
        marginTop: -Spacing.layout.screenPadding,
        marginBottom: Spacing.xl,
    },
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