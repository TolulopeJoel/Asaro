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

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { EnhancedActionItem, getAllActionItems } from '../data/database';
import { actionKindOf } from '../data/actionKind';
import {
    PracticeProgress,
    markPracticeDone,
    practiceProgress,
    unmarkPracticeDone,
} from '../data/practiceRepository';

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
}

export interface Today {
    items: TodayItem[];
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

    // Practices kept during this visit. A ref rather than state: it decides
    // what the next load keeps and must not itself cause one. Not persisted, so
    // leaving Home clears it — by then the tap is no longer the thing just
    // done.
    const keptHere = useRef<Set<number>>(new Set());

    const load = useCallback(async () => {
        if (!enabled) return;
        try {
            const all = await getAllActionItems(200);
            const live: TodayItem[] = [];

            for (const item of all) {
                // Archived has served its purpose — it asks nothing of today.
                if (item.archived_at) continue;
                const kind = actionKindOf(item);

                if (kind === 'practice') {
                    const progress: PracticeProgress = await practiceProgress(item.id!, item.cadence);
                    // Already kept today — nothing is being asked, so say
                    // nothing, unless it was kept here and is still being shown.
                    if (progress.doneNow && !keptHere.current.has(item.id!)) continue;
                    live.push({
                        item,
                        kind,
                        streak: progress.streak,
                        overdue: false,
                        kept: progress.doneNow,
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
        } catch {
            // Home never breaks for this.
            setItems([]);
        }
    }, [enabled]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const keep = useCallback(
        async (item: EnhancedActionItem) => {
            keptHere.current.add(item.id!);
            await markPracticeDone(item.id!);
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
            await unmarkPracticeDone(item.id!);
            load();
        },
        [load],
    );

    return { items, keep, undo, reload: load };
}
