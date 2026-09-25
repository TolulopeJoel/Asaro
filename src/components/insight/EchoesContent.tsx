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
 * What the reader did about a finding.
 *
 * Grouped rather than labelled on every row, for the same reason the
 * commitments list groups by kind: the state belongs to the whole run of them,
 * and a heading says it once instead of each card repeating itself.
 *
 * Following through wins over a verdict. Someone who read a passage and then
 * said the connection was wrong still read it — the card was mistaken about
 * why, not about sending them somewhere worth going.
 */
type Response = 'open' | 'read' | 'readRejected' | 'rejected';

/**
 * Where a finding stands, by what the reader actually pressed.
 *
 * Exactly two buttons count: "Read it" and "That's not it". Opening a card and
 * closing it is not an answer — `opened_at` is recorded for the ranker but it
 * decides nothing here, and neither does the dismiss ⨯, which means "not now"
 * everywhere else in this app and should not be made to mean more.
 *
 * Pressing both is its own outcome rather than a tie to be broken. Going to
 * read a passage and then saying the connection was wrong is a different
 * account of the same card from either half alone: the app sent them somewhere
 * worth going and was still mistaken about why.
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
 * Ordered by how settled an answer is, which is not the same as how final it
 * sounds.
 *
 * Unanswered goes first because a finding is shown on Home only once — if it
 * is not here it is nowhere.
 *
 * Refusing a connection without opening the passage is the weakest answer on
 * this screen, and it sits second for that reason. The claim is that several
 * entries converge somewhere; judging that from the entries alone is a guess
 * about a verse nobody has looked at — and the verse is exactly what would
 * settle it, since four entries can read as unrelated right up until you see
 * what they all point at. So it is named for what happened and kept near the
 * unanswered ones, because it is the group most likely to change.
 *
 * Reading and then refusing is the opposite: the reader went, looked, and
 * decided. That is the one genuinely finished state here.
 */
/*
 * Àṣàrò says these, so they sound like him.
 *
 * He is nosy, he keeps receipts, and he teases before he softens — "A whole
 * week o. I noticed. I always notice." An earlier draft of these headings had
 * him patient and plain-spoken, which is a different character entirely and
 * not one who would ever send "You think if you ignore me I'll disappear?"
 *
 * Two things keep the teasing honest. He only ever teases about being ignored
 * by *him* — the unread group is about a card of his that went unopened, never
 * about how the reader stands with Jehovah, which is the line the notification
 * copy also holds. And when he turns out to be wrong he takes it: the last
 * heading concedes rather than argues back.
 *
 * Volume is dialled below the notifications on purpose. A notification is seen
 * once and can be at full drama; a section header is furniture you walk past
 * every visit, and the same voice at that volume stops being funny by the
 * fourth time and becomes the nagging the app says it will not do.
 *
 * So these are labels for what the reader did, not lines of his dialogue. A
 * draft had "You read these. I saw you 😌" and "…I hear you", which puts him
 * in the room narrating over your shoulder; the first person is the tell. The
 * top two carry attitude because they are still about the reader — a question
 * is ambient in a way "I saw you" is not.
 *
 * And he only has something to say where something is still open. Once the
 * thing is actually done he states it and gets out of the way, which is why
 * the bottom two have no second beat and no emoji. Going quiet is the
 * acknowledgement — the same move Home makes when it has nothing to report.
 *
 * Each heading also leads with what makes its group *different*, never with
 * what it shares with its neighbour. Nobody in the first two groups has read
 * anything, so saying so twice would make the split look arbitrary: the first
 * is that no answer was given at all, the second is that one was given anyway.
 */
const SECTIONS: { key: Response; title: string }[] = [
    /*
     * Placeholder. The real one comes from `openSection` at render time,
     * because how hard he leans depends on how long the pile has been sitting
     * there — see echoesTone.ts. Kept in the list so the ordering and the
     * grouping still read from one place.
     */
    { key: 'open', title: "You've not read these. What are you doing?" },
    { key: 'rejected', title: 'You said no without reading them. Hmmm.' },
    { key: 'read', title: 'You read these' },
    { key: 'readRejected', title: 'You read these and still said no' },
];

/**
 * Only a verdict reached after reading is treated as closed.
 *
 * Fading says "this needs nothing more from you". An unread refusal has not
 * earned that — the passage that would settle it is still unopened.
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

    /*
     * Headings only when there is more than one group — a reader with three
     * findings, all unanswered, should see a list rather than a taxonomy they
     * did not ask for. Same rule the commitments list follows.
     */
    const listRows: ListRow[] = [];
    if (rows) {
        const groups = SECTIONS.map(section => ({
            ...section,
            rows: rows.filter(row => responseTo(row.observation) === section.key),
        })).filter(group => group.rows.length > 0);

        /*
         * The unanswered heading softens with age, so it is resolved here
         * rather than read off SECTIONS. Oldest wait in the group decides it.
         */
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
               seven: Cloth centred under a bare glyph, Colossal set left with
               no glyph at all. */
            <View style={[styles.empty, isLockedIn ? styles.emptyColossal : styles.emptyCloth]}>
                {!isLockedIn && <Sparkles size={34} color={colors.textTertiary} strokeWidth={1.5} />}
                <Text variant="title" style={isLockedIn ? undefined : styles.centred}>
                    Nothing noticed yet
                </Text>
                <Text
                    variant="body"
                    tone="secondary"
                    style={isLockedIn ? undefined : styles.centred}
                >
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
                                /*
                                 * Only what was set aside is dimmed. A finding
                                 * that was read is the one that worked, and a
                                 * finding still open is the one that might.
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

                            <Text variant={isLockedIn ? 'subtitle' : 'reference'} style={styles.subject}>
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
    emptyColossal: { paddingHorizontal: Spacing.layout.screenPaddingTight },
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
    sectionHeader: { marginTop: Spacing.sm },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    subject: { marginTop: Spacing.xs },
});
