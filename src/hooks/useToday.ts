/**
 * What is live today, and nothing else. Usually empty, so the strip it feeds
 * disappears rather than standing there as wallpaper.
 *
 * Deliberately narrow: it answers "is there anything I could do in fifteen
 * seconds", not "what am I carrying". The full set lives in the Library, and
 * putting it here turns a devotional app's front page into a chore list.
 *
 *   a practice appears only on a day its rhythm has not yet been kept;
 *   an action appears only once its date is near or past;
 *   an application never appears at all. It asks nothing of today.
 *
 * ONE exception: a practice kept *from here* stays on the list until the screen
 * is left, ticked and quiet at the bottom. Dropping it on the tap takes the row
 * away in the same frame the streak goes from 11 to 12, so nobody ever sees it
 * move. The row asks nothing, which is what the rule was protecting.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { EnhancedActionItem, getAllActionItems } from '../data/database';
import { actionKindOf } from '../data/actionKind';
import {
    PracticeProgress,
    markPracticeDone,
    practiceProgress,
    unmarkPracticeDone,
} from '../data/practiceRepository';
import { KeepMoment, forgetMoment, loadGrove, momentOnKeep } from '../grove/loadGrove';
import { wateredNote } from '../data/wateredNotes';
import { getTodayDateString } from '../utils/dateUtils';
import { useLocalDay } from './useLocalDay';
import { practiceChanged } from '../groups/publish';

const DAY_MS = 86_400_000;

/** How far ahead a dated action starts asking for attention. */
const DUE_SOON_DAYS = 3;

export interface TodayItem {
    item: EnhancedActionItem;
    kind: 'practice' | 'action';
    /** Periods kept in a row. Practices only. */
    streak: number;
    /** Past its date. Actions only. */
    overdue: boolean;
    /** Kept from this screen, this visit. Practices only — see the header. */
    kept: boolean;
    /** What that keep did to its tree, when it was worth a word. */
    moment?: KeepMoment;
}

/** Every practice kept for today — the state, shown for the rest of the day. */
export interface Watered {
    line: string;
    trees: { id: number; stage: number; species: number }[];
}

export interface Today {
    items: TodayItem[];
    /** Set whenever every practice is kept for today, so a finished day never looks empty. */
    watered: Watered | null;
    /** Tick a practice for today. Actions are completed from the Library. */
    keep: (item: EnhancedActionItem) => Promise<void>;
    /** Take today back. A ticked box that cannot be unticked is a lie. */
    undo: (item: EnhancedActionItem) => Promise<void>;
    reload: () => void;
}

function dueWithin(dueAt: string | null | undefined, days: number): boolean {
    if (!dueAt) return false;
    const due = new Date(dueAt).getTime();
    if (!Number.isFinite(due)) return false;
    return due - Date.now() <= days * DAY_MS;
}

export function useToday(enabled: boolean): Today {
    const [items, setItems] = useState<TodayItem[]>([]);
    const [watered, setWatered] = useState<Watered | null>(null);

    // Practices kept during this visit. A ref rather than state: it decides
    // what the next load keeps and must not itself cause one. Cleared on blur
    // and at a new day — by then the tap is no longer the thing just done.
    const keptHere = useRef<Set<number>>(new Set());
    // What each keep here did to its tree. Kept alongside `keptHere`, and for the same visit.
    const momentsHere = useRef<Map<number, KeepMoment>>(new Map());

    const load = useCallback(async () => {
        if (!enabled) return;
        try {
            const all = await getAllActionItems(200);
            const live: TodayItem[] = [];
            // Every live practice and whether its period is kept, not only the
            // rows still showing: ones kept earlier today have left the strip.
            const practices: EnhancedActionItem[] = [];
            let keptNow = 0;

            for (const item of all) {
                // Archived has served its purpose — it asks nothing of today.
                if (item.archived_at) continue;
                const kind = actionKindOf(item);

                if (kind === 'practice') {
                    const progress: PracticeProgress = await practiceProgress(item.id!, item.cadence);
                    practices.push(item);
                    if (progress.doneNow) keptNow++;
                    // Already kept today — nothing is being asked, so say
                    // nothing, unless it was kept here and is still being shown.
                    if (progress.doneNow && !keptHere.current.has(item.id!)) continue;
                    live.push({
                        item,
                        kind,
                        streak: progress.streak,
                        overdue: false,
                        kept: progress.doneNow,
                        moment: momentsHere.current.get(item.id!),
                    });
                    continue;
                }

                if (kind === 'action' && !item.is_completed && dueWithin(item.due_at, DUE_SOON_DAYS)) {
                    live.push({
                        item,
                        kind,
                        streak: 0,
                        overdue: new Date(item.due_at!).getTime() < Date.now(),
                        kept: false,
                    });
                }
            }

            // Anything already kept sinks — it is there to be seen, not done.
            // Then overdue, then practices, then what is merely approaching: a
            // practice outranks a deadline three days out because it is the
            // thing that can actually be done now.
            live.sort((a, b) => {
                if (a.kept !== b.kept) return a.kept ? 1 : -1;
                if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
                if (a.kind !== b.kind) return a.kind === 'practice' ? -1 : 1;
                return 0;
            });

            setItems(live);

            // A state, not a moment: shown whenever everything is kept, on every visit,
            // so the strip says the day is done rather than vanishing as if nothing was asked.
            const allKept = practices.length > 0 && keptNow === practices.length;
            if (allKept) {
                const trees = await loadGrove(practices);
                setWatered({
                    line: wateredNote(getTodayDateString()),
                    trees: trees.map(t => ({ id: t.item.id!, stage: t.growth.stage, species: t.species })),
                });
            } else {
                setWatered(null);
            }
        } catch {
            // Home never breaks for this.
            setItems([]);
            setWatered(null);
        }
    }, [enabled]);

    // Reloads on focus and on return to the foreground; leaving ends the visit.
    useFocusEffect(
        useCallback(() => {
            load();
            const subscription = AppState.addEventListener('change', state => {
                if (state === 'active') load();
            });
            return () => {
                subscription.remove();
                keptHere.current.clear();
                momentsHere.current.clear();
            };
        }, [load]),
    );

    // A new date is a new visit too, even with Home left open across midnight.
    const day = useLocalDay();
    const loadedDay = useRef(day);
    useEffect(() => {
        if (loadedDay.current === day) return;
        loadedDay.current = day;
        keptHere.current.clear();
        momentsHere.current.clear();
        load();
    }, [day, load]);

    const keep = useCallback(
        async (item: EnhancedActionItem) => {
            keptHere.current.add(item.id!);
            await markPracticeDone(item.id!);
            void practiceChanged(item.id!);
            try {
                const moment = await momentOnKeep(item);
                if (moment) momentsHere.current.set(item.id!, moment);
            } catch {
                // A tree that cannot be read never stops the keep.
            }
            load();
        },
        [load],
    );

    /*
     * Untick. Dropping it from `keptHere` too is what makes the row go back to
     * being an ordinary unkept practice rather than a ticked one that has
     * forgotten it was ticked.
     */
    const undo = useCallback(
        async (item: EnhancedActionItem) => {
            keptHere.current.delete(item.id!);
            const moment = momentsHere.current.get(item.id!);
            momentsHere.current.delete(item.id!);
            if (moment?.key) await forgetMoment(moment.key).catch(() => { });
            await unmarkPracticeDone(item.id!);
            void practiceChanged(item.id!);
            load();
        },
        [load],
    );

    return { items, watered, keep, undo, reload: load };
}
