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
async function isBatteryOptimizationDisabled(): Promise<boolean> {
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

  // Check battery optimization status - only show prompt if battery optimization is still enabled
  if (Platform.OS === 'android') {
    const isOptimizationDisabled = await isBatteryOptimizationDisabled();

    if (!isOptimizationDisabled) {
      Alert.alert(
        'One More Thing...',
        'To ensure notifications work perfectly even when your phone is sleeping, please allow this app to run in the background without restrictions.',
        [
          {
            text: 'Open Battery Settings',
            onPress: () => openBatterySettings()
          },
        ]
      );
    }
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

// Open battery optimization settings
export async function openBatterySettings() {
  if (Platform.OS === 'android') {
    const pkg = 'com.asaro.meditation';

    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        {
          data: `package:${pkg}`
        }
      );
    } catch (error) {
      console.log('Could not open battery optimization, trying alternative:', error);

      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
        );
      } catch (error2) {
        console.log('Could not open battery settings, using app settings:', error2);
        Linking.openSettings();
      }
    }
  } else {
    Linking.openSettings();
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

export async function setupDailyNotifications(): Promise<boolean> {
  // Check permissions without requesting
  if (!await hasNotificationPermissions()) {
    console.log('Notification permissions not granted, skipping notification setup');
    return false;
  }

  // Cancel all existing notifications first to avoid duplicates
  await cancelAllScheduledNotifications();

  console.log('Setting up daily notifications with repeating triggers...');

  try {
    const notifications = [
      { hour: 7, minute: 0, reminders: morningReminders, name: 'Morning' },
      { hour: 19, minute: 0, reminders: eveningReminders, name: 'Evening' },
      { hour: 21, minute: 0, reminders: lateReminders, name: 'Late' },
      { hour: 23, minute: 0, reminders: finalReminders, name: 'Final' },
    ];

    const scheduledIds: string[] = [];

    // Schedule repeating notifications
    for (const notif of notifications) {
      const reminder = getRandomReminder(notif.reminders);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          ...createNotificationContent(reminder.title, reminder.body),
          categoryIdentifier: 'reminder',
        },
        trigger: {
          hour: notif.hour,
          minute: notif.minute,
          repeats: true,
          channelId: Platform.OS === 'android' ? 'asaro-reminders' : undefined,
        },
      });

      scheduledIds.push(notificationId);
      console.log(`✅ ${notif.name} repeating notification scheduled for ${notif.hour}:${String(notif.minute).padStart(2, '0')}`);
    }

    // BACKUP: Schedule exact date/time notifications for next 14 days
    const daysToSchedule = 14;
    for (let day = 0; day < daysToSchedule; day++) {
      for (const notif of notifications) {
        const scheduleDate = new Date();
        scheduleDate.setDate(scheduleDate.getDate() + day);
        scheduleDate.setHours(notif.hour, notif.minute, 0, 0);

        if (scheduleDate > new Date()) {
          const reminder = getRandomReminder(notif.reminders);

          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              ...createNotificationContent(reminder.title, reminder.body),
              categoryIdentifier: 'reminder',
              data: {
                timestamp: Date.now(),
                backup: true,
                day: day
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: scheduleDate,
              channelId: Platform.OS === 'android' ? 'asaro-reminders' : undefined,
            },
          });

          scheduledIds.push(notificationId);
        }
      }
    }

    const scheduled = await getAllScheduledNotifications();
    console.log(`✅ Successfully scheduled ${scheduled.length} notifications`);

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