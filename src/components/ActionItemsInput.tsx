import React, { useCallback, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Button } from './Button';
import { ScalePressable } from './ScalePressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { BibleReferencePicker } from './BibleReferencePicker';
import { getBibleStyledParts } from '../utils/bibleUtils';
import { useRefPicker } from '../context/RefPickerContext';

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
    startIndex: number; // character index of the '@' in the field's text
}

// 'inline' = uses root RefPickerContext; 'local' = drives picker inside Modal
type RefPickerMode = 'inline' | 'local' | null;

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
    const { showPicker, hidePicker } = useRefPicker();
    const [isExpanded, setIsExpanded] = useState(false);
    const [tempItems, setTempItems] = useState<ActionItemPair[]>([]);
    const [refPickerMode, setRefPickerMode] = useState<RefPickerMode>(null);
    const [refQuery, setRefQuery] = useState('');
    // Single target ref — tracks which (index, field, isModal, startIndex) opened the picker.
    const refPickerTarget = useRef<RefPickerTarget | null>(null);

    // Track dynamic heights for growth
    const [actionHeights, setActionHeights] = useState<{ [key: number]: number }>({});
    const [motivationHeights, setMotivationHeights] = useState<{ [key: number]: number }>({});
    const [actionHeightsModal, setActionHeightsModal] = useState<{ [key: number]: number }>({});
    const [motivationHeightsModal, setMotivationHeightsModal] = useState<{ [key: number]: number }>({});

    const actionRefs = useRef<(TextInput | null)[]>([]);
    const motivationRefs = useRef<(TextInput | null)[]>([]);

    // Stable refs so callbacks passed to showPicker don't close over stale state.
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const tempItemsRef = useRef(tempItems);
    tempItemsRef.current = tempItems;

    // ─── @ trigger detection ──────────────────────────────────────────────────

    const checkAtTrigger = useCallback((text: string, index: number, field: 'action' | 'motivation', isModal: boolean) => {
        const target = refPickerTarget.current;
        const currentStartIndex = target?.startIndex ?? -1;

        // Already tracking a reference in progress for this field
        if (target && target.index === index && target.field === field && target.isModal === isModal && currentStartIndex >= 0) {
            if (text.length <= currentStartIndex) {
                // Deleted past the @ — close picker
                refPickerTarget.current = null;
                setRefPickerMode(null);
                setRefQuery('');
                if (!isModal) hidePicker();
            } else if (text.endsWith(' ')) {
                const partialRef = text.slice(currentStartIndex).trim();
                handleReferenceSelect(partialRef);
            } else {
                // Update the query live
                const newQuery = text.slice(currentStartIndex + 1);
                setRefQuery(newQuery);
                if (!isModal) {
                    showPicker({
                        query: newQuery,
                        onPreview: handlePreview,
                        onSelect: handleReferenceSelect,
                        onDismiss: handleReferenceDismiss,
                        onInteraction: handlePickerInteraction,
                    });
                }
            }
            return;
        }

        // Detect a fresh @ trigger at end of text
        const match = text.match(/@(\w[\w\s]*)$/);
        if (match) {
            const startIndex = text.length - match[0].length;
            refPickerTarget.current = { index, field, isModal, startIndex };
            const query = match[1];
            setRefQuery(query);
            if (isModal) {
                setRefPickerMode('local');
            } else {
                setRefPickerMode('inline');
                showPicker({
                    query,
                    onPreview: handlePreview,
                    onSelect: handleReferenceSelect,
                    onDismiss: handleReferenceDismiss,
                    onInteraction: handlePickerInteraction,
                });
            }
        } else {
            // No trigger — only clear if this field's mode is currently active
            if (target && target.index === index && target.field === field && target.isModal === isModal) {
                refPickerTarget.current = null;
                setRefPickerMode(null);
                setRefQuery('');
                if (!isModal) hidePicker();
            }
        }
    }, [showPicker, hidePicker]);

    // ─── Preview (live, keeps picker open) ───────────────────────────────────

    const handlePreview = useCallback((partialRef: string) => {
        const target = refPickerTarget.current;
        if (!target) return;

        const { index, field, isModal, startIndex } = target;
        if (startIndex < 0) return;

        const currentItems = isModal ? tempItemsRef.current : itemsRef.current;
        const updated = [...currentItems];
        const currentText = updated[index][field];
        updated[index] = { ...updated[index], [field]: currentText.slice(0, startIndex) + partialRef };

        if (isModal) setTempItems(updated);
        else onChange(updated);

        handlePickerInteraction();
    }, [onChange]);

    const handleReferenceSelect = useCallback((ref: string) => {
        const target = refPickerTarget.current;
        refPickerTarget.current = null;
        setRefPickerMode(null);
        setRefQuery('');
        if (!target) return;

        const { index, field, isModal, startIndex } = target;
        const currentItems = isModal ? tempItemsRef.current : itemsRef.current;
        const updated = [...currentItems];
        const currentText = updated[index][field];

        const taggedRef = `[[${ref}]]`;
        const insertAt = startIndex >= 0 ? startIndex : currentText.lastIndexOf('@');
        updated[index] = { ...updated[index], [field]: currentText.slice(0, insertAt >= 0 ? insertAt : 0) + taggedRef };

        if (isModal) setTempItems(updated);
        else { onChange(updated); hidePicker(); }

        handlePickerInteraction();
    }, [onChange, hidePicker]);

    const handleReferenceDismiss = useCallback(() => {
        const isModal = refPickerTarget.current?.isModal ?? false;
        refPickerTarget.current = null;
        setRefPickerMode(null);
        setRefQuery('');
        if (!isModal) hidePicker();
        handlePickerInteraction();
    }, [hidePicker]);

    const handlePickerInteraction = useCallback(() => {
        const target = refPickerTarget.current;
        if (!target) return;
        const { index, field } = target;
        setTimeout(() => {
            if (field === 'action') actionRefs.current[index]?.focus();
            else motivationRefs.current[index]?.focus();
        }, 50);
    }, []);

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

    const renderActionItemPair = (item: ActionItemPair, index: number, isModal: boolean) => {
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
                                <ScalePressable
                                    onPress={() => clearField(index, 'action', isModal)}
                                >
                                    <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                                </ScalePressable>
                            )}
                        </View>
                        <TextInput
                            inputAccessoryViewID="bible-picker"
                            ref={(ref) => { actionRefs.current[index] = ref; }}
                            style={[
                                styles.fieldInput,
                                { color: colors.text, minHeight: Math.max(120) }
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
                                            <Text style={{ color: colors.accent, opacity: 0.3, fontWeight: '400' }}>[[</Text>
                                            {part.refContent}
                                            <Text style={{ color: colors.accent, opacity: 0.3, fontWeight: '400' }}>]]</Text>
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
                                <ScalePressable
                                    onPress={() => clearField(index, 'motivation', isModal)}
                                >
                                    <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                                </ScalePressable>
                            )}
                        </View>
                        <TextInput
                            inputAccessoryViewID="bible-picker"
                            ref={(ref) => { motivationRefs.current[index] = ref; }}
                            style={[
                                styles.fieldInput,
                                { color: colors.text, minHeight: Math.max(120, hMotiv || 40) }
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
                                            <Text style={{ color: colors.accent, opacity: 0.3, fontWeight: '400' }}>[[</Text>
                                            {part.refContent}
                                            <Text style={{ color: colors.accent, opacity: 0.3, fontWeight: '400' }}>]]</Text>
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
                {items.map((item, index) => renderActionItemPair(item, index, false))}

                {/* Expand button */}
                {!disabled && (
                    <ScalePressable
                        style={[styles.expandButton, { backgroundColor: colors.backgroundSubtle }]}
                        onPress={handleExpand}
                    >
                        <Ionicons name="square-outline" size={16} color={colors.textSecondary} />
                    </ScalePressable>
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
                        <View style={[fullScreenStyles.header, { borderBottomColor: colors.border }]}>
                            <View style={fullScreenStyles.headerLeft}>
                                {label && (
                                    <Text style={[fullScreenStyles.label, { color: colors.textSecondary }]}>{label}</Text>
                                )}
                            </View>

                            <View style={fullScreenStyles.headerRight}>
                                <ScalePressable
                                    onPress={handleCancelExpansion}
                                    style={[fullScreenStyles.iconBtn, { backgroundColor: colors.backgroundSubtle }]}
                                >
                                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                                </ScalePressable>
                            </View>
                        </View>

                        <ScrollView
                            style={fullScreenStyles.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="always"
                        >
                            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBackground, marginBottom: Spacing.xl }]}>
                                {tempItems.map((item, index) => renderActionItemPair(item, index, true))}
                            </View>

                            <Button
                                label="add action"
                                variant="outline"
                                onPress={() => handleAdd(true)}
                                icon="add-outline"
                                style={[styles.addButton, { marginBottom: Spacing.xl }]}
                            />

                            <View style={fullScreenStyles.footer}>
                                <ScalePressable
                                    onPress={handleSaveExpansion}
                                    style={[fullScreenStyles.saveButton, { backgroundColor: colors.accent }]}
                                >
                                    <Text style={[fullScreenStyles.saveText, { color: colors.buttonPrimaryText }]}>Save</Text>
                                </ScalePressable>
                            </View>
                        </ScrollView>

                        {/* Bible Reference Picker for Modal mode */}
                        <BibleReferencePicker
                            visible={refPickerMode === 'local'}
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
        top: 10,
        right: 10,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        zIndex: 20,
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
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerLeft: { flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    labelContainer: {
        paddingBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    footer: {
        gap: 8,
        marginTop: Spacing.lg,
        marginBottom: Spacing.xxl,
    },
    saveButton: {
        paddingVertical: 14,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
    },
    saveText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
