import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';
import { hasEntryToday } from '../data/database';

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
  };
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8b7355',
    });
  }

  // Check current permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // If not granted, request permission
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // Handle denied permissions
  if (finalStatus !== 'granted') {
    Alert.alert(
      'Can I Check Up On You?',
      'Hi, I\'m Àṣàrò! I will disturb you small if you miss your Bible reading. I won\'t let your phone rest 😂\n\nBut seriously, I care! If I don\'t see you for a while, I\'ll check up on you to make sure your relationship with Jehovah is intact 😌',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Allow Notifications', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  return true;
}

export async function scheduleReminderNotification(
  time: Date,
  title: string = '📖 Time to Reflect',
  body: string = 'Take a moment to journal your thoughts.'
): Promise<string | null> {
  if (!await requestNotificationPermissions()) {
    return null;
  }

  return await Notifications.scheduleNotificationAsync({
    content: createNotificationContent(title, body),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: time,
    },
  });
}

// FIXED: Use DAILY trigger for Android compatibility
async function scheduleSingleDailyReminder(
  hour: number,
  minute: number,
  title: string,
  body: string
): Promise<string | null> {
  return await Notifications.scheduleNotificationAsync({
    content: createNotificationContent(title, body),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function setupDailyNotifications() {
  if (!await requestNotificationPermissions()) {
    return;
  }

  // Cancel all existing notifications first
  await cancelAllScheduledNotifications();

  await scheduleSingleDailyReminder(
    5,
    20,
    "Good morning! ☀️",
    "Start your day with Jehovah's words. You would love it 😌"
  );

  const todayEntry = hasEntryToday()

  if (!todayEntry) {
    await scheduleSingleDailyReminder(
      20,
      15,
      "Evening check-in",
      "Still no reading today? I'm not judging... but I'm watching 😌"
    );

    await scheduleSingleDailyReminder(
      22,
      23,
      "I am back for you sir",
      "Your Bible is still waiting o. Small small disturbance, remember? 🙄"
    );

    await scheduleSingleDailyReminder(
      23,
      0,
      "Last chance",
      "I won't let you sleep peacefully without your reading. You know this 😒"
    );
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