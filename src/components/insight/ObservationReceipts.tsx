/**
 * The evidence behind a noticing, and the two answers a reader can give it.
 *
 * This screen is the difference between an observation and a horoscope. The
 * card makes a claim about someone's spiritual life; this is where that claim
 * can be checked and, crucially, refused. The Barnum literature is blunt that
 * perceived personalisation is easier to manufacture than the real thing and
 * that the only defence is falsifiability — so the receipts are not an
 * "advanced" view behind a chevron, they are what the card opens into.
 *
 * Three things are shown, in this order:
 *
 *   the passage being offered, with the one action that matters — read it;
 *   every entry the finding rests on, dated, in the reader's own words;
 *   "That's not it".
 *
 * The verdict sits last on purpose. You should have to look at the evidence
 * before you can reject it, and — the same reason — before you can be
 * persuaded by it. It is one tap, no dialog, no explanation requested: the
 * label is the whole interaction, because a rejection that costs something is
 * a rejection that does not get given.
 *
 * Scripture text never appears here. `Read it` hands jw.org a reference and
 * the reader meets the passage in their own Bible, with their own footnotes.
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { HyperlinkedText } from '../HyperlinkedText';
import { Screen, Text, ThemedButton } from '../ui';
import { openBibleReference } from '../../utils/bibleUtils';
import { bookNameFromNumber, bookNumberOf, chapterOf, verseOf } from '../../bible/ref';
import { RenderedObservation } from '../../insight/render';
import { StoredObservation } from '../../insight/observation';
import { getEntryById, JournalEntry } from '../../data/database';

/** Reflection columns, with the label the app uses for each question. */
const FIELDS: { column: keyof JournalEntry; label: string }[] = [
    { column: 'reflection_1', label: 'on Jehovah' },
    { column: 'reflection_2', label: "on the Bible's message" },
    { column: 'reflection_3', label: 'to apply' },
    { column: 'reflection_4', label: 'to help others' },
    { column: 'notes', label: 'note' },
];

interface Props {
    observation: StoredObservation;
    rendered: RenderedObservation;
    onClose: () => void;
    onVerdict: (agreed: boolean) => void;
    onOpenEntry: (entry: JournalEntry) => void;
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

/** The passage an entry covered, as the journal recorded it. */
function passageOf(entry: JournalEntry): string {
    const range =
        entry.chapter_end && entry.chapter_end !== entry.chapter_start
            ? `${entry.chapter_start}–${entry.chapter_end}`
            : `${entry.chapter_start}`;
    return `${entry.book_name} ${range}`;
}

/** The first answer with anything in it — what the reader actually said. */
function firstAnswer(entry: JournalEntry): { label: string; text: string } | null {
    for (const field of FIELDS) {
        const text = (entry[field.column] as string | undefined)?.trim();
        if (text) return { label: field.label, text };
    }
    return null;
}

export function ObservationReceipts({
    observation,
    rendered,
    onClose,
    onVerdict,
    onOpenEntry,
}: Props) {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<JournalEntry[]>([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            const ids = observation.evidence
                .filter(item => item.kind === 'entry' && item.entryId !== undefined)
                .map(item => item.entryId!);

            const loaded = await Promise.all(ids.map(id => getEntryById(id)));
            if (!alive) return;
            /*
             * Evidence order is the detector's, oldest first, and it is kept:
             * the finding reads as a sequence — you wrote this, then this,
             * then this — and re-sorting here would flatten that back into a
             * set.
             */
            setEntries(loaded.filter((entry): entry is JournalEntry => Boolean(entry)));
        })();
        return () => {
            alive = false;
        };
    }, [observation]);

    const readPassage = () => {
        const id = rendered.subjectVerseId;
        openBibleReference(
            bookNameFromNumber(bookNumberOf(id)),
            chapterOf(id),
            verseOf(id) || undefined,
        );
    };

    return (
        <Screen>
            <View style={styles.header}>
                <ScalePressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={[styles.iconBtn, { backgroundColor: colors.backgroundSubtle }]}
                >
                    <X size={20} color={colors.textSecondary} />
                </ScalePressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text variant="label" tone="accent">
                    {rendered.kind.toUpperCase()}
                </Text>

                <Text variant="display" style={styles.subject}>
                    {rendered.subject}
                </Text>
                <Text variant="body" tone="secondary">
                    {rendered.claim}
                </Text>

                <ThemedButton
                    label="Read it"
                    variant="accent"
                    block
                    onPress={readPassage}
                    style={styles.read}
                    accessibilityHint="Opens the passage on jw.org"
                />

                <Text variant="label" tone="tertiary" style={styles.sectionLabel}>
                    {`What this rests on · ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
                </Text>

                {entries.map(entry => {
                    const answer = firstAnswer(entry);
                    return (
                        <ScalePressable
                            key={entry.id}
                            onPress={() => onOpenEntry(entry)}
                            style={[
                                styles.card,
                                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                            ]}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.badge, { backgroundColor: colors.accent + '12' }]}>
                                    <Text variant="caption" tone="accent">
                                        {passageOf(entry)}
                                    </Text>
                                </View>
                                <Text variant="caption" tone="tertiary">
                                    {formatDate(entry.created_at)}
                                </Text>
                            </View>

                            {answer && (
                                <View style={styles.answer}>
                                    <Text variant="label" tone="tertiary">
                                        {answer.label}
                                    </Text>
                                    <HyperlinkedText
                                        style={[styles.answerText, { color: colors.textSecondary }]}
                                        numberOfLines={4}
                                        text={answer.text}
                                    />
                                </View>
                            )}
                        </ScalePressable>
                    );
                })}

                {/*
                 * Last, and quiet. It has to be one tap and cost nothing —
                 * this is the only ground truth the app ever gets about
                 * whether a detector is right, and a verdict that feels like
                 * an accusation is a verdict nobody gives.
                 */}
                <ScalePressable
                    onPress={() => onVerdict(false)}
                    accessibilityRole="button"
                    style={styles.reject}
                >
                    <Text variant="label" tone="tertiary">
                        That&rsquo;s not it
                    </Text>
                </ScalePressable>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.sm,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: Spacing.borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 60,
        gap: Spacing.sm,
    },
    subject: { marginTop: Spacing.xs },
    read: { marginTop: Spacing.lg },
    sectionLabel: { marginTop: Spacing.xl },
    card: {
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.lg,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Spacing.borderRadius.lg,
    },
    answer: { gap: 3 },
    answerText: { fontSize: 14, lineHeight: 21 },
    reject: {
        marginTop: Spacing.xl,
        alignSelf: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
});
