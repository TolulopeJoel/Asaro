import { createJournalEntry, getEntryById, getTotalJournalCount, JournalEntryInput, updateJournalEntry } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import { getAuth } from '@react-native-firebase/auth';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, KeyboardAvoidingView, Platform, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReflectionAnswers } from '../src/components/ReflectionForm';
import { LoadingView } from '../src/components/LoadingView';
import { BibleBook, getBookByName } from '../src/data/bibleBooks';
import { setupDailyNotifications, scheduleReminderNotification } from '../src/utils/notifications';
import { queueActivity, syncPendingActivities } from '../src/utils/syncActivities';
import { useAlert } from '@/src/context/AlertContext';
import { useAuth } from '@/src/context/AuthContext';
import { useAutoSave, useStepFade, Step, DraftData, ChapterRange, VerseRange } from '../src/hooks/useEntryHooks';
import { BookStep, ChapterStep, ReflectionStep, SummaryStep } from '../src/components/entry/EntrySteps';


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MeditationSessionScreen() {
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();
    const params = useLocalSearchParams();

    const isEditMode = !!params.entryId;
    const entryId = params.entryId ? Number(params.entryId) : undefined;

    const [currentStep, setCurrentStep] = useState<Step>('book');
    const [selectedBook, setSelectedBook] = useState<BibleBook>();
    const [selectedChapters, setSelectedChapters] = useState<ChapterRange>();
    const [verseRange, setVerseRange] = useState<VerseRange | null>(null);
    const [reflectionAnswers, setReflectionAnswers] = useState<ReflectionAnswers>();
    const isResuming = !!params.resuming;
    // New entries need no async work before rendering — skip the loading state.
    const needsAsyncLoad = !!(params.entryId || params.readingItemId || params.resuming);
    const [isLoading, setIsLoading] = useState(needsAsyncLoad);
    const [savedEntryId, setSavedEntryId] = useState<number | undefined>();
    const isSaving = useRef(false);

    const readingItemId = params.readingItemId ? Number(params.readingItemId) : undefined;

    const { opacity } = useStepFade(currentStep);

    // Load data
    useEffect(() => {
        const loadData = async () => {
            try {
                if (isEditMode && entryId) {
                    const entry = await getEntryById(entryId);
                    if (!entry) {
                        showAlert({ title: 'Error', message: 'Entry not found' });
                        router.back();
                        return;
                    }
                    const book = getBookByName(entry.book_name);
                    setSelectedBook(book);
                    setSelectedChapters({ start: entry.chapter_start, end: entry.chapter_end });
                    if (entry.verse_start || entry.verse_end) {
                        setVerseRange({
                            start: entry.verse_start?.toString() || '',
                            end: entry.verse_end?.toString() || '',
                        });
                    }
                    setReflectionAnswers({
                        reflection1: entry.reflection_1 || '',
                        reflection2: entry.reflection_2 || '',
                        actionItems: entry.action_items && entry.action_items?.length > 0
                            ? entry.action_items.map(item => ({ action: item.action, motivation: item.motivation }))
                            : [{ action: '', motivation: '' }],
                        reflection4: entry.reflection_4 || '',
                        studyFurther: entry.study_further || '',
                        studyFurtherReminder: entry.study_further_reminder || undefined,
                        notes: entry.notes || '',
                    });
                    setCurrentStep('reflection');
                } else if (params.readingItemId) {
                    // CASE 2: Reading Plan Item explicitly selected
                    const rId = Number(params.readingItemId);
                    const book = getBookByName(params.bookName as string);
                    setSelectedBook(book);
                    const chaptersStr = params.chapters as string;
                    if (chaptersStr) {
                        const [start, end] = chaptersStr.split('-').map(Number);
                        setSelectedChapters({ start, end: end || start });
                    }
                    const draftJson = await AsyncStorage.getItem(STORAGE_KEYS.REFLECTION_DRAFT);
                    if (draftJson) {
                        const draft: DraftData = JSON.parse(draftJson);
                        if (draft.readingItemId === rId) {
                            if (draft.verseRange) setVerseRange(draft.verseRange);
                            if (draft.reflectionAnswers) setReflectionAnswers(draft.reflectionAnswers);
                        }
                    }
                    setCurrentStep('reflection');
                } else if (isResuming) {
                    // CASE 3: Resuming generic draft
                    const draftJson = await AsyncStorage.getItem(STORAGE_KEYS.REFLECTION_DRAFT);
                    if (draftJson) {
                        const draft: DraftData = JSON.parse(draftJson);
                        if (draft.selectedBook) setSelectedBook(draft.selectedBook);
                        if (draft.selectedChapters) setSelectedChapters(draft.selectedChapters);
                        if (draft.verseRange) setVerseRange(draft.verseRange);
                        if (draft.reflectionAnswers) setReflectionAnswers(draft.reflectionAnswers);
                        setCurrentStep('reflection');
                    }
                }
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [isEditMode, entryId, params.readingItemId, params.bookName, params.chapters]);

    useAutoSave(reflectionAnswers, selectedBook, selectedChapters, verseRange, currentStep, isEditMode, readingItemId);

    // Clears all entry state and removes the draft from storage.
    const clearEntryState = useCallback(async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.REFLECTION_DRAFT);
        setSelectedBook(undefined);
        setSelectedChapters(undefined);
        setVerseRange(null);
        setReflectionAnswers(undefined);
        setSavedEntryId(undefined);
    }, []);

    // Fires daily notification setup and an optional study-further reminder.
    const runPostSaveNotifications = useCallback(async (
        isNewEntry: boolean,
        studyFurtherReminder?: string,
        studyFurther?: string,
    ) => {
        await setupDailyNotifications(isNewEntry);
        if (studyFurtherReminder && new Date(studyFurtherReminder) > new Date()) {
            await scheduleReminderNotification(
                new Date(studyFurtherReminder),
                '📖 Study Reminder',
                `Time to study further: ${studyFurther || 'your topic'}`,
            );
        }
    }, []);

    const handleBookSelect = useCallback((book: BibleBook) => {
        setSelectedBook(book);
        setSelectedChapters(undefined);
        setVerseRange(null);
        setCurrentStep('chapter');
    }, []);

    const handleChapterSelect = useCallback((chapters: ChapterRange) => {
        setSelectedChapters(chapters);
    }, []);

    const handleVerseRangeChange = useCallback((verses: VerseRange | null) => {
        setVerseRange(verses);
    }, []);

    const handleContinueToReflection = useCallback(() => {
        if (!selectedChapters || selectedChapters.start === 0) {
            showAlert({ title: 'Please select a chapter', message: 'You need to select at least one chapter to continue.' });
            return;
        }
        setCurrentStep('reflection');
    }, [selectedChapters, showAlert]);

    const handleSaveReflection = useCallback(async (answers: ReflectionAnswers) => {
        if (!selectedBook || !selectedChapters || selectedChapters.start === 0) {
            showAlert({ title: 'Incomplete', message: 'Please select a book and chapter first.' });
            return;
        }
        if (isSaving.current) return;
        isSaving.current = true;

        try {
            const entryData: JournalEntryInput = {
                bookName: selectedBook.name,
                chapterStart: selectedChapters.start,
                chapterEnd: selectedChapters.end,
                verseStart: verseRange?.start || undefined,
                verseEnd: verseRange?.end || undefined,
                reflections: [answers.reflection1, answers.reflection2, '', answers.reflection4],
                notes: answers.notes,
                studyFurther: answers.studyFurther,
                studyFurtherReminder: answers.studyFurtherReminder,
                actionItems: answers.actionItems.filter(item => item.action.trim() || item.motivation.trim()),
                readingItemId: params.readingItemId ? Number(params.readingItemId) : undefined,
            };

            // Resolve the target id: an existing edit or a previously auto-saved entry.
            const targetId = isEditMode ? entryId : savedEntryId;

            if (targetId) {
                await updateJournalEntry(targetId, entryData);
                await runPostSaveNotifications(false, answers.studyFurtherReminder, answers.studyFurther);
                if (isEditMode) {
                    showAlert({ title: 'Success', message: 'Entry updated successfully' });
                    router.back();
                } else {
                    await AsyncStorage.removeItem(STORAGE_KEYS.REFLECTION_DRAFT);
                    await runPostSaveNotifications(true, answers.studyFurtherReminder, answers.studyFurther);
                    setReflectionAnswers(answers);
                    setCurrentStep('summary');
                }
            } else {
                const newId = await createJournalEntry(entryData);
                setSavedEntryId(newId);

                // Push sharing/group activity to Firestore (layer violation fix)
                void (async () => {
                    try {
                        const user = getAuth().currentUser;
                        if (!user) return;

                        const chapters = entryData.chapterEnd && entryData.chapterEnd !== entryData.chapterStart
                            ? `${entryData.chapterStart}-${entryData.chapterEnd}`
                            : `${entryData.chapterStart}`;

                        const previewText = (
                            entryData.reflections?.find(r => r?.trim().length > 0)?.trim() ||
                            entryData.notes?.trim() ||
                            entryData.actionItems?.find(a => a?.action?.trim().length > 0)?.action?.trim()
                        );
                        const reflectionPreview = previewText
                            ? previewText.slice(0, 45) + (previewText.length > 45 ? '…' : '')
                            : undefined;

                        const resolvedName = user.displayName || user.email?.split('@')[0] || 'Reader';
                        const totalEntries = await getTotalJournalCount();

                        const activity = {
                            userId: user.uid,
                            activityId: `${user.uid}_journal_${newId}`,
                            userName: resolvedName,
                            bookName: entryData.bookName,
                            chapters,
                            type: 'journal_entry' as any,
                            queuedAt: new Date().toISOString(),
                            reflectionPreview,
                            totalEntries,
                        };

                        await queueActivity(activity);
                        await syncPendingActivities();
                    } catch (error) {
                        console.error('[addEntry] Background Firestore sync error:', error);
                    }
                })();

                await AsyncStorage.removeItem(STORAGE_KEYS.REFLECTION_DRAFT);
                await runPostSaveNotifications(true, answers.studyFurtherReminder, answers.studyFurther);
                setReflectionAnswers(answers);
                setCurrentStep('summary');
            }
        } catch (error) {
            console.error('Error saving entry:', error);
            showAlert({
                title: 'Error',
                message: `Failed to ${isEditMode || savedEntryId ? 'update' : 'save'} your entry. Please try again.`,
            });
        } finally {
            isSaving.current = false;
        }
    }, [selectedBook, selectedChapters, verseRange, isEditMode, entryId, savedEntryId, router, params.readingItemId, showAlert, runPostSaveNotifications]);

    const handleDone = useCallback(() => {
        router.replace({ pathname: '/(tabs)/library' });
    }, [router]);

    const handleShare = useCallback(async () => {
        if (!selectedBook || !selectedChapters) return;
        const reference = `${selectedBook.name} ${selectedChapters.start}${selectedChapters.end && selectedChapters.end !== selectedChapters.start ? '–' + selectedChapters.end : ''}${verseRange?.start ? ':' + verseRange.start : ''}`;

        let content = `Reflection on ${reference}\n\n`;
        if (reflectionAnswers?.reflection1) content += `${reflectionAnswers.reflection1}\n\n`;
        content += `🫶 Created with Àṣàrò`;

        try {
            await Share.share({ message: content, title: reference });
        } catch (error) {
            console.error('Error sharing entry:', error);
        }
    }, [selectedBook, selectedChapters, verseRange, reflectionAnswers]);

    const handleDiscardDraft = useCallback(() => {
        showAlert({
            title: 'Discard Draft?',
            message: 'Are you sure you want to discard your draft and start fresh?',
            buttons: [
                { text: 'Keep Writing', style: 'cancel' },
                {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearEntryState();
                            router.replace('/');
                        } catch (error) {
                            console.error('Error discarding draft:', error);
                        }
                    },
                },
            ],
        });
    }, [router, showAlert, clearEntryState]);

    const selectionSummary = useMemo(() => {
        if (!selectedBook) return 'No selection yet';
        let summary = selectedBook.name;
        if (selectedChapters && selectedChapters.start > 0) {
            summary += ` ${selectedChapters.start}`;
            if (selectedChapters.end && selectedChapters.end !== selectedChapters.start) {
                summary += `–${selectedChapters.end}`;
            }
            if (verseRange) {
                if (selectedChapters.end && selectedChapters.end !== selectedChapters.start) {
                    const startVerse = verseRange.start ? `:${verseRange.start}` : '';
                    const endVerse = verseRange.end ? `:${verseRange.end}` : '';
                    if (startVerse || endVerse) {
                        summary = `${selectedBook.name} ${selectedChapters.start}${startVerse}–${selectedChapters.end}${endVerse}`;
                    }
                } else if (verseRange.start) {
                    summary += `:${verseRange.start}`;
                    if (verseRange.end) summary += `–${verseRange.end}`;
                }
            }
        }
        return summary;
    }, [selectedBook, selectedChapters, verseRange]);

    const formattedDate = useMemo(() => new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }), []);

    // ─── Step renders ─────────────────────────────────────────────────────────

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'book':
                return <BookStep selectedBook={selectedBook} onBookSelect={handleBookSelect} />;
            case 'chapter':
                return (
                    <ChapterStep
                        selectedBook={selectedBook}
                        selectedChapters={selectedChapters}
                        onChapterSelect={handleChapterSelect}
                        onVerseRangeChange={handleVerseRangeChange}
                        onBack={() => setCurrentStep('book')}
                        onContinue={handleContinueToReflection}
                        canContinue={!!(selectedChapters && selectedChapters.start > 0)}
                    />
                );
            case 'reflection':
                return (
                    <ReflectionStep
                        selectionSummary={selectionSummary}
                        reflectionAnswers={reflectionAnswers}
                        onAnswersChange={setReflectionAnswers}
                        onSave={handleSaveReflection}
                        isEditMode={isEditMode}
                        onBack={() => setCurrentStep('chapter')}
                        onDiscard={handleDiscardDraft}
                        selectedChapters={selectedChapters}
                        saveButtonText={savedEntryId ? 'Update entry' : undefined}
                    />
                );
            case 'summary':
                return (
                    <SummaryStep
                        selectionSummary={selectionSummary}
                        formattedDate={formattedDate}
                        onDone={handleDone}
                        onShare={handleShare}
                    />
                );
            default: return null;
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <LoadingView size={32} />
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <Animated.View style={[{ flex: 1 }, { opacity }]}>
                    {renderCurrentStep()}
                </Animated.View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});