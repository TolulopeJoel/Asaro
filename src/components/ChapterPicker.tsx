import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
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
    const [selectionMode, setSelectionMode] = useState<'single' | 'range'>('single');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    useEffect(() => {
        // Reset selection when book changes
        if (selectedBook) {
            setCustomStart('');
            setCustomEnd('');
            setShowCustomInput(false);
        }
    }, [selectedBook]);

    if (!selectedBook) {
        return (
            <View style={styles.disabledContainer}>
                <Text style={styles.disabledText}>Select a book first</Text>
            </View>
        );
    }

    const chapters = getChapterNumbers(selectedBook.name);
    const totalChapters = chapters.length;

    const handleChapterPress = (chapter: number) => {
        if (selectionMode === 'single') {
            onChapterSelect({ start: chapter });
        } else {
            // Range mode - if no start selected, set start; if start exists, set end
            if (!selectedChapters?.start) {
                onChapterSelect({ start: chapter });
            } else if (!selectedChapters?.end) {
                if (chapter >= selectedChapters.start) {
                    onChapterSelect({ start: selectedChapters.start, end: chapter });
                } else {
                    onChapterSelect({ start: chapter, end: selectedChapters.start });
                }
            } else {
                // Reset and start new selection
                onChapterSelect({ start: chapter });
            }
        }
    };

    const handleCustomRange = () => {
        const start = parseInt(customStart);
        const end = parseInt(customEnd);

        if (!customStart || isNaN(start) || start < 1 || start > totalChapters) {
            Alert.alert('Invalid Input', `Start chapter must be between 1 and ${totalChapters}`);
            return;
        }

        if (customEnd && (isNaN(end) || end < start || end > totalChapters)) {
            Alert.alert('Invalid Input', `End chapter must be between ${start} and ${totalChapters}`);
            return;
        }

        onChapterSelect({
            start,
            end: customEnd ? end : undefined
        });

        setShowCustomInput(false);
    };

    const isChapterSelected = (chapter: number): boolean => {
        if (!selectedChapters) return false;

        if (!selectedChapters.end) {
            return chapter === selectedChapters.start;
        }

        return chapter >= selectedChapters.start && chapter <= selectedChapters.end;
    };

    const renderSelectionModeToggle = () => {
        if (!allowRange) return null;

        return (
            <View style={styles.modeToggle}>
                <TouchableOpacity
                    style={[
                        styles.modeButton,
                        selectionMode === 'single' && styles.modeButtonActive
                    ]}
                    onPress={() => setSelectionMode('single')}
                >
                    <Text style={[
                        styles.modeButtonText,
                        selectionMode === 'single' && styles.modeButtonTextActive
                    ]}>
                        Single Chapter
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.modeButton,
                        selectionMode === 'range' && styles.modeButtonActive
                    ]}
                    onPress={() => setSelectionMode('range')}
                >
                    <Text style={[
                        styles.modeButtonText,
                        selectionMode === 'range' && styles.modeButtonTextActive
                    ]}>
                        Chapter Range
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderSelectionSummary = () => {
        if (!selectedChapters) return null;

        const { start, end } = selectedChapters;
        let text = `${selectedBook.name} ${start}`;
        if (end && end !== start) {
            text += `-${end}`;
        }

        return (
            <View style={styles.summaryContainer}>
                <Text style={styles.summaryText}>Selected: {text}</Text>
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => onChapterSelect({ start: 0 })}
                >
                    <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderCustomInput = () => {
        if (!showCustomInput) {
            return (
                <TouchableOpacity
                    style={styles.customInputToggle}
                    onPress={() => setShowCustomInput(true)}
                >
                    <Text style={styles.customInputToggleText}>Enter custom range</Text>
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.customInputContainer}>
                <View style={styles.customInputRow}>
                    <TextInput
                        style={styles.customInput}
                        placeholder="Start"
                        value={customStart}
                        onChangeText={setCustomStart}
                        keyboardType="numeric"
                        maxLength={3}
                    />
                    {allowRange && (
                        <>
                            <Text style={styles.customInputSeparator}>to</Text>
                            <TextInput
                                style={styles.customInput}
                                placeholder="End (optional)"
                                value={customEnd}
                                onChangeText={setCustomEnd}
                                keyboardType="numeric"
                                maxLength={3}
                            />
                        </>
                    )}
                </View>
                <View style={styles.customInputActions}>
                    <TouchableOpacity
                        style={[styles.customActionButton, styles.customCancelButton]}
                        onPress={() => {
                            setShowCustomInput(false);
                            setCustomStart('');
                            setCustomEnd('');
                        }}
                    >
                        <Text style={styles.customCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.customActionButton, styles.customApplyButton]}
                        onPress={handleCustomRange}
                    >
                        <Text style={styles.customApplyButtonText}>Apply</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                Select Chapter{allowRange ? '(s)' : ''} - {selectedBook.name}
            </Text>

            {renderSelectionModeToggle()}
            {renderSelectionSummary()}
            {renderCustomInput()}

            <ScrollView style={styles.chaptersContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.chaptersGrid}>
                    {chapters.map((chapter) => (
                        <TouchableOpacity
                            key={chapter}
                            style={[
                                styles.chapterButton,
                                isChapterSelected(chapter) && styles.chapterButtonSelected
                            ]}
                            onPress={() => handleChapterPress(chapter)}
                        >
                            <Text style={[
                                styles.chapterButtonText,
                                isChapterSelected(chapter) && styles.chapterButtonTextSelected
                            ]}>
                                {chapter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    disabledContainer: {
        paddingVertical: 32,
        alignItems: 'center',
    },
    disabledText: {
        fontSize: 16,
        color: '#6c757d',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#212529',
        marginBottom: 16,
    },
    modeToggle: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 4,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    modeButtonActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    modeButtonText: {
        fontSize: 14,
        color: '#6c757d',
        fontWeight: '500',
    },
    modeButtonTextActive: {
        color: '#007bff',
    },
    summaryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#e7f3ff',
        borderRadius: 8,
        marginBottom: 16,
    },
    summaryText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#0056b3',
    },
    clearButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#ffffff',
        borderRadius: 4,
    },
    clearButtonText: {
        fontSize: 14,
        color: '#0056b3',
        fontWeight: '500',
    },
    customInputToggle: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 16,
    },
    customInputToggleText: {
        fontSize: 14,
        color: '#007bff',
        textDecorationLine: 'underline',
    },
    customInputContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    customInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    customInput: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#ffffff',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#dee2e6',
        fontSize: 16,
        textAlign: 'center',
    },
    customInputSeparator: {
        paddingHorizontal: 12,
        fontSize: 16,
        color: '#6c757d',
    },
    customInputActions: {
        flexDirection: 'row',
        gap: 8,
    },
    customActionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
    },
    customCancelButton: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    customCancelButtonText: {
        fontSize: 14,
        color: '#6c757d',
        fontWeight: '500',
    },
    customApplyButton: {
        backgroundColor: '#007bff',
    },
    customApplyButtonText: {
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '500',
    },
    chaptersContainer: {
        maxHeight: 300,
    },
    chaptersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chapterButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    chapterButtonSelected: {
        backgroundColor: '#007bff',
        borderColor: '#007bff',
    },
    chapterButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#6c757d',
    },
    chapterButtonTextSelected: {
        color: '#ffffff',
    },
});