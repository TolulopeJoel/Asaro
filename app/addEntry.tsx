import { createJournalEntry, getEntryById, JournalEntryInput, updateJournalEntry } from '@/src/data/database';
import { useTheme } from '@/src/theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/storage/storageKeys';
import { useLocalSearchParams, useNavigation, useRouter, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Share, StyleSheet, View } from 'react-native';
import { ReflectionAnswers } from '../src/components/ReflectionForm';
import { LoadingView } from '../src/components/LoadingView';
import { BibleBook, getBookByName } from '../src/data/bibleBooks';
import { setupDailyNotifications, syncStudyReminders } from '../src/utils/notifications';
import { emitMilestones, publishReading } from '@/src/groups/publish';
import { useAlert } from '@/src/context/AlertContext';
import { firstWithoutReason, isBlank } from '@/src/data/actionValidation';
import { useObservation } from '@/src/insight/useObservation';
import { ObservationCard } from '@/src/components/insight/ObservationCard';
import { ObservationReceipts } from '@/src/components/insight/ObservationReceipts';
import { AnimatedModal } from '@/src/components/AnimatedModal';
import { planItemChapters, setActionItemArchived } from '@/src/data/journalRepository';
import { useAutoSave, useStepFade, Step, DraftData, ChapterRange, VerseRange, summariseDraft, restoreAnswers } from '../src/hooks/useEntryHooks';
import { isBlankTopic } from '@/src/data/studyTopics';
import { answeredCount } from '@/src/data/questions';
import { BookStep, ChapterStep, ReflectionStep, SummaryStep } from '../src/components/entry/EntrySteps';
import { Screen } from '@/src/components/ui';
import { PracticeAftermath } from '@/src/components/onboarding/PracticeAftermath';
import { beatsFinished, COACH, PRACTICE_ANSWERS, PRACTICE_BOOK, PRACTICE_CHAPTERS } from '@/src/onboarding/practiceEntry';
import { CoachSequence } from '@/src/components/onboarding/CoachSequence';
import { setFirstRun } from '@/src/onboarding/firstRun';
import { KeyboardSafe } from '../src/components/KeyboardSafe';
import { unwrapReferences } from '@/src/utils/reference';


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MeditationSessionScreen() {
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();
    const params = useLocalSearchParams();

    const isEditMode = !!params.entryId;
    const entryId = params.entryId ? Number(params.entryId) : undefined;
    /*
     * A new user's practice entry with the chosen sibling. It runs the real
     * wizard and saves NOTHING: no entry, no draft, no group posts, no
     * reminder changes, no insights. See src/onboarding/practiceEntry.ts.
     */
    const practice = params.practice === 'true';

    const [currentStep, setCurrentStep] = useState<Step>(practice ? 'chapter' : 'book');

    // Something committed to before, shown once the entry is saved. Loaded
    // only on the summary step: earlier is a query behind a screen nobody sees
    // it on, and the detector's age floor means it is never the one just
    // written.
    const echo = useObservation(currentStep === 'summary' && !practice, 'afterSave');
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
    const [selectedBook, setSelectedBook] = useState<BibleBook | undefined>(() => practice ? getBookByName(PRACTICE_BOOK) : undefined);
    const [selectedChapters, setSelectedChapters] = useState<ChapterRange | undefined>(practice ? PRACTICE_CHAPTERS : undefined);
    const [verseRange, setVerseRange] = useState<VerseRange | null>(null);
    const [reflectionAnswers, setReflectionAnswers] = useState<ReflectionAnswers>();
    const isResuming = !!params.resuming;
    // New entries need no async work before rendering — skip the loading state.
    const needsAsyncLoad = !!(params.entryId || params.readingItemId || params.resuming);
    const [isLoading, setIsLoading] = useState(needsAsyncLoad);
    const [savedEntryId, setSavedEntryId] = useState<number | undefined>();
    const isSaving = useRef(false);
    // Set once the entry is saved or the draft discarded, so autosave can't resurrect it. Always set in practice.
    const draftClosed = useRef(practice);
    // What each action said when an edit opened, so only new or changed actions must give a reason.
    const loadedActions = useRef(new Map<number, string>());

    const [readingItemId, setReadingItemId] = useState<number | undefined>(
        params.readingItemId ? Number(params.readingItemId) : undefined
    );

    const { opacity } = useStepFade(currentStep);
    const navigation = useNavigation();

    // Hardware back steps back through the wizard; the reflection step handles its own pages.
    useEffect(() => {
        if (currentStep !== 'chapter') return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setCurrentStep('book');
            return true;
        });
        return () => sub.remove();
    }, [currentStep]);

    // How far each practice page's conversation has got, kept when paging back so nothing is said twice.
    const [beatAt, setBeatAt] = useState<Record<string, number>>({});
    const advanceBeat = useCallback((key: string) => setBeatAt(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 })), []);
    const advanceChapter = useCallback(() => advanceBeat('chapter'), [advanceBeat]);
    const pageAdvancers = useMemo(() => COACH.pages.map((_, i) => () => advanceBeat(`p${i}`)), [advanceBeat]);

    // The practice entry can't be left until it's done: no skip, like the rest of a first run.
    const practiceDone = useRef(false);
    useEffect(() => {
        if (!practice) return;
        return navigation.addListener('beforeRemove', e => {
            if (practiceDone.current) return;
            e.preventDefault();
            setCurrentStep(step => (step === 'book' ? 'chapter' : step));
        });
    }, [practice, navigation]);

    // An edit isn't autosaved, so leaving with changes asks first.
    const loadedEdit = useRef<string | null>(null);
    const editSnapshot = JSON.stringify([reflectionAnswers, selectedChapters, verseRange, selectedBook?.name]);
    const editDirty = useRef(false);
    editDirty.current = isEditMode && loadedEdit.current !== null && loadedEdit.current !== editSnapshot;
    useEffect(() => {
        if (isEditMode && !isLoading && loadedEdit.current === null) loadedEdit.current = editSnapshot;
    }, [isEditMode, isLoading, editSnapshot]);
    useEffect(() => navigation.addListener('beforeRemove', e => {
        if (!editDirty.current || draftClosed.current) return;
        e.preventDefault();
        showAlert({
            title: 'Discard changes?',
            message: 'Your changes to this entry have not been saved.',
            buttons: [
                { text: 'Keep editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
            ],
        });
    }), [navigation, showAlert]);

    // Resolves true to replace the unfinished draft, false to go back to it.
    const confirmReplaceDraft = (passage: string) => new Promise<boolean>(resolve => {
        showAlert({
            title: 'You have a draft',
            message: `Your reflection on ${passage} isn't finished. Starting this reading will discard it.`,
            cancelable: false,
            buttons: [
                { text: 'Resume draft', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Discard it', style: 'destructive', onPress: () => resolve(true) },
            ],
        });
    });

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
                    loadedActions.current = new Map(
                        (entry.action_items ?? []).map(item => [item.id!, `${item.action}\u0000${item.motivation}`])
                    );
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
                                id: item.id,
                                action: item.action,
                                motivation: item.motivation,
                                cadence: item.cadence ?? null,
                                due_at: item.due_at ?? null,
                                archived_at: item.archived_at ?? null,
                            }))
                            : [{ action: '', motivation: '' }],
                        reflection4: entry.reflection_4 || '',
                        studyTopics: (entry.study_items ?? []).map(item => ({
                            id: item.id,
                            topic: item.topic,
                            reminder: item.reminder,
                            completed: item.completed,
                        })),
                        notes: entry.notes || '',
                    });
                    setCurrentStep('reflection');
                } else if (params.readingItemId) {
                    // CASE 2: Reading Plan Item explicitly selected
                    const rId = Number(params.readingItemId);
                    const draftJson = await AsyncStorage.getItem(STORAGE_KEYS.REFLECTION_DRAFT);
                    const draft: DraftData | null = draftJson ? JSON.parse(draftJson) : null;
                    const otherDraft = draft && draft.readingItemId !== rId ? summariseDraft(draftJson) : null;
                    if (otherDraft && !(await confirmReplaceDraft(otherDraft.passage))) {
                        router.replace({ pathname: '/addEntry', params: { resuming: 'true' } });
                        return;
                    }
                    if (otherDraft) await AsyncStorage.removeItem(STORAGE_KEYS.REFLECTION_DRAFT);

                    // Paired readings ("Obadiah/Jonah") name no single book: pick it on the book step.
                    const book = getBookByName(params.bookName as string);
                    if (!book) {
                        setCurrentStep('book');
                        return;
                    }
                    setSelectedBook(book);
                    const chapters = planItemChapters(params.chapters as string);
                    if (chapters) setSelectedChapters(chapters);
                    if (draft && draft.readingItemId === rId) {
                        if (draft.verseRange) setVerseRange(draft.verseRange);
                        if (draft.reflectionAnswers) setReflectionAnswers(restoreAnswers(draft.reflectionAnswers));
                    }
                    setCurrentStep(chapters ? 'reflection' : 'chapter');
                } else if (isResuming) {
                    // CASE 3: Resuming generic draft
                    const draftJson = await AsyncStorage.getItem(STORAGE_KEYS.REFLECTION_DRAFT);
                    if (draftJson) {
                        const draft: DraftData = JSON.parse(draftJson);
                        if (draft.selectedBook) setSelectedBook(draft.selectedBook);
                        if (draft.selectedChapters) setSelectedChapters(draft.selectedChapters);
                        if (draft.verseRange) setVerseRange(draft.verseRange);
                        if (draft.reflectionAnswers) setReflectionAnswers(restoreAnswers(draft.reflectionAnswers));
                        if (draft.readingItemId) setReadingItemId(draft.readingItemId);
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

    useAutoSave(reflectionAnswers, selectedBook, selectedChapters, verseRange, currentStep, isEditMode, readingItemId, draftClosed);

    // Clears all entry state and removes the draft from storage.
    const clearEntryState = useCallback(async () => {
        draftClosed.current = true;
        await AsyncStorage.removeItem(STORAGE_KEYS.REFLECTION_DRAFT);
        setSelectedBook(undefined);
        setSelectedChapters(undefined);
        setVerseRange(null);
        setReflectionAnswers(undefined);
        setSavedEntryId(undefined);
    }, []);

    // Rebuilds the daily reminders and brings the study reminders in line with the saved topics.
    const runPostSaveNotifications = useCallback(async (isNewEntry: boolean) => {
        try {
            await setupDailyNotifications(isNewEntry);
            await syncStudyReminders();
        } catch (error) {
            console.error('Failed to schedule notifications after save:', error);
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
            showAlert({ title: 'Which chapter?', message: 'Pick at least one first.' });
            return;
        }
        setCurrentStep('reflection');
    }, [selectedChapters, showAlert]);

    const handleSaveReflection = useCallback(async (answers: ReflectionAnswers) => {
        if (!selectedBook || !selectedChapters || selectedChapters.start === 0) {
            showAlert({ title: 'Which chapter?', message: 'Pick a book and a chapter first.' });
            return;
        }
        /*
         * An action without a reason is not saved, because the reason is the
         * part worth keeping. The message quotes the action back rather than
         * saying "something is missing" — that way it asks a question the
         * writer can answer instead of sending them hunting.
         */
        const needReason = (answers.actionItems ?? []).filter(item =>
            !item.archived_at &&
            (!item.id || loadedActions.current.get(item.id) !== `${item.action}\u0000${item.motivation}`)
        );
        const unreasoned = firstWithoutReason(needReason);
        if (unreasoned) {
            showAlert({
                title: 'Why does this matter?',
                message: `You wrote "${unwrapReferences(unreasoned.action)}" — add what moves you to it. Months from now that reason is the part you will have forgotten.`,
            });
            return;
        }

        // Practice: straight to the saved screen, touching nothing.
        if (practice) {
            setReflectionAnswers(answers);
            setCurrentStep('summary');
            return;
        }

        if (isSaving.current) return;
        isSaving.current = true;
        const wasClosed = draftClosed.current;
        draftClosed.current = true;

        try {
            const entryData: JournalEntryInput = {
                bookName: selectedBook.name,
                chapterStart: selectedChapters.start,
                chapterEnd: selectedChapters.end,
                verseStart: verseRange?.start || undefined,
                verseEnd: verseRange?.end || undefined,
                reflections: [answers.reflection1, answers.reflection2, '', answers.reflection4],
                notes: answers.notes,
                studyTopics: answers.studyTopics
                    .filter(item => !isBlankTopic(item))
                    .map(({ id, topic, reminder }) => ({ id, topic, reminder })),
                actionItems: answers.actionItems.filter(item => !isBlank(item)),
                readingItemId,
            };

            // Resolve the target id: an existing edit or a previously auto-saved entry.
            const targetId = isEditMode ? entryId : savedEntryId;

            if (targetId) {
                await updateJournalEntry(targetId, entryData);
                void publishReading(targetId);
                void emitMilestones();
                if (isEditMode) {
                    void runPostSaveNotifications(false);
                    showAlert({ title: 'Updated', message: 'Your entry is saved.' });
                    router.back();
                } else {
                    await AsyncStorage.removeItem(STORAGE_KEYS.REFLECTION_DRAFT);
                    setReflectionAnswers(answers);
                    setCurrentStep('summary');
                    void runPostSaveNotifications(true);
                }
            } else {
                const newId = await createJournalEntry(entryData);
                setSavedEntryId(newId);

                // Reflection text never leaves the phone unasked; groups get the passage and a count.
                void publishReading(newId);
                void emitMilestones();

                await AsyncStorage.removeItem(STORAGE_KEYS.REFLECTION_DRAFT);
                setReflectionAnswers(answers);
                setCurrentStep('summary');
                void runPostSaveNotifications(true);
            }
        } catch (error) {
            console.error('Error saving entry:', error);
            draftClosed.current = wasClosed;
            showAlert({
                title: 'Error',
                message: `Failed to ${isEditMode || savedEntryId ? 'update' : 'save'} your entry. Please try again.`,
            });
        } finally {
            isSaving.current = false;
        }
    }, [practice, selectedBook, selectedChapters, verseRange, isEditMode, entryId, savedEntryId, router, readingItemId, showAlert, runPostSaveNotifications]);

    const handleDone = useCallback(async () => {
        if (practice) {
            // Back to the Home underneath, whose walk picks up from the flag.
            await setFirstRun('walk');
            practiceDone.current = true;
            if (router.canGoBack()) router.back();
            else router.replace('/');
            return;
        }
        router.replace({ pathname: '/(tabs)/library' });
    }, [practice, router]);

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
            title: 'Discard draft?',
            message: 'Are you sure you want to discard your draft and start fresh?',
            buttons: [
                { text: 'Keep writing', style: 'cancel' },
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

    // The day it was recorded, worked out on the saved screen: an entry left open overnight is saved today.
    const formattedDate = useMemo(() => new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }), [currentStep === 'summary']);

    // Questions actually answered, so a skipped one is never rounded up to five.
    const answerCount = useMemo(() => answeredCount(reflectionAnswers), [reflectionAnswers]);

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
                        verseRange={verseRange}
                        onChapterSelect={handleChapterSelect}
                        onVerseRangeChange={handleVerseRangeChange}
                        onBack={practice ? undefined : () => setCurrentStep('book')}
                        onExit={practice ? undefined : () => router.back()}
                        onContinue={handleContinueToReflection}
                        canContinue={!!(selectedChapters && selectedChapters.start > 0) && (!practice || beatsFinished(COACH.chapter, beatAt.chapter ?? 0))}
                        coach={practice ? <CoachSequence beats={COACH.chapter} at={beatAt.chapter ?? 0} onAdvance={advanceChapter} /> : undefined}
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
                        onExit={practice ? undefined : () => router.back()}
                        saveButtonText={savedEntryId ? 'Update entry' : undefined}
                        coach={practice ? (page, answers) => COACH.pages[page] ? (
                            <CoachSequence
                                key={page}
                                beats={COACH.pages[page]}
                                at={beatAt[`p${page}`] ?? 0}
                                onAdvance={pageAdvancers[page]}
                                answers={answers}
                            />
                        ) : null : undefined}
                        gate={practice ? (page) => beatsFinished(COACH.pages[page], beatAt[`p${page}`] ?? 0) : undefined}
                        samples={practice ? PRACTICE_ANSWERS : undefined}
                    />
                );
            case 'summary':
                return (
                    <SummaryStep
                        observation={echoCard}
                        observationSettled={echo.settled}
                        noteSeed={savedEntryId}
                        selectionSummary={selectionSummary}
                        formattedDate={formattedDate}
                        answerCount={answerCount}
                        onDone={handleDone}
                        onShare={handleShare}
                        practice={practice ? <PracticeAftermath answers={reflectionAnswers} /> : undefined}
                        doneLabel={practice ? 'Show me around' : undefined}
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
            <KeyboardSafe style={{ flex: 1 }}>
                <Animated.View style={[{ flex: 1 }, { opacity }]}>
                    {renderCurrentStep()}
                </Animated.View>
            </KeyboardSafe>

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