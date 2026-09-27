/**
 * Whether the app walk is running, and which stop it is on. While it runs,
 * screens show the walk's example content (src/onboarding/demo.ts) instead of
 * loading; nothing beneath a screen ever sees it, so no detector, sync or
 * reminder can act on an entry that doesn't exist.
 */
import { useSyncExternalStore } from 'react';

export interface TourState {
    active: boolean;
    /** The stop on screen, by key; screens use it to open what the stop points at. */
    stop: string | null;
}

let state: TourState = { active: false, stop: null };
const listeners = new Set<() => void>();

function set(next: TourState) {
    state = next;
    listeners.forEach(l => l());
}

export const startTour = () => set({ active: true, stop: null });
export const endTour = () => set({ active: false, stop: null });
export const setTourStop = (stop: string | null) => set({ ...state, stop });
export const getTour = () => state;

export function useTour(): TourState {
    return useSyncExternalStore(
        listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        () => state,
    );
}
