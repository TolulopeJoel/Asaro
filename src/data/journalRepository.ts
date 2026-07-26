import * as SQLite from 'expo-sqlite';
import { withDatabase } from './db';
import { ActionItem, JournalEntry, JournalEntryInput, EnhancedActionItem } from './types';
import { formatDateToLocalString, getTodayDateString } from '../utils/dateUtils';
import { READING_PLAN_DATA } from './readingPlanData';

/**
 * Given a book name and chapter start/end, find ALL reading plan items
 * that are now fully covered by the combination of ALL entries in the database.
 */
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
        const bookMatches = item.book.toLowerCase() === bookName.toLowerCase() ||
            item.book.toLowerCase().split('/').includes(bookName.toLowerCase());

        if (!bookMatches) continue;

        // Parse the plan item's chapter range (ignore verse suffixes like "119:64-176")
        const rawChapters = item.chapters;
        if (!rawChapters) continue;

        // Strip verse notation
        const parts = rawChapters.split('-');
        const firstHasVerse = parts[0].includes(':');
        const planStart = parseInt(parts[0].split(':')[0], 10);

        let planEnd: number;
        if (parts.length > 1) {
            if (firstHasVerse) {
                planEnd = planStart;
            } else {
                planEnd = parseInt(parts[parts.length - 1].split(':')[0], 10);
            }
        } else {
            planEnd = planStart;
        }

        if (isNaN(planStart) || isNaN(planEnd)) continue;

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
                        `INSERT INTO action_items (entry_id, action, motivation, sort_order) VALUES (?, ?, ?, ?)`,
                        [entryId, item.action, item.motivation, i]
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
                        `INSERT INTO action_items (entry_id, action, motivation, sort_order) VALUES (?, ?, ?, ?)`,
                        [id, item.action, item.motivation, i]
                    );
                }
            }
        }
    });
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
