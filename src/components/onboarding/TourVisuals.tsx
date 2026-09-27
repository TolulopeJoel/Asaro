/**
 * The real pieces of the app the tour shows, each flipping in like a cartoon
 * prop: the plan's first readings, the five questions, trees, a Sunday group.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { READING_PLAN_DATA } from '../../data/readingPlanData';
import { REFLECTION_QUESTIONS } from '../../data/questions';
import { SPECIES, STAGE_NAMES } from '../../grove/grove';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Tree } from '../grove/Tree';
import { Text } from '../ui';
import { Flip } from './Flip';

/** Counts up every `ms`, starting after `offset`, for as long as it is mounted. */
function useTick(ms: number, offset = 0) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        const start = setTimeout(() => {
            interval = setInterval(() => setTick((t) => t + 1), ms);
        }, offset);
        return () => { clearTimeout(start); clearInterval(interval); };
    }, [ms, offset]);
    return tick;
}

/** Before anything flips, so the page and the face land first. */
const ENTER_MS = 600;

function Card({ children }: { children: React.ReactNode }) {
    const { colors } = useTheme();
    return <View style={[styles.card, { backgroundColor: colors.backgroundSubtle }]}>{children}</View>;
}

const FIRST_READINGS = READING_PLAN_DATA.slice(0, 3);

function Readings() {
    const tick = useTick(1800, ENTER_MS);
    const r = FIRST_READINGS[tick % FIRST_READINGS.length];
    return (
        <Flip flipKey={r.id} delay={ENTER_MS} stretch>
            <Card>
                <Text variant="label">Reading {r.id} of {READING_PLAN_DATA.length}</Text>
                <Text variant="title">{r.book} {r.chapters.replace('-', '–')}</Text>
                <Text variant="meta" tone="secondary">{r.section}</Text>
            </Card>
        </Flip>
    );
}

function Questions() {
    const tick = useTick(2400, ENTER_MS);
    const i = tick % REFLECTION_QUESTIONS.length;
    return (
        <Flip flipKey={i} delay={ENTER_MS} stretch>
            <Card>
                <Text variant="label">Question {i + 1} of {REFLECTION_QUESTIONS.length}</Text>
                <Text variant="subtitle">{REFLECTION_QUESTIONS[i].question}</Text>
            </Card>
        </Flip>
    );
}

/** A seedling, then two grown trees whose species keep changing, out of step with each other. */
function Trees() {
    const a = useTick(2000, ENTER_MS + 900);
    const b = useTick(2000, ENTER_MS + 1900);
    const slots = [
        { stage: 2, species: 0, key: 'seed', delay: ENTER_MS },
        { stage: 6, species: a % SPECIES.length, key: `a${a}`, delay: ENTER_MS + 300 },
        { stage: 9, species: (b + 3) % SPECIES.length, key: `b${b}`, delay: ENTER_MS + 600 },
    ];
    return (
        <View style={styles.trees}>
            {slots.map((s) => (
                <Flip key={s.stage} flipKey={s.key} delay={s.delay}>
                    <View style={styles.tree}>
                        <Tree stage={s.stage} species={s.species} size={88} />
                        <Text variant="meta" tone="secondary">
                            {s.stage < 5 ? STAGE_NAMES[s.stage] : SPECIES[s.species].name}
                        </Text>
                    </View>
                </Flip>
            ))}
        </View>
    );
}

/** Example members, as the group reads on a Sunday. */
const SUNDAY = [
    { name: 'Bisi', read: 'Romans 8', answered: 4 },
    { name: 'Tunde', read: 'Psalm 23', answered: 5 },
    { name: 'You', read: 'Genesis 1–3', answered: 3 },
];

function Sunday() {
    const { colors } = useTheme();
    return (
        <Card>
            <Text variant="label">Sunday · the group is open</Text>
            {SUNDAY.map((m, i) => (
                <Flip key={m.name} flipKey={m.name} delay={ENTER_MS + i * 350} stretch puff={false}>
                    <View style={[styles.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: Spacing.border.hairline }]}>
                        <Text variant="body" style={styles.rowName}>{m.name}</Text>
                        <Text variant="body">{m.read}</Text>
                        <Text variant="meta" tone="secondary">{m.answered} of 5</Text>
                    </View>
                </Flip>
            ))}
        </Card>
    );
}

export const TOUR_VISUALS = { readings: Readings, questions: Questions, trees: Trees, sunday: Sunday };
export type TourVisual = keyof typeof TOUR_VISUALS;

const styles = StyleSheet.create({
    /** `.cl-panel{padding:18px}` */
    card: { padding: Spacing.layout.cardPadding, gap: Spacing.xs, minHeight: 112 },
    trees: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: Spacing.md },
    tree: { alignItems: 'center', gap: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
    rowName: { flex: 1 },
});
