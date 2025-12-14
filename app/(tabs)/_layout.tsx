import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

export default function TabLayout() {
    const { colors, isDark } = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    backgroundColor: colors.cardBackground,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    height: Platform.OS === 'ios' ? 88 : 60,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
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
                        <Ionicons name="triangle-outline" size={size} color={color} />
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
