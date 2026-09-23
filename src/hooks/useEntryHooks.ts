import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { BibleBook } from '../data/bibleBooks';
import { ReflectionAnswers } from '../components/ReflectionForm';

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
