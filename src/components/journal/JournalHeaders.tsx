import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Text } from '../ui';

/**
 * "Today", "This Week", "Older" over a run of entries — drawn by neither style.
 */
export const DateGroupHeader = React.memo(({ title }: { title: string }) => {
    /*
     * Neither style draws one. Both mockups show the library as one unbroken
     * run of rows, and every row already carries how long ago it was in its own
     * `.cl-when` / `.co-when` column — a heading would say it twice.
     *
     * The grouping itself still runs: it is what orders the list.
     */
    void title;
    return null;
});

/**
 * "Pinned" / "All actions" over a run of action rows.
 *
 * Unlike the date headings, this one is drawn in both styles — the Actions
 * mockup groups by it, and it is the only place
 * either style says an action is pinned. `Pinned` is set in ochre, which is
 * the mockup's single use of the accent on this screen.
 */
export const ActionSectionHeader = React.memo(({ title, accent = false }: { title: string; accent?: boolean }) => (
    <View style={styles.actionSection}>
        <Text variant="label" tone={accent ? 'accent' : undefined}>{title}</Text>
    </View>
));

ActionSectionHeader.displayName = 'ActionSectionHeader';

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
    actionSection: {
        marginBottom: 10,
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