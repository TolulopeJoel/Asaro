import * as SQLite from 'expo-sqlite';
import { withDatabase } from './db';
import { ActionItem, JournalEntry, JournalEntryInput, EnhancedActionItem } from './types';
import { formatDateToLocalString, getTodayDateString } from '../utils/dateUtils';
import { READING_PLAN_DATA } from './readingPlanData';
import { CoverageRow } from '../land/cloth';

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

/**
 * Helper: fetch action items for a list of entries and attach them
 */
export const attachActionItems = async (
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
            const books = item.book.split('/');
            let covered = false;
            for (const book of books) {
                if (await checkRangeCovered(database, book.trim(), range.start, range.end)) {
                    covered = true;
                    break;
                }
            }

            if (!covered) dropped.push(item_id);
        }

        for (const id of dropped) {
            await database.runAsync(`DELETE FROM reading_progress WHERE item_id = ?`, [id]);
        }
        return dropped;
    });
};

export const createJournalEntry = async (data: JournalEntryInput) => {
    const reflections = [...data.reflections, '', '', '', ''].slice(0, 4);

    return await withDatabase(async (database) => {
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
                        `INSERT INTO action_items (entry_id, action, motivation, sort_order, cadence, due_at, archived_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [entryId, item.action, item.motivation, i, item.cadence ?? null, item.due_at ?? null, item.archived_at ?? null]
                    );
                }
            }
        }

        // Mark reading plan items as completed.
        let planItemIds: number[] = [];
        if (data.readingItemId) {
            const planItem = READING_PLAN_DATA.find(i => i.id === data.readingItemId);
            if (planItem) {
                const bookMatches = planItem.book.toLowerCase() === data.bookName.toLowerCase() ||
                    planItem.book.toLowerCase().split('/').includes(data.bookName.toLowerCase());

                if (bookMatches) {
                    if (!planItem.chapters) {
                        planItemIds = [data.readingItemId];
                    } else {
                        const parts = planItem.chapters.split('-');
                        const planStart = parseInt(parts[0].split(':')[0], 10);
                        let planEnd = planStart;
                        if (parts.length > 1) {
                            planEnd = parseInt(parts[parts.length - 1].split(':')[0], 10);
                        }

                        const entryEnd = data.chapterEnd ?? data.chapterStart;
                        const overlaps = data.chapterStart !== undefined &&
                            data.chapterStart <= planEnd && entryEnd! >= planStart;

                        if (overlaps) {
                            planItemIds = [data.readingItemId];
                        }
                    }
                }
            }
        }

        if (planItemIds.length === 0) {
            planItemIds = await findMatchingReadingPlanItems(database, data.bookName, data.chapterStart, data.chapterEnd);
        }

        for (const planItemId of planItemIds) {
            await database.runAsync(
                `INSERT OR IGNORE INTO reading_progress (item_id) VALUES (?)`,
                [planItemId]
            );
        }

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
                        `INSERT INTO action_items (entry_id, action, motivation, sort_order, cadence, due_at, archived_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [id, item.action, item.motivation, i, item.cadence ?? null, item.due_at ?? null, item.archived_at ?? null]
                    );
                }
            }
        }
    });

    // An edit can SHRINK a range (Genesis 12-15 corrected to 12-13) and the
    // save path only ever adds, so without this an edit ticks new items while
    // leaving the old ones standing.
    await retractUncoveredReadings();
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
            `SELECT *, datetime(created_at, 'localtime') as created_at, datetime(updated_at, 'localtime') as updated_at FROM journal_entries WHERE book_name = ? ORDER BY chapter_start ASC`, [bookName]
        );
        return await attachActionItems(database, entries);
    });
};

export const searchEntries = async (term: string): Promise<JournalEntry[]> => {
    if (!term.trim()) {
        return [];
    }

    const sanitizedTerm = term.replace(/"/g, '""');

    return await withDatabase(async (database) => {
        const query = `
            SELECT je.*, datetime(je.created_at, 'localtime') as created_at, datetime(je.updated_at, 'localtime') as updated_at FROM journal_entries je
            WHERE je.id IN (
                SELECT rowid FROM journal_entries_fts WHERE journal_entries_fts MATCH ?
                UNION
                SELECT entry_id FROM action_items WHERE id IN (
                    SELECT rowid FROM action_items_fts WHERE action_items_fts MATCH ?
                )
            )
            ORDER BY je.created_at DESC 
            LIMIT 100
        `;

        const entries = await database.getAllAsync<JournalEntry>(query, [sanitizedTerm, sanitizedTerm]);
        return await attachActionItems(database, entries);
    });
};

export const getEntryById = async (id: number): Promise<JournalEntry | null> => {
    return await withDatabase(async (database) => {
        const entry = await database.getFirstAsync<JournalEntry>(
            `SELECT *, datetime(created_at, 'localtime') as created_at, datetime(updated_at, 'localtime') as updated_at FROM journal_entries WHERE id = ?`, [id]
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
 * Whole days since the last entry, or null if there has never been one. Lets
 * Home keep the promise the notifications make: "if I don't see you, I'll
 * check up on you."
 */
export const getDaysSinceLastEntry = async (): Promise<number | null> => {
    return await withDatabase(async (database) => {
        const result = await database.getFirstAsync<{ created_at: string }>(`
            SELECT MAX(created_at) as created_at FROM journal_entries
        `);

        if (!result?.created_at) return null;

        // Compare calendar days, not elapsed hours: an entry written last night
        // and one written this morning are "yesterday" and "today", not 0.4.
        const last = new Date(result.created_at);
        const startOfDay = (d: Date) =>
            new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const diff = startOfDay(new Date()) - startOfDay(last);
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
                const [withItems] = await attachActionItems(database, [randomEntry]);
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
            const [withItems] = await attachActionItems(database, [randomEntry]);
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
            const pinnedRows = await database.getAllAsync<{ id: number }>(`
                SELECT id FROM action_items WHERE is_pinned = 1 ORDER BY id ASC
            `);
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
    });
};
