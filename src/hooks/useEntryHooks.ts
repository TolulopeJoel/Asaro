import { useEffect, useRef } from 'react';
import { Animated, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { BibleBook } from '../data/bibleBooks';
import { ReflectionAnswers } from '../components/ReflectionForm';
import { formatRange, spell } from '../utils/reference';
import { QUESTION_COUNT, answeredCount } from '../data/questions';
import { topicsFromLegacy } from '../data/studyTopics';

export type Step = 'book' | 'chapter' | 'reflection' | 'summary';

export interface ChapterRange {
    start: number;
    end?: number;
}

export interface VerseRange {
    start: string;
    end: string;
}

export interface DraftData {
    selectedBook?: BibleBook;
    selectedChapters?: ChapterRange;
    verseRange?: VerseRange | null;
    reflectionAnswers?: ReflectionAnswers;
    readingItemId?: number;
}

/** What Home needs to say about an unfinished entry. */
export interface DraftSummary {
    /** "Genesis 12–15" — the passage the draft is already about. */
    passage: string;
    /** The same, split into its two parts. */
    book: string;
    chapters: string;
    /** How many of the five questions came back with something in them. */
    answered: number;
    total: number;
}

/**
 * How far into an entry you got, as a line Home can print.
 *
 * Both home styles built this the same way — `${spell(answered)} of
 * ${spell(total)} answered` — and both therefore said "no of five answered"
 * on a draft nobody had typed into yet, because `spell(0)` is "no". That is
 * the MOST likely draft there is: pick a passage, reach the questions, put
 * the phone down. The first thing a reader saw of the new draft block was a
 * grammatical error.
 *
 * Kept here rather than fixed twice in two files, since a phrase built in two
 * places is a phrase that will diverge in two places.
 */
export function draftProgress(draft: DraftSummary): string {
    /* No count on an empty draft. "Nothing answered yet, of five" reads like a
     * score; the total only means something once there is progress to measure
     * against it. */
    if (draft.answered === 0) return 'Nothing answered yet';
    return `${spell(draft.answered)} of ${spell(draft.total)} answered`;
}

/**
 * A draft's answers as the form takes them now. Drafts written before topics hold one
 * `studyFurther` string and reminder; they become topics the way saved entries did.
 */
export function restoreAnswers(answers: ReflectionAnswers & { studyFurther?: string; studyFurtherReminder?: string }): ReflectionAnswers {
    const { studyFurther, studyFurtherReminder, ...rest } = answers;
    return { ...rest, studyTopics: rest.studyTopics ?? topicsFromLegacy(studyFurther, studyFurtherReminder) };
}

/**
 * Read a stored draft the way Home wants it. design/all-screens.html #draft:
 * the passage and the progress are both in the payload, and naming them is
 * what turns a nag into a way back in.
 */
export function summariseDraft(json: string | null): DraftSummary | null {
    if (!json || !json.trim()) return null;

    let draft: DraftData;
    try {
        draft = JSON.parse(json);
    } catch {
        return null;
    }

    const book = draft.selectedBook?.name;
    const chapters = draft.selectedChapters;
    if (!book || !chapters?.start) return null;

    const range = chapters.end && chapters.end !== chapters.start
        ? `${chapters.start}-${chapters.end}`
        : `${chapters.start}`;

    const answered = answeredCount(draft.reflectionAnswers && restoreAnswers(draft.reflectionAnswers));

    return {
        passage: formatRange(`${book} ${range}`),
        book,
        chapters: formatRange(range),
        answered,
        total: QUESTION_COUNT,
    };
}

export function useAutoSave(
    reflectionAnswers: any,
    selectedBook: any,
    selectedChapters: any,
    verseRange: any,
    currentStep: Step,
    isEditMode: boolean,
    readingItemId?: number,
    suspended?: { current: boolean },
) {
    const lastSaveTime = useRef<number>(0);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // The interval is created once, so saves read the latest values from here, never a closure.
    const latest = useRef({ reflectionAnswers, selectedBook, selectedChapters, verseRange, readingItemId });
    latest.current = { reflectionAnswers, selectedBook, selectedChapters, verseRange, readingItemId };

    // Once saved or discarded, nothing may write the draft back.
    const saveDraft = useRef(async () => {
        if (suspended?.current) return;
        try {
            const draftData: DraftData = { ...latest.current };
            await AsyncStorage.setItem(STORAGE_KEYS.REFLECTION_DRAFT, JSON.stringify(draftData));
            lastSaveTime.current = Date.now();
        } catch (e) {
            console.error('Failed to save draft:', e);
        }
    }).current;

    // A pending save is written now rather than dropped when the writer leaves.
    const flushPending = useRef(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = null;
            saveDraft();
        }
    }).current;

    useEffect(() => () => {
        flushPending();
        if (intervalRef.current) clearInterval(intervalRef.current);
    }, []);

    // Timers stop in the background, where the phone may kill the app: a waiting save goes now.
    useEffect(() => {
        const sub = AppState.addEventListener('change', state => { if (state === 'background') flushPending(); });
        return () => sub.remove();
    }, []);

    // The chapter step keeps saving once answers exist, so going back to check the passage loses nothing.
    const writing = currentStep === 'reflection' || (currentStep === 'chapter' && !!reflectionAnswers);

    useEffect(() => {
        if (isEditMode || !writing) {
            flushPending();
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            return;
        }

        if (!selectedBook && !reflectionAnswers) return;

        if (!intervalRef.current) {
            intervalRef.current = setInterval(saveDraft, 20000);
        }

        if (AppState.currentState === 'background' || Date.now() - lastSaveTime.current >= 20000) { saveDraft(); return; }

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            debounceTimer.current = null;
            saveDraft();
        }, 800);
    }, [reflectionAnswers, selectedBook, selectedChapters, verseRange, writing, isEditMode, readingItemId]);
}

export function useStepFade(currentStep: Step) {
    const opacity = useRef(new Animated.Value(1)).current;
    const prevStep = useRef<Step>(currentStep);

    useEffect(() => {
        if (prevStep.current === currentStep) return;
        prevStep.current = currentStep;

        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
            opacity.setValue(0);
            Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        });
    }, [currentStep]);

    return { opacity };
}
