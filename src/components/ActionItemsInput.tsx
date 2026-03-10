import React, { useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export interface ActionItemPair {
    action: string;
    motivation: string;
}

interface ActionItemsInputProps {
    label?: string;
    items: ActionItemPair[];
    onChange: (items: ActionItemPair[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * A dynamic list of action+motivation pairs inside one bordered card.
 * Dashed divider between action & motivation, solid divider between pairs.
 * "⊕ add action" button below.
 */
export const ActionItemsInput: React.FC<ActionItemsInputProps> = ({
    label,
    items,
    onChange,
    placeholder,
    disabled = false,
}) => {
    const { colors, isDark } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const [tempItems, setTempItems] = useState<ActionItemPair[]>([]);

    const actionRefs = useRef<(TextInput | null)[]>([]);
    const motivationRefs = useRef<(TextInput | null)[]>([]);

    const handleActionChange = (text: string, index: number, isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems];
        updated[index] = { ...updated[index], action: text };

        if (isModal) {
            setTempItems(updated);
        } else {
            onChange(updated);
        }
    };

    const handleMotivationChange = (text: string, index: number, isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems];
        updated[index] = { ...updated[index], motivation: text };

        if (isModal) {
            setTempItems(updated);
        } else {
            onChange(updated);
        }
    };

    const handleAdd = (isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems, { action: '', motivation: '' }];

        if (isModal) {
            setTempItems(updated);
        } else {
            onChange(updated);
        }

        setTimeout(() => {
            actionRefs.current[updated.length - 1]?.focus();
        }, 50);
    };

    const handleRemove = (index: number, isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        if (currentItems.length === 1) {
            const cleared = [{ action: '', motivation: '' }];
            if (isModal) setTempItems(cleared);
            else onChange(cleared);
            return;
        }

        const filtered = currentItems.filter((_, i) => i !== index);
        if (isModal) setTempItems(filtered);
        else onChange(filtered);
    };

    const handleExpand = () => {
        setTempItems([...items]);
        setIsExpanded(true);
    };

    const handleSaveExpansion = () => {
        onChange(tempItems);
        setIsExpanded(false);
    };

    const handleCancelExpansion = () => {
        setIsExpanded(false);
    };

    const handleActionSubmit = (index: number) => {
        motivationRefs.current[index]?.focus();
    };

    const handleMotivationSubmit = (index: number, isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        if (index < currentItems.length - 1) {
            actionRefs.current[index + 1]?.focus();
        } else {
            handleAdd(isModal);
        }
    };

    const showRemove = (index: number, currentItems: ActionItemPair[]) => {
        if (disabled) return false;
        if (currentItems.length > 1) return true;
        return currentItems[0].action.trim().length > 0 || currentItems[0].motivation.trim().length > 0;
    };

    const renderActionItemPair = (item: ActionItemPair, index: number, isModal: boolean, currentItems: ActionItemPair[]) => (
        <View key={index}>
            {/* Solid divider between pairs */}
            {index > 0 && (
                <View style={[styles.pairDivider, { backgroundColor: colors.border }]} />
            )}

            <View style={styles.pairContainer}>
                {/* Remove button */}
                {showRemove(index, currentItems) && (
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemove(index, isModal)}
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
                        onChangeText={(text) => handleActionChange(text, index, isModal)}
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
                        onChangeText={(text) => handleMotivationChange(text, index, isModal)}
                        placeholder="Because..."
                        placeholderTextColor={colors.textTertiary}
                        editable={!disabled}
                        returnKeyType="next"
                        onSubmitEditing={() => handleMotivationSubmit(index, isModal)}
                        blurOnSubmit={false}
                        multiline={true}
                    />
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Main card containing all pairs */}
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                {items.map((item, index) => renderActionItemPair(item, index, false, items))}

                {/* Expand button */}
                {!disabled && (
                    <TouchableOpacity
                        style={[styles.expandButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                        onPress={handleExpand}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        activeOpacity={0.7}
                    >
                        <View style={styles.expandIcon}>
                            <View style={[styles.expandIconInner, { borderColor: colors.textSecondary }]} />
                        </View>
                    </TouchableOpacity>
                )}
            </View>

            {/* Add button */}
            {!disabled && (
                <TouchableOpacity
                    style={[styles.addButton, { borderColor: colors.border }]}
                    onPress={() => handleAdd(false)}
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

            {/* Full-screen Modal */}
            <Modal
                visible={isExpanded}
                animationType="none"
                presentationStyle="fullScreen"
                statusBarTranslucent={true}
            >
                <StatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />
                <SafeAreaView style={[fullScreenStyles.container, { backgroundColor: colors.background }]}>
                    <KeyboardAvoidingView
                        style={fullScreenStyles.keyboardView}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={0}
                    >
                        <View style={fullScreenStyles.header}>
                            <TouchableOpacity
                                onPress={handleCancelExpansion}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Text style={[fullScreenStyles.cancelText, { color: colors.textTertiary }]}>Don&apos;t Save</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSaveExpansion}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Text style={[fullScreenStyles.saveText, { color: colors.textSecondary }]}>Save</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={fullScreenStyles.content} showsVerticalScrollIndicator={false}>
                            {label && (
                                <View style={fullScreenStyles.labelContainer}>
                                    <Text style={[fullScreenStyles.label, { color: colors.textSecondary }]}>{label}</Text>
                                </View>
                            )}

                            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBackground, marginBottom: Spacing.xl }]}>
                                {tempItems.map((item, index) => renderActionItemPair(item, index, true, tempItems))}
                            </View>

                            <TouchableOpacity
                                style={[styles.addButton, { borderColor: colors.border, marginBottom: Spacing.xxl }]}
                                onPress={() => handleAdd(true)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.addIcon, { borderColor: colors.primary }]}>
                                    <Text style={[styles.addIconText, { color: colors.primary }]}>+</Text>
                                </View>
                                <Text style={[styles.addLabel, { color: colors.textTertiary }]}>
                                    add action
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
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
        position: 'relative',
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
        minHeight: 100,
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
    expandButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        zIndex: 20,
    },
    expandIcon: {
        width: 14,
        height: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    expandIconInner: {
        width: 10,
        height: 10,
        borderWidth: 1.5,
        borderRadius: 3,
        backgroundColor: 'transparent',
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

const fullScreenStyles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: (StatusBar.currentHeight || 2),
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    labelContainer: {
        paddingBottom: 24,
    },
    label: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '400',
        letterSpacing: 0.1,
    },
    saveText: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
});
