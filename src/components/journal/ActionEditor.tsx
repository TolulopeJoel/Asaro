/**
 * Editing one commitment, from the list where you are looking at it. A typo is
 * noticed while reading the list, and a standing commitment reveals itself as a
 * daily practice months after it was written — neither happens in the wizard.
 *
 * Deliberately small: the two texts, the kind, and a way out. NOT a second
 * writing surface — the wizard still owns composing an entry.
 *
 * design/all-screens.html #actionedit draws it in the state worth agreeing on:
 * the reason missing, the label saying so, Save refusing. Nothing is enlarged,
 * since a form has no fact to enlarge.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Archive, ArchiveRestore, X } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { Screen, Text, ThemedButton, textStyle } from '../ui';
import { KindChips } from './KindChips';
import { ActionKind, actionKindOf } from '../../data/actionKind';
import { EnhancedActionItem } from '../../data/database';
import { hasReason } from '../../data/actionValidation';
import { KEYBOARD_BEHAVIOR } from '../../utils/keyboard';

interface Props {
    item: EnhancedActionItem;
    onClose: () => void;
    onSave: (fields: {
        action: string;
        motivation: string;
        cadence?: string | null;
        due_at?: string | null;
    }) => Promise<void>;
    onArchive: (archived: boolean) => Promise<void>;
}

/** What the reader has made, said back to them as they change it. */
const KIND_NOTE: Record<ActionKind, string> = {
    application:
        'Something you are trying to be. No end, so nothing to tick — it comes back to you instead.',
    practice: 'A rhythm. You will be able to mark it done each time it comes round.',
    action: 'A one-off with a date. It ticks once and stays ticked.',
};

export function ActionEditor({ item, onClose, onSave, onArchive }: Props) {
    const { colors, style: themeStyle } = useTheme();

    const [action, setAction] = useState(item.action ?? '');
    const [motivation, setMotivation] = useState(item.motivation ?? '');
    const [kind, setKind] = useState({ cadence: item.cadence ?? null, due_at: item.due_at ?? null });
    const [saving, setSaving] = useState(false);
    // Nothing is flagged until the reader asks to save. An empty reason on a
    // freshly opened form is a field you were on your way to filling in, not a
    // mistake — the flag belongs to the attempt.
    const [tried, setTried] = useState(false);
    const archived = !!item.archived_at;

    const derived = actionKindOf(kind);
    /*
     * The same rule the wizard enforces. Without it the editor would be a way
     * round the requirement — write a reason to get the item saved, then come
     * back and take it out.
     */
    const reasonMissing = !hasReason({ action, motivation });
    const actionMissing = !action.trim();

    /*
     * Save stays live and REFUSES rather than sitting dead. A disabled primary
     * explains nothing — pressing it is how the reader asks what is wrong, so
     * pressing it has to answer. Only the write itself disables the button,
     * since that is the app being busy rather than the reader being wrong.
     */
    const save = async () => {
        if (saving) return;
        if (actionMissing || reasonMissing) {
            setTried(true);
            return;
        }
        setSaving(true);
        try {
            await onSave({ action, motivation, ...kind });
        } finally {
            setSaving(false);
        }
    };

    // `.cl-input` / `.co-input`: square, panel-filled, one hairline. A missing
    // field turns `danger` in both label and box, so the refusal attaches to
    // its cause, and clears as soon as the field is answered.
    const field = (
        label: string,
        value: string,
        onChangeText: (t: string) => void,
        placeholder: string,
        wanting = false,
    ) => (
        <View style={styles.field}>
            <Text variant="label" tone={wanting ? 'danger' : undefined}>
                {wanting ? `${label} — needed` : label}
            </Text>
            <TextInput
                style={[
                    styles.input,
                    textStyle(themeStyle, 'body'),
                    {
                        color: colors.textPrimary,
                        backgroundColor: colors.cardBackground,
                        borderColor: wanting ? colors.danger : colors.cardBorder,
                    },
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textTertiary}
                multiline
                scrollEnabled={false}
            />
        </View>
    );

    return (
        <Screen>
            <View style={styles.header}>
                <ScalePressable
                    onPress={onClose}
                    hitSlop={Spacing.md}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                >
                    <X size={19} color={colors.textSecondary} strokeWidth={1.9} />
                </ScalePressable>
            </View>

            <KeyboardAvoidingView
                style={styles.fill}
                behavior={KEYBOARD_BEHAVIOR}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        {
                            paddingHorizontal: Spacing.layout.screenPadding,
                        },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {field('action', action, setAction, 'I will...', tried && actionMissing)}
                    {field(
                        'motivated by',
                        motivation,
                        setMotivation,
                        'Because...',
                        tried && reasonMissing,
                    )}

                    <View style={styles.kind}>
                        <Text variant="label">kind</Text>
                        <KindChips value={kind} onChange={next => setKind({ cadence: next.cadence ?? null, due_at: next.due_at ?? null })} />
                        {/*
                          * The chips say what you can pick; this says what you
                          * have picked. Without it "nothing selected" reads as
                          * an unanswered question rather than as the answer.
                          */}
                        <Text variant="sub" style={styles.note}>
                            {KIND_NOTE[derived]}
                        </Text>
                    </View>

                    <View style={styles.footer}>
                        <ThemedButton
                            label={saving ? 'Saving…' : 'Save'}
                            variant="accent"
                            block
                            disabled={saving}
                            onPress={save}
                        />

                        {/* Archive, never delete: the item stays on its entry
                          * and a practice keeps its completions. Nothing here
                          * rewrites the journal, so it needs no confirmation. */}
                        <ScalePressable
                            onPress={() => onArchive(!archived)}
                            accessibilityRole="button"
                            style={styles.archive}
                        >
                            {archived ? (
                                <ArchiveRestore size={14} color={colors.accent} />
                            ) : (
                                <Archive size={14} color={colors.textTertiary} />
                            )}
                            <Text variant="label" tone={archived ? 'accent' : 'tertiary'}>
                                {archived ? 'Bring this back' : 'Archive — it has served its purpose'}
                            </Text>
                        </ScalePressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.sm,
    },
    content: {
        paddingTop: Spacing.layout.cardPadding,
        paddingBottom: Spacing.layout.tabBarPadding,
        gap: Spacing.xl - 2,
        // Short content still puts the two controls at the foot of the screen,
        // the way the drawing has them, without pinning a footer the keyboard
        // would then have to fight.
        flexGrow: 1,
    },
    field: { gap: Spacing.sm },
    /** `.cl-input{padding:12px 14px}` — square, and tall enough for two lines. */
    input: {
        borderWidth: Spacing.border.hairline,
        paddingHorizontal: Spacing.md + 2,
        paddingVertical: Spacing.md + 2,
        minHeight: 76,
        textAlignVertical: 'top',
    },
    kind: { gap: Spacing.sm },
    note: { marginTop: 2 },
    footer: { marginTop: 'auto', paddingTop: Spacing.lg },
    archive: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: Spacing.xs,
        paddingVertical: Spacing.md,
    },
});
