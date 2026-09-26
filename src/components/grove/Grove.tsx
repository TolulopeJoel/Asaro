/**
 * The reader's practices as a grove of trees, on the stats page. Tap a tree to
 * see how rooted it is. design/practices-grove.html.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GroveTree } from '../../grove/loadGrove';
import { SPECIES, STAGE_NAMES } from '../../grove/grove';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { Text } from '../ui';
import { Tree } from './Tree';

/** Every tree on one scale, so each stage is plainly bigger than the last. */
const TREE_SIZE = 84;

const plural = (n: number, cadence: GroveTree['cadence']) =>
    `${n} ${cadence === 'daily' ? (n === 1 ? 'day' : 'days') : (n === 1 ? 'week' : 'weeks')}`;

const monthOf = (day: string) =>
    new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, 1).toLocaleDateString('en-GB', { month: 'long' });

/** The rooted score over the practice's life, as a filled line. */
function RootedLine({ series, color, fill }: { series: number[]; color: string; fill: string }) {
    const W = 300;
    const H = 56;
    const points = series.length > 1 ? series : [0, ...series];
    const xy = points.map((v, i) => [(i / (points.length - 1)) * W, H - 2 - v * (H - 4)] as const);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return (
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <Path d={`${line} L${W} ${H} L0 ${H} Z`} fill={fill} opacity={0.18} />
            <Path d={line} stroke={color} strokeWidth={2} fill="none" />
        </Svg>
    );
}

/** One tree, opened: where it stands, how far it has grown, and how rooted it is. */
export function TreeDetail({ tree, divided = true }: { tree: GroveTree; divided?: boolean }) {
    const { colors } = useTheme();
    const { item, growth, kept, cadence, rooted, thirsty, species, startedOn } = tree;
    const now = rooted[rooted.length - 1] ?? 0;
    const shape = growth.stage >= 5 ? `${SPECIES[species].name}, planted` : 'Planted';

    return (
        <View style={divided ? [styles.detail, { borderTopColor: colors.border }] : undefined}>
            <View style={styles.detailHead}>
                <Tree stage={growth.stage} species={species} thirsty={thirsty} size={TREE_SIZE} />
                <View style={styles.detailText}>
                    <Text variant="body" style={styles.detailName}>{item.action}</Text>
                    <Text variant="bodySmall" tone="secondary">{`${shape} at ${item.book_name} ${item.chapter_start}`}</Text>
                    <Text variant="bodySmall" tone="secondary" style={styles.detailLine}>
                        {`${plural(kept, cadence)} kept · ${thirsty ? 'thirsty' : `a ${STAGE_NAMES[growth.stage]}`}`}
                    </Text>
                    {growth.next && (
                        <Text variant="bodySmall" tone="secondary">{`${plural(growth.toNext ?? 0, cadence)} more to a ${growth.next}.`}</Text>
                    )}
                </View>
            </View>

            <Text variant="label" style={styles.rootedLabel}>How rooted it is</Text>
            <View style={styles.rootedFigure}>
                <Text variant="hero">{`${Math.round(now * 100)}%`}</Text>
            </View>
            <RootedLine series={rooted} color={colors.accent} fill={colors.accent} />
            <View style={styles.axis}>
                <Text variant="meta" tone="secondary">{monthOf(startedOn)}</Text>
                <Text variant="meta" tone="secondary">Now</Text>
            </View>
            <Text variant="bodySmall" tone="secondary" style={styles.rootedNote}>
                {`Each ${cadence === 'daily' ? 'day' : 'week'} kept roots it deeper. One missed loosens it a little; it never starts again from nothing.`}
            </Text>
        </View>
    );
}

export function Grove({ trees }: { trees: GroveTree[] }) {
    const { colors } = useTheme();
    const [open, setOpen] = useState<number | null>(null);

    const growing = trees
        .filter(t => !t.resting)
        .sort((a, b) => b.growth.stage - a.growth.stage || b.kept - a.kept);
    const resting = trees.filter(t => t.resting);
    const selected = growing.find(t => t.item.id === open) ?? null;

    return (
        <View style={[styles.card, { backgroundColor: colors.backgroundSubtle, borderBottomColor: colors.border }]}>
            <View style={styles.grid}>
                {growing.map(tree => {
                    const on = tree.item.id === open;
                    return (
                        <ScalePressable
                            key={tree.item.id}
                            style={[styles.cell, on && { backgroundColor: colors.background }]}
                            onPress={() => setOpen(on ? null : tree.item.id!)}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: on }}
                            accessibilityLabel={`${tree.item.action}, ${tree.thirsty ? 'thirsty' : STAGE_NAMES[tree.growth.stage]}`}
                        >
                            <View style={styles.treeSlot}>
                                <Tree stage={tree.growth.stage} species={tree.species} thirsty={tree.thirsty} size={TREE_SIZE} />
                            </View>
                            <Text variant="bodySmall" style={styles.name} numberOfLines={3}>{tree.item.action}</Text>
                            <Text variant="meta" tone="secondary" style={styles.centred}>
                                {tree.thirsty ? 'thirsty' : STAGE_NAMES[tree.growth.stage]}
                            </Text>
                        </ScalePressable>
                    );
                })}
            </View>

            {selected && <TreeDetail tree={selected} />}

            {resting.length > 0 && (
                <View style={[styles.tray, { borderTopColor: colors.border }]}>
                    <Text variant="label" tone="secondary">Resting</Text>
                    {resting.map(tree => (
                        <View key={tree.item.id} style={styles.seed}>
                            <View style={[styles.seedDot, { backgroundColor: '#8a6a45' }]} />
                            <Text variant="bodySmall" tone="secondary" numberOfLines={1} style={styles.seedName}>{tree.item.action}</Text>
                        </View>
                    ))}
                    <Text variant="bodySmall" tone="secondary">Keep one again and it goes back in the ground.</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.md, borderBottomWidth: 3 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: '33.333%', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: 2 },
    /* One height for every tree, standing on its base, so names line up across a row. */
    treeSlot: { height: TREE_SIZE * 1.2, justifyContent: 'flex-end', alignItems: 'center' },
    name: { textAlign: 'center', fontWeight: '600', marginTop: 2 },
    centred: { textAlign: 'center', marginTop: 2 },

    detail: { borderTopWidth: Spacing.border.hairline, marginTop: Spacing.sm, paddingTop: Spacing.md },
    detailHead: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
    detailText: { flex: 1, minWidth: 0 },
    detailName: { fontWeight: '600' },
    detailLine: { marginTop: Spacing.xs },
    rootedLabel: { marginTop: Spacing.lg },
    rootedFigure: { marginVertical: Spacing.xs },
    axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    rootedNote: { marginTop: Spacing.sm },

    tray: { borderTopWidth: Spacing.border.hairline, borderStyle: 'dashed', marginTop: Spacing.md, paddingTop: Spacing.sm, gap: 6 },
    seed: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    seedDot: { width: 9, height: 6, borderRadius: Spacing.borderRadius.round },
    seedName: { flex: 1 },
});
