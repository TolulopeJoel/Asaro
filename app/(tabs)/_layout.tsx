import { useTheme } from '@/src/theme/ThemeContext';
import { Colors } from '@/src/theme/colors';
import { Home, Library, Users, Circle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceEventEmitter, StyleSheet, View, Text } from 'react-native';
import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRef, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import { Spacing } from '@/src/theme/spacing';

export default function TabLayout() {
    const { colors: themeColors, isLockedIn: lockedInMode } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const lastPressTime = useRef<number>(0);
    const lastPressTab = useRef<string | null>(null);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('locked-in-mode-changed', (val: boolean) => {
            // Turning the mode on hides the Groups button, but that alone does not move
            // you off the Groups screen — you'd be left on a hidden tab with nothing
            // highlighted in the bar. Send the user to Home, which is the mode's surface.
            if (val) router.navigate('/(tabs)');
        });
        return () => subscription.remove();
    }, [router]);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                animation: 'none',
            }}
            tabBar={(props) => {
                // The tab bar itself follows whichever screen is actually in view —
                // only Home is re-skinned for Locked In Mode, so the bar should only
                // go stark while Home is focused, not globally whenever the setting
                // is on. That's what kept it mismatched on Library.
                const focusedRouteName = props.state.routes[props.state.index]?.name;
                const colors = themeColors;

                return (
                <View style={[
                    styles.tabBar,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.border,
                        bottom: insets.bottom > 0 ? insets.bottom : 24,
                        // Bottom corners match the phone's screen corner radius
                        borderBottomLeftRadius: insets.bottom > 0 ? 34 : 20,
                        borderBottomRightRadius: insets.bottom > 0 ? 34 : 20,
                    },
                ]}>
                    {props.state.routes.map((route, index) => {
                        // Hide dynamic routes from the tab bar
                        if (route.name.includes('[id]')) return null;
                        // Locked In Mode hides the social surface too, not just home clutter
                        if (route.name === 'groups' && lockedInMode) return null;

                        const isFocused = props.state.index === index;
                        const shouldHighlight = isFocused;

                        const onPress = () => {
                            const now = Date.now();
                            const isSameTab = props.state.index === index;

                            if (isSameTab) {
                                DeviceEventEmitter.emit(`tab-press-top-${route.name}`);

                                if (route.name === 'groups' && now - lastPressTime.current < 500) {
                                    router.replace('/(tabs)/groups');
                                }

                                lastPressTime.current = now;
                                lastPressTab.current = route.name;
                                return;
                            }

                            lastPressTime.current = now;
                            lastPressTab.current = route.name;

                            const event = props.navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isSameTab && !event.defaultPrevented) {
                                props.navigation.navigate(route.name);
                            }
                        };

                        const IconComponent =
                            route.name === 'index' ? Home :
                                route.name === 'library' ? Library :
                                    route.name === 'groups' ? Users :
                                        Circle;

                        let label = '';
                        if (route.name === 'index') label = 'Home';
                        else if (route.name === 'library') label = 'Library';
                        else if (route.name === 'groups') label = 'Groups';

                        return (
                            <ScalePressable
                                key={route.key}
                                style={styles.tabButton}
                                onPress={onPress}
                            >
                                <View style={[
                                    styles.iconWrap,
                                    shouldHighlight ? { backgroundColor: colors.background } : null,
                                ]}>
                                    <IconComponent
                                        size={22}
                                        color={shouldHighlight ? colors.accent : colors.textTertiary}
                                        strokeWidth={shouldHighlight ? 2.5 : 2}
                                    />
                                </View>
                                <Text style={[
                                    styles.tabLabel,
                                    {
                                        color: shouldHighlight ? colors.accent : colors.textTertiary,
                                        fontWeight: shouldHighlight ? '600' : '400',
                                    },
                                ]}>
                                    {label}
                                </Text>
                            </ScalePressable>
                        );
                    })}
                </View>
                );
            }}
        >
            <Tabs.Screen name="index" options={{ title: 'Home' }} />
            <Tabs.Screen name="library" options={{ title: 'Library' }} />
            <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        paddingTop: 12,
        paddingBottom: 12,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        // Bottom radius set dynamically via inline style
        borderWidth: StyleSheet.hairlineWidth,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 20,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    iconWrap: {
        width: 60,
        height: 34,
        borderRadius: Spacing.borderRadius.lg,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 3,
    },
    tabLabel: {
        fontSize: 10,
        letterSpacing: 0.2,
    },
});