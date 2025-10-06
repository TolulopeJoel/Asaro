import * as SQLite from 'expo-sqlite';

export interface JournalEntry {
    id?: number;
    date_created: string;
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
    dateCreated: string;
    bookName: string;
    chapterStart?: number;
    chapterEnd?: number;
    verseStart?: string;
    verseEnd?: string;
    reflections: string[];
    notes?: string;
}

let db: SQLite.SQLiteDatabase | null = null;

const initDb = (): SQLite.SQLiteDatabase => {
    if (!db) {
        db = SQLite.openDatabaseSync('bibleJournal.db');
    }
    if (!db) {
        throw new Error('Failed to initialize database');
    }
    return db;
};

// --- Helper Functions ---

const run = (sql: string, params: any[] = []): any =>
    initDb().runSync(sql, params);

const fetchAll = (sql: string, params: any[] = []): JournalEntry[] =>
    initDb().getAllSync(sql, params) as JournalEntry[];

const fetchOne = (sql: string, params: any[] = []): JournalEntry | null =>
    (initDb().getFirstSync(sql, params) as JournalEntry) ?? null;

const mapReflections = (reflections: string[]): string[] =>
    Array.from({ length: 4 }, (_, i) => reflections[i] || '');

// --- Database Setup ---
export const initializeDatabase = () => {
    try {
        run(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date_created TEXT NOT NULL,
        book_name TEXT NOT NULL,
        chapter_start INTEGER,
        chapter_end INTEGER,
        verse_start TEXT,
        verse_end TEXT,
        reflection_1 TEXT,
        reflection_2 TEXT,
        reflection_3 TEXT,
        reflection_4 TEXT,
        reflection_5 TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

        run(`CREATE INDEX IF NOT EXISTS idx_book_name ON journal_entries(book_name)`);
        run(`CREATE INDEX IF NOT EXISTS idx_date_created ON journal_entries(date_created)`);

        console.log('Database initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing database:', error);
        return false;
    }
};

// --- CRUD Operations ---

export const createJournalEntry = (entryData: JournalEntryInput): number => {
    const { dateCreated, bookName, chapterStart, chapterEnd, verseStart, verseEnd, reflections, notes } = entryData;
    const mappedReflections = mapReflections(reflections);

    const result = run(`
    INSERT INTO journal_entries (
      date_created, book_name, chapter_start, chapter_end,
      verse_start, verse_end, reflection_1, reflection_2,
      reflection_3, reflection_4, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        dateCreated, bookName, chapterStart ?? null, chapterEnd ?? null,
        verseStart ?? null, verseEnd ?? null, ...mappedReflections, notes || ''
    ]);

    return result.lastInsertRowId;
};

export const getJournalEntries = (limit = 50, offset = 0) =>
    fetchAll(`SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);

export const getEntriesByBook = (bookName: string) =>
    fetchAll(`SELECT * FROM journal_entries WHERE book_name = ? ORDER BY chapter_start ASC, created_at DESC`, [bookName]);

export const getEntriesByDateRange = (startDate: string, endDate: string) =>
    fetchAll(`SELECT * FROM journal_entries WHERE date_created BETWEEN ? AND ? ORDER BY date_created DESC`, [startDate, endDate]);

export const searchEntries = (searchTerm: string) => {
    const searchPattern = `%${searchTerm}%`;
    return fetchAll(`
    SELECT * FROM journal_entries
    WHERE reflection_1 LIKE ? OR reflection_2 LIKE ? OR reflection_3 LIKE ? 
       OR reflection_4 LIKE ? OR reflection_5 LIKE ? OR notes LIKE ?
    ORDER BY created_at DESC
  `, Array(6).fill(searchPattern));
};

export const getEntryById = (id: number) =>
    fetchOne(`SELECT * FROM journal_entries WHERE id = ?`, [id]);

export const updateJournalEntry = (id: number, entryData: JournalEntryInput): boolean => {
    const { dateCreated, bookName, chapterStart, chapterEnd, verseStart, verseEnd, reflections, notes } = entryData;
    const mappedReflections = mapReflections(reflections);

    run(`
    UPDATE journal_entries SET
      date_created = ?, book_name = ?, chapter_start = ?, chapter_end = ?,
      verse_start = ?, verse_end = ?, reflection_1 = ?, reflection_2 = ?,
      reflection_3 = ?, reflection_4 = ?, reflection_5 = ?, notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [dateCreated, bookName, chapterStart ?? null, chapterEnd ?? null,
        verseStart ?? null, verseEnd ?? null, ...mappedReflections, notes || '', id]);

    return true;
};

export const deleteJournalEntry = (id: number) =>
    !!run(`DELETE FROM journal_entries WHERE id = ?`, [id]);

export const getBookEntryCount = (bookName: string) =>
    (fetchOne(`SELECT COUNT(*) as count FROM journal_entries WHERE book_name = ?`, [bookName]) as any)?.count || 0;

export const getTotalEntryCount = () =>
    (fetchOne(`SELECT COUNT(*) as count FROM journal_entries`) as any)?.count || 0;

export const getMissedDaysCount = () => {
    const result = fetchOne(`
      SELECT COUNT(DISTINCT DATE(created_at)) as active_days FROM journal_entries
    `) as any;
    const activeDays = result?.active_days || 0;

    const startDateResult = fetchOne(`
      SELECT DATE(MIN(created_at)) as start_date FROM journal_entries
    `) as any;

    const startDate = startDateResult?.start_date;
    if (!startDate) {
        return 0;
    }

    const start = new Date(startDate);
    const today = new Date();

    // Reset time components to compare dates only
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);


    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays - activeDays;
}

export const getComebackDaysCount = () => {
    const result = fetchOne(`
      WITH dated_entries AS (
        SELECT DISTINCT DATE(created_at) as entry_date
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
  }