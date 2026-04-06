import React, { useEffect, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BibleReferencePicker } from './BibleReferencePicker';

const TextArea: React.FC<{
    label: string;
    value: string;
    onChange: (text: string) => void;
    placeholder?: string;
    multiline?: boolean;
    disabled?: boolean;
    isAnswered?: boolean;
}> = ({
    label,
    value,
    onChange,
    placeholder,
    disabled = false,
    isAnswered = false,
}) => {
        const { colors, isDark } = useTheme();
        const [isExpanded, setIsExpanded] = useState(false);
        const [tempValue, setTempValue] = useState('');
        const [showRefPicker, setShowRefPicker] = useState(false);
        const [refQuery, setRefQuery] = useState('');
        const [showRefPickerModal, setShowRefPickerModal] = useState(false);
        const [refQueryModal, setRefQueryModal] = useState('');
        const [contentHeight, setContentHeight] = useState(0);
        const [contentHeightModal, setContentHeightModal] = useState(0);
        const regularTextInputRef = useRef<TextInput>(null);
        const expandedTextInputRef = useRef<TextInput>(null);

        // Tracks the character index of the '@' that opened the picker.
        // While this is set (>= 0), the picker stays open and onPreview
        // replaces text from this index forward.
        const [refStartIndex, setRefStartIndex] = useState(-1);
        const [refStartIndexModal, setRefStartIndexModal] = useState(-1);

        useEffect(() => {
            if (isExpanded) {
                setTempValue(value);
            }
        }, [isExpanded, value]);

        const handleExpand = () => {
            if (!disabled) {
                setTempValue(value);
                setIsExpanded(true);
            }
        };

        const handleSave = () => {
            onChange(tempValue);
            setIsExpanded(false);
            setTimeout(() => { regularTextInputRef.current?.focus(); }, 300);
        };

        const handleCancel = () => {
            setIsExpanded(false);
            setTimeout(() => { regularTextInputRef.current?.focus(); }, 300);
        };

        // ─── @ trigger ────────────────────────────────────────────────────────────

        const handleInlineChange = (text: string) => {
            onChange(text);

            // If we're already building a reference, only close picker if user
            // deleted back past the @ position.
            if (refStartIndex >= 0) {
                if (text.length <= refStartIndex) {
                    setShowRefPicker(false);
                    setRefStartIndex(-1);
                    setRefQuery('');
                } else if (text.endsWith(' ')) {
                    // Finalize on space
                    const partialRef = text.slice(refStartIndex).trim();
                    handleReferenceSelect(partialRef);
                }
                return;
            }

            // Detect a fresh @ trigger at end of text
            const match = text.match(/@(\w[\w\s]*)$/);
            if (match) {
                setRefQuery(match[1]);
                setRefStartIndex(text.length - match[0].length);
                setShowRefPicker(true);
            } else {
                setShowRefPicker(false);
            }
        };

        const handleModalInputChange = (text: string) => {
            setTempValue(text);

            if (refStartIndexModal >= 0) {
                if (text.length <= refStartIndexModal) {
                    setShowRefPickerModal(false);
                    setRefStartIndexModal(-1);
                    setRefQueryModal('');
                } else if (text.endsWith(' ')) {
                    // Finalize on space
                    const partialRef = text.slice(refStartIndexModal).trim();
                    handleReferenceSelectModal(partialRef);
                }
                return;
            }

            const match = text.match(/@(\w[\w\s]*)$/);
            if (match) {
                setRefQueryModal(match[1]);
                setRefStartIndexModal(text.length - match[0].length);
                setShowRefPickerModal(true);
            } else {
                setShowRefPickerModal(false);
            }
        };

        // ─── Preview (live, keeps picker open) ───────────────────────────────────

        /**
         * Called on every step by BibleReferencePicker.
         * Replaces text from the @ position onward with the partial ref,
         * so the user sees the reference being built live in the TextInput.
         */
        const handlePreview = (partialRef: string) => {
            if (refStartIndex < 0) return;
            const updated = value.slice(0, refStartIndex) + partialRef;
            onChange(updated);
            regularTextInputRef.current?.focus();
        };

        const handlePreviewModal = (partialRef: string) => {
            if (refStartIndexModal < 0) return;
            setTempValue(tempValue.slice(0, refStartIndexModal) + partialRef);
            expandedTextInputRef.current?.focus();
        };

        // ─── Select (final — closes picker) ──────────────────────────────────────

        const handleReferenceSelect = (ref: string) => {
            const insertAt = refStartIndex >= 0 ? refStartIndex : value.lastIndexOf('@');
            const updated = value.slice(0, insertAt >= 0 ? insertAt : 0) + ref;
            onChange(updated);
            setShowRefPicker(false);
            setRefQuery('');
            setRefStartIndex(-1);
            setTimeout(() => regularTextInputRef.current?.focus(), 50);
        };

        const handleReferenceSelectModal = (ref: string) => {
            const insertAt = refStartIndexModal >= 0 ? refStartIndexModal : tempValue.lastIndexOf('@');
            setTempValue(tempValue.slice(0, insertAt >= 0 ? insertAt : 0) + ref);
            setShowRefPickerModal(false);
            setRefQueryModal('');
            setRefStartIndexModal(-1);
            setTimeout(() => expandedTextInputRef.current?.focus(), 50);
        };

        const handlePickerInteraction = (isModal: boolean) => {
            setTimeout(() => {
                if (isModal) expandedTextInputRef.current?.focus();
                else regularTextInputRef.current?.focus();
            }, 50);
        };

        return (
            <>
                {/* ── Inline compact view ── */}
                <View style={textAreaStyles.container}>
                    <View style={[
                        textAreaStyles.inputContainer,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        isAnswered && { borderColor: colors.border, backgroundColor: colors.background },
                        disabled && { backgroundColor: colors.background },
                    ]}>
                        <TextInput
                            ref={regularTextInputRef}
                            style={[
                                textAreaStyles.input,
                                { color: colors.text, minHeight: Math.max(100, contentHeight) },
                                disabled && { color: colors.textSecondary },
                            ]}
                            placeholder={placeholder}
                            placeholderTextColor={colors.textTertiary}
                            value={value}
                            onChangeText={handleInlineChange}
                            onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
                            multiline={true}
                            numberOfLines={5}
                            textAlignVertical="top"
                            editable={!disabled}
                            scrollEnabled={false}
                        />
                        {isAnswered && <View style={[textAreaStyles.answeredIndicator, { backgroundColor: colors.primary }]} />}

                        {!disabled && (
                            <TouchableOpacity
                                style={[textAreaStyles.expandButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                                onPress={handleExpand}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                activeOpacity={0.7}
                            >
                                <View style={textAreaStyles.expandIcon}>
                                    <View style={[textAreaStyles.expandIconInner, { borderColor: colors.textSecondary }]} />
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>

                    <BibleReferencePicker
                        visible={showRefPicker}
                        query={refQuery}
                        onPreview={handlePreview}
                        onSelect={handleReferenceSelect}
                        onDismiss={() => {
                            setShowRefPicker(false);
                            setRefQuery('');
                            setRefStartIndex(-1);
                        }}
                        onInteraction={() => handlePickerInteraction(false)}
                    />
                </View>

                {/* ── Full-screen expand modal ── */}
                <Modal
                    visible={isExpanded}
                    animationType="slide"
                    presentationStyle="fullScreen"
                    statusBarTranslucent={true}
                >
                    <StatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />
                    <SafeAreaView style={[fullScreenStyles.container, { backgroundColor: colors.background }]}>
                        <KeyboardAvoidingView
                            style={fullScreenStyles.keyboardView}
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        >
                            <View style={fullScreenStyles.content}>
                                <TouchableOpacity
                                    style={fullScreenStyles.cancelButton}
                                    onPress={handleCancel}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                >
                                    <Text style={[fullScreenStyles.cancelText, { color: colors.textTertiary }]}>Don&apos;t Save</Text>
                                </TouchableOpacity>

                                {label && (
                                    <View style={fullScreenStyles.labelContainer}>
                                        <Text style={[fullScreenStyles.label, { color: colors.textSecondary }]}>{label}</Text>
                                    </View>
                                )}

                                <ScrollView
                                    style={{ flex: 1 }}
                                    keyboardShouldPersistTaps="always"
                                    showsVerticalScrollIndicator={false}
                                >
                                    <TextInput
                                        ref={expandedTextInputRef}
                                        style={[
                                            fullScreenStyles.textInput,
                                            { color: colors.text, minHeight: Math.max(100, contentHeightModal) }
                                        ]}
                                        placeholder={placeholder || "..."}
                                        placeholderTextColor={colors.textTertiary}
                                        value={tempValue}
                                        onChangeText={handleModalInputChange}
                                        onContentSizeChange={(e) => setContentHeightModal(e.nativeEvent.contentSize.height)}
                                        multiline={true}
                                        textAlignVertical="top"
                                        autoFocus={true}
                                        blurOnSubmit={false}
                                        scrollEnabled={false}
                                        returnKeyType="default"
                                    />
                                </ScrollView>

                                <TouchableOpacity
                                    style={fullScreenStyles.saveButton}
                                    onPress={handleSave}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                >
                                    <Text style={[fullScreenStyles.saveText, { color: colors.textSecondary }]}>Save</Text>
                                </TouchableOpacity>
                            </View>

                            <BibleReferencePicker
                                visible={showRefPickerModal}
                                query={refQueryModal}
                                onPreview={handlePreviewModal}
                                onSelect={handleReferenceSelectModal}
                                onDismiss={() => {
                                    setShowRefPickerModal(false);
                                    setRefQueryModal('');
                                    setRefStartIndexModal(-1);
                                }}
                                onInteraction={() => handlePickerInteraction(true)}
                            />
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </Modal>
            </>
        );
    };

const textAreaStyles = StyleSheet.create({
    container: {
        marginBottom: 8,
        position: 'relative',
    },
    inputContainer: {
        borderRadius: 10,
        borderWidth: 1,
        position: 'relative',
        paddingBottom: 4,
    },
    input: {
        padding: 20,
        paddingBottom: 4,
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
        letterSpacing: 0.1,
    },
    answeredIndicator: {
        position: 'absolute',
        top: 12,
        right: 48,
        width: 8,
        height: 8,
        borderRadius: 4,
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
});

const fullScreenStyles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: (StatusBar.currentHeight || 2),
    },
    keyboardView: {
        flex: 1,
        position: 'relative',
    },
    labelContainer: {
        paddingTop: 20,
        paddingBottom: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    cancelButton: {},
    cancelText: {
        fontSize: 15,
        fontWeight: '400',
        letterSpacing: 0.1,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    saveButton: {
        alignSelf: 'flex-end',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    saveText: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    textInput: {
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 28,
        letterSpacing: 0.1,
        backgroundColor: 'transparent',
        textAlignVertical: 'top',
        paddingTop: 8,
    },
});

export { TextArea };
