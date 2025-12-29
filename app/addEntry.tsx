import { createJournalEntry, getEntryById, JournalEntryInput, updateJournalEntry } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, LayoutAnimation, Platform, SafeAreaView, ScrollView, StyleSheet, Text, UIManager, View, useWindowDimensions } from 'react-native';
import { BookPicker } from '../src/components/BookPicker';
import { ChapterPicker } from '../src/components/ChapterPicker';
import { ReflectionAnswers, ReflectionForm } from '../src/components/ReflectionForm';
import { ScalePressable } from '../src/components/ScalePressable';
import { BibleBook, getBookByName } from '../src/data/bibleBooks';
import { setupDailyNotifications, cancelRemainingNotificationsForToday, addNotificationsForNewDay } from '../src/utils/notifications';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface ChapterRange {
    start: number;
    end?: number;
}

interface VerseRange {
    start: string;
    end: string;
}

interface DraftData {
    selectedBook?: BibleBook;
    selectedChapters?: ChapterRange;
    verseRange?: VerseRange | null;
    reflectionAnswers?: ReflectionAnswers;
}

type Step = 'book' | 'chapter' | 'reflection' | 'summary';

export function useAutoSave(reflectionAnswers: any, selectedBook: any, selectedChapters: any, verseRange: any, currentStep: Step, isEditMode: boolean) {
    const lastSaveTime = useRef<number>(0);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (isEditMode || currentStep !== 'reflection') {
            return;
        }

        const saveDraft = async () => {
            if (!isMountedRef.current) {
                return;
            }

            try {
                const draftData: DraftData = {
                    selectedBook,
                    selectedChapters,
                    verseRange,
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
        }, 800);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [reflectionAnswers, verseRange]);
}

export default function MeditationSessionScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();

    const isEditMode = !!params.entryId;
    const entryId = params.entryId ? Number(params.entryId) : undefined;

    const [currentStep, setCurrentStep] = useState<Step>('book');
    const [selectedBook, setSelectedBook] = useState<BibleBook>();
    const [selectedChapters, setSelectedChapters] = useState<ChapterRange>();
    const [verseRange, setVerseRange] = useState<VerseRange | null>(null);
    const [reflectionAnswers, setReflectionAnswers] = useState<ReflectionAnswers>();
    const [isLoading, setIsLoading] = useState(true);
    const [createdEntryId, setCreatedEntryId] = useState<number | null>(null);

    // Load data immediately without waiting
    useEffect(() => {
        const loadData = async () => {
            try {
                if (isEditMode && entryId) {
                    const entry = await getEntryById(entryId);
                    if (!entry) {
                        Alert.alert('Error', 'Entry not found');
                        router.back();
                        return;
                    }

                    const book = getBookByName(entry.book_name);
                    setSelectedBook(book);
                    setSelectedChapters({
                        start: entry.chapter_start,
                        end: entry.chapter_end
                    });

                    // Load verse range if it exists
                    if (entry.verse_start || entry.verse_end) {
                        setVerseRange({
                            start: entry.verse_start?.toString() || '',
                            end: entry.verse_end?.toString() || ''
                        });
                    }

                    setReflectionAnswers({
                        reflection1: entry.reflection_1 || "",
                        reflection2: entry.reflection_2 || "",
                        reflection3: entry.reflection_3 || "",
                        reflection4: entry.reflection_4 || "",
                        notes: entry.notes || ""
                    });
                    setCurrentStep('reflection');
                } else {
                    const draftJson = await AsyncStorage.getItem("reflection_draft");
                    if (draftJson) {
                        const draft: DraftData = JSON.parse(draftJson);
                        if (draft.selectedBook) {
                            setSelectedBook(draft.selectedBook);
                        }
                        if (draft.selectedChapters) {
                            setSelectedChapters(draft.selectedChapters);
                        }
                        if (draft.verseRange) {
                            setVerseRange(draft.verseRange);
                        }
                        if (draft.reflectionAnswers) {
                            setReflectionAnswers(draft.reflectionAnswers);
                        }
                        setCurrentStep('reflection');
                    }
                }
            } catch (error) {
                console.error('Error loading draft:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    useAutoSave(reflectionAnswers, selectedBook, selectedChapters, verseRange, currentStep, isEditMode);

    const scrollViewRef = useRef<ScrollView>(null);
    const { width: screenWidth } = useWindowDimensions();

    const steps: Step[] = ['book', 'chapter', 'reflection', 'summary'];

    const scrollToStep = (step: Step) => {
        const index = steps.indexOf(step);
        if (index !== -1 && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ x: index * screenWidth, animated: true });
            setCurrentStep(step);
        }
    };

    // Sync scroll with currentStep on mount/update (e.g. when loading draft)
    useEffect(() => {
        const index = steps.indexOf(currentStep);
        if (index !== -1 && scrollViewRef.current) {
            // Use a small timeout to ensure layout is ready
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: false });
            }, 100);
        }
    }, [isLoading]); // Only run when loading finishes to set initial position

    const changeStep = (step: Step) => {
        scrollToStep(step);
    };

    const handleBookSelect = useCallback((book: BibleBook) => {
        setSelectedBook(book);
        setSelectedChapters(undefined);
        setVerseRange(null);
        changeStep('chapter');
    }, []);

    const handleChapterSelect = useCallback((chapters: ChapterRange) => {
        setSelectedChapters(chapters);
    }, []);

    const handleVerseRangeChange = useCallback((verses: VerseRange | null) => {
        setVerseRange(verses);
    }, []);

    const handleContinueToReflection = useCallback(() => {
        if (!selectedChapters || selectedChapters.start === 0) {
            Alert.alert('Please select a chapter', 'You need to select at least one chapter to continue.');
            return;
        }
        changeStep('reflection');
    }, [selectedChapters]);

    const handleSaveReflection = useCallback(async (answers: ReflectionAnswers) => {
        if (!selectedBook || !selectedChapters || selectedChapters.start === 0) {
            Alert.alert('Incomplete', 'Please select a book and chapter first.');
            return;
        }

        try {
            const entryData: JournalEntryInput = {
                bookName: selectedBook.name,
                chapterStart: selectedChapters.start,
                chapterEnd: selectedChapters.end,
                verseStart: verseRange?.start || undefined,
                verseEnd: verseRange?.end || undefined,
                reflections: [
                    answers.reflection1,
                    answers.reflection2,
                    answers.reflection3,
                    answers.reflection4,
                ],
                notes: answers.notes,
            };

            if (isEditMode && entryId) {
                await updateJournalEntry(entryId, entryData);
                // Cancel remaining notifications for today
                await cancelRemainingNotificationsForToday();
                // Add notifications for a new day to the stack
                await addNotificationsForNewDay();
                // Ensure we have notifications for the next 7 days
                await setupDailyNotifications();
                Alert.alert('Success', 'Entry updated successfully');
                router.back();
            } else {
                const newEntryId = await createJournalEntry(entryData);
                setCreatedEntryId(newEntryId);
                await AsyncStorage.removeItem("reflection_draft");
                // Cancel remaining notifications for today
                await cancelRemainingNotificationsForToday();
                // Add notifications for a new day to the stack
                await addNotificationsForNewDay();
                // Ensure we have notifications for the next 7 days
                await setupDailyNotifications();
                setReflectionAnswers(answers);
                changeStep('summary');
            }
        } catch (error) {
            console.error('Error saving entry:', error);
            Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'save'} your entry. Please try again.`);
        }
    }, [selectedBook, selectedChapters, verseRange, isEditMode, entryId, router]);

    const handleDone = useCallback(() => {
        if (createdEntryId) {
            router.push(`/entry/${createdEntryId}`);
        } else {
            router.back();
        }
    }, [router, createdEntryId]);

    const handleStartOver = useCallback(async () => {
        await AsyncStorage.removeItem("reflection_draft");
        setSelectedBook(undefined);
        setSelectedChapters(undefined);
        setVerseRange(null);
        setReflectionAnswers(undefined);
        changeStep('book');
    }, []);

    const handleDiscardDraft = useCallback(() => {
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
                        setVerseRange(null);
                        setReflectionAnswers(undefined);
                        router.push({ pathname: '/' })
                    },
                },
            ]
        );
    }, []);

    const selectionSummary = useMemo(() => {
        if (!selectedBook) {
            return 'No selection yet';
        }

        let summary = selectedBook.name;
        if (selectedChapters && selectedChapters.start > 0) {
            summary += ` ${selectedChapters.start}`;
            if (selectedChapters.end && selectedChapters.end !== selectedChapters.start) {
                summary += `–${selectedChapters.end}`;
            }

            // Add verse range if present
            if (verseRange) {
                if (selectedChapters.end && selectedChapters.end !== selectedChapters.start) {
                    // Range of chapters with verses
                    const startVerse = verseRange.start ? `:${verseRange.start}` : '';
                    const endVerse = verseRange.end ? `:${verseRange.end}` : '';
                    if (startVerse || endVerse) {
                        summary = `${selectedBook.name} ${selectedChapters.start}${startVerse}–${selectedChapters.end}${endVerse}`;
                    }
                }
                else if (verseRange.start) {
                    summary += `:${verseRange.start}`;
                    if (verseRange.end) {
                        summary += `-${verseRange.end}`;
                    }
                }
            }
        }
        return summary;
    }, [selectedBook, selectedChapters, verseRange]);

    if (isLoading && isEditMode) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderBookStep = () => (
        <View style={[styles.stepContainer, { width: screenWidth }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.stepContent}>
                    <Text style={[styles.stepQuestion, { color: colors.textSecondary }]}>
                        What book?
                    </Text>

                    <View style={styles.contentArea}>
                        <BookPicker
                            selectedBook={selectedBook}
                            onBookSelect={handleBookSelect}
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    const renderChapterStep = () => (
        <View style={[styles.stepContainer, { width: screenWidth }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.stepContent}>
                    <Text style={[styles.stepQuestion, { color: colors.textSecondary }]}>
                        What part did you read?
                    </Text>

                    <View style={styles.contentArea}>
                        <ChapterPicker
                            selectedBook={selectedBook}
                            selectedChapters={selectedChapters}
                            onChapterSelect={handleChapterSelect}
                            onVerseRangeChange={handleVerseRangeChange}
                            allowRange={true}
                        />
                    </View>

                    <View style={styles.navigationContainer}>
                        <ScalePressable
                            style={[styles.backButton, { borderColor: colors.border }]}
                            onPress={() => changeStep('book')}
                        >
                            <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Back</Text>
                        </ScalePressable>

                        <ScalePressable
                            style={[
                                styles.continueButton,
                                { backgroundColor: colors.accent },
                                (!selectedChapters || selectedChapters.start === 0) && styles.continueButtonDisabled
                            ]}
                            onPress={handleContinueToReflection}
                            disabled={!selectedChapters || selectedChapters.start === 0}
                        >
                            <Text style={[styles.continueButtonText, { color: colors.buttonPrimaryText }]}>Continue</Text>
                        </ScalePressable>
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    const renderReflectionStep = () => (
        <View style={[styles.stepContainer, { width: screenWidth }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.stepContent}>
                    {!isEditMode &&
                        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                            A good way to get the most out of your Bible reading is to consider one or more of the following questions as you read:
                        </Text>
                    }

                    <View style={styles.contentArea}>
                        <ReflectionForm
                            initialAnswers={reflectionAnswers}
                            onAnswersChange={setReflectionAnswers}
                            onSave={handleSaveReflection}
                            disabled={false}
                            saveButtonText={isEditMode ? 'Update It' : 'Save It'}
                        />
                    </View>

                    <ScalePressable
                        style={styles.subtleBackButton}
                        onPress={() => changeStep('chapter')}
                    >
                        <Text style={[styles.subtleBackButtonText, { color: colors.textTertiary }]}>← Return to chapter selection</Text>
                    </ScalePressable>

                    {!isEditMode && (reflectionAnswers) && (
                        <ScalePressable
                            style={styles.discardButton}
                            onPress={handleDiscardDraft}
                        >
                            <Text style={[styles.discardButtonText, { color: colors.textSecondary }]}>Discard Draft</Text>
                        </ScalePressable>
                    )}

                </View>
            </ScrollView>
        </View>
    );

    const renderSummaryStep = () => (
        <View style={[styles.stepContainer, { width: screenWidth }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.stepContent}>
                    <View style={styles.titleContainer}>
                        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Complete</Text>
                        <View style={[styles.titleUnderline, { backgroundColor: colors.border }]} />
                    </View>

                    <View style={[styles.completionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.completionHeader}>
                            <View style={[styles.completionDot, { backgroundColor: colors.accent }]} />
                            <Text style={[styles.completionTitle, { color: colors.accent }]}>Study Record</Text>
                        </View>
                        <View style={styles.completionDetails}>
                            <Text style={[styles.completionText, { color: colors.textPrimary }]}>{selectionSummary}</Text>
                            <Text style={[styles.completionDate, { color: colors.textSecondary }]}>{new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</Text>
                        </View>
                    </View>

                    <View style={styles.contentArea}>
                        <ScalePressable style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={handleDone}>
                            <Text style={[styles.primaryButtonText, { color: colors.buttonPrimaryText }]}>Done</Text>
                        </ScalePressable>

                        <ScalePressable
                            style={styles.secondaryButton}
                            onPress={handleStartOver}
                        >
                            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>New Entry</Text>
                        </ScalePressable>
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    pagingEnabled
                    scrollEnabled={false}
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={{ flex: 1 }}
                >
                    {renderBookStep()}
                    {renderChapterStep()}
                    {renderReflectionStep()}
                    {renderSummaryStep()}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    stepContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        letterSpacing: Typography.letterSpacing.wide,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingBottom: Spacing.xxxl,
    },
    stepContent: {
        flex: 1,
        paddingTop: 40,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    stepTitle: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.tight,
        marginBottom: Spacing.sm,
    },
    titleUnderline: {
        width: 40,
        height: 2,
        borderRadius: 1,
    },
    stepDescription: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.regular,
        textAlign: 'center',
        marginBottom: Spacing.md,
        lineHeight: Typography.lineHeight.xl,
        letterSpacing: Typography.letterSpacing.wide,
    },
    stepQuestion: {
        fontSize: 28, // Keeping large for impact
        fontWeight: Typography.weight.semibold,
        marginBottom: Spacing.xxl,
        lineHeight: 34,
        letterSpacing: Typography.letterSpacing.tight,
    },
    contentArea: {
        flex: 1,
        minHeight: 200,
    },
    readingLabel: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.wider,
        textTransform: 'uppercase',
        marginBottom: Spacing.sm,
    },
    navigationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 40,
        gap: Spacing.lg,
    },
    backButton: {
        flex: 1,
        paddingVertical: Spacing.layout.cardPadding,
        paddingHorizontal: Spacing.layout.screenPadding,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.lg,
    },
    backButtonText: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.medium,
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    continueButton: {
        flex: 1,
        paddingVertical: Spacing.layout.cardPadding,
        paddingHorizontal: Spacing.layout.screenPadding,
        borderRadius: Spacing.borderRadius.lg,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    continueButtonDisabled: {
        shadowOpacity: 0,
        display: 'none',
    },
    continueButtonText: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    subtleBackButton: {
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        marginTop: Spacing.layout.screenPadding,
    },
    subtleBackButtonText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        letterSpacing: Typography.letterSpacing.wide,
    },
    discardButton: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
        marginTop: Spacing.layout.screenPadding,
    },
    discardButtonText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        letterSpacing: 0.3,
    },
    completionCard: {
        padding: Spacing.xxl,
        marginBottom: 40,
        borderRadius: Spacing.borderRadius.xl,
        borderWidth: 1,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 12,
    },
    completionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    completionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: Spacing.md,
    },
    completionTitle: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.semibold,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    completionDetails: {
        paddingLeft: 20,
    },
    completionText: {
        fontSize: Typography.size.xl,
        fontWeight: Typography.weight.regular,
        marginBottom: Spacing.xs,
        letterSpacing: -0.2,
    },
    completionDate: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.regular,
        letterSpacing: Typography.letterSpacing.wide,
    },
    primaryButton: {
        paddingVertical: 20,
        paddingHorizontal: Spacing.xxl,
        borderRadius: Spacing.borderRadius.lg,
        alignItems: 'center',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        fontSize: Typography.size.lg,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.wide,
    },
    secondaryButton: {
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xxl,
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: Typography.weight.medium,
        letterSpacing: 0.3,
    },
});