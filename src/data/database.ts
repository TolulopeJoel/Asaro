import * as SQLite from 'expo-sqlite';
import { formatDateToLocalString, getTodayDateString } from '../utils/dateUtils';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { queueActivity, syncPendingActivities } from '../utils/syncActivities';
import { READING_PLAN_DATA } from './readingPlanData';

/**
 * Given a book name and chapter start/end, find ALL reading plan items
 * that are now fully covered by the combination of ALL entries in the database.
 * 
 * A plan item is marked only when the entire chapter range is accounted for.
 * This handles cases where a user completes a plan item using multiple entries
 * (e.g., Gen 1, Gen 2, and Gen 3 individually covering the Gen 1-3 plan item).
 */
const findMatchingReadingPlanItems = async (
    database: SQLite.SQLiteDatabase,
    bookName: string,
    chapterStart?: number,
    chapterEnd?: number
): Promise<number[]> => {
    if (!chapterStart) return [];

    const effectiveEnd = chapterEnd ?? chapterStart;
    const matched: number[] = [];

    for (const item of READING_PLAN_DATA) {
        if (item.book.toLowerCase() !== bookName.toLowerCase()) continue;

        // Parse the plan item's chapter range (ignore verse suffixes like "119:64-176")
        const rawChapters = item.chapters;
        if (!rawChapters) continue;

        // Strip verse notation: "119:64-176" → start=119, end=119; "116-119:63" → start=116, end=119
        const parts = rawChapters.split('-');
        const firstHasVerse = parts[0].includes(':');
        const planStart = parseInt(parts[0].split(':')[0], 10);

        let planEnd: number;
        if (parts.length > 1) {
            if (firstHasVerse) {
                // If the FIRST part has a verse (119:64), the SECOND part is a verse in the same chapter
                planEnd = planStart;
            } else {
                // Example: "116-119:63" -> start is 116, end is 119
                planEnd = parseInt(parts[parts.length - 1].split(':')[0], 10);
            }
        } else {
            planEnd = planStart;
        }

        if (isNaN(planStart) || isNaN(planEnd)) continue;

        // Check if the current entry even touches this plan item
        const overlapsWithCurrentEntry = chapterStart <= planEnd && effectiveEnd >= planStart;
        if (!overlapsWithCurrentEntry) continue;

        // Check if the entire range for this plan item is now covered by ALL entries
        const isFullyCovered = await checkRangeCovered(database, bookName, planStart, planEnd);
        if (isFullyCovered) {
            matched.push(item.id);
        }
    }

    return matched;
};

/**
 * Internal helper to check if a chapter range is fully covered by the union of entries.
 */
const checkRangeCovered = async (
    database: SQLite.SQLiteDatabase,
    bookName: string,
    start: number,
    end: number
): Promise<boolean> => {
    const rangeSize = end - start + 1;
    const query = `
        WITH RECURSIVE chapters(n) AS (
            SELECT ? 
            UNION ALL
            SELECT n + 1 FROM chapters WHERE n < ?
        )
        SELECT COUNT(*) as coveredCount FROM chapters
        WHERE EXISTS (
            SELECT 1 FROM journal_entries
            WHERE book_name = ?
              AND chapter_start <= chapters.n
              AND COALESCE(chapter_end, chapter_start) >= chapters.n
        )
    `;
    const result = await database.getFirstAsync<{ coveredCount: number }>(query, [start, end, bookName]);
    return (result?.coveredCount ?? 0) === rangeSize;
};

export interface ActionItem {
    id?: number;
    entry_id?: number;
    action: string;
    motivation: string;
    sort_order: number;
    is_completed?: boolean;
    is_pinned?: boolean;
}

export interface JournalEntry {
    id?: number;
    book_name: string;
    chapter_start: number;
    chapter_end?: number;
    verse_start?: string;
    verse_end?: string;
    reflection_1?: string;
    reflection_2?: string;
    reflection_3?: string;
    reflection_4?: string;
    notes?: string;
    study_further?: string;
    study_further_reminder?: string;
    study_completed?: boolean;
    created_at: string;
    updated_at?: string;
    action_items?: ActionItem[];
}

export interface JournalEntryInput {
    bookName: string;
    chapterStart?: number;
    chapterEnd?: number;
    verseStart?: string;
    verseEnd?: string;
    reflections: string[];
    notes?: string;
    studyFurther?: string;
    studyFurtherReminder?: string;
    actionItems?: { action: string; motivation: string }[];
    readingItemId?: number;
}

let db: SQLite.SQLiteDatabase | null = null;

const CURRENT_DB_VERSION = 7;

const getDb = async () => {
    if (!db) {
        db = await SQLite.openDatabaseAsync('bibleJournal.db');
    }
    return db;
};

/**
 * Helper to retry database operations if the connection is lost/closed
 */
const withDatabase = async <T>(operation: (database: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
    try {
        const database = await getDb();
        return await operation(database);
    } catch (error: any) {
        // Check for "shared object that was already released" error
        if (error?.message?.includes('shared object that was already released') ||
            error?.message?.includes('Cannot use shared object')) {
            console.warn('Database connection lost, reconnecting...');

            // Force reset database connection
            db = null;

            // Retry once
            const database = await getDb();
            return await operation(database);
        }
        throw error;
    }
};

const getDbVersion = async (database: SQLite.SQLiteDatabase): Promise<number> => {
    try {
        const result = await database.getFirstAsync(`PRAGMA user_version`) as any;
        return result?.user_version || 0;
    } catch {
        return 0;
    }
};

const setDbVersion = async (database: SQLite.SQLiteDatabase, version: number) => {
    await database.execAsync(`PRAGMA user_version = ${version}`);
};

export const initializeDatabase = async () => {
    try {
        return await withDatabase(async (database) => {
            const currentVersion = await getDbVersion(database);

            // Run migrations based on version
            if (currentVersion === 0) {
                // First time setup
                await database.execAsync(`
                    CREATE TABLE IF NOT EXISTS journal_entries (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        book_name TEXT NOT NULL,
                        chapter_start INTEGER,
                        chapter_end INTEGER,
                        verse_start TEXT,
                        verse_end TEXT,
                        reflection_1 TEXT,
                        reflection_2 TEXT,
                        reflection_3 TEXT,
                        reflection_4 TEXT,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_book_name ON journal_entries(book_name);
                    CREATE INDEX IF NOT EXISTS idx_created_at ON journal_entries(created_at);
                `);
            };

            if (currentVersion < 2) {
                // Migration from v1 to v2: Remove date_created and reflection_5
                const tableInfo = await database.getAllAsync(`PRAGMA table_info(journal_entries)`) as any[];
                const hasDateCreated = tableInfo.some((col: any) => col.name === 'date_created');

                if (hasDateCreated) {
                    await database.execAsync(`
                        BEGIN TRANSACTION;
                        
                        CREATE TABLE journal_entries_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            book_name TEXT NOT NULL,
                            chapter_start INTEGER,
                            chapter_end INTEGER,
                            verse_start TEXT,
                            verse_end TEXT,
                            reflection_1 TEXT,
                            reflection_2 TEXT,
                            reflection_3 TEXT,
                            reflection_4 TEXT,
                            notes TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                        
                        INSERT INTO journal_entries_new 
                            (id, book_name, chapter_start, chapter_end, verse_start, verse_end, 
                             reflection_1, reflection_2, reflection_3, reflection_4, notes, created_at, updated_at)
                        SELECT 
                            id, book_name, chapter_start, chapter_end, verse_start, verse_end,
                            reflection_1, reflection_2, reflection_3, reflection_4, notes,
                            COALESCE(created_at, date_created) as created_at,
                            updated_at
                        FROM journal_entries;
                        
                        DROP TABLE journal_entries;
                        ALTER TABLE journal_entries_new RENAME TO journal_entries;
                        CREATE INDEX IF NOT EXISTS idx_book_name ON journal_entries(book_name);
                        CREATE INDEX IF NOT EXISTS idx_created_at ON journal_entries(created_at);
                        
                        COMMIT;
                    `);
                };
            };

            if (currentVersion < 3) {
                // Migration to v3: Create action_items table
                await database.execAsync(`
                    CREATE TABLE IF NOT EXISTS action_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
                        action TEXT NOT NULL DEFAULT '',
                        motivation TEXT DEFAULT '',
                        sort_order INTEGER NOT NULL DEFAULT 0
                    );
                    CREATE INDEX IF NOT EXISTS idx_action_items_entry ON action_items(entry_id);
                `);

                // Migrate existing reflection_3 data into action_items
                const entriesWithR3 = await database.getAllAsync<{ id: number; reflection_3: string }>(
                    `SELECT id, reflection_3 FROM journal_entries WHERE reflection_3 IS NOT NULL AND reflection_3 != ''`
                );

                for (const entry of entriesWithR3) {
                    await database.runAsync(
                        `INSERT INTO action_items (entry_id, action, motivation, sort_order) VALUES (?, ?, '', 0)`,
                        [entry.id, entry.reflection_3]
                    );
                }
            };

            if (currentVersion < 4) {
                // Migration to v4: Create reading_progress table
                await database.execAsync(`
                    CREATE TABLE IF NOT EXISTS reading_progress (
                        item_id INTEGER PRIMARY KEY,
                        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);
            };

            if (currentVersion < 5) {
                // Migration to v5: Add study_further columns
                await database.execAsync(`
                    ALTER TABLE journal_entries ADD COLUMN study_further TEXT;
                    ALTER TABLE journal_entries ADD COLUMN study_further_reminder TEXT;
                `);
            };

            if (currentVersion < 6) {
                // Migration to v6: Add completion status
                await database.execAsync(`
                    ALTER TABLE action_items ADD COLUMN is_completed BOOLEAN DEFAULT 0;
                    ALTER TABLE journal_entries ADD COLUMN study_completed BOOLEAN DEFAULT 0;
                `);
            }

            if (currentVersion < 7) {
                await database.execAsync(`
                    ALTER TABLE action_items ADD COLUMN is_pinned BOOLEAN DEFAULT 0;
                `);
            }

            // Set to current version
            await setDbVersion(database, CURRENT_DB_VERSION);

            return true;
        });
    } catch (error) {
        console.error('Database init error:', error);
        return false;
    }
};

export const createJournalEntry = async (data: JournalEntryInput) => {
    const reflections = [...data.reflections, '', '', '', ''].slice(0, 4);

    return await withDatabase(async (database) => {
        // ── 1. Local SQLite write (always completes, even offline) ──────────
        const result = await database.runAsync(
            `INSERT INTO journal_entries (book_name, chapter_start, chapter_end, verse_start, verse_end, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further, study_further_reminder)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.bookName, data.chapterStart ?? null, data.chapterEnd ?? null, data.verseStart ?? null, data.verseEnd ?? null, ...reflections, data.notes ?? null, data.studyFurther ?? null, data.studyFurtherReminder ?? null]
        );

        const entryId = result.lastInsertRowId;

        // Insert action items
        if (data.actionItems && data.actionItems.length > 0) {
            for (let i = 0; i < data.actionItems.length; i++) {
                const item = data.actionItems[i];
                if (item.action.trim() || item.motivation.trim()) {
                    await database.runAsync(
                        `INSERT INTO action_items (entry_id, action, motivation, sort_order) VALUES (?, ?, ?, ?)`,
                        [entryId, item.action, item.motivation, i]
                    );
                }
            }
        }

        // Mark reading plan items as completed.
        // If an explicit readingItemId was provided (via the Next Reading button), use only that.
        // Otherwise, find ALL plan items whose chapter range overlaps with the entry's range
        // (handles cases like entering ch 22-28 across multiple plan items).
        const planItemIds = data.readingItemId
            ? [data.readingItemId]
            : await findMatchingReadingPlanItems(database, data.bookName, data.chapterStart, data.chapterEnd);

        for (const planItemId of planItemIds) {
            await database.runAsync(
                `INSERT OR IGNORE INTO reading_progress (item_id) VALUES (?)`,
                [planItemId]
            );
        }

        // ── 2. Firestore group-activity push (fire-and-forget) ──────────────
        // Runs in the background so it never blocks navigation.
        // If offline, the payload is queued in AsyncStorage and retried later.
        void (async () => {
            try {
                const user = auth().currentUser;
                if (!user) return;

                const userDoc = await firestore().collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                if (!userData?.groupIds?.length) return;

                const chapters = data.chapterEnd && data.chapterEnd !== data.chapterStart
                    ? `${data.chapterStart}-${data.chapterEnd}`
                    : `${data.chapterStart}`;

                // Build a short preview from the first non-empty field:
                // reflections → notes → first action item
                const previewText = (
                    data.reflections?.find(r => r?.trim().length > 0)?.trim() ||
                    data.notes?.trim() ||
                    data.actionItems?.find(a => a?.action?.trim().length > 0)?.action?.trim()
                );
                const reflectionPreview = previewText
                    ? previewText.slice(0, 45) + (previewText.length > 45 ? '…' : '')
                    : undefined;

                const resolvedName = user.displayName || user.email?.split('@')[0] || 'Reader';
                const totalEntries = await getTotalJournalCount();

                const activity = {
                    userId: user.uid,
                    userName: resolvedName,
                    bookName: data.bookName,
                    chapters,
                    type: 'journal_entry' as any,
                    queuedAt: new Date().toISOString(),
                    reflectionPreview,
                    totalEntries,
                };

                await queueActivity(activity);
                await syncPendingActivities();
            } catch (error) {
                console.error('[createJournalEntry] Background Firestore sync error:', error);
            }
        })();

        return entryId;
    });
};

export const updateJournalEntry = async (id: number, data: JournalEntryInput) => {
    const reflections = [...data.reflections, '', '', '', ''].slice(0, 4);

    await withDatabase(async (database) => {
        await database.runAsync(
            `UPDATE journal_entries SET book_name = ?, chapter_start = ?, chapter_end = ?, verse_start = ?, verse_end = ?, 
             reflection_1 = ?, reflection_2 = ?, reflection_3 = ?, reflection_4 = ?, notes = ?, study_further = ?, study_further_reminder = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [data.bookName, data.chapterStart ?? null, data.chapterEnd ?? null, data.verseStart ?? null, data.verseEnd ?? null, ...reflections, data.notes ?? null, data.studyFurther ?? null, data.studyFurtherReminder ?? null, id]
        );

        // Replace action items: delete old, insert new
        await database.runAsync(`DELETE FROM action_items WHERE entry_id = ?`, [id]);
        if (data.actionItems && data.actionItems.length > 0) {
            for (let i = 0; i < data.actionItems.length; i++) {
                const item = data.actionItems[i];
                if (item.action.trim() || item.motivation.trim()) {
                    await database.runAsync(
                        `INSERT INTO action_items (entry_id, action, motivation, sort_order) VALUES (?, ?, ?, ?)`,
                        [id, item.action, item.motivation, i]
                    );
                }
            }
        }
    });
};

/**
 * Helper: fetch action items for a list of entries and attach them
 */
const attachActionItems = async (database: SQLite.SQLiteDatabase, entries: JournalEntry[]): Promise<JournalEntry[]> => {
    if (entries.length === 0) return entries;

    const ids = entries.map(e => e.id).filter((id): id is number => id != null);
    if (ids.length === 0) return entries;

    const placeholders = ids.map(() => '?').join(',');
    const actionItems = await database.getAllAsync<ActionItem>(
        `SELECT * FROM action_items WHERE entry_id IN (${placeholders}) ORDER BY sort_order ASC`,
        ids
    );

    const itemsByEntry = new Map<number, ActionItem[]>();
    for (const item of actionItems) {
        const list = itemsByEntry.get(item.entry_id!) || [];
        list.push(item);
        itemsByEntry.set(item.entry_id!, list);
    }

    return entries.map(entry => ({
        ...entry,
        action_items: itemsByEntry.get(entry.id!) || [],
    }));
};

export const getJournalEntries = async (limit = 50, offset = 0): Promise<JournalEntry[]> => {
    return await withDatabase(async (database) => {
        const entries = await database.getAllAsync<JournalEntry>(`
            SELECT 
                *,
                datetime(created_at, 'localtime') as created_at,
                datetime(updated_at, 'localtime') as updated_at
            FROM journal_entries 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        return await attachActionItems(database, entries);
    });
};

export const getEntriesByBook = async (bookName: string): Promise<JournalEntry[]> => {
    return await withDatabase(async (database) => {
        const entries = await database.getAllAsync<JournalEntry>(
            `SELECT * FROM journal_entries WHERE book_name = ? ORDER BY chapter_start ASC`, [bookName]
        );
        return await attachActionItems(database, entries);
    });
};

export const searchEntries = async (term: string): Promise<JournalEntry[]> => {
    if (!term.trim()) {
        return [];
    }
    const pattern = `%${term}%`;

    return await withDatabase(async (database) => {
        const entries = await database.getAllAsync<JournalEntry>(
            `SELECT je.* FROM journal_entries je
             LEFT JOIN action_items ai ON ai.entry_id = je.id
             WHERE je.reflection_1 LIKE ? OR je.reflection_2 LIKE ? OR je.reflection_3 LIKE ? 
             OR je.reflection_4 LIKE ? OR je.notes LIKE ? OR je.study_further LIKE ?
             OR ai.action LIKE ? OR ai.motivation LIKE ?
             GROUP BY je.id
             ORDER BY je.created_at DESC 
             LIMIT 100`,
            [pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern]
        );
        return await attachActionItems(database, entries);
    });
};

export const getEntryById = async (id: number): Promise<JournalEntry | null> => {
    return await withDatabase(async (database) => {
        const entry = await database.getFirstAsync<JournalEntry>(
            `SELECT * FROM journal_entries WHERE id = ?`, [id]
        ) ?? null;
        if (!entry) return null;

        const items = await database.getAllAsync<ActionItem>(
            `SELECT * FROM action_items WHERE entry_id = ? ORDER BY sort_order ASC`, [id]
        );
        return { ...entry, action_items: items };
    });
};

export const deleteJournalEntry = async (id: number) => {
    await withDatabase(async (database) => {
        await database.runAsync(`DELETE FROM action_items WHERE entry_id = ?`, [id]);
        await database.runAsync(`DELETE FROM journal_entries WHERE id = ?`, [id]);
    });
};

export const getTotalEntryCount = async (month?: string): Promise<number> => {
    return await withDatabase(async (database) => {
        if (month) {
            const result = await database.getFirstAsync(`
                SELECT COUNT(DISTINCT DATE(created_at, 'localtime')) as count 
                FROM journal_entries 
                WHERE strftime('%Y-%m', created_at, 'localtime') = ?
            `, [month]) as any;
            return result?.count ?? 0;
        }

        const result = await database.getFirstAsync(`
            SELECT COUNT(DISTINCT DATE(created_at, 'localtime')) as count 
            FROM journal_entries
        `) as any;
        return result?.count ?? 0;
    });
};

export const getTotalJournalCount = async (): Promise<number> => {
    return await withDatabase(async (database) => {
        const result = await database.getFirstAsync(`
            SELECT COUNT(*) as count FROM journal_entries
        `) as any;
        return result?.count ?? 0;
    });
};

export const getMissedDaysCount = async (month?: string): Promise<number> => {
    return await withDatabase(async (database) => {
        if (month) {
            const today = getTodayDateString();
            const monthStart = `${month}-01`;

            // Get first entry date to ensure we don't count days before the user started
            const firstEntryResult = await database.getFirstAsync(`SELECT MIN(DATE(created_at, 'localtime')) as first_date FROM journal_entries`) as any;
            const firstDate = firstEntryResult?.first_date;

            if (!firstDate) return 0;

            // Calculate range: from MAX(monthStart, firstDate) up to MIN(today, nextMonthStart)
            const effectiveStart = firstDate > monthStart ? firstDate : monthStart;

            // If effectiveStart is today or in the future, no missed days yet for this month
            if (effectiveStart >= today) return 0;

            const result = await database.getFirstAsync(`
                SELECT 
                    julianday(MIN(DATE('now', 'localtime'), DATE(?, '+1 month'))) - julianday(?) as total_days,
                    COUNT(DISTINCT DATE(created_at, 'localtime')) as active_days
                FROM journal_entries
                WHERE DATE(created_at, 'localtime') >= ?
                AND DATE(created_at, 'localtime') < MIN(DATE('now', 'localtime'), DATE(?, '+1 month'))
            `, [monthStart, effectiveStart, effectiveStart, monthStart]) as any;

            if (!result || result.total_days === null) {
                return 0;
            }

            const totalDays = Math.floor(result.total_days);
            const activeDays = result.active_days || 0;

            return Math.max(0, totalDays - activeDays);
        }

        // Original logic for all-time
        const result = await database.getFirstAsync(`
            SELECT 
                julianday(DATE('now', 'localtime')) - julianday(DATE(MIN(created_at), 'localtime')) as total_days,
                COUNT(DISTINCT DATE(created_at, 'localtime')) as active_days
            FROM journal_entries
        `) as any;

        const todayEntryResult = await database.getFirstAsync(`
            SELECT EXISTS(
                SELECT 1 FROM journal_entries 
                WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
            ) as has_entry
        `) as any;
        const todayEntryCount = todayEntryResult?.has_entry || 0;

        if (!result || result.total_days === null) {
            return 0;
        }

        const totalDays = Math.floor(result.total_days);
        const activeDays = (result.active_days - todayEntryCount) || 0;

        return Math.max(0, totalDays - activeDays);
    });
};

/**
 * Export all journal entries as a JSON string
 * The JSON format is:
 * {
 *   "version": 3,
 *   "exportedAt": string,
 *   "entries": JournalEntry[],
 *   "readingProgress": number[]
 * }
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
                datetime(created_at, 'localtime') as created_at,
                datetime(updated_at, 'localtime') as updated_at
            FROM journal_entries
            ORDER BY created_at ASC
        `);

        const entriesWithItems = await attachActionItems(database, entries);

        const readingProgress = await database.getAllAsync<{ item_id: number }>(
            `SELECT item_id FROM reading_progress`
        );

        const payload = {
            version: 3,
            exportedAt: new Date().toISOString(),
            entries: entriesWithItems,
            readingProgress: readingProgress.map(rp => rp.item_id),
        };

        return JSON.stringify(payload, null, 2);
    });
};

/**
 * Import journal entries from a JSON string previously created by exportJournalEntriesToJson.
 * This will MERGE entries and reading progress with existing local data, skipping duplicates.
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
                if (!entry.book_name) continue;

                // Check for duplicate: same book, chapter_start, and date
                const existing = await database.getFirstAsync<{ id: number }>(
                    `SELECT id FROM journal_entries
                     WHERE book_name = ? AND chapter_start IS ? AND DATE(created_at) = DATE(?)`,
                    [entry.book_name, entry.chapter_start ?? null, entry.created_at ?? '']
                );

                if (existing) {
                    skippedEntries++;
                    continue;
                }

                const reflections = [
                    entry.reflection_1 ?? '',
                    entry.reflection_2 ?? '',
                    entry.reflection_3 ?? '',
                    entry.reflection_4 ?? '',
                ];

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
                        ...reflections,
                        entry.notes ?? null,
                        entry.study_further ?? null,
                        entry.study_further_reminder ?? null,
                        entry.created_at ?? new Date().toISOString(),
                        entry.updated_at ?? new Date().toISOString(),
                        entry.study_completed ? 1 : 0,
                    ]
                );

                if (entry.action_items && entry.action_items.length > 0) {
                    const newEntryId = result.lastInsertRowId;
                    for (let i = 0; i < entry.action_items.length; i++) {
                        const item = entry.action_items[i];
                        await database.runAsync(
                            `INSERT INTO action_items (entry_id, action, motivation, sort_order, is_completed) VALUES (?, ?, ?, ?, ?)`,
                            [newEntryId, item.action ?? '', item.motivation ?? '', item.sort_order ?? i, item.is_completed ? 1 : 0]
                        );
                    }
                }

                importedEntries++;
            }

            // 2. Process Reading Progress (if version >= 3)
            if (parsed.version >= 3 && Array.isArray(parsed.readingProgress)) {
                for (const itemId of parsed.readingProgress) {
                    const existing = await database.getFirstAsync<{ item_id: number }>(
                        `SELECT item_id FROM reading_progress WHERE item_id = ?`,
                        [itemId]
                    );

                    if (existing) {
                        skippedReadingItems++;
                        continue;
                    }

                    await database.runAsync(
                        `INSERT INTO reading_progress (item_id) VALUES (?)`,
                        [itemId]
                    );
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


/**
 * Get entry counts for a date range
 * Returns a map of date string (YYYY-MM-DD) -> count
 * Uses localtime to match other date queries in the app
 */
export const getDailyEntryCounts = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
    return await withDatabase(async (database) => {
        const result = await database.getAllAsync<{ day: string; count: number }>(
            `SELECT DATE(created_at, 'localtime') as day, COUNT(*) as count 
             FROM journal_entries 
             WHERE DATE(created_at, 'localtime') BETWEEN DATE(?, 'localtime') AND DATE(?, 'localtime') 
             GROUP BY day`,
            [startDate, endDate]
        );

        const counts: Record<string, number> = {};
        result.forEach(row => {
            counts[row.day] = row.count;
        });

        return counts;
    });
};


/**
 * Get the date of the very first journal entry
 */
export const getFirstEntryDate = async (): Promise<Date | null> => {
    return await withDatabase(async (database) => {
        const result = await database.getFirstAsync<{ created_at: string }>(`
            SELECT MIN(created_at) as created_at FROM journal_entries
        `);

        if (!result?.created_at) return null;
        return new Date(result.created_at);
    });
};

/**
 * Get a "Flashback" entry to review
 * Priority:
 * 1. Entry from exactly 1 year ago
 * 2. Entry from exactly 1 month ago
 * 3. Random entry older than 30 days (excluding recently shown)
 * @param excludeIds - Array of entry IDs to exclude (recently shown in last 30 days)
 */
export const getFlashbackEntry = async (excludeIds: number[] = []): Promise<{ entry: JournalEntry, type: 'year' | 'month' | 'random' } | null> => {
    return await withDatabase(async (database) => {
        // 1. Check for 1 year ago
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oneYearStr = formatDateToLocalString(oneYearAgo);

        const yearEntry = await database.getFirstAsync<JournalEntry>(`
            SELECT *, datetime(created_at, 'localtime') as created_at
            FROM journal_entries
            WHERE DATE(created_at, 'localtime') = ?
            ORDER BY RANDOM() LIMIT 1
        `, [oneYearStr]);

        if (yearEntry) {
            const [withItems] = await attachActionItems(database, [yearEntry]);
            return { entry: withItems, type: 'year' };
        }

        // 2. Check for 1 month ago
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneMonthStr = formatDateToLocalString(oneMonthAgo);

        const monthEntry = await database.getFirstAsync<JournalEntry>(`
            SELECT *, datetime(created_at, 'localtime') as created_at
            FROM journal_entries
            WHERE DATE(created_at, 'localtime') = ?
            ORDER BY RANDOM() LIMIT 1
        `, [oneMonthStr]);

        if (monthEntry) {
            const [withItems] = await attachActionItems(database, [monthEntry]);
            return { entry: withItems, type: 'month' };
        }

        // 3. Random entry older than 30 days (excluding recently shown)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysStr = formatDateToLocalString(thirtyDaysAgo);

        let randomEntry: JournalEntry | null = null;

        // First try to get entries excluding the recently shown ones
        if (excludeIds.length > 0) {
            const placeholders = excludeIds.map(() => '?').join(',');
            randomEntry = await database.getFirstAsync<JournalEntry>(`
                SELECT *, datetime(created_at, 'localtime') as created_at
                FROM journal_entries
                WHERE DATE(created_at, 'localtime') <= ?
                AND id NOT IN (${placeholders})
                ORDER BY RANDOM() LIMIT 1
            `, [thirtyDaysStr, ...excludeIds]);

            if (randomEntry) {
                const [withItems] = await attachActionItems(database, [randomEntry]);
                return { entry: withItems, type: 'random' };
            }
        }

        // If all entries have been shown or no excludeIds, just get any random old entry
        randomEntry = await database.getFirstAsync<JournalEntry>(`
            SELECT *, datetime(created_at, 'localtime') as created_at
            FROM journal_entries
            WHERE DATE(created_at, 'localtime') <= ?
            ORDER BY RANDOM() LIMIT 1
        `, [thirtyDaysStr]);

        if (randomEntry) {
            const [withItems] = await attachActionItems(database, [randomEntry]);
            return { entry: withItems, type: 'random' };
        }

        return null;
    });
};

export interface EnhancedActionItem extends ActionItem {
    book_name: string;
    chapter_start: number;
    chapter_end?: number;
    created_at: string;
    is_completed: boolean;
}

/**
 * Fetch action items from the last X days, joined with their journal entry context.
 * Used for the "Reminders" section on the home screen.
 */
export const getRecentActionItems = async (days: number = 7, includeCompleted: boolean = false): Promise<EnhancedActionItem[]> => {
    return await withDatabase(async (database) => {
        const query = `
            SELECT 
                ai.*, 
                je.book_name, 
                je.chapter_start, 
                je.chapter_end,
                datetime(je.created_at, 'localtime') as created_at
            FROM action_items ai
            JOIN journal_entries je ON ai.entry_id = je.id
            WHERE DATE(je.created_at, 'localtime') >= DATE('now', 'localtime', ?)
            AND (ai.action != '' OR ai.motivation != '')
            ${includeCompleted ? '' : 'AND ai.is_completed = 0'}
            ORDER BY je.created_at DESC, ai.sort_order ASC
        `;

        const daysParam = `-${days} days`;
        return await database.getAllAsync<EnhancedActionItem>(query, [daysParam]);
    });
};

export const toggleActionItemCompletion = async (id: number, completed: boolean) => {
    await withDatabase(async (database) => {
        await database.runAsync(
            `UPDATE action_items SET is_completed = ? WHERE id = ?`,
            [completed ? 1 : 0, id]
        );
    });
};

/**
 * Fetch all action items, joined with their journal entry context.
 * Used for the "Actions" tab on the Past Entries screen.
 */
export const getAllActionItems = async (limit: number = 200, offset: number = 0): Promise<EnhancedActionItem[]> => {
    return await withDatabase(async (database) => {
        const query = `
            SELECT 
                ai.*, 
                je.book_name, 
                je.chapter_start, 
                je.chapter_end,
                datetime(je.created_at, 'localtime') as created_at
            FROM action_items ai
            JOIN journal_entries je ON ai.entry_id = je.id
            WHERE (ai.action != '' OR ai.motivation != '')
            ORDER BY je.created_at DESC, ai.sort_order ASC
            LIMIT ? OFFSET ?
        `;

        return await database.getAllAsync<EnhancedActionItem>(query, [limit, offset]);
    });
};

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

        // What if we still don't have 6? Let's grab the newest uncompleted overall to backfill up to 6
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

export const toggleStudyTopicCompletion = async (entryId: number, completed: boolean) => {
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

/**
 * READING PLAN PROGRESS FUNCTIONS
 */

export const getReadingProgress = async (): Promise<number[]> => {
    return await withDatabase(async (database) => {
        const result = await database.getAllAsync<{ item_id: number }>(
            `SELECT item_id FROM reading_progress`
        );
        return result.map(row => row.item_id);
    });
};

export const toggleReadingItem = async (itemId: number, completed: boolean) => {
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

export const clearReadingProgress = async () => {
    await withDatabase(async (database) => {
        await database.runAsync(`DELETE FROM reading_progress`);
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

export const checkEntryExists = async (bookName: string, chapterStart: number, chapterEnd?: number): Promise<number | null> => {
    return await withDatabase(async (database) => {
        const result = await database.getFirstAsync<{ id: number }>(
            `SELECT id FROM journal_entries 
             WHERE book_name = ? AND chapter_start = ? AND(chapter_end IS ? OR(chapter_end IS NULL AND ? IS NULL))
             LIMIT 1`,
            [bookName, chapterStart, chapterEnd ?? null, chapterEnd ?? null]
        );
        return result?.id ?? null;
    });
};

/**
 * Check whether any journal entry exists that fully covers a plan item's chapter range.
 * "Fully covers" means: entry.chapter_start <= planStart AND entry.chapter_end >= planEnd
 * (mirrors the matching condition used in findMatchingReadingPlanItems).
 *
 * Used by the plan toggle so that tapping a plan item opens the add-entry screen only
 * when no existing entry covers it, even if the entry spans a wider chapter range.
 *
 * Returns the matching entry id, or null if none found.
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

/**
 * Shares a specific reflection from a journal entry to the user's groups.
 */
export const shareReflectionToGroup = async (
    entry: JournalEntry,
    sharedText: string,
    questionTitle: string
) => {
    // We only push this to Firestore, not storing it locally.
    // Since syncActivities uses AsyncStorage to queue, it will be handled there.
    try {
        const user = auth().currentUser;
        if (!user) return false;

        const userDoc = await firestore().collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        if (!userData?.groupIds?.length) return false;

        const chapters = entry.chapter_end && entry.chapter_end !== entry.chapter_start
            ? `${entry.chapter_start}-${entry.chapter_end}`
            : `${entry.chapter_start}`;

        const resolvedName = user.displayName || user.email?.split('@')[0] || 'Reader';

        const activity = {
            userId: user.uid,
            userName: resolvedName,
            bookName: entry.book_name,
            chapters,
            type: 'reflection_shared' as any,
            queuedAt: new Date().toISOString(),
            sharedQuestionTitle: questionTitle,
            sharedReflectionText: sharedText,
        };

        await queueActivity(activity);
        await syncPendingActivities();
        return true;
    } catch (error) {
        console.error('[shareReflectionToGroup] Error queuing shared reflection:', error);
        return false;
    }
};

/**
 * Returns the pinned action items (up to 3).
 */
export const getPinnedActionItems = async (): Promise<EnhancedActionItem[]> => {
    return await withDatabase(async (database) => {
        const result = await database.getAllAsync<EnhancedActionItem>(`
            SELECT 
                ai.*, 
                je.book_name, 
                je.chapter_start, 
                je.chapter_end,
                datetime(je.created_at, 'localtime') as created_at
            FROM action_items ai
            JOIN journal_entries je ON ai.entry_id = je.id
            WHERE ai.is_pinned = 1
              AND (ai.action != '' OR ai.motivation != '')
            ORDER BY ai.id DESC
            LIMIT 3
        `);
        return result ?? [];
    });
};

/**
 * Pin or unpin an action item.
 * A max of 3 items can be pinned at a time.
 * If 3 are already pinned and the user pins another, the oldest one is unpinned.
 */
export const toggleActionItemPin = async (id: number, pinned: boolean): Promise<void> => {
    await withDatabase(async (database) => {
        if (pinned) {
            const pinnedRows = await database.getAllAsync<{ id: number }>(`
                SELECT id FROM action_items WHERE is_pinned = 1 ORDER BY id ASC
            `);
            if (pinnedRows.length >= 3) {
                // Make room so that total pinned will be 3 including the new one
                const itemsToUnpin = pinnedRows.slice(0, pinnedRows.length - 2);
                for (const row of itemsToUnpin) {
                    await database.runAsync(`UPDATE action_items SET is_pinned = 0 WHERE id = ?`, [row.id]);
                }
            }
        }
        await database.runAsync(
            `UPDATE action_items SET is_pinned = ? WHERE id = ?`,
            [pinned ? 1 : 0, id]
        );
    });
};

/**
 * Fetch all (non-pinned) action items whose parent entry falls within
 * a given age window (in days ago).
 *
 * Examples:
 *   getActionItemsForWindow(0, 7)   → this week
 *   getActionItemsForWindow(7, 14)  → last week
 *   getActionItemsForWindow(21, 35) → around a month ago
 */
export const getActionItemsForWindow = async (
    newerDaysAgo: number,
    olderDaysAgo: number
): Promise<EnhancedActionItem[]> => {
    return await withDatabase(async (database) => {
        const newerBound = `-${newerDaysAgo} days`;
        const olderBound = `-${olderDaysAgo} days`;

        const query = `
            SELECT 
                ai.*, 
                je.book_name, 
                je.chapter_start, 
                je.chapter_end,
                datetime(je.created_at, 'localtime') as created_at
            FROM action_items ai
            JOIN journal_entries je ON ai.entry_id = je.id
            WHERE DATE(je.created_at, 'localtime') <= DATE('now', 'localtime', ?)
              AND DATE(je.created_at, 'localtime') >= DATE('now', 'localtime', ?)
              AND (ai.action != '' OR ai.motivation != '')
              AND ai.is_pinned = 0
            ORDER BY je.created_at DESC, ai.sort_order ASC
        `;

        return await database.getAllAsync<EnhancedActionItem>(query, [newerBound, olderBound]);
    });
};