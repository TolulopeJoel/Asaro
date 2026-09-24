import { withDatabase, getDbVersion, setDbVersion } from './db';

const CURRENT_DB_VERSION = 13;

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

            if (currentVersion < 8) {
                // Migration to v8: drop standalone study topics.
                // "Study" is now a single concept — the study_further field on a
                // journal entry, which is born out of the reflection flow. The
                // separate topics table was a parallel model under the same name.
                await database.execAsync(`
                    DROP TABLE IF EXISTS study_topic_references;
                    DROP TABLE IF EXISTS study_topics;
                `);
            }

            if (currentVersion < 9) {
                // Migration to v9: embeddings for Themes.
                //
                // One row per (entry, field) rather than per entry: the four
                // prompts are compared separately, since every answer to one
                // prompt shares a direction that would otherwise drown out
                // what each answer is actually about.
                //
                // `model` is recorded so a future model change can invalidate
                // and re-embed only what it needs to, instead of silently
                // mixing vectors from two different spaces — which would
                // produce plausible-looking nonsense.
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
                    -- that formed it; that way a name the person chose survives
                    -- re-clustering instead of being silently reshuffled.
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
                 * Migration to v10: observations.
                 *
                 * The unit the reader is shown. Every detector — the ones that
                 * walk the cross-reference graph, the ones that count what is
                 * missing, the ones that cluster — writes the same record
                 * here, so the ranking, the pacing and the feedback loop are
                 * written once rather than per detector.
                 *
                 * `payload` holds the structured claim and never its wording.
                 * Phrasing is chosen at render time, so a better sentence can
                 * ship in an update without rewriting anyone's history, and
                 * two readers with the same finding are never stuck with one
                 * frozen string.
                 *
                 * `dedupe_key` is what stops a true noticing becoming a
                 * nag. Detectors re-run as the journal grows and will keep
                 * finding the same thing; the key identifies the finding
                 * rather than the run, so the second discovery updates the
                 * first instead of queueing behind it.
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

                    -- The receipts. An observation the reader cannot check is
                    -- a horoscope, so the evidence is stored with the claim
                    -- rather than recomputed when they ask for it — recomputed
                    -- evidence can disagree with the claim it justifies.
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
                 * Migration to v11: what kind of thing an action item is.
                 *
                 * The entry wizard asks "How can I realistically apply this in
                 * my life?" and prompts with "I will…", which invites a
                 * commitment about character. Everything downstream then filed
                 * the answer as a task: a completion checkbox, an Actions tab,
                 * reminders windowed by age. A real journal showed the cost —
                 * ten items, not one ever ticked, because nobody finishes
                 * being kinder to their parents.
                 *
                 * Three kinds genuinely live in this column, and they are told
                 * apart by what the writer supplied rather than by a category
                 * they were made to choose:
                 *
                 *   nothing   an application — standing, never completed
                 *   cadence   a practice — recurring, completed per occurrence
                 *   due_at    an action — a task, completed once
                 *
                 * Deriving the kind keeps the writing surface as it is. Both
                 * columns are null for every existing row, so the whole
                 * journal becomes applications, which is what it always was.
                 */
                // Guarded the way v4 adds columns: ALTER TABLE has no IF NOT
                // EXISTS in SQLite, and a half-applied migration must not wedge
                // the app on the next launch.
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
                 * Migration to v12: practice completions.
                 *
                 * A practice completes per occurrence, so `is_completed` — a
                 * single boolean — cannot represent it. "Done today but not
                 * yesterday" needs a log, and a log is what streaks and any
                 * future widget both rest on.
                 *
                 * Keyed on a LOCAL date string, not a timestamp. A practice is
                 * done "today", and today is wherever the reader is; deriving
                 * the day from a UTC timestamp would move completions across
                 * midnight for anyone east or west of it and quietly break
                 * their streak. `reading_progress` is the same shape, so this
                 * is a pattern the app already keeps.
                 *
                 * The primary key makes marking a day done idempotent, which
                 * matters when the same tap can arrive from a card, a list and
                 * eventually a home-screen widget.
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
                 * Migration to v13: archiving, which replaces deleting.
                 *
                 * An action item is part of what someone wrote on a given day.
                 * Deleting one does not tidy a list — it rewrites the entry, so
                 * the journal no longer says what it said. A commitment that
                 * has served its purpose has not stopped having been made.
                 *
                 * `archived_at` rather than a flag, matching `pinned_at`: when
                 * something was set down is worth keeping, and a practice keeps
                 * its completion history either way. Archiving hides a thing
                 * from what you are working on; it never edits the past.
                 */
                try {
                    await database.runAsync(`ALTER TABLE action_items ADD COLUMN archived_at DATETIME`);
                } catch {
                    /* already present */
                }
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
