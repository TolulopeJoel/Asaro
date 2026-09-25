import { createJournalEntry, getEntryById, getTotalJournalCount, JournalEntryInput, updateJournalEntry } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import { getAuth } from '@react-native-firebase/auth';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Share, StyleSheet, View } from 'react-native';
import { ReflectionAnswers } from '../src/components/ReflectionForm';
import { LoadingView } from '../src/components/LoadingView';
import { BibleBook, getBookByName } from '../src/data/bibleBooks';
import { setupDailyNotifications, scheduleReminderNotification } from '../src/utils/notifications';
import { queueActivity, syncPendingActivities } from '../src/utils/syncActivities';
import { useAlert } from '@/src/context/AlertContext';
import { firstWithoutReason, isBlank } from '@/src/data/actionValidation';
import { useObservation } from '@/src/insight/useObservation';
import { ObservationCard } from '@/src/components/insight/ObservationCard';
import { ObservationReceipts } from '@/src/components/insight/ObservationReceipts';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { setActionItemArchived } from '@/src/data/journalRepository';
import { useAutoSave, useStepFade, Step, DraftData, ChapterRange, VerseRange } from '../src/hooks/useEntryHooks';
import { BookStep, ChapterStep, ReflectionStep, SummaryStep } from '../src/components/entry/EntrySteps';
import { Screen } from '@/src/components/ui';
import { KEYBOARD_BEHAVIOR } from '../src/utils/keyboard';


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MeditationSessionScreen() {
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();
    const params = useLocalSearchParams();

    const isEditMode = !!params.entryId;
    const entryId = params.entryId ? Number(params.entryId) : undefined;

    const [currentStep, setCurrentStep] = useState<Step>('book');

    /*
     * Something committed to before, shown once the entry is saved.
     *
     * Only loaded on the summary step — asking for it earlier would run a
     * query behind a screen nobody is going to see it on, and the detector's
     * own eight-week floor means it can never be the commitment just written.
     */
    const echo = useObservation(currentStep === 'summary', 'afterSave');
    const [echoOpen, setEchoOpen] = useState(false);

    const echoCard =
        echo.rendered && !echoOpen ? (
            <ObservationCard
                observation={echo.rendered}
                onSeen={echo.seen}
                onOpen={() => {
                    echo.open();
                    setEchoOpen(true);
                }}
                onDismiss={() => echo.dismiss()}
            />
        ) : null;
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
                            /*
                             * Carry the kind through an edit. Mapping only
                             * action and motivation would silently reset a
                             * practice to an application the first time
                             * someone opened an old entry to fix a typo.
                             */
                            ? entry.action_items.map(item => ({
                                action: item.action,
                                motivation: item.motivation,
                                cadence: item.cadence ?? null,
                                due_at: item.due_at ?? null,
                                archived_at: item.archived_at ?? null,
                            }))
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
        /*
         * An action without a reason is not saved, because the reason is the
         * part worth keeping. The message quotes the action back rather than
         * saying "something is missing" — that way it asks a question the
         * writer can answer instead of sending them hunting.
         */
        const unreasoned = firstWithoutReason(answers.actionItems ?? []);
        if (unreasoned) {
            showAlert({
                title: 'Why does this matter?',
                message: `You wrote "${unreasoned.action.trim()}" — add what moves you to it. Months from now that reason is the part you will have forgotten.`,
            });
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
                actionItems: answers.actionItems.filter(item => !isBlank(item)),
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

    /*
     * What the save screen says under the passage. Counted from what was
     * actually written rather than from the number of questions, so skipping
     * one is reported honestly instead of being rounded up to five.
     */
    const answerCount = useMemo(() => {
        const a = reflectionAnswers;
        if (!a) return 0;
        const written = [a.reflection1, a.reflection2, a.reflection4, a.studyFurther, a.notes]
            .filter(text => !!text?.trim()).length;
        const acted = a.actionItems?.some(item => item.action.trim()) ? 1 : 0;
        return written + acted;
    }, [reflectionAnswers]);

    // ─── Step renders ─────────────────────────────────────────────────────────

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'book':
                return <BookStep selectedBook={selectedBook} onBookSelect={handleBookSelect} onExit={() => router.back()} />;
            case 'chapter':
                return (
                    <ChapterStep
                        selectedBook={selectedBook}
                        selectedChapters={selectedChapters}
                        onChapterSelect={handleChapterSelect}
                        onVerseRangeChange={handleVerseRangeChange}
                        onBack={() => setCurrentStep('book')}
                        onExit={() => router.back()}
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
                        onExit={() => router.back()}
                        saveButtonText={savedEntryId ? 'Update entry' : undefined}
                    />
                );
            case 'summary':
                return (
                    <SummaryStep
                        observation={echoCard}
                        selectionSummary={selectionSummary}
                        formattedDate={formattedDate}
                        answerCount={answerCount}
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

    /*
     * Only the Cloth Book, Chapter and summary steps wear a band, and a band takes the
     * top inset into itself (<Hero ownsTopInset>) so the cloth runs to the top
     * of the screen. The reflection wizard draws its own top bar and still
     * needs Screen to reserve that space.
     */
    const bandOwnsTop = currentStep === 'book' || currentStep === 'chapter' || currentStep === 'summary';

    return (
        <Screen edges={bandOwnsTop ? [] : ['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
                <Animated.View style={[{ flex: 1 }, { opacity }]}>
                    {renderCurrentStep()}
                </Animated.View>
            </KeyboardAvoidingView>

            {/* The receipts behind "show me why", over the summary rather than
              * pushing a route — closing puts the reader back where they were. */}
            <AnimatedModal visible={echoOpen && !!echo.observation} onRequestClose={() => setEchoOpen(false)}>
                {echo.observation && echo.rendered && (
                    <ObservationReceipts
                        observation={echo.observation}
                        rendered={echo.rendered}
                        onClose={() => setEchoOpen(false)}
                        onFollow={() => echo.follow()}
                        onVerdict={agreed => {
                            setEchoOpen(false);
                            echo.verdict(agreed);
                        }}
                        onOpenEntry={entry => {
                            setEchoOpen(false);
                            router.push(`/library/${entry.id}`);
                        }}
                        onArchiveSubject={async () => {
                            /*
                             * The commitment this card is about, taken from the
                             * evidence rather than guessed — the same record the
                             * receipts are drawn from.
                             */
                            const id = echo.observation?.evidence.find(
                                item => item.kind === 'actionItem',
                            )?.actionItemId;
                            setEchoOpen(false);
                            if (id) await setActionItemArchived(id, true);
                            await echo.dismiss();
                        }}
                    />
                )}
            </AnimatedModal>
        </Screen>
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