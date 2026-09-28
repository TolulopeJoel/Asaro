/**
 * The chosen sibling beside a line, flipping in whenever the line changes: how
 * the practice entry and the Home walk talk to a new user.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Asaro, START_DELAY_MS, Text, type AsaroAction, type AsaroHandle, type AsaroMood } from '../ui';
import { Flip } from './Flip';

/** Held long enough to be seen, then the face relaxes; nothing on these screens stays frozen. */
const HOLD_MS = 2500;
const HELD: ReadonlySet<AsaroAction> = new Set(['deadpan', 'sideEye', 'smug', 'sheepish', 'think']);

export function CoachLine({ line, action, mood, lookAt, style, children }: {
    line: string;
    action?: AsaroAction;
    /** Where the face looks, each axis −1…1: at what the line is about. */
    lookAt?: { x: number; y: number };
    /** `sincere` where he means it plainly: a promise, or the end of the first run. */
    mood?: AsaroMood;
    style?: ViewStyle;
    /** Under the line, inside the bubble: a Got it, say. */
    children?: React.ReactNode;
}) {
    const { colors } = useTheme();
    const face = useRef<AsaroHandle>(null);

    useEffect(() => {
        if (!action) return;
        const hold = HELD.has(action);
        const start = setTimeout(() => face.current?.play(action, { hold }), START_DELAY_MS);
        const release = hold ? setTimeout(() => face.current?.rest(), START_DELAY_MS + HOLD_MS) : undefined;
        return () => { clearTimeout(start); clearTimeout(release); };
    }, [line, action]);

    // The same element every render, so an answer typing itself in beside him never redraws the face.
    const portrait = useMemo(
        () => <Asaro ref={face} size={48} mood={mood} lookAt={lookAt} />,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mood, lookAt?.x, lookAt?.y],
    );

    return (
        <View style={[styles.row, style]}>
            {portrait}
            <Flip flipKey={line} stretch puff={false} style={styles.grow}>
                <View style={[styles.bubble, { backgroundColor: colors.backgroundSubtle }]}>
                    <Text variant="bodySmall" accessibilityLiveRegion="polite">{line}</Text>
                    {children}
                </View>
            </Flip>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    grow: { flex: 1 },
    bubble: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, gap: Spacing.sm },
});
