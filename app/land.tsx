/**
 * Your land — a prototype.
 *
 * The idea this tests: every chapter the reader has written about is a worked
 * block of cloth, and the whole Bible is the field. More reading is more land.
 * Land already worked *fades* when it is left alone and is never taken away,
 * so the pull back is "Judges has gone quiet" rather than "you are losing
 * Judges". `src/land/cloth.ts` argues that distinction out in full; this
 * screen is what it looks like.
 *
 * Built from entries rather than from ticked plan items, deliberately. A
 * ticked plan item says the reader passed over a chapter; an entry says they
 * worked it, which is the thing the metaphor is actually about. It also keeps
 * the cloth honest — it is made of what they wrote, and nothing else.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { BibleCloth, ClothLegend } from '@/src/components/land/BibleCloth';
import { LoadingView } from '@/src/components/LoadingView';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Hero, Screen, Text as UIText } from '@/src/components/ui';
import { GREEK_BOOKS, HEBREW_BOOKS } from '@/src/data/bibleBooks';
import { getChapterCoverage } from '@/src/data/database';
import { BookCloth, Cloth, quietBooks, weaveCloth } from '@/src/land/cloth';
import { Spacing } from '@/src/theme/spacing';
import { useTheme } from '@/src/theme/ThemeContext';

/** Past this, a book has gone quiet enough to be worth naming. */
const QUIET_DAYS = 120;
const QUIET_LIMIT = 3;

/** "3 days ago", "5 months ago" — how long since a book was last worked. */
function ago(days: number): string {
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.round(days / 30);
    if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`;
    return `${Math.round(days / 365)} years ago`;
}

export default function LandScreen() {
    const { colors, isLockedIn } = useTheme();
    const router = useRouter();

    const [cloth, setCloth] = useState<Cloth | null>(null);
    const [selected, setSelected] = useState<BookCloth | null>(null);

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            (async () => {
                const rows = await getChapterCoverage();
                const woven = weaveCloth(rows, [...HEBREW_BOOKS, ...GREEK_BOOKS], Date.now());
                if (alive) setCloth(woven);
            })();
            return () => {
                alive = false;
            };
        }, []),
    );

    const hebrew = useMemo(
        () => cloth?.books.slice(0, HEBREW_BOOKS.length) ?? [],
        [cloth],
    );
    const greek = useMemo(
        () => cloth?.books.slice(HEBREW_BOOKS.length) ?? [],
        [cloth],
    );
    const quiet = useMemo(
        () => (cloth ? quietBooks(cloth, QUIET_DAYS, QUIET_LIMIT) : []),
        [cloth],
    );

    const back = (
        <ScalePressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={Spacing.md}
            style={styles.back}
        >
            <ChevronLeft size={20} color={isLockedIn ? colors.textTertiary : colors.accent} strokeWidth={2} />
        </ScalePressable>
    );

    return (
        <Screen edges={isLockedIn ? ['top'] : []}>
            {isLockedIn ? (
                <View style={styles.colossalTop}>
                    {back}
                    <UIText variant="tab">Your land</UIText>
                </View>
            ) : (
                <Hero ownsTopInset>
                    {back}
                    <UIText variant="display" tone="onBand" style={styles.heroTitle}>Your land</UIText>
                    <UIText variant="sub" tone="onHero">Every chapter you have worked</UIText>
                </Hero>
            )}

            {!cloth ? (
                <View style={styles.loading}>
                    <LoadingView size={48} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {/*
                      * The count leads, because it is the thing that only ever
                      * goes up. Everything else on this screen fades; this
                      * number is the one that cannot.
                      */}
                    <View style={styles.summary}>
                        <UIText variant="hero">{cloth.worked}</UIText>
                        <UIText variant="label">
                            {`chapters worked of ${cloth.total.toLocaleString()}`}
                        </UIText>
                    </View>

                    <ClothLegend />

                    {/*
                      * Tapping a book says what it is rather than navigating.
                      * At 8px a cell is too small to label, and a cloth whose
                      * blocks cannot be identified is decoration.
                      */}
                    {selected && (
                        <View style={[styles.selected, { borderColor: colors.border }]}>
                            <UIText variant="subtitle">{selected.name}</UIText>
                            <UIText variant="meta" tone="secondary">
                                {selected.worked === 0
                                    ? `${selected.total} chapters, none yet`
                                    : `${selected.worked} of ${selected.total} chapters · last ${ago(selected.lastWorkedDays ?? 0)}`}
                            </UIText>
                        </View>
                    )}

                    <View style={styles.section}>
                        <UIText variant="label">HEBREW SCRIPTURES</UIText>
                        <BibleCloth books={hebrew} onBookPress={setSelected} />
                    </View>

                    <View style={styles.section}>
                        <UIText variant="label">GREEK SCRIPTURES</UIText>
                        <BibleCloth books={greek} onBookPress={setSelected} />
                    </View>

                    {/*
                      * The invitation, and the only place the screen asks for
                      * anything. It names only books already worked — see
                      * `quietBooks`, which explains why it must never reach for
                      * a book the reader has never opened.
                      */}
                    {quiet.length > 0 && (
                        <View style={[styles.quiet, { borderTopColor: colors.border }]}>
                            <UIText variant="label">GONE QUIET</UIText>
                            {quiet.map(book => (
                                <UIText key={book.name} variant="body" tone="secondary">
                                    {`${book.name} — ${book.worked} chapters, last ${ago(book.lastWorkedDays ?? 0)}`}
                                </UIText>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    back: { alignSelf: 'flex-start', marginBottom: Spacing.sm },
    colossalTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
    },
    heroTitle: { marginBottom: Spacing.xs },
    loading: { flex: 1, justifyContent: 'center' },
    content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxl },
    summary: { gap: Spacing.xs },
    selected: { borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
    section: { gap: Spacing.md },
    quiet: { borderTopWidth: 1, paddingTop: Spacing.lg, gap: Spacing.sm },
});
