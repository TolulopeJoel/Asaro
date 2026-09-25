import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND_ACCENT } from '../theme/colors';
import { detectOemFamily, needsOemAutoStartStep } from './oemRestrictions';

let isScheduling = false;

/*
 * Why the schedule has to be re-armed on every launch.
 *
 * expo-notifications keeps two separate things: a record of each scheduled
 * notification in SharedPreferences, and an actual AlarmManager alarm that
 * fires it. `getAllScheduledNotificationsAsync` reads the records — it never
 * looks at AlarmManager. The two come apart whenever the OS force-stops us,
 * which on Transsion (Tecno/Infinix/itel) and every other vendor listed in
 * oemRestrictions.ts is routine: Android cancels the alarms, the records stay
 * behind untouched.
 *
 * `setupDailyNotifications` used to read those records, count twelve future
 * ones and return early, satisfied. After the first force-stop that count is
 * still twelve and the alarms behind it are all gone, so every later launch
 * looked at a full schedule and re-armed nothing. The reminders stopped for
 * good, and no amount of reopening the app — or tapping Reschedule in
 * Settings, which took the same early return — brought them back.
 *
 * A force-stop always means the next run is a cold start, so re-arming once
 * per process launch is both sufficient to recover and cheap (a few dozen
 * alarm registrations). `hasArmedThisLaunch` is module state and therefore
 * false on every cold start; ARM_MAX_AGE_MS covers the other direction, a
 * session left resident for days.
 */
let hasArmedThisLaunch = false;

const ARM_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** When the alarms behind the schedule were last actually registered. */
const NOTIF_LAST_ARMED_AT = 'notif_last_armed_at';

/**
 * The local date whose reminders were deliberately dropped because the user had
 * already journalled. Re-arming has to preserve that, or a repair would put
 * today's nagging back after they'd earned the silence.
 */
const NOTIF_SKIP_DAY = 'notif_skip_day';

function localDayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
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
      await Notifications.setNotificationChannelAsync('asaro-reminders', {
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

    // If we can't check, assume it's not configured properly
    return false;
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
    const pkg = 'com.asaro.meditation';

    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
        {
          extra: { 'android.provider.extra.APP_PACKAGE': pkg }
        }
      );
    } catch {

      Linking.openSettings();
    }
  } else {
    Linking.openURL('app-settings:');
  }
}



export async function scheduleReminderNotification(
  time: Date,
  title: string = '📖 Time to Reflect',
  body: string = 'Take a moment to journal your thoughts.'
): Promise<string | null> {
  // Check permissions without requesting
  if (!await hasNotificationPermissions()) {

    return null;
  }

  return await Notifications.scheduleNotificationAsync({
    content: createNotificationContent(title, body),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: time,
      channelId: Platform.OS === 'android' ? 'asaro-reminders' : undefined,
    },
  });
}

/*
 * Notification messages by slot.
 *
 * The first slot fires at 11:59 — see `middayMin` below — and the name here
 * matters more than it looks. It used to be called `morning`, and when the
 * time moved to just-before-noon only three of these eight lines were
 * rewritten; the rest went on greeting people with "Rise and shine" and "since
 * you woke up" at lunchtime for as long as that mismatch stood. If the slot
 * ever moves again, every line in its array has to move with it.
 */
const middayReminders = [
  { title: "Good afternoon o", body: "Àṣàrò here. You haven't read your Bible yet? Ehn ehn, we're starting like this?" },
  { title: "Afternoon check", body: "I'm not asking you, I'm telling you — open that Bible now" },
  { title: "Half the day gone", body: "So the whole morning passed and the Bible didn't enter? Interesting" },
  { title: "Midday check", body: "Jehovah is waiting. You know I don't joke with these things" },
  { title: "Afternoon reminder", body: "I'm here before the afternoon has even started. Don't make me come back. Just read it" },
  { title: "Àṣàrò checking in", body: "I've been watching you all morning. Where's your Bible?" },
  { title: "Same story", body: "New day, same excuses? Please, let's not do this" },
  { title: "First warning", body: "You think I forgot? I never forget. Go and read that Bible" },
];

const eveningReminders = [
  { title: "Evening o", body: "The whole day has passed and you still haven't read? What's going on?" },
  { title: "Àṣàrò is asking", body: "So we're playing hide and seek with the Bible today? I don't have energy to hide o" },
  { title: "Serious question", body: "If you were asked what you read today, what would you say?" },
  { title: "Evening check", body: "I've been patient since morning. My patience is running out o 😌" },
  { title: "Reality check", body: "You're scrolling on your phone but you can't read your Bible? Make it make sense" },
  { title: "Not impressed", body: "Àṣàrò is very disappointed. But there's still time to fix it" },
  { title: "Evening tap", body: "Don't make me come back here again. You know how I can be 👀" },
  { title: "Just so you know", body: "I'm keeping absolute record. Every single day you miss, I'm writing it down" },
];

const lateReminders = [
  { title: "Àṣàrò again", body: "You thought I was joking? Here I am again. Open that Bible right now" },
  { title: "Late warning", body: "Everybody has closed for the day. Me, I'm still here waiting for you o" },
  { title: "Not playing", body: "This your stubbornness ehn. Just 15 minutes of reading, is it too much?" },
  { title: "Getting serious", body: "I've come three times today. Don't test me o 😂" },
  { title: "Persistence mode", body: "You think if you ignore me I'll disappear? You don't know me o 😂😂😂" },
  { title: "Accountability time", body: "So we made a commitment and now you're forming busy abi? Please open your Bible" },
  { title: "No excuses", body: "Tired? Busy? Stressed? Jehovah has time for you. Balance it out" },
  { title: "Late check", body: "The day is almost over and you want to sleep like this? Oh, wow" },
];

const finalReminders = [
  { title: "Final warning", body: "This is the last time I'm asking nicely. Tomorrow I'm coming earlier 😅" },
  { title: "Midnight call", body: "You really want to sleep without reading? You're a strong person o" },
  { title: "Last chance", body: "Àṣàrò doesn't give up. If you sleep now, just know I tried my best" },
  { title: "Bedtime", body: "Fifteen minutes. That is all I have been asking for since morning. Okay o, we'll see tomorrow" },
  { title: "Serious now", body: "I'm not joking anymore. Your spiritual life needs this. Please read" },
  { title: "Almost done", body: "You've ignored me all day. Fine. But remember I care, that's why I disturb" },
  { title: "Àṣàrò's plea", body: "I'm begging you with all my heart — just open that Bible before you sleep" },
  { title: "Goodnight", body: "Okay, sleep. But know that tomorrow, I'm not taking it easy on you at all 😌" },
];

function getRandomReminder(reminders: { title: string, body: string }[]) {
  return reminders[Math.floor(Math.random() * reminders.length)];
}

// Helper function to get the start of a day
function getStartOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

// Helper function to check if a date is today
function isToday(date: Date): boolean {
  const today = getStartOfDay(new Date());
  const checkDate = getStartOfDay(date);
  return today.getTime() === checkDate.getTime();
}

/**
 * Dynamically calculates notification times based on the user's sleep schedule.
 * Ensuring slots are spaced out and logic is simple.
 */
async function getDynamicNotificationTimes() {
  const sleepTimeStr = await AsyncStorage.getItem('sleep_time');
  let sleepHour = 22;
  let sleepMin = 0;

  if (sleepTimeStr) {
    try {
      const sleepDate = new Date(sleepTimeStr);
      sleepHour = sleepDate.getHours();
      sleepMin = sleepDate.getMinutes();
    } catch (e) {
      console.error('[getDynamicNotificationTimes] Error parsing sleep time:', e);
    }
  }

  const middayMin = 11 * 60 + 59; // 11:59 AM
  const eveningMin = 17 * 60 + 30; // 05:30 PM (Earliest evening start)

  // Final is 1 hour before sleep
  const finalMin = ((sleepHour - 1 + 24) % 24) * 60 + sleepMin;

  // Late is 3 hours before sleep
  const lateMin = ((sleepHour - 3 + 24) % 24) * 60 + sleepMin;

  const rawSlots = [
    { totalMin: middayMin, reminders: middayReminders, name: 'Midday' },
    { totalMin: eveningMin, reminders: eveningReminders, name: 'Evening' },
    { totalMin: lateMin, reminders: lateReminders, name: 'Late' },
    { totalMin: finalMin, reminders: finalReminders, name: 'Final' },
  ];

  // Logic: Only keep slots that are at least 60 mins apart, 
  // prioritizing later slots (Final > Late > Evening > Midday)
  const sortedRaw = rawSlots.sort((a, b) => b.totalMin - a.totalMin);
  const finalSlots: any[] = [];

  for (const slot of sortedRaw) {
    const isTooClose = finalSlots.some(s => Math.abs(s.totalMin - slot.totalMin) < 60);
    if (!isTooClose) {
      finalSlots.push(slot);
    }
  }

  return finalSlots.map(s => ({
    hour: Math.floor(s.totalMin / 60),
    minute: s.totalMin % 60,
    reminders: s.reminders,
    name: s.name
  })).sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
}
// Cancel all scheduled notifications for the remainder of today
export async function cancelRemainingNotificationsForToday(): Promise<void> {
  if (!await hasNotificationPermissions()) {

    return;
  }

  const now = new Date();
  const existingNotifications = await getAllScheduledNotifications();


  for (const notification of existingNotifications) {
    const trigger = notification.trigger as any;
    if (trigger && typeof trigger === 'object') {
      const triggerValue = trigger.date || trigger.value;
      if (triggerValue) {
        const triggerDate = new Date(triggerValue);

        // Cancel if it's scheduled for today and hasn't fired yet
        if (isToday(triggerDate) && triggerDate > now) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    }
  }


}

// Add notifications for a new day (7 days from now) to maintain the 7-day schedule
export async function addNotificationsForNewDay(): Promise<void> {
  if (!await hasNotificationPermissions()) {

    return;
  }

  try {
    // Find the furthest scheduled notification date
    const existingNotifications = await getAllScheduledNotifications();
    let furthestDate = new Date();

    for (const notification of existingNotifications) {
      const trigger = notification.trigger as any;
      if (trigger && typeof trigger === 'object') {
        const triggerValue = trigger.date || trigger.value;
        if (triggerValue) {
          const triggerDate = new Date(triggerValue);
          if (triggerDate > furthestDate) {
            furthestDate = triggerDate;
          }
        }
      }
    }

    // Add one day to the furthest date
    const newDay = new Date(furthestDate);
    newDay.setDate(newDay.getDate() + 1);
    newDay.setHours(0, 0, 0, 0);

    const notificationTimes = await getDynamicNotificationTimes();

    for (const notif of notificationTimes) {
      const scheduledTime = new Date(newDay);
      scheduledTime.setHours(notif.hour, notif.minute, 0, 0);

      const reminder = getRandomReminder(notif.reminders);

      await Notifications.scheduleNotificationAsync({
        content: {
          ...createNotificationContent(reminder.title, reminder.body),
          categoryIdentifier: 'reminder',
          data: {
            timestamp: Date.now(),
            scheduledFor: scheduledTime.toISOString(),
            timeSlot: notif.hour,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: scheduledTime,
          channelId: Platform.OS === 'android' ? 'asaro-reminders' : undefined,
        },
      });
    }


  } catch (error) {
    console.error('Error adding notifications for new day:', error);
  }
}

export async function setupDailyNotifications(
  startFromTomorrow: boolean = false,
  options: { force?: boolean } = {}
): Promise<boolean> {
  // Check permissions without requesting
  if (!await hasNotificationPermissions()) {
    return false;
  }

  if (isScheduling) {
    return false;
  }
  isScheduling = true;

  try {
    const existingNotifications = await getAllScheduledNotifications();

    const now = new Date();
    const futureDateNotifications = existingNotifications.filter(n => {
      const trigger = n.trigger as any;
      if (trigger && typeof trigger === 'object') {
        const triggerValue = trigger.date || trigger.value;
        if (triggerValue) {
          const triggerDate = new Date(triggerValue);
          return triggerDate > now;
        }
      }
      return false;
    });

    /*
     * A full-looking schedule is only trustworthy if the alarms behind it were
     * armed by this process — see the note at the top of the file. Anything
     * else (a cold start, a stale arm, an explicit Reschedule from Settings)
     * rebuilds, because that is the only way to find out whether the alarms
     * are still there and the only way to put them back if they are not.
     */
    const mustArm = options.force || !hasArmedThisLaunch || startFromTomorrow;

    if (!mustArm && futureDateNotifications.length >= 12) {
      return true;
    }

    await cancelAllScheduledNotifications();
    const notificationTimes = await getDynamicNotificationTimes();

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    // Schedule notifications for the next 7 days
    const startOffset = startFromTomorrow ? 1 : 0;
    for (let dayOffset = startOffset; dayOffset < 7 + startOffset; dayOffset++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + dayOffset);

      for (const notif of notificationTimes) {
        const scheduledTime = new Date(targetDate);
        scheduledTime.setHours(notif.hour, notif.minute, 0, 0);

        if (scheduledTime <= now) {
          continue;
        }

        const reminder = getRandomReminder(notif.reminders);

        await Notifications.scheduleNotificationAsync({
          content: {
            ...createNotificationContent(`${reminder.title}`, reminder.body),
            categoryIdentifier: 'reminder',
            data: {
              timestamp: Date.now(),
              type: 'date-based',
              scheduledFor: scheduledTime.toISOString(),
              timeSlot: notif.hour,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: scheduledTime,
            channelId: Platform.OS === 'android' ? 'asaro-reminders' : undefined,
          },
        });
      }
    }

    hasArmedThisLaunch = true;
    await AsyncStorage.setItem(NOTIF_LAST_ARMED_AT, String(Date.now()));
    if (startFromTomorrow) {
      await AsyncStorage.setItem(NOTIF_SKIP_DAY, localDayKey());
    } else {
      await AsyncStorage.removeItem(NOTIF_SKIP_DAY);
    }

    return true;
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return false;
  } finally {
    isScheduling = false;
  }
}

/**
 * Put the schedule back if the OS took it away. Safe to call on every launch
 * and every return to the foreground.
 *
 * This is the repair path for a force-stop, which is how a Transsion phone —
 * and most other vendor power managers — quietly ends the reminders. It
 * rebuilds at most once per process launch, and once more if a resident
 * session has gone `ARM_MAX_AGE_MS` without re-arming. A day whose reminders
 * were dropped because the user had already journalled stays dropped.
 */
export async function ensureNotificationsArmed(): Promise<void> {
  if (!await hasNotificationPermissions()) {
    return;
  }

  try {
    const [skipDay, lastArmedRaw] = await Promise.all([
      AsyncStorage.getItem(NOTIF_SKIP_DAY),
      AsyncStorage.getItem(NOTIF_LAST_ARMED_AT),
    ]);

    const lastArmedAt = Number(lastArmedRaw) || 0;
    const isStale = Date.now() - lastArmedAt > ARM_MAX_AGE_MS;

    await setupDailyNotifications(skipDay === localDayKey(), { force: isStale });
  } catch (error) {
    console.error('Error re-arming notifications:', error);
  }
}

/**
 * Everything that decides whether a reminder can reach the user, in one read.
 *
 * Each of these can be false on its own and produce exactly the same symptom —
 * silence — so the Settings screen shows them rather than making the user
 * guess which of the six it is.
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

  /*
   * A vendor cleaner can set a channel's importance to NONE behind the app's
   * back. Android refuses to let an app raise importance once the channel
   * exists, so this can only be reported, never repaired in code — the user
   * has to turn it back on in system settings.
   */
  let channelBlocked = false;
  if (Platform.OS === 'android') {
    try {
      const channel = await Notifications.getNotificationChannelAsync('asaro-reminders');
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

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  // Also dismiss any delivered notifications to clear the tray
  await Notifications.dismissAllNotificationsAsync();
}

export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

export async function sendTestNotification(): Promise<void> {
  if (!await hasNotificationPermissions()) {

    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: createNotificationContent(
      '🔔 Test Notification',
      'If you can see this, notifications are working perfectly! 🎉'
    ),
    trigger: null,
  });
}