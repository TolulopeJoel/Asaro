import * as SQLite from 'expo-sqlite';

/**
 * The open connection, cached as a PROMISE rather than as a handle.
 *
 * The obvious version of this — `if (!db) db = await open()` — is not safe
 * when two callers arrive together, and at startup they always do. Both see
 * `db` still null, because neither has passed its `await` yet, so both call
 * `openDatabaseAsync` and the second assignment quietly replaces the first.
 * The app is then holding two connections to one file: writes collide, reads
 * hit a handle nobody owns any more, and `initializeDatabase` returns false
 * with no explanation. Intermittently, depending entirely on timing — which
 * is exactly how it presented.
 *
 * Caching the promise means the second caller awaits the FIRST open instead
 * of starting another. The window closes because there is nothing to race.
 */
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
    if (!opening) {
        opening = SQLite.openDatabaseAsync('bibleJournal.db').catch(error => {
            /*
             * A failed open must not be cached, or every later call awaits
             * the same rejection and the app can never recover — including
             * the reconnect path below, which exists precisely to recover.
             */
            opening = null;
            throw error;
        });
    }
    return opening;
};

/**
 * Helper to retry database operations if the connection is lost/closed
 */
export const withDatabase = async <T>(operation: (database: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
    try {
        const database = await getDb();
        return await operation(database);
    } catch (error: any) {
        if (error?.message?.includes('shared object that was already released') ||
            error?.message?.includes('Cannot use shared object')) {
            console.warn('Database connection lost, reconnecting...');
            opening = null;
            const database = await getDb();
            return await operation(database);
        }
        throw error;
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
