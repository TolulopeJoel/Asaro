import { useTheme } from '@/src/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useRef, useState } from 'react';
import Index from './index';
import Plan from './plan';
import Browse from './browse';
import Settings from './settings';
import { ScalePressable } from '@/src/components/ScalePressable';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

export default function TabLayout() {
    const { colors } = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const barHeight = 60 + insets.bottom;
    const waveHeight = 18;
    const pagerRef = useRef<PagerView>(null);

    const tabs = [
        { name: 'Home', path: '/', icon: 'prism-outline' as const, component: Index },
        { name: 'Library', path: '/browse', icon: 'square-outline' as const, component: Browse },
        { name: 'Plan', path: '/plan', icon: 'book-outline' as const, component: Plan },
        { name: 'Settings', path: '/settings', icon: 'ellipse-outline' as const, component: Settings },
    ];

    const activeIndex = useMemo(() => {
        const index = tabs.findIndex(tab =>
            tab.path === '/' ? (pathname === '/' || pathname === '/(tabs)') : pathname.includes(tab.path)
        );
        return index === -1 ? 0 : index;
    }, [pathname]);

    // Sync PagerView with route
    useEffect(() => {
        pagerRef.current?.setPage(activeIndex);
    }, [activeIndex]);


    const handleTabPress = (index: number) => {
        const targetPath = tabs[index].path;
        router.replace(targetPath as any);
    };

    return (
        <View style={styles.container}>
            {/* Tab Content */}
            <PagerView
                ref={pagerRef}
                style={styles.pager}
                initialPage={activeIndex}
                scrollEnabled={false}
            >
                {tabs.map((tab, index) => (
                    <View key={index} style={styles.page}>
                        <tab.component />
                    </View>
                ))}
            </PagerView>

            {/* Custom Tab Bar */}
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
                    {tabs.map((tab, index) => (
                        <ScalePressable
                            key={index}
                            style={styles.tabButton}
                            onPress={() => handleTabPress(index)}
                        >
                            <Ionicons
                                name={tab.icon}
                                size={24}
                                color={activeIndex === index ? colors.accent : colors.textTertiary}
                            />
                        </ScalePressable>
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    pager: {
        flex: 1,
    },
    page: {
        flex: 1,
    },
    tabBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    tabBarBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
    },
    wave: {
        position: 'absolute',
        top: -18,
        left: 0,
        right: 0,
    },
    tabBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        flex: 1,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
});
