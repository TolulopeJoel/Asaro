import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Battery from 'expo-battery';

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
    await Notifications.setNotificationChannelAsync('asaro-reminders', {
      name: 'Àṣàrò Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8b7355',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

// Check if notification permissions are granted (no UI, just status check)
export async function hasNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Must use physical device for notifications');
    return false;
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
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
  } catch (error) {
    console.log('Error checking battery optimization:', error);
    // If we can't check, assume it's not configured properly
    return false;
  }
}

// Request notification permissions with user interaction
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Must use physical device for notifications');
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
    Alert.alert(
      'Can I Check Up On You? 😏',
      'Hi, I\'m Àṣàrò. I will disturb you small if you miss your Bible reading. I won\'t let your phone rest\n\nBut, I care! If I don\'t see you, I\'ll check up on you to make sure your relationship with Jehovah is intact 😌',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Notification Settings',
          onPress: () => openNotificationSettings()
        },
      ]
    );
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
    } catch (error) {
      console.log('Could not open notification settings, falling back:', error);
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
    console.log('Notification permissions not granted');
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

// Notification messages organized by time of day
const morningReminders = [
  { title: "Good morning o", body: "Àṣàrò here. You haven't read your Bible yet? Ehn ehn, we're starting like this?" },
  { title: "Morning check", body: "I'm not asking you, I'm telling you - open that Bible now" },
  { title: "Early call", body: "So you woke up and the first thing wasn't your Bible? Interesting 🤔" },
  { title: "Rise and shine", body: "Jehovah is waiting. You know say I no dey joke with these things" },
  { title: "Morning reminder", body: "Don't let me start disturbing you from morning o. Just read it" },
  { title: "Àṣàrò checking in", body: "I've been watching you since you woke up. Where's your Bible?" },
  { title: "Fresh start", body: "New day, same excuses? Abeg, make we no do like this" },
  { title: "Early warning", body: "You think say I forget? I never forget. Go and read that Bible" },
];

const eveningReminders = [
  { title: "Evening o", body: "The whole day don pass and you never read? What kind of thing be this?" },
  { title: "Àṣàrò is asking", body: "So we're doing hide and seek with the Bible today abi? I'm not playing with you" },
  { title: "Serious question", body: "If Jehovah ask you wetin you read today, wetin you go talk?" },
  { title: "Evening check", body: "I've been patient since morning. My patience is running out o 😌" },
  { title: "Reality check", body: "You're scrolling phone but Bible you cannot read? Make sense na" },
  { title: "Not impressed", body: "Àṣàrò is very disappointed. But there's still time to fix it" },
  { title: "Evening tap", body: "Don't make me come back here again. You know how I can be 👀" },
  { title: "Just so you know", body: "I'm keeping record o. Every single day wey you miss, I dey write am down" },
];

const lateReminders = [
  { title: "Àṣàrò again", body: "You thought I was joking? See me here again. Open that Bible sharp sharp" },
  { title: "Late warning", body: "Your mates are sleeping with clear conscience. You sef, you no want?" },
  { title: "Not playing", body: "This stubbornness, where is it taking you? Just 15 minutes of reading, is it too much?" },
  { title: "Getting serious", body: "I've come three times today. Don't test me o 😂" },
  { title: "Persistence mode", body: "You think say if you ignore me I go disappear? You don't know Àṣàrò" },
  { title: "Accountability time", body: "So we made a commitment and now you're forming busy abi? Abeg read that Bible" },
  { title: "No excuses", body: "Tired? Busy? Stressed? Jehovah too get time for you. Balance it" },
  { title: "Late check", body: "The day is almost over and you want to sleep like this? Ah ah" },
];

const finalReminders = [
  { title: "Final warning", body: "This is the last time I'm asking nicely. Tomorrow I'm coming earlier 😅" },
  { title: "Midnight call", body: "You really want to sleep without reading? You're a strong person o" },
  { title: "Last chance", body: "Àṣàrò doesn't give up. If you sleep now, just know say I tried my best" },
  { title: "Bedtime", body: "Even 5 minutes sef you cannot give Jehovah? Okay o, we'll see tomorrow" },
  { title: "Serious now", body: "I'm not joking anymore. Your spiritual life needs this. Please read" },
  { title: "Almost done", body: "You've ignored me all day. Fine. But remember say I care, that's why I disturb" },
  { title: "Àṣàrò's plea", body: "I'm begging you with all my heart - just open that Bible before you sleep" },
  { title: "Goodnight", body: "Okay, sleep. But know that tomorrow, I'm not taking it easy with you at all 😌" },
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

// Cancel all scheduled notifications for the remainder of today
export async function cancelRemainingNotificationsForToday(): Promise<void> {
  if (!await hasNotificationPermissions()) {
    console.log('Notification permissions not granted');
    return;
  }

  const now = new Date();
  const existingNotifications = await getAllScheduledNotifications();

  let cancelledCount = 0;
  for (const notification of existingNotifications) {
    if (notification.trigger && typeof notification.trigger === 'object' && 'date' in notification.trigger) {
      const triggerDate = new Date(notification.trigger.date as number);

      // Cancel if it's scheduled for today and hasn't fired yet
      if (isToday(triggerDate) && triggerDate > now) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        cancelledCount++;
      }
    }
  }

  console.log(`✅ Cancelled ${cancelledCount} remaining notifications for today`);
}

// Add notifications for a new day (7 days from now) to maintain the 7-day schedule
export async function addNotificationsForNewDay(): Promise<void> {
  if (!await hasNotificationPermissions()) {
    console.log('Notification permissions not granted');
    return;
  }

  try {
    // Find the furthest scheduled notification date
    const existingNotifications = await getAllScheduledNotifications();
    let furthestDate = new Date();

    for (const notification of existingNotifications) {
      if (notification.trigger && typeof notification.trigger === 'object' && 'date' in notification.trigger) {
        const triggerDate = new Date(notification.trigger.date as number);
        if (triggerDate > furthestDate) {
          furthestDate = triggerDate;
        }
      }
    }

    // Add one day to the furthest date
    const newDay = new Date(furthestDate);
    newDay.setDate(newDay.getDate() + 1);
    newDay.setHours(0, 0, 0, 0);

    const notificationTimes = [
      { hour: 12, minute: 0, reminders: morningReminders, name: 'Morning' },
      { hour: 19, minute: 0, reminders: eveningReminders, name: 'Evening' },
      { hour: 21, minute: 0, reminders: lateReminders, name: 'Late' },
      { hour: 23, minute: 0, reminders: finalReminders, name: 'Final' },
    ];

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

    console.log(`✅ Added 4 notifications for ${newDay.toDateString()}`);
  } catch (error) {
    console.error('Error adding notifications for new day:', error);
  }
}

export async function setupDailyNotifications(): Promise<boolean> {
  // Check permissions without requesting
  if (!await hasNotificationPermissions()) {
    console.log('Notification permissions not granted, skipping notification setup');
    return false;
  }

  try {
    // Check if we already have notifications scheduled
    const existingNotifications = await getAllScheduledNotifications();

    // Count how many future date-based notifications we have
    const now = new Date();
    const futureDateNotifications = existingNotifications.filter(n => {
      if (n.trigger && typeof n.trigger === 'object' && 'date' in n.trigger) {
        const triggerDate = new Date(n.trigger.date as number);
        return triggerDate > now;
      }
      return false;
    });

    // Count how many repeating notifications we have
    const repeatingNotifications = existingNotifications.filter(n =>
      n.trigger && typeof n.trigger === 'object' && 'hour' in n.trigger
    );

    // If we have both types already scheduled, skip
    if (futureDateNotifications.length >= 12 && repeatingNotifications.length >= 4) {
      console.log(`✅ Already have ${repeatingNotifications.length} repeating + ${futureDateNotifications.length} date-based notifications. Skipping setup.`);
      return true;
    }

    // Cancel all existing scheduled notifications to start fresh
    await cancelAllScheduledNotifications();
    console.log('Setting up BOTH repeating AND 7-day notification schedules for testing...');

    const notificationTimes = [
      { hour: 7, minute: 0, reminders: morningReminders, name: 'Morning' },
      { hour: 19, minute: 0, reminders: eveningReminders, name: 'Evening' },
      { hour: 21, minute: 0, reminders: lateReminders, name: 'Late' },
      { hour: 23, minute: 0, reminders: finalReminders, name: 'Final' },
    ];

    // ========================================
    // PART 1: Schedule REPEATING notifications
    // ========================================
    console.log('📅 Scheduling repeating daily notifications...');
    for (const notif of notificationTimes) {
      const reminder = getRandomReminder(notif.reminders);

      await Notifications.scheduleNotificationAsync({
        content: {
          ...createNotificationContent(`[REPEAT] ${reminder.title}`, reminder.body),
          categoryIdentifier: 'reminder',
          data: {
            timestamp: Date.now(),
            type: 'repeating',
            timeSlot: notif.hour,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: notif.hour,
          minute: notif.minute,
          repeats: true,
          channelId: Platform.OS === 'android' ? 'asaro-reminders' : undefined,
        } as any,
      });

      console.log(`  ✅ ${notif.name} repeating notification at ${notif.hour}:${String(notif.minute).padStart(2, '0')}`);
    }

    // ========================================
    // PART 2: Schedule DATE-BASED notifications for 7 days
    // ========================================
    console.log('📅 Scheduling date-based notifications for 7 days...');
    let scheduledCount = 0;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    // Schedule notifications for the next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + dayOffset);

      for (const notif of notificationTimes) {
        const scheduledTime = new Date(targetDate);
        scheduledTime.setHours(notif.hour, notif.minute, 0, 0);

        // Skip if the time has already passed
        if (scheduledTime <= now) {
          continue;
        }

        const reminder = getRandomReminder(notif.reminders);

        await Notifications.scheduleNotificationAsync({
          content: {
            ...createNotificationContent(`[DATE] ${reminder.title}`, reminder.body),
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

        scheduledCount++;
      }
    }

    console.log(`✅ Scheduled 4 repeating + ${scheduledCount} date-based notifications (TESTING MODE)`);
    return true;
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return false;
  }
}

export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

export async function sendTestNotification(): Promise<void> {
  if (!await hasNotificationPermissions()) {
    console.log('Notification permissions not granted');
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