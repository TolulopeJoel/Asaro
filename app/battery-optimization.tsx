import { isBatteryOptimizationDisabled } from '@/src/utils/notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Text, View, StyleSheet, TouchableOpacity, Platform, Linking, Dimensions } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as IntentLauncher from 'expo-intent-launcher';

const { width } = Dimensions.get('window');

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
                console.log('Could not open battery optimization, trying alternative:', error);

                try {
                    await IntentLauncher.startActivityAsync(
                        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
                    );
                } catch (error2) {
                    console.log('Could not open battery settings, using app settings:', error2);
                    Linking.openSettings();
                }
            }
        } else {
            Linking.openSettings();
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Decorative background elements */}
            <View style={[styles.circle, { backgroundColor: colors.primary, opacity: 0.05, top: -50, right: -50 }]} />
            <View style={[styles.circle, { backgroundColor: colors.primary, opacity: 0.03, bottom: 100, left: -100, width: 300, height: 300, borderRadius: 150 }]} />

            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(225, 143, 67, 0.1)' }]}>
                        <Ionicons name="battery-charging" size={Typography.size.display} color={colors.primary} />
                    </View>
                </View>

                <View style={styles.textContainer}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        Don't Let Me Sleep
                    </Text>

                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        To ensure you receive your daily reflections, Àṣàrò needs to run in the background.
                    </Text>

                    <View style={[styles.infoBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Ionicons name="information-circle-outline" size={Typography.size.xl} color={colors.textSecondary} style={{ marginRight: Spacing.sm }} />
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            Please disable battery optimization for this app.
                        </Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                        onPress={handleFixSettings}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>Fix Settings</Text>
                        <Ionicons name="arrow-forward" size={Typography.size.xl} color="#FFF" style={{ marginLeft: Spacing.sm }} />
                    </TouchableOpacity>
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
        padding: Spacing.xxl,
        justifyContent: 'space-between',
    },
    header: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        padding: Spacing.xl,
        borderRadius: Spacing.borderRadius.xl,
    },
    textContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.bold,
        textAlign: 'center',
        marginBottom: Spacing.lg,
        letterSpacing: Typography.letterSpacing.tight,
    },
    description: {
        fontSize: Typography.size.lg,
        textAlign: 'center',
        lineHeight: Typography.lineHeight.lg,
        marginBottom: Spacing.xxl,
        opacity: 0.8,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        width: '100%',
    },
    infoText: {
        fontSize: Typography.size.md,
        flex: 1,
        lineHeight: Typography.lineHeight.md,
    },
    footer: {
        paddingTop: Spacing.xxl,
    },
    button: {
        flexDirection: 'row',
        paddingVertical: 18,
        borderRadius: Spacing.borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.bold,
    },
});
