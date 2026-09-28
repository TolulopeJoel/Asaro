import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import {
    Asaro, Hero, Screen, START_DELAY_MS, Text, ThemedButton,
    type AsaroAction, type AsaroHandle,
} from '@/src/components/ui';
import { TOUR_VISUALS, type TourVisual } from '@/src/components/onboarding/TourVisuals';
import { useAuth } from '@/src/context/AuthContext';
import { useAsaroLook } from '@/src/storage/asaroLook';
import { putOnThinkingCap, takeOffThinkingCap } from '@/src/storage/thinkingCap';
import { ASARO_CAPS } from '@/src/theme/asaroRig';
import { useFootPadding } from '@/src/hooks/useScreenInsets';

/** How long a page's expression is held before the face relaxes back to its idle life. */
const HOLD_MS = 2500;
/** Seconds before a page's button can be pressed, so every page is actually seen. */
const WAIT_S = 10;
/** After the tour: a moment's thought, the cap goes on, then the button. */
const CAP_ON_MS = 1400;
const CAP_READY_MS = 2600;

const capLine = (other: string, cap: string) =>
    `Not that I’m competing o. But I’ll prove my ${other} wrong. Let me get my thinking ${cap}.`;

/** What the app is, told by the chosen sibling. Keep in step with design/all-screens.html#tour. */
const PAGES: { title: string; action: AsaroAction; hold: boolean; visual: TourVisual; body: (name: string, other: string) => string }[] = [
    {
        title: 'One reading a day',
        action: 'smug',
        hold: true,
        visual: 'readings',
        body: (name) => `Okay ${name}, this is how it works. One reading a day, and together we go through the whole Bible. Just one. You can manage that, abi?`,
    },
    {
        title: 'Then we talk about it',
        action: 'think',
        hold: true,
        visual: 'questions',
        body: () => 'Then I ask you five questions about what you read. What it tells you about Jehovah, how you’ll apply it, who it could help. You thought the reading was the whole thing? Ehn ehn.',
    },
    {
        title: 'Watch it grow',
        action: 'celebrate',
        hold: false,
        visual: 'trees',
        body: () => 'Every chapter you reflect on becomes land. Every practice you keep grows a tree. Miss a few days and they go quiet. Quiet, not gone.',
    },
    {
        title: 'Read with your people',
        action: 'nod',
        hold: false,
        visual: 'sunday',
        body: (_, other) => `Join a group and every Sunday it opens: what everyone read, and the one thing each person chose to bring. No rankings. It’s not a competition, whatever my ${other} says.`,
    },
];

export default function TourScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const footPadding = useFootPadding();
    const { displayName } = useAuth();
    const look = useAsaroLook();
    const [page, setPage] = useState(0);
    const face = useRef<AsaroHandle>(null);
    // Furthest page whose countdown has finished; going back never waits again.
    const [unlocked, setUnlocked] = useState(-1);
    const [left, setLeft] = useState(WAIT_S);
    // Past the last page: the sibling goes and gets a thinking cap, worn until the walk ends.
    const [capping, setCapping] = useState(false);
    const [capReady, setCapReady] = useState(false);
    const other = look === 'female' ? 'brother' : 'sister';

    const last = page === PAGES.length - 1;
    const current = PAGES[page];
    const Visual = TOUR_VISUALS[current.visual];
    const done = () => router.push('/onboarding/sleep-time');
    // The count resets with the page, in one update, so a new page never opens unlocked.
    const next = () => {
        if (page + 1 > unlocked) setLeft(WAIT_S);
        setPage(page + 1);
    };

    const waiting = page > unlocked;
    useEffect(() => {
        if (!waiting) return;
        const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
        return () => clearInterval(id);
    }, [page, waiting]);
    useEffect(() => { if (waiting && left === 0) setUnlocked(page); }, [waiting, left, page]);

    useEffect(() => {
        if (!capping) return;
        setCapReady(false);
        const think = setTimeout(() => face.current?.play('think', { hold: true }), START_DELAY_MS);
        const on = setTimeout(() => {
            void putOnThinkingCap();
            face.current?.rest();
        }, CAP_ON_MS);
        const ready = setTimeout(() => {
            face.current?.play('smug');
            setCapReady(true);
        }, CAP_READY_MS);
        return () => { clearTimeout(think); clearTimeout(on); clearTimeout(ready); };
    }, [capping]);

    // Each page's face reacts, holds long enough to be seen, then lets go.
    useEffect(() => {
        const { action, hold } = PAGES[page];
        const start = setTimeout(() => face.current?.play(action, { hold }), START_DELAY_MS);
        const release = hold ? setTimeout(() => face.current?.rest(), START_DELAY_MS + HOLD_MS) : undefined;
        return () => { clearTimeout(start); clearTimeout(release); };
    }, [page]);

    // Back steps through the tour; on the first page it stays put rather than undoing the name.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (capping) {
                setCapping(false);
                void takeOffThinkingCap();
            } else {
                setPage((p) => Math.max(0, p - 1));
            }
            return true;
        });
        return () => sub.remove();
    }, [capping]);

    return (
        <Screen edges={[]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>How it works</Text>
                    <Text variant="display" tone="onBand">{current.title}</Text>
                </Hero>

                <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                    <View style={styles.speech}>
                        <Asaro ref={face} size={74} />
                        <Text variant="body" style={styles.bodyText}>
                            {capping ? capLine(other, ASARO_CAPS[look].name) : current.body(displayName ?? 'o', other)}
                        </Text>
                    </View>

                    {/* Keyed by page, so each page's piece of the app flips in fresh. */}
                    <View key={page} style={styles.visual}>
                        <Visual />
                    </View>

                    {/* Pager and button sit at the foot, well clear of the face. */}
                    <View style={styles.foot}>
                        <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
                            {PAGES.map((p, i) => (
                                <View
                                    key={p.title}
                                    style={[styles.dot, { backgroundColor: i === page ? colors.textPrimary : colors.border }]}
                                />
                            ))}
                        </View>

                        <ThemedButton
                            label={waiting ? `Wait o \u00b7 ${left}` : capping ? 'Okay, let’s go' : last ? 'I’m ready' : 'Next'}
                            block
                            disabled={waiting || (capping && !capReady)}
                            onPress={capping ? done : last ? () => setCapping(true) : next}
                        />
                    </View>
                </View>
            </ScrollView>
        </Screen>
    );
}

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
    speech: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    bodyText: { flex: 1 },
    // Centred in the space between the speech and the foot, so the flip has room to land.
    visual: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.lg },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
    foot: { marginTop: 'auto', paddingTop: Spacing.xl, gap: Spacing.lg },
    dot: { width: 8, height: 8, borderRadius: Spacing.borderRadius.round },
});
