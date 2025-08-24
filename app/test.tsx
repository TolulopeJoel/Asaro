import { createJournalEntry, JournalEntryInput } from '@/src/data/database';
import React, { useState } from 'react';
import { Alert, Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BookPicker } from '../src/components/BookPicker';
import { ChapterPicker } from '../src/components/ChapterPicker';
import { ReflectionAnswers, ReflectionForm } from '../src/components/ReflectionForm';
import { BibleBook } from '../src/data/bibleBooks';

interface ChapterRange {
    start: number;
    end?: number;
}

type Step = 'book' | 'chapter' | 'reflection' | 'summary';

const { height: screenHeight } = Dimensions.get('window');

export default function TestScreen() {
    const [currentStep, setCurrentStep] = useState<Step>('book');
    const [selectedBook, setSelectedBook] = useState<BibleBook>();
    const [selectedChapters, setSelectedChapters] = useState<ChapterRange>();
    const [reflectionAnswers, setReflectionAnswers] = useState<ReflectionAnswers>();

    const handleBookSelect = (book: BibleBook) => {
        setSelectedBook(book);
        setSelectedChapters(undefined);
        setCurrentStep('chapter');
    };

    const handleChapterSelect = (chapters: ChapterRange) => {
        setSelectedChapters(chapters);
    };

    const handleContinueToReflection = () => {
        if (!selectedChapters || selectedChapters.start === 0) {
            Alert.alert('Please select a chapter', 'You need to select at least one chapter to continue.');
            return;
        }
        setCurrentStep('reflection');
    };

    const handleSaveReflection = async (answers: ReflectionAnswers) => {
        if (!selectedBook || !selectedChapters || selectedChapters.start === 0) {
            Alert.alert('Incomplete', 'Please select a book and chapter first.');
            return;
        }

        try {
            const entryData: JournalEntryInput = {
                dateCreated: new Date().toISOString().split('T')[0],
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
            setReflectionAnswers(answers);
            setCurrentStep('summary');
            
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

    const handleStartOver = () => {
        setSelectedBook(undefined);
        setSelectedChapters(undefined);
        setReflectionAnswers(undefined);
        setCurrentStep('book');
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

    const renderStepIndicator = () => {
        const steps = [
            { key: 'book', label: '1. Book', completed: !!selectedBook },
            { key: 'chapter', label: '2. Chapter', completed: !!selectedChapters },
            { key: 'reflection', label: '3. Reflect', completed: !!reflectionAnswers },
            { key: 'summary', label: '4. Done', completed: currentStep === 'summary' }
        ];

        return (
            <View style={styles.stepIndicator}>
                {steps.map((step, index) => (
                    <View key={step.key} style={styles.stepContainer}>
                        <View style={[
                            styles.stepCircle,
                            currentStep === step.key && styles.stepCircleActive,
                            step.completed && styles.stepCircleCompleted
                        ]}>
                            <Text style={[
                                styles.stepNumber,
                                (currentStep === step.key || step.completed) && styles.stepNumberActive
                            ]}>
                                {index + 1}
                            </Text>
                        </View>
                        <Text style={[
                            styles.stepLabel,
                            currentStep === step.key && styles.stepLabelActive
                        ]}>
                            {step.label}
                        </Text>
                        {index < steps.length - 1 && <View style={styles.stepLine} />}
                    </View>
                ))}
            </View>
        );
    };

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'book':
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Choose a Bible Book</Text>
                        <Text style={styles.stepDescription}>
                            Select which book of the Bible you'd like to study today.
                        </Text>
                        <BookPicker
                            selectedBook={selectedBook}
                            onBookSelect={handleBookSelect}
                            placeholder="Choose a Bible book..."
                        />
                    </View>
                );

            case 'chapter':
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Select Chapter(s)</Text>
                        <Text style={styles.stepDescription}>
                            Choose the chapter(s) from {selectedBook?.name} you want to reflect on.
                        </Text>
                        
                        <View style={styles.bookSummary}>
                            <Text style={styles.bookSummaryText}>
                                📖 {selectedBook?.name} ({selectedBook?.chapters} chapters)
                            </Text>
                        </View>

                        <ChapterPicker
                            selectedBook={selectedBook}
                            selectedChapters={selectedChapters}
                            onChapterSelect={handleChapterSelect}
                            allowRange={true}
                        />

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity 
                                style={styles.backButton} 
                                onPress={() => setCurrentStep('book')}
                            >
                                <Text style={styles.backButtonText}>← Back</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={[
                                    styles.nextButton,
                                    (!selectedChapters || selectedChapters.start === 0) && styles.nextButtonDisabled
                                ]} 
                                onPress={handleContinueToReflection}
                                disabled={!selectedChapters || selectedChapters.start === 0}
                            >
                                <Text style={styles.nextButtonText}>Continue →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'reflection':
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Reflection Time</Text>
                        <Text style={styles.stepDescription}>
                            Take time to reflect on {getSelectionSummary()}.
                        </Text>

                        <View style={styles.readingSummary}>
                            <Text style={styles.readingSummaryTitle}>Today's Reading:</Text>
                            <Text style={styles.readingSummaryText}>{getSelectionSummary()}</Text>
                        </View>

                        <ReflectionForm
                            onAnswersChange={setReflectionAnswers}
                            onSave={handleSaveReflection}
                            disabled={false}
                        />

                        <TouchableOpacity 
                            style={styles.backButton} 
                            onPress={() => setCurrentStep('chapter')}
                        >
                            <Text style={styles.backButtonText}>← Back to Chapter Selection</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'summary':
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>🎉 Reflection Complete!</Text>
                        <Text style={styles.stepDescription}>
                            Your reflection has been saved successfully.
                        </Text>

                        <View style={styles.completionSummary}>
                            <Text style={styles.completionTitle}>Study Summary</Text>
                            <Text style={styles.completionText}>📖 {getSelectionSummary()}</Text>
                            <Text style={styles.completionText}>📅 {new Date().toLocaleDateString()}</Text>
                            <Text style={styles.completionText}>✍️ Reflection saved</Text>
                        </View>

                        <TouchableOpacity style={styles.primaryButton} onPress={handleStartOver}>
                            <Text style={styles.primaryButtonText}>Start New Study</Text>
                        </TouchableOpacity>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {renderStepIndicator()}
            <ScrollView 
                style={styles.scrollView} 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {renderCurrentStep()}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    stepContainer: {
        alignItems: 'center',
        flex: 1,
        position: 'relative',
    },
    stepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e9ecef',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    stepCircleActive: {
        backgroundColor: '#007bff',
    },
    stepCircleCompleted: {
        backgroundColor: '#28a745',
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6c757d',
    },
    stepNumberActive: {
        color: '#ffffff',
    },
    stepLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6c757d',
        textAlign: 'center',
    },
    stepLabelActive: {
        color: '#007bff',
        fontWeight: '600',
    },
    stepLine: {
        position: 'absolute',
        top: 16,
        left: '50%',
        right: '-50%',
        height: 2,
        backgroundColor: '#e9ecef',
        zIndex: -1,
    },
    stepContent: {
        flex: 1,
        paddingTop: 20,
    },
    stepTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
        color: '#212529',
    },
    stepDescription: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        color: '#6c757d',
        lineHeight: 24,
    },
    bookSummary: {
        backgroundColor: '#e7f3ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#007bff',
    },
    bookSummaryText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#0056b3',
    },
    readingSummary: {
        backgroundColor: '#fff3cd',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
    },
    readingSummaryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#856404',
        marginBottom: 4,
    },
    readingSummaryText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#856404',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
    },
    backButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#6c757d',
        borderRadius: 8,
        flex: 1,
        marginRight: 10,
    },
    backButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    nextButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#007bff',
        borderRadius: 8,
        flex: 1,
        marginLeft: 10,
    },
    nextButtonDisabled: {
        backgroundColor: '#adb5bd',
    },
    nextButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    completionSummary: {
        backgroundColor: '#d4edda',
        padding: 20,
        borderRadius: 12,
        marginBottom: 30,
        borderLeftWidth: 4,
        borderLeftColor: '#28a745',
    },
    completionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#155724',
        marginBottom: 12,
    },
    completionText: {
        fontSize: 14,
        color: '#155724',
        marginBottom: 4,
    },
    primaryButton: {
        backgroundColor: '#007bff',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
});