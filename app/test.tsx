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
                summary += `–${selectedChapters.end}`;
            }
        }
        return summary;
    };

    const renderStepIndicator = () => {
        const steps = [
            { key: 'book', label: 'Book', completed: !!selectedBook },
            { key: 'chapter', label: 'Chapter', completed: !!selectedChapters },
            { key: 'reflection', label: 'Reflect', completed: !!reflectionAnswers },
            { key: 'summary', label: 'Complete', completed: currentStep === 'summary' }
        ];

        return (
            <View style={styles.stepIndicator}>
                {steps.map((step, index) => (
                    <View key={step.key} style={styles.stepContainer}>
                        <View style={[
                            styles.stepDot,
                            currentStep === step.key && styles.stepDotActive,
                            step.completed && styles.stepDotCompleted
                        ]} />
                        <Text style={[
                            styles.stepLabel,
                            currentStep === step.key && styles.stepLabelActive,
                            step.completed && styles.stepLabelCompleted
                        ]}>
                            {step.label}
                        </Text>
                        {index < steps.length - 1 && (
                            <View style={[
                                styles.stepLine,
                                step.completed && styles.stepLineCompleted
                            ]} />
                        )}
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

                        <Text style={styles.stepQuestion}>
                            What book?
                        </Text>

                        <View style={styles.contentArea}>
                            <BookPicker
                                selectedBook={selectedBook}
                                onBookSelect={handleBookSelect}
                            />
                        </View>
                    </View>
                );

            case 'chapter':
                return (
                    <View style={styles.stepContent}>

                        <Text style={styles.stepQuestion}>
                            What part did you read?
                        </Text>

                        <View style={styles.contentArea}>
                            <ChapterPicker
                                selectedBook={selectedBook}
                                selectedChapters={selectedChapters}
                                onChapterSelect={handleChapterSelect}
                                allowRange={true}
                            />
                        </View>

                        <View style={styles.navigationContainer}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => setCurrentStep('book')}
                            >
                                <Text style={styles.backButtonText}>Back</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.continueButton,
                                    (!selectedChapters || selectedChapters.start === 0) && styles.continueButtonDisabled
                                ]}
                                onPress={handleContinueToReflection}
                                disabled={!selectedChapters || selectedChapters.start === 0}
                            >
                                <Text style={styles.continueButtonText}>Continue</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'reflection':
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepDescription}>
                            Take time for quiet contemplation of today's reading.
                        </Text>

                        <View style={styles.readingCard}>
                            <Text style={styles.readingLabel}>Today's Reading</Text>
                            <Text style={styles.readingText}>{getSelectionSummary()}</Text>
                        </View>

                        <View style={styles.contentArea}>
                            <ReflectionForm
                                onAnswersChange={setReflectionAnswers}
                                onSave={handleSaveReflection}
                                disabled={false}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.subtleBackButton}
                            onPress={() => setCurrentStep('chapter')}
                        >
                            <Text style={styles.subtleBackButtonText}>← Return to chapter selection</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'summary':
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.stepTitle}>Complete</Text>
                            <View style={styles.titleUnderline} />
                        </View>

                        <Text style={styles.stepDescription}>
                            Your reflection has been preserved.
                        </Text>

                        <View style={styles.completionCard}>
                            <View style={styles.completionHeader}>
                                <View style={styles.completionDot} />
                                <Text style={styles.completionTitle}>Study Record</Text>
                            </View>
                            <View style={styles.completionDetails}>
                                <Text style={styles.completionText}>{getSelectionSummary()}</Text>
                                <Text style={styles.completionDate}>{new Date().toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}</Text>
                            </View>
                        </View>

                        <View style={styles.contentArea}>
                            <TouchableOpacity style={styles.primaryButton} onPress={handleStartOver}>
                                <Text style={styles.primaryButtonText}>Begin New Study</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* {renderStepIndicator()} */}
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
        backgroundColor: '#f7f6f3',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 48,
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
        backgroundColor: '#fefefe',
        borderBottomWidth: 1,
        borderBottomColor: '#f0ede8',
    },
    stepContainer: {
        alignItems: 'center',
        flex: 1,
        position: 'relative',
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#d6d3ce',
        marginBottom: 12,
    },
    stepDotActive: {
        backgroundColor: '#8b7355',
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    stepDotCompleted: {
        backgroundColor: '#6b5b47',
    },
    stepLabel: {
        fontSize: 12,
        fontWeight: '400',
        color: '#a39b90',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    stepLabelActive: {
        color: '#8b7355',
        fontWeight: '500',
    },
    stepLabelCompleted: {
        color: '#6b5b47',
    },
    stepLine: {
        position: 'absolute',
        top: 4,
        left: '50%',
        right: '-50%',
        height: 1,
        backgroundColor: '#e8e3dd',
        zIndex: -1,
    },
    stepLineCompleted: {
        backgroundColor: '#c4b8a8',
    },
    stepContent: {
        flex: 1,
        paddingTop: 40,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    stepTitle: {
        fontSize: 28,
        fontWeight: '300',
        color: '#3d3528',
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    titleUnderline: {
        width: 32,
        height: 1,
        backgroundColor: '#c4b8a8',
    },
    stepDescription: {
        fontSize: 17,
        fontWeight: '400',
        textAlign: 'center',
        marginBottom: 8,
        color: '#756b5e',
        lineHeight: 22,
        letterSpacing: 0.2,
    },
    stepQuestion: {
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 30,
        color: '#756b5e',
        lineHeight: 24,
        letterSpacing: 0.1,
    },
    contentArea: {
        flex: 1,
        minHeight: 200,
    },
    readingCard: {
        backgroundColor: '#faf9f7',
        padding: 24,
        marginBottom: 32,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#f0ede8',
    },
    readingLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: '#8b7355',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    readingText: {
        fontSize: 20,
        fontWeight: '300',
        color: '#3d3528',
        letterSpacing: -0.2,
    },
    navigationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 40,
        gap: 16,
    },
    backButton: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 24,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#d6d3ce',
        borderRadius: 2,
    },
    backButtonText: {
        color: '#756b5e',
        fontSize: 15,
        fontWeight: '400',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    continueButton: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 24,
        backgroundColor: '#8b7355',
        borderRadius: 2,
    },
    continueButtonDisabled: {
        backgroundColor: '#d6d3ce',
    },
    continueButtonText: {
        color: '#fefefe',
        fontSize: 15,
        fontWeight: '400',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    subtleBackButton: {
        alignItems: 'center',
        paddingVertical: 16,
        marginTop: 24,
    },
    subtleBackButtonText: {
        color: '#a39b90',
        fontSize: 13,
        fontWeight: '400',
        letterSpacing: 0.5,
    },
    completionCard: {
        backgroundColor: '#fefefe',
        padding: 32,
        marginBottom: 40,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#f0ede8',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    completionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    completionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6b5b47',
        marginRight: 12,
    },
    completionTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6b5b47',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    completionDetails: {
        paddingLeft: 18,
    },
    completionText: {
        fontSize: 18,
        fontWeight: '300',
        color: '#3d3528',
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    completionDate: {
        fontSize: 13,
        color: '#8b8075',
        fontWeight: '300',
        letterSpacing: 0.2,
    },
    primaryButton: {
        backgroundColor: '#6b5b47',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 2,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    primaryButtonText: {
        color: '#fefefe',
        fontSize: 15,
        fontWeight: '400',
        letterSpacing: 0.5,
    },
});