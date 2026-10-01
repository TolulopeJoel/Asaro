import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { APP_PACKAGE } from './appPackage';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND_ACCENT } from '../theme/colors';
import { withDatabase } from '../data/db';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { detectOemFamily, needsOemAutoStartStep } from './oemRestrictions';
import { unwrapReferences } from './reference';

export const REMINDER_CHANNEL_ID = 'asaro-reminders';

/** Days with every slot; after them, one Evening reminder a day until DATE_HORIZON_DAYS. */
const FULL_DAYS = 7;
const DATE_HORIZON_DAYS = 28;

const DAILY_ID_PREFIX = 'daily-';
const STUDY_ID_PREFIX = 'study-';
const STUDY_TITLE = 'Remember this one?';
/** What study reminders were titled before; ones already scheduled still carry it. */
const OLD_STUDY_TITLE = '📖 Study Reminder';

/** One reminder per topic. The `t` keeps a topic id from colliding with the entry ids reminders used before. */
const studyReminderId = (topicId: number) => `${STUDY_ID_PREFIX}t${topicId}`;
const studyReminderBody = (topic: string) => `You said you’d study it: ${unwrapReferences(topic)}. Today’s the day.`;

// Every schedule change runs through this chain, one at a time, so none is dropped or interleaved.
let scheduleQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = scheduleQueue.then(task);
  scheduleQueue = run.catch(() => undefined);
  return run;
}

/*
 * Why the schedule is re-armed on every launch.
 *
 * expo-notifications keeps two separate things: a record of each scheduled
 * notification in SharedPreferences, and the AlarmManager alarm that fires it.
 * `getAllScheduledNotificationsAsync` reads only the RECORDS. The two come
 * apart on any OS force-stop — routine on Transsion (Tecno/Infinix/itel) and
 * every vendor in oemRestrictions.ts — where Android cancels the alarms and
 * leaves the records untouched.
 *
 * So never trust a full-looking schedule as proof the alarms exist: after one
 * force-stop the schedule still reads full with nothing behind it, and the
 * reminders stop for good.
 *
 * A force-stop always means the next run is a cold start, so re-arming once
 * per process launch recovers it cheaply. `hasArmedThisLaunch` is module state
 * and false on every cold start; ARM_MAX_AGE_MS covers a resident session.
 */
let hasArmedThisLaunch = false;

const DAY_MS = 24 * 60 * 60 * 1000;
const ARM_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** When the alarms behind the schedule were last actually registered. */
const NOTIF_LAST_ARMED_AT = 'notif_last_armed_at';

/**
 * The reminder day whose reminders were deliberately dropped because the user had
 * already journalled. Every rebuild honours it unless told `includeToday`.
 */
const NOTIF_SKIP_DAY = 'notif_skip_day';

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// ─── Sleep time ──────────────────────────────────────────────────────────────

export interface SleepTime { hour: number; minute: number }

const SLEEP_TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
const DEFAULT_SLEEP_TIME: SleepTime = { hour: 22, minute: 0 };

/** Reads "HH:MM", and the full ISO date older versions stored. */
export function parseSleepTime(raw: string | null | undefined): SleepTime | null {
  if (!raw) return null;
  const hhmm = raw.match(SLEEP_TIME_PATTERN);
  if (hhmm) {
    const hour = Number(hhmm[1]);
    const minute = Number(hhmm[2]);
    return hour < 24 && minute < 60 ? { hour, minute } : null;
  }
  const legacy = new Date(raw);
  return Number.isNaN(legacy.getTime()) ? null : { hour: legacy.getHours(), minute: legacy.getMinutes() };
}

export function formatSleepTimeValue({ hour, minute }: SleepTime): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export async function saveSleepTime(time: SleepTime): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SLEEP_TIME, formatSleepTimeValue(time));
}

/** The stored sleep time, rewriting an old ISO value as "HH:MM" on the way. */
export async function readSleepTime(): Promise<SleepTime | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.SLEEP_TIME);
  const time = parseSleepTime(raw);
  if (time && raw && !SLEEP_TIME_PATTERN.test(raw)) {
    await saveSleepTime(time).catch(error => console.error('Failed to migrate sleep time:', error));
  }
  return time;
}

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Helper: Create notification content configuration
function createNotificationContent(title: string, body: string) {
  return {
    title,
    body,
    sound: true,
    priority: Platform.OS === 'android'
      ? Notifications.AndroidNotificationPriority.HIGH
      : undefined,
    data: { timestamp: Date.now() },
  };
}

// Initialize notification channel (Android only) - call this once on app start
export async function initializeNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Àṣàrò Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: BRAND_ACCENT,
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
      });
    } catch (error) {
      console.error('Failed to initialize notification channel:', error);
    }
  }
}

// Check if notification permissions are granted (no UI, just status check)
export async function hasNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  const { status, granted } = await Notifications.getPermissionsAsync();

  // On Android 13+, we also need to check for POST_NOTIFICATIONS specifically if status is not granted
  if (status === 'granted' || granted) {
    return true;
  }

  return false;
}

// Check if battery optimization is disabled for the app
export async function isBatteryOptimizationDisabled(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS doesn't have this concept
  }

  try {
    const batteryOptimizationEnabled = await Battery.isBatteryOptimizationEnabledAsync();
    // If battery optimization is enabled, it means restrictions ARE active (bad for us)
    // We want it to be disabled (false) so our app can run unrestricted
    return !batteryOptimizationEnabled;
  } catch {
    // An unreadable state must not hold the app behind the battery gate.
    return true;
  }
}

/** Under this, the request screen closed itself without asking anything. */
const SILENT_CLOSE_MS = 600;

/** Ask Android to exempt the app from battery optimisation, falling back to the general list. */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    Linking.openSettings();
    return;
  }
  const openList = async () => {
    try {
      await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    } catch {
      Linking.openSettings();
    }
  };
  try {
    const opened = Date.now();
    await IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', {
      data: `package:${APP_PACKAGE}`,
    });
    // Some vendor skins close the request screen at once without asking; send them to the list.
    if (Date.now() - opened < SILENT_CLOSE_MS && !(await isBatteryOptimizationDisabled())) {
      await openList();
    }
  } catch {
    await openList();
  }
}

// Request notification permissions with user interaction
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {

    return false;
  }

  // Check current status first
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  // Already granted, return immediately
  if (existingStatus === 'granted') {
    return true;
  }

  // Request permission
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== 'granted') {
    return false;
  }

  return true;
}

// Open notification settings page for the app
export async function openNotificationSettings() {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
        {
          extra: { 'android.provider.extra.APP_PACKAGE': APP_PACKAGE }
        }
      );
    } catch {

      Linking.openSettings();
    }
  } else {
    Linking.openURL('app-settings:');
  }
}



function scheduleStudyReminder(reminder: StudyReminder): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    identifier: studyReminderId(reminder.topicId),
    content: {
      ...createNotificationContent(STUDY_TITLE, studyReminderBody(reminder.topic)),
      data: { timestamp: Date.now(), kind: 'study', entryId: reminder.entryId, topicId: reminder.topicId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminder.at,
      channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
    },
  });
}

/**
 * Make the scheduled study reminders match the journal: one for each open topic with a
 * reminder still ahead, nothing else. Leaves everything alone if the journal can't be read.
 */
async function armStudyReminders(scheduled: Notifications.NotificationRequest[], now: Date): Promise<void> {
  const due = await dueStudyReminders(now);
  if (!due) return;
  const wanted = new Set(due.map(r => studyReminderId(r.topicId)));
  for (const request of scheduled) {
    if (isStudyRequest(request) && !wanted.has(request.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
  for (const reminder of due) await scheduleStudyReminder(reminder);
}

/** Call after anything that changes topics: saving or deleting an entry, ticking a topic off. */
export function syncStudyReminders(): Promise<void> {
  return enqueue(async () => {
    try {
      if (!await hasNotificationPermissions()) return;
      await armStudyReminders(await getAllScheduledNotifications(), new Date());
    } catch (error) {
      console.error('Failed to sync study reminders:', error);
    }
  });
}

/*
 * Notification messages by slot. The first fires at 11:59 — see `middayMin`.
 * If a slot's time ever moves, EVERY line in its array has to move with it:
 * copy that greets the morning reads badly at lunchtime and nothing catches it.
 */
/** A nag. `nth` marks a line that counts Àṣàrò's visits: it goes out only as that day's nth reminder. */
type Reminder = { title: string; body: string; nth?: number };

const middayReminders: Reminder[] = [
  { title: "Good afternoon o", body: "Àṣàrò here. You haven't read your Bible yet? Ehn ehn, we're starting like this?" },
  { title: "Afternoon check", body: "I'm not asking you, I'm telling you — open that Bible now" },
  { title: "Half the day gone", body: "So the whole morning passed and the Bible didn't enter? Interesting" },
  { title: "Midday check", body: "Jehovah is waiting. You know I don't joke with these things" },
  { title: "Afternoon reminder", body: "I'm here before the afternoon has even started. Don't make me come back. Just read it" },
  { title: "Àṣàrò checking in", body: "I've been watching you all morning. Where's your Bible?" },
  { title: "Same story", body: "New day, same excuses? Please, let's not do this" },
  { title: "First warning", body: "You think I forgot? I never forget. Go and read that Bible" },
];

const eveningReminders: Reminder[] = [
  { title: "Evening o", body: "The whole day has passed and you still haven't read? What's going on?" },
  { title: "Àṣàrò is asking", body: "So we're playing hide and seek with the Bible today? I don't have energy to hide o" },
  { title: "Serious question", body: "If you were asked what you read today, what would you say?" },
  { title: "Evening check", body: "I've been patient since morning. My patience is running out o 😌" },
  { title: "Reality check", body: "You're scrolling on your phone but you can't read your Bible? Make it make sense" },
  { title: "Not impressed", body: "Àṣàrò is very disappointed. But there's still time to fix it" },
  { title: "Evening tap", body: "Don't make me come back here again. You know how I can be 👀" },
  { title: "Just so you know", body: "I'm keeping absolute record. Every single day you miss, I'm writing it down" },
];

const lateReminders: Reminder[] = [
  { title: "Àṣàrò again", body: "You thought I was joking? Here I am again. Open that Bible right now" },
  { title: "Late warning", body: "Everybody has closed for the day. Me, I'm still here waiting for you o" },
  { title: "Not playing", body: "This your stubbornness ehn. Just 15 minutes of reading, is it too much?" },
  { title: "Getting serious", body: "I've come three times today. Don't test me o 😂", nth: 3 },
  { title: "Persistence mode", body: "You think if you ignore me I'll disappear? You don't know me o 😂😂😂" },
  { title: "Accountability time", body: "So we made a commitment and now you're forming busy abi? Please open your Bible" },
  { title: "No excuses", body: "Tired? Busy? Stressed? Jehovah has time for you. Balance it out" },
  { title: "Late check", body: "The day is almost over and you want to sleep like this? Oh, wow" },
];

const finalReminders: Reminder[] = [
  { title: "Final warning", body: "This is the last time I'm asking nicely. Tomorrow I'm coming earlier 😅" },
  { title: "Midnight call", body: "You really want to sleep without reading? You're a strong person o" },
  { title: "Last chance", body: "Àṣàrò doesn't give up. If you sleep now, just know I tried my best" },
  { title: "Bedtime", body: "Fifteen minutes. That is all I have been asking for since morning. Okay o, we'll see tomorrow" },
  { title: "Serious now", body: "I'm not joking anymore. Your spiritual life needs this. Please read" },
  { title: "Almost done", body: "You've ignored me all day. Fine. But remember I care, that's why I disturb" },
  { title: "Àṣàrò's plea", body: "I'm begging you with all my heart — just open that Bible before you sleep" },
  { title: "Goodnight", body: "Okay, sleep. But know that tomorrow, I'm not taking it easy on you at all 😌" },
];

function getRandomReminder(reminders: Reminder[]) {
  return reminders[Math.floor(Math.random() * reminders.length)];
}

interface Slot {
  /** Minutes after the reminder day's midnight; past 1440 for a slot after midnight. */
  totalMin: number;
  reminders: Reminder[];
  name: string;
}

// The single slot of the safety-net days: a fixed time, and copy that doesn't claim to be the last of several.
const SAFETY_NET_SLOT: Slot = { totalMin: 17 * 60 + 30, reminders: eveningReminders, name: 'Evening' };

/**
 * Slot times from the user's sleep time. An AM sleep time is after midnight, so
 * its day runs until then (`dayStartMin`) and the slots before it stay on that day.
 */
async function getDynamicNotificationTimes(): Promise<{ slots: Slot[]; dayStartMin: number }> {
  let sleep = DEFAULT_SLEEP_TIME;
  try {
    sleep = (await readSleepTime()) ?? DEFAULT_SLEEP_TIME;
  } catch (e) {
    console.error('[getDynamicNotificationTimes] Error reading sleep time:', e);
  }
  return slotsFor(sleep);
}

function slotsFor(sleep: SleepTime): { slots: Slot[]; dayStartMin: number } {
  const afterMidnight = sleep.hour < 12;
  const sleepMin = sleep.hour * 60 + sleep.minute + (afterMidnight ? 24 * 60 : 0);

  const rawSlots: Slot[] = [
    { totalMin: 11 * 60 + 59, reminders: middayReminders, name: 'Midday' },
    { totalMin: 17 * 60 + 30, reminders: eveningReminders, name: 'Evening' },
    { totalMin: sleepMin - 3 * 60, reminders: lateReminders, name: 'Late' },
    { totalMin: sleepMin - 60, reminders: finalReminders, name: 'Final' },
  ];

  // Keep slots at least 60 minutes apart, preferring later ones (Final > Late > Evening > Midday).
  const slots: Slot[] = [];
  for (const slot of rawSlots.sort((a, b) => b.totalMin - a.totalMin)) {
    if (!slots.some(s => Math.abs(s.totalMin - slot.totalMin) < 60)) slots.push(slot);
  }

  return {
    slots: slots.sort((a, b) => a.totalMin - b.totalMin),
    dayStartMin: afterMidnight ? sleep.hour * 60 + sleep.minute : 0,
  };
}

/** A full day's reminder times for a sleep time, as minutes after midnight: what onboarding shows. */
export function reminderTimesFor(sleep: SleepTime): { name: string; totalMin: number }[] {
  return slotsFor(sleep).slots.map(({ name, totalMin }) => ({ name, totalMin }));
}

/** Minutes after midnight as a 12-hour clock, e.g. "7:00 PM". */
export function clockLabel(totalMin: number): string {
  const m = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** One real line per slot, gentle to theatrical, for the notification ask. None carries emoji: the face is on screen. */
export const PREVIEW_REMINDERS = [middayReminders[0], eveningReminders[1], lateReminders[1], finalReminders[2]];

function triggerTime(request: Notifications.NotificationRequest): Date | null {
  const trigger = request.trigger as any;
  const value = trigger && typeof trigger === 'object' ? (trigger.date || trigger.value) : null;
  return value ? new Date(value) : null;
}

/** A daily nag, including ones scheduled before daily reminders had their own identifiers. */
function isDailyRequest(request: Notifications.NotificationRequest): boolean {
  if (request.identifier.startsWith(DAILY_ID_PREFIX)) return true;
  if (request.identifier.startsWith(STUDY_ID_PREFIX)) return false;
  const data = (request.content.data ?? {}) as Record<string, unknown>;
  return request.content.categoryIdentifier === 'reminder' || data.timeSlot !== undefined;
}

/** A study reminder, including ones keyed by entry or by a random identifier from before topics. */
function isStudyRequest(request: Notifications.NotificationRequest): boolean {
  if (request.identifier.startsWith(STUDY_ID_PREFIX)) return true;
  const title = request.content.title;
  return !isDailyRequest(request) && (title === STUDY_TITLE || title === OLD_STUDY_TITLE);
}

type StudyReminder = { topicId: number; entryId: number; at: Date; topic: string };

/** Future study reminders the journal still asks for, or null if it can't be read. */
async function dueStudyReminders(now: Date): Promise<StudyReminder[] | null> {
  try {
    const rows = await withDatabase(database => database.getAllAsync<{
      id: number; entry_id: number; topic: string; reminder: string;
    }>(
      `SELECT id, entry_id, topic, reminder FROM study_items
       WHERE reminder IS NOT NULL AND reminder != '' AND completed = 0 AND TRIM(topic) != ''`
    ));
    return rows
      .map(row => ({ topicId: row.id, entryId: row.entry_id, at: new Date(row.reminder), topic: row.topic }))
      .filter(row => row.at.getTime() > now.getTime());
  } catch (error) {
    console.error('Failed to read study reminders:', error);
    return null;
  }
}

/** Whether an entry was written since `since`. False if the journal can't be read. */
async function journalledSince(since: Date): Promise<boolean> {
  try {
    const row = await withDatabase(database => database.getFirstAsync(
      `SELECT 1 FROM journal_entries WHERE datetime(created_at) >= datetime(?) LIMIT 1`,
      [since.toISOString()]
    ));
    return !!row;
  } catch (error) {
    console.error('Failed to check today\'s entries:', error);
    return false;
  }
}

export interface SetupNotificationsOptions {
  /** Rebuild even when the schedule looks full. */
  force?: boolean;
  /** Schedule the rest of today even though the user already journalled today. */
  includeToday?: boolean;
}

/**
 * Rebuild the daily reminders: every slot for FULL_DAYS days, then the Evening
 * slot alone to DATE_HORIZON_DAYS, so a lapsed reader still hears from Àṣàrò.
 * Study reminders are kept, and re-armed from the journal. Serialised with every
 * other schedule change. `startFromTomorrow` marks today as done.
 */
export function setupDailyNotifications(
  startFromTomorrow: boolean = false,
  options: SetupNotificationsOptions = {}
): Promise<boolean> {
  return enqueue(() => rebuildSchedule(startFromTomorrow, options));
}

async function rebuildSchedule(startFromTomorrow: boolean, options: SetupNotificationsOptions): Promise<boolean> {
  if (!await hasNotificationPermissions()) {
    return false;
  }

  try {
    const now = new Date();
    const scheduled = await getAllScheduledNotifications();
    const daily = scheduled.filter(isDailyRequest);

    // A full-looking schedule is trustworthy only if this process armed it —
    // see the note at the top. Everything else rebuilds, which is the only way
    // to find out whether the alarms are still there.
    const mustArm = options.force || !hasArmedThisLaunch || startFromTomorrow;
    const furthest = Math.max(0, ...daily.map(r => triggerTime(r)?.getTime() ?? 0));
    const looksFull = furthest >= now.getTime() + (DATE_HORIZON_DAYS - FULL_DAYS) * DAY_MS;

    if (!mustArm && looksFull) {
      return true;
    }

    const { slots, dayStartMin } = await getDynamicNotificationTimes();

    // The reminder day `now` falls in, which starts at dayStartMin past midnight.
    const dayOf = new Date(now.getTime() - dayStartMin * 60_000);
    const today = new Date(dayOf.getFullYear(), dayOf.getMonth(), dayOf.getDate());
    const todayKey = localDayKey(today);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, dayStartMin);

    /*
     * Writing today's entry only ends today. When this launch armed a full
     * schedule, the days after it are still right: drop what is left of
     * today rather than cancelling and re-placing four weeks one call at a time.
     */
    if (startFromTomorrow && !options.force && hasArmedThisLaunch && looksFull) {
      const todayPrefix = `${DAILY_ID_PREFIX}${todayKey}-`;
      for (const request of daily) {
        if (request.identifier.startsWith(todayPrefix)) {
          await Notifications.cancelScheduledNotificationAsync(request.identifier);
        }
      }
      await AsyncStorage.setItem(NOTIF_SKIP_DAY, todayKey);
      return true;
    }

    const skipToday = startFromTomorrow || (!options.includeToday && (
      await AsyncStorage.getItem(NOTIF_SKIP_DAY) === todayKey || await journalledSince(todayStart)
    ));

    for (const request of daily) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }

    const startOffset = skipToday ? 1 : 0;
    for (let dayOffset = startOffset; dayOffset < DATE_HORIZON_DAYS; dayOffset++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset);
      const daySlots = dayOffset < startOffset + FULL_DAYS ? slots : [SAFETY_NET_SLOT];

      for (const [index, slot] of daySlots.entries()) {
        const scheduledTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, slot.totalMin);
        if (scheduledTime <= now) {
          continue;
        }

        const reminder = getRandomReminder(slot.reminders.filter(r => r.nth === undefined || r.nth === index + 1));

        await Notifications.scheduleNotificationAsync({
          identifier: `${DAILY_ID_PREFIX}${localDayKey(date)}-${slot.name}`,
          content: {
            ...createNotificationContent(reminder.title, reminder.body),
            categoryIdentifier: 'reminder',
            data: {
              timestamp: Date.now(),
              kind: 'daily',
              scheduledFor: scheduledTime.toISOString(),
              timeSlot: slot.name,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: scheduledTime,
            channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
          },
        });
      }
    }

    // A force-stop takes study alarms too.
    await armStudyReminders(scheduled, now);

    hasArmedThisLaunch = true;
    await AsyncStorage.setItem(NOTIF_LAST_ARMED_AT, String(Date.now()));
    if (skipToday) {
      await AsyncStorage.setItem(NOTIF_SKIP_DAY, todayKey);
    } else {
      await AsyncStorage.removeItem(NOTIF_SKIP_DAY);
    }

    return true;
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return false;
  }
}

/**
 * Put the schedule back if the OS took it away. Safe on every launch and every
 * return to the foreground — the repair path for a force-stop.
 *
 * Rebuilds at most once per process launch, and once more if a resident session
 * passes `ARM_MAX_AGE_MS`. A day whose reminders were dropped because the user
 * had already journalled stays dropped.
 */
export async function ensureNotificationsArmed(): Promise<void> {
  if (!await hasNotificationPermissions()) {
    return;
  }

  try {
    const lastArmedAt = Number(await AsyncStorage.getItem(NOTIF_LAST_ARMED_AT)) || 0;
    const isStale = Date.now() - lastArmedAt > ARM_MAX_AGE_MS;

    await setupDailyNotifications(false, { force: isStale });
  } catch (error) {
    console.error('Error re-arming notifications:', error);
  }
}

/**
 * Everything that decides whether a reminder can reach the user, in one read.
 * Each can be false alone and produce the same symptom — silence — so Settings
 * shows them rather than making the user guess which one it is.
 */
export async function getNotificationDiagnostics(): Promise<{
  hasPermission: boolean;
  channelBlocked: boolean;
  batteryOptimised: boolean;
  oemFamily: string;
  needsAutoStart: boolean;
  scheduledCount: number;
  nextFireAt: Date | null;
  lastArmedAt: Date | null;
}> {
  const [hasPermission, batteryOk, scheduled, lastArmedRaw] = await Promise.all([
    hasNotificationPermissions(),
    isBatteryOptimizationDisabled(),
    getAllScheduledNotifications(),
    AsyncStorage.getItem(NOTIF_LAST_ARMED_AT),
  ]);

  // A vendor cleaner can set a channel's importance to NONE behind the app's
  // back. Android refuses to let an app raise importance on an existing
  // channel, so this can only be reported — the user must fix it in settings.
  let channelBlocked = false;
  if (Platform.OS === 'android') {
    try {
      const channel = await Notifications.getNotificationChannelAsync(REMINDER_CHANNEL_ID);
      channelBlocked = !channel || channel.importance === Notifications.AndroidImportance.NONE;
    } catch {
      channelBlocked = false;
    }
  }

  const now = Date.now();
  let nextFireAt: Date | null = null;
  for (const request of scheduled) {
    const trigger = request.trigger as any;
    const value = trigger && typeof trigger === 'object' ? (trigger.date || trigger.value) : null;
    if (!value) continue;
    const at = new Date(value);
    if (at.getTime() > now && (!nextFireAt || at < nextFireAt)) nextFireAt = at;
  }

  return {
    hasPermission,
    channelBlocked,
    batteryOptimised: !batteryOk,
    oemFamily: detectOemFamily(),
    needsAutoStart: needsOemAutoStartStep(),
    scheduledCount: scheduled.length,
    nextFireAt,
    lastArmedAt: Number(lastArmedRaw) ? new Date(Number(lastArmedRaw)) : null,
  };
}

export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

