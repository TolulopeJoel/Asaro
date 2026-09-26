import { withDatabase, withTransaction } from './db';
import { attachActionItems } from './journalRepository';
import { JournalEntry } from './types';

/**
 * v5 nests each action item's completions under it and adds named themes, whose
 * members point at entries by their id in this backup.
 */
const BACKUP_VERSION = 5;

interface Completion { completed_on: string; completed_at?: string | null }
interface BackupTheme {
    name: string;
    created_at?: string;
    updated_at?: string;
    members: { entry_id: number; field: string }[];
}

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

        const completions = await database.getAllAsync<Completion & { action_item_id: number }>(
            `SELECT action_item_id, completed_on, completed_at FROM action_item_completions ORDER BY completed_on ASC`
        );
        const completionsByItem = new Map<number, Completion[]>();
        for (const { action_item_id, ...completion } of completions) {
            const list = completionsByItem.get(action_item_id) ?? [];
            list.push(completion);
            completionsByItem.set(action_item_id, list);
        }

        const readingProgress = await database.getAllAsync<{ item_id: number; completed_at: string }>(
            `SELECT item_id, completed_at FROM reading_progress`
        );

        const themes = await database.getAllAsync<{ id: number; name: string; created_at: string; updated_at: string }>(
            `SELECT id, name, created_at, updated_at FROM themes`
        );
        const members = await database.getAllAsync<{ theme_id: number; entry_id: number; field: string }>(
            `SELECT theme_id, entry_id, field FROM theme_members`
        );

        const payload = {
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            entries: entriesWithItems.map(entry => ({
                ...entry,
                action_items: (entry.action_items ?? []).map(item => ({
                    ...item,
                    completions: completionsByItem.get(item.id!) ?? [],
                })),
            })),
            readingProgress: readingProgress.map(rp => ({
                item_id: rp.item_id,
                completed_at: rp.completed_at
            })),
            themes: themes.map((theme): BackupTheme => ({
                name: theme.name,
                created_at: theme.created_at,
                updated_at: theme.updated_at,
                members: members
                    .filter(member => member.theme_id === theme.id)
                    .map(member => ({ entry_id: member.entry_id, field: member.field })),
            })),
        };

        return JSON.stringify(payload, null, 2);
    });
};

/**
 * Import journal entries from a JSON string previously created by exportJournalEntriesToJson.
 * Backups from every earlier version still import; what they lack is left empty.
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

    const entries = parsed.entries as (Partial<JournalEntry> & { action_items?: any[] })[];

    return await withTransaction(async (database) => {
        let importedEntries = 0;
        let skippedEntries = 0;
        let importedReadingItems = 0;
        let skippedReadingItems = 0;

        // Backup entry id → id on this device, for themes.
        const entryIds = new Map<number, number>();

        const importCompletions = async (actionItemId: number, completions: unknown) => {
            if (!Array.isArray(completions)) return;
            for (const completion of completions as Completion[]) {
                if (!completion?.completed_on) continue;
                await database.runAsync(
                    `INSERT OR IGNORE INTO action_item_completions (action_item_id, completed_on, completed_at)
                     VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
                    [actionItemId, completion.completed_on, completion.completed_at ?? null]
                );
            }
        };

        // 1. Process Journal Entries
        for (const entry of entries) {
            if (!entry.book_name || !entry.created_at) {
                skippedEntries++;
                continue;
            }

            // The same entry, not merely the same passage on the same day.
            const existing = await database.getFirstAsync<{ id: number }>(
                `SELECT id FROM journal_entries WHERE book_name = ? AND chapter_start IS ? AND created_at = ?`,
                [entry.book_name, entry.chapter_start ?? null, entry.created_at]
            );

            if (existing) {
                if (entry.id != null) entryIds.set(entry.id, existing.id);
                // Completions logged since that backup still merge into the item they belong to.
                for (const item of entry.action_items ?? []) {
                    const match = await database.getFirstAsync<{ id: number }>(
                        `SELECT id FROM action_items WHERE entry_id = ? AND action = ? AND sort_order = ?`,
                        [existing.id, item.action ?? '', item.sort_order ?? 0]
                    );
                    if (match) await importCompletions(match.id, item.completions);
                }
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

            const newEntryId = result.lastInsertRowId;
            if (entry.id != null) entryIds.set(entry.id, newEntryId);

            const items = entry.action_items ?? [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                // cadence/due_at are absent from pre-v11 backups, whose items were all applications.
                const inserted = await database.runAsync(
                    `INSERT INTO action_items (entry_id, action, motivation, sort_order, is_completed, is_pinned, pinned_at, cadence, due_at, archived_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newEntryId, item.action ?? '', item.motivation ?? '', item.sort_order ?? i, item.is_completed ? 1 : 0, item.is_pinned ? 1 : 0, item.is_pinned ? item.pinned_at ?? null : null, item.cadence ?? null, item.due_at ?? null, item.archived_at ?? null]
                );
                await importCompletions(inserted.lastInsertRowId, item.completions);
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

        // 3. Named themes (v5). A theme already here by name gains the members.
        if (Array.isArray(parsed.themes)) {
            for (const theme of parsed.themes as BackupTheme[]) {
                const name = typeof theme?.name === 'string' ? theme.name.trim() : '';
                const members = (Array.isArray(theme?.members) ? theme.members : [])
                    .filter(member => entryIds.has(member.entry_id) && member.field);
                if (!name || members.length === 0) continue;

                const existing = await database.getFirstAsync<{ id: number }>(
                    `SELECT id FROM themes WHERE name = ?`, [name]
                );
                const themeId = existing?.id ?? (await database.runAsync(
                    `INSERT INTO themes (name, created_at, updated_at)
                     VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))`,
                    [name, theme.created_at ?? null, theme.updated_at ?? null]
                )).lastInsertRowId;

                for (const member of members) {
                    await database.runAsync(
                        `INSERT OR IGNORE INTO theme_members (theme_id, entry_id, field) VALUES (?, ?, ?)`,
                        [themeId, entryIds.get(member.entry_id)!, member.field]
                    );
                }
            }
        }

        return { importedEntries, skippedEntries, importedReadingItems, skippedReadingItems };
    });
};
