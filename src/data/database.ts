
import * as SQLite from 'expo-sqlite';


// Add these types at the top of your database.tsx file, after the imports

export interface JournalEntry {
    id?: number;
    date_created: string;
    book_name: string;
    chapter_start?: number;
    chapter_end?: number;
    verse_start?: string;
    verse_end?: string;
    reflection_1?: string;
    reflection_2?: string;
    reflection_3?: string;
    reflection_4?: string;
    reflection_5?: string;
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

// Initialize database tables
export const initializeDatabase = () => {
    try {
        const database = initDb();

        // Create journal_entries table
        database.execSync(`
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

        // Create index for faster searches
        database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_book_name ON journal_entries(book_name);
    `);

        database.execSync(`
      CREATE INDEX IF NOT EXISTS idx_date_created ON journal_entries(date_created);
    `);

        console.log('Database initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing database:', error);
        return false;
    }
};

// Create a new journal entry
export const createJournalEntry = (entryData: JournalEntryInput): number => {
    try {
        const database = initDb(); // Make sure this line is here
        const {
            dateCreated,
            bookName,
            chapterStart,
            chapterEnd,
            verseStart,
            verseEnd,
            reflections,
            notes
        } = entryData;

        const result = database.runSync(`
      INSERT INTO journal_entries (
        date_created, book_name, chapter_start, chapter_end,
        verse_start, verse_end, reflection_1, reflection_2,
        reflection_3, reflection_4, reflection_5, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            dateCreated,
            bookName,
            chapterStart ?? null,
            chapterEnd ?? null,
            verseStart ?? null,
            verseEnd ?? null,
            reflections[0] || '',
            reflections[1] || '',
            reflections[2] || '',
            reflections[3] || '',
            reflections[4] || '',
            notes || ''
        ]);

        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error creating journal entry:', error);
        throw error;
    }
};

// Get all journal entries (with pagination)
export const getJournalEntries = (limit = 50, offset = 0): JournalEntry[] => {
    try {
        const database = initDb();
        const entries = database.getAllSync(`
      SELECT * FROM journal_entries 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);

        return entries as JournalEntry[];
    } catch (error) {
        console.error('Error fetching journal entries:', error);
        return [];
    }
};

// Get entries by book name
export const getEntriesByBook = (bookName: string): JournalEntry[] => {
    try {
        const database = initDb();
        const entries = database.getAllSync(`
      SELECT * FROM journal_entries 
      WHERE book_name = ? 
      ORDER BY chapter_start ASC, created_at DESC
    `, [bookName]);

        return entries as JournalEntry[];
    } catch (error) {
        console.error('Error fetching entries by book:', error);
        return [];
    }
};

// Get entries by date range
export const getEntriesByDateRange = (startDate: string, endDate: string): JournalEntry[] => {
    try {
        const database = initDb();
        const entries = database.getAllSync(`
      SELECT * FROM journal_entries 
      WHERE date_created BETWEEN ? AND ? 
      ORDER BY date_created DESC
    `, [startDate, endDate]);

        return entries as JournalEntry[];

    } catch (error) {
        console.error('Error fetching entries by date range:', error);
        return [];
    }
};

// Search entries by text content
export const searchEntries = (searchTerm: string): JournalEntry[] => {
    try {
        const database = initDb();
        const searchPattern = `%${searchTerm}%`;
        const entries = database.getAllSync(`
      SELECT * FROM journal_entries 
      WHERE reflection_1 LIKE ? 
         OR reflection_2 LIKE ? 
         OR reflection_3 LIKE ? 
         OR reflection_4 LIKE ? 
         OR reflection_5 LIKE ? 
         OR notes LIKE ?
      ORDER BY created_at DESC
    `, [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]);

        return entries as JournalEntry[];
    } catch (error) {
        console.error('Error searching entries:', error);
        return [];
    }
};

// Get a single entry by ID
export const getEntryById = (id: number): JournalEntry | null => {
    try {
        const database = initDb();
        const entry = database.getFirstSync(`
      SELECT * FROM journal_entries WHERE id = ?
    `, [id]);

        return entry as JournalEntry | null;
    } catch (error) {
        console.error('Error fetching entry by ID:', error);
        return null;
    }
};

// Update an existing entry
export const updateJournalEntry = (id: number, entryData: JournalEntryInput): boolean => {
    try {
        const database = initDb();
        const {
            dateCreated,
            bookName,
            chapterStart,
            chapterEnd,
            verseStart,
            verseEnd,
            reflections,
            notes
        } = entryData;

        database.runSync(`
      UPDATE journal_entries SET
        date_created = ?,
        book_name = ?,
        chapter_start = ?,
        chapter_end = ?,
        verse_start = ?,
        verse_end = ?,
        reflection_1 = ?,
        reflection_2 = ?,
        reflection_3 = ?,
        reflection_4 = ?,
        reflection_5 = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
            dateCreated,
            bookName,
            chapterStart ?? null,
            chapterEnd ?? null,
            verseStart ?? null,
            verseEnd ?? null,
            reflections[0] || '',
            reflections[1] || '',
            reflections[2] || '',
            reflections[3] || '',
            reflections[4] || '',
            notes || '',
            id
        ]);

        return true;
    } catch (error) {
        console.error('Error updating journal entry:', error);
        return false;
    }
};

// Delete an entry
export const deleteJournalEntry = (id: number): boolean => {
    try {
        const database = initDb();
        database.runSync(`DELETE FROM journal_entries WHERE id = ?`, [id]);
        return true;
    } catch (error) {
        console.error('Error deleting journal entry:', error);
        return false;
    }
};

// Get entry count for a specific book
export const getBookEntryCount = (bookName: string): number => {
    try {
        const database = initDb();
        const result = database.getFirstSync(`
      SELECT COUNT(*) as count FROM journal_entries WHERE book_name = ?
    `, [bookName]);

        return (result as { count: number }).count;
    } catch (error) {
        console.error('Error getting book entry count:', error);
        return 0;
    }
};

// Get total entry count
export const getTotalEntryCount = () => {
    try {
        const database = initDb();
        const result = database.getFirstSync(`SELECT COUNT(*) as count FROM journal_entries`);
        return (result as { count: number }).count;
    } catch (error) {
        console.error('Error getting total entry count:', error);
        return 0;
    }
};

export default db;