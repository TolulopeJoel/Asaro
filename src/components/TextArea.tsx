import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    AppState,
    Modal,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Maximize, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { BibleReferencePicker } from './BibleReferencePicker';
import { ReferenceInput } from './ReferenceInput';
import { useBibleRefPicker } from '../hooks/useBibleRefPicker';
import { ScalePressable } from './ScalePressable';
import { Spacing } from '../theme/spacing';
import { Screen, Text as UIText, ThemedButton, textStyle } from './ui';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { KeyboardSafe } from './KeyboardSafe';

const RULE_STEP = 28;

/**
 * Cloth's ruled paper — a hairline every 28px, matching the mockup's
 * `repeating-linear-gradient(0deg, transparent 0 27px, #d8cab2 27px 28px)`.
 * The 28px step is the answer text's own line height, so the writing sits on
 * the rules rather than across them. `shift` moves the rules with the text as
 * the input scrolls, so the writing stays on them.
 */
function RuledPaper({ color, shift }: { color: string; shift: Animated.Value }) {
    const id = 'ruled-paper';
    return (
        <Animated.View
            style={[textAreaStyles.rules, { transform: [{ translateY: shift }] }]}
            pointerEvents="none"
        >
            <Svg width="100%" height="100%">
                <Defs>
                    <Pattern id={id} width={RULE_STEP} height={RULE_STEP} patternUnits="userSpaceOnUse">
                        <Line x1={0} y1={RULE_STEP - 0.5} x2={RULE_STEP} y2={RULE_STEP - 0.5} stroke={color} strokeWidth={1} />
                    </Pattern>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
            </Svg>
        </Animated.View>
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
        const [, setContentHeight] = useState(0);
        const regularTextInputRef = useRef<TextInput>(null);
        const expandedTextInputRef = useRef<TextInput>(null);
        const ruleShift = useRef(new Animated.Value(0)).current;
        const modalRuleShift = useRef(new Animated.Value(0)).current;

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

        // The big editor's text isn't the answer until it closes, so leaving the app hands it over.
        useEffect(() => {
            if (!isExpanded) return;
            const sub = AppState.addEventListener('change', state => {
                if (state === 'background') onChange(tempValueRef.current);
            });
            return () => sub.remove();
        }, [isExpanded, onChange]);

        const handleExpand = () => {
            if (!disabled) {
                setTempValue(value);
                setIsExpanded(true);
            }
        };

        // Save, X and Back all keep what was written: this is the same answer, only bigger.
        const handleSave = () => {
            onChange(tempValue);
            setIsExpanded(false);
            setTimeout(() => { regularTextInputRef.current?.focus(); }, 300);
        };

        return (
            <>
                {/* ── Inline compact view ── */}
                <View style={bare ? textAreaStyles.containerBare : textAreaStyles.container}>
                    <View style={bare ? [
                        /*
                         * The writing band.
                         *
                         * Cloth writes on a `.cl-panel` ruled every 28px — the
                         * mockup's lined paper, which is the one place in the
                         * design where a surface is decorated for the sake of
                         * what happens on it rather than to separate two things.
                         */
                        textAreaStyles.inputContainerBare,
                        { backgroundColor: colors.backgroundSubtle },
                    ] : [
                        textAreaStyles.inputContainer,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        isAnswered && { borderColor: colors.border, backgroundColor: colors.background },
                        disabled && { backgroundColor: colors.background },
                    ]}>
                        {bare && <RuledPaper color={colors.border} shift={ruleShift} />}
                        <ReferenceInput
                            text={value}
                            pendingFrom={inlinePicker.refStartIndex}
                            ref={regularTextInputRef}
                            inputAccessoryViewID="bible-picker"
                            style={[
                                bare ? textAreaStyles.inputBare : textAreaStyles.input,
                                textStyle(themeStyle, 'body'),
                                bare ? { color: colors.text } : { color: colors.text, minHeight: 250 },
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
                            // Bare fills its band and scrolls itself, so the cursor stays above the keyboard.
                            scrollEnabled={bare}
                            onScroll={bare
                                ? e => ruleShift.setValue(-(e.nativeEvent.contentOffset.y % RULE_STEP))
                                : undefined}
                        />
                        {isAnswered && <View style={[textAreaStyles.answeredIndicator, { backgroundColor: colors.accent }]} />}

                        {!disabled && (
                            <ScalePressable
                                style={[textAreaStyles.expandButton, { backgroundColor: colors.backgroundSubtle }]}
                                onPress={handleExpand}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel="Expand"
                            >
                                <Maximize size={14} color={colors.textSecondary} />
                            </ScalePressable>
                        )}
                    </View>
                </View>

                {/* ── Full-screen expand modal ──
                  * The question page, bigger: the same top row, ruled band
                  * and button the entry itself uses. */}
                <Modal
                    visible={isExpanded}
                    animationType="slide"
                    presentationStyle="fullScreen"
                    statusBarTranslucent={true}
                    onRequestClose={handleSave}
                >
                    <Screen edges={['top', 'bottom', 'left', 'right']}>
                        <KeyboardSafe style={fullScreenStyles.keyboardView}>
                            <View style={fullScreenStyles.header}>
                                <UIText variant="title" style={fullScreenStyles.label}>{label}</UIText>
                                <ScalePressable
                                    onPress={handleSave}
                                    accessibilityRole="button"
                                    accessibilityLabel="Close"
                                    hitSlop={Spacing.md}
                                >
                                    <X size={19} color={colors.textTertiary} strokeWidth={1.9} />
                                </ScalePressable>
                            </View>

                            <View style={[textAreaStyles.inputContainerBare, { backgroundColor: colors.backgroundSubtle }]}>
                                <RuledPaper color={colors.border} shift={modalRuleShift} />
                                <ReferenceInput
                                    text={tempValue}
                                    pendingFrom={modalPicker.refStartIndex}
                                    ref={expandedTextInputRef}
                                    style={[
                                        textAreaStyles.inputBare,
                                        textStyle(themeStyle, 'body'),
                                        { color: colors.text },
                                    ]}
                                    placeholder={placeholder || '...'}
                                    placeholderTextColor={colors.textTertiary}
                                    onChangeText={modalPicker.handleTextChange}
                                    multiline={true}
                                    textAlignVertical="top"
                                    autoFocus={true}
                                    blurOnSubmit={false}
                                    scrollEnabled={true}
                                    onScroll={e => modalRuleShift.setValue(-(e.nativeEvent.contentOffset.y % RULE_STEP))}
                                    returnKeyType="default"
                                />
                            </View>

                            <View style={fullScreenStyles.footer}>
                                <ThemedButton label="Done" onPress={handleSave} block />
                            </View>

                            <BibleReferencePicker {...modalPicker.pickerProps} />
                        </KeyboardSafe>
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
        flex: 1,
        padding: Spacing.lg,
    },
    // One rule taller than the band, so shifting up by less than a step never shows a gap.
    rules: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: -RULE_STEP,
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
    keyboardView: { flex: 1 },
    /** ReflectionForm's top row and question, in one line: what you're answering, and the way out. */
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    label: { flex: 1 },
    footer: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.xl - 4,
        paddingBottom: Spacing.lg,
    },
});

export { TextArea };
