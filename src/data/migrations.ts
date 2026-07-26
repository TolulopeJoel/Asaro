import { withDatabase, getDbVersion, setDbVersion } from './db';

const CURRENT_DB_VERSION = 7;

export const initializeDatabase = async (): Promise<boolean> => {
    try {
        return await withDatabase(async (database) => {
            const currentVersion = await getDbVersion(database);

            // Migration logic: Run each pending migration in order
            if (currentVersion < 1) {
                // First time setup (v1)
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
            }

            if (currentVersion < 2) {
                // Migration to v2: Clean up legacy columns
                const tableInfo = await database.getAllAsync(`PRAGMA table_info(journal_entries)`) as any[];
                if (tableInfo.some((col: any) => col.name === 'date_created')) {
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
                }
            }

            if (currentVersion < 3) {
                // Migration to v3: Create action_items table and migrate reflection_3
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

                const entriesWithR3 = await database.getAllAsync<{ id: number; reflection_3: string }>(
                    `SELECT id, reflection_3 FROM journal_entries WHERE reflection_3 IS NOT NULL AND reflection_3 != ''`
                );

                for (const entry of entriesWithR3) {
                    await database.runAsync(
                        `INSERT INTO action_items (entry_id, action, motivation, sort_order) VALUES (?, ?, '', 0)`,
                        [entry.id, entry.reflection_3]
                    );
                }
            }

            if (currentVersion < 4) {
                // Migration to v4: Add reading_progress, pin/complete status for actions, and study columns
                await database.execAsync(`
                    CREATE TABLE IF NOT EXISTS reading_progress (
                        item_id INTEGER PRIMARY KEY,
                        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                const addCol = async (table: string, colDef: string) => {
                    try { await database.runAsync(`ALTER TABLE ${table} ADD COLUMN ${colDef}`); } catch (e) { /* ignore if already exists */ }
                };

                await addCol('journal_entries', 'study_further TEXT');
                await addCol('journal_entries', 'study_further_reminder TEXT');
                await addCol('journal_entries', 'study_completed BOOLEAN DEFAULT 0');
                await addCol('action_items', 'is_completed BOOLEAN DEFAULT 0');
                await addCol('action_items', 'is_pinned BOOLEAN DEFAULT 0');
                await addCol('action_items', 'pinned_at DATETIME DEFAULT NULL');
            }

            if (currentVersion < 5) {
                // Migration to v5: FTS5 search and performance indexes
                await database.execAsync(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS journal_entries_fts USING fts5(
                        reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further,
                        content='journal_entries', content_rowid='id'
                    );

                    CREATE TRIGGER IF NOT EXISTS journal_entries_ai AFTER INSERT ON journal_entries BEGIN
                      INSERT INTO journal_entries_fts(rowid, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further)
                      VALUES (new.id, new.reflection_1, new.reflection_2, new.reflection_3, new.reflection_4, new.notes, new.study_further);
                    END;

                    CREATE TRIGGER IF NOT EXISTS journal_entries_ad AFTER DELETE ON journal_entries BEGIN
                      INSERT INTO journal_entries_fts(journal_entries_fts, rowid, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further)
                      VALUES('delete', old.id, old.reflection_1, old.reflection_2, old.reflection_3, old.reflection_4, old.notes, old.study_further);
                    END;

                    CREATE TRIGGER IF NOT EXISTS journal_entries_au AFTER UPDATE ON journal_entries BEGIN
                      INSERT INTO journal_entries_fts(journal_entries_fts, rowid, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further)
                      VALUES('delete', old.id, old.reflection_1, old.reflection_2, old.reflection_3, old.reflection_4, old.notes, old.study_further);
                      INSERT INTO journal_entries_fts(rowid, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further)
                      VALUES (new.id, new.reflection_1, new.reflection_2, new.reflection_3, new.reflection_4, new.notes, new.study_further);
                    END;

                    CREATE VIRTUAL TABLE IF NOT EXISTS action_items_fts USING fts5(
                        action, motivation,
                        content='action_items', content_rowid='id'
                    );

                    CREATE TRIGGER IF NOT EXISTS action_items_ai AFTER INSERT ON action_items BEGIN
                      INSERT INTO action_items_fts(rowid, action, motivation)
                      VALUES (new.id, new.action, new.motivation);
                    END;

                    CREATE TRIGGER IF NOT EXISTS action_items_ad AFTER DELETE ON action_items BEGIN
                      INSERT INTO action_items_fts(action_items_fts, rowid, action, motivation)
                      VALUES('delete', old.id, old.action, old.motivation);
                    END;

                    CREATE TRIGGER IF NOT EXISTS action_items_au AFTER UPDATE ON action_items BEGIN
                      INSERT INTO action_items_fts(action_items_fts, rowid, action, motivation)
                      VALUES('delete', old.id, old.action, old.motivation);
                      INSERT INTO action_items_fts(rowid, action, motivation)
                      VALUES (new.id, new.action, new.motivation);
                    END;

                    INSERT INTO journal_entries_fts(rowid, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further)
                    SELECT id, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further FROM journal_entries;

                    INSERT INTO action_items_fts(rowid, action, motivation)
                    SELECT id, action, motivation FROM action_items;

                    CREATE INDEX IF NOT EXISTS idx_action_items_pinned ON action_items(is_pinned, pinned_at);
                    CREATE INDEX IF NOT EXISTS idx_journal_entries_study ON journal_entries(study_completed);
                `);
            }

            if (currentVersion < 7) {
                // Migration to v7: Add study topics and references
                await database.execAsync(`
                    CREATE TABLE IF NOT EXISTS study_topics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        content TEXT,
                        color TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS study_topic_references (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        topic_id INTEGER NOT NULL,
                        book_name TEXT NOT NULL,
                        chapter INTEGER NOT NULL,
                        verse_start TEXT,
                        verse_end TEXT,
                        FOREIGN KEY (topic_id) REFERENCES study_topics(id) ON DELETE CASCADE
                    );
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
