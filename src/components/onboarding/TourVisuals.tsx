/**
 * The real pieces of the app the tour shows: the plan's first readings, trees
 * and a Sunday group flip in like cartoon props, and the five questions pop up
 * out of a Bible, one page at a time.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { READING_PLAN_DATA } from '../../data/readingPlanData';
import { REFLECTION_QUESTIONS } from '../../data/questions';
import { SPECIES, STAGE_NAMES } from '../../grove/grove';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Tree } from '../grove/Tree';
import { Text } from '../ui';
import { Flip } from './Flip';

/** Counts up every `ms`, starting after `offset`, and stops at `limit` if given. */
function useTick(ms: number, offset = 0, limit = Infinity) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        const start = setTimeout(() => {
            interval = setInterval(() => setTick((t) => Math.min(t + 1, limit)), ms);
        }, offset);
        return () => { clearTimeout(start); clearInterval(interval); };
    }, [ms, offset, limit]);
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

/** A new question every 2 s, so the fifth lands just before the tour's 10 s countdown ends. */
const QUESTION_MS = 2000;
const PAGE_H = 140;
const BIBLE_H = 112;
/** Where the fold sits, from the bottom of the book: the page stands up out of it. */
const FOLD_UP = 72;
/** The old page folding back in; the next one starts popping just before it's down. */
const FOLD_MS = 320;

/** Turned about the page's bottom edge, the way a pop-up page stands up out of the fold. */
const hinge = (angle: string) => [
    { perspective: 600 },
    { translateY: PAGE_H / 2 },
    { rotateX: angle },
    { translateY: -PAGE_H / 2 },
];

const popUp = (delay: number) => new Keyframe({
    0: { opacity: 0, transform: hinge('88deg') },
    15: { opacity: 1, transform: hinge('70deg') },
    70: { opacity: 1, transform: hinge('-10deg'), easing: Easing.out(Easing.quad) },
    100: { opacity: 1, transform: hinge('0deg') },
}).duration(700).delay(delay);

const foldDown = () => new Keyframe({
    0: { opacity: 1, transform: hinge('0deg') },
    100: { opacity: 0.2, transform: hinge('88deg'), easing: Easing.in(Easing.quad) },
}).duration(FOLD_MS);

/** A chunky open Bible: its cover under a thick block of pages, the edges lined along the front, and a ribbon. */
function Bible() {
    const { colors } = useTheme();
    const ink = colors.textPrimary;
    return (
        <Svg width="100%" height={BIBLE_H} viewBox="0 0 300 112" preserveAspectRatio="none" style={styles.bible}>
            <Path d="M0 110 L300 110 L292 56 L8 56 Z" fill={ink} />
            <Path d="M12 100 L150 104 L150 62 L18 58 Z" fill={colors.background} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
            <Path d="M288 100 L150 104 L150 62 L282 58 Z" fill={colors.background} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
            <Path d="M16 64 L150 68 M15 70 L150 74 M15 76 L150 80 M14 82 L150 86 M13 88 L150 92 M13 94 L150 98 M284 64 L150 68 M285 70 L150 74 M285 76 L150 80 M286 82 L150 86 M287 88 L150 92 M287 94 L150 98" fill="none" stroke={colors.borderStrong} strokeWidth={1} />
            <Path d="M18 58 L40 14 Q96 4 150 24 L150 62 Z" fill={colors.background} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
            <Path d="M282 58 L260 14 Q204 4 150 24 L150 62 Z" fill={colors.background} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
            <Path d="M52 24 Q96 16 138 30 M48 32 Q94 24 138 38 M44 40 Q92 32 138 46 M40 48 Q90 40 138 54 M248 24 Q204 16 162 30 M252 32 Q206 24 162 38 M256 40 Q208 32 162 46 M260 48 Q210 40 162 54" fill="none" stroke={colors.borderStrong} strokeWidth={1} />
            <Path d="M150 24 L150 104" fill="none" stroke={ink} strokeWidth={1.5} />
            <Path d="M164 102 L164 112 L169 108 L174 112 L174 103 Z" fill={colors.accent} />
        </Svg>
    );
}

/** The five questions, one at a time, each popping up out of the Bible as the one before folds back in. */
function Questions() {
    const { colors } = useTheme();
    const total = REFLECTION_QUESTIONS.length;
    const at = useTick(QUESTION_MS, ENTER_MS, total - 1);
    const q = REFLECTION_QUESTIONS[at];
    return (
        <View style={styles.popStage}>
            <Animated.View
                key={q.question}
                entering={popUp(at === 0 ? ENTER_MS : FOLD_MS - 60)}
                exiting={foldDown()}
                style={styles.popPage}
            >
                <View style={[styles.card, styles.popCard, { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }]}>
                    <Text variant="label">Question {at + 1} of {total}</Text>
                    <Text variant="subtitle">{q.question}</Text>
                </View>
            </Animated.View>
            <Bible />
        </View>
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
    { name: 'Tomiwa Labule', read: 'Romans 8', answered: 4 },
    { name: 'You', read: 'Genesis 1–3', answered: 3 },
    { name: 'Tomi Precious', read: 'Psalm 23', answered: 5 },
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
    card: { padding: Spacing.layout.cardPadding, gap: Spacing.xs, minHeight: 112, alignSelf: 'stretch' },
    popStage: { alignSelf: 'stretch', height: FOLD_UP + PAGE_H + Spacing.sm, justifyContent: 'flex-end' },
    popPage: { position: 'absolute', left: '7%', right: '7%', bottom: FOLD_UP },
    popCard: { height: PAGE_H, minHeight: 0, borderWidth: Spacing.border.hairline },
    bible: { alignSelf: 'stretch' },
    trees: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: Spacing.md },
    tree: { alignItems: 'center', gap: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
    rowName: { flex: 1 },
});
