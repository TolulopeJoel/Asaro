import React, { useEffect, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView
} from 'react-native';
import { Maximize, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { BibleReferencePicker } from './BibleReferencePicker';
import { getBibleStyledParts } from '../utils/bibleUtils';
import { useBibleRefPicker } from '../hooks/useBibleRefPicker';
import { ScalePressable } from './ScalePressable';
import { Spacing } from '../theme/spacing';
import { Screen, textStyle } from './ui';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { KEYBOARD_BEHAVIOR } from '../utils/keyboard';

/**
 * Cloth's ruled paper — a hairline every 28px, matching the mockup's
 * `repeating-linear-gradient(0deg, transparent 0 27px, #d8cab2 27px 28px)`.
 * The 28px step is the answer text's own line height, so the writing sits on
 * the rules rather than across them.
 */
function RuledPaper({ color }: { color: string }) {
    const id = 'ruled-paper';
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
                <Defs>
                    <Pattern id={id} width={28} height={28} patternUnits="userSpaceOnUse">
                        <Line x1={0} y1={27.5} x2={28} y2={27.5} stroke={color} strokeWidth={1} />
                    </Pattern>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
            </Svg>
        </View>
    );
}

const TextArea: React.FC<{
    label: string;
    value: string;
    onChange: (text: string) => void;
    placeholder?: string;
    multiline?: boolean;
    disabled?: boolean;
    isAnswered?: boolean;
    /**
     * Drop the box.
     *
     * The writing step in design/all-screens.html #entry sets the answer
     * between two hairlines on the page's own ground, not inside a card — the
     * surface people spend the most time on gets the least furniture. The
     * boxed form is still what an entry's other fields use.
     */
    bare?: boolean;
}> = ({
    label,
    value,
    onChange,
    placeholder,
    disabled = false,
    isAnswered = false,
    bare = false,
}) => {
        const { colors, style: themeStyle } = useTheme();
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
                <View style={bare ? textAreaStyles.containerBare : textAreaStyles.container}>
                    <View style={bare ? [
                        /*
                         * The writing band, per style.
                         *
                         * Colossal sets the answer between two hairlines on the
                         * page's own ground. Cloth writes on a `.cl-panel` ruled
                         * every 28px — the mockup's lined paper, which is the one
                         * place in the design where a surface is decorated for
                         * the sake of what happens on it rather than to separate
                         * two things.
                         */
                        textAreaStyles.inputContainerBare,
                        themeStyle === 'cloth'
                            ? { backgroundColor: colors.backgroundSubtle }
                            : { borderTopWidth: Spacing.border.hairline, borderBottomWidth: Spacing.border.hairline, borderColor: colors.border },
                    ] : [
                        textAreaStyles.inputContainer,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        isAnswered && { borderColor: colors.border, backgroundColor: colors.background },
                        disabled && { backgroundColor: colors.background },
                    ]}>
                        {bare && themeStyle === 'cloth' && <RuledPaper color={colors.border} />}
                        <TextInput
                            ref={regularTextInputRef}
                            inputAccessoryViewID="bible-picker"
                            style={[
                                bare ? textAreaStyles.inputBare : textAreaStyles.input,
                                textStyle(themeStyle, 'body'),
                                { color: colors.text, minHeight: bare ? 230 : 250 },
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
                                <Maximize size={14} color={colors.textSecondary} />
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
                    <StatusBar hidden={true} />
                    <Screen edges={['top', 'bottom', 'left', 'right']} style={fullScreenStyles.container}>
                        <KeyboardAvoidingView
                            style={fullScreenStyles.keyboardView}
                            behavior={KEYBOARD_BEHAVIOR}
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
                                        <X size={20} color={colors.textSecondary} />
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
                                            textStyle(themeStyle, 'body'),
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
                    </Screen>
                </Modal>
            </>
        );
    };

const textAreaStyles = StyleSheet.create({
    container: {
        marginBottom: 8,
        position: 'relative',
    },
    containerBare: {
        flex: 1,
        position: 'relative',
    },
    inputContainerBare: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    inputBare: {
        padding: Spacing.lg,
    },
    inputContainer: {
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        position: 'relative',
        paddingBottom: 4,
    },
    input: {
        padding: Spacing.xl - 4,
        paddingBottom: Spacing.xs,
    },
    answeredIndicator: {
        position: 'absolute',
        top: 12,
        right: 48,
        width: 8,
        height: 8,
        borderRadius: Spacing.borderRadius.round,
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
        width: 36, height: 36, borderRadius: Spacing.borderRadius.round,
        justifyContent: 'center', alignItems: 'center',
    },
    saveButton: {
        paddingVertical: 14,
        borderRadius: Spacing.borderRadius.lg,
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
        backgroundColor: 'transparent',
        textAlignVertical: 'top',
        paddingTop: Spacing.sm,
    },
});

export { TextArea };
