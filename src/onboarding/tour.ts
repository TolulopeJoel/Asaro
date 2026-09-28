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

/*
 * The example practices the reader ticks during the walk, shared so Home and
 * the Library agree. In memory only; cleared when the walk starts or ends.
 */
let kept: ReadonlySet<number> = new Set();
const keptListeners = new Set<() => void>();
function setKept(next: ReadonlySet<number>) {
    kept = next;
    keptListeners.forEach(l => l());
}
export const getDemoKept = () => kept;
export function setDemoKept(id: number, on: boolean) {
    const next = new Set(kept);
    if (on) next.add(id); else next.delete(id);
    setKept(next);
}
export function useDemoKept(): ReadonlySet<number> {
    return useSyncExternalStore(
        listener => { keptListeners.add(listener); return () => { keptListeners.delete(listener); }; },
        () => kept,
    );
}

export const startTour = () => { setKept(new Set()); set({ active: true, stop: null }); };
export const endTour = () => { setKept(new Set()); set({ active: false, stop: null }); };
export const setTourStop = (stop: string | null) => set({ ...state, stop });
export const getTour = () => state;

export function useTour(): TourState {
    return useSyncExternalStore(
        listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        () => state,
    );
}
