/**
 * Everything Àṣàrò has noticed, newest first. An archive, not a feed: nothing
 * here is new and nothing here interrupts.
 *
 * Verdicts are kept and shown. A card that disappears for good on dismissal
 * teaches people not to dismiss it, and "you said this wasn't it" in the record
 * is how the app shows it heard. Rejected findings are never re-offered on
 * Home, only kept legible here.
 *
 * Deliberately NOT where the feature lives — if this screen becomes how people
 * meet their noticings, the reframe failed. Section copy and ordering:
 * design/DECISIONS.md#echoes-sections
 */

import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
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
import { daysWaiting, openSection } from '../../insight/echoesTone';
import { ObservationReceipts } from './ObservationReceipts';

interface Row {
    observation: StoredObservation;
    rendered: RenderedObservation;
}

/**
 * What the reader did about a finding. Grouped rather than labelled per row:
 * the state belongs to the whole run, and a heading says it once.
 */
type Response = 'open' | 'read' | 'readRejected' | 'rejected';

/**
 * Where a finding stands, by what the reader actually pressed.
 *
 * Exactly two buttons count: "Read it" and "That's not it". Opening and closing
 * a card is not an answer — `opened_at` is recorded for the ranker but decides
 * nothing here, and nor does the dismiss ⨯, which means "not now" everywhere
 * else. Pressing both is its own outcome, not a tie to be broken.
 */
function responseTo(observation: StoredObservation): Response {
    const read = !!observation.followedAt;
    const refused = observation.feedback === 0;
    if (read && refused) return 'readRejected';
    if (read) return 'read';
    if (refused) return 'rejected';
    return 'open';
}

/*
 * Ordered by how settled an answer is, not by how final it sounds — unanswered
 * first (a finding is shown on Home only once), then refusal without reading,
 * which is the weakest answer here and the group most likely to change.
 *
 * These are labels for what the reader did, NOT lines of Àṣàrò's dialogue: the
 * first person puts him in the room narrating over your shoulder. Only the top
 * two carry attitude, because only they are still about something open. See
 * design/DECISIONS.md#echoes-sections.
 */
const SECTIONS: { key: Response; title: string }[] = [
    // Placeholder: the real heading comes from `openSection` at render time,
    // since the tone softens with age — see echoesTone.ts. Kept here so
    // ordering and grouping still read from one place.
    { key: 'open', title: "You've not read these. What are you doing?" },
    { key: 'rejected', title: 'You said no without reading them. Hmmm.' },
    { key: 'read', title: 'You read these' },
    { key: 'readRejected', title: 'You read these and still said no' },
];

/**
 * Only a verdict reached after reading is treated as closed. Fading says "this
 * needs nothing more from you", and an unread refusal has not earned it.
 */
const FADED: Response[] = ['readRejected'];

type ListRow = { kind: 'header'; title: string; id: string } | { kind: 'row'; row: Row; id: string };

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

export function EchoesContent() {
    const { colors } = useTheme();
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
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    // Headings only with more than one group: three findings all unanswered
    // should read as a list, not a taxonomy nobody asked for.
    const listRows: ListRow[] = [];
    if (rows) {
        const groups = SECTIONS.map(section => ({
            ...section,
            rows: rows.filter(row => responseTo(row.observation) === section.key),
        })).filter(group => group.rows.length > 0);

        // The unanswered heading softens with age, so it resolves here rather
        // than off SECTIONS. The oldest wait in the group decides it.
        const now = Date.now();
        const openRows = groups.find(group => group.key === 'open')?.rows ?? [];
        const oldestOpenDays = openRows.reduce<number | null>((oldest, row) => {
            const days = daysWaiting(row.observation.shownAt, row.observation.createdAt, now);
            if (days === null) return oldest;
            return oldest === null || days > oldest ? days : oldest;
        }, null);
        const openHeading = openSection(oldestOpenDays);

        for (const group of groups) {
            const isOpen = group.key === 'open';
            const title = isOpen ? openHeading.title : group.title;
            if (groups.length > 1 || (isOpen && openHeading.showAlone)) {
                listRows.push({ kind: 'header', title, id: `h-${group.key}` });
            }
            for (const row of group.rows) {
                listRows.push({ kind: 'row', row, id: String(row.observation.id) });
            }
        }
    }

    if (rows === null) return <View style={styles.fill} />;

    if (rows.length === 0) {
        return (
            /* design/all-screens.html #empties — the same shape as the other
               seven: centred under a bare glyph. */
            <View style={[styles.empty, styles.emptyCloth]}>
                <Sparkles size={34} color={colors.textTertiary} strokeWidth={1.5} />
                <Text variant="title" style={styles.centred}>
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
                data={listRows}
                keyExtractor={entry => entry.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: entry }) => {
                    if (entry.kind === 'header') {
                        return (
                            <Text variant="label" tone="tertiary" style={styles.sectionHeader}>
                                {entry.title}
                            </Text>
                        );
                    }

                    const item = entry.row;
                    const response = responseTo(item.observation);
                    return (
                        <ScalePressable
                            onPress={() => setOpen(item)}
                            style={[
                                styles.clothRow,
                                {
                                    backgroundColor: colors.cardBackground,
                                    borderColor: colors.cardBorder,
                                },
                                /*
                                 * Dimmed, never hidden: the verdict stays part
                                 * of the record but should not compete with
                                 * what still stands. Only what was set aside
                                 * dims — read is what worked, open is what
                                 * might.
                                 */
                                FADED.includes(response) && styles.rejected,
                            ]}
                        >
                            <View style={styles.rowHeader}>
                                <Text variant="label" tone={FADED.includes(response) ? 'tertiary' : 'accent'}>
                                    {item.rendered.kind.toUpperCase()}
                                </Text>
                                <Text variant="caption" tone="tertiary">
                                    {formatDate(item.observation.shownAt ?? item.observation.createdAt)}
                                </Text>
                            </View>

                            <Text variant="reference" style={styles.subject}>
                                {item.rendered.subject}
                            </Text>

                            <Text variant="caption" tone="tertiary" numberOfLines={1}>
                                {item.rendered.evidence.join('  ·  ')}
                            </Text>

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
        gap: Spacing.lg,
    },
    emptyCloth: { alignItems: 'center', paddingHorizontal: Spacing.xxl + 2 },
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
    rejected: { opacity: 0.45 },
    sectionHeader: { marginTop: Spacing.sm },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    subject: { marginTop: Spacing.xs },
});
