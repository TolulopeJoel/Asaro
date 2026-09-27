import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Asaro, Hero, Screen, Text, ThemedButton, type AsaroAction } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { useFootPadding } from '@/src/hooks/useScreenInsets';

/** What the app is, told by the chosen sibling. Keep in step with design/all-screens.html#tour. */
const PAGES: { title: string; action: AsaroAction; hold: boolean; body: (name: string) => string }[] = [
    {
        title: 'One reading a day',
        action: 'smug',
        hold: true,
        body: (name) => `Okay ${name}, this is how it works. Every day there’s a reading waiting for you, and we go through the whole Bible together. Just one reading. You can manage that, abi?`,
    },
    {
        title: 'Then we talk about it',
        action: 'think',
        hold: true,
        body: () => 'After you read, I ask you five questions, one at a time. What it tells you about Jehovah, how you’ll apply it, who it could help. Answer the ones you can.',
    },
    {
        title: 'Watch it grow',
        action: 'celebrate',
        hold: false,
        body: () => 'Every chapter you reflect on becomes land in your field. Every practice you keep grows a tree. Leave them and they go quiet, but nothing is taken away. They wait for you.',
    },
    {
        title: 'Read with your people',
        action: 'nod',
        hold: false,
        body: () => 'Join a group and every Sunday it opens: what everyone read, and the one thing they chose to bring. No rankings. Nobody is comparing.',
    },
];

export default function TourScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const footPadding = useFootPadding();
    const { displayName } = useAuth();
    const [page, setPage] = useState(0);

    const last = page === PAGES.length - 1;
    const current = PAGES[page];
    const done = () => router.push('/onboarding/sleep-time');

    // Back steps through the tour; on the first page it stays put rather than undoing the name.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setPage((p) => Math.max(0, p - 1));
            return true;
        });
        return () => sub.remove();
    }, []);

    return (
        <Screen edges={[]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Hero ownsTopInset topPadding={64}>
                    <Text variant="label" tone="onHero" style={styles.heroStep}>How it works</Text>
                    <Text variant="display" tone="onBand">{current.title}</Text>
                </Hero>

                <View style={[styles.clothBody, { paddingBottom: footPadding }]}>
                    <View style={styles.speech}>
                        {/* Keyed by page so each page's face plays fresh. */}
                        <Asaro key={page} size={124} action={current.action} hold={current.hold} />
                        <Text variant="body" style={styles.bodyText}>{current.body(displayName ?? 'o')}</Text>
                    </View>

                    <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
                        {PAGES.map((p, i) => (
                            <View
                                key={p.title}
                                style={[styles.dot, { backgroundColor: i === page ? colors.textPrimary : colors.border }]}
                            />
                        ))}
                    </View>

                    <ThemedButton
                        label={last ? 'I’m ready' : 'Next'}
                        block
                        onPress={last ? done : () => setPage(page + 1)}
                    />
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
    speech: { alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.md },
    bodyText: { textAlign: 'center' },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
    dot: { width: 8, height: 8, borderRadius: Spacing.borderRadius.round },
});
