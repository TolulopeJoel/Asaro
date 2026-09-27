import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { ScalePressable } from '@/src/components/ScalePressable';
import {
    Asaro, Hero, Screen, Text, ThemedButton,
    type AsaroAction, type AsaroHandle, type AsaroLook,
} from '@/src/components/ui';
import { onboardingStepLabel } from '@/src/utils/onboardingSteps';
import { setAsaroLook } from '@/src/storage/asaroLook';
import { useFootPadding } from '@/src/hooks/useScreenInsets';

type Speaker = AsaroLook | 'both';

/** The siblings' quarrel. Keep in step with design/asaro-face.html#quarrel. */
const BEATS: { who: Speaker; action: AsaroAction; line: string }[] = [
    { who: 'male', action: 'smug', line: 'Ehen, you’re here. I’ll be the one checking up on you.' },
    { who: 'female', action: 'sideEye', line: 'You? You can’t even remember your own reading o.' },
    { who: 'male', action: 'deadpan', line: 'Interesting.' },
    { who: 'female', action: 'smug', line: 'Don’t mind him. I’m the one who keeps receipts.' },
    { who: 'male', action: 'sigh', line: 'She’s been saying that since we were small.' },
    { who: 'both', action: 'nod', line: 'Okay o. You choose.' },
];

/** Long enough to read the line, with a floor for the one-word verdicts. */
const beatMs = (line: string) => Math.max(1800, 900 + line.length * 45);

const LOOK_CHOICES: { look: AsaroLook; label: string }[] = [
    { look: 'male', label: 'Him' },
    { look: 'female', label: 'Her' },
];

/** The first choice anyone makes: which sibling walks them through the rest. */
export default function CharacterScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const footPadding = useFootPadding();
    const faces = useRef<Record<AsaroLook, AsaroHandle | null>>({ male: null, female: null });
    const [beat, setBeat] = useState(0);
    // Nothing preselected, so the choice is always the user's own.
    const [picked, setPicked] = useState<AsaroLook | null>(null);

    const choosing = beat >= BEATS.length;
    const current = choosing ? null : BEATS[beat];

    const advance = useCallback(() => setBeat((b) => Math.min(b + 1, BEATS.length)), []);

    useEffect(() => {
        if (!current) return;
        for (const look of ['male', 'female'] as const) {
            if (current.who === look || current.who === 'both') faces.current[look]?.play(current.action);
        }
        const id = setTimeout(advance, beatMs(current.line));
        return () => clearTimeout(id);
    }, [current, advance]);

    const pick = (look: AsaroLook) => {
        setPicked(look);
        faces.current[look]?.play('wave');
        faces.current[look === 'male' ? 'female' : 'male']?.play('sigh');
    };

    const handleContinue = async () => {
        if (!picked) return;
        try {
            await setAsaroLook(picked);
            router.push('/onboarding/name');
        } catch (error) {
            console.error('Error saving look:', error);
        }
    };

    /** A listener glares at whoever is talking; a speaker, and both at the end, hold the reader. */
    const gazeFor = (look: AsaroLook) => {
        if (!current || current.who === look || current.who === 'both') return undefined;
        return { x: look === 'male' ? 1 : -1, y: 0 };
    };

    const bubbleAlign = !current || current.who === 'both'
        ? 'center'
        : current.who === 'male' ? 'flex-start' : 'flex-end';

    return (
        <Screen edges={[]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>{onboardingStepLabel('character')}</Text>
                    <Text variant="display" tone="onBand">Meet Àṣàrò</Text>
                </Hero>

                <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                    <Pressable
                        onPress={choosing ? undefined : advance}
                        disabled={choosing}
                        accessibilityHint={choosing ? undefined : 'Next line'}
                        style={styles.stage}
                    >
                        <View style={[styles.bubbleRow, { alignItems: bubbleAlign }]}>
                            {current ? (
                                <View style={[styles.bubble, { backgroundColor: colors.backgroundSubtle }]}>
                                    <Text variant="body" accessibilityLiveRegion="polite">{current.line}</Text>
                                    <View style={[
                                        styles.tail,
                                        { backgroundColor: colors.backgroundSubtle },
                                        current.who === 'male' && styles.tailLeft,
                                        current.who === 'female' && styles.tailRight,
                                        current.who === 'both' && styles.tailCentre,
                                    ]} />
                                </View>
                            ) : (
                                <Text variant="sub" style={styles.prompt}>
                                    Pick who you&apos;ll be reading with. They&apos;ll be the one checking up on you.
                                </Text>
                            )}
                        </View>

                        <View style={styles.looks} accessibilityRole={choosing ? 'radiogroup' : undefined}>
                            {LOOK_CHOICES.map(({ look, label }) => {
                                const on = look === picked;
                                return (
                                    <ScalePressable
                                        key={look}
                                        onPress={() => pick(look)}
                                        disabled={!choosing}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: on, disabled: !choosing }}
                                        accessibilityLabel={label}
                                        style={[styles.lookChoice, { opacity: picked && !on ? 0.45 : 1 }]}
                                    >
                                        <View style={[
                                            styles.lookRing,
                                            { borderColor: on ? colors.textPrimary : 'transparent' },
                                        ]}>
                                            <Asaro
                                                ref={(h) => { faces.current[look] = h; }}
                                                size={120}
                                                look={look}
                                                mirror={look === 'female'}
                                                lookAt={gazeFor(look)}
                                            />
                                        </View>
                                        <Text variant="meta" tone={on ? 'primary' : 'secondary'}>{label}</Text>
                                    </ScalePressable>
                                );
                            })}
                        </View>
                    </Pressable>

                    {choosing ? (
                        <ThemedButton label="Continue" block disabled={!picked} onPress={handleContinue} />
                    ) : (
                        <ThemedButton label="Skip" variant="secondary" block onPress={() => setBeat(BEATS.length)} />
                    )}
                </View>
            </ScrollView>
        </Screen>
    );
}

const TAIL = 14;

const styles = StyleSheet.create({
    /** The band's eyebrow: `margin:0 0 10px`. */
    heroStep: { marginBottom: 10 },
    scrollContent: { flexGrow: 1 },
    /** `.cl-body{padding-top:30px; gap:18px}` */
    clothBody: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    stage: { gap: Spacing.lg },
    // Tall enough for two lines, so the faces don't jump between beats.
    bubbleRow: { minHeight: 96, justifyContent: 'flex-end' },
    /** `.cl-panel{padding:18px}`, pointing at whoever is talking. */
    bubble: { padding: Spacing.layout.cardPadding, maxWidth: '85%' },
    tail: {
        position: 'absolute',
        bottom: -TAIL / 2,
        width: TAIL,
        height: TAIL,
        transform: [{ rotate: '45deg' }],
    },
    tailLeft: { left: 64 },
    tailRight: { right: 64 },
    tailCentre: { alignSelf: 'center' },
    prompt: { textAlign: 'center' },
    looks: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.xl,
    },
    lookChoice: { alignItems: 'center', gap: Spacing.sm },
    lookRing: {
        borderWidth: Spacing.border.strong,
        borderRadius: Spacing.borderRadius.round,
        padding: 3,
    },
});
