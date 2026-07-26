import { withDatabase } from './db';
import { JournalEntry, StudyTopic, StudyTopicInput, StudyTopicReference } from './types';

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

export const getStudyTopics = async (): Promise<StudyTopic[]> => {
    return await withDatabase(async (database) => {
        const result = await database.getAllAsync<StudyTopic>(
            `SELECT * FROM study_topics ORDER BY updated_at DESC`
        );

        // Fetch references for each topic
        const topics = [...result];
        for (let i = 0; i < topics.length; i++) {
            const refs = await database.getAllAsync<StudyTopicReference>(
                `SELECT * FROM study_topic_references WHERE topic_id = ?`,
                [topics[i].id]
            );
            topics[i].references = refs;
        }

        return topics;
    });
};

export const createStudyTopic = async (input: StudyTopicInput): Promise<number> => {
    return await withDatabase(async (database) => {
        const result = await database.runAsync(
            `INSERT INTO study_topics (title, content, color) VALUES (?, ?, ?)`,
            [input.title, input.content || '', input.color || '#E18F43']
        );

        const topicId = result.lastInsertRowId;

        if (input.references && input.references.length > 0) {
            for (const ref of input.references) {
                await database.runAsync(
                    `INSERT INTO study_topic_references (topic_id, book_name, chapter, verse_start, verse_end) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [topicId, ref.book_name, ref.chapter, ref.verse_start || null, ref.verse_end || null]
                );
            }
        }

        return topicId;
    });
};

export const updateStudyTopic = async (id: number, input: Partial<StudyTopicInput>): Promise<void> => {
    return await withDatabase(async (database) => {
        const fields: string[] = [];
        const values: any[] = [];

        if (input.title !== undefined) { fields.push('title = ?'); values.push(input.title); }
        if (input.content !== undefined) { fields.push('content = ?'); values.push(input.content); }
        if (input.color !== undefined) { fields.push('color = ?'); values.push(input.color); }

        fields.push('updated_at = CURRENT_TIMESTAMP');

        if (fields.length > 1) {
            await database.runAsync(
                `UPDATE study_topics SET ${fields.join(', ')} WHERE id = ?`,
                [...values, id]
            );
        }

        if (input.references !== undefined) {
            await database.runAsync(`DELETE FROM study_topic_references WHERE topic_id = ?`, [id]);
            for (const ref of input.references) {
                await database.runAsync(
                    `INSERT INTO study_topic_references (topic_id, book_name, chapter, verse_start, verse_end) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [id, ref.book_name, ref.chapter, ref.verse_start || null, ref.verse_end || null]
                );
            }
        }
    });
};
