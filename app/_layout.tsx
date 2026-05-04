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
import { View } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';
import { AuthProvider } from '@/src/context/AuthContext';
import { AlertProvider } from '@/src/context/AlertContext';
import { RefPickerProvider } from '@/src/context/RefPickerContext';
import { LoadingView } from '@/src/components/LoadingView';
import { CustomAlert } from '@/src/components/CustomAlert';

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
        // animation: 'slide_from_right',
        animation: 'none',
        presentation: 'card',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="addEntry" options={{ headerShown: false }} />
      <Stack.Screen name="stats" options={{ headerShown: false }} />
      <Stack.Screen name="permissions" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="battery-optimization" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/name" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/sleep-time" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);
  // Cache permission/battery results so native calls only happen once,
  // not on every segment change.
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [isBatteryOk, setIsBatteryOk] = useState<boolean | null>(null);
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

        // Check permissions and battery once, then cache in state.
        // The second useEffect reacts to these values instead of re-calling the
        // native APIs on every navigation segment change.
        const perms = await hasNotificationPermissions();
        setHasPermissions(perms);

        const batteryOk = await isBatteryOptimizationDisabled();
        setIsBatteryOk(batteryOk);

      } catch (error) {
        console.error('Initialization error:', error);
        setDbInitialized(false);
      }
    };

    init();
  }, []);

  // Re-check permissions/battery after the user returns from the permissions
  // or battery-optimization screens. We only re-query native APIs when we're
  // coming *back* from those screens (i.e. segments changed away from them),
  // keeping the hot path (normal tab navigation) free of native API calls.
  useEffect(() => {
    if (!dbInitialized) return;
    // Still waiting for the initial permission check to complete.
    if (hasPermissions === null || isBatteryOk === null) return;

    const checkRequirements = async () => {
      const currentSegment = segments[0] as string;
      // 1. Check Name
      const userName = await AsyncStorage.getItem('user_name');
      if (!userName) {
        const isOnNameScreen = currentSegment === 'onboarding' && segments[1] === 'name';
        if (!isOnNameScreen) {
          router.replace('/onboarding/name');
        }
        return;
      }

      // 2. Check Sleep Time
      const sleepTime = await AsyncStorage.getItem('sleep_time');
      if (!sleepTime) {
        const isOnSleepScreen = currentSegment === 'onboarding' && segments[1] === 'sleep-time';
        if (!isOnSleepScreen) {
          router.replace('/onboarding/sleep-time');
        }
        return;
      }

      // 3. Check Permissions — re-query if returning from the permissions screen
      let perms = hasPermissions;
      if (currentSegment === 'permissions') {
        // Currently on the screen — don't redirect away yet
        return;
      }
      if (!perms) {
        // Re-check in case the user just granted permission
        perms = await hasNotificationPermissions();
        setHasPermissions(perms);
      }
      if (!perms) {
        if (currentSegment !== 'permissions') {
          router.replace('/permissions');
        }
        return;
      }

      // 4. Check Battery Optimization — re-query if returning from that screen
      let batteryOk = isBatteryOk;
      if (currentSegment === 'battery-optimization') {
        return;
      }
      if (!batteryOk) {
        batteryOk = await isBatteryOptimizationDisabled();
        setIsBatteryOk(batteryOk);
      }
      if (!batteryOk) {
        if (currentSegment !== 'battery-optimization') {
          router.replace('/battery-optimization');
        }
        return;
      }

      // All requirements met — schedule notifications and redirect home if needed
      const isOnboarding = currentSegment === 'onboarding' || currentSegment === 'permissions' || currentSegment === 'battery-optimization';

      if (perms && batteryOk && userName && sleepTime) {
        await setupDailyNotifications();
      }

      if (isOnboarding) {
        router.replace('/');
      }
    };

    checkRequirements();
  }, [dbInitialized, hasPermissions, isBatteryOk, segments]);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AlertProvider>
          <ThemeProvider>
            <RefPickerProvider>
              {!dbInitialized ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <LoadingView size={48} />
                </View>
              ) : (
                <>
                  <StackNavigator />
                  <CustomAlert />
                  <StatusBar hidden={true} />
                </>
              )}
            </RefPickerProvider>
          </ThemeProvider>
        </AlertProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}