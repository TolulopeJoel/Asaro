import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Text } from '../ui';

export const DateGroupHeader = React.memo(({ title }: { title: string }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.dateGroup}>
            <Text variant="label" tone="tertiary">{title}</Text>
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
                <Text variant="label" tone="tertiary">
                    {title} ({count})
                </Text>
                {isArchiveCollapsed ? (
                    <ChevronDown size={16} color={colors.textTertiary} />
                ) : (
                    <ChevronUp size={16} color={colors.textTertiary} />
                )}
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
});