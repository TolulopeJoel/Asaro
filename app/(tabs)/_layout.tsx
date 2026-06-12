import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceEventEmitter, StyleSheet, View, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRef } from 'react';

export default function TabLayout() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const barHeight = 60 + insets.bottom;
    const waveHeight = 18;
    const router = useRouter();
    const lastPressTime = useRef<number>(0);
    const lastPressTab = useRef<string | null>(null);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    height: barHeight,
                    borderTopWidth: 0,
                    backgroundColor: 'transparent',
                    elevation: 0,
                },
                tabBarShowLabel: false,
                animation: 'none',
            }}
            tabBar={(props) => (
                <View style={[styles.tabBarContainer, { height: barHeight }]}>
                    {/* Wave Background */}
                    <View style={[styles.tabBarBackground, { backgroundColor: colors.background }]}>
                        <Svg
                            width="100%"
                            height={barHeight + waveHeight}
                            viewBox={`0 0 100 ${barHeight + waveHeight}`}
                            preserveAspectRatio="none"
                            style={styles.wave}
                        >
                            <Path
                                d={`M0,${waveHeight}
                                   C16.7,${waveHeight - 5} 33.3,${waveHeight + 5} 50,${waveHeight}
                                   S83.3,${waveHeight - 5} 100,${waveHeight}
                                   L100,${barHeight + waveHeight} L0,${barHeight + waveHeight} Z`}
                                fill={colors.cardBackground}
                            />
                        </Svg>
                    </View>

                    {/* Tab Buttons */}
                    <View style={[styles.tabBar, { paddingBottom: insets.bottom, paddingTop: 8 }]}>
                        {props.state.routes.map((route, index) => {
                            const { options } = props.descriptors[route.key];
                            const isFocused = props.state.index === index;

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
                            if (route.name === 'index') iconName = 'home';
                            else if (route.name === 'library') iconName = 'albums';
                            else if (route.name === 'groups') iconName = 'people-circle';

                            const finalIcon = isFocused ? iconName.replace('-outline', '') : iconName;

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
                                    <Ionicons
                                        name={finalIcon}
                                        size={22}
                                        color={isFocused ? colors.accent : colors.textTertiary}
                                        style={{ marginBottom: 2 }}
                                    />
                                    <Text style={[
                                        styles.tabLabel,
                                        {
                                            color: isFocused ? colors.accent : colors.textTertiary,
                                            fontWeight: isFocused ? '600' : '500'
                                        }
                                    ]}>
                                        {label}
                                    </Text>
                                </ScalePressable>
                            );
                        })}
                    </View>
                </View>
            )}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="library" />
            <Tabs.Screen name="groups" />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    tabBarBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0 },
    wave: { position: 'absolute', top: -18, left: 0, right: 0 },
    tabBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', flex: 1 },
    tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    tabLabel: { fontSize: 11, marginTop: 1 },
});
