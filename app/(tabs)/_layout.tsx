import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceEventEmitter, StyleSheet, View, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRef } from 'react';

export default function TabLayout() {
    const { colors } = useTheme();
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
            tabBar={(props) => (
                <View style={[
                    styles.tabBar,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.border,
                        bottom: insets.bottom > 0 ? insets.bottom : 24,
                        // Bottom corners match the phone's screen corner radius
                        borderBottomLeftRadius: insets.bottom > 0 ? 44 : 20,
                        borderBottomRightRadius: insets.bottom > 0 ? 44 : 20,
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

                        let iconName: any = 'ellipse-outline';
                        if (route.name === 'index') iconName = 'home-outline';
                        else if (route.name === 'library') iconName = 'albums-outline';
                        else if (route.name === 'groups') iconName = 'people-circle-outline';

                        const finalIcon = shouldHighlight ? iconName.replace('-outline', '') : iconName;

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
                                    shouldHighlight && { backgroundColor: colors.background },
                                ]}>
                                    <Ionicons
                                        name={finalIcon}
                                        size={22}
                                        color={shouldHighlight ? colors.accent : colors.textTertiary}
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
            )}
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
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 3,
    },
    tabLabel: {
        fontSize: 11,
        letterSpacing: 0.2,
    },
});