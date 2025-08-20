// app/_layout.tsx
import { initializeDatabase } from '@/src/data/database';
import { Stack } from 'expo-router';
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
        <Text>Initializing database...</Text>
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Meditation Reminder' }} />
      <Stack.Screen name="test" options={{ title: 'Component Test' }} />
    </Stack>
  );
}