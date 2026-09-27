/**
 * The practice entry's saved screen. Nothing was saved, so the real screens are
 * still empty; this flips through what a real first entry makes, one at a time.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { READING_PLAN_DATA } from '../../data/readingPlanData';
import { getBookByName } from '../../data/bibleBooks';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { PRACTICE_ANSWERS, PRACTICE_BOOK, PRACTICE_CHAPTERS, COACH } from '../../onboarding/practiceEntry';
import { Tree } from '../grove/Tree';
import { Text } from '../ui';
import { CoachLine } from './CoachLine';
import { Flip } from './Flip';

const STAGGER_MS = 700;
const FIRST_MS = 900;

function Card({ label, children }: { label: string; children: React.ReactNode }) {
    const { colors } = useTheme();
    return (
        <View style={[styles.card, { backgroundColor: colors.backgroundSubtle }]}>
            <Text variant="label">{label}</Text>
            {children}
        </View>
    );
}

export function PracticeAftermath() {
    const { colors } = useTheme();
    const chapters = getBookByName(PRACTICE_BOOK)?.chapters ?? 50;
    const today = (new Date().getDay() + 6) % 7;
    const practice = PRACTICE_ANSWERS.actionItems[0];

    const cards = [
        (
            <Card key="week" label="Your week">
                <View style={styles.week}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <View key={i} style={styles.day}>
                            <View style={[styles.dayBox, { backgroundColor: i === today ? colors.accent : colors.border }]} />
                            <Text variant="meta" tone="secondary">{d}</Text>
                        </View>
                    ))}
                </View>
            </Card>
        ),
        (
            <Card key="plan" label={`Reading 1 of ${READING_PLAN_DATA.length}, ticked`}>
                <View style={[styles.track, { backgroundColor: colors.border }]}>
                    <View style={[styles.fill, { backgroundColor: colors.accent, width: `${Math.max(2, 100 / READING_PLAN_DATA.length)}%` }]} />
                </View>
            </Card>
        ),
        (
            <Card key="land" label={`${PRACTICE_BOOK}’s first patch of land`}>
                <View style={styles.grid}>
                    {Array.from({ length: chapters }, (_, i) => (
                        <View
                            key={i}
                            style={[styles.cell, {
                                backgroundColor: i + 1 >= PRACTICE_CHAPTERS.start && i + 1 <= PRACTICE_CHAPTERS.end ? colors.accent : colors.border,
                            }]}
                        />
                    ))}
                </View>
            </Card>
        ),
        (
            <Card key="tree" label={`A seed for your ${practice.cadence} practice`}>
                <View style={styles.treeRow}>
                    <Tree stage={1} species={0} size={56} fit />
                    <Text variant="bodySmall" style={styles.treeText}>{practice.action}</Text>
                </View>
            </Card>
        ),
    ];

    return (
        <View style={styles.wrap}>
            <CoachLine line={COACH.saved.line} action={COACH.saved.action} />
            {cards.map((card, i) => (
                <Flip key={i} flipKey={i} delay={FIRST_MS + i * STAGGER_MS} stretch>
                    {card}
                </Flip>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.lg, paddingVertical: Spacing.lg },
    /** `.cl-panel{padding:18px}` */
    card: { padding: Spacing.layout.cardPadding, gap: Spacing.sm },
    week: { flexDirection: 'row', justifyContent: 'space-between' },
    day: { alignItems: 'center', gap: Spacing.xs },
    dayBox: { width: 28, height: 28 },
    track: { height: 10 },
    fill: { height: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    cell: { width: 14, height: 14 },
    treeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    treeText: { flex: 1 },
});
