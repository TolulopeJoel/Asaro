import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ScalePressable } from './ScalePressable';
import { BookPicker } from './BookPicker';
import { ChapterPicker } from './ChapterPicker';
import { MarkdownRenderer } from './MarkdownRenderer';
import { BibleBook } from '../data/bibleBooks';

const TOPIC_COLORS = ['#E18F43', '#2C3E50', '#27AE60', '#2980B9', '#8E44AD', '#C0392B'];

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
    const [isPreview, setIsPreview] = useState(false);
    const [isReferenceModalVisible, setIsReferenceModalVisible] = useState(false);
    const [selectedBook, setSelectedBook] = useState<BibleBook>();
    const [selectedChapters, setSelectedChapters] = useState<{ start: number; end?: number }>({ start: 0 });
    const [verseRange, setVerseRange] = useState<{ start: string; end: string } | null>(null);
    const inputRef = useRef<TextInput>(null);

    const insertText = (textToInsert: string) => {
        // Simple insertion at the end for now, could be improved with selection state
        onContentChange(content + textToInsert);
    };

    const handleAddReference = () => {
        if (!selectedBook || selectedChapters.start === 0) return;

        let ref = `${selectedBook.name} ${selectedChapters.start}`;
        if (selectedChapters.end && selectedChapters.end !== selectedChapters.start) {
            ref += `-${selectedChapters.end}`;
        }
        if (verseRange?.start) {
            ref += `:${verseRange.start}`;
            if (verseRange.end) ref += `-${verseRange.end}`;
        }

        insertText(` [[${ref}]] `);
        setIsReferenceModalVisible(false);
        setSelectedBook(undefined);
        setSelectedChapters({ start: 0 });
        setVerseRange(null);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <ScalePressable onPress={onCancel} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                </ScalePressable>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                    {isPreview ? 'Preview' : 'Edit Topic'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <ScalePressable onPress={() => setIsPreview(!isPreview)} style={styles.headerButton}>
                        <Ionicons name={isPreview ? "create-outline" : "eye-outline"} size={22} color={colors.accent} />
                    </ScalePressable>
                    <ScalePressable onPress={onSave} style={[styles.saveButton, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.saveButtonText, { color: colors.buttonPrimaryText }]}>Save</Text>
                    </ScalePressable>
                </View>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                <TextInput
                    style={[styles.titleInput, { color: colors.textPrimary }]}
                    placeholder="Topic Title"
                    placeholderTextColor={colors.textTertiary}
                    value={title}
                    onChangeText={onTitleChange}
                    multiline={false}
                    editable={!isPreview}
                />

                <View style={styles.colorRow}>
                    {TOPIC_COLORS.map((c) => (
                        <ScalePressable
                            key={c}
                            onPress={() => !isPreview && onColorChange(c)}
                            style={[
                                styles.colorCircle,
                                { backgroundColor: c },
                                color === c && { borderColor: colors.textPrimary, borderWidth: 2 },
                                isPreview && { opacity: color === c ? 1 : 0.3 }
                            ]}
                            disabled={isPreview}
                        />
                    ))}
                </View>

                {isPreview ? (
                    <MarkdownRenderer content={content} />
                ) : (
                    <TextInput
                        ref={inputRef}
                        style={[styles.textArea, { color: colors.textPrimary }]}
                        placeholder="Start your research here..."
                        placeholderTextColor={colors.textTertiary}
                        value={content}
                        onChangeText={onContentChange}
                        multiline={true}
                        textAlignVertical="top"
                    />
                )}
            </ScrollView>

            {!isPreview && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <View style={[styles.toolbar, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
                        <ToolbarButton icon="header" onPress={() => insertText('\n# ')} />
                        <ToolbarButton icon="text" onPress={() => insertText('\n## ')} />
                        <ToolbarButton icon="link" onPress={() => insertText('[Link Title](https://)')} />
                        <ToolbarButton icon="book" onPress={() => setIsReferenceModalVisible(true)} highlight />
                    </View>
                </KeyboardAvoidingView>
            )}

            {/* Reference Picker Modal */}
            <Modal
                visible={isReferenceModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsReferenceModalVisible(false)}
            >
                <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                    <View style={styles.modalHeader}>
                        <ScalePressable onPress={() => setIsReferenceModalVisible(false)}>
                            <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                        </ScalePressable>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Insert Reference</Text>
                        <ScalePressable onPress={handleAddReference}>
                            <Text style={[styles.modalAddText, { color: colors.accent }]}>Insert</Text>
                        </ScalePressable>
                    </View>

                    <ScrollView style={{ flex: 1 }}>
                        {!selectedBook ? (
                            <BookPicker onBookSelect={setSelectedBook} />
                        ) : (
                            <View style={{ padding: 20 }}>
                                <ChapterPicker
                                    selectedBook={selectedBook}
                                    selectedChapters={selectedChapters}
                                    onChapterSelect={setSelectedChapters}
                                    onVerseRangeChange={setVerseRange}
                                />
                                <ScalePressable
                                    style={styles.changeBookButton}
                                    onPress={() => setSelectedBook(undefined)}
                                >
                                    <Text style={{ color: colors.textTertiary }}>Change Book</Text>
                                </ScalePressable>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

const ToolbarButton = ({ icon, onPress, highlight }: { icon: any; onPress: () => void; highlight?: boolean }) => {
    const { colors } = useTheme();
    return (
        <ScalePressable
            onPress={onPress}
            style={[styles.toolbarButton, highlight && { backgroundColor: colors.accent + '20' }]}
        >
            <Ionicons
                name={icon === 'header' ? 'text-outline' : icon === 'text' ? 'text' : icon === 'link' ? 'link-outline' : 'book-outline'}
                size={20}
                color={highlight ? colors.accent : colors.textSecondary}
            />
        </ScalePressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 8,
    },
    headerButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    titleInput: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 16,
    },
    colorRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    colorCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    textArea: {
        fontSize: 16,
        lineHeight: 24,
        minHeight: 400,
        paddingBottom: 100,
    },
    toolbar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        gap: 16,
    },
    toolbarButton: {
        padding: 10,
        borderRadius: 10,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    modalAddText: {
        fontWeight: '600',
    },
    changeBookButton: {
        marginTop: 20,
        alignItems: 'center',
    },
});
