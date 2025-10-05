import { createJournalEntry, getEntryById, JournalEntryInput, updateJournalEntry } from '@/src/data/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BookPicker } from '../src/components/BookPicker';
import { ChapterPicker } from '../src/components/ChapterPicker';
import { ReflectionAnswers, ReflectionForm } from '../src/components/ReflectionForm';
import { BibleBook, getBookByName } from '../src/data/bibleBooks';

interface ChapterRange {
    start: number;
    end?: number;
}

interface DraftData {
    selectedBook?: BibleBook;
    selectedChapters?: ChapterRange;
    reflectionAnswers?: ReflectionAnswers;
}

type Step = 'book' | 'chapter' | 'reflection' | 'summary';

export function useAutoSave(reflectionAnswers: any, selectedBook: any, selectedChapters: any, currentStep: Step, isEditMode: boolean) {
    const lastSaveTime = useRef<number>(0);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isEditMode || currentStep !== 'reflection') {
            return;
        }

        const saveDraft = async () => {
            try {
                const draftData: DraftData = {
                    selectedBook,
                    selectedChapters,
                    reflectionAnswers,
                };
                await AsyncStorage.setItem(
                    "reflection_draft",
                    JSON.stringify(draftData)
                );
                lastSaveTime.current = Date.now();
            } catch (e) {
                console.error("Failed to save draft:", e);
            }
        };

        // Only save if there's meaningful data
        if (!selectedBook && !reflectionAnswers) {
            return;
        }

        // save draft every 20 seconds
        const now = Date.now();
        const timeSinceLastSave = now - lastSaveTime.current;
        if (timeSinceLastSave >= 20000) {
            saveDraft();
            return;
        }

        // save as draft if user stop typing after 0.8 seconds
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            saveDraft();
        }, 800); // 0.8s debounce

        // ---- CLEANUP ----
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [reflectionAnswers]);
}

export default function MeditationSessionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Check if we're in edit mode (editing existing saved entry)
    const isEditMode = !!params.entryId;
    const entryId = params.entryId ? Number(params.entryId) : undefined;

    const [currentStep, setCurrentStep] = useState<Step>('book');
    const [selectedBook, setSelectedBook] = useState<BibleBook>();
    const [selectedChapters, setSelectedChapters] = useState<ChapterRange>();
    const [reflectionAnswers, setReflectionAnswers] = useState<ReflectionAnswers>();
    const [isLoading, setIsLoading] = useState(true);

    // Load existing entry data OR draft on mount
    useEffect(() => {
        const loadData = async () => {
            if (isEditMode && entryId) {
                // Load existing saved entry for editing
                try {
                    const entry = await getEntryById(entryId);

                    if (!entry) {
                        Alert.alert('Error', 'Entry not found');
                        router.back();
                        return;
                    }
                    // For now, showing structure:
                    const book = getBookByName(entry.book_name);
                    setSelectedBook(book);
                    setSelectedChapters({
                        start: entry.chapter_start,
                        end: entry.chapter_end
                    });
                    setReflectionAnswers({
                        reflection1: entry.reflection_1 || "",
                        reflection2: entry.reflection_2 || "",
                        reflection3: entry.reflection_3 || "",
                        reflection4: entry.reflection_4 || "",
                        notes: entry.notes || ""
                    });
                    setCurrentStep('reflection');

                    setIsLoading(false);
                } catch (error) {
                    console.error('Error loading entry:', error);
                    Alert.alert('Error', 'Failed to load entry');
                    router.back();
                }
            } else {
                // Check for draft (continuing unfinished entry)
                try {
                    const draftJson = await AsyncStorage.getItem("reflection_draft");
                    if (draftJson) {
                        const draft: DraftData = JSON.parse(draftJson);
                        // Restore draft state
                        if (draft.selectedBook) {
                            setSelectedBook(draft.selectedBook);
                        }
                        if (draft.selectedChapters) {
                            setSelectedChapters(draft.selectedChapters);
                        }
                        if (draft.reflectionAnswers) {
                            setReflectionAnswers(draft.reflectionAnswers);
                        }
                        setCurrentStep('reflection');
                    }
                } catch (error) {
                    console.error('Error loading draft:', error);
                }
                setIsLoading(false);
            }
        };

        loadData();
    }, [isEditMode, entryId]);

    // Auto-save drafts (disabled in edit mode and summary screen)
    useAutoSave(reflectionAnswers, selectedBook, selectedChapters, currentStep, isEditMode);

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
                ],
                notes: answers.notes,
            };

            if (isEditMode && entryId) {
                // Update existing saved entry
                await updateJournalEntry(entryId, entryData);
                Alert.alert('Success', 'Entry updated successfully');
                router.back(); // Go back to previous screen
            } else {
                await createJournalEntry(entryData);
                await AsyncStorage.removeItem("reflection_draft");
                setReflectionAnswers(answers);
                setCurrentStep('summary');
            }
        } catch (error) {
            console.error('Error saving entry:', error);
            Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'save'} your entry. Please try again.`);
        }
    };

    const handleStartOver = async () => {
        if (isEditMode) {
            router.back();
        } else {
            await AsyncStorage.removeItem("reflection_draft");
            setSelectedBook(undefined);
            setSelectedChapters(undefined);
            setReflectionAnswers(undefined);
            setCurrentStep('book');
        }
    };

    const handleDiscardDraft = async () => {
        Alert.alert(
            'Discard Draft?',
            'Are you sure you want to discard your draft and start fresh?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.removeItem("reflection_draft");
                        setSelectedBook(undefined);
                        setSelectedChapters(undefined);
                        setReflectionAnswers(undefined);
                        setCurrentStep('book');
                    },
                },
            ]
        );
    };

    const getSelectionSummary = () => {
        if (!selectedBook) {
            return 'No selection yet';
        }
        let summary = selectedBook.name;
        if (selectedChapters && selectedChapters.start > 0) {
            summary += ` ${selectedChapters.start}`;
            if (selectedChapters.end && selectedChapters.end !== selectedChapters.start) {
                summary += `–${selectedChapters.end}`;
            }
        }
        return summary;
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

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

                        {/* Show discard draft option if we have draft data */}
                        {!isEditMode && (selectedBook || reflectionAnswers) && (
                            <TouchableOpacity
                                style={styles.discardButton}
                                onPress={handleDiscardDraft}
                            >
                                <Text style={styles.discardButtonText}>Discard draft & start fresh</Text>
                            </TouchableOpacity>
                        )}
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
                            {isEditMode
                                ? 'Edit your reflection below:'
                                : 'A good way to get the most out of your Bible reading is to consider one or more of the following questions as you read:'
                            }
                        </Text>

                        <View style={styles.readingCard}>
                            <Text style={styles.readingLabel}>
                                {isEditMode ? 'Editing Entry' : 'Today\'s Reading'}
                            </Text>
                            <Text style={styles.readingText}>{getSelectionSummary()}</Text>
                        </View>

                        <View style={styles.contentArea}>
                            <ReflectionForm
                                initialAnswers={reflectionAnswers}
                                onAnswersChange={setReflectionAnswers}
                                onSave={handleSaveReflection}
                                disabled={false}
                                saveButtonText={isEditMode ? 'Update Entry' : 'Save Entry'}
                            />
                        </View>

                        {!isEditMode && (
                            <TouchableOpacity
                                style={styles.subtleBackButton}
                                onPress={() => setCurrentStep('chapter')}
                            >
                                <Text style={styles.subtleBackButtonText}>← Return to chapter selection</Text>
                            </TouchableOpacity>
                        )}

                        {isEditMode && (
                            <TouchableOpacity
                                style={styles.subtleBackButton}
                                onPress={() => router.back()}
                            >
                                <Text style={styles.subtleBackButtonText}>← Cancel editing</Text>
                            </TouchableOpacity>
                        )}
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
                            Your session has been preserved.
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
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {renderCurrentStep()}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f7f6f3',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#756b5e',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 48,
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
    discardButton: {
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 24,
    },
    discardButtonText: {
        color: '#d4876f',
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.3,
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