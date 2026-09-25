/**
 * The tick, wherever something can be finished.
 *
 * Extracted so Commitments and Questions cannot drift: they are the two lists
 * that ask the reader to mark something done, and a round box in one beside a
 * square box in the other is the kind of difference nobody decides on purpose.
 *
 * 18px, square, hairline. Done fills with the ink rather than the accent —
 * ochre means "today" everywhere else in the app, and a finished thing is not
 * today. The check is drawn rather than iconographic so it keeps its weight at
 * this size.
 *
 * It is deliberately not offered to everything. `ActionCard` withholds it from
 * an application, which has no end; the reader should never be handed a box
 * for something the app has no standing to judge.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';

interface Props {
    done: boolean;
    onPress: () => void;
    /** What ticking this means, for a screen reader. */
    label?: string;
}

export function Checkbox({ done, onPress, label }: Props) {
    const { colors } = useTheme();

    return (
        <ScalePressable
            onPress={onPress}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={label ?? (done ? 'Mark as not done' : 'Mark as done')}
            hitSlop={Spacing.md}
            style={[
                styles.checkbox,
                done
                    ? { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
                    : { borderColor: colors.borderStrong },
            ]}
        >
            {done && (
                <Svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={colors.background} strokeWidth="3.6" strokeLinecap="round">
                    <Path d="M5 12l5 5L19 7" />
                </Svg>
            )}
        </ScalePressable>
    );
}

/** Keeps text on the same left edge as a row that has a box. */
export const CHECKBOX_WIDTH = 18;

const styles = StyleSheet.create({
    checkbox: {
        width: CHECKBOX_WIDTH,
        height: CHECKBOX_WIDTH,
        marginTop: 2,
        borderWidth: Spacing.border.hairline,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
