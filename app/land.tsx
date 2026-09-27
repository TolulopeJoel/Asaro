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

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Share2, X } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { BibleCloth, LandTree } from '@/src/components/land/BibleCloth';
import { LandShareCard } from '@/src/components/land/LandShareCard';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { useAlert } from '@/src/context/AlertContext';
import { TreeDetail } from '@/src/components/grove/Grove';
import { LoadingView } from '@/src/components/LoadingView';
import { ScalePressable } from '@/src/components/ScalePressable';
import { Hero, Screen, Text as UIText, ThemedButton } from '@/src/components/ui';
import { useFootPadding } from '@/src/hooks/useScreenInsets';
import { GREEK_BOOKS, HEBREW_BOOKS } from '@/src/data/bibleBooks';
import { getAllActionItems, getChapterCoverage } from '@/src/data/database';
import { actionKindOf, isCadence } from '@/src/data/actionKind';
import { GroveTree, loadGrove } from '@/src/grove/loadGrove';
import { BookCloth, ChapterRef, Cloth, nextChapter, quietBooks, weaveCloth } from '@/src/land/cloth';
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

    const { height, width: screenWidth } = useWindowDimensions();
    const { showAlert } = useAlert();
    const scroll = useRef<ScrollView>(null);

    const [cloth, setCloth] = useState<Cloth | null>(null);
    const [next, setNext] = useState<ChapterRef | null>(null);
    const [selected, setSelected] = useState<BookCloth | null>(null);
    const [grove, setGrove] = useState<GroveTree[]>([]);
    const [openTree, setOpenTree] = useState<number | null>(null);
    const [sharing, setSharing] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const shareCard = useRef<View>(null);
    const [cardHeight, setCardHeight] = useState(0);
    const footPadding = useFootPadding(Spacing.xxl);
    const cardFoot = useFootPadding(Spacing.xl);

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            (async () => {
                const rows = await getChapterCoverage();
                const books = [...HEBREW_BOOKS, ...GREEK_BOOKS];
                const woven = weaveCloth(rows, books, Date.now());
                if (alive) {
                    setCloth(woven);
                    setNext(nextChapter(rows, books));
                }
                // Every practice keeps its tree here, resting ones included:
                // a tree never dies, it only goes thirsty.
                try {
                    const items = await getAllActionItems(200);
                    const live = items.filter(
                        item => !item.archived_at && actionKindOf(item) === 'practice' && isCadence(item.cadence),
                    );
                    const trees = await loadGrove(live);
                    if (alive) setGrove(trees);
                } catch {
                    if (alive) setGrove([]);
                }
            })();
            return () => {
                alive = false;
            };
        }, []),
    );

    const trees = useMemo<LandTree[]>(
        () => grove.map(t => ({
            id: t.item.id!,
            bookName: t.item.book_name,
            chapter: t.item.chapter_start,
            stage: t.growth.stage,
            species: t.species,
            thirsty: t.thirsty || t.resting,
        })),
        [grove],
    );
    const tapped = grove.find(t => t.item.id === openTree) ?? null;

    /** Captured at the screen's own density, so the picture is as sharp as the phone. */
    const shareLand = useCallback(async () => {
        if (!shareCard.current) return;
        setCapturing(true);
        try {
            const uri = await captureRef(shareCard, { format: 'png', quality: 1, result: 'tmpfile' });
            await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your land' });
        } catch (error) {
            console.error('Failed to share the land:', error);
            showAlert({ title: 'Couldn\'t share your land', message: 'Try again in a moment.' });
        } finally {
            setCapturing(false);
        }
    }, [showAlert]);

    const quiet = useMemo(
        () => (cloth ? quietBooks(cloth, QUIET_DAYS, QUIET_LIMIT) : []),
        [cloth],
    );

    return (
        <Screen edges={[]}>
            <Hero ownsTopInset>
                <View style={styles.heroTop}>
                    <ScalePressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        hitSlop={Spacing.md}
                        style={styles.back}
                    >
                        <ChevronLeft size={20} color={colors.accent} strokeWidth={2} />
                    </ScalePressable>
                    {cloth && (
                        <ScalePressable
                            onPress={() => setSharing(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Share your land as a picture"
                            hitSlop={Spacing.md}
                        >
                            <Share2 size={19} color={colors.accent} strokeWidth={1.9} />
                        </ScalePressable>
                    )}
                </View>
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
                <ScrollView
                    ref={scroll}
                    // No horizontal padding: the land runs to both screen edges,
                    // which is the difference between a map and a picture of a
                    // map. While a tree's card is up, the foot of the land can
                    // still be scrolled out from under it.
                    contentContainerStyle={{ paddingBottom: footPadding + (tapped ? cardHeight : 0) }}
                >
                    {/* One holding, Genesis to Revelation, with no break at
                      * Matthew. Splitting it draws a boundary the reading does
                      * not have — the point of the land is that it is one place
                      * being worked through. */}
                    <BibleCloth
                        books={cloth.books}
                        selected={selected?.name ?? null}
                        onBookPress={book => {
                            setOpenTree(null);
                            setSelected(current => (current?.name === book.name ? null : book));
                        }}
                        trees={trees}
                        onTreePress={id => {
                            setSelected(null);
                            setOpenTree(current => (current === id ? null : id));
                        }}
                        marker={next}
                        // A third of the way down, so the field he is walking
                        // into shows below him.
                        onMarkerLayout={y => scroll.current?.scrollTo({ y: Math.max(0, y - height / 3) })}
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

            {/* The picture before it goes anywhere: what you see is exactly what is sent. */}
            {cloth && (
                <AnimatedModal visible={sharing} onRequestClose={() => setSharing(false)} transparent>
                    <View style={[styles.shareBackdrop, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                        <ScrollView contentContainerStyle={styles.shareScroll}>
                            <LandShareCard
                                ref={shareCard}
                                books={cloth.books}
                                trees={trees}
                                width={Math.min(screenWidth - Spacing.lg * 2, 420)}
                            />
                            <View style={styles.shareActions}>
                                <ThemedButton label="Share" variant="accent" block onPress={shareLand} loading={capturing} disabled={capturing} />
                                <ScalePressable onPress={() => setSharing(false)} accessibilityRole="button" hitSlop={Spacing.md}>
                                    <UIText variant="button" tone="onBand">Close</UIText>
                                </ScalePressable>
                            </View>
                        </ScrollView>
                    </View>
                </AnimatedModal>
            )}

            {tapped && (
                <View
                    style={[styles.treeCard, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: cardFoot }]}
                    onLayout={e => setCardHeight(e.nativeEvent.layout.height)}
                >
                    <ScalePressable
                        onPress={() => setOpenTree(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                        hitSlop={Spacing.md}
                        style={styles.treeClose}
                    >
                        <X size={18} color={colors.textTertiary} />
                    </ScalePressable>
                    <TreeDetail tree={tapped} divided={false} />
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    back: { alignSelf: 'flex-start' },
    shareBackdrop: { flex: 1 },
    shareScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.lg },
    shareActions: { alignSelf: 'stretch', alignItems: 'center', gap: Spacing.md },
    heroTitle: { marginBottom: Spacing.xs },
    loading: { flex: 1, justifyContent: 'center' },
    /* A tapped tree opens over the foot of the land, like a card turned up. */
    treeCard: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 1,
        padding: Spacing.lg,
    },
    treeClose: { position: 'absolute', top: Spacing.md, right: Spacing.md, zIndex: 1 },
    quiet: {
        borderTopWidth: 1,
        marginTop: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
    },
});
