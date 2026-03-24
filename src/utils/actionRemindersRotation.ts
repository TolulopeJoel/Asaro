import AsyncStorage from '@react-native-async-storage/async-storage';

export type SlotKey = 'thisWeek' | 'lastWeek' | 'monthAgo';

const STORAGE_KEY = 'action_reminders_rotation_v2';

interface SlotState {
    current: number | null;
    queue: number[];   // IDs not yet shown this cycle
    date: string;      // YYYY-MM-DD when current was last picked
}

interface RotationState {
    thisWeek: SlotState;
    lastWeek: SlotState;
    monthAgo: SlotState;
}

const EMPTY_SLOT: SlotState = { current: null, queue: [], date: '' };

const getTodayString = (): string =>
    new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

const shuffled = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const loadState = async (): Promise<RotationState> => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { }
    return { thisWeek: EMPTY_SLOT, lastWeek: EMPTY_SLOT, monthAgo: EMPTY_SLOT };
};

const saveState = async (state: RotationState): Promise<void> => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { }
};

/**
 * Given a slot key and the full list of available IDs for that window,
 * returns the ID to display today. Advances the rotation on each new calendar day.
 * Never shows the same ID two days running unless it's the only option.
 */
export const getItemForSlot = async (
    slot: SlotKey,
    availableIds: number[]
): Promise<number | null> => {
    if (availableIds.length === 0) return null;
    if (availableIds.length === 1) return availableIds[0];

    const today = getTodayString();
    const state = await loadState();
    let s = state[slot];

    // Reconcile: drop IDs that no longer exist in the window
    const available = new Set(availableIds);
    let queue = s.queue.filter(id => available.has(id));
    let current = s.current !== null && available.has(s.current) ? s.current : null;

    const isNewDay = s.date !== today;

    if (isNewDay || current === null) {
        // On a new day, retire the current item and pick the next one.
        // If the queue is empty, refill it with everything except current
        // so we never repeat immediately.
        if (queue.length === 0) {
            queue = shuffled(availableIds.filter(id => id !== current));
        }

        // Edge case: only one distinct ID remains after filtering
        if (queue.length === 0) queue = availableIds;

        current = queue[0];
        queue = queue.slice(1);

        state[slot] = { current, queue, date: today };
        await saveState(state);
    } else if (queue.length !== s.queue.length) {
        // Same day but available pool changed — just persist the reconciled state
        state[slot] = { current, queue, date: today };
        await saveState(state);
    }

    return current;
};

/** Call when the set of available IDs for a slot has changed substantially
 *  (e.g. user deleted entries). Forces a fresh cycle next load. */
export const invalidateSlot = async (slot: SlotKey): Promise<void> => {
    const state = await loadState();
    state[slot] = EMPTY_SLOT;
    await saveState(state);
};
