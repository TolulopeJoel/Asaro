/** A small sheet of actions from the foot of the screen: a member's, or the group's. */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { useFootPadding } from '../../hooks/useScreenInsets';
import { ScalePressable } from '../ScalePressable';
import { Text } from '../ui';

export interface SheetAction {
    label: string;
    onPress: () => void;
    destructive?: boolean;
}

export function ActionSheet({ visible, title, sub, actions, onClose }: {
    visible: boolean;
    title: string;
    sub?: string;
    actions: SheetAction[];
    onClose: () => void;
}) {
    const { colors } = useTheme();
    const footPadding = useFootPadding(Spacing.xl);

    return (
        <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
            <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: footPadding }]}>
                <Text variant="subtitle">{title}</Text>
                {!!sub && <Text variant="sub">{sub}</Text>}
                <View style={styles.list}>
                    {actions.map(action => (
                        <ScalePressable
                            key={action.label}
                            onPress={() => {
                                onClose();
                                action.onPress();
                            }}
                            accessibilityRole="button"
                            style={[styles.row, { borderBottomColor: colors.border }]}
                        >
                            <Text variant="body" tone={action.destructive ? 'danger' : 'primary'}>{action.label}</Text>
                        </ScalePressable>
                    ))}
                    <ScalePressable onPress={onClose} accessibilityRole="button" style={styles.row}>
                        <Text variant="body" tone="secondary">Cancel</Text>
                    </ScalePressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.xl,
        gap: Spacing.xs,
    },
    list: { marginTop: Spacing.md },
    row: {
        paddingVertical: Spacing.lg,
        borderBottomWidth: Spacing.border.hairline,
        borderBottomColor: 'transparent',
    },
});
