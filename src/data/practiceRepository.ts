/**
 * Marking a practice done, and reading back how it has gone.
 *
 * Deliberately thin. All the arithmetic lives in `practiceStreak.ts` where it
 * can be tested at a boundary; this only moves rows.
 */

import { withDatabase } from './db';
import { Cadence, isCadence } from './actionKind';
import { CompletedOn, doneThisPeriod, streakOf } from './practiceStreak';
import { getTodayDateString } from '../utils/dateUtils';

export interface PracticeProgress {
    /** Periods kept in a row, counting back from today. */
    streak: number;
    /** Whether today (or this week) already has a completion. */
    doneNow: boolean;
    /** Completions in the window read, newest first. */
    completions: CompletedOn[];
}

/**
 * Mark a practice done for a day. Idempotent.
 *
 * The primary key does the work: the same tap arriving twice — from a card and
 * a list, or eventually from a widget — records one completion.
 */
export async function markPracticeDone(
    actionItemId: number,
    on: CompletedOn = getTodayDateString(),
): Promise<void> {
    await withDatabase(database =>
        database.runAsync(
            `INSERT OR IGNORE INTO action_item_completions (action_item_id, completed_on)
             VALUES (?, ?)`,
            [actionItemId, on],
        ),
    );
}

/** Undo a day. Tapping a done practice should put it back, not add a second row. */
export async function unmarkPracticeDone(
    actionItemId: number,
    on: CompletedOn = getTodayDateString(),
): Promise<void> {
    await withDatabase(database =>
        database.runAsync(
            `DELETE FROM action_item_completions WHERE action_item_id = ? AND completed_on = ?`,
            [actionItemId, on],
        ),
    );
}

/**
 * How a practice is going.
 *
 * A year of history is read rather than all of it: a streak longer than that
 * needs a different sentence than a number anyway, and it bounds the query on
 * a journal that may run for years.
 */
export async function practiceProgress(
    actionItemId: number,
    cadence: string | null | undefined,
    today: CompletedOn = getTodayDateString(),
): Promise<PracticeProgress> {
    if (!isCadence(cadence)) return { streak: 0, doneNow: false, completions: [] };

    const rows = await withDatabase(database =>
        database.getAllAsync<{ completed_on: string }>(
            `SELECT completed_on FROM action_item_completions
             WHERE action_item_id = ?
             ORDER BY completed_on DESC
             LIMIT 400`,
            [actionItemId],
        ),
    );

    const completions = rows.map(row => row.completed_on);
    return {
        streak: streakOf(completions, cadence as Cadence, today),
        doneNow: doneThisPeriod(completions, cadence as Cadence, today),
        completions,
    };
}
