import * as SQLite from 'expo-sqlite';

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
    created_at?: string;
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
