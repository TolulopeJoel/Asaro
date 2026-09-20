import { withDatabase } from './db';
import { JournalEntry } from './types';

/**
 * Fetch study further topics from the last X days.
 * Used for the "Reminders" section on the home screen.
 */
export const getRecentStudyTopics = async (days: number = 7, includeCompleted: boolean = false): Promise<JournalEntry[]> => {
    return await withDatabase(async (database) => {
        const daysParam = `-${days} days`;
        const completedFilter = includeCompleted ? '' : 'AND study_completed = 0';

        // 1. Get the 3 OLDEST uncompleted topics
        const oldestUncompletedQuery = `
            SELECT 
                *,
                datetime(created_at, 'localtime') as created_at
            FROM journal_entries
            WHERE study_further IS NOT NULL AND study_further != ''
            ${completedFilter}
            ORDER BY created_at ASC
            LIMIT 3
        `;
        const oldestList = await database.getAllAsync<JournalEntry>(oldestUncompletedQuery);

        // 2. Get the NEWEST topics from the last X days
        const newestQuery = `
            SELECT 
                *,
                datetime(created_at, 'localtime') as created_at
            FROM journal_entries
            WHERE DATE(created_at, 'localtime') >= DATE('now', 'localtime', ?)
            AND study_further IS NOT NULL AND study_further != ''
            ${completedFilter}
            ORDER BY created_at DESC
            LIMIT 6
        `;
        const newestList = await database.getAllAsync<JournalEntry>(newestQuery, [daysParam]);

        // Combine them, ensuring no duplicates by ID
        const combined = new Map<number, JournalEntry>();

        // Add newest first so they appear at the top
        for (const item of newestList) {
            if (item.id) combined.set(item.id, item);
        }

        // Add oldest
        for (const item of oldestList) {
            if (item.id && !combined.has(item.id)) {
                combined.set(item.id, item);
            }
        }

        // Backfill up to 6 if needed
        if (combined.size < 6) {
            const idsToExclude = Array.from(combined.keys()).join(',');
            const extraCount = 6 - combined.size;

            let backfillQuery = `
                SELECT 
                    *,
                    datetime(created_at, 'localtime') as created_at
                FROM journal_entries
                WHERE study_further IS NOT NULL AND study_further != ''
                ${completedFilter}
            `;
            if (idsToExclude.length > 0) {
                backfillQuery += ` AND id NOT IN (${idsToExclude})`;
            }
            backfillQuery += ` ORDER BY created_at DESC LIMIT ${extraCount}`;

            const backfillList = await database.getAllAsync<JournalEntry>(backfillQuery);
            for (const item of backfillList) {
                if (item.id) combined.set(item.id, item);
            }
        }

        // Return the combined array, sorted newest first
        return Array.from(combined.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    });
};

export const toggleStudyTopicCompletion = async (entryId: number, completed: boolean): Promise<void> => {
    await withDatabase(async (database) => {
        await database.runAsync(
            `UPDATE journal_entries SET study_completed = ? WHERE id = ?`,
            [completed ? 1 : 0, entryId]
        );
    });
};

/**
 * Fetch all study further topics.
 * Used for the "Topics" tab on the Past Entries screen.
 */
export const getAllStudyTopics = async (): Promise<JournalEntry[]> => {
    return await withDatabase(async (database) => {
        const query = `
            SELECT 
                *,
                datetime(created_at, 'localtime') as created_at
            FROM journal_entries
            WHERE study_further IS NOT NULL AND study_further != ''
            ORDER BY created_at DESC
        `;
        return await database.getAllAsync<JournalEntry>(query);
    });
};
