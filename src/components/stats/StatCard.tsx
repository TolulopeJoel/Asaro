import { useTheme } from '@/src/theme/ThemeContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { Text } from '../ui';

interface StatCardProps {
    label: string;
    value: string | number;
    color: string;
}

export const StatCard = React.memo(({ label, value, color }: StatCardProps) => {
    const { colors } = useTheme();

    return (
        <View style={styles.statCard}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text variant="label" tone="secondary" style={styles.statLabel}>{label}</Text>
        </View>
    );
});

StatCard.displayName = 'StatCard';

const styles = StyleSheet.create({
    statCard: {
        flex: 1,
    },
    statValue: {
        fontSize: Typography.size.xxxl,
        lineHeight: Typography.lineHeight.xxxl,
        letterSpacing: Typography.letterSpacing.tighter,
        marginBottom: Spacing.xs,
    },
    statLabel: { opacity: 0.5 },
});
