import { isBatteryOptimizationDisabled } from '@/src/utils/notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform, Linking, View, StyleSheet } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Hero, Screen, Text, ThemedButton } from '@/src/components/ui';

/**
 * The Android battery-optimisation follow-up.
 *
 * design/all-screens.html #perms names this route alongside permissions.tsx —
 * one mockup slot, two screens in the same asking-for-something family. It
 * carries no copy of its own for battery, so this reuses the same composition
 * permissions.tsx builds (a band, one panel of reasons, a single button) with
 * battery-specific text rather than inventing a different layout.
 */
export default function BatteryOptimizationScreen() {
    const router = useRouter();
    const { colors, isLockedIn } = useTheme();

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

    /** Why the OS should leave the app alone — the mockup's row of reasons. */
    const REASONS = [
        'Your daily reading reminder, on time',
        'Follow-up nudges for the actions you set',
        'Nothing else runs in the background',
    ];

    if (isLockedIn) {
        /*
         * design/all-screens.html #perms, the `.co` slot. One giant per screen,
         * not always one — this ask carries none, same as Permissions.
         */
        return (
            <Screen>
                <View style={styles.colossalTop}>
                    <Text variant="tab">Battery</Text>
                </View>

                <View style={styles.colossalBody}>
                    <Text variant="display">Don&apos;t Let Me Sleep</Text>
                    <Text variant="sub" style={styles.colossalSub}>
                        Your phone will probably lie to you about how bad this is for the
                        battery. Àṣàrò needs to run in the background to keep its word.
                    </Text>

                    <View style={[styles.rule, { backgroundColor: colors.border }]} />

                    <Text variant="label">What this is for</Text>
                    {REASONS.map(reason => (
                        <View key={reason} style={[styles.colossalRow, { borderBottomColor: colors.border }]}>
                            <Text variant="reference" style={styles.reason}>{reason}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.colossalFooter}>
                    <ThemedButton label="Fix Settings" variant="accent" block onPress={handleFixSettings} />
                </View>
            </Screen>
        );
    }

    /*
     * design/all-screens.html #perms, the `.cl` slot — the same composition
     * Permissions builds: band, one panel of reasons, one button.
     */
    return (
        <Screen edges={[]}>
            <Hero ownsTopInset topPadding={64}>
                <Text variant="label" tone="onHero" style={styles.heroStep}>Almost there</Text>
                <Text variant="display" tone="onBand">Don&apos;t Let{'\n'}Me Sleep</Text>
            </Hero>

            <View style={styles.clothBody}>
                <Text variant="sub">
                    Your phone will probably lie to you about how bad this is for the
                    battery. Àṣàrò needs to run in the background to keep its word.
                </Text>

                <View style={[styles.clothPanel, { backgroundColor: colors.backgroundSubtle }]}>
                    <Text variant="label" style={styles.clothPanelLabel}>What this is for</Text>
                    {REASONS.map((reason, i) => (
                        <View key={reason}>
                            {i > 0 && <View style={[styles.clothHr, { backgroundColor: colors.border }]} />}
                            <Text variant="body">{reason}</Text>
                        </View>
                    ))}
                </View>

                <ThemedButton label="Fix Settings" variant="accent" block onPress={handleFixSettings} />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    /** The band's eyebrow: `margin:0 0 10px`. */
    heroStep: { marginBottom: 10 },

    // ── Cloth ─────────────────────────────────────────────────────────────
    clothBody: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    clothPanel: { padding: Spacing.layout.cardPadding },
    clothPanelLabel: { marginBottom: 7 },
    clothHr: { height: Spacing.border.hairline, marginVertical: 9 },

    // ── Colossal ──────────────────────────────────────────────────────────
    colossalTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    colossalBody: {
        flex: 1,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xxl + 12,
    },
    colossalSub: { marginTop: Spacing.layout.cardPadding },
    rule: { height: Spacing.border.hairline, marginVertical: Spacing.xl + 2 },
    colossalRow: {
        paddingVertical: Spacing.md + 3,
        borderBottomWidth: Spacing.border.hairline,
    },
    reason: { fontWeight: '500' },
    colossalFooter: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingBottom: Spacing.layout.tabBarPadding,
        gap: 10,
    },
});
