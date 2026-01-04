import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';

export default function SleepTimeScreen() {
    const router = useRouter();
    const { colors } = useTheme();

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

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.content}>
                        <View style={styles.textContainer}>
                            <View style={styles.introBlock}>
                                <Text style={[styles.greeting, { color: colors.textPrimary }]}>
                                    Noted.
                                </Text>

                                <Text style={[styles.introText, { color: colors.textPrimary }]}>
                                    I promise not to disturb your beauty sleep. But once you wake up? No mercy.

                                    I need to know when to let you rest.
                                </Text>
                            </View>

                            <Text style={[styles.label, { color: colors.textPrimary }]}>
                                I usually go to sleep at
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

                                <Text style={[styles.separator, { color: colors.textPrimary }]}>:</Text>

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
                                    <Text style={[styles.periodText, { color: colors.textPrimary }]}>
                                        {period}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {error && (
                                <Text style={[styles.errorText, { color: 'red' }]}>
                                    {error}
                                </Text>
                            )}
                        </View>

                        <View style={styles.footer}>
                            <ScalePressable
                                style={[
                                    styles.button,
                                    {
                                        backgroundColor: isFormValid ? colors.textPrimary : colors.background,
                                        borderColor: colors.textPrimary,
                                        borderWidth: 1,
                                        opacity: isFormValid ? 1 : 0.15
                                    }
                                ]}
                                onPress={handleContinue}
                                disabled={!isFormValid}
                            >
                                <Text style={[
                                    styles.buttonText,
                                    {
                                        color: isFormValid ? colors.background : colors.textPrimary,
                                    }
                                ]}>Continue</Text>
                            </ScalePressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: Spacing.layout.screenPadding * 1.5,
        justifyContent: 'space-between',
        paddingTop: 140,
    },
    textContainer: {
        flex: 1,
        width: '100%',
    },
    introBlock: {
        marginBottom: Spacing.xxxl * 3,
    },
    greeting: {
        fontSize: Typography.size.xxl,
        fontWeight: Typography.weight.light,
        fontFamily: Typography.fontFamily.serif,
        letterSpacing: 0.5,
        marginBottom: Spacing.xxl,
    },
    introText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.light,
        lineHeight: Typography.lineHeight.xl,
        fontFamily: Typography.fontFamily.serif,
        letterSpacing: 0.4,
        opacity: 0.85,
    },
    label: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        opacity: 0.5,
        fontFamily: Typography.fontFamily.serif,
        marginBottom: Spacing.lg,
        textAlign: 'center',
    },
    timeInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    input: {
        fontSize: 48,
        fontWeight: Typography.weight.light,
        borderBottomWidth: 1,
        paddingBottom: 4,
        letterSpacing: Typography.letterSpacing.tight,
        fontFamily: Typography.fontFamily.serif,
    },
    separator: {
        fontSize: 48,
        fontWeight: Typography.weight.light,
        marginBottom: 8,
        fontFamily: Typography.fontFamily.serif,
    },
    periodText: {
        fontSize: 24,
        fontWeight: Typography.weight.light,
        marginBottom: 12,
        marginLeft: Spacing.sm,
        fontFamily: Typography.fontFamily.serif,
    },
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
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonText: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        letterSpacing: 3,
        textTransform: 'uppercase',
    },
});
