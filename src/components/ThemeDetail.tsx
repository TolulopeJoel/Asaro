/**
 * One cluster, opened.
 *
 * design/all-screens.html #themedetail draws this in both styles: the name,
 * the size of the thing under it, the verses the writer cited, then every
 * entry the theme rests on, oldest first.
 *
 * Cloth gives the name its band and hangs the two header controls in the top
 * row; Colossal spends its one giant on the name itself. That is unusual —
 * the giant is normally a numeral — and it is the right call here: the name is
 * the claim the clustering is making and the entry count is the evidence for
 * it, so enlarging the count would put the weight on a fact about the
 * database. `themeQuality.ts` already writes down why that is the least
 * interesting true thing about a theme.
 *
 * Answers are grouped by entry rather than listed flat. One entry often
 * contributes two answers to a theme — what it says about Jehovah, and what to
 * do about it — and showing those as two cards reads like a duplicate.
 *
 * It is a modal over the Library tab, so it draws no tab bar and the way out
 * is an X rather than a back arrow: there is no stack to pop.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { X, Pencil } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { ScalePressable } from './ScalePressable';
import { HyperlinkedText } from './HyperlinkedText';
import { Cluster } from '../ml/clustering';
import { spanLabel } from '../ml/themeQuality';
import { StoredEmbedding, EMBEDDABLE_FIELDS, ACTION_FIELD } from '../data/embeddingRepository';
import { Card, Hero, Screen, Text, textStyle } from './ui';

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
    const { colors, isLockedIn, style: themeStyle } = useTheme();

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
        const days = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
        // Detail has room to say something either way, so it supplies the
        // words spanLabel withholds below a month; the list just drops the line.
        return spanLabel(days) ?? 'within a month';
    }, [cluster]);

    const title = name ?? 'Unnamed theme';
    const meta =
        `${cluster.entryCount} ${cluster.entryCount === 1 ? 'entry' : 'entries'}` +
        (span ? ` · ${span}` : '');

    /*
     * Rename first, close second, both hard right. Renaming is here at all
     * because the name is a guess the app made, and the reader is the only one
     * who can correct it — but it is never the reason anyone opened this, so
     * it takes the quieter of the two positions and the smaller glyph.
     */
    const controls = (
        <View style={styles.controls}>
            <ScalePressable
                onPress={onRename}
                hitSlop={Spacing.md}
                accessibilityRole="button"
                accessibilityLabel="Rename this theme"
            >
                <Pencil size={17} color={colors.accent} strokeWidth={1.9} />
            </ScalePressable>
            <ScalePressable
                onPress={onClose}
                hitSlop={Spacing.md}
                accessibilityRole="button"
                accessibilityLabel="Close"
            >
                <X
                    size={19}
                    color={isLockedIn ? colors.textTertiary : colors.textOnHero}
                    strokeWidth={1.9}
                />
            </ScalePressable>
        </View>
    );

    /*
     * The tags are the writer's own index — pulled out of the [[Isaiah 55:9]]
     * markers they typed while writing — which is a better handle on a theme
     * than the chapter ranges the entries happen to sit in: the ranges say
     * what was read, the tags say what was reached for. Square and outlined in
     * both styles, never filled: a tag that reads as a button invites a tap
     * this screen does not answer. The reference inside is still a link.
     */
    const tags = verses.length > 0 && (
        <View style={styles.tagRow}>
            {verses.map(verse => (
                <View key={verse} style={[styles.tag, { borderColor: colors.accent }]}>
                    <HyperlinkedText
                        style={[textStyle(themeStyle, 'caption'), { color: colors.accent }]}
                        text={`[[${verse}]]`}
                    />
                </View>
            ))}
        </View>
    );

    return (
        <Screen edges={isLockedIn ? ['top'] : []}>
            {isLockedIn ? (
                <View style={styles.colossalTop}>{controls}</View>
            ) : (
                <Hero ownsTopInset>
                    {controls}
                    <Text variant="display" tone="onBand" style={styles.clothTitle}>
                        {title}
                    </Text>
                    <Text variant="sub" tone="onHero" style={styles.clothSub}>
                        {meta}
                    </Text>
                </Hero>
            )}

            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingHorizontal: isLockedIn ? Spacing.layout.screenPaddingTight : Spacing.layout.screenPadding },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {isLockedIn && (
                    <>
                        <Text variant="display">{title}</Text>
                        <Text variant="label" style={styles.giantLabel}>{meta}</Text>
                    </>
                )}

                {tags}

                {/* `.co-hr` — Colossal opens the list with a rule; Cloth's filled
                    panels separate themselves and need none. */}
                {isLockedIn && <View style={[styles.rule, { backgroundColor: colors.border }]} />}

                {entries.map(group => (
                    <ScalePressable
                        key={group[0].entryId}
                        onPress={() => onOpenEntry(group[0].entryId)}
                        accessibilityRole="button"
                        accessibilityHint="Opens this entry"
                        style={!isLockedIn && styles.clothCardGap}
                    >
                        <Card>
                            <View style={styles.cardHeader}>
                                <Text variant="label" tone="accent">{chapterRef(group[0])}</Text>
                                <Text variant="meta">{formatDate(group[0].createdAt)}</Text>
                            </View>

                            {group.map((member, i) => (
                                <View key={`${member.field}-${i}`} style={styles.answer}>
                                    <Text variant="label" tone="tertiary">
                                        {FIELD_LABELS[member.field] ?? member.field}
                                    </Text>
                                    <HyperlinkedText
                                        style={[
                                            textStyle(themeStyle, 'bodySmall'),
                                            { color: colors.textSecondary },
                                        ]}
                                        text={member.text}
                                    />
                                </View>
                            ))}
                        </Card>
                    </ScalePressable>
                ))}
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    /** `.cl-top` / `.co-top` — both controls hard right, nothing else in the row. */
    controls: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: Spacing.lg,
    },
    colossalTop: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.sm,
    },
    /** `.cl-htitle{margin-top:8px}` under the control row. */
    clothTitle: { marginTop: Spacing.sm },
    /** `.cl-hsub{margin:8px 0 0}` */
    clothSub: { marginTop: Spacing.sm },
    /** `.co-giantl` sits 10px under what it labels. */
    giantLabel: { marginTop: 10 },

    content: {
        paddingTop: Spacing.layout.cardPadding,
        paddingBottom: Spacing.xxxl + Spacing.xl,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        // `.cl-body.tight{gap:12px}` — the gap this screen's body runs at.
        paddingBottom: Spacing.md,
    },
    tag: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: Spacing.border.hairline,
    },
    /** `.co-hr{margin:26px 0}`, less the padding the tag row already spent. */
    rule: {
        height: Spacing.border.hairline,
        marginBottom: Spacing.sm,
    },
    /** Cloth panels stack with air between them; Colossal's hairline is the gap. */
    clothCardGap: { marginBottom: Spacing.md },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    answer: { marginTop: Spacing.md, gap: 3 },
});
