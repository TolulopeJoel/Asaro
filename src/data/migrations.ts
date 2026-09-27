import { withDatabase, getDbVersion, setDbVersion } from './db';

const CURRENT_DB_VERSION = 5;

/**
 * The migration run, shared by everyone who asks for it.
 *
 * Migrations are not safe to run twice at once: two concurrent runs read the
 * same version, conclude the same step is outstanding, and the loser hits an
 * existing table or duplicate column. React re-invoking effects in development
 * makes that routine.
 *
 * Caching the promise makes the second caller await the first. Cached on
 * failure too — a failed migration is a state the app must surface, not retry
 * silently on the next render.
 */
let migrating: Promise<boolean> | null = null;

export const initializeDatabase = async (): Promise<boolean> => {
    if (!migrating) migrating = runMigrations();
    return migrating;
};

const runMigrations = async (): Promise<boolean> => {
    try {
        return await withDatabase(async (database) => {
            const currentVersion = await getDbVersion(database);

            // Each step commits with its version, so a later failure never re-runs it.
            const step = async (version: number, run: () => Promise<void>) => {
                await database.execAsync('BEGIN');
                try {
                    await run();
                    await setDbVersion(database, version);
                    await database.execAsync('COMMIT');
                } catch (error) {
                    await database.execAsync('ROLLBACK').catch(() => { });
                    throw error;
                }
            };

            if (currentVersion < 1) await step(1, async () => {
                // v1: first-time setup
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
            });

            if (currentVersion < 2) await step(2, async () => {
                // v2: drop the legacy date_created column
                const tableInfo = await database.getAllAsync(`PRAGMA table_info(journal_entries)`) as any[];
                if (tableInfo.some((col: any) => col.name === 'date_created')) {
                    await database.execAsync(`
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
                    `);
                }
            });

            if (currentVersion < 3) await step(3, async () => {
                // v3: action_items, seeded from reflection_3
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
            });

            if (currentVersion < 4) await step(4, async () => {
                // v4: reading_progress, action pin/complete flags, study columns
                await database.execAsync(`
                    CREATE TABLE IF NOT EXISTS reading_progress (
                        item_id INTEGER PRIMARY KEY,
                        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                const addCol = async (table: string, colDef: string) => {
                    try { await database.runAsync(`ALTER TABLE ${table} ADD COLUMN ${colDef}`); } catch { /* ignore if already exists */ }
                };

                await addCol('journal_entries', 'study_further TEXT');
                await addCol('journal_entries', 'study_further_reminder TEXT');
                await addCol('journal_entries', 'study_completed BOOLEAN DEFAULT 0');
                await addCol('action_items', 'is_completed BOOLEAN DEFAULT 0');
                await addCol('action_items', 'is_pinned BOOLEAN DEFAULT 0');
                await addCol('action_items', 'pinned_at DATETIME DEFAULT NULL');
            });

            // A dev database numbered past this build is rebuilt to v5 too; every statement is idempotent.
            if (currentVersion < 5 || currentVersion > CURRENT_DB_VERSION) await step(5, async () => {
                // v5: everything since v4, the last version shipped.
                const exists = async (name: string) =>
                    !!(await database.getFirstAsync(`SELECT 1 FROM sqlite_master WHERE name = ?`, [name]));
                const addColumn = async (table: string, column: string) => {
                    try { await database.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column}`); } catch { /* already present */ }
                };

                // The search index is filled only when it is created; refilling would duplicate it.
                const hadEntrySearch = await exists('journal_entries_fts');
                const hadActionSearch = await exists('action_items_fts');
                await database.execAsync(SEARCH_SCHEMA);
                if (!hadEntrySearch) await database.execAsync(ENTRY_SEARCH_FILL);
                if (!hadActionSearch) await database.execAsync(ACTION_SEARCH_FILL);

                for (const column of ['cadence TEXT', 'due_at DATETIME', 'archived_at DATETIME']) {
                    await addColumn('action_items', column);
                }
                await database.execAsync(PRACTICE_SCHEMA);
                await database.execAsync(THEMES_SCHEMA);
                await database.execAsync(OBSERVATIONS_SCHEMA);
                for (const column of ['shown_count INTEGER NOT NULL DEFAULT 0', 'followed_at DATETIME', 'retracted_at DATETIME']) {
                    await addColumn('observations', column);
                }

                // Leftovers that only dev databases can hold.
                await database.execAsync(`
                    DROP TABLE IF EXISTS study_topic_references;
                    DROP TABLE IF EXISTS study_topics;
                    DELETE FROM observation_evidence WHERE observation_id IN
                        (SELECT id FROM observations WHERE dedupe_key LIKE 'preview:%');
                    DELETE FROM observations WHERE dedupe_key LIKE 'preview:%';
                `);
            });

            await setDbVersion(database, CURRENT_DB_VERSION);

            return true;
        });
    } catch (error) {
        // Logged with the cause: a bare "failed to initialize" says only that
        // something went wrong somewhere in the migrations.
        console.error('Database init error:', error);
        return false;
    }
};

// ─── The v5 schema ────────────────────────────────────────────────────────────

/** Full-text search over entries and action items, kept in step by triggers. */
const SEARCH_SCHEMA = `
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

    CREATE INDEX IF NOT EXISTS idx_action_items_pinned ON action_items(is_pinned, pinned_at);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_study ON journal_entries(study_completed);
`;

const ENTRY_SEARCH_FILL = `
    INSERT INTO journal_entries_fts(rowid, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further)
    SELECT id, reflection_1, reflection_2, reflection_3, reflection_4, notes, study_further FROM journal_entries;
`;

const ACTION_SEARCH_FILL = `
    INSERT INTO action_items_fts(rowid, action, motivation)
    SELECT id, action, motivation FROM action_items;
`;

/**
 * A practice completes once per local day, so completions are a log keyed on
 * the local date string; the primary key makes marking a day idempotent.
 */
const PRACTICE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS action_item_completions (
        action_item_id INTEGER NOT NULL,
        completed_on TEXT NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (action_item_id, completed_on),
        FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_completions_item
        ON action_item_completions(action_item_id, completed_on DESC);
`;

/** One embedding per (entry, field), and the themes the reader has named. */
const THEMES_SCHEMA = `
    CREATE TABLE IF NOT EXISTS entry_embeddings (
        entry_id INTEGER NOT NULL,
        field TEXT NOT NULL,
        model TEXT NOT NULL,
        vector BLOB NOT NULL,
        text_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (entry_id, field),
        FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_embeddings_model ON entry_embeddings(model);

    CREATE TABLE IF NOT EXISTS themes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS theme_members (
        theme_id INTEGER NOT NULL,
        entry_id INTEGER NOT NULL,
        field TEXT NOT NULL,
        PRIMARY KEY (theme_id, entry_id, field),
        FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
        FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
    );
`;

/** Findings and their receipts. design/DETECTORS.md */
const OBSERVATIONS_SCHEMA = `
    CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        detector TEXT NOT NULL,
        dedupe_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        shown_at DATETIME,
        shown_count INTEGER NOT NULL DEFAULT 0,
        opened_at DATETIME,
        followed_at DATETIME,
        dismissed_at DATETIME,
        feedback INTEGER,
        retracted_at DATETIME,
        UNIQUE (detector, dedupe_key)
    );

    CREATE TABLE IF NOT EXISTS observation_evidence (
        observation_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        entry_id INTEGER,
        field TEXT,
        verse_id INTEGER,
        action_item_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (observation_id) REFERENCES observations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_obs_detector ON observations(detector, created_at);
    CREATE INDEX IF NOT EXISTS idx_obs_pending ON observations(shown_at, confidence);
    CREATE INDEX IF NOT EXISTS idx_obs_evidence ON observation_evidence(observation_id);
`;
