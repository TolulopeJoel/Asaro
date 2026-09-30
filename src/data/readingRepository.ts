import { withDatabase } from './db';
import { checkRangeCovered, planPosition } from './journalRepository';
import { READING_PLAN_DATA } from './readingPlanData';
import { getPlanStart } from '../storage/planStart';

export const getReadingProgress = async (): Promise<number[]> => {
    return await withDatabase(async (database) => {
        const result = await database.getAllAsync<{ item_id: number }>(
            `SELECT item_id FROM reading_progress`
        );
        return result.map(row => row.item_id);
    });
};

export const toggleReadingItem = async (itemId: number, completed: boolean): Promise<void> => {
    await withDatabase(async (database) => {
        if (completed) {
            await database.runAsync(
                `INSERT OR REPLACE INTO reading_progress(item_id, completed_at) VALUES(?, CURRENT_TIMESTAMP)`,
                [itemId]
            );
        } else {
            await database.runAsync(
                `DELETE FROM reading_progress WHERE item_id = ? `,
                [itemId]
            );
        }
    });
};

/** The reading that comes up next, narrowed to what's left of it: see `planPosition`. */
export const getPlanPosition = async () => {
    const start = await getPlanStart();
    return await withDatabase(async (database) => {
        const entries = await database.getAllAsync<{ book_name: string; chapter_start: number; chapter_end: number | null; created_at: string }>(
            `SELECT book_name, chapter_start, chapter_end, created_at FROM journal_entries
             WHERE chapter_start IS NOT NULL
             ORDER BY created_at DESC, id DESC`
        );
        const ticked = await database.getAllAsync<{ item_id: number }>(`SELECT item_id FROM reading_progress`);
        return planPosition(
            READING_PLAN_DATA,
            entries.map(e => ({
                book: e.book_name,
                start: e.chapter_start,
                end: e.chapter_end ?? e.chapter_start,
                beforeStart: !!start && e.created_at < start.setAt,
            })),
            new Set(ticked.map(t => t.item_id)),
            start?.id,
        );
    });
};

/**
 * Check whether any journal entry exists that fully covers a plan item's chapter range.
 */
export const checkEntryCoversChapters = async (
    bookName: string,
    planChapterStart: number,
    planChapterEnd: number
): Promise<boolean> => {
    return await withDatabase(async (database) => {
        return await checkRangeCovered(database, bookName, planChapterStart, planChapterEnd);
    });
};

