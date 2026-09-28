import { initializeDatabase } from '@/src/data/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import { loadAsaroLook } from '@/src/storage/asaroLook';
import { endOnboardingRun, isOnboardingRun, resumeOnboardingSteps, setOnboardingSteps } from '@/src/utils/onboardingSteps';
import { getFirstRun, setFirstRun } from '@/src/onboarding/firstRun';
import {
  initializeNotificationChannel,
  hasNotificationPermissions,
  isBatteryOptimizationDisabled,
  ensureNotificationsArmed
} from '@/src/utils/notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, DeviceEventEmitter, View } from 'react-native';
import { startGroups } from '@/src/groups/publish';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';
import { AuthProvider } from '@/src/context/AuthContext';
import { AlertProvider } from '@/src/context/AlertContext';
import { RefPickerProvider } from '@/src/context/RefPickerContext';
import { LoadingView } from '@/src/components/LoadingView';
import { CustomAlert } from '@/src/components/CustomAlert';
import { AppWalk } from '@/src/components/onboarding/AppWalk';
import { coachRoot } from '@/src/onboarding/coachTargets';
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
      <Stack.Screen name="thinking-cap" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/character" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/name" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding/tour" options={{ headerShown: false, gestureEnabled: false }} />
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
        const [success] = await Promise.all([initializeDatabase(), loadAsaroLook()]);
        if (!success) {
          console.error('Failed to initialize database');
          setDbError(true);
          return;
        }
        setDbInitialized(true);
        startGroups();

        await initializeNotificationChannel();

        // Load all four requirement values in parallel — they're independent.
        const [name, sleep, perms, batteryOk, resumed] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.USER_NAME),
          AsyncStorage.getItem(STORAGE_KEYS.SLEEP_TIME),
          hasNotificationPermissions(),
          isBatteryOptimizationDisabled(),
          resumeOnboardingSteps(),
        ]);

        // A restart midway keeps the steps it started with, even once the name and sleep time are in.
        if (!resumed && (!name || !sleep)) {
          await setOnboardingSteps([
            ...(name ? [] : ['character' as const]),
            'name',
            'sleep-time',
            ...(perms ? [] : ['permissions' as const]),
            ...(batteryOk ? [] : ['battery-optimization' as const]),
          ]);
        }

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

    // A newer run of this effect owns navigation; a stale one stops at its next step.
    let cancelled = false;

    const checkRequirements = async () => {
      const currentSegment = segments[0] as string;

      // The onboarding screens write straight to storage, so re-read what's missing.
      const name = userName || await AsyncStorage.getItem(STORAGE_KEYS.USER_NAME);
      const sleep = sleepTime || await AsyncStorage.getItem(STORAGE_KEYS.SLEEP_TIME);
      if (cancelled) return;
      if (name && name !== userName) setUserName(name);
      if (sleep && sleep !== sleepTime) setSleepTime(sleep);

      // 1. Character, for new users only: an existing user keeps the default look.
      if (!name && !await AsyncStorage.getItem(STORAGE_KEYS.ASARO_LOOK)) {
        if (cancelled) return;
        if (currentSegment !== 'onboarding' || segments[1] !== 'character') {
          router.replace('/onboarding/character');
        }
        return;
      }
      if (cancelled) return;

      // 2. Name
      if (!name) {
        if (currentSegment !== 'onboarding' || segments[1] !== 'name') {
          router.replace('/onboarding/name');
        }
        return;
      }

      // 3. Sleep time, after the tour when it's being shown.
      if (!sleep) {
        if (currentSegment !== 'onboarding' || (segments[1] !== 'tour' && segments[1] !== 'sleep-time')) {
          router.replace('/onboarding/sleep-time');
        }
        return;
      }

      // 4. Notification permissions. If currently on the screen, wait — don't redirect away yet.
      if (currentSegment === 'permissions') return;
      let perms = hasPermissions;
      if (!perms) {
        // Re-query in case the user just granted permission from system settings.
        perms = await hasNotificationPermissions();
        if (cancelled) return;
        setHasPermissions(perms);
      }
      if (!perms) {
        router.replace('/permissions');
        return;
      }

      // 5. Battery optimisation
      if (currentSegment === 'battery-optimization') return;
      let batteryOk = isBatteryOk;
      if (!batteryOk) {
        batteryOk = await isBatteryOptimizationDisabled();
        if (cancelled) return;
        setIsBatteryOk(batteryOk);
      }
      if (!batteryOk) {
        router.replace('/battery-optimization');
        return;
      }

      // A new user goes on to the thinking cap, the practice entry and the walk; Home picks it up from the flag.
      if (isOnboardingRun()) {
        if (!(await getFirstRun())) {
          await setFirstRun('cap');
          DeviceEventEmitter.emit('first-run-changed');
        }
        await endOnboardingRun();
      }
      if (cancelled) return;

      // All requirements met — mark ready and schedule notifications once.
      setIsReady(true);
      const isOnboarding = ['onboarding', 'permissions', 'battery-optimization'].includes(currentSegment);
      if (isOnboarding) {
        router.replace('/');
      }
      ensureNotificationsArmed().catch(error =>
        console.error('Failed to arm notifications:', error)
      );
    };

    checkRequirements();
    return () => { cancelled = true; };
  }, [dbInitialized, isReady, userName, sleepTime, hasPermissions, isBatteryOk, segments]);

  if (dbError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingView size={48} />
      </View>
    );
  }

  // The type is Fraunces over Work Sans. Rendering before they load would
  // show a system-font flash and reflow every screen, so hold the splash
  // until then.
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
                /* The walk measures its targets against this view, which its overlay fills. */
                <View ref={coachRoot} collapsable={false} style={{ flex: 1 }}>
                  <StackNavigator />
                  <AppWalk />
                  <CustomAlert />
                  <StatusBar hidden={true} />
                </View>
              )}
            </RefPickerProvider>
          </ThemeProvider>
        </AlertProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}