import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

export const DateGroupHeader = React.memo(({ title }: { title: string }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.dateGroup}>
            <View style={styles.dateGroupContent}>
                <View style={[styles.dateGroupDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.dateGroupTitle, { color: colors.textPrimary }]}>{title}</Text>
            </View>
        </View>
    );
});

export const TopicHeader = React.memo(({
    title,
    count,
    isArchiveCollapsed,
    onToggleCollapse
}: {
    title: string,
    count: number,
    isArchiveCollapsed: boolean,
    onToggleCollapse: () => void
}) => {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onToggleCollapse}
            style={[styles.archiveHeader, { borderTopColor: colors.border }]}
        >
            <View style={styles.archiveHeaderContent}>
                <Text style={[styles.archiveHeaderText, { color: colors.textTertiary }]}>
                    {title} ({count})
                </Text>
                <Ionicons name={isArchiveCollapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.textTertiary} />
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    dateGroup: {
        marginTop: 24,
        marginBottom: 16,
    },
    dateGroupContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dateGroupDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dateGroupTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        opacity: 0.5,
    },
    archiveHeader: {
        marginTop: 24,
        paddingTop: 16,
        paddingBottom: 8,
        borderTopWidth: 0.5,
    },
    archiveHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    archiveHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
