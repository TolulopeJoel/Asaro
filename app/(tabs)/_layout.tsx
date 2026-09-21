import { useTheme } from '@/src/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceEventEmitter, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { Tabs, useRouter } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRef, useEffect } from 'react';
import { Spacing } from '@/src/theme/spacing';

export default function TabLayout() {
    const { colors: themeColors, isLockedIn } = useTheme();
    const lockedInMode = isLockedIn;
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
                const colors = themeColors;

                return (
                <View style={[
                    styles.tabBar,
                    {
                        backgroundColor: colors.tabBar,
                        // Cloth's bar is an indigo band and needs no line; Colossal's
                        // is black on black, so the hairline is the only thing
                        // separating it from the screen (.co-tabs border-top).
                        borderTopWidth: isLockedIn ? StyleSheet.hairlineWidth : 0,
                        borderTopColor: colors.border,
                        paddingHorizontal: isLockedIn
                            ? Spacing.layout.screenPaddingTight
                            : Spacing.layout.screenPadding,
                        paddingTop: isLockedIn ? Spacing.lg : 15,
                        // The mockup's 30px foot, or the home indicator if it is taller.
                        paddingBottom: Math.max(insets.bottom, Spacing.layout.tabBarPadding),
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
                                {/*
                                  * The bar is type only. The design carries no icons
                                  * and no highlight pill: the active tab is the one
                                  * word in the foreground colour (.co-tab.on), which
                                  * is the whole mechanism in both styles.
                                  */}
                                <Text
                                    variant="tab"
                                    style={{ color: shouldHighlight ? colors.tabLabelActive : colors.tabLabel }}
                                >
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
        flexDirection: 'row',
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
