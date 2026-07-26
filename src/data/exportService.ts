import { withDatabase } from './db';
import { attachActionItems } from './journalRepository';
import { JournalEntry } from './types';

/**
 * Export all journal entries as a JSON string
 */
export const exportJournalEntriesToJson = async (): Promise<string> => {
    return await withDatabase(async (database) => {
        const entries = await database.getAllAsync<JournalEntry>(`
            SELECT 
                id,
                book_name,
                chapter_start,
                chapter_end,
                verse_start,
                verse_end,
                reflection_1,
                reflection_2,
                reflection_3,
                reflection_4,
                notes,
                study_further,
                study_further_reminder,
                study_completed,
                created_at,
                updated_at
            FROM journal_entries
            ORDER BY created_at ASC
        `);

        const entriesWithItems = await attachActionItems(database, entries);

        const readingProgress = await database.getAllAsync<{ item_id: number; completed_at: string }>(
            `SELECT item_id, completed_at FROM reading_progress`
        );

        const payload = {
            version: 4,
            exportedAt: new Date().toISOString(),
            entries: entriesWithItems,
            readingProgress: readingProgress.map(rp => ({
                item_id: rp.item_id,
                completed_at: rp.completed_at
            })),
        };

        return JSON.stringify(payload, null, 2);
    });
};

/**
 * Import journal entries from a JSON string previously created by exportJournalEntriesToJson.
 */
export const importJournalEntriesFromJson = async (json: string): Promise<{
    importedEntries: number;
    skippedEntries: number;
    importedReadingItems: number;
    skippedReadingItems: number;
}> => {
    let parsed: any;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error('Invalid JSON file');
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
        throw new Error('Invalid backup format');
    }

    const entries = parsed.entries as Partial<JournalEntry>[];

    return await withDatabase(async (database) => {
        await database.execAsync('BEGIN TRANSACTION');
        try {
            let importedEntries = 0;
            let skippedEntries = 0;
            let importedReadingItems = 0;
            let skippedReadingItems = 0;

            // 1. Process Journal Entries
            for (const entry of entries) {
                if (!entry.book_name || !entry.created_at) {
                    skippedEntries++;
                    continue;
                }

                const existing = await database.getFirstAsync<{ id: number }>(
                    `SELECT id FROM journal_entries
                     WHERE book_name = ? AND chapter_start IS ? AND DATE(created_at) = DATE(?)`,
                    [entry.book_name, entry.chapter_start ?? null, entry.created_at]
                );

                if (existing) {
                    skippedEntries++;
                    continue;
                }

                const createdAt = entry.created_at;
                const updatedAt = entry.updated_at ?? createdAt;

                const result = await database.runAsync(
                    `INSERT INTO journal_entries (
                        book_name, chapter_start, chapter_end, verse_start, verse_end,
                        reflection_1, reflection_2, reflection_3, reflection_4, notes,
                        study_further, study_further_reminder, created_at, updated_at, study_completed
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        entry.book_name,
                        entry.chapter_start ?? null,
                        entry.chapter_end ?? null,
                        entry.verse_start ?? null,
                        entry.verse_end ?? null,
                        entry.reflection_1 ?? '',
                        entry.reflection_2 ?? '',
                        entry.reflection_3 ?? '',
                        entry.reflection_4 ?? '',
                        entry.notes ?? null,
                        entry.study_further ?? null,
                        entry.study_further_reminder ?? null,
                        createdAt,
                        updatedAt,
                        entry.study_completed ? 1 : 0,
                    ]
                );

                if (entry.action_items && entry.action_items.length > 0) {
                    const newEntryId = result.lastInsertRowId;
                    for (let i = 0; i < entry.action_items.length; i++) {
                        const item = entry.action_items[i];
                        await database.runAsync(
                            `INSERT INTO action_items (entry_id, action, motivation, sort_order, is_completed, is_pinned) VALUES (?, ?, ?, ?, ?, ?)`,
                            [newEntryId, item.action ?? '', item.motivation ?? '', item.sort_order ?? i, item.is_completed ? 1 : 0, item.is_pinned ? 1 : 0]
                        );
                    }
                }

                importedEntries++;
            }

            // 2. Process Reading Progress (if version >= 3)
            if (parsed.version >= 3 && Array.isArray(parsed.readingProgress)) {
                for (const item of parsed.readingProgress) {
                    const itemId = typeof item === 'number' ? item : item.item_id;
                    const completedAt = typeof item === 'object' ? item.completed_at : null;

                    const existing = await database.getFirstAsync<{ item_id: number }>(
                        `SELECT item_id FROM reading_progress WHERE item_id = ?`,
                        [itemId]
                    );

                    if (existing) {
                        skippedReadingItems++;
                        continue;
                    }

                    if (completedAt) {
                        await database.runAsync(
                            `INSERT INTO reading_progress (item_id, completed_at) VALUES (?, ?)`,
                            [itemId, completedAt]
                        );
                    } else {
                        await database.runAsync(
                            `INSERT INTO reading_progress (item_id) VALUES (?)`,
                            [itemId]
                        );
                    }
                    importedReadingItems++;
                }
            }

            await database.execAsync('COMMIT');
            return { importedEntries, skippedEntries, importedReadingItems, skippedReadingItems };
        } catch (error) {
            await database.execAsync('ROLLBACK');
            throw error;
        }
    });
};
