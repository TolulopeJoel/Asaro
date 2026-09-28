import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Flip } from '@/src/components/onboarding/Flip';
import {
    Asaro, Hero, Screen, START_DELAY_MS, Text, ThemedButton,
    type AsaroAction, type AsaroHandle,
} from '@/src/components/ui';
import { useAsaroLook } from '@/src/storage/asaroLook';
import { putOnThinkingCap, useThinkingCap } from '@/src/storage/thinkingCap';
import { setFirstRun } from '@/src/onboarding/firstRun';
import { ASARO_CAP_CLOTHS, ASARO_CAPS, ASARO_LOOKS, type CapCloth } from '@/src/theme/asaroRig';
import { useFootPadding } from '@/src/hooks/useScreenInsets';

/** Before the practice entry, the chosen sibling gets a thinking cap. Keep in step with design/all-screens.html#cap. */
const INTRO: { action: AsaroAction; line: (cap: string, other: string) => string }[] = [
    { action: 'nod', line: () => 'Okay, your first reading. I’ll help you with it.' },
    {
        action: 'sheepish',
        line: (cap, other) => `But first, let me get my thinking cap. Sorry o, my thinking ${cap}. I have to prove my ${other} wrong.`,
    },
];
const ASK = 'Which one should I wear?';
const WORN = 'Ehen. Now I can think. Let’s go and read.';
const SWAPPED = 'Hmm. This one is also fine.';

/** Long enough to read the line, with a floor so a short one's face still lands. */
const beatMs = (line: string) => Math.max(2200, 900 + line.length * 45);
/** How long the cap takes to land, before he reacts to it. */
const LAND_MS = 600;

export default function ThinkingCapScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const footPadding = useFootPadding();
    const look = useAsaroLook();
    const worn = useThinkingCap();
    const wornNow = useRef(worn);
    wornNow.current = worn;
    const face = useRef<AsaroHandle>(null);
    const cap = ASARO_CAPS[look].name;
    const other = look === 'female' ? 'brother' : 'sister';
    const cloths = ASARO_CAP_CLOTHS[look];

    // The intro plays through, then he asks; nothing is chosen for them.
    const [beat, setBeat] = useState(0);
    const asking = beat >= INTRO.length;
    const [picks, setPicks] = useState(0);
    const [landed, setLanded] = useState(false);

    const line = !asking ? INTRO[beat].line(cap, other) : picks === 0 ? ASK : picks === 1 ? WORN : SWAPPED;

    useEffect(() => {
        if (asking) return;
        const { action } = INTRO[beat];
        const start = setTimeout(() => face.current?.play(action, { hold: action === 'sheepish' }), START_DELAY_MS);
        const next = setTimeout(() => {
            face.current?.rest();
            setBeat((b) => b + 1);
        }, beatMs(INTRO[beat].line(cap, other)));
        return () => { clearTimeout(start); clearTimeout(next); };
    }, [beat, asking, cap, other]);

    useEffect(() => {
        if (!asking || picks > 0) return;
        // Back after the app was closed here, already wearing one: carry on from it.
        if (wornNow.current) {
            setPicks(1);
            setLanded(true);
            return;
        }
        const id = setTimeout(() => face.current?.play('think', { hold: true }), START_DELAY_MS);
        return () => clearTimeout(id);
    }, [asking, picks]);

    const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (landTimer.current) clearTimeout(landTimer.current); }, []);

    const wear = (cloth: CapCloth) => {
        if (cloth.id === worn) return;
        face.current?.rest();
        void putOnThinkingCap(cloth.id);
        setPicks((n) => n + 1);
        if (landTimer.current) clearTimeout(landTimer.current);
        landTimer.current = setTimeout(() => {
            face.current?.play(picks === 0 ? 'smug' : 'nod');
            setLanded(true);
        }, LAND_MS);
    };

    const go = async () => {
        await setFirstRun('practice');
        router.replace({ pathname: '/addEntry', params: { practice: 'true' } });
    };

    // No way back from here: the practice entry is next.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => sub.remove();
    }, []);

    return (
        <Screen edges={[]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>Before we start</Text>
                    <Text variant="display" tone="onBand">{`My Thinking\n${cap === 'gele' ? 'Gele' : 'Fila'}`}</Text>
                </Hero>

                <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                    <Flip flipKey={line} stretch puff={false}>
                        <View style={[styles.bubble, { backgroundColor: colors.backgroundSubtle }]}>
                            <Text variant="body" accessibilityLiveRegion="polite">{line}</Text>
                            <View style={[styles.tail, { backgroundColor: colors.backgroundSubtle }]} />
                        </View>
                    </Flip>

                    <View style={styles.stage}>
                        <Asaro ref={face} size={150} />
                    </View>

                    {asking && (
                        <View style={styles.cloths}>
                            {cloths.map((cloth) => {
                                const on = cloth.id === worn;
                                return (
                                    <ScalePressable
                                        key={cloth.id}
                                        onPress={() => wear(cloth)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: on }}
                                        accessibilityLabel={`${cloth.label} ${cap}`}
                                        style={styles.clothChoice}
                                    >
                                        <View style={[styles.ring, { borderColor: on ? colors.textPrimary : 'transparent' }]}>
                                            <Swatch cloth={cloth} striped={!!ASARO_CAPS[look].stripes} rim={ASARO_LOOKS[look].rim} />
                                        </View>
                                        <Text variant="meta" tone={on ? 'primary' : 'secondary'}>{cloth.label}</Text>
                                    </ScalePressable>
                                );
                            })}
                        </View>
                    )}

                    {landed && (
                        <View style={styles.foot}>
                            <ThemedButton label="Let’s go" block onPress={go} />
                        </View>
                    )}
                </View>
            </ScrollView>
        </Screen>
    );
}

const SWATCH = 52;

/** A square of the cloth: aso-oke stripes for the fila, a lit pleat for the gele. */
function Swatch({ cloth, striped, rim }: { cloth: CapCloth; striped: boolean; rim: string }) {
    return (
        <Svg width={SWATCH} height={SWATCH} viewBox="0 0 52 52">
            <Rect x={0} y={0} width={52} height={52} fill={cloth.fill} />
            {striped
                ? [-8, 8, 24, 40].map((x) => (
                    <Path key={x} d={`M${x} 56 L${x + 22} -4`} stroke={cloth.stripe} strokeWidth={4.5} />
                ))
                : [14, 28, 42].map((y) => (
                    <Path key={y} d={`M-4 ${y + 6} Q26 ${y - 8} 56 ${y + 6}`} fill="none" stroke={cloth.dark} strokeWidth={2} />
                ))}
            <Rect x={0.75} y={0.75} width={50.5} height={50.5} fill="none" stroke={rim} strokeWidth={1.5} />
        </Svg>
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
    /** `.cl-panel{padding:18px}`, pointing down at him. */
    bubble: { padding: Spacing.layout.cardPadding, minHeight: 96, justifyContent: 'center' },
    tail: {
        position: 'absolute',
        bottom: -TAIL / 2,
        alignSelf: 'center',
        width: TAIL,
        height: TAIL,
        transform: [{ rotate: '45deg' }],
    },
    stage: { alignItems: 'center', paddingTop: Spacing.sm },
    cloths: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl },
    clothChoice: { alignItems: 'center', gap: Spacing.sm },
    // Square, like the rest of Cloth.
    ring: { borderWidth: Spacing.border.strong, padding: 4 },
    /** The button sits at the foot, clear of the choices. */
    foot: { marginTop: 'auto', paddingTop: Spacing.xl },
});
