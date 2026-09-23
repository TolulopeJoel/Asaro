import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { Sparkles, Check, X } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { ScalePressable } from './ScalePressable';
import { Button } from './Button';
import { HyperlinkedText } from './HyperlinkedText';
import { Cluster, centerWithinFields, clusterThemes, representatives } from '../ml/clustering';
import { suggestNames } from '../ml/themeNames';
import { rankThemes } from '../ml/themeQuality';
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
import { Screen, Text as UIText, ThemedButton, textStyle } from './ui';

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
 * Example snippets per theme, by position in the list.
 *
 * Straight from design/all-screens.html #themes, which draws its three themes
 * at three different weights rather than one weight repeated: the first gets
 * a name, meta and two excerpts; the second one excerpt; the third is a bare
 * name-and-meta row. Both the `.cl` and `.co` slots taper identically, so it
 * is the rule for the screen and not a quirk of one style. Anything past the
 * second position is compact — read the name, tap if it interests you.
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
    const { colors, style: themeStyle, isLockedIn } = useTheme();
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('checking');
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    // Entries open on top of the theme rather than navigating away, so closing
    // one returns you to the theme you were reading — a theme is meant to be
    // read through, and pushing a route would eject you on every entry.
    const [openEntry, setOpenEntry] = useState<JournalEntry | null>(null);
    const [progress, setProgress] = useState(0);
    const [clusters, setClusters] = useState<Cluster<StoredEmbedding>[]>([]);
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

            /*
             * Clustering says what groups together; rankThemes says which of
             * those groups is worth showing. It drops anything no tighter
             * than two entries picked at random, pushes suspected
             * reading-plan artifacts (one book, one week) below themes that
             * recur across books and months, and tilts toward what you have
             * written recently. The centered vectors go with it because the
             * "tighter than chance" floor is measured against this corpus,
             * not a fixed number.
             */
            const centered = centerWithinFields(items);
            const found = clusterThemes(centered, { grain: 85, minEntries: 3 });
            const ranked = rankThemes(found, centered);

            setClusters(ranked.map(theme => theme.cluster));
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
     * "Try again" has to ask what actually went wrong.
     *
     * Retrying straight into `compute` assumes the model is on disk and goes
     * looking for patterns with it. When the failure was the download itself
     * that is the wrong half of the job: the model gets fetched anyway, deep
     * inside `embed`, but with no progress callback and under a "Looking for
     * patterns…" label — 34MB of silence that reads exactly like the hang the
     * reader just hit. Routing a missing model back through `handleDownload`
     * retries the part that failed, with the progress bar that belongs to it.
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
     * A provisional label per cluster, so no theme shows up nameless.
     *
     * Must sit above the early returns below — it is a hook, and the phase
     * checks bail out before the list renders. Recomputed only when the
     * clusters themselves change; a saved name is applied over the top of
     * this at each render site rather than being folded in here, so renaming
     * never has to invalidate it.
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
        /*
         * design/all-screens.html #themesintro, the `.co` slot. Colossal takes
         * no colossal element here — there is nothing yet to count — so the
         * screen is a centred column, and the privacy line is set apart
         * between two rules rather than folded into the paragraph. Cloth runs
         * them together; Colossal makes it the one thing you can't skim past.
         */
        if (isLockedIn) {
            return (
                <View style={styles.colossalCentre}>
                    <Sparkles size={34} color={colors.accent} strokeWidth={1.6} />
                    <UIText variant="display">Find your themes</UIText>
                    <UIText variant="sub">
                        Àṣàrò can group your entries by what you keep coming back to. It needs a
                        one-time 34MB download, then it works offline.
                    </UIText>
                    <View style={[styles.pledge, { borderColor: colors.border }]}>
                        <UIText variant="bodySmall" tone="primary" style={styles.pledgeText}>
                            Your reflections are never sent anywhere.
                        </UIText>
                    </View>
                    <ThemedButton label="Download (34MB)" variant="accent" block onPress={handleDownload} />
                </View>
            );
        }

        /*
         * design/all-screens.html #themesintro, the `.cl` slot: a centred
         * column in a 34px gutter. Cloth sets the privacy line between two
         * hairlines just as Colossal does — it is the one sentence on this
         * screen that must not be skimmed past.
         */
        return (
            <View style={styles.clothCentre}>
                <Sparkles size={34} color={colors.accent} strokeWidth={1.5} />
                <UIText variant="title" style={styles.centred}>Find your themes</UIText>
                <UIText variant="body" tone="secondary" style={styles.centred}>
                    Àṣàrò can group your entries by what you keep coming back to. It needs a
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
                  : 'Looking for patterns…';
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <UIText variant="body" tone="secondary" style={styles.centred}>{label}</UIText>
            </View>
        );
    }

    if (phase === 'tooEarly') {
        /*
         * design/all-screens.html #themesearly, the `.co` slot. The colossal
         * slot goes to how many entries you have, because that is the number
         * the screen is actually about, and the two-part bar underneath says
         * the same thing a second way without a second number.
         */
        if (isLockedIn) {
            return (
                <View style={styles.colossalCentrePlain}>
                    <View>
                        <UIText variant="hero">{entryCount}</UIText>
                        <UIText variant="label" style={styles.giantLabel}>
                            {`of ${MIN_ENTRIES} entries needed`}
                        </UIText>
                    </View>
                    <View style={[styles.rule, { backgroundColor: colors.border }]} />
                    <View>
                        <UIText variant="title">Not yet</UIText>
                        <UIText variant="sub" style={styles.afterHeading}>
                            Themes start to mean something around fifteen substantial entries.
                            Before that they mostly describe the reading plan rather than you.
                        </UIText>
                    </View>
                    <View style={styles.progressBar}>
                        <View style={{ flex: Math.max(entryCount, 0.001), height: 6, backgroundColor: colors.accent }} />
                        <View style={{ flex: Math.max(MIN_ENTRIES - entryCount, 0.001), height: 6, backgroundColor: colors.border }} />
                    </View>
                </View>
            );
        }

        /*
         * design/all-screens.html #themesearly, the `.cl` slot. Cloth states
         * the shortfall as a sentence and draws the same two-part bar under it,
         * in indigo against the hairline rather than ochre against the surface.
         */
        return (
            <View style={styles.clothCentre}>
                <Sparkles size={34} color={colors.textMuted} strokeWidth={1.5} />
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
            contentContainerStyle={isLockedIn ? styles.colossalList : styles.list}
            ListHeaderComponent={
                isLockedIn ? (
                    /* The count itself is the screen's colossal element, set in
                     * the header above this list, so all that is left to say
                     * here is what to do with it. */
                    <UIText variant="sub" style={styles.colossalIntro}>Name the ones you recognise.</UIText>
                ) : (
                    <UIText variant="bodySmall" tone="secondary" style={styles.intro}>
                        {clusters.length} {clusters.length === 1 ? 'pattern' : 'patterns'} across your
                        entries. Name the ones you recognise.
                    </UIText>
                )
            }
            renderItem={({ item, index }) => {
                /*
                 * Snippets taper down the list rather than repeating at full
                 * weight. Every theme was showing three, which is what made
                 * this a scroll: past the first screenful the examples stop
                 * being orienting and start being a wall, and the answer to
                 * "what is this theme" is the name, not its third excerpt.
                 * Clusters arrive sorted strongest first, so position is
                 * rank — the theme most worth reading earns the most room.
                 */
                const previewCount = PREVIEW_SNIPPETS[index] ?? 0;
                const reps = previewCount > 0 ? representatives(item, previewCount) : [];
                const books = [...new Set(item.members.map(m => m.bookName))].filter(Boolean);
                const savedName = matchThemeName(
                    item.members.map(m => ({ entryId: m.entryId, field: m.field })),
                    named,
                );
                /*
                 * Every theme carries a name now: the person's own if they
                 * gave it one, otherwise the words their entries lean on.
                 * `savedName` still gates the naming affordances below — a
                 * suggestion is something to replace, not something already
                 * saved.
                 */
                const displayName = savedName?.name ?? suggested[index];

                if (isLockedIn) {
                    /*
                     * design/all-screens.html #themes, the `.co` slot: a run of
                     * hairline-separated blocks rather than cards. A theme that
                     * has a name leads with it; one that hasn't leads with what
                     * it is made of and offers the field, which is why there is
                     * no separate "Name this theme" button in this style.
                     */
                    const meta = [`${item.entryCount} ${item.entryCount === 1 ? 'entry' : 'entries'}`, ...books].join(' · ');
                    /*
                     * Open only on request now. This used to be
                     * `!savedName || …`, so every unnamed theme sat under an
                     * open text field — reasonable when unnamed meant blank,
                     * nagging once a theme already reads with a name. Naming
                     * is still reachable here the moment you ask for it, and
                     * from the pencil in the detail view.
                     */
                    const naming = namingIndex === index;

                    return (
                        <View style={[styles.colossalTheme, { borderBottomColor: colors.border }]}>
                            <ScalePressable onPress={() => setOpenIndex(index)}>
                                <UIText
                                    variant="subtitle"
                                    tone={savedName ? undefined : 'secondary'}
                                    style={styles.colossalName}
                                >
                                    {displayName}
                                </UIText>
                                <UIText variant="label" tone="accent" style={styles.colossalMeta} numberOfLines={1}>
                                    {meta}
                                </UIText>
                                {reps.map((member, i) => (
                                    <View key={`${member.entryId}-${member.field}-${i}`}>
                                        <UIText variant="meta">
                                            {reference(member)} · {FIELD_LABELS[member.field] ?? member.field}
                                        </UIText>
                                        <HyperlinkedText
                                            style={[
                                                textStyle(themeStyle, 'bodySmall'),
                                                styles.colossalSnippet,
                                                { color: colors.textSecondary },
                                            ]}
                                            numberOfLines={2}
                                            text={member.text}
                                        />
                                    </View>
                                ))}
                            </ScalePressable>

                            {naming && (
                                <View style={styles.colossalNameRow}>
                                    <TextInput
                                        style={[
                                            styles.colossalInput,
                                            textStyle(themeStyle, 'bodySmall'),
                                            {
                                                backgroundColor: colors.backgroundElevated,
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
                                        style={[styles.colossalSave, { backgroundColor: colors.buttonPrimary }]}
                                    >
                                        <Check size={15} color={colors.buttonPrimaryText} strokeWidth={3} />
                                    </ScalePressable>
                                </View>
                            )}
                        </View>
                    );
                }

                /*
                 * design/all-screens.html #themes, the `.cl` slot: an unnamed
                 * theme's panel shows the field DIRECTLY — an ochre-labelled
                 * input plus Save/Cancel — never a separate "Name this theme"
                 * button. That button only ever appears once a theme already
                 * has a name, as "Rename". Same rule Colossal already follows.
                 */
                // Open only on request — see the Colossal branch above.
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
                                <UIText variant="label">{item.entryCount} entries</UIText>
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
                                {/*
                                  * `.cl-btn.ghost{aria-label="Cancel"}` is drawn
                                  * alongside Save on BOTH the named and unnamed
                                  * panel in the mockup — unlike Colossal, which
                                  * carries only Save. So this is unconditional.
                                  */}
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

                        {/*
                          * Only meaningful next to visible examples. On a
                          * compact row the meta line already says how many
                          * entries there are, and "+4 more" under nothing
                          * reads as a count of things being hidden.
                          */}
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
                <Screen edges={['top', 'bottom', 'left', 'right']}>
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
                </Screen>
            )}
        </AnimatedModal>
        </>
    );
}

const styles = StyleSheet.create({
    // ── Colossal ──────────────────────────────────────────────────────────
    /** The first-run column: `flex:1; justify-content:center; gap:18`. */
    colossalCentre: {
        flex: 1,
        justifyContent: 'center',
        gap: Spacing.lg + 2,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
    },
    /** The same column where the mockup sets its own spacing between blocks. */
    colossalCentrePlain: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: Spacing.layout.screenPaddingTight,
    },
    /** `.co-giantl` sits 10px under its numeral. */
    giantLabel: { marginTop: 10 },
    /** `.co-hr` */
    rule: { height: Spacing.border.hairline, marginVertical: Spacing.xl + 2 },
    afterHeading: { marginTop: 14 },
    progressBar: { flexDirection: 'row', gap: 3, marginTop: Spacing.xl - 2 },
    /** The privacy line, held between two rules so it can't be skimmed past. */
    pledge: {
        borderTopWidth: Spacing.border.hairline,
        borderBottomWidth: Spacing.border.hairline,
        paddingVertical: 13,
    },
    pledgeText: { fontWeight: '700' },

    /** The results list runs in Colossal's own 22px gutter. */
    colossalList: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg + 2,
        paddingBottom: 80,
    },
    colossalIntro: { marginBottom: Spacing.lg + 2 },
    colossalTheme: {
        paddingBottom: Spacing.lg,
        marginBottom: Spacing.lg,
        borderBottomWidth: Spacing.border.hairline,
    },
    colossalName: { marginBottom: 6 },
    colossalMeta: { marginBottom: 10 },
    colossalSnippet: { marginTop: 2, marginBottom: 9 },
    colossalNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
    colossalInput: {
        flex: 1,
        borderWidth: Spacing.border.hairline,
        paddingHorizontal: Spacing.md,
        paddingVertical: 11,
    },
    colossalSave: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

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
    /**
     * `.cl-panel{background:var(--panel); padding:18px}` — filled, never
     * outlined. Cloth separates by colour block; the 1px border this used to
     * carry is Colossal's device, and having both made the panel read as a
     * card from a third design.
     */
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
