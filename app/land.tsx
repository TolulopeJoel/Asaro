/**
 * Your land. Every chapter the reader has written about is a worked block of
 * cloth and the whole Bible is the field. Worked land FADES when left alone and
 * is never taken away, so the pull back is "Judges has gone quiet" rather than
 * "you are losing Judges" — `src/land/cloth.ts` argues that out in full.
 *
 * Built from entries, never ticked plan items: a tick says the reader passed
 * over a chapter, an entry says they worked it.
 *
 * Cloth only — see `terrain.ts`: in a monochrome style a green field would be
 * the loudest thing on the page.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { BibleCloth } from '@/src/components/land/BibleCloth';
import { LoadingView } from '@/src/components/LoadingView';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Hero, Screen, Text as UIText } from '@/src/components/ui';
import { GREEK_BOOKS, HEBREW_BOOKS } from '@/src/data/bibleBooks';
import { getChapterCoverage } from '@/src/data/database';
import { BookCloth, Cloth, quietBooks, weaveCloth } from '@/src/land/cloth';
import { fallowHeading } from '@/src/land/fallowTone';
import { landSubtitle, parcelLine } from '@/src/land/landTone';
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
                {/* The count lives here rather than in a panel of its own: a
                  * block below pushes the land down and frames it, and the
                  * field should be the screen rather than an illustration
                  * inside one. Tapping a parcel swaps this line for that
                  * parcel's tally, so identifying one costs no layout. */}
                <UIText variant="sub" tone="onHero" numberOfLines={1}>
                    {selected
                        ? parcelLine(
                            selected.name,
                            selected.worked,
                            selected.total,
                            ago(selected.lastWorkedDays ?? 0),
                        )
                        : landSubtitle(cloth?.worked ?? 0, cloth?.total ?? 0)}
                </UIText>
            </Hero>

            {!cloth ? (
                <View style={styles.loading}>
                    <LoadingView size={48} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {/* One holding, Genesis to Revelation, with no break at
                      * Matthew. Splitting it draws a boundary the reading does
                      * not have — the point of the land is that it is one place
                      * being worked through. */}
                    <BibleCloth
                        books={cloth.books}
                        selected={selected?.name ?? null}
                        onBookPress={book => setSelected(current => (current?.name === book.name ? null : book))}
                    />

                    {/* The invitation, and the only place the screen asks for
                      * anything. Names only books already worked — see
                      * `quietBooks` for why it must never reach further. */}
                    {quiet.length > 0 && (
                        <View style={[styles.quiet, { borderTopColor: colors.border }]}>
                            {/* "Fallow" is the exact word: land left fallow is
                              * resting, not lost, and still yours — the whole
                              * mechanic in one farming term. The heading softens
                              * as the ground gets older, per `fallowTone.ts`. */}
                            <UIText variant="label">
                                {fallowHeading(
                                    quiet.reduce<number | null>(
                                        (oldest, book) =>
                                            book.lastWorkedDays === null
                                                ? oldest
                                                : Math.max(oldest ?? 0, book.lastWorkedDays),
                                        null,
                                    ),
                                ).toUpperCase()}
                            </UIText>
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
    /* No horizontal padding: the land runs to both screen edges, which is the
     * difference between a map and a picture of a map. Anything that is not
     * the land pads itself. */
    content: { paddingBottom: Spacing.xxl },
    quiet: {
        borderTopWidth: 1,
        marginTop: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
    },
});
