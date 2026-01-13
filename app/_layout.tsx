import { initializeDatabase } from '@/src/data/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeNotificationChannel,
  hasNotificationPermissions,
  isBatteryOptimizationDisabled,
  setupDailyNotifications
} from '@/src/utils/notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';

function StackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          color: colors.textPrimary,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        animation: 'slide_from_right',
        presentation: 'card',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="addEntry" options={{ title: 'Kọ silẹ' }} />
      <Stack.Screen name="stats" options={{ title: 'What you\'ve done 🤩' }} />
      <Stack.Screen name="permissions" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="battery-optimization" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/name" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/sleep-time" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize database
        const success = await initializeDatabase();
        setDbInitialized(success);
        if (!success) {
          console.error('Failed to initialize database');
          return;
        }

        // Initialize notification channel (Android only, no UI)
        await initializeNotificationChannel();

        // Check permissions
        const hasPermissions = await hasNotificationPermissions();
        if (!hasPermissions) {
          // We'll let the layout effect handle the redirect
          return;
        }

        // Check battery optimization (Android only)
        const isOptimized = await isBatteryOptimizationDisabled();
        if (!isOptimized) {
          // We'll let the layout effect handle the redirect
          return;
        }


      } catch (error) {
        console.error('Initialization error:', error);
        setDbInitialized(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!dbInitialized) return;

    const checkRequirements = async () => {
      // 1. Check Name
      const userName = await AsyncStorage.getItem('user_name');
      if (!userName) {
        // Check if we are already on the name screen to avoid loop
        // segments might be ['onboarding', 'name']
        const isOnNameScreen = segments[0] === 'onboarding' && segments[1] === 'name';
        if (!isOnNameScreen) {
          router.replace('/onboarding/name');
        }
        return;
      }

      // 2. Check Sleep Time
      const sleepTime = await AsyncStorage.getItem('sleep_time');
      if (!sleepTime) {
        const isOnSleepScreen = segments[0] === 'onboarding' && segments[1] === 'sleep-time';
        if (!isOnSleepScreen) {
          router.replace('/onboarding/sleep-time');
        }
        return;
      }

      // 3. Check Permissions
      const hasPermissions = await hasNotificationPermissions();

      if (!hasPermissions) {
        if (segments[0] !== 'permissions') {
          router.replace('/permissions');
        }
        return;
      }

      // 4. Check Battery Optimization
      const isBatteryOk = await isBatteryOptimizationDisabled();
      if (!isBatteryOk) {
        if (segments[0] !== 'battery-optimization') {
          router.replace('/battery-optimization');
        }
        return;
      }

      // If everything is good and we are on a blocking screen (onboarding or permissions), go home
      const isOnboarding = segments[0] === 'onboarding' || segments[0] === 'permissions' || segments[0] === 'battery-optimization';

      // Ensure notifications are scheduled once all requirements are met
      if (hasPermissions && isBatteryOk && userName && sleepTime) {
        await setupDailyNotifications();
      }

      if (isOnboarding) {
        router.replace('/');
      }
    };

    checkRequirements();
  }, [dbInitialized, segments]);

  if (!dbInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StackNavigator />
        <StatusBar hidden={true} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}