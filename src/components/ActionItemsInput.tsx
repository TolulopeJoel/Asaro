import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button } from './Button';
import { ScalePressable } from './ScalePressable';
import { XCircle, X, Plus, Maximize } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography, MAX_FONT_SCALE } from '../theme/typography';
import { BibleReferencePicker } from './BibleReferencePicker';
import { couldBeBookName, findAtTrigger, getBibleStyledParts, pickerQuery, resolveTypedReference, typedSince } from '../utils/bibleUtils';
import { useRefPicker } from '../context/RefPickerContext';
import { Screen, Text, ThemedButton } from './ui';
import { KindChips } from './journal/KindChips';
import { hasReason, isBlank } from '../data/actionValidation';
import { KeyboardSafe } from './KeyboardSafe';

export interface ActionItemPair {
    /** The saved row this edits, so an entry edit keeps its history. */
    id?: number;
    action: string;
    motivation: string;
    /** Set makes this a practice. See `actionKindOf`. */
    cadence?: string | null;
    /** Set makes this an action with a deadline. */
    due_at?: string | null;
    /** Carried through an edit so re-saving an entry cannot un-archive. */
    archived_at?: string | null;
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
    const { colors } = useTheme();
    const { showPicker, hidePicker } = useRefPicker();
    const [isExpanded, setIsExpanded] = useState(false);
    const [tempItems, setTempItems] = useState<ActionItemPair[]>([]);
    const [refPickerMode, setRefPickerMode] = useState<RefPickerMode>(null);
    const [refQuery, setRefQuery] = useState('');
    // Single target ref — tracks which (index, field, isModal, startIndex) opened the picker.
    const refPickerTarget = useRef<RefPickerTarget | null>(null);
    // Owner token from the root picker, so this list only ever closes its own.
    const pickerToken = useRef<number | undefined>(undefined);
    const hideOwnPicker = useCallback(() => {
        if (pickerToken.current !== undefined) hidePicker(pickerToken.current);
    }, [hidePicker]);
    // A picker left open would write into these fields after they have gone.
    useEffect(() => hideOwnPicker, [hideOwnPicker]);

    // Track dynamic heights for growth
    const [, setActionHeights] = useState<{ [key: number]: number }>({});
    const [motivationHeights, setMotivationHeights] = useState<{ [key: number]: number }>({});
    const [, setActionHeightsModal] = useState<{ [key: number]: number }>({});
    const [motivationHeightsModal, setMotivationHeightsModal] = useState<{ [key: number]: number }>({});

    const actionRefs = useRef<(TextInput | null)[]>([]);
    const motivationRefs = useRef<(TextInput | null)[]>([]);

    // Stable refs so callbacks passed to showPicker don't close over stale state.
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const tempItemsRef = useRef(tempItems);
    tempItemsRef.current = tempItems;

    // The big editor's actions aren't the answer until it closes, so leaving the app hands them over.
    useEffect(() => {
        if (!isExpanded) return;
        const sub = AppState.addEventListener('change', state => {
            if (state === 'background') onChange(tempItemsRef.current);
        });
        return () => sub.remove();
    }, [isExpanded, onChange]);

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
                if (!isModal) hideOwnPicker();
                return;
            }
            const typed = typedSince(text, currentStartIndex);
            if (text.endsWith(' ')) {
                // A space finishes a real book; "@1 " may still become "1 John"; anything else is just an @.
                const ref = resolveTypedReference(typed);
                if (ref) {
                    handleReferenceSelect(ref);
                    return;
                }
                if (!couldBeBookName(typed)) {
                    handleReferenceDismiss();
                    return;
                }
            }
            const newQuery = pickerQuery(typed);
            setRefQuery(newQuery);
            if (!isModal) {
                pickerToken.current = showPicker({
                    query: newQuery,
                    onPreview: handlePreview,
                    onSelect: handleReferenceSelect,
                    onDismiss: handleReferenceDismiss,
                    onInteraction: handlePickerInteraction,
                }, pickerToken.current);
            }
            return;
        }

        const trigger = findAtTrigger(text);
        if (trigger) {
            refPickerTarget.current = { index, field, isModal, startIndex: trigger.startIndex };
            const query = pickerQuery(trigger.query);
            setRefQuery(query);
            if (isModal) {
                setRefPickerMode('local');
            } else {
                setRefPickerMode('inline');
                pickerToken.current = showPicker({
                    query,
                    onPreview: handlePreview,
                    onSelect: handleReferenceSelect,
                    onDismiss: handleReferenceDismiss,
                    onInteraction: handlePickerInteraction,
                }, pickerToken.current);
            }
        } else {
            // No trigger — only clear if this field's mode is currently active
            if (target && target.index === index && target.field === field && target.isModal === isModal) {
                refPickerTarget.current = null;
                setRefPickerMode(null);
                setRefQuery('');
                if (!isModal) hideOwnPicker();
            }
        }
    }, [showPicker, hideOwnPicker]);

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
        else { onChange(updated); hideOwnPicker(); }

        handlePickerInteraction();
    }, [onChange, hideOwnPicker]);

    const handleReferenceDismiss = useCallback(() => {
        const isModal = refPickerTarget.current?.isModal ?? false;
        refPickerTarget.current = null;
        setRefPickerMode(null);
        setRefQuery('');
        if (!isModal) hideOwnPicker();
        handlePickerInteraction();
    }, [hideOwnPicker]);

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

    // Save, X and Back all keep what was written: these are the same actions, only bigger.
    const handleSaveExpansion = () => {
        onChange(tempItems);
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

    /** Kind changes go through the same control the commitments list uses. */
    const setKindValue = (index: number, isModal: boolean, next: { cadence?: string | null; due_at?: string | null }) => {
        const list = isModal ? tempItems : items;
        const updated = list.map((entry, i) => (i === index ? { ...entry, ...next } : entry));
        if (isModal) setTempItems(updated);
        else onChange(updated);
    };

    const renderActionItemPair = (item: ActionItemPair, index: number, isModal: boolean) => {
        const hMotiv = isModal ? motivationHeightsModal[index] : motivationHeights[index];
        /* Only once something has actually been written — an untouched pair is
         * not yet incomplete, it is simply empty. */
        const needsReason = !isBlank(item) && !hasReason(item);

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
                            <Text variant="label" tone="tertiary" style={styles.fieldLabel}>action</Text>
                            {!disabled && item.action.length > 0 && (
                                <ScalePressable
                                    onPress={() => clearField(index, 'action', isModal)}
                                    hitSlop={14}
                                    accessibilityRole="button"
                                    accessibilityLabel="Clear the action"
                                >
                                    <XCircle size={16} color={colors.textTertiary} />
                                </ScalePressable>
                            )}
                        </View>
                        <TextInput
                            maxFontSizeMultiplier={MAX_FONT_SCALE}
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
                            {/*
                              * The requirement is stated on the label rather
                              * than raised as an error after the fact. Someone
                              * who sees "needed" while writing supplies it;
                              * someone told at save time has already moved on
                              * and will type anything to get past it.
                              */}
                            <Text
                                variant="label"
                                tone={needsReason ? 'accent' : 'tertiary'}
                                style={styles.fieldLabel}
                            >
                                {needsReason ? 'motivated by — needed' : 'motivated by'}
                            </Text>
                            {!disabled && item.motivation.length > 0 && (
                                <ScalePressable
                                    onPress={() => clearField(index, 'motivation', isModal)}
                                    hitSlop={14}
                                    accessibilityRole="button"
                                    accessibilityLabel="Clear the reason"
                                >
                                    <XCircle size={16} color={colors.textTertiary} />
                                </ScalePressable>
                            )}
                        </View>
                        <TextInput
                            maxFontSizeMultiplier={MAX_FONT_SCALE}
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

                <View style={styles.kindRow}>
                    <KindChips
                        value={{ cadence: item.cadence, due_at: item.due_at }}
                        onChange={next => setKindValue(index, isModal, next)}
                        disabled={disabled}
                    />
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
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Expand"
                    >
                        <Maximize size={14} color={colors.textSecondary} />
                    </ScalePressable>
                )}
            </View>

            {/* Add button */}
            {!disabled && (
                <Button
                    label="add action"
                    variant="outline"
                    onPress={() => handleAdd(false)}
                    icon={Plus}
                    style={styles.addButton}
                />
            )}

            {/* Full-screen Modal */}
            <Modal
                visible={isExpanded}
                animationType="none"
                presentationStyle="fullScreen"
                statusBarTranslucent={true}
                onRequestClose={handleSaveExpansion}
            >
                <Screen edges={['top', 'bottom', 'left', 'right']}>
                    <KeyboardSafe
                        style={fullScreenStyles.keyboardView}>
                        {/* The question page's top row, as in TextArea's expanded view. */}
                        <View style={fullScreenStyles.header}>
                            <Text variant="title" style={fullScreenStyles.label}>{label}</Text>
                            <ScalePressable
                                onPress={handleSaveExpansion}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                hitSlop={Spacing.md}
                            >
                                <X size={19} color={colors.textTertiary} strokeWidth={1.9} />
                            </ScalePressable>
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
                                icon={Plus}
                                style={[styles.addButton, { marginBottom: Spacing.xl }]}
                            />
                        </ScrollView>

                        <View style={fullScreenStyles.footer}>
                            <ThemedButton label="Done" onPress={handleSaveExpansion} block />
                        </View>

                        {/* Bible Reference Picker for Modal mode */}
                        <BibleReferencePicker
                            visible={refPickerMode === 'local'}
                            query={refQuery}
                            onPreview={handlePreview}
                            onSelect={handleReferenceSelect}
                            onDismiss={handleReferenceDismiss}
                            onInteraction={handlePickerInteraction}
                        />
                    </KeyboardSafe>
                </Screen>
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
    fieldLabel: { marginBottom: Spacing.xs },
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
        borderRadius: Spacing.borderRadius.lg,
        zIndex: 20,
    },
    /*
     * A quiet row, not a form. Small outline chips in the label size, sitting
     * under the pair rather than between the two fields — the writing is the
     * point and this only names what the writing already is.
     */
    kindRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
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
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    label: { flex: 1 },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.layout.screenPadding,
    },
    footer: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.xl - 4,
        paddingBottom: Spacing.lg,
    },
});
