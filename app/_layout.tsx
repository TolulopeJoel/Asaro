import { initializeDatabase } from '@/src/data/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import {
  initializeNotificationChannel,
  hasNotificationPermissions,
  isBatteryOptimizationDisabled,
  setupDailyNotifications
} from '@/src/utils/notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { syncPendingActivities } from '@/src/utils/syncActivities';

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
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        headerShadowVisible: false,
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
  const [dbError, setDbError] = useState(false);
  // null  = not yet checked   |  boolean = checked result
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [isBatteryOk, setIsBatteryOk] = useState<boolean | null>(null);
  // undefined = not yet loaded  |  null = loaded but absent  |  string = has value
  const [userName, setUserName] = useState<string | null | undefined>(undefined);
  const [sleepTime, setSleepTime] = useState<string | null | undefined>(undefined);

  // Flipped once all requirements are confirmed. Prevents the navigation guard
  // from firing on every subsequent segment change (tab switch, screen push).
  const [isReady, setIsReady] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  // 1. One-time initialisation
  useEffect(() => {
    const init = async () => {
      try {
        const success = await initializeDatabase();
        if (!success) {
          console.error('Failed to initialize database');
          setDbError(true);
          return;
        }
        setDbInitialized(true);

        await initializeNotificationChannel();

        // Load all four requirement values in parallel — they're independent.
        const [name, sleep, perms, batteryOk] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.USER_NAME),
          AsyncStorage.getItem(STORAGE_KEYS.SLEEP_TIME),
          hasNotificationPermissions(),
          isBatteryOptimizationDisabled(),
        ]);

        setUserName(name);
        setSleepTime(sleep);
        setHasPermissions(perms);
        setIsBatteryOk(batteryOk);

      } catch (error) {
        console.error('Initialization error:', error);
        setDbError(true);
      }
    };

    init();
  }, []);

  // 2. AppState listener — registered once the DB is ready
  useEffect(() => {
    if (!dbInitialized) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') syncPendingActivities();
    });
    return () => subscription.remove();
  }, [dbInitialized]);

  // 3. Navigation guard
  // Redirects to the first unmet requirement. Bails out completely once
  // isReady is true so tab navigation never triggers requirement checks.
  useEffect(() => {
    if (!dbInitialized) return;
    if (isReady) return;
    // Still waiting for the initial load to complete.
    if (userName === undefined || sleepTime === undefined || hasPermissions === null || isBatteryOk === null) return;

    const checkRequirements = async () => {
      const currentSegment = segments[0] as string;

      // 1. Name
      if (!userName) {
        if (currentSegment !== 'onboarding' || segments[1] !== 'name') {
          router.replace('/onboarding/name');
        }
        return;
      }

      // 2. Sleep time
      if (!sleepTime) {
        if (currentSegment !== 'onboarding' || segments[1] !== 'sleep-time') {
          router.replace('/onboarding/sleep-time');
        }
        return;
      }

      // 3. Notification permissions. If currently on the screen, wait — don't redirect away yet.
      if (currentSegment === 'permissions') return;
      let perms = hasPermissions;
      if (!perms) {
        // Re-query in case the user just granted permission from system settings.
        perms = await hasNotificationPermissions();
        setHasPermissions(perms);
      }
      if (!perms) {
        router.replace('/permissions');
        return;
      }

      // 4. Battery optimisation
      if (currentSegment === 'battery-optimization') return;
      let batteryOk = isBatteryOk;
      if (!batteryOk) {
        batteryOk = await isBatteryOptimizationDisabled();
        setIsBatteryOk(batteryOk);
      }
      if (!batteryOk) {
        router.replace('/battery-optimization');
        return;
      }

      // All requirements met — mark ready and schedule notifications once.
      setIsReady(true);
      await setupDailyNotifications();

      const isOnboarding = ['onboarding', 'permissions', 'battery-optimization'].includes(currentSegment);
      if (isOnboarding) {
        router.replace('/');
      }
    };

    checkRequirements();
  }, [dbInitialized, isReady, userName, sleepTime, hasPermissions, isBatteryOk, segments]);

  if (dbError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingView size={48} />
      </View>
    );
  }

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