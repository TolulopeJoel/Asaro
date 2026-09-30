import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import {
    Asaro, Hero, Screen, START_DELAY_MS, Text, ThemedButton,
    type AsaroAction, type AsaroHandle,
} from '@/src/components/ui';
import { TOUR_VISUALS, type TourVisual } from '@/src/components/onboarding/TourVisuals';
import { useAuth } from '@/src/context/AuthContext';
import { useAsaroLook } from '@/src/storage/asaroLook';
import { useFootPadding } from '@/src/hooks/useScreenInsets';

/** How long a page's expression is held before the face relaxes back to its idle life. */
const HOLD_MS = 2500;
/** Seconds before a page's button can be pressed, so every page is actually seen. */
const WAIT_S = 10;

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
        body: () => 'Every chapter you reflect on becomes land, and every practice you keep grows a tree. If you miss a few days, they go quiet. Don’t worry, they’re not gone.',
    },
    {
        title: 'Read with your people',
        action: 'nod',
        hold: false,
        visual: 'sunday',
        body: (_, other) => `Join a group, and every Sunday it opens. You’ll see what everybody read, and the one answer each person brought. Nobody is ranking anybody. It’s not a competition, whatever my ${other} says.`,
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

    const last = page === PAGES.length - 1;
    const current = PAGES[page];
    const Visual = TOUR_VISUALS[current.visual];
    const done = () => router.push('/onboarding/plan-start');
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

    // Each page's face reacts, holds long enough to be seen, then lets go.
    useEffect(() => {
        const { action, hold } = PAGES[page];
        const start = setTimeout(() => face.current?.play(action, { hold }), START_DELAY_MS);
        const release = hold ? setTimeout(() => face.current?.rest(), START_DELAY_MS + HOLD_MS) : undefined;
        return () => { clearTimeout(start); clearTimeout(release); };
    }, [page]);

    // Back steps through the tour; on the first page it stays put rather than undoing the name.
    // Only while the tour is showing: a screen on top of it owns Back.
    useFocusEffect(useCallback(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setPage((p) => Math.max(0, p - 1));
            return true;
        });
        return () => sub.remove();
    }, []));

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
                        <Text variant="body" style={styles.bodyText}>{current.body(displayName ?? 'o', look === 'female' ? 'brother' : 'sister')}</Text>
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
                            label={waiting ? `Wait o \u00b7 ${left}` : last ? 'I’m ready' : 'Next'}
                            block
                            disabled={waiting}
                            onPress={last ? done : next}
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
