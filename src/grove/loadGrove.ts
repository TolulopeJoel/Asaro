/**
 * The reader's practices as trees, read from the database. The arithmetic is
 * in `grove.ts`; this only gathers periods and remembers each tree's species.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Cadence, isCadence } from '../data/actionKind';
import { EnhancedActionItem } from '../data/database';
import { practiceHistory } from '../data/practiceRepository';
import { recentPeriods } from '../data/practiceStreak';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getTodayDateString } from '../utils/dateUtils';
import { Growth, assignSpecies, growthOf, isResting, isThirsty, rootedSeries } from './grove';

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

export async function loadGrove(items: EnhancedActionItem[], today = getTodayDateString()): Promise<GroveTree[]> {
    const practices = items.filter(item => item.id !== undefined && isCadence(item.cadence));
    const species = await speciesFor(practices.map(item => item.id!));

    return Promise.all(practices.map(async item => {
        const cadence = item.cadence as Cadence;
        const history = await practiceHistory(item.id!);
        const startedOn = (item.created_at ?? today).slice(0, 10);
        const first = history[0] && history[0] < startedOn ? history[0] : startedOn;
        const sinceStart = Math.max(0, daysBetween(today, first));
        const count = cadence === 'daily' ? sinceStart + 1 : Math.floor(sinceStart / 7) + 1;
        const periods = recentPeriods(history, cadence, today, count);
        const kept = periods.filter(Boolean).length;
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
