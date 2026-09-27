import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { ScalePressable } from '@/src/components/ScalePressable';
import {
    Asaro, Hero, Screen, START_DELAY_MS, Text, ThemedButton,
    type AsaroAction, type AsaroHandle, type AsaroLook,
} from '@/src/components/ui';
import { onboardingStepLabel } from '@/src/utils/onboardingSteps';
import { setAsaroLook } from '@/src/storage/asaroLook';
import { useFootPadding } from '@/src/hooks/useScreenInsets';

/** The siblings' quarrel. Keep in step with design/asaro-face.html#quarrel. */
const BEATS: { who: AsaroLook; action: AsaroAction; line: string }[] = [
    { who: 'male', action: 'smug', line: 'Ehen, you’re here. I’ll be the one checking up on you.' },
    { who: 'female', action: 'sideEye', line: 'You? You can’t even remember your own reading o.' },
    { who: 'male', action: 'deadpan', line: 'Interesting.' },
    { who: 'female', action: 'smug', line: 'Don’t mind him. I’m the one who keeps receipts.' },
    { who: 'male', action: 'sigh', line: 'She’s been saying that since we were small.' },
    { who: 'male', action: 'nod', line: 'Okay o. Brothers, you\u2019re with me.' },
    { who: 'female', action: 'smug', line: 'And sisters are with me. Obviously.' },
];

/** Long enough to read the line, with a floor so a one-word verdict's face still lands. */
const beatMs = (line: string) => Math.max(2200, 900 + line.length * 45);

/** Faces that are the message: held for the whole line, so the reader looks up and still sees them. */
const HELD: ReadonlySet<AsaroAction> = new Set(['deadpan', 'sideEye', 'smug', 'sheepish']);

/** How long the check's `think` is held before the face relaxes. */
const CHECK_HOLD_MS = 2500;

/** Long enough for the wave and the sigh to be seen before the check opens. */
const PICK_MS = 1100;

const LOOK_CHOICES: { look: AsaroLook; label: string }[] = [
    { look: 'male', label: 'Brother' },
    { look: 'female', label: 'Sister' },
];

/** The first question anyone answers: brother or sister, which decides whose Àṣàrò they get. */
export default function CharacterScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const footPadding = useFootPadding();
    const faces = useRef<Record<AsaroLook, AsaroHandle | null>>({ male: null, female: null });
    const [beat, setBeat] = useState(0);
    // Nothing preselected, so the choice is always the user's own.
    const [picked, setPicked] = useState<AsaroLook | null>(null);
    const [confirming, setConfirming] = useState(false);

    const choosing = beat >= BEATS.length;
    const current = choosing ? null : BEATS[beat];

    const advance = useCallback(() => setBeat((b) => Math.min(b + 1, BEATS.length)), []);

    useEffect(() => {
        for (const look of ['male', 'female'] as const) {
            if (current?.who === look) faces.current[look]?.play(current.action, { hold: HELD.has(current.action) });
            else faces.current[look]?.rest();
        }
        if (!current) return;
        const id = setTimeout(advance, beatMs(current.line));
        return () => clearTimeout(id);
    }, [current, advance]);

    // Tapping a face is the answer: it reacts, then the check opens.
    const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Between the tap and the check opening: the choice is made, so the replay goes.
    const [reacting, setReacting] = useState(false);
    useEffect(() => () => { if (pickTimer.current) clearTimeout(pickTimer.current); }, []);

    const pick = (look: AsaroLook) => {
        if (pickTimer.current) return;
        setPicked(look);
        setReacting(true);
        faces.current[look]?.play('wave');
        faces.current[look === 'male' ? 'female' : 'male']?.play('sigh');
        pickTimer.current = setTimeout(() => {
            pickTimer.current = null;
            setReacting(false);
            setConfirming(true);
        }, PICK_MS);
    };

    const replay = () => {
        setPicked(null);
        setBeat(0);
    };

    const checkFace = useRef<AsaroHandle>(null);
    useEffect(() => {
        if (!confirming) return;
        const start = setTimeout(() => checkFace.current?.play('think', { hold: true }), START_DELAY_MS);
        const release = setTimeout(() => checkFace.current?.rest(), START_DELAY_MS + CHECK_HOLD_MS);
        return () => { clearTimeout(start); clearTimeout(release); };
    }, [confirming]);

    // Back from the check returns to the choice, not out of onboarding.
    useEffect(() => {
        if (!confirming) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setConfirming(false);
            return true;
        });
        return () => sub.remove();
    }, [confirming]);

    const handleConfirm = async () => {
        if (!picked) return;
        try {
            await setAsaroLook(picked);
            router.push('/onboarding/name');
        } catch (error) {
            console.error('Error saving look:', error);
        }
    };

    /** A listener glares at whoever is talking; the speaker holds the reader. */
    const gazeFor = (look: AsaroLook) => {
        if (!current || current.who === look) return undefined;
        return { x: look === 'male' ? 1 : -1, y: 0 };
    };

    const bubbleAlign = !current ? 'stretch' : current.who === 'male' ? 'flex-start' : 'flex-end';

    return (
        <Screen edges={[]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>{onboardingStepLabel('character')}</Text>
                    <Text variant="display" tone="onBand">Meet Àṣàrò</Text>
                </Hero>

                {confirming && picked ? (
                    <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                        <View style={styles.check}>
                            <Asaro ref={checkFace} size={124} look={picked} />
                            <Text variant="title" style={styles.checkText}>
                                So you&apos;re a {picked === 'male' ? 'man' : 'woman'}?
                            </Text>
                            <Text variant="sub" style={styles.checkText}>
                                Don&apos;t lie, you know who is watching.
                            </Text>
                        </View>
                        <View style={styles.foot}>
                            <ThemedButton label="Yes, I am" block onPress={handleConfirm} />
                            <ThemedButton label="Hmm, let me change" variant="secondary" block onPress={() => setConfirming(false)} />
                        </View>
                    </View>
                ) : (
                    <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                        {/* Plays in full with no buttons: the quarrel can't be skipped or tapped through. */}
                        <View style={styles.stage}>
                            <View style={[styles.bubbleRow, { alignItems: bubbleAlign }]}>
                                {current ? (
                                    <View style={[styles.bubble, { backgroundColor: colors.backgroundSubtle }]}>
                                        <Text variant="body" accessibilityLiveRegion="polite">{current.line}</Text>
                                        <View style={[
                                            styles.tail,
                                            { backgroundColor: colors.backgroundSubtle },
                                            current.who === 'male' ? styles.tailLeft : styles.tailRight,
                                        ]} />
                                    </View>
                                ) : (
                                    <Text variant="sub" style={styles.prompt}>
                                        Are you a brother or a sister?
                                    </Text>
                                )}
                            </View>

                            <View style={styles.looks}>
                                {LOOK_CHOICES.map(({ look, label }) => {
                                    const on = look === picked;
                                    return (
                                        <ScalePressable
                                            key={look}
                                            onPress={() => pick(look)}
                                            disabled={!choosing}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on, disabled: !choosing }}
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
                        </View>

                        {choosing && !reacting && (
                            <View style={styles.foot}>
                                <ThemedButton label="Wait, what did you two say?" variant="secondary" block onPress={replay} />
                            </View>
                        )}
                    </View>
                )}
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
    prompt: { textAlign: 'center' },
    check: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
    checkText: { textAlign: 'center' },
    /** Buttons sit at the foot, well clear of the faces. */
    foot: { marginTop: 'auto', paddingTop: Spacing.xl, gap: Spacing.md },
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
