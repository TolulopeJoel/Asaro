import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

export const DateGroupHeader = React.memo(({ title }: { title: string }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.dateGroup}>
            <Text style={[styles.dateGroupTitle, { color: colors.textTertiary }]}>{title}</Text>
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
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    dateGroupTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
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