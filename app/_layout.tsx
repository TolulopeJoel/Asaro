import { initializeDatabase } from '@/src/data/database';
import { requestNotificationPermissions, setupDailyNotifications } from '@/src/utils/notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

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
    </Stack>
  );
}

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // initialise database
        const success = await initializeDatabase();
        setDbInitialized(success);
        if (!success) {
          console.error('Failed to initialize database');
        }
        await requestNotificationPermissions();
        await setupDailyNotifications();
      } catch (error) {
        console.error('Initialization error:', error);
        setDbInitialized(false);
      }
    };

    init();
  }, []);

  if (!dbInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <StackNavigator />
      <StatusBar hidden={true} />
    </ThemeProvider>
  );
}