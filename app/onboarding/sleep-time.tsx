import { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    Keyboard,
    TouchableWithoutFeedback,
    KeyboardAvoidingView,
    TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { Hero, Screen, Text, ThemedButton, textStyle } from '@/src/components/ui';
import { KEYBOARD_BEHAVIOR } from '@/src/utils/keyboard';

export default function SleepTimeScreen() {
    const router = useRouter();
    const { colors, style: themeStyle } = useTheme();

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

    /*
     * design/all-screens.html #sleep, the `.cl` slot. Cloth states the step and
     * the question on its band, then sets the two fields inside one centred
     * `.cl-panel` with an ochre colon between them — the panel is what makes
     * the pair read as a single time rather than two numbers.
     */
    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Screen edges={[]}>
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>Step 2 of 3</Text>
                    <Text variant="display" tone="onBand">When do you{'\n'}turn in?</Text>
                </Hero>
                <KeyboardAvoidingView
                    behavior={KEYBOARD_BEHAVIOR}
                    style={styles.keyboardView}
                >
                    <View style={styles.clothBody}>
                        <Text variant="sub">
                            Reminders stop at this hour, so the app never nags you after bedtime.
                        </Text>

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
                                onBlur={handleBlurHour}
                                keyboardType="number-pad"
                                returnKeyType="next"
                                maxLength={2}
                                autoFocus
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
                                returnKeyType="done"
                                maxLength={2}
                                accessibilityLabel="Minute"
                            />
                            <TouchableOpacity onPress={togglePeriod} activeOpacity={0.6} accessibilityRole="button">
                                <Text variant="tab" tone="secondary">{period}</Text>
                            </TouchableOpacity>
                        </View>

                        {error && <Text variant="bodySmall" tone="danger">{error}</Text>}

                        <ThemedButton
                            label="Continue"
                            block
                            disabled={!isFormValid}
                            onPress={handleContinue}
                        />
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

    /** `.cl-body{padding-top:30px; gap:18px}` */
    clothBody: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
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
