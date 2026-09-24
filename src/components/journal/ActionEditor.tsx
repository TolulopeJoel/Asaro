/**
 * Editing one commitment, from the list where you are looking at it.
 *
 * Until now the only way to change an action item was to find the entry it
 * came from, open that entry in edit mode, walk the wizard to the action step
 * and re-save the lot. That is the wrong moment twice over. A typo gets
 * noticed while reading the list, and a standing commitment reveals itself as
 * a daily practice months after it was written — never while it is being
 * written, which is the only place the kind chips existed.
 *
 * So this is deliberately small: the two texts, the kind, and a way out. It is
 * not a second writing surface. The wizard still owns composing an entry; this
 * owns correcting one thing you are already looking at.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Archive, ArchiveRestore, X } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { ScalePressable } from '../ScalePressable';
import { Screen, Text, ThemedButton, textStyle } from '../ui';
import { KindChips } from './KindChips';
import { ActionKind, actionKindOf } from '../../data/actionKind';
import { EnhancedActionItem } from '../../data/database';
import { hasReason } from '../../data/actionValidation';

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
    const archived = !!item.archived_at;

    const derived = actionKindOf(kind);
    /*
     * The same rule the wizard enforces. Without it the editor would be a way
     * round the requirement — write a reason to get the item saved, then come
     * back and take it out.
     */
    const reasonMissing = !hasReason({ action, motivation });

    const save = async () => {
        if (saving || !action.trim() || reasonMissing) return;
        setSaving(true);
        try {
            await onSave({ action, motivation, ...kind });
        } finally {
            setSaving(false);
        }
    };

    const field = (
        label: string,
        value: string,
        onChangeText: (t: string) => void,
        placeholder: string,
    ) => (
        <View style={styles.field}>
            <Text variant="label" tone="tertiary">{label}</Text>
            <TextInput
                style={[
                    styles.input,
                    textStyle(themeStyle, 'body'),
                    { color: colors.textPrimary, borderColor: colors.border },
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
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={[styles.iconBtn, { backgroundColor: colors.backgroundSubtle }]}
                >
                    <X size={20} color={colors.textSecondary} />
                </ScalePressable>
            </View>

            <KeyboardAvoidingView
                style={styles.fill}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {field('action', action, setAction, 'I will...')}
                    {field(
                        reasonMissing ? 'motivated by — needed' : 'motivated by',
                        motivation,
                        setMotivation,
                        'Because...',
                    )}

                    <View style={styles.kind}>
                        <Text variant="label" tone="tertiary">kind</Text>
                        <KindChips value={kind} onChange={next => setKind({ cadence: next.cadence ?? null, due_at: next.due_at ?? null })} />
                        {/*
                          * The chips say what you can pick; this says what you
                          * have picked. Without it "nothing selected" reads as
                          * an unanswered question rather than as the answer.
                          */}
                        <Text variant="bodySmall" tone="secondary" style={styles.note}>
                            {KIND_NOTE[derived]}
                        </Text>
                    </View>

                    <ThemedButton
                        label={saving ? 'Saving…' : 'Save'}
                        variant="accent"
                        block
                        disabled={saving || !action.trim() || reasonMissing}
                        onPress={save}
                        style={styles.save}
                    />

                    {/*
                      * Archive, never delete. The item stays on its entry and a
                      * practice keeps every completion it logged — what changes
                      * is only whether it counts as something you are working
                      * on. Nothing here can rewrite what the journal says, so
                      * it needs no confirmation.
                      */}
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
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: Spacing.borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: Spacing.layout.screenPadding,
        paddingBottom: 60,
        gap: Spacing.lg,
    },
    field: { gap: Spacing.xs },
    input: {
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.lg,
        padding: Spacing.md,
        minHeight: 90,
        textAlignVertical: 'top',
    },
    kind: { gap: Spacing.sm },
    note: { marginTop: 2 },
    save: { marginTop: Spacing.sm },
    archive: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: Spacing.lg,
        paddingVertical: Spacing.md,
    },
});
