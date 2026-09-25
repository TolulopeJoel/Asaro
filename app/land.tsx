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
 * the land honest — it is made of what they wrote, and nothing else.
 *
 * Cloth only. `terrain.ts` explains why: Colossal is monochrome by rule and a
 * green field would be the loudest thing in it, so rather than ship a grey
 * shadow of this screen there is one version of it.
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

/** Past this, a parcel has been resting long enough to be worth naming. */
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
    const { colors } = useTheme();
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

    const quiet = useMemo(
        () => (cloth ? quietBooks(cloth, QUIET_DAYS, QUIET_LIMIT) : []),
        [cloth],
    );

    return (
        <Screen edges={[]}>
            <Hero ownsTopInset>
                <ScalePressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={Spacing.md}
                    style={styles.back}
                >
                    <ChevronLeft size={20} color={colors.accent} strokeWidth={2} />
                </ScalePressable>
                <UIText variant="display" tone="onBand" style={styles.heroTitle}>Your land</UIText>
                <UIText variant="sub" tone="onHero">Every chapter you have planted</UIText>
            </Hero>

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
                            {`chapters under cultivation of ${cloth.total.toLocaleString()}`}
                        </UIText>
                    </View>

                    <ClothLegend />

                    {/*
                      * Tapping a parcel says what it is rather than navigating.
                      * The name is watermarked on the ground, but abbreviated
                      * and shrunk to fit — this is where "Lev" becomes
                      * Leviticus, with what has actually been planted in it.
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

                    {/*
                      * One holding, Genesis to Revelation, with no break at
                      * Matthew. Splitting it into two fields drew a boundary
                      * the reading does not have: someone who reads the plan
                      * crosses from Malachi to Matthew without the ground
                      * changing under them, and the whole point of the land is
                      * that it is one place they are working through.
                      */}
                    <BibleCloth
                        books={cloth.books}
                        selected={selected?.name ?? null}
                        onBookPress={setSelected}
                    />

                    {/*
                      * The invitation, and the only place the screen asks for
                      * anything. It names only books already worked — see
                      * `quietBooks`, which explains why it must never reach for
                      * a book the reader has never opened.
                      */}
                    {quiet.length > 0 && (
                        <View style={[styles.quiet, { borderTopColor: colors.border }]}>
                            <UIText variant="label">LYING FALLOW</UIText>
                            {/*
                              * Fallow is the exact word and it is doing real
                              * work. Land left fallow is resting, not lost, and
                              * it is still yours — which is the whole mechanic
                              * in one farming term the reader already knows.
                              */}
                            {quiet.map(book => (
                                <UIText key={book.name} variant="body" tone="secondary">
                                    {`${book.name} — ${book.worked} chapters, last worked ${ago(book.lastWorkedDays ?? 0)}`}
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
    heroTitle: { marginBottom: Spacing.xs },
    loading: { flex: 1, justifyContent: 'center' },
    content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxl },
    summary: { gap: Spacing.xs },
    selected: { borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
    section: { gap: Spacing.md },
    quiet: { borderTopWidth: 1, paddingTop: Spacing.lg, gap: Spacing.sm },
});
