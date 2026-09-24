/**
 * Everything Àṣàrò has noticed, newest first.
 *
 * Home shows one noticing at a time and then goes quiet for days, which is the
 * right pace for something that interrupts you and the wrong one for something
 * you want to look back at. This is where they keep. It is an archive, not a
 * feed: nothing here is new, and nothing here interrupts.
 *
 * Verdicts are kept and shown. A card that disappears for good the moment it
 * is dismissed teaches people not to dismiss it — and "you said this wasn't
 * it" sitting in the record is how the app demonstrates it heard the answer.
 * Rejected findings are never offered again on Home; they are simply still
 * legible here.
 *
 * Deliberately not where the feature lives. If this screen becomes the way
 * people meet their noticings, the reframe failed — the whole argument was
 * that this should come to the reader rather than wait behind a tab.
 */

import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { AnimatedModal } from '../AnimatedModal';
import { Text } from '../ui';
import {
    StoredObservation,
    getRecentObservations,
    markFollowed,
    recordFeedback,
} from '../../insight/observation';
import { RenderedObservation, renderObservation } from '../../insight/render';
import { ObservationReceipts } from './ObservationReceipts';

interface Row {
    observation: StoredObservation;
    rendered: RenderedObservation;
}

function formatDate(raw: string | null): string {
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
    });
}

export function EchoesContent({ onCountChange }: { onCountChange?: (n: number) => void } = {}) {
    const { colors, isLockedIn } = useTheme();
    const router = useRouter();
    const [rows, setRows] = useState<Row[] | null>(null);
    const [open, setOpen] = useState<Row | null>(null);

    const load = useCallback(async () => {
        const stored = await getRecentObservations();
        const legible = stored
            .map(observation => {
                const rendered = renderObservation(observation);
                return rendered ? { observation, rendered } : null;
            })
            .filter((row): row is Row => row !== null);

        setRows(legible);
        onCountChange?.(legible.length);
    }, [onCountChange]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    if (rows === null) return <View style={styles.fill} />;

    if (rows.length === 0) {
        return (
            <View style={styles.empty}>
                <Text variant={isLockedIn ? 'title' : 'subtitle'} style={styles.centred}>
                    Nothing noticed yet
                </Text>
                <Text variant="body" tone="secondary" style={styles.centred}>
                    Àṣàrò watches for passages your entries keep circling without ever landing on.
                    When it finds one, it will appear on Home — not here.
                </Text>
            </View>
        );
    }

    return (
        <>
            <FlatList
                data={rows}
                keyExtractor={row => String(row.observation.id)}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                    const rejected = item.observation.feedback === 0;
                    return (
                        <ScalePressable
                            onPress={() => setOpen(item)}
                            style={[
                                isLockedIn ? styles.colossalRow : styles.clothRow,
                                isLockedIn
                                    ? { borderBottomColor: colors.border }
                                    : {
                                        backgroundColor: colors.cardBackground,
                                        borderColor: colors.cardBorder,
                                    },
                                /*
                                 * A rejected finding is dimmed rather than
                                 * hidden. It stays part of the record — the
                                 * reader's verdict is the most valuable thing
                                 * in this table — but it should not compete
                                 * with what still stands.
                                 */
                                rejected && styles.rejected,
                            ]}
                        >
                            <View style={styles.rowHeader}>
                                <Text variant="label" tone={rejected ? 'tertiary' : 'accent'}>
                                    {item.rendered.kind.toUpperCase()}
                                </Text>
                                <Text variant="caption" tone="tertiary">
                                    {formatDate(item.observation.shownAt ?? item.observation.createdAt)}
                                </Text>
                            </View>

                            <Text variant={isLockedIn ? 'subtitle' : 'reference'} style={styles.subject}>
                                {item.rendered.subject}
                            </Text>

                            <Text variant="caption" tone="tertiary" numberOfLines={1}>
                                {item.rendered.evidence.join('  ·  ')}
                            </Text>

                            {rejected && (
                                <Text variant="label" tone="tertiary" style={styles.verdict}>
                                    You said this wasn&rsquo;t it
                                </Text>
                            )}
                        </ScalePressable>
                    );
                }}
            />

            <AnimatedModal visible={!!open} onRequestClose={() => setOpen(null)}>
                {open && (
                    <ObservationReceipts
                        observation={open.observation}
                        rendered={open.rendered}
                        onClose={() => setOpen(null)}
                        onFollow={() => markFollowed(open.observation.id)}
                        onVerdict={async agreed => {
                            await recordFeedback(open.observation.id, agreed);
                            setOpen(null);
                            load();
                        }}
                        onOpenEntry={entry => {
                            setOpen(null);
                            router.push(`/library/${entry.id}`);
                        }}
                    />
                )}
            </AnimatedModal>
        </>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    empty: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.md,
    },
    centred: { textAlign: 'center' },
    list: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 60,
        gap: Spacing.md,
    },
    clothRow: {
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.lg,
        padding: Spacing.lg,
        gap: Spacing.xs,
    },
    colossalRow: {
        borderBottomWidth: 1,
        paddingBottom: Spacing.lg,
        gap: Spacing.xs,
    },
    rejected: { opacity: 0.45 },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    subject: { marginTop: Spacing.xs },
    verdict: { marginTop: Spacing.xs },
});
