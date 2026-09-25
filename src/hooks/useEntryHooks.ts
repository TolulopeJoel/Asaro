import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { BibleBook } from '../data/bibleBooks';
import { ReflectionAnswers } from '../components/ReflectionForm';
import { formatRange, spell } from '../utils/reference';

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
    /** The same, split, for Colossal's two-line giant. */
    book: string;
    chapters: string;
    /** How many of the five questions came back with something in them. */
    answered: number;
    total: number;
}

/** The five questions the wizard asks, for the "three of five" line. */
const QUESTION_COUNT = 5;

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
 * Read a stored draft the way Home wants it.
 *
 * design/all-screens.html #draft. Home used to keep one bit of this payload —
 * whether it existed — and say "Didn't finish?" in a floating bar. The passage
 * and the progress were in the draft the whole time; naming them is what turns
 * a nag into a way back in.
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

    const a = draft.reflectionAnswers;
    const answered = a
        ? [a.reflection1, a.reflection2, a.reflection4, a.studyFurther].filter(t => !!t?.trim()).length +
          (a.actionItems?.some(item => item.action.trim()) ? 1 : 0)
        : 0;

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
    readingItemId?: number
) {
    const lastSaveTime = useRef<number>(0);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /*
     * What the next save should write.
     *
     * The 20s interval is created once and never re-created, so anything it
     * closed over would be frozen at the moment the reflection step opened —
     * and every tick would write that stale draft back over the fresh one.
     */
    const latest = useRef({ reflectionAnswers, selectedBook, selectedChapters, verseRange, readingItemId });
    latest.current = { reflectionAnswers, selectedBook, selectedChapters, verseRange, readingItemId };

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (isEditMode || currentStep !== 'reflection') {
            if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            return;
        }

        const saveDraft = async () => {
            if (!isMountedRef.current) return;
            try {
                const draftData: DraftData = { ...latest.current };
                await AsyncStorage.setItem(STORAGE_KEYS.REFLECTION_DRAFT, JSON.stringify(draftData));
                lastSaveTime.current = Date.now();
            } catch (e) {
                console.error('Failed to save draft:', e);
            }
        };

        if (!selectedBook && !reflectionAnswers) return;

        if (!intervalRef.current) {
            intervalRef.current = setInterval(() => {
                if (isMountedRef.current) saveDraft();
            }, 20000);
        }

        const now = Date.now();
        if (now - lastSaveTime.current >= 20000) { saveDraft(); return; }

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            if (isMountedRef.current) saveDraft();
        }, 800);

        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [reflectionAnswers, selectedBook, selectedChapters, verseRange, currentStep, isEditMode, readingItemId]);
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
