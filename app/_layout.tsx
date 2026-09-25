import { initializeDatabase } from '@/src/data/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import {
  initializeNotificationChannel,
  hasNotificationPermissions,
  isBatteryOptimizationDisabled,
  ensureNotificationsArmed
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
import { useFonts } from 'expo-font';
import {
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
  Fraunces_900Black,
} from '@expo-google-fonts/fraunces';
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
} from '@expo-google-fonts/work-sans';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_700Bold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo';


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
      <Stack.Screen name="land" options={{ headerShown: false }} />
      <Stack.Screen name="permissions" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="battery-optimization" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/name" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/sleep-time" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_700Bold,
    Fraunces_700Bold_Italic,
    Fraunces_900Black,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_700Bold,
    Archivo_900Black,
  });

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

        /*
         * Phase 0 plumbing check. Dev only, fire-and-forget so it cannot
         * delay startup, and it removes the row it writes. Delete this block
         * once the Echoes surface exists and can be looked at directly.
         */
        if (__DEV__) {
          import('@/src/insight/smokeTest')
            .then(({ runPhase0SmokeTest }) => runPhase0SmokeTest())
            .then(report => console.log(report))
            .catch(error => console.log('Phase 0 smoke test failed to run:', error));
        }

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

        /*
         * Re-arm the reminder alarms before anything else in the session can
         * touch them, and without waiting on the battery gate below. A vendor
         * power manager that force-stopped us cancelled every alarm we had
         * registered; this launch is the first chance to put them back, and a
         * user who never satisfies the battery step still deserves reminders.
         * Not awaited — it must never hold up the splash.
         */
        ensureNotificationsArmed().catch(error =>
          console.error('Failed to arm notifications:', error)
        );

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
      if (nextState !== 'active') return;
      syncPendingActivities();
      // The app coming back is also the first moment we can notice that the OS
      // threw the schedule away while we were gone.
      ensureNotificationsArmed().catch(error =>
        console.error('Failed to arm notifications:', error)
      );
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
      await ensureNotificationsArmed();

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

  // Both styles are typographic: Cloth is Fraunces over Work Sans, Colossal is
  // Schibsted Grotesk throughout. Rendering before they load would show a
  // system-font flash and reflow every screen, so hold the splash until then.
  if (!fontsLoaded && !fontError) {
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