import React, { useState, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import {
    Palette,
    Type,
    Check,
    X,
    Minus,
    List,
    Code,
    LucideIcon
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { ScalePressable } from './ScalePressable';

const TOPIC_COLORS = ['#E18F43', '#27AE60', '#2980B9', '#8E44AD', '#C0392B', '#2C3E50'];

interface StudyEditorProps {
    title: string;
    content: string;
    color: string;
    onTitleChange: (text: string) => void;
    onContentChange: (text: string) => void;
    onColorChange: (color: string) => void;
    onSave: () => void;
    onCancel: () => void;
}

export const StudyEditor: React.FC<StudyEditorProps> = ({
    title,
    content,
    color,
    onTitleChange,
    onContentChange,
    onColorChange,
    onSave,
    onCancel,
}) => {
    const { colors } = useTheme();
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showFormatting, setShowFormatting] = useState(false);
    const contentRef = useRef<TextInput>(null);
    const selectionRef = useRef({ start: 0, end: 0 });

    const isSaveable = title.trim().length > 0;

    const applyFormat = (prefix: string, suffix: string = '', isLineStart: boolean = false) => {
        const { start, end } = selectionRef.current;
        const selectedText = content.slice(start, end);

        let textToInsert = '';
        if (selectedText.length > 0) {
            // If text is selected, wrap it
            textToInsert = `${prefix}${selectedText}${suffix}`;
        } else {
            // If no selection, insert default placeholder or prefix
            textToInsert = isLineStart ? `\n${prefix}` : `${prefix}${suffix}`;
        }

        const newContent = content.slice(0, start) + textToInsert + content.slice(end);
        onContentChange(newContent);

        // Adjust selection
        const newPos = start + textToInsert.length;
        setTimeout(() => {
            contentRef.current?.setNativeProps({ selection: { start: newPos, end: newPos } });
        }, 0);
        contentRef.current?.focus();
    };

    return (
        <View style={styles.container}>

            {/* ── Header ── */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={styles.headerLeft}>
                    <ScalePressable
                        onPress={() => { setShowColorPicker(p => !p); setShowFormatting(false); }}
                        style={[styles.colorDot, { backgroundColor: color }]}
                    >
                        <Palette size={14} color="rgba(255,255,255,0.9)" />
                    </ScalePressable>
                </View>

                <View style={styles.headerRight}>
                    <ScalePressable
                        onPress={() => { setShowFormatting(p => !p); setShowColorPicker(false); }}
                        style={[styles.iconBtn, { backgroundColor: showFormatting ? colors.accent + '20' : colors.backgroundSubtle }]}
                    >
                        <Type size={18} color={showFormatting ? colors.accent : colors.textSecondary} />
                    </ScalePressable>

                    <ScalePressable
                        onPress={onSave}
                        disabled={!isSaveable}
                        style={[styles.saveButton, {
                            backgroundColor: isSaveable ? colors.accent : colors.backgroundSubtle,
                            shadowColor: isSaveable ? colors.accent : 'transparent',
                        }]}
                    >
                        <Check
                            size={15}
                            color={isSaveable ? colors.buttonPrimaryText : colors.textTertiary}
                        />
                        <Text style={[styles.saveButtonText, {
                            color: isSaveable ? colors.buttonPrimaryText : colors.textTertiary,
                        }]}>
                            Save
                        </Text>
                    </ScalePressable>

                    <ScalePressable
                        onPress={onCancel}
                        style={[styles.cancelButton, { borderColor: colors.border }]}
                    >
                        <X size={15} color={colors.textSecondary} />
                        <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                            Cancel
                        </Text>
                    </ScalePressable>
                </View>
            </View>

            {/* ── Tool Strip (Color Pick OR Formatting tools) ── */}
            {(showColorPicker || showFormatting) && (
                <View style={[styles.toolStrip, {
                    backgroundColor: colors.backgroundSubtle,
                    borderBottomColor: colors.border,
                }]}>
                    {showColorPicker && (
                        <View style={styles.swatchRow}>
                            {TOPIC_COLORS.map((c) => (
                                <ScalePressable
                                    key={c}
                                    onPress={() => { onColorChange(c); setShowColorPicker(false); }}
                                    style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
                                >
                                    {color === c && <Check size={12} color="#fff" />}
                                </ScalePressable>
                            ))}
                        </View>
                    )}

                    {showFormatting && (
                        <View style={styles.formatRow}>
                            <ToolbarButton icon={Type} label="H1" onPress={() => applyFormat('# ', '', true)} colors={colors} />
                            <ToolbarButton icon={Type} label="H2" onPress={() => applyFormat('## ', '', true)} colors={colors} />
                            <ToolbarButton icon={Minus} label="Divider" onPress={() => applyFormat('\n---\n')} colors={colors} />
                            <ToolbarButton icon={List} label="List" onPress={() => applyFormat('- ', '', true)} colors={colors} />
                            <ToolbarButton icon={Code} label="Bold" onPress={() => applyFormat('**', '**')} colors={colors} />
                        </View>
                    )}
                </View>
            )}

            {/* ── Body ── */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <TextInput
                        style={[styles.titleInput, { color: colors.textPrimary }]}
                        placeholder="Topic title..."
                        placeholderTextColor={colors.textTertiary}
                        value={title}
                        onChangeText={onTitleChange}
                        multiline={false}
                        returnKeyType="next"
                        onSubmitEditing={() => contentRef.current?.focus()}
                    />

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <TextInput
                        ref={contentRef}
                        style={[styles.textArea, { color: colors.textPrimary }]}
                        placeholder="Start your research here..."
                        placeholderTextColor={colors.textTertiary}
                        value={content}
                        onChangeText={onContentChange}
                        onSelectionChange={(e) => {
                            selectionRef.current = e.nativeEvent.selection;
                        }}
                        multiline={true}
                        textAlignVertical="top"
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const ToolbarButton = ({
    icon, label, onPress, colors,
}: {
    icon: LucideIcon; label: string; onPress: () => void; colors: any;
}) => (
    <ScalePressable onPress={onPress} style={styles.toolbarButton}>
        {React.createElement(icon, { size: 18, color: colors.textSecondary })}
        <Text style={[styles.toolbarLabel, { color: colors.textTertiary }]}>{label}</Text>
    </ScalePressable>
);

const styles = StyleSheet.create({
    container: { flex: 1 },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    colorDot: {
        width: 28, height: 28, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2, shadowRadius: 3, elevation: 2,
    },
    saveButton: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    },
    saveButtonText: { fontSize: 14, fontWeight: '700' },
    cancelButton: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
        borderWidth: 1.5,
    },
    cancelButtonText: { fontSize: 14, fontWeight: '600' },

    toolStrip: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingVertical: 8,
    },
    swatchRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: Spacing.layout.screenPadding,
    },
    formatRow: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: Spacing.layout.screenPadding,
    },
    swatch: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    swatchSelected: {
        transform: [{ scale: 1.2 }],
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
    },

    scrollArea: { flex: 1 },
    scrollContent: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: 18,
        paddingBottom: 40,
    },
    titleInput: {
        fontSize: 26, fontWeight: '800', letterSpacing: -0.8,
        lineHeight: 32, marginBottom: 14,
    },
    divider: { height: StyleSheet.hairlineWidth, marginBottom: 14 },
    textArea: {
        fontSize: 16, lineHeight: 26, minHeight: 400, paddingBottom: 60,
    },

    toolbarButton: {
        flex: 1, alignItems: 'center', gap: 2,
        paddingVertical: 5, borderRadius: 10,
    },
    toolbarLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
});
