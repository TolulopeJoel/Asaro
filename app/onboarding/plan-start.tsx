/**
 * Where the reader has reached in the plan. Asked after the tour, which has
 * just said "one reading a day, through the whole Bible", and asked once
 * (`?once=1`, from the root layout) of anyone who got past onboarding without
 * answering it. It only decides which reading comes up next: see
 * src/storage/planStart.ts.
 *
 * "From the start" is an answer, not a skip, so the page stays a wall.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Asaro, Hero, Screen, Text, ThemedButton } from '@/src/components/ui';
import { ScalePressable } from '@/src/components/ScalePressable';
import { BookPicker } from '@/src/components/BookPicker';
import { onboardingStepLabel } from '@/src/utils/onboardingSteps';
import { useAsaroLook } from '@/src/storage/asaroLook';
import { setPlanStart } from '@/src/storage/planStart';
import { READING_PLAN_DATA, type ReadingItem } from '@/src/data/readingPlanData';
import { planItemCoversBook } from '@/src/data/journalRepository';
import type { BibleBook } from '@/src/data/bibleBooks';
import { formatRange } from '@/src/utils/reference';
import { useFootPadding } from '@/src/hooks/useScreenInsets';
import type { AsaroAction } from '@/src/theme/asaroRig';

type Step = 'choose' | 'book' | 'reading';

const FIRST = READING_PLAN_DATA[0];

const passage = (item: ReadingItem) =>
    item.chapters ? formatRange(`${item.book} ${item.chapters}`) : item.book.replace(/\//g, ', ');

export default function PlanStartScreen() {
    const router = useRouter();
    const { once } = useLocalSearchParams<{ once?: string }>();
    // Outside onboarding: no step count, and Home comes next instead of the sleep time.
    const asking = once === '1';
    const { colors } = useTheme();
    const look = useAsaroLook();
    const footPadding = useFootPadding(Spacing.layout.screenPadding);

    const [step, setStep] = useState<Step>('choose');
    // Null until they answer; true once they say they've already started.
    const [started, setStarted] = useState<boolean | null>(null);
    const [book, setBook] = useState<BibleBook | null>(null);
    const [reading, setReading] = useState<ReadingItem | null>(null);

    const readings = useMemo(
        () => (book ? READING_PLAN_DATA.filter(item => planItemCoversBook(item.book, book.name)) : []),
        [book],
    );

    // Back steps back through the question; from its first step it leaves as usual.
    useFocusEffect(useCallback(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step === 'reading') {
                setReading(null);
                setStep('book');
                return true;
            }
            if (step === 'book') {
                setStarted(null);
                setStep('choose');
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [step]));

    const say: { action: AsaroAction; line: string } = (() => {
        if (step === 'book') return { action: 'point', line: 'Which book are you reading now?' };
        if (step === 'reading') {
            return reading
                ? {
                    action: 'nod',
                    line: `${passage(reading)}. Okay, we carry on from there. What you read before me won’t show as written, only what we write about together.`,
                }
                : { action: 'think', line: `And where in ${book?.name}? Tap the reading you’re on.` };
        }
        if (started === false) return { action: 'thumbsUp', line: `${passage(FIRST)} then. We start together.` };
        return { action: 'think', line: 'Some people start with me from Genesis. Some have been reading on their own for a while. Which one are you?' };
    })();

    const canFinish = started === false || (step === 'reading' && !!reading);

    const finish = async () => {
        const id = started ? reading?.id : FIRST.id;
        if (id === undefined) return;
        try {
            await setPlanStart(id);
        } catch (error) {
            console.error('Failed to save the plan start:', error);
        }
        if (asking) router.replace('/');
        else router.push('/onboarding/sleep-time');
    };

    const option = (label: string, sub: string, selected: boolean, onPress: () => void) => (
        <ScalePressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
                styles.option,
                { backgroundColor: colors.backgroundSubtle },
                selected && { borderLeftWidth: Spacing.border.marker, borderLeftColor: colors.accent },
            ]}
        >
            <Text variant="subtitle">{label}</Text>
            <Text variant="bodySmall" tone="secondary" style={styles.optionSub}>{sub}</Text>
        </ScalePressable>
    );

    const eyebrow = asking ? 'Your plan' : onboardingStepLabel('plan-start');

    return (
        <Screen edges={[]}>
            <Hero ownsTopInset topPadding={64}>
                {eyebrow && <Text variant="label" tone="onHero" style={styles.heroStep}>{eyebrow}</Text>}
                <Text variant="display" tone="onBand">Where have you reached?</Text>
            </Hero>

            <View style={[styles.body, { paddingBottom: footPadding }]}>
                <View style={styles.speech}>
                    <Asaro size={74} look={look} action={say.action} />
                    <Text variant="body" style={styles.speechText}>{say.line}</Text>
                </View>

                <View style={styles.content}>
                    {step === 'choose' && (
                        <View style={styles.options}>
                            {option('From the start', `${passage(FIRST)}, the first reading`, started === false, () => setStarted(false))}
                            {option('I’ve already started', 'Show me where I am', false, () => {
                                setStarted(true);
                                setStep('book');
                            })}
                        </View>
                    )}

                    {step === 'book' && (
                        <BookPicker
                            onBookSelect={picked => {
                                setBook(picked);
                                setReading(null);
                                setStep('reading');
                            }}
                        />
                    )}

                    {step === 'reading' && (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.options}
                            keyboardShouldPersistTaps="handled"
                        >
                            {readings.map(item =>
                                <React.Fragment key={item.id}>
                                    {option(passage(item), `Reading ${item.id}`, reading?.id === item.id, () => setReading(item))}
                                </React.Fragment>,
                            )}
                        </ScrollView>
                    )}
                </View>

                {step !== 'book' && (
                    <View style={styles.foot}>
                        <ThemedButton label={asking ? 'Save' : 'Continue'} block disabled={!canFinish} onPress={finish} />
                    </View>
                )}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    /** The band's eyebrow: `margin:0 0 10px`. */
    heroStep: { marginBottom: 10 },
    body: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    speech: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    speechText: { flex: 1 },
    content: { flex: 1 },
    options: { gap: Spacing.sm },
    option: { padding: Spacing.layout.cardPadding },
    optionSub: { marginTop: 2 },
    foot: { paddingTop: Spacing.md },
});
