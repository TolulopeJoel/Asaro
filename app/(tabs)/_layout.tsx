import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    backgroundColor: colors.cardBackground,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.textTertiary,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="prism-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="browse"
                options={{
                    title: 'Library',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="square-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="ellipse-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
