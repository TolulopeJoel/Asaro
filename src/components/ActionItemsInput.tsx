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
import { Button } from './Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { BibleReferencePicker } from './BibleReferencePicker';
import { getBibleStyledParts } from '../utils/bibleUtils';

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

// Which field triggered the reference picker
interface RefPickerTarget {
    index: number;
    field: 'action' | 'motivation';
    isModal: boolean;
}

// Track both inline + modal picker visibility separately
type RefPickerMode = 'inline' | 'modal' | null;

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
    const [refPickerMode, setRefPickerMode] = useState<RefPickerMode>(null);
    const [refQuery, setRefQuery] = useState('');
    const refPickerTarget = useRef<RefPickerTarget | null>(null);

    // Tracks the character index of the '@' that opened the picker.
    // While this is set (>= 0), the picker stays open and onPreview
    // replaces text from this index forward.
    const [refStartIndex, setRefStartIndex] = useState(-1);
    const [refStartIndexModal, setRefStartIndexModal] = useState(-1);

    // Track dynamic heights for growth
    const [actionHeights, setActionHeights] = useState<{ [key: number]: number }>({});
    const [motivationHeights, setMotivationHeights] = useState<{ [key: number]: number }>({});
    const [actionHeightsModal, setActionHeightsModal] = useState<{ [key: number]: number }>({});
    const [motivationHeightsModal, setMotivationHeightsModal] = useState<{ [key: number]: number }>({});

    const actionRefs = useRef<(TextInput | null)[]>([]);
    const motivationRefs = useRef<(TextInput | null)[]>([]);

    // ─── @ trigger detection ──────────────────────────────────────────────────

    const checkAtTrigger = (text: string, index: number, field: 'action' | 'motivation', isModal: boolean) => {
        // If we're already building a reference, only close picker if user
        // deleted back past the @ position.
        const currentStartIndex = isModal ? refStartIndexModal : refStartIndex;
        if (currentStartIndex >= 0) {
            if (text.length <= currentStartIndex) {
                setRefPickerMode(null);
                if (isModal) setRefStartIndexModal(-1);
                else setRefStartIndex(-1);
                setRefQuery('');
            } else if (text.endsWith(' ')) {
                // Finalize on space
                const partialRef = text.slice(currentStartIndex).trim();
                handleReferenceSelect(partialRef);
            }
            return;
        }

        // Detect a fresh @ trigger at end of text
        const match = text.match(/@(\w[\w\s]*)$/);
        if (match) {
            refPickerTarget.current = { index, field, isModal };
            setRefQuery(match[1]);
            if (isModal) {
                setRefStartIndexModal(text.length - match[0].length);
                setRefPickerMode('modal');
            } else {
                setRefStartIndex(text.length - match[0].length);
                setRefPickerMode('inline');
            }
        } else {
            // only clear the mode if it matches this source to avoid cross-clearing
            setRefPickerMode(prev => {
                if ((isModal && prev === 'modal') || (!isModal && prev === 'inline')) return null;
                return prev;
            });
            if ((isModal && refPickerMode === 'modal') || (!isModal && refPickerMode === 'inline')) {
                setRefQuery('');
            }
        }
    };

    // ─── Preview (live, keeps picker open) ───────────────────────────────────

    /**
     * Called on every step by BibleReferencePicker.
     * Replaces text from the @ position onward with the partial ref,
     * so the user sees the reference being built live in the TextInput.
     */
    const handlePreview = (partialRef: string) => {
        const target = refPickerTarget.current;
        if (!target) return;

        const { index, field, isModal } = target;
        const currentStartIndex = isModal ? refStartIndexModal : refStartIndex;
        if (currentStartIndex < 0) return;

        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems];
        const currentText = updated[index][field];
        updated[index] = { ...updated[index], [field]: currentText.slice(0, currentStartIndex) + partialRef };

        if (isModal) setTempItems(updated);
        else onChange(updated);

        handlePickerInteraction();
    };

    const handleReferenceSelect = (ref: string) => {
        const target = refPickerTarget.current;
        setRefPickerMode(null);
        if (target?.isModal) setRefStartIndexModal(-1); else setRefStartIndex(-1);
        if (!target) return;

        const { index, field, isModal } = target;
        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems];
        const currentText = updated[index][field];
        const currentStartIndex = isModal ? refStartIndexModal : refStartIndex;

        const taggedRef = `[[${ref}]]`;
        // Use the tracked start index for precise replacement
        const insertAt = currentStartIndex >= 0 ? currentStartIndex : currentText.lastIndexOf('@');
        updated[index] = { ...updated[index], [field]: currentText.slice(0, insertAt >= 0 ? insertAt : 0) + taggedRef };
        setRefQuery('');

        if (isModal) setTempItems(updated);
        else onChange(updated);

        // Re-focus after final selection
        handlePickerInteraction();
    };

    const handleReferenceDismiss = () => {
        const isModal = refPickerMode === 'modal';
        setRefPickerMode(null);
        if (isModal) setRefStartIndexModal(-1); else setRefStartIndex(-1);
        setRefQuery('');
        handlePickerInteraction();
    };

    const handlePickerInteraction = () => {
        const target = refPickerTarget.current;
        if (!target) return;
        const { index, field } = target;
        setTimeout(() => {
            if (field === 'action') actionRefs.current[index]?.focus();
            else motivationRefs.current[index]?.focus();
        }, 50);
    };

    // ─── Field change handlers ────────────────────────────────────────────────

    const handleActionChange = (text: string, index: number, isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems];
        updated[index] = { ...updated[index], action: text };
        if (isModal) setTempItems(updated);
        else onChange(updated);
        checkAtTrigger(text, index, 'action', isModal);
    };

    const handleMotivationChange = (text: string, index: number, isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems];
        updated[index] = { ...updated[index], motivation: text };
        if (isModal) setTempItems(updated);
        else onChange(updated);
        checkAtTrigger(text, index, 'motivation', isModal);
    };

    const clearField = (index: number, field: keyof ActionItemPair, isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems];
        updated[index] = { ...updated[index], [field]: '' };
        if (isModal) setTempItems(updated);
        else onChange(updated);
    };

    const handleAdd = (isModal: boolean = false) => {
        const currentItems = isModal ? tempItems : items;
        const updated = [...currentItems, { action: '', motivation: '' }];
        if (isModal) setTempItems(updated);
        else onChange(updated);
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

    const renderActionItemPair = (item: ActionItemPair, index: number, isModal: boolean, currentItems: ActionItemPair[]) => {
        const hAction = isModal ? actionHeightsModal[index] : actionHeights[index];
        const hMotiv = isModal ? motivationHeightsModal[index] : motivationHeights[index];

        return (
            <View key={index}>
                {/* Solid divider between pairs */}
                {index > 0 && (
                    <View style={[styles.pairDivider, { backgroundColor: colors.border }]} />
                )}

                <View style={styles.pairContainer}>
                    {/* Action field */}
                    <View style={styles.fieldContainer}>
                        <View style={styles.fieldHeader}>
                            <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>action</Text>
                            {!disabled && item.action.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => clearField(index, 'action', isModal)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TextInput
                            ref={(ref) => { actionRefs.current[index] = ref; }}
                            style={[
                                styles.fieldInput,
                                { color: colors.text, minHeight: Math.max(40, hAction || 40) }
                            ]}
                            onChangeText={(text) => handleActionChange(text, index, isModal)}
                            onContentSizeChange={(e) => {
                                const h = e.nativeEvent.contentSize.height;
                                if (isModal) setActionHeightsModal(prev => ({ ...prev, [index]: h }));
                                else setActionHeights(prev => ({ ...prev, [index]: h }));
                            }}
                            placeholder="I will..."
                            placeholderTextColor={colors.textTertiary}
                            editable={!disabled}
                            returnKeyType="next"
                            onSubmitEditing={() => handleActionSubmit(index)}
                            blurOnSubmit={false}
                            multiline={true}
                            scrollEnabled={false}
                        >
                            {getBibleStyledParts(item.action).map((part, index) => (
                                <Text key={index} style={part.isReference ? { color: colors.accent, fontWeight: '600' } : {}}>
                                    {part.isReference ? (
                                        <Text>
                                            <Text style={{ color: colors.textTertiary, fontWeight: '400' }}>[[</Text>
                                            {part.refContent}
                                            <Text style={{ color: colors.textTertiary, fontWeight: '400' }}>]]</Text>
                                        </Text>
                                    ) : (
                                        part.text
                                    )}
                                </Text>
                            ))}
                        </TextInput>
                    </View>

                    {/* Dashed divider between action and motivation */}
                    <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

                    {/* Motivation field */}
                    <View style={styles.fieldContainer}>
                        <View style={styles.fieldHeader}>
                            <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>motivated by</Text>
                            {!disabled && item.motivation.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => clearField(index, 'motivation', isModal)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TextInput
                            ref={(ref) => { motivationRefs.current[index] = ref; }}
                            style={[
                                styles.fieldInput,
                                { color: colors.text, minHeight: Math.max(40, hMotiv || 40) }
                            ]}
                            onChangeText={(text) => handleMotivationChange(text, index, isModal)}
                            onContentSizeChange={(e) => {
                                const h = e.nativeEvent.contentSize.height;
                                if (isModal) setMotivationHeightsModal(prev => ({ ...prev, [index]: h }));
                                else setMotivationHeights(prev => ({ ...prev, [index]: h }));
                            }}
                            placeholder="Because..."
                            placeholderTextColor={colors.textTertiary}
                            editable={!disabled}
                            returnKeyType="next"
                            onSubmitEditing={() => handleMotivationSubmit(index, isModal)}
                            blurOnSubmit={false}
                            multiline={true}
                            scrollEnabled={false}
                        >
                            {getBibleStyledParts(item.motivation).map((part, index) => (
                                <Text key={index} style={part.isReference ? { color: colors.accent, fontWeight: '600' } : {}}>
                                    {part.isReference ? (
                                        <Text>
                                            <Text style={{ color: colors.textTertiary, fontWeight: '400' }}>[[</Text>
                                            {part.refContent}
                                            <Text style={{ color: colors.textTertiary, fontWeight: '400' }}>]]</Text>
                                        </Text>
                                    ) : (
                                        part.text
                                    )}
                                </Text>
                            ))}
                        </TextInput>
                    </View>
                </View>
            </View>
        );
    };

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
                <Button
                    label="add action"
                    variant="outline"
                    onPress={() => handleAdd(false)}
                    icon="add-outline"
                    style={styles.addButton}
                />
            )}

            {/* Global Inline Picker (Keyboard Accessory style) */}
            <BibleReferencePicker
                visible={refPickerMode === 'inline'}
                query={refQuery}
                onPreview={handlePreview}
                onSelect={handleReferenceSelect}
                onDismiss={handleReferenceDismiss}
                onInteraction={handlePickerInteraction}
            />

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
                    >
                        <View style={fullScreenStyles.header}>
                            <Button
                                label="Don't Save"
                                variant="ghost"
                                onPress={handleCancelExpansion}
                                labelStyle={[fullScreenStyles.cancelText, { color: colors.textTertiary }]}
                            />

                            <Button
                                label="Save"
                                variant="ghost"
                                onPress={handleSaveExpansion}
                                labelStyle={[fullScreenStyles.saveText, { color: colors.textSecondary }]}
                            />
                        </View>

                        <ScrollView
                            style={fullScreenStyles.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="always"
                        >
                            {label && (
                                <View style={fullScreenStyles.labelContainer}>
                                    <Text style={[fullScreenStyles.label, { color: colors.textSecondary }]}>{label}</Text>
                                </View>
                            )}

                            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBackground, marginBottom: Spacing.xl }]}>
                                {tempItems.map((item, index) => renderActionItemPair(item, index, true, tempItems))}
                            </View>

                            <Button
                                label="add action"
                                variant="outline"
                                onPress={() => handleAdd(true)}
                                icon="add-outline"
                                style={[styles.addButton, { marginBottom: Spacing.xxl }]}
                            />
                        </ScrollView>

                        {/* Global Modal Picker (Keyboard Accessory style) */}
                        <BibleReferencePicker
                            visible={refPickerMode === 'modal'}
                            query={refQuery}
                            onPreview={handlePreview}
                            onSelect={handleReferenceSelect}
                            onDismiss={handleReferenceDismiss}
                            onInteraction={handlePickerInteraction}
                        />
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
        textAlignVertical: 'top',
    },
    fieldHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    dashedDivider: {
        borderBottomWidth: 1,
        borderStyle: 'dashed',
        marginHorizontal: Spacing.lg,
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
