import React from 'react';
import { StyleSheet, View } from 'react-native';
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

const styles = StyleSheet.create({
    dateGroup: {
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    actionSection: {
        marginBottom: 10,
    },
});