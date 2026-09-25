/**
 * The evidence behind a noticing, and the two answers a reader can give it.
 * This screen is the difference between an observation and a horoscope: the
 * only defence against manufactured personalisation is falsifiability, so the
 * receipts are what the card opens into, never an "advanced" view.
 *
 * Three things, in this order:
 *
 *   the passage being offered, with the one action that matters — read it;
 *   every entry the finding rests on, dated, in the reader's own words;
 *   "That's not it".
 *
 * The verdict sits LAST: you should have to look at the evidence before you
 * can reject it, or be persuaded by it. One tap, no dialog, no explanation
 * requested — a rejection that costs something does not get given.
 *
 * Scripture text never appears here. `Read it` hands jw.org a reference and the
 * reader meets the passage in their own Bible, with their own footnotes.
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
    /** Retire the thing the finding is about. Only for findings with a subject
     * the reader owns — see the bottom control. */
    onArchiveSubject?: () => void;
    /** Called when the reader taps through to the passage. */
    onFollow?: () => void;
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
    onArchiveSubject,
    onFollow,
}: Props) {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<JournalEntry[]>([]);

    /*
     * Whether this finding is an inference, or something that cannot be wrong.
     * Derived from the detector, not passed in, so a new detector cannot ship
     * asking the reader to refute their own handwriting: commitment quotes them
     * back and absence states counts, so there is nothing for "that's not it"
     * to deny. Convergence asserts a connection, which can be wrong.
     */
    const canBeWrong = observation.detector !== 'commitment' && observation.detector !== 'absence';

    useEffect(() => {
        let alive = true;
        (async () => {
            const ids = observation.evidence
                .filter(item => item.kind === 'entry' && item.entryId !== undefined)
                .map(item => item.entryId!);

            const loaded = await Promise.all(ids.map(id => getEntryById(id)));
            if (!alive) return;
            // Evidence order is the detector's, oldest first, and is kept:
            // the finding reads as a sequence, and re-sorting flattens it.
            setEntries(loaded.filter((entry): entry is JournalEntry => Boolean(entry)));
        })();
        return () => {
            alive = false;
        };
    }, [observation]);

    // Only some findings point at scripture. Absent rather than disabled: an
    // action that does nothing is worse than one not offered.
    const passageId = rendered.subjectVerseId;
    const readPassage = () => {
        if (passageId === undefined) return;
        // Recorded BEFORE the hand-off: once `openBibleReference` sends the
        // reader to jw.org this screen may never run again.
        onFollow?.();
        openBibleReference(
            bookNameFromNumber(bookNumberOf(passageId)),
            chapterOf(passageId),
            verseOf(passageId) || undefined,
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

                {/* `display` for a verse reference, `title` for a resolution
                  * — a reference is three words and carries the weight, where
                  * a whole sentence at display size is a wall. */}
                <Text
                    variant={rendered.subjectVerseId === undefined ? 'title' : 'display'}
                    style={styles.subject}
                >
                    {rendered.subject}
                </Text>
                <Text variant="body" tone="secondary">
                    {rendered.claim}
                </Text>

                {passageId !== undefined && (
                    <ThemedButton
                        label="Read it"
                        variant="accent"
                        block
                        onPress={readPassage}
                        style={styles.read}
                        accessibilityHint="Opens the passage on jw.org"
                    />
                )}

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
                 * The bottom control depends on whether the finding can be
                 * WRONG. An inference gets "that's not it", which carries the
                 * whole falsifiability argument. A commitment infers nothing —
                 * the real answer to being handed an old one is not "that's
                 * wrong" but "that's done", so it offers to set it down.
                 *
                 * Either way: last, quiet, one tap.
                 */}
                {canBeWrong ? (
                    <ScalePressable
                        onPress={() => onVerdict(false)}
                        accessibilityRole="button"
                        style={styles.reject}
                    >
                        <Text variant="label" tone="tertiary">
                            That&rsquo;s not it
                        </Text>
                    </ScalePressable>
                ) : onArchiveSubject ? (
                    <ScalePressable
                        onPress={onArchiveSubject}
                        accessibilityRole="button"
                        style={styles.reject}
                    >
                        <Text variant="label" tone="tertiary">
                            Archive &mdash; it has served its purpose
                        </Text>
                    </ScalePressable>
                ) : null}
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
