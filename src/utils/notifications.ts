import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

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
    trigger: { date: time },
  });
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  title: string = '📖 Time to Read',
  body: string = 'Ready to reflect on today\'s scripture?'
): Promise<string | null> {
  if (!await requestNotificationPermissions()) {
    return null;
  }

  // Cancel existing reminders first
  await cancelAllScheduledNotifications();

  // Schedule daily repeating notification
  return await Notifications.scheduleNotificationAsync({
    content: createNotificationContent(title, body),
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function scheduleTestNotification(): Promise<string | null> {
  if (!await requestNotificationPermissions()) {
    return null;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: createNotificationContent(
      "📖 Test Reminder",
      "This is what your daily Bible reading reminder will look like!"
    ),
    trigger: { seconds: 5 },
  });

  Alert.alert(
    'Notification Scheduled! ✅',
    'Watch for it in 5 seconds...',
    [{ text: 'OK' }]
  );

  return notificationId;
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