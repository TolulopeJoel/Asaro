import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Text } from '../ui';

/**
 * One figure on the stats page: the numeral and what it counts.
 * design/all-screens.html #stats. The heavier lower edge is Duolingo's raised
 * tile in Cloth's square grammar.
 */
export function StatTile({ value, label, accent = false }: {
    value: number;
    label: string;
    accent?: boolean;
}) {
    const { colors } = useTheme();

    return (
        <View style={[styles.tile, { backgroundColor: colors.backgroundSubtle, borderBottomColor: colors.border }]}>
            <Text variant="hero" tone={accent ? 'accent' : 'primary'}>{value.toLocaleString('en-GB')}</Text>
            <Text variant="caption" tone="secondary" style={styles.label}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        padding: Spacing.md + 2,
        paddingBottom: Spacing.md,
        borderBottomWidth: 3,
    },
    label: { marginTop: 5, textTransform: 'uppercase' },
});
