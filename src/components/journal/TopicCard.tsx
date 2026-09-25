/**
 * One question you left open, in the Questions list.
 *
 * It is the same row as a commitment, on purpose. Both lists ask the reader to
 * mark something done, and this one had drifted a long way: a round tick
 * against a square one, a tinted pill around the reference, a bell in a second
 * pill, and a type ramp that read the length of the text and picked a font
 * size from it. None of those exist anywhere else in the app.
 *
 * The checkbox is earned rather than copied. `ActionCard` withholds a box from
 * an application — something you are trying to be, with no end — and offers one
 * only where there is a finish. A question has a finish: you look it up once
 * and it is answered. That makes it the same shape as a one-off action, which
 * is the one kind that ticks once and stays ticked.
 *
 * Ticked, it lingers for a moment and then leaves the list for good. See
 * `LINGER_MS` in JournalEntryList for why, and what that moment is for. The
 * question itself is not lost: it is part of the entry that raised it, and it
 * reads there like every other answer.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { JournalEntry } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { HyperlinkedText } from '../HyperlinkedText';
import { Text, textStyle } from '../ui';
import { Checkbox } from './Checkbox';
import { formatDate } from './JournalCardHelpers';

interface TopicCardProps {
    item: JournalEntry;
    onEntryPress: (entry: JournalEntry) => void;
    handleToggleTopic: (item: JournalEntry) => void;
}

/** "Genesis 12" / "Genesis 12–15", the way every other row writes it. */
function reference(item: JournalEntry): string {
    const range =
        item.chapter_end && item.chapter_end !== item.chapter_start
            ? `${item.chapter_start}–${item.chapter_end}`
            : `${item.chapter_start}`;
    return `${item.book_name} ${range}`;
}

/** A reminder still ahead of us, as a date. Past ones say nothing. */
function reminderLabel(raw?: string | null): string | null {
    if (!raw) return null;
    const when = new Date(raw);
    if (Number.isNaN(when.getTime()) || when <= new Date()) return null;
    return when.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export const TopicCard = React.memo(({ item, onEntryPress, handleToggleTopic }: TopicCardProps) => {
    const { colors, style: themeStyle } = useTheme();
    const done = !!item.study_completed;
    const reminder = reminderLabel(item.study_further_reminder);

    return (
        <View
            style={[
                styles.panel,
                { backgroundColor: colors.backgroundSubtle },
                done && styles.done,
            ]}
        >
            <View style={styles.row}>
                <Checkbox
                    done={done}
                    onPress={() => handleToggleTopic(item)}
                    label={done ? 'Put this question back' : 'Mark this question answered'}
                />
                <ScalePressable
                    style={styles.rowMain}
                    onPress={() => onEntryPress(item)}
                    accessibilityRole="button"
                    accessibilityHint="Opens the entry that raised this"
                >
                    <HyperlinkedText
                        style={[
                            textStyle(themeStyle, 'subtitle'),
                            { color: colors.textPrimary },
                            done && styles.struck,
                        ]}
                        text={item.study_further || ''}
                    />
                    {/*
                      * The reference and the reminder sit where a commitment
                      * puts its reference, streak and due date — plain meta on
                      * one line. They were two tinted pills, which made a
                      * question look like it carried two controls it does not.
                      */}
                    <View style={styles.metaRow}>
                        <Text variant="meta">{reference(item)}</Text>
                        <Text variant="meta">{formatDate(item.created_at)}</Text>
                        {reminder && <Text variant="meta" tone="accent">{reminder}</Text>}
                    </View>
                </ScalePressable>
            </View>
        </View>
    );
});

TopicCard.displayName = 'TopicCard';

const styles = StyleSheet.create({
    /** `.cl-panel{padding:18px}`, stacked with a 10px gap by the list. */
    panel: {
        padding: Spacing.layout.cardPadding,
        marginBottom: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    rowMain: {
        flex: 1,
        minWidth: 0,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 9,
    },
    /* One strike, not two: this used to set textDecorationLine AND draw a line
       across the text with an absolutely positioned View. */
    struck: { textDecorationLine: 'line-through' },
    done: { opacity: 0.55 },
});
