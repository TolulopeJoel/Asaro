import * as SQLite from 'expo-sqlite';
import { withDatabase, withTransaction } from './db';
import { ActionItem, JournalEntry, JournalEntryInput, EnhancedActionItem, StudyItem } from './types';
import { formatDateToLocalString, getTodayDateString, parseLocalDateString } from '../utils/dateUtils';
import { READING_PLAN_DATA, type ReadingItem } from './readingPlanData';
import { CoverageRow } from '../land/cloth';
import { retractCiting, retractKeys } from '../insight/observation';
import { tellDpcEntrySaved } from '@/modules/dpc-bridge';
import { answeredCount } from './questions';

type ActionItemInput = NonNullable<JournalEntryInput['actionItems']>[number];
type StudyTopicInput = NonNullable<JournalEntryInput['studyTopics']>[number];

/**
 * The chapters a plan item covers, ignoring verse suffixes.
 *
 * "119:64-176" is one chapter; "116-119:63" is four. Getting that backwards
 * marks most of Psalms read off a single entry — which is why this is one
 * shared function rather than a copy per call site.
 */
export function planItemChapters(chapters?: string): { start: number; end: number } | null {
    if (!chapters) return null;

    const parts = chapters.split('-');
    const firstHasVerse = parts[0].includes(':');
    const start = parseInt(parts[0].split(':')[0], 10);

    let end: number;
    if (parts.length > 1) {
        // A verse on the FIRST part means the second part is a verse in the
        // same chapter, not another chapter.
        end = firstHasVerse ? start : parseInt(parts[parts.length - 1].split(':')[0], 10);
    } else {
        end = start;
    }

    if (isNaN(start) || isNaN(end)) return null;
    return { start, end };
}

/** Whether a plan item's book name refers to this book. */
export function planItemCoversBook(planBook: string, bookName: string): boolean {
    const plan = planBook.toLowerCase();
    const book = bookName.toLowerCase();
    // The plan pairs some books up: "Obadiah/Jonah", "2 John/3 John/Jude".
    return plan === book || plan.split('/').includes(book);
}

/** An entry's passage, as far as the plan is concerned. */
export interface EntryRange {
    book: string;
    start: number;
    end: number;
    /** Written before the reader said where they are: it counts as written, but no longer says where they are. */
    beforeStart?: boolean;
}

/**
 * The plan reading that comes up next, and the chapters of it still to write about.
 *
 * It follows the newest entry that touches the plan, wherever that is: someone
 * who wrote on 1 John 1–3 is in 1 John, not back at Genesis. While that reading
 * isn't fully written about it stays up, narrowed to what's left (1 John 4–5);
 * once it is, the next reading after it that isn't done comes up. With no entry
 * in the plan, it's the first reading not done from where they said they are
 * (`startId`), or from Genesis. Null when the plan is finished.
 *
 * `entries` newest first.
 */
export function planPosition(
    plan: readonly ReadingItem[],
    entries: readonly EntryRange[],
    ticked: ReadonlySet<number>,
    startId?: number,
): { item: ReadingItem; chapters: string } | null {
    const written = new Map<string, Set<number>>();
    for (const entry of entries) {
        const chapters = written.get(entry.book) ?? new Set<number>();
        for (let ch = entry.start; ch <= entry.end; ch++) chapters.add(ch);
        written.set(entry.book, chapters);
    }

    // Chapters of a reading nobody has written about yet; null for one that names no chapters.
    const unwritten = (item: ReadingItem) => {
        const range = planItemChapters(item.chapters);
        if (!range) return null;
        const books = item.book.split('/').map(b => b.trim());
        const left: number[] = [];
        for (let ch = range.start; ch <= range.end; ch++) {
            if (!books.some(book => written.get(book)?.has(ch))) left.push(ch);
        }
        return left;
    };
    const done = (item: ReadingItem) => ticked.has(item.id) || unwritten(item)?.length === 0;

    const show = (item: ReadingItem) => {
        const left = unwritten(item);
        // "119:64-176" is part of a chapter: there is nothing smaller to narrow it to.
        if (!left?.length || item.chapters.includes(':')) return { item, chapters: item.chapters };
        const first = left[0];
        const last = left[left.length - 1];
        return { item, chapters: first === last ? `${first}` : `${first}-${last}` };
    };

    for (const entry of entries) {
        if (entry.beforeStart) continue;
        const touched = plan.filter(item => {
            if (!planItemCoversBook(item.book, entry.book)) return false;
            const range = planItemChapters(item.chapters);
            return !range || (entry.start <= range.end && entry.end >= range.start);
        });
        if (touched.length === 0) continue;

        const at = touched[touched.length - 1];
        if (!done(at)) return show(at);
        const after = plan.slice(plan.indexOf(at) + 1).find(item => !done(item));
        const next = after ?? plan.find(item => !done(item));
        return next ? show(next) : null;
    }

    const from = Math.max(0, plan.findIndex(item => item.id === startId));
    const first = plan.slice(from).find(item => !done(item)) ?? plan.find(item => !done(item));
    return first ? show(first) : null;
}

export const findMatchingReadingPlanItems = async (
    database: SQLite.SQLiteDatabase,
    bookName: string,
    chapterStart?: number,
    chapterEnd?: number
): Promise<number[]> => {
    if (!chapterStart) return [];

    const effectiveEnd = chapterEnd ?? chapterStart;
    const matched: number[] = [];

    for (const item of READING_PLAN_DATA) {
        if (!planItemCoversBook(item.book, bookName)) continue;

        const range = planItemChapters(item.chapters);
        if (!range) continue;
        const { start: planStart, end: planEnd } = range;

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
 * Helper to check if a chapter range is fully covered by the union of entries.
 */
export const checkRangeCovered = async (
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

/** Study topics as rows come back from SQLite, with `completed` as a real boolean. */
const STUDY_ITEM_COLUMNS = `id, entry_id, topic, reminder, completed, sort_order`;
const toStudyItem = (row: Omit<StudyItem, 'completed'> & { completed: number }): StudyItem =>
    ({ ...row, completed: !!row.completed });

/** Attach each entry's action items and study topics, in two queries for the whole list. */
export const attachItems = async (
    database: SQLite.SQLiteDatabase,
    entries: JournalEntry[]
): Promise<JournalEntry[]> => {
    if (entries.length === 0) return entries;

    const ids = entries.map(e => e.id).filter((id): id is number => id != null);
    if (ids.length === 0) return entries;

    const placeholders = ids.map(() => '?').join(',');
    const actionItems = await database.getAllAsync<ActionItem>(
        `SELECT * FROM action_items WHERE entry_id IN (${placeholders}) ORDER BY sort_order ASC`,
        ids
    );
    const studyItems = await database.getAllAsync<Omit<StudyItem, 'completed'> & { completed: number }>(
        `SELECT ${STUDY_ITEM_COLUMNS} FROM study_items WHERE entry_id IN (${placeholders}) ORDER BY sort_order ASC`,
        ids
    );

    const itemsByEntry = new Map<number, ActionItem[]>();
    for (const item of actionItems) {
        const list = itemsByEntry.get(item.entry_id!) || [];
        list.push(item);
        itemsByEntry.set(item.entry_id!, list);
    }
    const topicsByEntry = new Map<number, StudyItem[]>();
    for (const row of studyItems) {
        const list = topicsByEntry.get(row.entry_id) || [];
        list.push(toStudyItem(row));
        topicsByEntry.set(row.entry_id, list);
    }

    return entries.map(entry => ({
        ...entry,
        action_items: itemsByEntry.get(entry.id!) || [],
        study_items: topicsByEntry.get(entry.id!) || [],
    }));
};

/**
 * Untick plan readings no longer covered by any entry.
 *
 * The plan's invariant is that an item is ticked **if and only if** entries
 * cover its chapters. The Plan tab enforces it going in; this enforces it
 * coming out, for deleted entries and for ranges that were shortened.
 *
 * Only ever REMOVES. Adding a tick is the save path's job: a reading becomes
 * done because somebody wrote something, which is an event rather than a state
 * to be discovered later.
 *
 * CAREFUL: this assumes every tick is entry-derived, which is why no
 * provenance column is needed. Allowing manual ticking means adding one, or
 * this revokes the reader's own claim.
 */
export const retractUncoveredReadings = async (): Promise<number[]> => {
    return withDatabase(async (database) => {
        const ticked = await database.getAllAsync<{ item_id: number }>(
            `SELECT item_id FROM reading_progress`
        );
        if (ticked.length === 0) return [];

        // Every chapter written about, read once: the same rule as
        // `checkRangeCovered`, without a query per ticked reading.
        const rows = await database.getAllAsync<{ book_name: string; chapter_start: number; chapter_end: number | null }>(
            `SELECT book_name, chapter_start, chapter_end FROM journal_entries WHERE chapter_start IS NOT NULL`
        );
        const written = new Map<string, Set<number>>();
        for (const row of rows) {
            const chapters = written.get(row.book_name) ?? new Set<number>();
            for (let ch = row.chapter_start; ch <= (row.chapter_end ?? row.chapter_start); ch++) chapters.add(ch);
            written.set(row.book_name, chapters);
        }
        const covers = (book: string, start: number, end: number) => {
            const chapters = written.get(book);
            if (!chapters) return false;
            for (let ch = start; ch <= end; ch++) if (!chapters.has(ch)) return false;
            return true;
        };

        const byId = new Map(READING_PLAN_DATA.map(item => [item.id, item]));
        const dropped: number[] = [];

        for (const { item_id } of ticked) {
            const item = byId.get(item_id);
            // A tick whose plan item no longer exists (the plan was edited
            // between releases) is uncovered by definition.
            if (!item) {
                dropped.push(item_id);
                continue;
            }

            const range = planItemChapters(item.chapters);
            if (!range) continue;

            // A paired item ("Obadiah/Jonah") is covered if ANY of its books
            // covers the range — matching the joined string against a book
            // name unticks all eleven of them on the first run.
            const covered = item.book.split('/').some(book => covers(book.trim(), range.start, range.end));
            if (!covered) dropped.push(item_id);
        }

        if (dropped.length > 0) {
            await database.runAsync(
                `DELETE FROM reading_progress WHERE item_id IN (${dropped.map(() => '?').join(',')})`,
                dropped,
            );
        }
        return dropped;
    });
};

/**
 * Tick every plan reading the journal now covers. A reading picked from the
 * plan ticks once all its chapters are written about, or on any entry in its
 * book if it lists no chapters.
 */
async function tickCoveredReadings(database: SQLite.SQLiteDatabase, data: JournalEntryInput): Promise<void> {
    const ids = new Set(await findMatchingReadingPlanItems(database, data.bookName, data.chapterStart, data.chapterEnd));

    const chosen = data.readingItemId ? READING_PLAN_DATA.find(item => item.id === data.readingItemId) : undefined;
    if (chosen && planItemCoversBook(chosen.book, data.bookName)) {
        const range = planItemChapters(chosen.chapters);
        if (!chosen.chapters) {
            ids.add(chosen.id);
        } else if (range && await checkRangeCovered(database, data.bookName, range.start, range.end)) {
            ids.add(chosen.id);
        }
    }

    for (const id of ids) {
        await database.runAsync(`INSERT OR IGNORE INTO reading_progress (item_id) VALUES (?)`, [id]);
    }
}

const isBlankItem = (item: ActionItemInput) => !item.action.trim() && !item.motivation.trim();

async function insertActionItem(database: SQLite.SQLiteDatabase, entryId: number, item: ActionItemInput, sortOrder: number) {
    await database.runAsync(
        `INSERT INTO action_items (entry_id, action, motivation, sort_order, cadence, due_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [entryId, item.action, item.motivation, sortOrder, item.cadence ?? null, item.due_at ?? null, item.archived_at ?? null]
    );
}

/** Delete action items with their completions and the findings that cite them. */
async function deleteActionItems(database: SQLite.SQLiteDatabase, ids: number[]) {
    if (ids.length === 0) return;
    const marks = ids.map(() => '?').join(',');
    await retractCiting(database, { actionItemIds: ids });
    await database.runAsync(`DELETE FROM action_item_completions WHERE action_item_id IN (${marks})`, ids);
    await database.runAsync(`DELETE FROM action_items WHERE id IN (${marks})`, ids);
}

/**
 * Bring an entry's action items in line with an edit. Rows are matched by id so
 * completions, pins and completion state stay with the item; rows the edit
 * dropped are deleted with their history.
 */
async function saveActionItems(database: SQLite.SQLiteDatabase, entryId: number, items: ActionItemInput[]) {
    const existing = await database.getAllAsync<{ id: number; archived_at: string | null }>(
        `SELECT id, archived_at FROM action_items WHERE entry_id = ?`, [entryId]
    );
    const archivedBefore = new Map(existing.map(row => [row.id, row.archived_at]));
    const kept = new Set<number>();
    const newlyArchived: string[] = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (isBlankItem(item)) continue;

        if (item.id != null && archivedBefore.has(item.id) && !kept.has(item.id)) {
            kept.add(item.id);
            await database.runAsync(
                `UPDATE action_items SET action = ?, motivation = ?, sort_order = ?, cadence = ?, due_at = ?, archived_at = ?
                 WHERE id = ?`,
                [item.action, item.motivation, i, item.cadence ?? null, item.due_at ?? null, item.archived_at ?? null, item.id]
            );
            if (item.archived_at && !archivedBefore.get(item.id)) newlyArchived.push(`action:${item.id}`);
        } else {
            await insertActionItem(database, entryId, item, i);
        }
    }

    await retractKeys(database, 'commitment', newlyArchived);
    await deleteActionItems(database, existing.map(row => row.id).filter(id => !kept.has(id)));
}

/** Delete study topics and the findings keyed on them. Their reminders are re-synced by the caller. */
async function deleteStudyItems(database: SQLite.SQLiteDatabase, ids: number[]) {
    if (ids.length === 0) return;
    await retractKeys(database, 'study', ids.map(id => `topic:${id}`));
    await database.runAsync(`DELETE FROM study_items WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

/**
 * Bring an entry's study topics in line with an edit. Rows are matched by id so a topic
 * keeps its done flag when its words change; blank topics are dropped, and so are rows
 * the edit removed.
 */
async function saveStudyItems(database: SQLite.SQLiteDatabase, entryId: number, topics: StudyTopicInput[]) {
    const existing = await database.getAllAsync<{ id: number }>(`SELECT id FROM study_items WHERE entry_id = ?`, [entryId]);
    const known = new Set(existing.map(row => row.id));
    const kept = new Set<number>();
    let order = 0;

    for (const topic of topics) {
        if (!topic.topic.trim()) continue;
        if (topic.id != null && known.has(topic.id) && !kept.has(topic.id)) {
            kept.add(topic.id);
            await database.runAsync(
                `UPDATE study_items SET topic = ?, reminder = ?, sort_order = ? WHERE id = ?`,
                [topic.topic.trim(), topic.reminder ?? null, order++, topic.id]
            );
        } else {
            await database.runAsync(
                `INSERT INTO study_items (entry_id, topic, reminder, sort_order) VALUES (?, ?, ?, ?)`,
                [entryId, topic.topic.trim(), topic.reminder ?? null, order++]
            );
        }
    }

    await deleteStudyItems(database, existing.map(row => row.id).filter(id => !kept.has(id)));
}

/**
 * Tolu's DPC opens the phone in the morning only for a real entry: at least two of the questions answered.
 * A one-line entry saves as usual but doesn't count.
 */
const DPC_MIN_ANSWERS = 2;

/** Counted the way the app counts: "applying it" is answered by an action item and "study further" by a topic, not by a reflection. */
const answered = (data: JournalEntryInput) => answeredCount({
    reflection1: data.reflections[0],
    reflection2: data.reflections[1],
    reflection4: data.reflections[3],
    actionItems: data.actionItems,
    studyTopics: data.studyTopics,
});

export const createJournalEntry = async (data: JournalEntryInput) => {
    const reflections = [...data.reflections, '', '', '', ''].slice(0, 4);

    const newId = await withTransaction(async (database) => {
        const result = await database.runAsync(
            `INSERT INTO journal_entries (book_name, chapter_start, chapter_end, verse_start, verse_end, reflection_1, reflection_2, reflection_3, reflection_4, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.bookName, data.chapterStart ?? null, data.chapterEnd ?? null, data.verseStart ?? null, data.verseEnd ?? null, ...reflections, data.notes ?? null]
        );

        const entryId = result.lastInsertRowId;

        const items = data.actionItems ?? [];
        for (let i = 0; i < items.length; i++) {
            if (!isBlankItem(items[i])) await insertActionItem(database, entryId, items[i], i);
        }
        await saveStudyItems(database, entryId, data.studyTopics ?? []);

        await tickCoveredReadings(database, data);
        return entryId;
    });

    // Only once the entry is committed, and only with two answers: this is what opens the phone in the morning.
    if (answered(data) >= DPC_MIN_ANSWERS) tellDpcEntrySaved();
    return newId;
};

export const updateJournalEntry = async (id: number, data: JournalEntryInput) => {
    const reflections = [...data.reflections, '', '', '', ''].slice(0, 4);

    await withTransaction(async (database) => {
        await database.runAsync(
            `UPDATE journal_entries SET book_name = ?, chapter_start = ?, chapter_end = ?, verse_start = ?, verse_end = ?, 
             reflection_1 = ?, reflection_2 = ?, reflection_3 = ?, reflection_4 = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [data.bookName, data.chapterStart ?? null, data.chapterEnd ?? null, data.verseStart ?? null, data.verseEnd ?? null, ...reflections, data.notes ?? null, id]
        );

        await saveActionItems(database, id, data.actionItems ?? []);
        await saveStudyItems(database, id, data.studyTopics ?? []);

        await tickCoveredReadings(database, data);
    });

    // An edit can widen a range (ticked above) or shrink it (unticked here).
    await retractUncoveredReadings();

    // Finishing today's entry later counts too: once it has two answers, the phone opens. An old entry doesn't.
    if (answered(data) >= DPC_MIN_ANSWERS) {
        const row = await withDatabase(database => database.getFirstAsync<{ today: number }>(
            `SELECT date(created_at, 'localtime') = date('now', 'localtime') AS today FROM journal_entries WHERE id = ?`, [id]
        ));
        if (row?.today) tellDpcEntrySaved();
    }
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
        return await attachItems(database, entries);
    });
};

export const getEntriesByBook = async (bookName: string): Promise<JournalEntry[]> => {
    return await withDatabase(async (database) => {
        const entries = await database.getAllAsync<JournalEntry>(
            `SELECT *, datetime(created_at, 'localtime') as created_at, datetime(updated_at, 'localtime') as updated_at FROM journal_entries WHERE book_name = ? ORDER BY chapter_start ASC`, [bookName]
        );
        return await attachItems(database, entries);
    });
};

/**
 * Search text as an FTS5 query: every word a quoted token, so punctuation and
 * operators are literal, and the last word also a prefix. Null for blank input.
 */
export function ftsQuery(term: string): string | null {
    const words = term.split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    return words
        .map((word, i) => `"${word.replace(/"/g, '""')}"${i === words.length - 1 ? '*' : ''}`)
        .join(' ');
}

export const searchEntries = async (term: string): Promise<JournalEntry[]> => {
    if (!term.trim()) {
        return [];
    }

    const match = ftsQuery(term);
    if (!match) return [];
    const bookLike = `%${term.trim().replace(/[\\%_]/g, c => `\\${c}`)}%`;

    return await withDatabase(async (database) => {
        const query = `
            SELECT je.*, datetime(je.created_at, 'localtime') as created_at, datetime(je.updated_at, 'localtime') as updated_at FROM journal_entries je
            WHERE je.id IN (
                SELECT rowid FROM journal_entries_fts WHERE journal_entries_fts MATCH ?
                UNION
                SELECT entry_id FROM action_items WHERE id IN (
                    SELECT rowid FROM action_items_fts WHERE action_items_fts MATCH ?
                )
                UNION
                SELECT entry_id FROM study_items WHERE id IN (
                    SELECT rowid FROM study_items_fts WHERE study_items_fts MATCH ?
                )
            )
            OR je.book_name LIKE ? ESCAPE '\\'
            ORDER BY je.created_at DESC 
            LIMIT 100
        `;

        const entries = await database.getAllAsync<JournalEntry>(query, [match, match, match, bookLike]);
        return await attachItems(database, entries);
    });
};

export const getEntryById = async (id: number): Promise<JournalEntry | null> => {
    return await withDatabase(async (database) => {
        const entry = await database.getFirstAsync<JournalEntry>(
            `SELECT *, datetime(created_at, 'localtime') as created_at, datetime(updated_at, 'localtime') as updated_at FROM journal_entries WHERE id = ?`, [id]
        ) ?? null;
        if (!entry) return null;

        const [withItems] = await attachItems(database, [entry]);
        return withItems;
    });
};

/** Foreign keys are off, so everything that hangs off an entry is deleted by hand. */
export const deleteJournalEntry = async (id: number) => {
    await withTransaction(async (database) => {
        const items = await database.getAllAsync<{ id: number }>(`SELECT id FROM action_items WHERE entry_id = ?`, [id]);
        const topics = await database.getAllAsync<{ id: number }>(`SELECT id FROM study_items WHERE entry_id = ?`, [id]);
        await retractCiting(database, { entryIds: [id] });
        await deleteActionItems(database, items.map(item => item.id));
        await deleteStudyItems(database, topics.map(topic => topic.id));
        await database.runAsync(`DELETE FROM theme_members WHERE entry_id = ?`, [id]);
        await database.runAsync(`DELETE FROM entry_embeddings WHERE entry_id = ?`, [id]);
        await database.runAsync(`DELETE FROM journal_entries WHERE id = ?`, [id]);
    });
    // Runs after the delete commits, never inside it: the coverage check
    // reads the very table being written.
    await retractUncoveredReadings();
};

export const getBookEntryCounts = async (): Promise<Record<string, number>> => {
    return await withDatabase(async (database) => {
        const rows = await database.getAllAsync<{ book_name: string; count: number }>(
            `SELECT book_name, COUNT(*) as count FROM journal_entries GROUP BY book_name`
        );
        const counts: Record<string, number> = {};
        rows.forEach(row => { counts[row.book_name] = row.count; });
        return counts;
    });
};

/**
 * Every chapter ever written about, with the last date it was.
 *
 * Grouped in SQL and expanded in JS: SQLite has no cheap way to turn "Genesis
 * 12-15" into four rows, but the grouping still gives one row per distinct
 * range rather than one per entry.
 *
 * `created_at`, not `updated_at` — editing a reflection's wording two years
 * later did not make you read the chapter again.
 */
export const getChapterCoverage = async (): Promise<CoverageRow[]> => {
    return await withDatabase(async (database) => {
        const rows = await database.getAllAsync<{
            book_name: string;
            chapter_start: number;
            chapter_end: number | null;
            last_read: string;
        }>(
            `SELECT book_name, chapter_start, chapter_end, MAX(created_at) AS last_read
             FROM journal_entries
             WHERE chapter_start IS NOT NULL
             GROUP BY book_name, chapter_start, chapter_end`
        );

        return rows.map(row => ({
            bookName: row.book_name,
            chapterStart: row.chapter_start,
            chapterEnd: row.chapter_end,
            lastRead: row.last_read,
        }));
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

            const firstEntryResult = await database.getFirstAsync(`SELECT MIN(DATE(created_at, 'localtime')) as first_date FROM journal_entries`) as any;
            const firstDate = firstEntryResult?.first_date;

            if (!firstDate) return 0;

            const effectiveStart = firstDate > monthStart ? firstDate : monthStart;

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

/** Entries per local day, between two local `YYYY-MM-DD` dates inclusive. */
export const getDailyEntryCounts = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
    return await withDatabase(async (database) => {
        const result = await database.getAllAsync<{ day: string; count: number }>(
            `SELECT DATE(created_at, 'localtime') as day, COUNT(*) as count 
             FROM journal_entries 
             WHERE DATE(created_at, 'localtime') BETWEEN ? AND ? 
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

export const getFirstEntryDate = async (): Promise<Date | null> => {
    return await withDatabase(async (database) => {
        const result = await database.getFirstAsync<{ created_at: string }>(`
            SELECT datetime(MIN(created_at), 'localtime') as created_at FROM journal_entries
        `);

        if (!result?.created_at) return null;
        return new Date(result.created_at.replace(' ', 'T'));
    });
};

/**
 * Whole days since the last entry, or null if there has never been one. Lets
 * Home keep the promise the notifications make: "if I don't see you, I'll
 * check up on you."
 */
export const getDaysSinceLastEntry = async (): Promise<number | null> => {
    return await withDatabase(async (database) => {
        const result = await database.getFirstAsync<{ day: string }>(`
            SELECT DATE(MAX(created_at), 'localtime') as day FROM journal_entries
        `);

        if (!result?.day) return null;

        // Compare local calendar days, not elapsed hours: an entry written last
        // night and one written this morning are "yesterday" and "today", not 0.4.
        const diff = parseLocalDateString(getTodayDateString()).getTime() - parseLocalDateString(result.day).getTime();
        return Math.max(0, Math.round(diff / 86400000));
    });
};

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
            const [withItems] = await attachItems(database, [yearEntry]);
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
            const [withItems] = await attachItems(database, [monthEntry]);
            return { entry: withItems, type: 'month' };
        }

        // 3. Random entry older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysStr = formatDateToLocalString(thirtyDaysAgo);

        let randomEntry: JournalEntry | null = null;

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
                const [withItems] = await attachItems(database, [randomEntry]);
                return { entry: withItems, type: 'random' };
            }
        }

        randomEntry = await database.getFirstAsync<JournalEntry>(`
            SELECT *, datetime(created_at, 'localtime') as created_at
            FROM journal_entries
            WHERE DATE(created_at, 'localtime') <= ?
            ORDER BY RANDOM() LIMIT 1
        `, [thirtyDaysStr]);

        if (randomEntry) {
            const [withItems] = await attachItems(database, [randomEntry]);
            return { entry: withItems, type: 'random' };
        }

        return null;
    });
};

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
              AND ai.archived_at IS NULL
              AND (ai.action != '' OR ai.motivation != '')
            ORDER BY ai.pinned_at DESC, ai.id DESC
            LIMIT 3
        `);
        return result ?? [];
    });
};

export const toggleActionItemPin = async (id: number, pinned: boolean): Promise<void> => {
    await withDatabase(async (database) => {
        if (pinned) {
            // Oldest pin first; a pin with no time counts as oldest.
            const pinnedRows = await database.getAllAsync<{ id: number }>(`
                SELECT id FROM action_items
                WHERE is_pinned = 1 AND archived_at IS NULL AND id != ?
                ORDER BY pinned_at IS NOT NULL, pinned_at ASC, id ASC
            `, [id]);
            if (pinnedRows.length >= 3) {
                const itemsToUnpin = pinnedRows.slice(0, pinnedRows.length - 2);
                for (const row of itemsToUnpin) {
                    await database.runAsync(`UPDATE action_items SET is_pinned = 0, pinned_at = NULL WHERE id = ?`, [row.id]);
                }
            }
        }
        await database.runAsync(
            `UPDATE action_items SET is_pinned = ?, pinned_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?`,
            [pinned ? 1 : 0, pinned ? 1 : 0, id]
        );
    });
};

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

/** Tick an action off, or put it back. Both styles in
 * design/all-screens.html draw the checkbox (#actions). */
export const toggleActionItemCompletion = async (id: number, completed: boolean): Promise<void> => {
    await withDatabase(async (database) => {
        await database.runAsync(
            `UPDATE action_items SET is_completed = ? WHERE id = ?`,
            [completed ? 1 : 0, id]
        );
    });
}

/**
 * Edit an action item in place — a commitment reveals itself as a daily
 * practice months after it was written, not while it is being written.
 *
 * Nulls MEAN null here, not "leave alone": clearing a cadence is how a practice
 * becomes an application again, so the caller sends the whole shape it wants.
 */
export const updateActionItem = async (
    id: number,
    fields: { action: string; motivation: string; cadence?: string | null; due_at?: string | null },
): Promise<void> => {
    await withDatabase(async (database) => {
        await database.runAsync(
            `UPDATE action_items
                SET action = ?, motivation = ?, cadence = ?, due_at = ?
              WHERE id = ?`,
            [
                fields.action.trim(),
                fields.motivation.trim(),
                fields.cadence ?? null,
                fields.due_at ?? null,
                id,
            ],
        );
    });
};

/**
 * Archive a commitment, or bring it back. There is deliberately no delete:
 * removing an action item edits the entry it belongs to, and the journal would
 * stop saying what it said. Practice completions survive archiving.
 */
export const setActionItemArchived = async (id: number, archived: boolean): Promise<void> => {
    await withDatabase(async (database) => {
        await database.runAsync(
            `UPDATE action_items SET archived_at = ${archived ? 'CURRENT_TIMESTAMP' : 'NULL'} WHERE id = ?`,
            [id],
        );
        // Finished with, so no longer something to hand back.
        if (archived) await retractKeys(database, 'commitment', [`action:${id}`]);
    });
};
