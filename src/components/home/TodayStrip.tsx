/**
 * What you could do right now, on Home. A list of unticked things on a
 * devotional front page is a chore list, and three rules hold it back:
 *
 * It only shows what is live TODAY — a practice already kept is absent, an
 * application never appears, and a deadline three days out is the furthest it
 * looks. Most days this renders nothing.
 *
 * The streak sits beside each practice, so the line reads as something being
 * continued rather than outstanding. It shows from the FIRST day kept: day one
 * is the most fragile a practice ever is.
 *
 * The heading is "Today", never "To do" — a moment, not a backlog.
 *
 * A practice kept here stays, ticked, until the screen is left (see
 * `useToday`), dimmed and sunk to the bottom since it asks for nothing.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { Text } from '../ui';
import { TodayItem } from '../../hooks/useToday';

interface Props {
    items: TodayItem[];
    onKeep: (item: TodayItem) => void;
    /** Untick one kept a moment ago. Without this the tick is a trap. */
    onUndo: (item: TodayItem) => void;
    onOpen?: (item: TodayItem) => void;
}

export function TodayStrip({ items, onKeep, onUndo, onOpen }: Props) {
    const { colors } = useTheme();

    // Absent, not empty. A block with nothing in it is still clutter.
    if (items.length === 0) return null;

    return (
        <View style={styles.wrap}>
            <Text variant="label" tone="secondary">
                TODAY
            </Text>

            <View style={[styles.list, { borderTopColor: colors.border }]}>
                {items.map(entry => {
                    const isPractice = entry.kind === 'practice';
                    return (
                        <View
                            key={entry.item.id}
                            style={[styles.row, { borderBottomColor: colors.border }]}
                        >
                            {/*
                              * Only a practice can be kept from here. An action
                              * has a deadline and a completion that sticks, so
                              * it is closed where it lives rather than in
                              * passing on the front page.
                              */}
                            {isPractice ? (
                                <ScalePressable
                                    onPress={() => (entry.kept ? onUndo(entry) : onKeep(entry))}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: entry.kept }}
                                    accessibilityLabel={
                                        entry.kept
                                            ? `Undo ${entry.item.action} for today`
                                            : `Mark ${entry.item.action} done for today`
                                    }
                                    hitSlop={Spacing.md}
                                    style={[
                                        styles.box,
                                        entry.kept
                                            ? { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
                                            : { borderColor: colors.borderStrong },
                                    ]}
                                >
                                    <Check size={11} color={entry.kept ? colors.background : 'transparent'} />
                                </ScalePressable>
                            ) : (
                                <View style={[styles.marker, { backgroundColor: entry.overdue ? colors.accent : colors.border }]} />
                            )}

                            <ScalePressable
                                style={styles.main}
                                disabled={!onOpen}
                                onPress={onOpen ? () => onOpen(entry) : undefined}
                                accessibilityRole={onOpen ? 'button' : undefined}
                            >
                                <Text
                                    variant="body"
                                    numberOfLines={2}
                                    tone={entry.kept ? 'tertiary' : undefined}
                                >
                                    {entry.item.action}
                                </Text>
                            </ScalePressable>

                            {/*
                              * The whole point of the kept row. On the tap this
                              * is the number that just went up, so it stays at
                              * full strength while the line around it dims.
                              */}
                            {isPractice && entry.streak >= 1 && (
                                <Text variant="meta" tone="accent">
                                    {`${entry.streak}${entry.item.cadence === 'weekly' ? 'w' : 'd'}`}
                                </Text>
                            )}
                            {!isPractice && (
                                <Text variant="meta" tone={entry.overdue ? 'accent' : 'tertiary'}>
                                    {entry.overdue ? 'was due' : 'due'}
                                </Text>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    list: { borderTopWidth: 1 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    main: { flex: 1, minWidth: 0 },
    box: {
        width: 18,
        height: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    /* A dated action is not tickable here, so it gets a mark rather than a box
     * the reader would expect to work. */
    marker: { width: 18, height: 3 },
});
