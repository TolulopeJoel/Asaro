import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

export default function TabLayout() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const barHeight = 60 + insets.bottom;
    const waveHeight = 18;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    borderTopColor: 'transparent',
                    elevation: 0,
                    shadowOpacity: 0,
                    height: barHeight,
                    paddingBottom: insets.bottom,
                    paddingTop: 8,
                },
                tabBarBackground: () => (
                    <View style={{ flex: 1, position: 'relative', backgroundColor: colors.background }}>
                        <Svg
                            width="100%"
                            height={barHeight + waveHeight}
                            viewBox={`0 0 100 ${barHeight + waveHeight}`}
                            preserveAspectRatio="none"
                            style={{ position: 'absolute', top: -waveHeight, left: 0, right: 0 }}
                        >
                            <Path
                                // Smooth twin-crest wave for a cleaner, premium look
                                d={`M0,${waveHeight}
                                   C16.7,${waveHeight - 5} 33.3,${waveHeight + 5} 50,${waveHeight}
                                   S83.3,${waveHeight - 5} 100,${waveHeight}
                                   L100,${barHeight + waveHeight} L0,${barHeight + waveHeight} Z`}
                                fill={colors.cardBackground}
                            />
                        </Svg>
                    </View>
                ),
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
