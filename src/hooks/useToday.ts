/**
 * What is live today, and nothing else.
 *
 * Home's problem was never how many blocks it had — it was that every block
 * was unconditional, so the screen looked identical on a day with something to
 * do and a day without. This is the other half: a small set that is usually
 * empty, so the strip it feeds disappears rather than standing there as
 * wallpaper.
 *
 * Deliberately narrow. It answers "is there anything I could do in fifteen
 * seconds", not "what am I carrying". The full set lives in the Library, and
 * putting it here would turn a devotional app's front page into a chore list —
 * which is the exact framing the whole action-item rework exists to undo.
 *
 * So:
 *   a practice appears only on a day its rhythm has not yet been kept;
 *   an action appears only once its date is near or past;
 *   an application never appears at all. It asks nothing of today.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { EnhancedActionItem, getAllActionItems } from '../data/database';
import { actionKindOf } from '../data/actionKind';
import { PracticeProgress, markPracticeDone, practiceProgress } from '../data/practiceRepository';

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
}

export interface Today {
    items: TodayItem[];
    /** Tick a practice for today. Actions are completed from the Library. */
    keep: (item: EnhancedActionItem) => Promise<void>;
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
                    // Already kept today — nothing is being asked, so say nothing.
                    if (progress.doneNow) continue;
                    live.push({ item, kind, streak: progress.streak, overdue: false });
                    continue;
                }

                if (kind === 'action' && !item.is_completed && dueWithin(item.due_at, DUE_SOON_DAYS)) {
                    live.push({
                        item,
                        kind,
                        streak: 0,
                        overdue: new Date(item.due_at!).getTime() < Date.now(),
                    });
                }
            }

            /*
             * Overdue first, then practices, then what is merely approaching.
             * A practice sits above a deadline three days out because it is the
             * thing that can actually be done now.
             */
            live.sort((a, b) => {
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
            await markPracticeDone(item.id!);
            load();
        },
        [load],
    );

    return { items, keep, reload: load };
}
