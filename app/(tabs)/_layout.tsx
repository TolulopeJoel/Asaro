import { useTheme } from '@/src/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceEventEmitter, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { Tabs, useRouter } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRef } from 'react';
import { Spacing } from '@/src/theme/spacing';
import { ONE_LINE } from '@/src/theme/typography';
import { coachTarget } from '@/src/onboarding/coachTargets';

export default function TabLayout() {
    const { colors: themeColors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const lastPressTime = useRef<number>(0);
    const lastPressTab = useRef<string | null>(null);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                animation: 'none',
            }}
            tabBar={(props) => {
                const colors = themeColors;
                // The mockup's 30px foot, or the home indicator if it is taller.
                const foot = Math.max(insets.bottom, Spacing.layout.tabBarPadding);

                return (
                <View style={[
                    styles.tabBar,
                    {
                        backgroundColor: colors.tabBar,
                        // Cloth's bar is an indigo band and needs no line.
                        borderTopWidth: 0,
                        borderTopColor: colors.border,
                        paddingHorizontal: Spacing.layout.screenPadding,
                    },
                ]}>
                    {props.state.routes.map((route, index) => {
                        // Hide dynamic routes from the tab bar
                        if (route.name.includes('[id]')) return null;
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
                            /* The first-run walk points at each tab by name, and boxes the word, not the padding round it. */
                            <View
                                key={route.key}
                                ref={route.name === 'library' ? coachTarget('tab-library', { top: BAR_TOP, bottom: foot })
                                    : route.name === 'groups' ? coachTarget('tab-groups', { top: BAR_TOP, bottom: foot })
                                        : route.name === 'index' ? coachTarget('tab-home', { top: BAR_TOP, bottom: foot }) : undefined}
                                collapsable={false}
                                style={styles.flex}
                            >
                                {/* The bar's padding is inside the press, so the whole bar answers a tap, not just the word. */}
                                <ScalePressable
                                    style={[styles.tabFill, { paddingTop: BAR_TOP, paddingBottom: foot }]}
                                    onPress={onPress}
                                >
                                    {/*
                                      * The bar is type only. The design carries no icons
                                      * and no highlight pill: the active tab is the one
                                      * word in the foreground colour, which is the whole
                                      * mechanism.
                                      */}
                                    <Text
                                        variant="tab"
                                        {...ONE_LINE}
                                        style={{ color: shouldHighlight ? colors.tabLabelActive : colors.tabLabel }}
                                    >
                                        {label}
                                    </Text>
                                </ScalePressable>
                            </View>
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

/** The bar's padding above the labels. */
const BAR_TOP = 15;

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
    },
    flex: { flex: 1 },
    /** Fills its tab's width; its height is the label's plus the bar's padding, never squashed by a flex basis of 0. */
    tabFill: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
