/** Editing a group's name, what it's about, and the time zone its window opens in. Admins and the creator. */
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MAX_FONT_SCALE } from '../../theme/typography';
import { Minus, Plus, X } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { Spacing } from '../../theme/spacing';
import { Group } from '../../groups/model';
import { editGroup } from '../../groups/repository';
import { deviceOffsetMinutes, isOffset, offsetLabel } from '../../groups/window';
import { ScalePressable } from '../ScalePressable';
import { Text, ThemedButton, textStyle } from '../ui';

/** Real zones sit on quarter hours. */
const STEP = 15;

export function EditGroupSheet({ visible, group, onClose }: { visible: boolean; group: Group; onClose: () => void }) {
    const { colors, style: themeStyle } = useTheme();
    const { showAlert } = useAlert();
    const [name, setName] = useState(group.name);
    const [about, setAbout] = useState(group.description);
    const [offset, setOffset] = useState(group.utcOffsetMinutes);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setName(group.name);
        setAbout(group.description);
        setOffset(group.utcOffsetMinutes);
    }, [visible, group.name, group.description, group.utcOffsetMinutes]);

    const nudgeOffset = (by: number) => {
        const next = offset + by;
        if (isOffset(next)) setOffset(next);
    };

    const save = async () => {
        if (!name.trim()) {
            showAlert({ title: 'It needs a name', message: 'A group can’t be saved without one.' });
            return;
        }
        setSaving(true);
        try {
            await editGroup(group.id, { name, description: about, utcOffsetMinutes: offset });
            onClose();
        } catch (error) {
            console.error('[groups] edit failed:', error);
            showAlert({ title: 'Not saved', message: 'That change could not be saved. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const input = [
        styles.input,
        textStyle(themeStyle, 'body'),
        { color: colors.textPrimary, backgroundColor: colors.backgroundSubtle, borderColor: colors.border },
    ];
    const mine = deviceOffsetMinutes();

    return (
        <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
            {/* Scrolls, so Save stays reachable with the keyboard up. */}
            <ScrollView
                style={styles.backdrop}
                contentContainerStyle={styles.centre}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.card, { backgroundColor: colors.background }]}>
                    <View style={styles.head}>
                        <Text variant="subtitle">Edit the group</Text>
                        <ScalePressable onPress={onClose} hitSlop={Spacing.md} accessibilityRole="button" accessibilityLabel="Close">
                            <X size={20} color={colors.textSecondary} />
                        </ScalePressable>
                    </View>

                    <View style={styles.field}>
                        <Text variant="label">Name</Text>
                        <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE} style={input} value={name} onChangeText={setName} maxLength={50} accessibilityLabel="Name" />
                    </View>
                    <View style={styles.field}>
                        <Text variant="label">About it · optional</Text>
                        <TextInput
                            maxFontSizeMultiplier={MAX_FONT_SCALE}
                            style={input}
                            value={about}
                            onChangeText={setAbout}
                            placeholder="What brings you together"
                            placeholderTextColor={colors.textTertiary}
                            maxLength={200}
                            multiline
                            accessibilityLabel="About it"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text variant="label">Time zone</Text>
                        <Text variant="sub">Opens Sunday 00:00 and closes Monday noon in this zone.</Text>
                        <View style={styles.zone}>
                            <ScalePressable
                                onPress={() => nudgeOffset(-STEP)}
                                accessibilityRole="button"
                                accessibilityLabel="Earlier zone"
                                style={[styles.step, { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }]}
                            >
                                <Minus size={16} color={colors.textPrimary} />
                            </ScalePressable>
                            <Text variant="cell" style={styles.zoneValue}>{offsetLabel(offset)}</Text>
                            <ScalePressable
                                onPress={() => nudgeOffset(STEP)}
                                accessibilityRole="button"
                                accessibilityLabel="Later zone"
                                style={[styles.step, { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }]}
                            >
                                <Plus size={16} color={colors.textPrimary} />
                            </ScalePressable>
                        </View>
                        {offset !== mine && isOffset(mine) && (
                            <ScalePressable onPress={() => setOffset(mine)} accessibilityRole="button" hitSlop={Spacing.sm}>
                                <Text variant="meta" tone="accent">{`Use my time zone (${offsetLabel(mine)})`}</Text>
                            </ScalePressable>
                        )}
                    </View>

                    <ThemedButton label={saving ? 'Saving…' : 'Save'} block loading={saving} disabled={saving} onPress={save} />
                </View>
            </ScrollView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    centre: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
    card: { padding: Spacing.xl, gap: Spacing.lg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    field: { gap: Spacing.sm },
    /** `.cl-input{padding:12px 14px}` */
    input: { borderWidth: Spacing.border.hairline, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md + 2 },
    zone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    step: {
        width: Spacing.touchTarget,
        height: Spacing.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: Spacing.border.hairline,
    },
    zoneValue: { flex: 1, textAlign: 'center' },
});
