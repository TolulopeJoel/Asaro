import { withDatabase } from './db';
import { retractKeys } from '../insight/observation';
import { JournalEntry, StudyItem } from './types';

/** A topic with the entry it was written in, as the Questions tab lists it. */
export interface StudyTopic extends StudyItem {
    entry: JournalEntry;
}

export const toggleStudyTopicCompletion = async (topicId: number, completed: boolean): Promise<void> => {
    await withDatabase(async (database) => {
        await database.runAsync(`UPDATE study_items SET completed = ? WHERE id = ?`, [completed ? 1 : 0, topicId]);
        if (completed) await retractKeys(database, 'study', [`topic:${topicId}`]);
    });
};

/** Every topic, newest entry first and in written order within an entry. Feeds Library → Questions. */
export const getAllStudyTopics = async (): Promise<StudyTopic[]> => {
    return await withDatabase(async (database) => {
        const rows = await database.getAllAsync<{
            id: number; entry_id: number; topic: string; reminder: string | null; completed: number; sort_order: number;
            book_name: string; chapter_start: number; chapter_end: number | null;
            verse_start: string | null; verse_end: string | null; created_at: string;
        }>(`
            SELECT si.id, si.entry_id, si.topic, si.reminder, si.completed, si.sort_order,
                   je.book_name, je.chapter_start, je.chapter_end, je.verse_start, je.verse_end,
                   datetime(je.created_at, 'localtime') AS created_at
            FROM study_items si
            JOIN journal_entries je ON je.id = si.entry_id
            WHERE TRIM(si.topic) != ''
            ORDER BY je.created_at DESC, si.sort_order ASC
        `);
        return rows.map(row => ({
            id: row.id,
            entry_id: row.entry_id,
            topic: row.topic,
            reminder: row.reminder,
            completed: !!row.completed,
            sort_order: row.sort_order,
            entry: {
                id: row.entry_id,
                book_name: row.book_name,
                chapter_start: row.chapter_start,
                chapter_end: row.chapter_end ?? undefined,
                verse_start: row.verse_start ?? undefined,
                verse_end: row.verse_end ?? undefined,
                created_at: row.created_at,
            },
        }));
    });
};
