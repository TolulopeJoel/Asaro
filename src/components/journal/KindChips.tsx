/**
 * The control that says what kind of thing an action item is.
 *
 * Three chips, none selected by default — and nothing selected is not a gap,
 * it is the answer. An application is what the question above ("How can I
 * realistically apply this in my life?") already invites, so it needs no chip:
 * a control meaning "no modifier" would be a swatch for no colour. Adding a
 * rhythm or a date is the deliberate act; leaving them alone is the default.
 *
 * Every chip toggles. Tapping the one already lit clears it and the item falls
 * back to an application, which is the only route back once something is set.
 *
 * Extracted so the wizard and the commitments list share one definition. They
 * are the two moments this decision gets made and they must not drift: writing
 * an entry is when a rhythm is obvious, and looking down a list of standing
 * commitments is when it becomes obvious — usually months later.
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { Text } from '../ui';
import { Cadence } from '../../data/actionKind';

const CHIPS: { key: Cadence | 'due'; label: string }[] = [
    { key: 'daily', label: 'Every day' },
    { key: 'weekly', label: 'Every week' },
    { key: 'due', label: 'By a date' },
];

export interface KindValue {
    cadence?: string | null;
    due_at?: string | null;
}

interface Props {
    value: KindValue;
    onChange: (next: KindValue) => void;
    disabled?: boolean;
}

export function KindChips({ value, onChange, disabled = false }: Props) {
    const { colors } = useTheme();
    const [picking, setPicking] = useState(false);

    const dueLabel = value.due_at
        ? new Date(value.due_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : 'By a date';

    const press = (key: Cadence | 'due') => {
        if (key === 'due') {
            // Already dated: the tap clears it, like every other chip.
            if (value.due_at) onChange({ cadence: null, due_at: null });
            else setPicking(true);
            return;
        }
        const clearing = value.cadence === key;
        // Both cleared on every change, so a row can never carry a cadence and
        // a date at once and leave the derivation to guess.
        onChange({ cadence: clearing ? null : key, due_at: null });
    };

    return (
        <View style={styles.row}>
            {CHIPS.map(chip => {
                const on = chip.key === 'due' ? !!value.due_at : value.cadence === chip.key;
                return (
                    <ScalePressable
                        key={chip.key}
                        disabled={disabled}
                        onPress={() => press(chip.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityHint={on ? 'Tap to clear' : undefined}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: on ? colors.textPrimary : colors.cardBackground,
                                borderColor: on ? colors.textPrimary : colors.cardBorder,
                            },
                        ]}
                    >
                        <Text variant="cell" tone={on ? 'inverse' : 'primary'}>
                            {chip.key === 'due' ? dueLabel : chip.label}
                        </Text>
                    </ScalePressable>
                );
            })}

            {picking && (
                <DateTimePicker
                    value={value.due_at ? new Date(value.due_at) : new Date(Date.now() + 7 * 86_400_000)}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, selected) => {
                        setPicking(false);
                        if (event.type === 'dismissed' || !selected) return;
                        onChange({ cadence: null, due_at: selected.toISOString() });
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    /* A quiet row, not a form — the writing is the point and this only names
     * what the writing already is. */
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    /*
     * `.cl-pill` / `.co-pill` — 44px tall with a 15px gutter, which is also
     * the touch minimum. The old chip was 22px including its border: legible,
     * and half the height a thumb needs.
     *
     * Set is the pill's filled state (`.cl-pill.back` / `.co-pill.back`):
     * indigo on ecru, white on black. Not the woven mark — that belongs to a
     * cell in a grid of many, where the eye has to find the chosen few. A chip
     * sits in a row of three and the fill is the plainer answer.
     */
    chip: {
        height: 44,
        paddingHorizontal: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: Spacing.border.hairline,
        overflow: 'hidden',
    },
});
