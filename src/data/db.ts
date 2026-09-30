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
        .then(async database => {
            // Writes go to a log rather than rewriting pages, and reads don't wait on them.
            // `synchronous` stays at its default FULL: a saved entry survives a power cut.
            await database.execAsync('PRAGMA journal_mode = WAL');
            return database;
        })
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
 * Settles when the transaction holding the shared connection ends; null when none is open.
 * Never rejects: waiting on it only means waiting for the connection to be free.
 */
let openTransaction: Promise<void> | null = null;

/**
 * Runs `operation`, reopening once if the connection was lost. The reopen
 * bypasses expo-sqlite's cache, which would hand back the dead connection.
 *
 * It waits out an open transaction first. The connection is shared, so a
 * statement run meanwhile would land inside somebody else's save, and be
 * rolled back with it. Never call it from inside a `withTransaction`
 * operation (use the `database` it hands you): it would wait for itself.
 */
export const withDatabase = async <T>(operation: (database: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
    while (openTransaction) await openTransaction;
    return onConnection(operation);
};

async function onConnection<T>(operation: (database: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
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
}

let transactions: Promise<unknown> = Promise.resolve();

/**
 * Runs `operation` between BEGIN and COMMIT on the shared connection, one
 * transaction at a time, so a lost-connection retry starts from a rolled-back
 * state. Never call it from inside another `withTransaction`: it would wait on itself.
 */
export const withTransaction = <T>(operation: (database: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
    const run = transactions.then(async () => {
        const body = onConnection(async database => {
            await database.execAsync('BEGIN');
            try {
                const result = await operation(database);
                await database.execAsync('COMMIT');
                return result;
            } catch (error) {
                // A lost connection has already dropped the transaction.
                await database.execAsync('ROLLBACK').catch(() => { });
                throw error;
            }
        });
        const held = body.then(() => { }, () => { });
        openTransaction = held;
        try {
            return await body;
        } finally {
            if (openTransaction === held) openTransaction = null;
        }
    });
    transactions = run.catch(() => { });
    return run;
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
