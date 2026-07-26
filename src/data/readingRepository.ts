import { withDatabase } from './db';
import { checkRangeCovered } from './journalRepository';

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

/**
 * Returns the item_id of the most recently completed reading plan item,
 * or null if nothing has been completed yet.
 */
export const getLastCompletedReadingItemId = async (): Promise<number | null> => {
    return await withDatabase(async (database) => {
        const result = await database.getFirstAsync<{ item_id: number }>(
            `SELECT item_id FROM reading_progress ORDER BY completed_at DESC LIMIT 1`
        );
        return result?.item_id ?? null;
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
