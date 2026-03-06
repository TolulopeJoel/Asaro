import React, { useRef } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export interface ActionItemPair {
    action: string;
    motivation: string;
}

interface ActionItemsInputProps {
    items: ActionItemPair[];
    onChange: (items: ActionItemPair[]) => void;
    disabled?: boolean;
}

/**
 * A dynamic list of action+motivation pairs inside one bordered card.
 * Dashed divider between action & motivation, solid divider between pairs.
 * "⊕ add action" button below.
 */
export const ActionItemsInput: React.FC<ActionItemsInputProps> = ({
    items,
    onChange,
    disabled = false,
}) => {
    const { colors } = useTheme();
    const actionRefs = useRef<(TextInput | null)[]>([]);
    const motivationRefs = useRef<(TextInput | null)[]>([]);

    const handleActionChange = (text: string, index: number) => {
        const updated = [...items];
        updated[index] = { ...updated[index], action: text };
        onChange(updated);
    };

    const handleMotivationChange = (text: string, index: number) => {
        const updated = [...items];
        updated[index] = { ...updated[index], motivation: text };
        onChange(updated);
    };

    const handleAdd = () => {
        const updated = [...items, { action: '', motivation: '' }];
        onChange(updated);
        setTimeout(() => {
            actionRefs.current[updated.length - 1]?.focus();
        }, 50);
    };

    const handleRemove = (index: number) => {
        if (items.length === 1) {
            onChange([{ action: '', motivation: '' }]);
            return;
        }
        onChange(items.filter((_, i) => i !== index));
    };

    const handleActionSubmit = (index: number) => {
        // Move focus to the motivation field of the same pair
        motivationRefs.current[index]?.focus();
    };

    const handleMotivationSubmit = (index: number) => {
        // Move to next pair's action field, or add new pair
        if (index < items.length - 1) {
            actionRefs.current[index + 1]?.focus();
        } else {
            handleAdd();
        }
    };

    const showRemove = (index: number) => {
        if (disabled) return false;
        if (items.length > 1) return true;
        return items[0].action.trim().length > 0 || items[0].motivation.trim().length > 0;
    };

    return (
        <View style={styles.container}>
            {/* Main card containing all pairs */}
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                {items.map((item, index) => (
                    <View key={index}>
                        {/* Solid divider between pairs */}
                        {index > 0 && (
                            <View style={[styles.pairDivider, { backgroundColor: colors.border }]} />
                        )}

                        <View style={styles.pairContainer}>
                            {/* Remove button */}
                            {showRemove(index) && (
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => handleRemove(index)}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                >
                                    <Text style={[styles.removeText, { color: colors.textTertiary }]}>×</Text>
                                </TouchableOpacity>
                            )}

                            {/* Action field */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>action</Text>
                                <TextInput
                                    ref={(ref) => { actionRefs.current[index] = ref; }}
                                    style={[styles.fieldInput, { color: colors.text }]}
                                    value={item.action}
                                    onChangeText={(text) => handleActionChange(text, index)}
                                    placeholder="I will..."
                                    placeholderTextColor={colors.textTertiary}
                                    editable={!disabled}
                                    returnKeyType="next"
                                    onSubmitEditing={() => handleActionSubmit(index)}
                                    blurOnSubmit={false}
                                    multiline={true}
                                />
                            </View>

                            {/* Dashed divider between action and motivation */}
                            <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

                            {/* Motivation field */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>motivated by</Text>
                                <TextInput
                                    ref={(ref) => { motivationRefs.current[index] = ref; }}
                                    style={[styles.fieldInput, { color: colors.text }]}
                                    value={item.motivation}
                                    onChangeText={(text) => handleMotivationChange(text, index)}
                                    placeholder="Because..."
                                    placeholderTextColor={colors.textTertiary}
                                    editable={!disabled}
                                    returnKeyType="next"
                                    onSubmitEditing={() => handleMotivationSubmit(index)}
                                    blurOnSubmit={false}
                                    multiline={true}
                                />
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            {/* Add button */}
            {!disabled && (
                <TouchableOpacity
                    style={[styles.addButton, { borderColor: colors.border }]}
                    onPress={handleAdd}
                    activeOpacity={0.7}
                >
                    <View style={[styles.addIcon, { borderColor: colors.primary }]}>
                        <Text style={[styles.addIconText, { color: colors.primary }]}>+</Text>
                    </View>
                    <Text style={[styles.addLabel, { color: colors.textTertiary }]}>
                        add action
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: Spacing.sm,
    },
    card: {
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        overflow: 'hidden',
    },
    pairContainer: {
        position: 'relative',
    },
    pairDivider: {
        height: 1.5,
    },
    fieldContainer: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    fieldLabel: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.medium,
        letterSpacing: Typography.letterSpacing.wider,
        textTransform: 'uppercase',
        marginBottom: Spacing.xs,
    },
    fieldInput: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.regular,
        lineHeight: Typography.lineHeight.lg,
        letterSpacing: 0.1,
        paddingVertical: Spacing.xs,
        minHeight: 36,
    },
    dashedDivider: {
        borderBottomWidth: 1,
        borderStyle: 'dashed',
        marginHorizontal: Spacing.lg,
    },
    removeButton: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        zIndex: 10,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeText: {
        fontSize: Typography.size.xl,
        fontWeight: Typography.weight.regular,
        lineHeight: Typography.size.xl + 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        gap: Spacing.sm,
        marginTop: Spacing.xs,
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    addIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addIconText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        lineHeight: 22,
        textAlign: 'center',
        marginTop: -1,
    },
    addLabel: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.regular,
        letterSpacing: 0.3,
    },
});
