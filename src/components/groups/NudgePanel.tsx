/** The quiet line saying someone nudged you, on the hub and on Home. One panel however many nudges. */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { nudgeLine } from '../../groups/derive';
import { useMyNudges } from '../../groups/hooks';
import { Avatar } from '../Avatar';
import { ScalePressable } from '../ScalePressable';
import { Text } from '../ui';

export function NudgePanel({ style }: { style?: ViewStyle }) {
    const { colors } = useTheme();
    const { nudges, clear } = useMyNudges();
    const line = nudgeLine(nudges);
    if (!line) return null;
    const newest = nudges[0];

    return (
        <View style={[styles.panel, { backgroundColor: colors.backgroundSubtle }, style]}>
            <Avatar id={newest?.fromUid} name={line.name} size={38} radius={19} />
            <View style={styles.text}>
                <Text variant="body">{`${line.name}${line.rest}`}</Text>
                {!!line.groups && <Text variant="sub" style={styles.group}>{line.groups}</Text>}
            </View>
            <ScalePressable
                onPress={() => { void clear(); }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                hitSlop={Spacing.md}
            >
                <Text variant="meta" tone="secondary">Dismiss</Text>
            </ScalePressable>
        </View>
    );
}

const styles = StyleSheet.create({
    /** `.cl-panel{padding:18px}` laid out as a row. */
    panel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md + 2,
        padding: Spacing.layout.cardPadding,
    },
    text: { flex: 1, minWidth: 0 },
    group: { marginTop: 2 },
});
