import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Pencil } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { ScalePressable } from './ScalePressable';
import { HyperlinkedText } from './HyperlinkedText';
import { Cluster } from '../ml/clustering';
import { StoredEmbedding, EMBEDDABLE_FIELDS, ACTION_FIELD } from '../data/embeddingRepository';

const FIELD_LABELS: Record<string, string> = {
    ...Object.fromEntries(EMBEDDABLE_FIELDS.map(f => [f.column, f.label])),
    [ACTION_FIELD]: 'action',
};

/** Scripture references the writer linked themselves, e.g. [[Exodus 22:5]]. */
const VERSE_RE = /\[\[(.+?)\]\]/g;

interface Props {
    cluster: Cluster<StoredEmbedding>;
    name?: string;
    onClose: () => void;
    onRename: () => void;
    onOpenEntry: (entryId: number) => void;
}

function chapterRef(item: StoredEmbedding): string {
    const range =
        item.chapterEnd && item.chapterEnd !== item.chapterStart
            ? `${item.chapterStart}-${item.chapterEnd}`
            : `${item.chapterStart}`;
    return `${item.bookName} ${range}`;
}

function formatDate(raw: string): string {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
    });
}

export function ThemeDetail({ cluster, name, onClose, onRename, onOpenEntry }: Props) {
    const { colors } = useTheme();

    /**
     * Group by entry: one entry often contributes two answers to a theme (what
     * it says about Jehovah, and what to do about it), and showing those as
     * two separate cards reads like duplicates.
     */
    const entries = useMemo(() => {
        const byEntry = new Map<number, StoredEmbedding[]>();
        for (const member of cluster.members) {
            const bucket = byEntry.get(member.entryId);
            if (bucket) bucket.push(member);
            else byEntry.set(member.entryId, [member]);
        }
        return [...byEntry.values()].sort(
            (a, b) => new Date(a[0].createdAt).getTime() - new Date(b[0].createdAt).getTime(),
        );
    }, [cluster]);

    /** Verses the writer cited, which is a better index than the chapter range. */
    const verses = useMemo(() => {
        const found: string[] = [];
        for (const member of cluster.members) {
            for (const match of member.text.matchAll(VERSE_RE)) {
                const ref = match[1].trim();
                if (ref && !found.includes(ref)) found.push(ref);
            }
        }
        return found;
    }, [cluster]);

    const span = useMemo(() => {
        const dates = cluster.members
            .map(m => new Date(m.createdAt).getTime())
            .filter(t => !Number.isNaN(t));
        if (dates.length < 2) return '';
        const months = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30.4);
        if (months < 1) return 'within a month';
        return `across ${Math.round(months)} months`;
    }, [cluster]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            <View style={styles.header}>
                <ScalePressable
                    onPress={onRename}
                    style={[styles.iconBtn, { backgroundColor: colors.backgroundSubtle }]}
                >
                    <Pencil size={18} color={colors.textSecondary} />
                </ScalePressable>
                <ScalePressable
                    onPress={onClose}
                    style={[styles.iconBtn, { backgroundColor: colors.backgroundSubtle }]}
                >
                    <X size={20} color={colors.textSecondary} />
                </ScalePressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {name ?? 'Unnamed theme'}
                </Text>
                <Text style={[styles.meta, { color: colors.textTertiary }]}>
                    {cluster.entryCount} {cluster.entryCount === 1 ? 'entry' : 'entries'}
                    {span ? ` · ${span}` : ''}
                </Text>

                {verses.length > 0 && (
                    <View style={styles.verseWrap}>
                        {verses.map(verse => (
                            <View
                                key={verse}
                                style={[styles.verseChip, { backgroundColor: colors.accent + '15' }]}
                            >
                                <HyperlinkedText
                                    style={[styles.verseText, { color: colors.accent }]}
                                    text={`[[${verse}]]`}
                                />
                            </View>
                        ))}
                    </View>
                )}

                {entries.map(group => (
                    <ScalePressable
                        key={group[0].entryId}
                        onPress={() => onOpenEntry(group[0].entryId)}
                        style={[
                            styles.card,
                            { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                        ]}
                    >
                        <View style={styles.cardHeader}>
                            <View style={[styles.refBadge, { backgroundColor: colors.accent + '12' }]}>
                                <Text style={[styles.refText, { color: colors.accent }]}>
                                    {chapterRef(group[0])}
                                </Text>
                            </View>
                            <Text style={[styles.date, { color: colors.textTertiary }]}>
                                {formatDate(group[0].createdAt)}
                            </Text>
                        </View>

                        {group.map((member, i) => (
                            <View key={`${member.field}-${i}`} style={styles.answer}>
                                <Text style={[styles.answerLabel, { color: colors.textTertiary }]}>
                                    {FIELD_LABELS[member.field] ?? member.field}
                                </Text>
                                <HyperlinkedText
                                    style={[styles.answerText, { color: colors.textSecondary }]}
                                    text={member.text}
                                />
                            </View>
                        ))}
                    </ScalePressable>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.sm,
    },
    iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    content: { padding: Spacing.layout.screenPadding, paddingBottom: 60, gap: Spacing.sm },
    title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
    meta: { fontSize: 13, fontWeight: '600' },
    verseWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: Spacing.sm },
    verseChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    verseText: { fontSize: 12, fontWeight: '700' },
    card: { borderWidth: 1, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    refBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    refText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    date: { fontSize: 11 },
    answer: { gap: 3 },
    answerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
    answerText: { fontSize: 14, lineHeight: 21 },
});
