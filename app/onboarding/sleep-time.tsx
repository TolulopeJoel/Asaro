import { useEffect, useMemo, useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    Keyboard,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import {
    Asaro, Hero, Screen, START_DELAY_MS, Text, ThemedButton, textStyle,
    type AsaroAction, type AsaroHandle,
} from '@/src/components/ui';
import { Flip } from '@/src/components/onboarding/Flip';
import { onboardingStepLabel } from '@/src/utils/onboardingSteps';
import { useFootPadding } from '@/src/hooks/useScreenInsets';
import { clockLabel, reminderTimesFor, saveSleepTime, setupDailyNotifications } from '@/src/utils/notifications';

// The same window Settings offers: 8 PM to midnight.
const EARLIEST_HOUR = 8;
const LATEST_HOUR = 11;

/** What the sibling makes of each hour. */
const REACTIONS: Record<number, { action: AsaroAction; line: string }> = {
    8: { action: 'laugh', line: '8? You sleep like a baby o.' },
    9: { action: 'nod', line: '9. Sensible. I like it.' },
    10: { action: 'smug', line: 'Ehen. Normal person.' },
    11: { action: 'sideEye', line: '11? So you\u2019re one of those night people.' },
};
const HOLD_MS = 2500;

/** What each reminder is, in the order they escalate. */
const SLOT_GIST: Record<string, string> = {
    Midday: 'If you haven\u2019t read yet',
    Evening: 'Still nothing?',
    Late: 'Getting serious',
    Final: 'Last warning',
};

export default function SleepTimeScreen() {
    const router = useRouter();
    const { colors, style: themeStyle } = useTheme();

    const [hour, setHour] = useState('10');
    const [minute, setMinute] = useState('00');
    const [error, setError] = useState<string | null>(null);

    const minuteInputRef = useRef<TextInput>(null);
    const footPadding = useFootPadding();
    const face = useRef<AsaroHandle>(null);

    // The last complete, in-range time; a half-typed hour keeps showing it.
    const h = parseInt(hour, 10);
    const valid = h >= EARLIEST_HOUR && h <= LATEST_HOUR;
    const [shownHour, setShownHour] = useState(10);
    useEffect(() => { if (valid) setShownHour(h); }, [valid, h]);
    const shownMinute = Math.min(59, parseInt(minute, 10) || 0);
    const reaction = REACTIONS[shownHour];

    const plan = useMemo(() => {
        const sleep = { hour: shownHour + 12, minute: shownMinute };
        return [
            ...reminderTimesFor(sleep).map((slot) => ({ at: clockLabel(slot.totalMin), gist: SLOT_GIST[slot.name] ?? slot.name })),
            { at: clockLabel(sleep.hour * 60 + sleep.minute), gist: 'I stop. Sleep well.' },
        ];
    }, [shownHour, shownMinute]);

    // A new hour, a new reaction: held long enough to be seen, then let go.
    useEffect(() => {
        const start = setTimeout(() => face.current?.play(reaction.action, { hold: true }), START_DELAY_MS);
        const release = setTimeout(() => face.current?.rest(), START_DELAY_MS + HOLD_MS);
        return () => { clearTimeout(start); clearTimeout(release); };
    }, [reaction]);

    const handleHourChange = (text: string) => {
        // Only allow numbers
        const cleaned = text.replace(/[^0-9]/g, '');

        if (cleaned.length > 2) return;

        const val = parseInt(cleaned, 10);

        // Handle empty
        if (cleaned === '') {
            setHour('');
            setError(null);
            return;
        }

        // Only 8–11, or the 1 that starts 10 or 11.
        const typable = cleaned.length === 1
            ? val === 1 || (val >= EARLIEST_HOUR && val <= 9)
            : val >= 10 && val <= LATEST_HOUR;
        if (!typable) return;

        setHour(cleaned);
        setError(null);

        if (val >= EARLIEST_HOUR) {
            minuteInputRef.current?.focus();
        }
    };

    const handleMinuteChange = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length > 2) return;

        const val = parseInt(cleaned, 10);

        if (cleaned !== '' && val > 59) {
            return;
        }

        setMinute(cleaned);
        setError(null);

        // Auto-dismiss keyboard if done
        if (cleaned.length === 2) {
            Keyboard.dismiss();
        }
        // If first digit > 5 (i.e. 6-9), it can't be first digit of valid minute (max 59).
        else if (cleaned.length === 1 && val > 5) {
            Keyboard.dismiss();
        }
    };

    const handleBlurMinute = () => {
        if (minute.length === 1) {
            setMinute('0' + minute);
        } else if (minute.length === 0 && hour.length > 0) {
            setMinute('00');
        }
    };

    const handleContinue = async () => {
        if (!hour || !minute) return;

        const h = parseInt(hour, 10);
        const m = parseInt(minute, 10);

        if (isNaN(h) || h < EARLIEST_HOUR || h > LATEST_HOUR) {
            setError('Pick a time between 8:00 and 11:59 PM');
            return;
        }

        if (isNaN(m) || m < 0 || m > 59) {
            setError('Minute must be between 00 and 59');
            return;
        }

        try {
            await saveSleepTime({ hour: h + 12, minute: m });
            // Slot times come from the sleep time; a no-op until notifications are allowed.
            setupDailyNotifications(false, { force: true }).catch(error =>
                console.error('Failed to reschedule after sleep time:', error)
            );
            router.replace('/permissions');
        } catch (error) {
            console.error('Error saving sleep time:', error);
        }
    };

    const isFormValid = hour.length > 0 && minute.length > 0;

    /*
     * design/all-screens.html #sleep, the `.cl` slot. Cloth states the step and
     * the question on its band, then sets the two fields inside one centred
     * `.cl-panel` with an ochre colon between them — the panel is what makes
     * the pair read as a single time rather than two numbers.
     */
    return (
        <Screen edges={[]}>
            {/* The band scrolls with the fields so a short screen with the
              * keyboard up still has room for them. `handled` lets a tap on
              * empty ground dismiss the keyboard while buttons still work. */}
            <ScrollView
                style={styles.keyboardView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>{onboardingStepLabel('sleep-time')}</Text>
                    <Text variant="display" tone="onBand">What time{'\n'}do you sleep?</Text>
                </Hero>
                <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                    <View style={styles.speech}>
                        <Asaro ref={face} size={74} />
                        <Text variant="body" style={styles.speechText} accessibilityLiveRegion="polite">
                            {reaction.line}
                        </Text>
                    </View>

                    <View style={[styles.clothPanel, { backgroundColor: colors.backgroundSubtle }]}>
                        <TextInput
                            style={[
                                styles.clothTimeInput,
                                textStyle(themeStyle, 'display'),
                                { backgroundColor: colors.background, color: error ? colors.danger : colors.textPrimary },
                            ]}
                            placeholder="10"
                            placeholderTextColor={colors.textMuted}
                            value={hour}
                            onChangeText={handleHourChange}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            returnKeyType="next"
                            maxLength={2}
                            onSubmitEditing={() => minuteInputRef.current?.focus()}
                            accessibilityLabel="Hour"
                        />
                        <Text variant="display" tone="accent">:</Text>
                        <TextInput
                            ref={minuteInputRef}
                            style={[
                                styles.clothTimeInput,
                                textStyle(themeStyle, 'display'),
                                { backgroundColor: colors.background, color: error ? colors.danger : colors.textPrimary },
                            ]}
                            placeholder="00"
                            placeholderTextColor={colors.textMuted}
                            value={minute}
                            onChangeText={handleMinuteChange}
                            onBlur={handleBlurMinute}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            returnKeyType="done"
                            maxLength={2}
                            accessibilityLabel="Minute"
                        />
                        <Text variant="tab" tone="secondary">PM</Text>
                    </View>

                    {error && <Text variant="bodySmall" tone="danger">{error}</Text>}

                    {/* The real schedule for this time: each row flips when its time changes. */}
                    <View style={[styles.planPanel, { backgroundColor: colors.backgroundSubtle }]}>
                        <Text variant="label" style={styles.planLabel}>This is when I&apos;ll come</Text>
                        {plan.map((row, i) => (
                            <Flip key={row.gist} flipKey={row.at} delay={i * 120} stretch puff={false}>
                                <View style={[
                                    styles.planRow,
                                    i > 0 && { borderTopColor: colors.border, borderTopWidth: Spacing.border.hairline },
                                ]}>
                                    <Text variant="reference" style={styles.planTime}>{row.at}</Text>
                                    <Text variant="meta" tone="secondary">{row.gist}</Text>
                                </View>
                            </Flip>
                        ))}
                    </View>

                    <View style={styles.foot}>
                        <ThemedButton
                            label="Continue"
                            block
                            disabled={!isFormValid}
                            onPress={handleContinue}
                        />
                    </View>
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    /** `.cl-body{padding-top:30px; gap:18px}` */
    clothBody: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    speech: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    speechText: { flex: 1 },
    planPanel: { padding: Spacing.layout.cardPadding },
    planLabel: { marginBottom: 7 },
    planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 },
    planTime: { minWidth: 88 },
    /** The button sits at the foot, clear of the schedule. */
    foot: { marginTop: 'auto', paddingTop: Spacing.xl },
    /** One panel holding the whole time, so it reads as a time. */
    clothPanel: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: Spacing.xl + 2,
    },
    clothTimeInput: {
        width: 86,
        textAlign: 'center',
        paddingVertical: Spacing.md,
    },

    keyboardView: {
        flex: 1,
    },
    scrollContent: { flexGrow: 1 },
    content: {
        flex: 1,
        padding: Spacing.layout.screenPadding,
        justifyContent: 'space-between',
        paddingTop: Spacing.layout.screenPadding,
    },
    textContainer: {
        flex: 1,
        width: '100%',
    },
    introBlock: {
        marginBottom: Spacing.xxxl * 1.5,
    },
    /** The band's eyebrow: `margin:0 0 10px`. */
    heroStep: { marginBottom: 10 },
    introText: { opacity: 0.8 },
    label: { opacity: 0.5, marginBottom: Spacing.xl, textAlign: 'center' },
    timeInputContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    // The time is this screen's one large element, so it takes the display
    // step rather than a size invented here.
    input: {
        fontSize: Typography.size.display,
        lineHeight: Typography.lineHeight.display,
        borderBottomWidth: Spacing.border.strong,
        paddingBottom: Spacing.xs,
        letterSpacing: Typography.letterSpacing.tighter,
    },
    separator: { opacity: 0.3, marginHorizontal: Spacing.xs },
    periodText: { marginLeft: Spacing.md, opacity: 0.8 },
    errorText: {
        marginTop: Spacing.md,
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        textAlign: 'center',
    },
    footer: {
        paddingTop: Spacing.xxl,
    },
    button: {
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
