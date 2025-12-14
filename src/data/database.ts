import * as SQLite from 'expo-sqlite';
import { formatDateToLocalString, getTodayDateString, getYesterdayDateString, parseLocalDateString } from '../utils/dateUtils';

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
    created_at: string;
    updated_at?: string;
}

export interface JournalEntryInput {
    bookName: string;
    chapterStart?: number;
    chapterEnd?: number;
    verseStart?: string;
    verseEnd?: string;
    reflections: string[];
    notes?: string;
}

let db: SQLite.SQLiteDatabase | null = null;

const CURRENT_DB_VERSION = 2;

const getDb = async () => {
    if (!db) {
        db = await SQLite.openDatabaseAsync('bibleJournal.db');
    }
    return db;
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
        const database = await getDb();
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
                    
                    COMMIT;
                `);
            };
        };

        // Set to current version
        await setDbVersion(database, CURRENT_DB_VERSION);

        return true;
    } catch (error) {
        console.error('Database init error:', error);
        return false;
    }
};

export const createJournalEntry = async (data: JournalEntryInput) => {
    const reflections = [...data.reflections, '', '', '', ''].slice(0, 4);
    const database = await getDb();

    const result = await database.runAsync(
        `INSERT INTO journal_entries (book_name, chapter_start, chapter_end, verse_start, verse_end, reflection_1, reflection_2, reflection_3, reflection_4, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.bookName, data.chapterStart ?? null, data.chapterEnd ?? null, data.verseStart ?? null, data.verseEnd ?? null, ...reflections, data.notes ?? null]
    );

    return result.lastInsertRowId;
};

export const updateJournalEntry = async (id: number, data: JournalEntryInput) => {
    const reflections = [...data.reflections, '', '', '', ''].slice(0, 4);
    const database = await getDb();

    await database.runAsync(
        `UPDATE journal_entries SET book_name = ?, chapter_start = ?, chapter_end = ?, verse_start = ?, verse_end = ?, 
         reflection_1 = ?, reflection_2 = ?, reflection_3 = ?, reflection_4 = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [data.bookName, data.chapterStart ?? null, data.chapterEnd ?? null, data.verseStart ?? null, data.verseEnd ?? null, ...reflections, data.notes ?? null, id]
    );
};

export const getJournalEntries = async (limit = 50, offset = 0): Promise<JournalEntry[]> => {
    const database = await getDb();
    return await database.getAllAsync(`
        SELECT 
            *,
            datetime(created_at, 'localtime') as created_at,
            datetime(updated_at, 'localtime') as updated_at
        FROM journal_entries 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `, [limit, offset]);
};

export const getEntriesByBook = async (bookName: string): Promise<JournalEntry[]> => {
    const database = await getDb();
    return await database.getAllAsync(`SELECT * FROM journal_entries WHERE book_name = ? ORDER BY chapter_start ASC`, [bookName]);
};

export const searchEntries = async (term: string): Promise<JournalEntry[]> => {
    if (!term.trim()) {
        return [];
    }
    const pattern = `%${term}%`;
    const database = await getDb();
    return await database.getAllAsync(
        `SELECT * FROM journal_entries WHERE reflection_1 LIKE ? OR reflection_2 LIKE ? OR reflection_3 LIKE ? OR reflection_4 LIKE ? OR notes LIKE ? ORDER BY created_at DESC`,
        [pattern, pattern, pattern, pattern, pattern]
    );
};

export const getEntryById = async (id: number): Promise<JournalEntry | null> => {
    const database = await getDb();
    return await database.getFirstAsync(`SELECT * FROM journal_entries WHERE id = ?`, [id]) ?? null;
};

export const deleteJournalEntry = async (id: number) => {
    const database = await getDb();
    await database.runAsync(`DELETE FROM journal_entries WHERE id = ?`, [id]);
};

export const getTotalEntryCount = async (): Promise<number> => {
    const database = await getDb();
    const result = await database.getFirstAsync(`SELECT COUNT(*) as count FROM journal_entries`) as any;
    return result?.count ?? 0;
};

export const getBookEntryCount = async (bookName: string): Promise<number> => {
    const database = await getDb();
    const result = await database.getFirstAsync(`SELECT COUNT(*) as count FROM journal_entries WHERE book_name = ?`, [bookName]) as any;
    return result?.count ?? 0;
};

export const hasEntryToday = async (): Promise<boolean> => {
    const database = await getDb();
    const result = await database.getFirstAsync(`
        SELECT EXISTS(
            SELECT 1 FROM journal_entries 
            WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
        ) as has_entry
    `) as any;
    return result?.has_entry === 1;
}


export const getMissedDaysCount = async (): Promise<number> => {
    const database = await getDb();

    const result = await database.getFirstAsync(`
        SELECT 
            -- Total days from first entry to today (exclusive - today not counted)
            julianday(DATE('now', 'localtime')) - julianday(DATE(MIN(created_at), 'localtime')) as total_days,
            -- Number of unique days with entries
            COUNT(DISTINCT DATE(created_at, 'localtime')) as active_days
        FROM journal_entries
    `) as any;

    const todayEntryResult = await database.getFirstAsync(`
        SELECT EXISTS(
            SELECT 1 FROM journal_entries 
            WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
        ) as has_entry
    `) as any;
    const todayEntryCount = todayEntryResult?.has_entry; // retruns 1 if there's an entry today, else 0

    if (!result || result.total_days === null) {
        return 0;
    }

    const totalDays = Math.floor(result.total_days);
    const activeDays = (result.active_days - todayEntryCount) || 0;

    return Math.max(0, totalDays - activeDays);
};

export const getComebackDaysCount = async (): Promise<number> => {
    const database = await getDb();

    const result = await database.getFirstAsync(`
        WITH dated_entries AS (
            SELECT DISTINCT DATE(created_at, 'localtime') as entry_date
            FROM journal_entries
            ORDER BY entry_date
        ),
        with_gaps AS (
            SELECT 
                entry_date,
                LAG(entry_date, 1) OVER (ORDER BY entry_date) as prev_date_1,
                LAG(entry_date, 2) OVER (ORDER BY entry_date) as prev_date_2
            FROM dated_entries
        )
        SELECT COUNT(*) as comeback_days
        FROM with_gaps
        WHERE 
            -- Current day and previous day are consecutive (2 days in a row)
            julianday(entry_date) - julianday(prev_date_1) = 1
            -- But there was a 2+ day gap before those 2 consecutive days
            AND julianday(prev_date_1) - julianday(prev_date_2) >= 2
    `) as any;

    return result?.comeback_days || 0;
};

/**
 * Get all entries for backup (no pagination)
 */
export const getAllEntriesForBackup = async (): Promise<JournalEntry[]> => {
    const database = await getDb();
    return await database.getAllAsync(`
        SELECT * FROM journal_entries 
        ORDER BY created_at DESC
    `);
};

/**
 * Clear all entries (for replace mode in restore)
 */
export const clearAllEntries = async (): Promise<void> => {
    const database = await getDb();
    await database.runAsync(`DELETE FROM journal_entries`);
};

/**
 * Find duplicate entry based on key fields
 */
const findDuplicateEntry = async (
    database: SQLite.SQLiteDatabase,
    entry: JournalEntry
): Promise<boolean> => {
    const result = await database.getFirstAsync(
        `SELECT id FROM journal_entries 
         WHERE book_name = ? 
         AND chapter_start = ? 
         AND COALESCE(chapter_end, 0) = COALESCE(?, 0)
         AND datetime(created_at) BETWEEN datetime(?, '-1 minute') AND datetime(?, '+1 minute')
         LIMIT 1`,
        [
            entry.book_name,
            entry.chapter_start,
            entry.chapter_end || null,
            entry.created_at,
            entry.created_at,
        ]
    );
    return result !== null;
};

/**
 * Import entries from backup
 * @param entries - Array of journal entries to import
 * @param mode - 'merge' to skip duplicates, 'replace' to import all
 * @returns Number of entries imported
 */
export const importEntries = async (
    entries: JournalEntry[],
    mode: 'merge' | 'replace'
): Promise<number> => {
    const database = await getDb();
    let importedCount = 0;

    for (const entry of entries) {
        try {
            // In merge mode, check for duplicates
            if (mode === 'merge') {
                const isDuplicate = await findDuplicateEntry(database, entry);
                if (isDuplicate) {
                    continue; // Skip duplicate
                }
            }

            // Import entry (without id to let autoincrement handle it)
            await database.runAsync(
                `INSERT INTO journal_entries 
                 (book_name, chapter_start, chapter_end, verse_start, verse_end, 
                  reflection_1, reflection_2, reflection_3, reflection_4, notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    entry.book_name,
                    entry.chapter_start || null,
                    entry.chapter_end || null,
                    entry.verse_start || null,
                    entry.verse_end || null,
                    entry.reflection_1 || null,
                    entry.reflection_2 || null,
                    entry.reflection_3 || null,
                    entry.reflection_4 || null,
                    entry.notes || null,
                    entry.created_at,
                    entry.updated_at || entry.created_at,
                ]
            );
            importedCount++;
        } catch (error) {
            console.error('Error importing entry:', error);
            // Continue with next entry
        }
    }

    return importedCount;
};

/**
 * Get entry counts for a date range
 * Returns a map of date string (YYYY-MM-DD) -> count
 * Uses localtime to match other date queries in the app
 */
export const getDailyEntryCounts = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
    const database = await getDb();
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
};

/**
 * Get current streak count
 */
export const getCurrentStreak = async (): Promise<number> => {
    const database = await getDb();

    // Get all unique entry dates ordered by date descending
    const result = await database.getAllAsync<{ entry_date: string }>(`
        SELECT DISTINCT DATE(created_at, 'localtime') as entry_date
        FROM journal_entries
        ORDER BY entry_date DESC
    `);

    if (result.length === 0) return 0;

    // Use local timezone date strings to match SQLite's 'localtime' modifier
    const todayStr = getTodayDateString();
    const yesterdayStr = getYesterdayDateString();

    // Check if the most recent entry is today or yesterday
    const lastEntryDate = result[0].entry_date;

    if (lastEntryDate !== todayStr && lastEntryDate !== yesterdayStr) {
        return 0;
    }

    let streak = 1;

    // Iterate through dates to find consecutive days
    for (let i = 0; i < result.length - 1; i++) {
        const currentDate = parseLocalDateString(result[i].entry_date);
        const nextDate = parseLocalDateString(result[i + 1].entry_date);

        // Calculate difference in days
        const diffTime = Math.abs(currentDate.getTime() - nextDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
};

/**
 * Get longest streak count
 */
export const getLongestStreak = async (): Promise<number> => {
    const database = await getDb();

    // Get all unique entry dates ordered by date ascending
    const result = await database.getAllAsync<{ entry_date: string }>(`
        SELECT DISTINCT DATE(created_at, 'localtime') as entry_date
        FROM journal_entries
        ORDER BY entry_date ASC
    `);

    if (result.length === 0) return 0;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 0; i < result.length - 1; i++) {
        const currentDate = parseLocalDateString(result[i].entry_date);
        const nextDate = parseLocalDateString(result[i + 1].entry_date);

        const diffTime = Math.abs(nextDate.getTime() - currentDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            currentStreak++;
        } else {
            currentStreak = 1;
        }

        if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
        }
    }

    return maxStreak;
};

/**
 * Get entry counts for the last 365 days for the contribution graph
 */
export const getYearlyEntryCounts = async (): Promise<Record<string, number>> => {
    const database = await getDb();
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const startDate = formatDateToLocalString(oneYearAgo);
    const endDate = formatDateToLocalString(today);

    return await getDailyEntryCounts(startDate, endDate);
};
