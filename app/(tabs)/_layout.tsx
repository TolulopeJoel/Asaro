import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { ScalePressable } from '@/src/components/ScalePressable';

export default function TabLayout() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const barHeight = 60 + insets.bottom;
    const waveHeight = 18;

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
                                const event = props.navigation.emit({
                                    type: 'tabPress',
                                    target: route.key,
                                    canPreventDefault: true,
                                });

                                if (!isFocused && !event.defaultPrevented) {
                                    props.navigation.navigate(route.name);
                                }
                            };

                            let iconName: any = 'ellipse-outline';
                            if (route.name === 'index') iconName = 'sparkles-outline';
                            else if (route.name === 'browse') iconName = 'albums-outline';
                            else if (route.name === 'plan') iconName = 'map-outline';
                            else if (route.name === 'groups') iconName = 'people-circle-outline';
                            else if (route.name === 'settings') iconName = 'options-outline';

                            const finalIcon = isFocused ? iconName.replace('-outline', '') : iconName;

                            return (
                                <ScalePressable
                                    key={route.key}
                                    style={styles.tabButton}
                                    onPress={onPress}
                                >
                                    <Ionicons
                                        name={finalIcon}
                                        size={23.5}
                                        color={isFocused ? colors.accent : colors.textTertiary}
                                    />
                                </ScalePressable>
                            );
                        })}
                    </View>
                </View>
            )}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="browse" />
            <Tabs.Screen name="plan" />
            <Tabs.Screen name="groups" />
            <Tabs.Screen name="settings" />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    tabBarBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0 },
    wave: { position: 'absolute', top: -18, left: 0, right: 0 },
    tabBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', flex: 1 },
    tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
});
