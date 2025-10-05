// app/_layout.tsx
import { initializeDatabase } from '@/src/data/database';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const initDb = async () => {
      try {
        const success = initializeDatabase();
        setDbInitialized(success);
        if (!success) {
          console.error('Failed to initialize database');
        }
      } catch (error) {
        console.error('Database initialization error:', error);
        setDbInitialized(false);
      }
    };

    initDb();
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