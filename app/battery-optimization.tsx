import { isBatteryOptimizationDisabled } from '@/src/utils/notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Text, View, StyleSheet, Platform, Linking } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BatteryCharging, BatteryWarning, ArrowRight } from 'lucide-react-native';
import { ScalePressable } from '@/src/components/ScalePressable';
import * as IntentLauncher from 'expo-intent-launcher';

export default function BatteryOptimizationScreen() {
    const router = useRouter();
    const { colors } = useTheme();

    const checkBatteryOptimization = async () => {
        if (Platform.OS !== 'android') {
            router.replace('/');
            return;
        }

        const isDisabled = await isBatteryOptimizationDisabled();
        if (isDisabled) {
            router.replace('/');
        }
    };

    useEffect(() => {
        checkBatteryOptimization();

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                checkBatteryOptimization();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const handleFixSettings = async () => {
        if (Platform.OS === 'android') {
            const pkg = 'com.asaro.meditation';

            try {
                await IntentLauncher.startActivityAsync(
                    'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
                    {
                        data: `package:${pkg}`
                    }
                );
            } catch (error) {


                try {
                    await IntentLauncher.startActivityAsync(
                        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
                    );
                } catch (error2) {

                    Linking.openSettings();
                }
            }
        } else {
            Linking.openSettings();
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(225, 143, 67, 0.1)' }]}>
                        <BatteryCharging size={Typography.size.display} color={colors.primary} />
                    </View>
                </View>

                <View style={styles.textContainer}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        Don't Let Me Sleep
                    </Text>

                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        To ensure you receive your daily reflections, Àṣàrò needs to run in the background.
                    </Text>

                    <View style={[styles.infoBox, { backgroundColor: colors.cardBackground, borderColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', gap: Spacing.md }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <BatteryWarning size={Typography.size.xl} color={colors.textSecondary} style={{ marginRight: Spacing.sm }} />
                            <Text style={[styles.infoText, { color: colors.textSecondary, fontStyle: 'italic', opacity: 0.8 }]}>
                                Your phone will probably lie to you about how bad this is for your battery. But do you think Àṣàrò would ever harm you? 🥹
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.footer}>
                    <ScalePressable
                        style={[styles.button, { backgroundColor: colors.textPrimary }]}
                        onPress={handleFixSettings}
                    >
                        <Text style={[styles.buttonText, { color: colors.background }]}>Fix Settings</Text>
                        <ArrowRight size={Typography.size.lg} color={colors.background} style={{ marginLeft: Spacing.sm }} />
                    </ScalePressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    circle: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
    },
    content: {
        flex: 1,
        padding: Spacing.layout.screenPadding,
        justifyContent: 'space-between',
        paddingTop: Spacing.layout.screenPadding,
    },
    header: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: Spacing.sm,
        letterSpacing: -1.5,
    },
    description: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.medium,
        textAlign: 'center',
        lineHeight: Typography.lineHeight.xl,
        opacity: 0.7,
        letterSpacing: -0.2,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        width: '100%',
        marginTop: Spacing.xl,
    },
    infoText: {
        fontSize: Typography.size.md,
        flex: 1,
        lineHeight: Typography.lineHeight.md,
        fontWeight: Typography.weight.medium,
    },
    footer: {
        paddingTop: Spacing.xxl,
    },
    button: {
        flexDirection: 'row',
        paddingVertical: 20,
        borderRadius: Spacing.borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonText: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.3,
    },
});
