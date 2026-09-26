import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

import { Achievement } from '../../stats/achievements';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ClothMark, Text } from '../ui';

/**
 * A levelled achievement: the badge, what the next level asks, and how far
 * along it is. Earned badges are woven on indigo; a locked one is the bare
 * panel. design/all-screens.html #stats.
 */
export function AchievementRow({ achievement, icon, last = false }: {
    achievement: Achievement;
    icon: LucideIcon;
    last?: boolean;
}) {
    const { colors } = useTheme();
    const { title, level, have, need, description, maxed } = achievement;
    const earned = level > 0;
    const fill = Math.min(1, need > 0 ? have / need : 0);

    return (
        <View style={[styles.row, !last && { borderBottomWidth: Spacing.border.hairline, borderBottomColor: colors.border }]}>
            <View
                style={[
                    styles.badge,
                    earned
                        ? { backgroundColor: colors.textPrimary, borderBottomColor: 'rgba(0,0,0,0.35)' }
                        : { backgroundColor: colors.backgroundSubtle, borderBottomColor: colors.border },
                ]}
                accessibilityLabel={earned ? `${title}, level ${level}` : `${title}, locked`}
            >
                {earned && <ClothMark />}
                <View style={[styles.glyph, earned && { backgroundColor: colors.textPrimary }]}>
                    {React.createElement(icon, {
                        size: 20,
                        color: earned ? colors.textInverse : colors.textSecondary,
                        strokeWidth: 1.9,
                    })}
                </View>
                <View style={[styles.tag, earned && { backgroundColor: colors.background }]}>
                    <Text variant="meta" tone={earned ? 'primary' : 'secondary'}>
                        {earned ? `Level ${level}` : 'Locked'}
                    </Text>
                </View>
            </View>

            <View style={styles.body}>
                <Text variant="subtitle">{title}</Text>
                <Text variant="bodySmall" tone="secondary" style={styles.description}>{description}</Text>
                <View style={styles.progress}>
                    <View style={[styles.track, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <View style={[styles.fill, { backgroundColor: colors.accent, width: `${fill * 100}%` }]} />
                    </View>
                    <Text variant="meta">
                        {maxed ? `${have.toLocaleString('en-GB')}` : `${have.toLocaleString('en-GB')}/${need.toLocaleString('en-GB')}`}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.md + 2, paddingVertical: Spacing.md + 2 },
    badge: {
        width: 58,
        height: 66,
        borderBottomWidth: 3,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        paddingBottom: 6,
        overflow: 'hidden',
    },
    glyph: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    tag: { paddingHorizontal: 5, paddingVertical: 1 },
    body: { flex: 1, minWidth: 0 },
    description: { marginTop: 3, marginBottom: Spacing.sm },
    progress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 1 },
    track: { flex: 1, height: 10, borderWidth: Spacing.border.hairline },
    fill: { height: '100%' },
});
