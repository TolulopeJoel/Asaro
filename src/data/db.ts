import * as SQLite from 'expo-sqlite';

const DB_NAME = 'bibleJournal.db';

/*
 * Cached as a promise so callers arriving together share one open. Kept on
 * globalThis so a Fast Refresh that re-runs this module reuses the same handle:
 * expo-sqlite hands a second open the same native connection, and when the
 * orphaned JS wrapper is collected it closes that connection under the live
 * one — prepareAsync then fails with a NullPointerException.
 */
const cache = globalThis as { __journalDb?: Promise<SQLite.SQLiteDatabase> | null };

function open(fresh: boolean) {
    const opening = SQLite.openDatabaseAsync(DB_NAME, fresh ? { useNewConnection: true } : undefined)
        .catch(error => {
            // Never cache a failed open, or nothing can recover.
            cache.__journalDb = null;
            throw error;
        });
    cache.__journalDb = opening;
    return opening;
}

export const getDb = (): Promise<SQLite.SQLiteDatabase> => cache.__journalDb ?? open(false);

/** A handle whose native side is gone. */
function isLostConnection(error: any) {
    const message = String(error?.message ?? '');
    return message.includes('shared object that was already released')
        || message.includes('Cannot use shared object')
        || (message.includes('NativeDatabase') && message.includes('NullPointerException'));
}

/**
 * Runs `operation`, reopening once if the connection was lost. The reopen
 * bypasses expo-sqlite's cache, which would hand back the dead connection.
 */
export const withDatabase = async <T>(operation: (database: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
    const opening = getDb();
    try {
        return await operation(await opening);
    } catch (error: any) {
        if (!isLostConnection(error)) throw error;
        // Only the first caller to notice reopens; the rest reuse its handle.
        if (cache.__journalDb === opening) {
            console.warn('Database connection lost, reconnecting...');
            open(true).catch(() => { }); // surfaced by the await below
        }
        return await operation(await getDb());
    }
};

export const getDbVersion = async (database: SQLite.SQLiteDatabase): Promise<number> => {
    try {
        const result = await database.getFirstAsync(`PRAGMA user_version`) as any;
        return result?.user_version || 0;
    } catch {
        return 0;
    }
};

export const setDbVersion = async (database: SQLite.SQLiteDatabase, version: number) => {
    await database.execAsync(`PRAGMA user_version = ${version}`);
};
