import { withDatabase } from './db';
import { Embedded } from '../ml/clustering';
import { bytesToVector, embed, vectorToBytes } from '../ml/embedder';

/** Bumping this invalidates every stored vector. Change it if the model changes. */
export const EMBEDDING_MODEL = 'all-MiniLM-L6-v2-q';

/**
 * Fields worth embedding, with the label the UI shows.
 *
 * `study_further` is deliberately absent: it is answered in a small minority
 * of entries, so it has never had enough material to cluster.
 */
export const EMBEDDABLE_FIELDS: { column: string; label: string }[] = [
    { column: 'reflection_1', label: 'on Jehovah' },
    { column: 'reflection_2', label: "on the Bible's message" },
    { column: 'reflection_3', label: 'to apply' },
    { column: 'reflection_4', label: 'to help others' },
    { column: 'notes', label: 'note' },
];

/** The `field` value used for action items, which live in their own table. */
export const ACTION_FIELD = 'action';

/**
 * Answers shorter than this are skipped.
 *
 * "HE IS SIMPLY THE BEST" is heartfelt and carries nothing for a model to
 * cluster on; including such lines mostly produces noisy themes.
 */
const MIN_CHARS = 60;

interface PendingText {
    entryId: number;
    field: string;
    text: string;
}

/** Cheap non-cryptographic hash, used only to notice edited text. */
function hashText(text: string): string {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return `${h >>> 0}:${text.length}`;
}

/** Every embeddable piece of text currently in the journal. */
async function collectTexts(): Promise<PendingText[]> {
    return withDatabase(async database => {
        const columns = EMBEDDABLE_FIELDS.map(f => f.column).join(', ');
        const entries = await database.getAllAsync<Record<string, any>>(
            `SELECT id, ${columns} FROM journal_entries`,
        );

        const out: PendingText[] = [];
        for (const entry of entries) {
            for (const { column } of EMBEDDABLE_FIELDS) {
                const text = (entry[column] ?? '').trim();
                if (text.length >= MIN_CHARS) {
                    out.push({ entryId: entry.id, field: column, text });
                }
            }
        }

        // Action items: the motivation is the most revealing text in the
        // schema — it is the only place someone writes why a thing matters to
        // them, unmediated by a passage — so it is joined to the action rather
        // than dropped.
        const actions = await database.getAllAsync<{
            entry_id: number;
            action: string;
            motivation: string;
        }>(`SELECT entry_id, action, motivation FROM action_items WHERE entry_id IS NOT NULL`);

        const byEntry = new Map<number, string[]>();
        for (const row of actions) {
            const text = [row.action, row.motivation].filter(Boolean).join(' ').trim();
            if (!text) continue;
            const bucket = byEntry.get(row.entry_id);
            if (bucket) bucket.push(text);
            else byEntry.set(row.entry_id, [text]);
        }
        for (const [entryId, parts] of byEntry) {
            const text = parts.join(' ');
            if (text.length >= MIN_CHARS) {
                out.push({ entryId, field: ACTION_FIELD, text });
            }
        }

        return out;
    });
}

export interface BackfillProgress {
    done: number;
    total: number;
}

/**
 * Embed anything new or edited. Safe to call on every app open.
 *
 * Work is proportional to what changed, not to the size of the journal: a
 * stored `text_hash` means an untouched entry is never re-embedded, and an
 * edited one is caught automatically.
 */
export async function backfillEmbeddings(
    onProgress?: (progress: BackfillProgress) => void,
): Promise<number> {
    const texts = await collectTexts();

    const existing = await withDatabase(async database =>
        database.getAllAsync<{ entry_id: number; field: string; text_hash: string }>(
            `SELECT entry_id, field, text_hash FROM entry_embeddings WHERE model = ?`,
            [EMBEDDING_MODEL],
        ),
    );

    const seen = new Map(existing.map(row => [`${row.entry_id}:${row.field}`, row.text_hash]));
    const stale = texts.filter(t => seen.get(`${t.entryId}:${t.field}`) !== hashText(t.text));

    if (stale.length === 0) return 0;

    const CHUNK = 16;
    for (let i = 0; i < stale.length; i += CHUNK) {
        const chunk = stale.slice(i, i + CHUNK);
        const vectors = await embed(chunk.map(c => c.text));

        await withDatabase(async database => {
            for (let j = 0; j < chunk.length; j++) {
                await database.runAsync(
                    `INSERT OR REPLACE INTO entry_embeddings
                        (entry_id, field, model, vector, text_hash)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        chunk[j].entryId,
                        chunk[j].field,
                        EMBEDDING_MODEL,
                        vectorToBytes(vectors[j]) as any,
                        hashText(chunk[j].text),
                    ],
                );
            }
        });

        onProgress?.({ done: Math.min(i + CHUNK, stale.length), total: stale.length });
    }

    return stale.length;
}

/** Drop vectors whose entry is gone, and any left by a previous model. */
export async function pruneEmbeddings(): Promise<void> {
    await withDatabase(async database => {
        await database.runAsync(`DELETE FROM entry_embeddings WHERE model != ?`, [EMBEDDING_MODEL]);
        await database.runAsync(
            `DELETE FROM entry_embeddings
             WHERE entry_id NOT IN (SELECT id FROM journal_entries)`,
        );
    });
}

export interface StoredEmbedding extends Embedded {
    bookName: string;
    chapterStart: number;
    chapterEnd?: number;
    createdAt: string;
}

/** Everything needed to cluster and then render themes, in one query. */
export async function loadEmbeddings(): Promise<StoredEmbedding[]> {
    return withDatabase(async database => {
        const rows = await database.getAllAsync<{
            entry_id: number;
            field: string;
            vector: Uint8Array;
            book_name: string;
            chapter_start: number;
            chapter_end: number | null;
            created_at: string;
            reflection_1: string | null;
            reflection_2: string | null;
            reflection_3: string | null;
            reflection_4: string | null;
            notes: string | null;
        }>(
            `SELECT e.entry_id, e.field, e.vector,
                    j.book_name, j.chapter_start, j.chapter_end,
                    datetime(j.created_at, 'localtime') AS created_at,
                    j.reflection_1, j.reflection_2, j.reflection_3, j.reflection_4, j.notes
             FROM entry_embeddings e
             JOIN journal_entries j ON j.id = e.entry_id
             WHERE e.model = ?`,
            [EMBEDDING_MODEL],
        );

        const actionTexts = new Map<number, string>();
        if (rows.some(r => r.field === ACTION_FIELD)) {
            const actions = await database.getAllAsync<{
                entry_id: number;
                action: string;
                motivation: string;
            }>(`SELECT entry_id, action, motivation FROM action_items WHERE entry_id IS NOT NULL`);
            for (const row of actions) {
                const text = [row.action, row.motivation].filter(Boolean).join(' ').trim();
                const prior = actionTexts.get(row.entry_id);
                actionTexts.set(row.entry_id, prior ? `${prior} ${text}` : text);
            }
        }

        return rows.map(row => ({
            entryId: row.entry_id,
            field: row.field,
            text:
                row.field === ACTION_FIELD
                    ? actionTexts.get(row.entry_id) ?? ''
                    : ((row as any)[row.field] ?? ''),
            vector: bytesToVector(row.vector),
            bookName: row.book_name,
            chapterStart: row.chapter_start,
            chapterEnd: row.chapter_end ?? undefined,
            createdAt: row.created_at,
        }));
    });
}

// ─── named themes ─────────────────────────────────────────────────────────────

export interface NamedTheme {
    id: number;
    name: string;
    members: { entryId: number; field: string }[];
}

export async function getNamedThemes(): Promise<NamedTheme[]> {
    return withDatabase(async database => {
        const themes = await database.getAllAsync<{ id: number; name: string }>(
            `SELECT id, name FROM themes ORDER BY updated_at DESC`,
        );
        const members = await database.getAllAsync<{
            theme_id: number;
            entry_id: number;
            field: string;
        }>(`SELECT theme_id, entry_id, field FROM theme_members`);

        return themes.map(theme => ({
            id: theme.id,
            name: theme.name,
            members: members
                .filter(m => m.theme_id === theme.id)
                .map(m => ({ entryId: m.entry_id, field: m.field })),
        }));
    });
}

/**
 * Save the name a person gave a cluster, pinned to the members that formed it.
 *
 * Anchoring to members is what keeps a named theme stable: clusters are
 * recomputed as the journal grows, and without this a name would drift onto a
 * different group of entries — which would feel, correctly, like the app
 * making things up.
 */
export async function nameTheme(
    name: string,
    members: { entryId: number; field: string }[],
): Promise<number> {
    return withDatabase(async database => {
        const result = await database.runAsync(`INSERT INTO themes (name) VALUES (?)`, [name.trim()]);
        const themeId = result.lastInsertRowId;
        for (const member of members) {
            await database.runAsync(
                `INSERT OR IGNORE INTO theme_members (theme_id, entry_id, field) VALUES (?, ?, ?)`,
                [themeId, member.entryId, member.field],
            );
        }
        return themeId;
    });
}

/**
 * Find the saved name for a freshly computed cluster, if it has one.
 *
 * Clusters are recomputed whenever the journal grows, so a name cannot be tied
 * to a cluster index — it is tied to the members that formed it. A saved theme
 * claims a cluster when most of its members are still in it, which tolerates a
 * theme absorbing a few new entries without letting a name drift onto what is
 * really a different group.
 *
 * Exported for scripts/verify-theme-matching.mjs.
 */
export function matchThemeName(
    clusterMembers: { entryId: number; field: string }[],
    named: NamedTheme[],
    minOverlap = 0.6,
): NamedTheme | undefined {
    const key = (m: { entryId: number; field: string }) => `${m.entryId}:${m.field}`;
    const present = new Set(clusterMembers.map(key));

    let best: NamedTheme | undefined;
    let bestScore = 0;

    for (const theme of named) {
        if (theme.members.length === 0) continue;
        const kept = theme.members.filter(m => present.has(key(m))).length;
        const score = kept / theme.members.length;
        if (score >= minOverlap && score > bestScore) {
            best = theme;
            bestScore = score;
        }
    }

    return best;
}

export async function renameTheme(id: number, name: string): Promise<void> {
    await withDatabase(async database => {
        await database.runAsync(
            `UPDATE themes SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [name.trim(), id],
        );
    });
}

export async function deleteTheme(id: number): Promise<void> {
    await withDatabase(async database => {
        await database.runAsync(`DELETE FROM themes WHERE id = ?`, [id]);
    });
}
