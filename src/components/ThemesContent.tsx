import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sparkles, Check, X } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { ScalePressable } from './ScalePressable';
import { Button } from './Button';
import { HyperlinkedText } from './HyperlinkedText';
import { Cluster, centerWithinFields, clusterThemes, representatives } from '../ml/clustering';
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

type Phase = 'checking' | 'needsModel' | 'downloading' | 'working' | 'ready' | 'tooEarly' | 'error';

function reference(item: StoredEmbedding): string {
    const range =
        item.chapterEnd && item.chapterEnd !== item.chapterStart
            ? `${item.chapterStart}-${item.chapterEnd}`
            : `${item.chapterStart}`;
    return `${item.bookName} ${range}`;
}

export function ThemesContent() {
    const { colors } = useTheme();
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('checking');
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [progress, setProgress] = useState(0);
    const [clusters, setClusters] = useState<Cluster<StoredEmbedding>[]>([]);
    const [named, setNamed] = useState<NamedTheme[]>([]);
    const [entryCount, setEntryCount] = useState(0);
    const [naming, setNaming] = useState<number | null>(null);
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
                setPhase('tooEarly');
                return;
            }

            const found = clusterThemes(centerWithinFields(items), { grain: 85, minEntries: 3 });
            setClusters(found);
            setNamed(await getNamedThemes());
            setPhase('ready');
        } catch (error: any) {
            if (!mounted.current) return;
            setErrorText(error?.message ?? 'Something went wrong');
            setPhase('error');
        }
    }, []);

    useEffect(() => {
        (async () => {
            const ready = await isModelDownloaded();
            if (!mounted.current) return;
            if (ready) compute();
            else setPhase('needsModel');
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

    // ── states before there is anything to show ──────────────────────────────

    if (phase === 'checking') {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    if (phase === 'needsModel') {
        return (
            <View style={styles.center}>
                <Sparkles size={40} color={colors.accent} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Find your themes</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    Àṣàrò can group your entries by what you keep coming back to. It needs a
                    one-time 23MB download, then it works offline — your reflections are never
                    sent anywhere.
                </Text>
                <Button label="Download (23MB)" onPress={handleDownload} />
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
                <Text style={[styles.body, { color: colors.textSecondary }]}>{label}</Text>
            </View>
        );
    }

    if (phase === 'tooEarly') {
        return (
            <View style={styles.center}>
                <Sparkles size={40} color={colors.textTertiary} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Not yet</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    You have {entryCount} {entryCount === 1 ? 'entry' : 'entries'} with enough
                    written in them. Themes start to mean something around {MIN_ENTRIES} — before
                    that they mostly describe the reading plan rather than you.
                </Text>
            </View>
        );
    }

    if (phase === 'error') {
        return (
            <View style={styles.center}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Couldn&apos;t finish</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>{errorText}</Text>
                <Button label="Try again" onPress={compute} />
            </View>
        );
    }

    if (clusters.length === 0) {
        return (
            <View style={styles.center}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>No themes yet</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    Nothing you&apos;ve written grouped together strongly enough to call a theme.
                    Keep going — this gets sharper as the journal grows.
                </Text>
            </View>
        );
    }

    // ── the themes ───────────────────────────────────────────────────────────

    const openCluster = openIndex !== null ? clusters[openIndex] : null;
    const openName =
        openCluster &&
        matchThemeName(
            openCluster.members.map(m => ({ entryId: m.entryId, field: m.field })),
            named,
        )?.name;

    return (
        <>
        <FlatList
            data={clusters}
            keyExtractor={(_, index) => `cluster-${index}`}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
                <Text style={[styles.intro, { color: colors.textTertiary }]}>
                    {clusters.length} {clusters.length === 1 ? 'pattern' : 'patterns'} across your
                    entries. Name the ones you recognise.
                </Text>
            }
            renderItem={({ item, index }) => {
                const reps = representatives(item, 3);
                const books = [...new Set(item.members.map(m => m.bookName))].filter(Boolean);
                const savedName = matchThemeName(
                    item.members.map(m => ({ entryId: m.entryId, field: m.field })),
                    named,
                );

                return (
                    <ScalePressable
                        onPress={() => setOpenIndex(index)}
                        style={[
                            styles.card,
                            { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                        ]}
                    >
                        {savedName && (
                            <Text style={[styles.themeName, { color: colors.textPrimary }]}>
                                {savedName.name}
                            </Text>
                        )}

                        <View style={styles.cardHeader}>
                            <Text style={[styles.count, { color: colors.accent }]}>
                                {item.entryCount} entries
                            </Text>
                            {books.length > 0 && (
                                <Text style={[styles.books, { color: colors.textTertiary }]} numberOfLines={1}>
                                    {books.join(' · ')}
                                </Text>
                            )}
                        </View>

                        {reps.map((member, i) => (
                            <View key={`${member.entryId}-${member.field}-${i}`} style={styles.snippet}>
                                <Text style={[styles.snippetMeta, { color: colors.textTertiary }]}>
                                    {reference(member)} · {FIELD_LABELS[member.field] ?? member.field}
                                </Text>
                                <HyperlinkedText
                                    style={[styles.snippetText, { color: colors.textSecondary }]}
                                    numberOfLines={3}
                                    text={member.text}
                                />
                            </View>
                        ))}

                        {naming === index ? (
                            <View style={styles.nameRow}>
                                <TextInput
                                    style={[
                                        styles.nameInput,
                                        {
                                            backgroundColor: colors.backgroundSubtle,
                                            color: colors.textPrimary,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    placeholder="What is this really about?"
                                    placeholderTextColor={colors.textTertiary}
                                    value={draftName}
                                    onChangeText={setDraftName}
                                    autoFocus
                                    onSubmitEditing={() => handleSaveName(index)}
                                />
                                <ScalePressable
                                    onPress={() => handleSaveName(index)}
                                    style={[styles.iconBtn, { backgroundColor: colors.accent }]}
                                >
                                    <Check size={18} color={colors.buttonPrimaryText} />
                                </ScalePressable>
                                <ScalePressable
                                    onPress={() => {
                                        setNaming(null);
                                        setDraftName('');
                                    }}
                                    style={[styles.iconBtn, { backgroundColor: colors.backgroundSubtle }]}
                                >
                                    <X size={18} color={colors.textSecondary} />
                                </ScalePressable>
                            </View>
                        ) : (
                            <ScalePressable
                                onPress={() => {
                                    setNaming(index);
                                    setDraftName(savedName?.name ?? '');
                                }}
                                style={[styles.nameCta, { borderColor: colors.border }]}
                            >
                                <Text
                                    style={[
                                        styles.nameCtaText,
                                        { color: savedName ? colors.textTertiary : colors.accent },
                                    ]}
                                >
                                    {savedName ? 'Rename' : 'Name this theme'}
                                </Text>
                            </ScalePressable>
                        )}

                        {item.entryCount > reps.length && (
                            <Text style={[styles.more, { color: colors.textTertiary }]}>
                                +{item.entryCount - reps.length} more — tap to read
                            </Text>
                        )}
                    </ScalePressable>
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
                    onOpenEntry={entryId => {
                        setOpenIndex(null);
                        router.push(`/library/${entryId}`);
                    }}
                />
            )}
        </AnimatedModal>
        </>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
    body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
    intro: { fontSize: 13, lineHeight: 19, paddingBottom: Spacing.md },
    list: { padding: Spacing.layout.screenPadding, paddingBottom: 80 },
    card: {
        borderWidth: 1,
        borderRadius: 18,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    themeName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
    count: { fontSize: 13, fontWeight: '700' },
    books: { flex: 1, fontSize: 12 },
    snippet: { gap: 2, paddingTop: 6 },
    snippetMeta: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
    snippetText: { fontSize: 13, lineHeight: 19 },
    nameCta: {
        marginTop: Spacing.sm,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    nameCtaText: { fontSize: 13, fontWeight: '700' },
    more: { fontSize: 12, fontWeight: '600', paddingTop: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm },
    nameInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
    iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
