import { isBatteryOptimizationDisabled, openBatteryOptimizationSettings } from '@/src/utils/notifications';
import { needsOemAutoStartStep, oemAutoStartLabel, openAutoStartSettings } from '@/src/utils/oemRestrictions';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { useFootPadding } from '@/src/hooks/useScreenInsets';
import { Asaro, Hero, Screen, Text, ThemedButton, type AsaroHandle } from '@/src/components/ui';
import { Zzz } from '@/src/components/onboarding/Zzz';
import { onboardingStepLabel } from '@/src/utils/onboardingSteps';

/**
 * The Android battery-optimisation follow-up.
 *
 * design/all-screens.html #perms names this route alongside permissions.tsx —
 * one mockup slot, two screens in the same asking-for-something family. It
 * carries no copy of its own for battery, so this reuses the same composition
 * permissions.tsx builds (a band, one panel of reasons, a single button) with
 * battery-specific text rather than inventing a different layout.
 */
/** One nod-off and jerk awake, and a breath before the next. */
const DOZE_EVERY_MS = 3600;
/** Long enough to see him wake and celebrate before the page goes. */
const AWAKE_MS = 1800;

export default function BatteryOptimizationScreen() {
    const router = useRouter();
    const footPadding = useFootPadding();
    const { colors } = useTheme();
    const face = useRef<AsaroHandle>(null);
    // The phone is putting him to sleep until the exemption is granted.
    const [awake, setAwake] = useState(false);

    useEffect(() => {
        if (awake) return;
        face.current?.play('doze');
        const id = setInterval(() => face.current?.play('doze'), DOZE_EVERY_MS);
        return () => clearInterval(id);
    }, [awake]);

    const checkBatteryOptimization = async (fromSettings: boolean) => {
        if (Platform.OS !== 'android') {
            router.replace('/');
            return;
        }

        const isDisabled = await isBatteryOptimizationDisabled();
        if (!isDisabled) return;
        // Already fine on arrival: nothing to celebrate, just move on.
        if (!fromSettings) {
            router.replace('/');
            return;
        }
        setAwake(true);
        face.current?.play('celebrate');
        setTimeout(() => router.replace('/'), AWAKE_MS);
    };

    useEffect(() => {
        checkBatteryOptimization(false);

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                checkBatteryOptimization(true);
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const handleFixSettings = openBatteryOptimizationSettings;

    /*
     * The second half of the ask, on phones that have one.
     *
     * Tecno, Infinix and itel run HiOS/XOS, where Phone Master keeps its own
     * auto-start list above the AOSP battery whitelist. An app that is absent
     * from it gets force-stopped, and a force-stop cancels every alarm the
     * reminder schedule is built on — so a user can pass the button above and
     * still never hear from Àṣàrò again. There is no permission to request and
     * no state to read back; the list has to be opened and toggled by hand.
     */
    const showAutoStart = Platform.OS === 'android' && needsOemAutoStartStep();

    const handleAutoStart = async () => {
        await openAutoStartSettings();
    };

    /** Why the OS should leave the app alone — the mockup's row of reasons. */
    const REASONS = [
        'Your daily reading reminder, on time',
        'Follow-up nudges for the actions you set',
        'Nothing else runs in the background',
        ...(showAutoStart
            ? [`Auto-start in ${oemAutoStartLabel()}, or your phone will close Àṣàrò and the reminders stop`]
            : []),
    ];

    /*
     * design/all-screens.html #perms, the `.cl` slot — the same composition
     * Permissions builds: band, one panel of reasons, one button.
     */
    return (
        <Screen edges={[]}>
            {/* Scrolls: on a short screen or at a large font size the last
              * button would otherwise fall under the nav bar or off screen. */}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>{onboardingStepLabel('battery-optimization') ?? 'One more thing'}</Text>
                    <Text variant="display" tone="onBand">Don&apos;t Let{'\n'}Me Sleep</Text>
                </Hero>

                <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                    <View style={styles.speech}>
                        <View>
                            <Asaro ref={face} size={74} />
                            {!awake && <Zzz />}
                        </View>
                        <Text variant="body" style={styles.speechText} accessibilityLiveRegion="polite">
                            {awake
                                ? 'Ehen, I\u2019m awake. Thank you o. Now we can work.'
                                : 'My eyes are closing o. Your phone keeps putting me to sleep, and it will tell you this is bad for the battery. It\u2019s lying. Let me stay awake.'}
                        </Text>
                    </View>

                    <View style={[styles.clothPanel, { backgroundColor: colors.backgroundSubtle }]}>
                        <Text variant="label" style={styles.clothPanelLabel}>What this is for</Text>
                        {REASONS.map((reason, i) => (
                            <View key={reason}>
                                {i > 0 && <View style={[styles.clothHr, { backgroundColor: colors.border }]} />}
                                <Text variant="body">{reason}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.foot}>
                        <ThemedButton label="Fix Settings" block onPress={handleFixSettings} />
                        {showAutoStart && (
                            <ThemedButton
                                label={`Allow Auto-Start (${oemAutoStartLabel()})`}
                                variant="secondary"
                                block
                                onPress={handleAutoStart}
                            />
                        )}
                    </View>
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    speech: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    speechText: { flex: 1 },
    /** Buttons sit at the foot, clear of the face and the reasons. */
    foot: { marginTop: 'auto', paddingTop: Spacing.xl, gap: Spacing.md },
    /** The band's eyebrow: `margin:0 0 10px`. */
    heroStep: { marginBottom: 10 },
    scrollContent: { flexGrow: 1 },

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

});
