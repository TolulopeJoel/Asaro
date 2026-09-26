import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Text } from '../ui';

/**
 * One figure on the stats page: a glyph, the numeral, what it counts.
 * design/all-screens.html #stats. The heavier lower edge is Duolingo's raised
 * tile in Cloth's square grammar.
 */
export function StatTile({ icon, value, label, accent = false }: {
    icon: LucideIcon;
    value: number;
    label: string;
    accent?: boolean;
}) {
    const { colors } = useTheme();

    return (
        <View style={[styles.tile, { backgroundColor: colors.backgroundSubtle, borderBottomColor: colors.border }]}>
            {React.createElement(icon, { size: 22, color: colors.accent, strokeWidth: 1.9 })}
            <View style={styles.text}>
                <Text variant="hero" tone={accent ? 'accent' : 'primary'}>{value.toLocaleString('en-GB')}</Text>
                <Text variant="caption" tone="secondary" style={styles.label}>{label}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm + 2,
        padding: Spacing.md + 2,
        paddingBottom: Spacing.md,
        borderBottomWidth: 3,
    },
    text: { flex: 1, minWidth: 0 },
    label: { marginTop: 5, textTransform: 'uppercase' },
});
