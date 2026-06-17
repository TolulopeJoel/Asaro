import { Stack } from 'expo-router';

export default function LibraryLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_bottom',
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: 'Library',
                }}
            />
            <Stack.Screen
                name="[id]"
                options={{
                    presentation: 'card',
                }}
            />
        </Stack>
    );
}
