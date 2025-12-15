import { useTheme } from '@/src/theme/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    statCard: {
        flex: 1,
    },
    statValue: {
        fontSize: 40,
        fontWeight: '700',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        opacity: 0.5,
    },
});
