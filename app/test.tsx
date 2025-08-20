import { createJournalEntry, JournalEntryInput } from '@/src/data/database';
import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookPicker } from '../src/components/BookPicker';
import { ChapterPicker } from '../src/components/ChapterPicker';
import { ReflectionAnswers, ReflectionForm } from '../src/components/ReflectionForm';
import { BibleBook } from '../src/data/bibleBooks';

interface ChapterRange {
    start: number;
    end?: number;
}

export default function TestScreen() {
    const [selectedBook, setSelectedBook] = useState<BibleBook>();
    const [selectedChapters, setSelectedChapters] = useState<ChapterRange>();
    const [reflectionAnswers, setReflectionAnswers] = useState<ReflectionAnswers>();

    const handleBookSelect = (book: BibleBook) => {
        setSelectedBook(book);
        // Reset chapters when book changes
        setSelectedChapters(undefined);
    };

    const handleChapterSelect = (chapters: ChapterRange) => {
        setSelectedChapters(chapters);
    };

    const handleSaveReflection = async (answers: ReflectionAnswers) => {
        if (!selectedBook || !selectedChapters || selectedChapters.start === 0) {
            Alert.alert('Incomplete', 'Please select a book and chapter first.');
            return;
        }

        try {
            const entryData: JournalEntryInput = {
                dateCreated: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
                bookName: selectedBook.name,
                chapterStart: selectedChapters.start,
                chapterEnd: selectedChapters.end,
                reflections: [
                    answers.reflection1,
                    answers.reflection2,
                    answers.reflection3,
                    answers.reflection4,
                    answers.reflection5,
                ],
                notes: answers.notes,
            };

            const entryId = createJournalEntry(entryData);
            Alert.alert(
                'Success!',
                `Your reflection has been saved! Entry ID: ${entryId}`,
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error saving entry:', error);
            Alert.alert('Error', 'Failed to save your reflection. Please try again.');
        }
    };

    const getSelectionSummary = () => {
        if (!selectedBook) return 'No selection yet';

        let summary = selectedBook.name;
        if (selectedChapters && selectedChapters.start > 0) {
            summary += ` ${selectedChapters.start}`;
            if (selectedChapters.end && selectedChapters.end !== selectedChapters.start) {
                summary += `-${selectedChapters.end}`;
            }
        }
        return summary;
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Bible Study Selector Test</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Select Book</Text>
                    <BookPicker
                        selectedBook={selectedBook}
                        onBookSelect={handleBookSelect}
                        placeholder="Choose a Bible book..."
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Select Chapter(s)</Text>
                    <ChapterPicker
                        selectedBook={selectedBook}
                        selectedChapters={selectedChapters}
                        onChapterSelect={handleChapterSelect}
                        allowRange={true}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Reflection Questions</Text>
                    <ReflectionForm
                        onAnswersChange={setReflectionAnswers}
                        onSave={handleSaveReflection}
                        disabled={!selectedBook || !selectedChapters || selectedChapters.start === 0}
                    />
                </View>
                <Text style={styles.summaryTitle}>Current Selection:</Text>
                <Text style={styles.summaryText}>{getSelectionSummary()}</Text>

                {selectedBook && selectedChapters && (
                    <View style={styles.detailsContainer}>
                        <Text style={styles.detailsTitle}>Details:</Text>
                        <Text style={styles.detailsText}>Book: {selectedBook.name}</Text>
                        <Text style={styles.detailsText}>Testament: {selectedBook.testament}</Text>
                        <Text style={styles.detailsText}>Total Chapters: {selectedBook.chapters}</Text>
                        <Text style={styles.detailsText}>
                            Selected: Chapter {selectedChapters.start}
                            {selectedChapters.end && selectedChapters.end !== selectedChapters.start
                                ? ` to ${selectedChapters.end}`
                                : ''
                            }
                        </Text>
                    </View>
                )}
                {/* </View> */}
            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
        color: '#212529',
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        color: '#495057',
    },
    summarySection: {
        marginTop: 20,
        padding: 20,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#495057',
    },
    summaryText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#007bff',
        marginBottom: 16,
    },
    detailsContainer: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    detailsTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#495057',
    },
    detailsText: {
        fontSize: 14,
        color: '#6c757d',
        marginBottom: 4,
    },
});