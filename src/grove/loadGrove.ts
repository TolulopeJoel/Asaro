/**
 * The reader's practices as trees, read from the database. The arithmetic is
 * in `grove.ts`; this only gathers periods and remembers each tree's species.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Cadence, actionKindOf, isCadence } from '../data/actionKind';
import { EnhancedActionItem, getAllActionItems } from '../data/database';
import { practiceHistory } from '../data/practiceRepository';
import { recentPeriods } from '../data/practiceStreak';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getTodayDateString } from '../utils/dateUtils';
import {
    Growth, GrowthMoment, anniversaryOf, assignSpecies, backTo, growthOf, isResting, isThirsty, keptCount, momentOf,
    rootedSeries,
} from './grove';

export interface GroveTree {
    item: EnhancedActionItem;
    cadence: Cadence;
    /** Periods kept since the practice began. */
    kept: number;
    growth: Growth;
    /** The rooted score after each period since it began, oldest first. */
    rooted: number[];
    thirsty: boolean;
    resting: boolean;
    species: number;
    /** `YYYY-MM-DD` the practice began: the day of the entry it came from. */
    startedOn: string;
}

const DAY_MS = 86_400_000;

const localDay = (value: string) => {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
};
const daysBetween = (later: string, earlier: string) => Math.round((localDay(later) - localDay(earlier)) / DAY_MS);

async function speciesFor(ids: number[]): Promise<Record<string, number>> {
    let given: Record<string, number> = {};
    try {
        given = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.GROVE_SPECIES)) ?? '{}');
    } catch {
        given = {};
    }
    const assigned = assignSpecies(ids, given);
    // Keep what was given to practices not in this list too: a resting or
    // archived practice must come back as the same tree.
    const merged = { ...given, ...assigned };
    if (JSON.stringify(merged) !== JSON.stringify(given)) {
        await AsyncStorage.setItem(STORAGE_KEYS.GROVE_SPECIES, JSON.stringify(merged)).catch(() => { });
    }
    return merged;
}

/** Every period since the practice began, oldest first, and where it began. */
function periodsOf(item: EnhancedActionItem, history: string[], today: string) {
    const cadence = item.cadence as Cadence;
    const startedOn = (item.created_at ?? today).slice(0, 10);
    const first = history[0] && history[0] < startedOn ? history[0] : startedOn;
    const sinceStart = Math.max(0, daysBetween(today, first));
    const count = cadence === 'daily' ? sinceStart + 1 : Math.floor(sinceStart / 7) + 1;
    return { periods: recentPeriods(history, cadence, today, count), first, sinceStart };
}

const isLivePractice = (item: EnhancedActionItem) =>
    item.id !== undefined && !item.archived_at && actionKindOf(item) === 'practice' && isCadence(item.cadence);

export async function loadGrove(items: EnhancedActionItem[], today = getTodayDateString()): Promise<GroveTree[]> {
    const practices = items.filter(item => item.id !== undefined && isCadence(item.cadence));
    const species = await speciesFor(practices.map(item => item.id!));

    return Promise.all(practices.map(async item => {
        const cadence = item.cadence as Cadence;
        const history = await practiceHistory(item.id!);
        const { periods, first, sinceStart } = periodsOf(item, history, today);
        const kept = keptCount(history, cadence, first);
        const last = history[history.length - 1];

        return {
            item,
            cadence,
            kept,
            growth: growthOf(cadence, kept),
            rooted: rootedSeries(periods, cadence),
            thirsty: isThirsty(periods, cadence),
            resting: isResting(last ? daysBetween(today, last) : null, sinceStart),
            species: species[item.id!] ?? 0,
            startedOn: first,
        };
    }));
}

/** A moment from keeping a practice, with what the tree needs to be drawn beside it. */
export interface KeepMoment extends GrowthMoment {
    species: number;
    /** An anniversary's remembered mark, so it is said once; null for a stage or coming back. */
    key: string | null;
}

/**
 * Anniversaries already marked, as `practiceId:m6` / `practiceId:y1`. Stages
 * are not stored: a stage can only be crossed again if a day was taken back, and
 * then reaching it again is news. Remembering them would be a mark that
 * outlives what it marked.
 */
async function announced(): Promise<Set<string>> {
    try {
        const keys: string[] = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.GROVE_MOMENTS)) ?? '[]');
        // Stage marks from before stages stopped being stored.
        return new Set(keys.filter(key => !/:\d+$/.test(key)));
    } catch {
        return new Set();
    }
}

async function saveAnnounced(keys: Set<string>) {
    await AsyncStorage.setItem(STORAGE_KEYS.GROVE_MOMENTS, JSON.stringify([...keys])).catch(() => { });
}

/**
 * What keeping this practice today just did to its tree, if it is worth a word.
 * Call it after the keep is written: it compares the tree with and without today.
 */
export async function momentOnKeep(item: EnhancedActionItem, today = getTodayDateString()): Promise<KeepMoment | null> {
    if (item.id === undefined || !isCadence(item.cadence)) return null;
    const cadence = item.cadence as Cadence;
    const history = await practiceHistory(item.id);
    const now = periodsOf(item, history, today);
    const without = history.filter(day => day !== today);
    const before = periodsOf(item, without, today).periods;

    const all = await getAllActionItems(200);
    // Against every live practice, so a new one gets the next unused tree rather than the first.
    const live = all.filter(isLivePractice).map(p => p.id!);
    const species = (await speciesFor(live.includes(item.id) ? live : [...live, item.id]))[item.id] ?? 0;

    const keptBefore = keptCount(without, cadence, now.first);
    const keptAfter = keptCount(history, cadence, now.first);
    if (keptAfter <= keptBefore) return null;
    const stage = growthOf(cadence, keptAfter).stage;
    const wasThirsty = isThirsty(before, cadence);

    // A new stage first, then an anniversary, then coming back: one word per keep.
    const reached = momentOf(cadence, keptBefore, keptAfter, species, false);
    if (reached?.kind === 'stage') return { ...reached, species, key: null };

    const anniversary = anniversaryOf(now.sinceStart, stage);
    if (anniversary) {
        const seen = await announced();
        // A deleted practice's anniversaries go with it.
        const existing = new Set(all.map(p => String(p.id)));
        for (const key of [...seen]) if (!existing.has(key.split(':')[0])) seen.delete(key);
        const key = `${item.id}:${anniversary.id}`;
        if (!seen.has(key)) {
            seen.add(key);
            await saveAnnounced(seen);
            return { ...anniversary.moment, species, key };
        }
        await saveAnnounced(seen);
    }
    return wasThirsty ? { ...backTo(stage), species, key: null } : null;
}

/** Undo a keep's anniversary, so keeping it again marks it properly. */
export async function forgetMoment(key: string) {
    const seen = await announced();
    if (seen.delete(key)) await saveAnnounced(seen);
}
