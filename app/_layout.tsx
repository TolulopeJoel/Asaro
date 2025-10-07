import { initializeDatabase } from '@/src/data/database';
import { requestNotificationPermissions } from '@/src/utils/notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

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
        // request notification permission
        await requestNotificationPermissions();
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
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Àṣàrò' }} />
        <Stack.Screen name="addEntry" options={{ title: 'Kọ silẹ' }} />
        <Stack.Screen name="browse" options={{ title: 'Wo lẹẹkansi' }} />
      </Stack>
      <StatusBar hidden={true} />
    </>
  );
}