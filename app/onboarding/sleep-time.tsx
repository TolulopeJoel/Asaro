import { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    Keyboard,
    TouchableWithoutFeedback,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Hero, Screen, Text, ThemedButton, textStyle } from '@/src/components/ui';

export default function SleepTimeScreen() {
    const router = useRouter();
    const { colors, style: themeStyle, isLockedIn } = useTheme();

    const [hour, setHour] = useState('');
    const [minute, setMinute] = useState('');
    const [period, setPeriod] = useState<'AM' | 'PM'>('PM');
    const [error, setError] = useState<string | null>(null);

    const minuteInputRef = useRef<TextInput>(null);

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

        // STRICT VALIDATION: Don't allow numbers > 12
        if (val > 12) {
            return;
        }

        // Don't allow 00
        if (cleaned === '00') {
            return;
        }

        setHour(cleaned);
        setError(null);

        // AUTO-ADVANCE LOGIC
        // 1. If length is 2, we are definitely done (e.g. 10, 11, 12).
        if (cleaned.length === 2) {
            minuteInputRef.current?.focus();
        }
        // 2. If length is 1 and value > 1 (i.e. 2, 3, ... 9), it cannot be the first digit of a valid hour.
        //    (e.g. you can't have 20, 30, etc. in 12h format).
        //    So we assume they are done with the hour.
        else if (cleaned.length === 1 && val > 1) {
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

    const handleBlurHour = () => {
        if (hour.length === 1) {
            // Optional: pad with 0? Or just leave it. 
            // "9" is fine.
        }
    };

    const handleBlurMinute = () => {
        if (minute.length === 1) {
            setMinute('0' + minute);
        } else if (minute.length === 0 && hour.length > 0) {
            setMinute('00');
        }
    };

    const togglePeriod = () => {
        setPeriod(p => p === 'AM' ? 'PM' : 'AM');
    };

    const handleContinue = async () => {
        if (!hour || !minute) return;

        const h = parseInt(hour, 10);
        const m = parseInt(minute, 10);

        if (isNaN(h) || h < 1 || h > 12) {
            setError('Hour must be between 1 and 12');
            return;
        }

        if (isNaN(m) || m < 0 || m > 59) {
            setError('Minute must be between 00 and 59');
            return;
        }

        // Convert to Date object
        const now = new Date();
        const date = new Date(now);
        date.setSeconds(0);
        date.setMilliseconds(0);

        let hours24 = h;
        if (period === 'PM' && h < 12) hours24 += 12;
        if (period === 'AM' && h === 12) hours24 = 0;

        date.setHours(hours24, m);

        try {
            await AsyncStorage.setItem('sleep_time', date.toISOString());
            router.replace('/permissions');
        } catch (error) {
            console.error('Error saving sleep time:', error);
        }
    };

    const isFormValid = hour.length > 0 && minute.length > 0;

    if (isLockedIn) {
        /*
         * design/all-screens.html #sleep, the `.co` slot.
         *
         * The time itself is the colossal element — two fields set at the
         * giant's smaller step with an ochre colon between them — so the
         * screen's question can live in the mark rather than in a heading.
         */
        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <Screen edges={['top']}>
                    <View style={styles.colossalTop}>
                        <Text variant="tab">When do you turn in?</Text>
                        <Text variant="tab">2 of 3</Text>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <View style={styles.colossalBody}>
                            <View style={styles.colossalTimeRow}>
                                <TextInput
                                    style={[
                                        styles.colossalTimeInput,
                                        textStyle(themeStyle, 'heroSmall'),
                                        { color: error ? colors.danger : colors.textPrimary },
                                    ]}
                                    placeholder="10"
                                    placeholderTextColor={colors.textMuted}
                                    value={hour}
                                    onChangeText={handleHourChange}
                                    onBlur={handleBlurHour}
                                    keyboardType="number-pad"
                                    returnKeyType="next"
                                    maxLength={2}
                                    autoFocus
                                    onSubmitEditing={() => minuteInputRef.current?.focus()}
                                    accessibilityLabel="Hour"
                                />
                                <Text variant="heroSmall" tone="accent">:</Text>
                                <TextInput
                                    ref={minuteInputRef}
                                    style={[
                                        styles.colossalTimeInput,
                                        textStyle(themeStyle, 'heroSmall'),
                                        { color: error ? colors.danger : colors.textPrimary },
                                    ]}
                                    placeholder="00"
                                    placeholderTextColor={colors.textMuted}
                                    value={minute}
                                    onChangeText={handleMinuteChange}
                                    onBlur={handleBlurMinute}
                                    keyboardType="number-pad"
                                    returnKeyType="done"
                                    maxLength={2}
                                    accessibilityLabel="Minute"
                                />
                                <TouchableOpacity onPress={togglePeriod} activeOpacity={0.6} accessibilityRole="button">
                                    <Text variant="subtitle" tone="secondary">{period}</Text>
                                </TouchableOpacity>
                            </View>

                            <Text variant="label" style={styles.colossalGiantLabel}>
                                reminders stop at this hour
                            </Text>

                            <View style={[styles.rule, { backgroundColor: colors.border }]} />

                            <Text variant="sub" tone={error ? 'danger' : undefined}>
                                {error ?? 'Hour must be 1–12, minute 00–59.'}
                            </Text>
                        </View>

                        <View style={styles.colossalFooter}>
                            <ThemedButton label="Continue" block disabled={!isFormValid} onPress={handleContinue} />
                        </View>
                    </KeyboardAvoidingView>
                </Screen>
            </TouchableWithoutFeedback>
        );
    }

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Screen edges={['top']}>
                <Hero>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>Step 2 of 3</Text>
                    <Text variant="display" tone="inverse">Noted.</Text>
                </Hero>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.content}>
                        <View style={styles.textContainer}>
                            <View style={styles.introBlock}>

                                <Text variant="body" style={styles.introText}>
                                    I promise not to disturb your beauty sleep. But once you wake up? No mercy.
                                    {'\n\n'}
                                    I need to know when to let you rest.
                                </Text>
                            </View>

                            <Text variant="label" style={styles.label}>
                                What time do you usually go to sleep?
                            </Text>

                            <View style={styles.timeInputContainer}>
                                {/* Hour Input */}
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.textPrimary,
                                            borderBottomColor: error ? 'red' : colors.textPrimary,
                                            minWidth: 60,
                                            textAlign: 'center'
                                        }
                                    ]}
                                    placeholder="10"
                                    placeholderTextColor={colors.textMuted}
                                    value={hour}
                                    onChangeText={handleHourChange}
                                    onBlur={handleBlurHour}
                                    keyboardType="number-pad"
                                    returnKeyType="next"
                                    maxLength={2}
                                    autoFocus={true}
                                    onSubmitEditing={() => minuteInputRef.current?.focus()}
                                />

                                <Text variant="display" style={styles.separator}>:</Text>

                                {/* Minute Input */}
                                <TextInput
                                    ref={minuteInputRef}
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.textPrimary,
                                            borderBottomColor: error ? 'red' : colors.textPrimary,
                                            minWidth: 60,
                                            textAlign: 'center'
                                        }
                                    ]}
                                    placeholder="00"
                                    placeholderTextColor={colors.textMuted}
                                    value={minute}
                                    onChangeText={handleMinuteChange}
                                    onBlur={handleBlurMinute}
                                    keyboardType="number-pad"
                                    returnKeyType="done"
                                    maxLength={2}
                                />

                                {/* AM/PM Toggle */}
                                <TouchableOpacity onPress={togglePeriod} activeOpacity={0.6}>
                                    <Text variant="display" style={styles.periodText}>
                                        {period}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {error && (
                                <Text variant="bodySmall" tone="danger">
                                    {error}
                                </Text>
                            )}
                        </View>

                        <View style={styles.footer}>
                            <ScalePressable
                                style={[
                                    styles.button,
                                    {
                                        backgroundColor: isFormValid ? colors.textPrimary : colors.cardBackground,
                                        borderColor: isFormValid ? 'transparent' : colors.border,
                                        borderWidth: isFormValid ? 0 : 1,
                                        opacity: isFormValid ? 1 : 0.5
                                    }
                                ]}
                                onPress={handleContinue}
                                disabled={!isFormValid}
                            >
                                <Text style={[
                                    styles.buttonText,
                                    {
                                        color: isFormValid ? colors.background : colors.textSecondary,
                                    }
                                ]}>Continue</Text>
                            </ScalePressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Screen>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // ── Colossal ──────────────────────────────────────────────────────────
    colossalTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    colossalBody: {
        flex: 1,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xxl + Spacing.md,
    },
    colossalTimeRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    /** Fixed-width so the digits don't shift the colon as you type. */
    colossalTimeInput: {
        width: 120,
        textAlign: 'center',
        padding: 0,
    },
    /** `.co-giantl` under the time. */
    colossalGiantLabel: { marginTop: Spacing.lg },
    /** `.co-hr` */
    rule: { height: Spacing.border.hairline, marginVertical: Spacing.xl + 2 },
    colossalFooter: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingBottom: Spacing.layout.tabBarPadding,
    },
    keyboardView: {
        flex: 1,
    },
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
    heroStep: { marginBottom: Spacing.sm },
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
