import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { BibleBook, getChapterNumbers } from '../data/bibleBooks';

interface ChapterRange {
    start: number;
    end?: number;
}

interface ChapterPickerProps {
    selectedBook?: BibleBook;
    selectedChapters?: ChapterRange;
    onChapterSelect: (chapters: ChapterRange) => void;
    allowRange?: boolean;
}

export const ChapterPicker: React.FC<ChapterPickerProps> = ({
    selectedBook,
    selectedChapters,
    onChapterSelect,
    allowRange = true,
}) => {
    const [dragStart, setDragStart] = useState<number | null>(null);
    const [dragCurrent, setDragCurrent] = useState<number | null>(null);

    useEffect(() => {
        // Reset drag state when book changes
        if (selectedBook) {
            setDragStart(null);
            setDragCurrent(null);
        }
    }, [selectedBook]);

    if (!selectedBook) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Select a book to view chapters</Text>
            </View>
        );
    }

    const chapters = getChapterNumbers(selectedBook.name);

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

        const start = selectedChapters.start;
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
        if (!end || end === start) {
            return `Chapter ${start}`;
        }
        return `Chapters ${start}–${end}`;
    };

    const renderChapterButton = (chapter: number) => {
        const isSelected = isChapterInSelection(chapter);
        const isInDrag = isChapterInDragSelection(chapter);
        const isFirst = selectedChapters?.start === chapter && !selectedChapters?.end;
        const isRangeStart = selectedChapters?.start === chapter && selectedChapters?.end;
        const isRangeEnd = selectedChapters?.end === chapter;

        return (
            <TouchableOpacity
                key={chapter}
                style={[
                    styles.chapterButton,
                    (isSelected || isInDrag) && styles.chapterButtonSelected,
                    isFirst && styles.chapterButtonSingle,
                    isRangeStart && styles.chapterButtonRangeStart,
                    isRangeEnd && styles.chapterButtonRangeEnd,
                ]}
                onPress={() => handleChapterPress(chapter)}
                activeOpacity={0.7}
            >
                <Text style={[
                    styles.chapterButtonText,
                    (isSelected || isInDrag) && styles.chapterButtonTextSelected
                ]}>
                    {chapter}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.bookTitle}>{selectedBook.name}</Text>
                <Text style={styles.chapterCount}>
                    {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
                </Text>
            </View>

            {selectedChapters && selectedChapters.start > 0 && (
                <View style={styles.selectionContainer}>
                    <Text style={styles.selectionText}>{getSelectionText()}</Text>
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => onChapterSelect({ start: 0 })}
                    >
                        <Text style={styles.clearButtonText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Text style={styles.instructionText}>
                {allowRange
                    ? 'Tap for single chapter, tap again to extend range'
                    : 'Select a chapter'
                }
            </Text>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.chaptersGrid}>
                    {chapters.map(renderChapterButton)}
                </View>
            </ScrollView>
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
        color: '#a39b90',
        fontWeight: '400',
        letterSpacing: 0.3,
    },
    header: {
        marginBottom: 20,
    },
    bookTitle: {
        fontSize: 18,
        fontWeight: '400',
        color: '#3d3528',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    chapterCount: {
        fontSize: 13,
        color: '#a39b90',
        fontWeight: '300',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    selectionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#faf9f7',
        padding: 12,
        marginBottom: 16,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#f0ede8',
    },
    selectionText: {
        fontSize: 14,
        color: '#6b5b47',
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    clearButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: '#fefefe',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#e8e3dd',
    },
    clearButtonText: {
        fontSize: 12,
        color: '#8b7355',
        fontWeight: '400',
        letterSpacing: 0.3,
    },
    instructionText: {
        fontSize: 12,
        color: '#a39b90',
        marginBottom: 20,
        fontWeight: '300',
        letterSpacing: 0.4,
        lineHeight: 16,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    chaptersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        // justifyContent: 'space-between',
    },
    chapterButton: {
        width: '16.66%', // ~8-9 columns
        aspectRatio: 1,
        backgroundColor: '#fefefe',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#f0ede8',
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chapterButtonSelected: {
        backgroundColor: '#8b7355',
        borderColor: '#6b5b47',
    },
    chapterButtonSingle: {
        backgroundColor: '#6b5b47',
        borderColor: '#5a4a37',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    chapterButtonRangeStart: {
        backgroundColor: '#6b5b47',
        borderColor: '#5a4a37',
    },
    chapterButtonRangeEnd: {
        backgroundColor: '#6b5b47',
        borderColor: '#5a4a37',
    },
    chapterButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#3d3528',
        letterSpacing: 0.2,
    },
    chapterButtonTextSelected: {
        color: '#fefefe',
        fontWeight: '600',
    },
});