import React, { useEffect, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BibleReferencePicker } from './BibleReferencePicker';
import { getBibleStyledParts } from '../utils/bibleUtils';
import { useBibleRefPicker } from '../hooks/useBibleRefPicker';
import { ScalePressable } from './ScalePressable';

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
        const [contentHeight, setContentHeight] = useState(0);
        const [contentHeightModal, setContentHeightModal] = useState(0);
        const regularTextInputRef = useRef<TextInput>(null);
        const expandedTextInputRef = useRef<TextInput>(null);

        // Inline (non-expanded) picker — uses the root RefPickerContext.
        const inlinePicker = useBibleRefPicker({
            getValue: () => value,
            setValue: onChange,
            getInputRef: () => regularTextInputRef.current,
            mode: 'context',
        });

        // Modal (expanded) picker — drives a local <BibleReferencePicker> inside the Modal.
        const tempValueRef = useRef(tempValue);
        tempValueRef.current = tempValue;
        const modalPicker = useBibleRefPicker({
            getValue: () => tempValueRef.current,
            setValue: setTempValue,
            getInputRef: () => expandedTextInputRef.current,
            mode: 'local',
        });

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
                            inputAccessoryViewID="bible-picker"
                            style={[
                                textAreaStyles.input,
                                { color: colors.text, minHeight: Math.max(250) },
                                disabled && { color: colors.textSecondary },
                            ]}
                            placeholder={placeholder}
                            placeholderTextColor={colors.textTertiary}
                            onChangeText={inlinePicker.handleTextChange}
                            onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
                            multiline={true}
                            numberOfLines={5}
                            textAlignVertical="top"
                            editable={!disabled}
                            scrollEnabled={false}
                        >
                            {getBibleStyledParts(value).map((part, index) => (
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
                        {isAnswered && <View style={[textAreaStyles.answeredIndicator, { backgroundColor: colors.accent }]} />}

                        {!disabled && (
                            <ScalePressable
                                style={[textAreaStyles.expandButton, { backgroundColor: colors.backgroundSubtle }]}
                                onPress={handleExpand}
                            >
                                <Ionicons name="square-outline" size={16} color={colors.textSecondary} />
                            </ScalePressable>
                        )}
                    </View>
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
                            {/* ── Header ── */}
                            <View style={[fullScreenStyles.header, { borderBottomColor: colors.border }]}>
                                <View style={fullScreenStyles.headerLeft}>
                                    {label && (
                                        <Text style={[fullScreenStyles.label, { color: colors.textSecondary }]}>{label}</Text>
                                    )}
                                </View>

                                <View style={fullScreenStyles.headerRight}>
                                    <ScalePressable
                                        onPress={handleCancel}
                                        style={[fullScreenStyles.iconBtn, { backgroundColor: colors.backgroundSubtle }]}
                                    >
                                        <Ionicons name="close" size={20} color={colors.textSecondary} />
                                    </ScalePressable>
                                </View>
                            </View>

                            <View style={fullScreenStyles.content}>

                                <ScrollView
                                    style={{ flex: 1 }}
                                    keyboardShouldPersistTaps="always"
                                    showsVerticalScrollIndicator={false}
                                >
                                    <TextInput
                                        ref={expandedTextInputRef}
                                        style={[
                                            fullScreenStyles.textInput,
                                            { color: colors.text, minHeight: Math.max(220, contentHeightModal) }
                                        ]}
                                        placeholder={placeholder || "..."}
                                        placeholderTextColor={colors.textTertiary}
                                        onChangeText={modalPicker.handleTextChange}
                                        onContentSizeChange={(e) => setContentHeightModal(e.nativeEvent.contentSize.height)}
                                        multiline={true}
                                        textAlignVertical="top"
                                        autoFocus={true}
                                        blurOnSubmit={false}
                                        scrollEnabled={false}
                                        returnKeyType="default"
                                    >
                                        {getBibleStyledParts(tempValue).map((part, index) => (
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
                                </ScrollView>

                                <ScalePressable
                                    style={[fullScreenStyles.saveButton, { backgroundColor: colors.accent }]}
                                    onPress={handleSave}
                                >
                                    <Text style={[fullScreenStyles.saveText, { color: colors.buttonPrimaryText }]}>Save</Text>
                                </ScalePressable>
                            </View>

                            <BibleReferencePicker {...modalPicker.pickerProps} />
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
        top: 10,
        right: 10,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
});

const fullScreenStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        position: 'relative',
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
    saveButton: {
        paddingVertical: 14,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
        marginTop: 8,
    },
    saveText: {
        fontSize: 16,
        fontWeight: '700',
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
        gap: 8,
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
