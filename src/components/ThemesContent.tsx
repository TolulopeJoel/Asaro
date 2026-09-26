import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { ScalePressable } from './ScalePressable';
import { Button } from './Button';
import { HyperlinkedText } from './HyperlinkedText';
import { centerWithinFields, clusterThemes, representatives } from '../ml/clustering';
import { suggestNames } from '../ml/themeNames';
import { RankedTheme, rankThemes, spanLabel } from '../ml/themeQuality';
import {
    EMBEDDABLE_FIELDS,
    ACTION_FIELD,
    StoredEmbedding,
    backfillEmbeddings,
    loadEmbeddings,
    NamedTheme,
    getNamedThemes,
    matchThemeName,
    nameTheme,
    pruneEmbeddings,
    renameTheme,
} from '../data/embeddingRepository';
import { downloadModel, isModelDownloaded, unload } from '../ml/embedder';
import { AnimatedModal } from './AnimatedModal';
import { ThemeDetail } from './ThemeDetail';
import { JournalEntryDetail } from './JournalEntryDetail';
import { getEntryById, JournalEntry } from '../data/database';
import { Asaro, Text as UIText, ThemedButton, textStyle } from './ui';

const FIELD_LABELS: Record<string, string> = {
    ...Object.fromEntries(EMBEDDABLE_FIELDS.map(f => [f.column, f.label])),
    [ACTION_FIELD]: 'action',
};

/**
 * Themes need enough material to mean anything. Below this, clustering finds
 * the reading plan rather than the reader, so we say so instead of shipping a
 * confident-looking wrong answer.
 */
const MIN_ENTRIES = 15;

/**
 * Example snippets per theme, by position in the list. From
 * design/all-screens.html #themes: the first theme gets two excerpts, the
 * second one, the third a bare name-and-meta row. Both the `.cl` and `.co`
 * slots taper identically, so it is the rule for the screen.
 */
const PREVIEW_SNIPPETS = [2, 1];

type Phase = 'checking' | 'needsModel' | 'downloading' | 'working' | 'ready' | 'tooEarly' | 'error';

function reference(item: StoredEmbedding): string {
    const range =
        item.chapterEnd && item.chapterEnd !== item.chapterStart
            ? `${item.chapterStart}-${item.chapterEnd}`
            : `${item.chapterStart}`;
    return `${item.bookName} ${range}`;
}

export function ThemesContent({ onPatternCountChange }: { onPatternCountChange?: (count: number | null) => void } = {}) {
    const { colors, style: themeStyle } = useTheme();
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('checking');
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    // Entries open on top of the theme rather than navigating away, so closing
    // one returns you to the theme you were reading — a theme is meant to be
    // read through, and pushing a route would eject you on every entry.
    const [openEntry, setOpenEntry] = useState<JournalEntry | null>(null);
    const [progress, setProgress] = useState(0);
    // The full ranking, not just the clusters inside it: `spanDays` is the
    // card's headline, and keeping only `.cluster` means recomputing it from
    // member dates at every render site.
    const [ranked, setRanked] = useState<RankedTheme[]>([]);
    const clusters = useMemo(() => ranked.map(theme => theme.cluster), [ranked]);
    const [named, setNamed] = useState<NamedTheme[]>([]);
    const [entryCount, setEntryCount] = useState(0);
    const [namingIndex, setNaming] = useState<number | null>(null);
    const [draftName, setDraftName] = useState('');
    const [errorText, setErrorText] = useState('');
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            // The session holds real memory; don't keep it alive behind a tab
            // the reader has left.
            unload();
        };
    }, []);

    const compute = useCallback(async () => {
        try {
            setPhase('working');
            await pruneEmbeddings();
            await backfillEmbeddings(({ done, total }) => {
                if (mounted.current) setProgress(total ? done / total : 1);
            });

            const items = await loadEmbeddings();
            if (!mounted.current) return;

            const entries = new Set(items.map(i => i.entryId));
            setEntryCount(entries.size);

            if (entries.size < MIN_ENTRIES) {
                onPatternCountChange?.(null);
                setPhase('tooEarly');
                return;
            }

            // Clustering says what groups together; `rankThemes` says which
            // groups are worth showing. The centered vectors go with it
            // because the cohesion floor is measured against this corpus.
            const centered = centerWithinFields(items);
            const found = clusterThemes(centered, { grain: 85, minEntries: 3 });
            const ranked = rankThemes(found, centered);

            setRanked(ranked);
            onPatternCountChange?.(ranked.length);
            setNamed(await getNamedThemes());
            setPhase('ready');
        } catch (error: any) {
            if (!mounted.current) return;
            onPatternCountChange?.(null);
            setErrorText(error?.message ?? 'Something went wrong');
            setPhase('error');
        }
    }, [onPatternCountChange]);

    useEffect(() => {
        (async () => {
            const ready = await isModelDownloaded();
            if (!mounted.current) return;
            if (ready) compute();
            else {
                onPatternCountChange?.(null);
                setPhase('needsModel');
            }
        })();
    }, [compute]);

    const handleDownload = useCallback(async () => {
        try {
            setPhase('downloading');
            setProgress(0);
            await downloadModel(fraction => {
                if (mounted.current) setProgress(fraction);
            });
            await compute();
        } catch (error: any) {
            if (!mounted.current) return;
            setErrorText(error?.message ?? 'Download failed');
            setPhase('error');
        }
    }, [compute]);

    /*
     * "Try again" has to ask what actually went wrong. Retrying straight into
     * `compute` when the DOWNLOAD failed fetches the model deep inside `embed`
     * with no progress callback, under a "Looking for patterns…" label — 34MB
     * of silence that reads exactly like the hang the reader just hit.
     */
    const handleRetry = useCallback(async () => {
        const ready = await isModelDownloaded();
        if (!mounted.current) return;
        if (ready) await compute();
        else await handleDownload();
    }, [compute, handleDownload]);

    const handleSaveName = useCallback(
        async (index: number) => {
            const cluster = clusters[index];
            if (!cluster || !draftName.trim()) return;

            const members = cluster.members.map(m => ({ entryId: m.entryId, field: m.field }));
            const existing = matchThemeName(members, named);

            // Renaming keeps the same theme row, so the name stays attached to
            // the entries that earned it rather than piling up duplicates.
            if (existing) await renameTheme(existing.id, draftName);
            else await nameTheme(draftName, members);

            setNamed(await getNamedThemes());
            setNaming(null);
            setDraftName('');
        },
        [clusters, draftName, named],
    );

    /*
     * A provisional label per cluster, so no theme shows up nameless. MUST sit
     * above the early returns below — it is a hook and those bail out first. A
     * saved name is applied over the top at each render site rather than folded
     * in here, so renaming never invalidates this.
     */
    const suggested = useMemo(() => suggestNames(clusters), [clusters]);

    // ── states before there is anything to show ──────────────────────────────

    if (phase === 'checking') {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    if (phase === 'needsModel') {
        // design/all-screens.html #themesintro, the `.cl` slot: a centred
        // column in a 34px gutter. The privacy line sits between two hairlines
        // — the one sentence here that must not be skimmed past.
        return (
            <View style={styles.clothCentre}>
                <Asaro size={74} action="think" label="Àṣàrò" />
                <UIText variant="title" style={styles.centred}>Find your themes</UIText>
                <UIText variant="body" tone="secondary" style={styles.centred}>
                    I can group your entries by what you keep coming back to. It needs a
                    one-time 34MB download, then it works offline.
                </UIText>
                <View style={[styles.clothPledge, { borderColor: colors.border }]}>
                    <UIText variant="sub" tone="primary" style={styles.centred}>
                        Your reflections are never sent anywhere.
                    </UIText>
                </View>
                <ThemedButton label="Download (34MB)" onPress={handleDownload} />
            </View>
        );
    }

    if (phase === 'downloading' || phase === 'working') {
        const label =
            phase === 'downloading'
                ? `Downloading… ${Math.round(progress * 100)}%`
                : progress > 0 && progress < 1
                  ? `Reading your entries… ${Math.round(progress * 100)}%`
                  : 'Give me a minute. I am reading everything.';
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <UIText variant="body" tone="secondary" style={styles.centred}>{label}</UIText>
            </View>
        );
    }

    if (phase === 'tooEarly') {
        // design/all-screens.html #themesearly, the `.cl` slot: the shortfall
        // as a sentence, with a two-part indigo bar under it.
        return (
            <View style={styles.clothCentre}>
                <Asaro size={74} action="think" label="Àṣàrò" />
                <UIText variant="title" style={styles.centred}>Not yet</UIText>
                <UIText variant="body" tone="secondary" style={styles.centred}>
                    You have {entryCount} {entryCount === 1 ? 'entry' : 'entries'} with enough
                    written in them. Themes start to mean something around {MIN_ENTRIES} — before
                    that they mostly describe the reading plan rather than you.
                </UIText>
                <View style={styles.clothBar}>
                    <View style={{ flex: Math.max(entryCount, 0.001), height: 6, backgroundColor: colors.textPrimary }} />
                    <View style={{ flex: Math.max(MIN_ENTRIES - entryCount, 0.001), height: 6, backgroundColor: colors.border }} />
                </View>
                <UIText variant="label">{`${entryCount} of ${MIN_ENTRIES}`}</UIText>
            </View>
        );
    }

    if (phase === 'error') {
        return (
            <View style={styles.center}>
                <UIText variant="title" style={styles.centred}>Couldn&apos;t finish</UIText>
                <UIText variant="body" tone="secondary" style={styles.centred}>{errorText}</UIText>
                <Button label="Try again" onPress={handleRetry} />
            </View>
        );
    }

    if (clusters.length === 0) {
        return (
            <View style={styles.center}>
                <UIText variant="title" style={styles.centred}>No themes yet</UIText>
                <UIText variant="body" tone="secondary" style={styles.centred}>
                    Nothing you&apos;ve written grouped together strongly enough to call a theme.
                    Keep going — this gets sharper as the journal grows.
                </UIText>
            </View>
        );
    }

    // ── the themes ───────────────────────────────────────────────────────────

    const openCluster = openIndex !== null ? clusters[openIndex] : null;
    const openName =
        openCluster &&
        (matchThemeName(
            openCluster.members.map(m => ({ entryId: m.entryId, field: m.field })),
            named,
        )?.name ??
            suggested[openIndex!]);

    return (
        <>
        <FlatList
            data={clusters}
            keyExtractor={(_, index) => `cluster-${index}`}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
                <UIText variant="bodySmall" tone="secondary" style={styles.intro}>
                    {clusters.length} {clusters.length === 1 ? 'pattern' : 'patterns'} across your
                    entries. Name the ones you recognise.
                </UIText>
            }
            renderItem={({ item, index }) => {
                // Snippets taper rather than repeating at full weight: past
                // the first screenful excerpts stop orienting and start being a
                // wall. Clusters arrive strongest first, so position is rank.
                const previewCount = PREVIEW_SNIPPETS[index] ?? 0;
                const reps = previewCount > 0 ? representatives(item, previewCount) : [];
                const books = [...new Set(item.members.map(m => m.bookName))].filter(Boolean);
                /*
                 * The span leads, not the count. "5 entries" is a fact about
                 * the clustering; "across 8 months" says the group outlived the
                 * passage that prompted it, which is the evidence the
                 * connection is the reader's rather than the plan's. Falls back
                 * to the count below a month — see `spanLabel`.
                 */
                const span = spanLabel(ranked[index]?.spanDays ?? 0);
                const entryCountLabel = `${item.entryCount} ${item.entryCount === 1 ? 'entry' : 'entries'}`;
                const savedName = matchThemeName(
                    item.members.map(m => ({ entryId: m.entryId, field: m.field })),
                    named,
                );
                // Every theme carries a name: the reader's own, else the words
                // their entries lean on. `savedName` still gates the naming
                // affordances — a suggestion is something to replace.
                const displayName = savedName?.name ?? suggested[index];

                /*
                 * design/all-screens.html #themes, the `.cl` slot: an unnamed
                 * theme's panel shows the field DIRECTLY — ochre-labelled input
                 * plus Save/Cancel — never a "Name this theme" button. That
                 * only appears once a theme has a name, as "Rename".
                 *
                 * Open on request only: now that every theme reads with a name,
                 * a field standing open under each one nags.
                 */
                const naming = namingIndex === index;

                return (
                    <View style={[styles.card, { backgroundColor: colors.backgroundSubtle }]}>
                        <ScalePressable onPress={() => setOpenIndex(index)}>
                            <UIText
                                variant="subtitle"
                                tone={savedName ? undefined : 'secondary'}
                                style={styles.clothName}
                            >
                                {displayName}
                            </UIText>

                            <View style={styles.cardHeader}>
                                <UIText variant="label">{span ?? entryCountLabel}</UIText>
                                {books.length > 0 && (
                                    <UIText variant="caption" style={styles.books} numberOfLines={1}>
                                        {books.join(' · ')}
                                    </UIText>
                                )}
                            </View>

                            {reps.map((member, i) => (
                                <View key={`${member.entryId}-${member.field}-${i}`} style={styles.snippet}>
                                    <UIText variant="caption" tone="tertiary">
                                        {reference(member)} · {FIELD_LABELS[member.field] ?? member.field}
                                    </UIText>
                                    <HyperlinkedText
                                        style={[textStyle(themeStyle, 'bodySmall'), { color: colors.textSecondary }]}
                                        numberOfLines={3}
                                        text={member.text}
                                    />
                                </View>
                            ))}
                        </ScalePressable>

                        {naming ? (
                            <View style={styles.nameRow}>
                                <TextInput
                                    style={[
                                        styles.nameInput,
                                        textStyle(themeStyle, 'body'),
                                        {
                                            backgroundColor: colors.background,
                                            color: colors.textPrimary,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    placeholder="What is this really about?"
                                    placeholderTextColor={colors.textTertiary}
                                    value={namingIndex === index ? draftName : ''}
                                    onFocus={() => {
                                        setNaming(index);
                                        setDraftName(displayName);
                                    }}
                                    onChangeText={setDraftName}
                                    onSubmitEditing={() => handleSaveName(index)}
                                />
                                <ScalePressable
                                    onPress={() => handleSaveName(index)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Save name"
                                    style={[styles.iconBtn, { backgroundColor: colors.accent }]}
                                >
                                    <Check size={18} color={colors.buttonPrimaryText} />
                                </ScalePressable>
                                {/* `.cl-btn.ghost{aria-label="Cancel"}` is
                                  * drawn alongside Save on BOTH panels in the
                                  * mockup, so this is unconditional. */}
                                <ScalePressable
                                    onPress={() => {
                                        setNaming(null);
                                        setDraftName('');
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancel"
                                    style={[styles.iconBtn, { backgroundColor: 'transparent', borderWidth: Spacing.border.hairline, borderColor: colors.border }]}
                                >
                                    <X size={18} color={colors.textSecondary} />
                                </ScalePressable>
                            </View>
                        ) : (
                            <ScalePressable
                                onPress={() => {
                                    setNaming(index);
                                    setDraftName(displayName);
                                }}
                                style={[styles.nameCta, { borderColor: colors.border }]}
                            >
                                <UIText variant="label" tone="tertiary">
                                    {savedName ? 'Rename' : 'Name this'}
                                </UIText>
                            </ScalePressable>
                        )}

                        {/* Only meaningful next to visible examples: on a
                          * compact row the meta line already gives the count,
                          * and "+4 more" under nothing reads as concealment. */}
                        {reps.length > 0 && item.entryCount > reps.length && (
                            <UIText variant="caption" style={styles.more}>
                                +{item.entryCount - reps.length} more — tap to read
                            </UIText>
                        )}
                    </View>
                );
            }}
        />

        <AnimatedModal visible={openCluster !== null} onRequestClose={() => setOpenIndex(null)}>
            {openCluster && (
                <ThemeDetail
                    cluster={openCluster}
                    name={openName ?? undefined}
                    onClose={() => setOpenIndex(null)}
                    onRename={() => {
                        setNaming(openIndex);
                        setDraftName(openName ?? '');
                        setOpenIndex(null);
                    }}
                    onOpenEntry={async entryId => {
                        const entry = await getEntryById(entryId);
                        if (entry) setOpenEntry(entry);
                    }}
                />
            )}
        </AnimatedModal>

        <AnimatedModal visible={openEntry !== null} onRequestClose={() => setOpenEntry(null)}>
            {openEntry && (
                <JournalEntryDetail
                    entry={openEntry}
                    onClose={() => setOpenEntry(null)}
                    onEdit={entry => {
                        setOpenEntry(null);
                        setOpenIndex(null);
                        router.push({
                            pathname: '/addEntry',
                            params: { entryId: entry.id!.toString() },
                        });
                    }}
                />
            )}
        </AnimatedModal>
        </>
    );
}

const styles = StyleSheet.create({
    /** `.cl` themes states: centred in a 34px gutter, gap 16. */
    clothCentre: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.lg,
        paddingHorizontal: Spacing.xxl + 2,
    },
    clothPledge: {
        borderTopWidth: Spacing.border.hairline,
        borderBottomWidth: Spacing.border.hairline,
        paddingVertical: 11,
    },
    clothBar: { flexDirection: 'row', gap: 3, width: '100%' },

    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    centred: { textAlign: 'center' },
    intro: { paddingBottom: Spacing.md },
    clothNameCta: { marginTop: Spacing.sm },
    list: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.layout.cardPadding,
        paddingBottom: 80,
    },
    /** `.cl-panel{background:var(--panel); padding:18px}` — filled, never
     * outlined. Cloth separates by colour block; a border reads as a card
     * from another design. */
    card: {
        padding: Spacing.layout.cardPadding,
        marginBottom: Spacing.md,
        gap: 0,
    },
    /** `.cl-h.md` name, 7px clear of the count line under it. */
    clothName: { marginBottom: 7 },
    cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 11 },
    books: { flex: 1 },
    /** A reference line at 3px, then its snippet — the mockup's own rhythm. */
    snippet: { gap: 3, paddingBottom: 10 },
    nameCta: {
        marginTop: Spacing.sm,
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.sm,
        paddingVertical: 10,
        alignItems: 'center',
    },
    more: { paddingTop: Spacing.xs },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm },
    nameInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.sm,
        paddingHorizontal: 12,
        paddingVertical: Spacing.sm + 2,
    },
    iconBtn: { width: 40, height: 40, borderRadius: Spacing.borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
});
