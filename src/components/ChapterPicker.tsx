import { useTheme } from '@/src/theme/ThemeContext';
import React, { useEffect, useState } from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { BibleBook, getChapterNumbers } from '../data/bibleBooks';

interface ChapterRange {
    start: number;
    end?: number;
}

interface VerseRange {
    start: string;
    end: string;
}

interface ChapterPickerProps {
    selectedBook?: BibleBook;
    selectedChapters?: ChapterRange;
    onChapterSelect: (chapters: ChapterRange) => void;
    allowRange?: boolean;
    onVerseRangeChange?: (verses: VerseRange | null) => void;
}

export const ChapterPicker: React.FC<ChapterPickerProps> = ({
    selectedBook,
    selectedChapters,
    onChapterSelect,
    allowRange = true,
    onVerseRangeChange,
}) => {
    const { colors } = useTheme();
    const [dragStart, setDragStart] = useState<number | null>(null);
    const [dragCurrent, setDragCurrent] = useState<number | null>(null);
    const [readVerses, setReadVerses] = useState(false);
    const [startVerse, setStartVerse] = useState('1');
    const [endVerse, setEndVerse] = useState('');

    useEffect(() => {
        // Reset drag state when book changes
        if (selectedBook) {
            setDragStart(null);
            setDragCurrent(null);
        }
    }, [selectedBook]);

    useEffect(() => {
        // Reset verse state when chapters change
        setStartVerse('1');
        setEndVerse('');
    }, [selectedChapters]);

    useEffect(() => {
        // Notify parent of verse range changes
        if (onVerseRangeChange) {
            if (readVerses) {
                onVerseRangeChange({ start: startVerse, end: endVerse });
            } else {
                onVerseRangeChange(null);
            }
        }
    }, [readVerses, startVerse, endVerse]);

    const handleReadVersesToggle = () => {
        setReadVerses(!readVerses);
        if (!readVerses) {
            setStartVerse('1');
            setEndVerse('');
        }
    };

    const chapters = getChapterNumbers(selectedBook?.name || "Philippians");

    const handleChapterPress = (chapter: number) => {
        if (!allowRange) {
            onChapterSelect({ start: chapter });
            return;
        }

        // If no current selection, select single chapter
        if (!selectedChapters || selectedChapters.start === 0) {
            onChapterSelect({ start: chapter });
            return;
        }

        // If tapping the same single chapter, clear selection
        if (selectedChapters.start === chapter && !selectedChapters.end) {
            onChapterSelect({ start: 0 });
            return;
        }

        // If tapping within existing range, clear and select single
        if (isChapterInSelection(chapter)) {
            onChapterSelect({ start: chapter });
            return;
        }

        // If tapping outside range, extend range or create new range
        const currentStart = selectedChapters.start;
        const currentEnd = selectedChapters.end || currentStart;

        if (chapter < currentStart) {
            onChapterSelect({ start: chapter, end: currentEnd });
        } else if (chapter > currentEnd) {
            onChapterSelect({ start: currentStart, end: chapter });
        } else {
            onChapterSelect({ start: chapter });
        }
    };

    const isChapterInSelection = (chapter: number): boolean => {
        if (!selectedChapters || selectedChapters.start === 0) return false;

        const { start } = selectedChapters;
        const end = selectedChapters.end || start;

        return chapter >= start && chapter <= end;
    };

    const isChapterInDragSelection = (chapter: number): boolean => {
        if (dragStart === null || dragCurrent === null) return false;

        const start = Math.min(dragStart, dragCurrent);
        const end = Math.max(dragStart, dragCurrent);

        return chapter >= start && chapter <= end;
    };

    const getSelectionText = (): string => {
        if (!selectedChapters || selectedChapters.start === 0) return '';

        const { start, end } = selectedChapters;

        // Build verse suffix if verses are being tracked
        let verseSuffix = '';
        if (readVerses && startVerse) {
            verseSuffix = `:${startVerse}`;
            if (endVerse) {
                verseSuffix += `-${endVerse}`;
            }
        }

        if (!end || end === start) {
            return `Chapter ${start}${verseSuffix}`;
        }

        // For ranges, show verses on both ends if applicable
        if (readVerses) {
            const startVerseText = startVerse ? `:${startVerse}` : '';
            const endVerseText = endVerse ? `:${endVerse}` : '';
            return `Chapters ${start}${startVerseText}–${end}${endVerseText}`;
        }

        return `Chapters ${start}–${end}`;
    };

    const renderChapterButton = (chapter: number) => {
        const isSelected = isChapterInSelection(chapter);
        const isInDrag = isChapterInDragSelection(chapter);
        const isFirst = selectedChapters?.start === chapter && !selectedChapters?.end;
        const isRangeStart = selectedChapters?.start === chapter && selectedChapters?.end;
        const isRangeEnd = selectedChapters?.end === chapter;
        const isSingleChapterSelected = isFirst && readVerses;
        const showVerseInputsForRange = readVerses && (isRangeStart || isRangeEnd);

        return (
            <View key={chapter} style={styles.chapterButtonWrapper}>
                <TouchableOpacity
                    style={[
                        styles.chapterButton,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        (isSelected || isInDrag) && [styles.chapterButtonSelected, { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary }],
                        isFirst && [styles.chapterButtonSingle, { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary }],
                        isRangeStart && [styles.chapterButtonRangeStart, { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary }],
                        isRangeEnd && [styles.chapterButtonRangeEnd, { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary }],
                    ] as StyleProp<ViewStyle>}
                    onPress={() => handleChapterPress(chapter)}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.chapterButtonText,
                        { color: colors.text },
                        (isSelected || isInDrag) && [styles.chapterButtonTextSelected, { color: colors.buttonPrimaryText }]
                    ]}>
                        {chapter}
                    </Text>
                </TouchableOpacity>

                {/* Single chapter verse inputs */}
                {isSingleChapterSelected && (
                    <View style={styles.verseInputContainer}>
                        <TextInput
                            style={[styles.verseInput, { backgroundColor: colors.cardHover, borderColor: colors.border, color: colors.textPrimary }]}
                            value={startVerse}
                            onChangeText={setStartVerse}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor={colors.textTertiary}
                        />
                        <Text style={[styles.verseColon, { color: colors.textTertiary }]}>:</Text>
                        <TextInput
                            style={[styles.verseInput, { backgroundColor: colors.cardHover, borderColor: colors.border, color: colors.textPrimary }]}
                            value={endVerse}
                            onChangeText={setEndVerse}
                            keyboardType="numeric"
                            placeholder="—"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>
                )}

                {/* Range start verse input */}
                {isRangeStart && showVerseInputsForRange && (
                    <>
                        <Text style={[styles.verseColon, { color: colors.textTertiary }]}>:</Text>
                        <TextInput
                            style={[styles.verseInput, styles.verseInputRange, { backgroundColor: colors.cardHover, borderColor: colors.border, color: colors.textPrimary }]}
                            value={startVerse}
                            onChangeText={setStartVerse}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </>
                )}

                {/* Range end verse input */}
                {isRangeEnd && showVerseInputsForRange && (
                    <>
                        <Text style={[styles.verseColon, { color: colors.textTertiary }]}>:</Text>
                        <TextInput
                            style={[styles.verseInput, styles.verseInputRange, { backgroundColor: colors.cardHover, borderColor: colors.border, color: colors.textPrimary }]}
                            value={endVerse}
                            onChangeText={setEndVerse}
                            keyboardType="numeric"
                            placeholder="—"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.bookTitle, { color: colors.text }]}>{selectedBook?.name}</Text>
                <Text style={[styles.chapterCount, { color: colors.textTertiary }]}>
                    {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
                </Text>
            </View>

            {selectedChapters && selectedChapters.start > 0 && (
                <View style={[styles.selectionContainer, { backgroundColor: colors.cardHover, borderColor: colors.border }]}>
                    <Text style={[styles.selectionText, { color: colors.textSecondary }]}>{getSelectionText()}</Text>
                    <TouchableOpacity
                        style={[styles.clearButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                        onPress={() => onChapterSelect({ start: 0 })}
                    >
                        <Text style={[styles.clearButtonText, { color: colors.textSecondary }]}>Clear</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Text style={[styles.instructionText, { color: colors.textTertiary }]}>
                {allowRange
                    ? 'Tap for single chapter, tap again to extend range'
                    : 'Select a chapter'
                }
            </Text>

            <View style={styles.chaptersGrid}>
                {chapters.map(renderChapterButton)}
            </View>
            <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={handleReadVersesToggle}
                activeOpacity={0.7}
            >
                <View style={[
                    styles.checkbox,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    readVerses && [styles.checkboxChecked, { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary }]
                ]}>
                    {readVerses && (
                        <Text style={[styles.checkmark, { color: colors.buttonPrimaryText }]}>✓</Text>
                    )}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>I read verses</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 250,
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '400',
        letterSpacing: 0.3,
    },
    header: {
        marginBottom: 20,
    },
    bookTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    chapterCount: {
        fontSize: 13,
        fontWeight: '400',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    selectionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        marginBottom: 24,
        borderRadius: 8, // Softened from 2
        borderWidth: 1,
    },
    selectionText: {
        fontSize: 15,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    // Checkbox for verses styles
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 24,
        padding: 12,
        borderRadius: 12,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 8, // Softened from 2
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        // Colors handled in component
    },
    checkmark: {
        fontSize: 14,
        fontWeight: '600',
    },
    checkboxLabel: {
        fontSize: 15,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    clearButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20, // Pill shape
        borderWidth: 1,
    },
    clearButtonText: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    instructionText: {
        fontSize: 13,
        marginBottom: 20,
        fontWeight: '400',
        letterSpacing: 0.4,
        lineHeight: 18,
    },
    // Chapter grid and buttion styles
    chaptersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'flex-start',
    },
    chapterButtonWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 0, // Handled by gap
    },
    chapterButton: {
        width: 52,
        height: 52, // Square-ish but soft
        borderRadius: 10, // Softened from 2
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chapterButtonSelected: {
        // Colors handled in component
    },
    chapterButtonSingle: {
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    chapterButtonRangeStart: {
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        marginRight: -4, // Connect visually
        zIndex: 1,
    },
    chapterButtonRangeEnd: {
        borderTopLeftRadius: 4,
        borderBottomLeftRadius: 4,
        marginLeft: -4, // Connect visually
        zIndex: 1,
    },
    chapterButtonText: {
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    chapterButtonTextSelected: {
        fontWeight: '600',
    },
    // Verse input styles
    verseInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        gap: 4,
    },
    verseInput: {
        width: 48,
        height: 44,
        borderWidth: 1,
        paddingHorizontal: 4,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    verseInputRange: {
        marginLeft: 4,
        marginRight: 4,
    },
    verseColon: {
        fontSize: 16,
        fontWeight: '600',
        marginHorizontal: 2,
    },
});