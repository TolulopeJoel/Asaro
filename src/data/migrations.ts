import { withDatabase, getDbVersion, setDbVersion } from './db';

const CURRENT_DB_VERSION = 14;

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

            if (currentVersion < 1) {
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
            }

            if (currentVersion < 2) {
                // v2: drop the legacy date_created column
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
            }

            if (currentVersion < 4) {
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
            }

            if (currentVersion < 5) {
                // v5: FTS5 search and performance indexes
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
                // v7: standalone study topics (dropped again in v8)
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

            if (currentVersion < 8) {
                // v8: drop standalone study topics. Study is one concept — the
                // study_further field on an entry, born out of the reflection
                // flow. The topics table was a parallel model under one name.
                await database.execAsync(`
                    DROP TABLE IF EXISTS study_topic_references;
                    DROP TABLE IF EXISTS study_topics;
                `);
            }

            if (currentVersion < 9) {
                // v9: embeddings for Themes.
                //
                // One row per (entry, field), not per entry: answers to one
                // prompt share a direction that would drown out what each
                // answer is actually about.
                //
                // `model` is recorded so a model change can re-embed only what
                // it needs to, rather than mixing vectors from two spaces.
                await database.execAsync(`
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

                    -- Themes the reader has named. Clusters are recomputed as
                    -- entries accumulate, so a theme is anchored to the entries
                    -- that formed it and a chosen name survives re-clustering.
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
                `);
            }

            if (currentVersion < 10) {
                /*
                 * v10: observations — the unit the reader is shown. Every
                 * detector writes the same record, so ranking, pacing and the
                 * feedback loop are written once rather than per detector.
                 *
                 * `payload` holds the structured claim, never its wording, so a
                 * better sentence can ship without rewriting anyone's history.
                 *
                 * `dedupe_key` identifies the finding rather than the run, so
                 * rediscovery updates the first row instead of queueing behind
                 * it. See design/DETECTORS.md.
                 */
                await database.execAsync(`
                    CREATE TABLE IF NOT EXISTS observations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        detector TEXT NOT NULL,
                        dedupe_key TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        confidence REAL NOT NULL DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        shown_at DATETIME,
                        opened_at DATETIME,
                        dismissed_at DATETIME,
                        feedback INTEGER,
                        UNIQUE (detector, dedupe_key)
                    );

                    -- The receipts. Stored with the claim rather than
                    -- recomputed on demand: recomputed evidence can disagree
                    -- with the claim it is meant to justify.
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
                `);
            }

            if (currentVersion < 11) {
                /*
                 * v11: what kind of thing an action item is. Three kinds live
                 * in this column, told apart by what the writer supplied rather
                 * than by a category they were made to choose:
                 *
                 *   nothing   an application — standing, never completed
                 *   cadence   a practice — recurring, completed per occurrence
                 *   due_at    an action — a task, completed once
                 *
                 * Both columns are null for every existing row, so the whole
                 * journal becomes applications, which is what it always was.
                 *
                 * Guarded like v4: SQLite ALTER TABLE has no IF NOT EXISTS, and
                 * a half-applied migration must not wedge the next launch.
                 */
                for (const column of ['cadence TEXT', 'due_at DATETIME']) {
                    try {
                        await database.runAsync(`ALTER TABLE action_items ADD COLUMN ${column}`);
                    } catch {
                        /* already present */
                    }
                }
            }

            if (currentVersion < 12) {
                /*
                 * v12: practice completions. A practice completes per
                 * occurrence, so a single `is_completed` boolean cannot
                 * represent it — "done today but not yesterday" needs a log.
                 *
                 * Keyed on a LOCAL date string, not a timestamp: today is
                 * wherever the reader is, and deriving the day from UTC moves
                 * completions across midnight and breaks streaks.
                 * `reading_progress` is the same shape.
                 *
                 * The primary key makes marking a day done idempotent.
                 */
                await database.execAsync(`
                    CREATE TABLE IF NOT EXISTS action_item_completions (
                        action_item_id INTEGER NOT NULL,
                        completed_on TEXT NOT NULL,
                        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (action_item_id, completed_on),
                        FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_completions_item
                        ON action_item_completions(action_item_id, completed_on DESC);
                `);
            }

            if (currentVersion < 13) {
                /*
                 * v13: archiving, which replaces deleting. An action item is
                 * part of what someone wrote on a given day, so deleting one
                 * rewrites the entry rather than tidying a list.
                 *
                 * `archived_at` rather than a flag, matching `pinned_at`.
                 * Archiving hides a thing from what you are working on; it
                 * never edits the past.
                 */
                try {
                    await database.runAsync(`ALTER TABLE action_items ADD COLUMN archived_at DATETIME`);
                } catch {
                    /* already present */
                }
            }

            if (currentVersion < 14) {
                /*
                 * v14: findings that come round again, and knowing when one was
                 * acted on. `shown_at` becomes "last shown" rather than a
                 * one-way door, with `shown_count` recording how many times
                 * round a finding has been — right for a standing commitment,
                 * which is not a reminder if met once in a lifetime.
                 *
                 * `followed_at` records tapping through to a passage, the
                 * strongest evidence a card worked.
                 */
                for (const column of ['shown_count INTEGER NOT NULL DEFAULT 0', 'followed_at DATETIME']) {
                    try {
                        await database.runAsync(`ALTER TABLE observations ADD COLUMN ${column}`);
                    } catch {
                        /* already present */
                    }
                }
                // Anything already shown has been round exactly once.
                await database.runAsync(
                    `UPDATE observations SET shown_count = 1 WHERE shown_at IS NOT NULL`,
                );
            }

            await setDbVersion(database, CURRENT_DB_VERSION);

            return true;
        });
    } catch (error) {
        // Logged with the cause: a bare "failed to initialize" says only that
        // something went wrong somewhere in fourteen migrations.
        console.error('Database init error:', error);
        return false;
    }
};
