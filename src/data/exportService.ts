import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../storage/storageKeys';
import { withDatabase, withTransaction } from './db';
import { attachItems } from './journalRepository';
import { JournalEntry } from './types';
import { getPlanStart, setPlanStart } from '../storage/planStart';
import { topicsFromLegacy } from './studyTopics';

/**
 * v5 nests each action item's completions under it and adds named themes, whose
 * members point at entries by their id in this backup. v6 adds the findings the
 * reader has seen or answered, and which tree each practice grows, by the same ids.
 * v7 nests study topics under their entry as `study_items`, replacing the flat
 * `study_further` fields, which older backups still carry.
 */
const BACKUP_VERSION = 7;

interface Completion { completed_on: string; completed_at?: string | null }
interface BackupTheme {
    name: string;
    created_at?: string;
    updated_at?: string;
    members: { entry_id: number; field: string }[];
}
interface BackupEvidence {
    kind: string;
    entry_id: number | null;
    field: string | null;
    verse_id: number | null;
    action_item_id: number | null;
    sort_order: number;
}
interface BackupObservation {
    id?: number;
    detector: string;
    dedupe_key: string;
    payload: string;
    confidence: number;
    created_at: string | null;
    shown_at: string | null;
    shown_count: number;
    opened_at: string | null;
    followed_at: string | null;
    dismissed_at: string | null;
    feedback: number | null;
    retracted_at: string | null;
    evidence: BackupEvidence[];
}
interface BackupGrove {
    /** Species by action item id. */
    species: Record<string, number>;
    /** Anniversaries already marked, as `actionItemId:mark`. */
    moments: string[];
}

async function readStored<T>(key: string, fallback: T): Promise<T> {
    try {
        return JSON.parse((await AsyncStorage.getItem(key)) ?? 'null') ?? fallback;
    } catch {
        return fallback;
    }
}

/**
 * Export all journal entries as a JSON string
 */
export const exportJournalEntriesToJson = async (): Promise<string> => {
    return await withDatabase(async (database) => {
        const entries = await database.getAllAsync<JournalEntry>(`
            SELECT
                id,
                book_name,
                chapter_start,
                chapter_end,
                verse_start,
                verse_end,
                reflection_1,
                reflection_2,
                reflection_3,
                reflection_4,
                notes,
                created_at,
                updated_at
            FROM journal_entries
            ORDER BY created_at ASC
        `);

        const entriesWithItems = await attachItems(database, entries);

        const completions = await database.getAllAsync<Completion & { action_item_id: number }>(
            `SELECT action_item_id, completed_on, completed_at FROM action_item_completions ORDER BY completed_on ASC`
        );
        const completionsByItem = new Map<number, Completion[]>();
        for (const { action_item_id, ...completion } of completions) {
            const list = completionsByItem.get(action_item_id) ?? [];
            list.push(completion);
            completionsByItem.set(action_item_id, list);
        }

        const readingProgress = await database.getAllAsync<{ item_id: number; completed_at: string }>(
            `SELECT item_id, completed_at FROM reading_progress`
        );

        const themes = await database.getAllAsync<{ id: number; name: string; created_at: string; updated_at: string }>(
            `SELECT id, name, created_at, updated_at FROM themes`
        );
        const members = await database.getAllAsync<{ theme_id: number; entry_id: number; field: string }>(
            `SELECT theme_id, entry_id, field FROM theme_members`
        );

        // Only findings with a history: the rest are found again from the entries.
        const observations = await database.getAllAsync<Omit<BackupObservation, 'evidence'>>(
            `SELECT id, detector, dedupe_key, payload, confidence, created_at, shown_at, shown_count,
                    opened_at, followed_at, dismissed_at, feedback, retracted_at
             FROM observations
             WHERE shown_at IS NOT NULL OR opened_at IS NOT NULL OR followed_at IS NOT NULL
                OR dismissed_at IS NOT NULL OR feedback IS NOT NULL`
        );
        const evidence = await database.getAllAsync<BackupEvidence & { observation_id: number }>(
            `SELECT observation_id, kind, entry_id, field, verse_id, action_item_id, sort_order
             FROM observation_evidence ORDER BY observation_id, sort_order`
        );
        const evidenceByObservation = new Map<number, BackupEvidence[]>();
        for (const { observation_id, ...item } of evidence) {
            const list = evidenceByObservation.get(observation_id) ?? [];
            list.push(item);
            evidenceByObservation.set(observation_id, list);
        }

        const grove: BackupGrove = {
            species: await readStored(STORAGE_KEYS.GROVE_SPECIES, {}),
            moments: await readStored(STORAGE_KEYS.GROVE_MOMENTS, []),
        };

        const payload = {
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            entries: entriesWithItems.map(entry => ({
                ...entry,
                action_items: (entry.action_items ?? []).map(item => ({
                    ...item,
                    completions: completionsByItem.get(item.id!) ?? [],
                })),
            })),
            readingProgress: readingProgress.map(rp => ({
                item_id: rp.item_id,
                completed_at: rp.completed_at
            })),
            themes: themes.map((theme): BackupTheme => ({
                name: theme.name,
                created_at: theme.created_at,
                updated_at: theme.updated_at,
                members: members
                    .filter(member => member.theme_id === theme.id)
                    .map(member => ({ entry_id: member.entry_id, field: member.field })),
            })),
            observations: observations.map(({ id, ...observation }): BackupObservation => ({
                ...observation,
                evidence: evidenceByObservation.get(id!) ?? [],
            })),
            grove,
            planStart: await getPlanStart(),
        };

        return JSON.stringify(payload, null, 2);
    });
};

/**
 * Import journal entries from a JSON string previously created by exportJournalEntriesToJson.
 * Backups from every earlier version still import; what they lack is left empty.
 */
export const importJournalEntriesFromJson = async (json: string): Promise<{
    importedEntries: number;
    skippedEntries: number;
    importedReadingItems: number;
    skippedReadingItems: number;
}> => {
    let parsed: any;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error('Invalid JSON file');
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
        throw new Error('Invalid backup format');
    }

    const entries = parsed.entries as (Partial<JournalEntry> & {
        action_items?: any[];
        study_items?: { id?: number; topic?: string; reminder?: string | null; completed?: boolean | number; sort_order?: number }[];
        // Backups before v7.
        study_further?: string | null;
        study_further_reminder?: string | null;
        study_completed?: boolean | number;
    })[];

    const { counts, actionIds } = await withTransaction(async (database) => {
        let importedEntries = 0;
        let skippedEntries = 0;
        let importedReadingItems = 0;
        let skippedReadingItems = 0;

        // Backup entry id → id on this device, for themes and findings.
        const entryIds = new Map<number, number>();
        // Backup action item id → id on this device, for findings and trees.
        const actionIds = new Map<number, number>();
        // Backup study topic id → id on this device, for findings.
        const topicIds = new Map<number, number>();

        const importCompletions = async (actionItemId: number, completions: unknown) => {
            if (!Array.isArray(completions)) return;
            for (const completion of completions as Completion[]) {
                if (!completion?.completed_on) continue;
                await database.runAsync(
                    `INSERT OR IGNORE INTO action_item_completions (action_item_id, completed_on, completed_at)
                     VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
                    [actionItemId, completion.completed_on, completion.completed_at ?? null]
                );
            }
        };

        // 1. Process Journal Entries
        for (const entry of entries) {
            if (!entry.book_name || !entry.created_at) {
                skippedEntries++;
                continue;
            }

            // The same entry, not merely the same passage on the same day.
            const existing = await database.getFirstAsync<{ id: number }>(
                `SELECT id FROM journal_entries WHERE book_name = ? AND chapter_start IS ? AND created_at = ?`,
                [entry.book_name, entry.chapter_start ?? null, entry.created_at]
            );

            if (existing) {
                if (entry.id != null) entryIds.set(entry.id, existing.id);
                for (const topic of entry.study_items ?? []) {
                    const match = await database.getFirstAsync<{ id: number }>(
                        `SELECT id FROM study_items WHERE entry_id = ? AND topic = ?`,
                        [existing.id, topic.topic ?? '']
                    );
                    if (match && topic.id != null) topicIds.set(topic.id, match.id);
                }
                // Completions logged since that backup still merge into the item they belong to.
                for (const item of entry.action_items ?? []) {
                    const match = await database.getFirstAsync<{ id: number }>(
                        `SELECT id FROM action_items WHERE entry_id = ? AND action = ? AND sort_order = ?`,
                        [existing.id, item.action ?? '', item.sort_order ?? 0]
                    );
                    if (!match) continue;
                    if (item.id != null) actionIds.set(item.id, match.id);
                    await importCompletions(match.id, item.completions);
                }
                skippedEntries++;
                continue;
            }

            const createdAt = entry.created_at;
            const updatedAt = entry.updated_at ?? createdAt;

            const result = await database.runAsync(
                `INSERT INTO journal_entries (
                    book_name, chapter_start, chapter_end, verse_start, verse_end,
                    reflection_1, reflection_2, reflection_3, reflection_4, notes,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    entry.book_name,
                    entry.chapter_start ?? null,
                    entry.chapter_end ?? null,
                    entry.verse_start ?? null,
                    entry.verse_end ?? null,
                    entry.reflection_1 ?? '',
                    entry.reflection_2 ?? '',
                    entry.reflection_3 ?? '',
                    entry.reflection_4 ?? '',
                    entry.notes ?? null,
                    createdAt,
                    updatedAt,
                ]
            );

            const newEntryId = result.lastInsertRowId;
            if (entry.id != null) entryIds.set(entry.id, newEntryId);

            const topics = Array.isArray(entry.study_items)
                ? entry.study_items
                : topicsFromLegacy(entry.study_further, entry.study_further_reminder, !!entry.study_completed);
            for (let i = 0; i < topics.length; i++) {
                const topic = topics[i] as { id?: number; topic?: string; reminder?: string | null; completed?: boolean | number; sort_order?: number };
                if (!topic.topic?.trim()) continue;
                const inserted = await database.runAsync(
                    `INSERT INTO study_items (entry_id, topic, reminder, completed, sort_order) VALUES (?, ?, ?, ?, ?)`,
                    [newEntryId, topic.topic, topic.reminder ?? null, topic.completed ? 1 : 0, topic.sort_order ?? i]
                );
                if (topic.id != null) topicIds.set(topic.id, inserted.lastInsertRowId);
            }

            const items = entry.action_items ?? [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                // cadence/due_at are absent from pre-v11 backups, whose items were all applications.
                const inserted = await database.runAsync(
                    `INSERT INTO action_items (entry_id, action, motivation, sort_order, is_completed, is_pinned, pinned_at, cadence, due_at, archived_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newEntryId, item.action ?? '', item.motivation ?? '', item.sort_order ?? i, item.is_completed ? 1 : 0, item.is_pinned ? 1 : 0, item.is_pinned ? item.pinned_at ?? null : null, item.cadence ?? null, item.due_at ?? null, item.archived_at ?? null]
                );
                if (item.id != null) actionIds.set(item.id, inserted.lastInsertRowId);
                await importCompletions(inserted.lastInsertRowId, item.completions);
            }

            importedEntries++;
        }

        // 2. Process Reading Progress (if version >= 3)
        if (parsed.version >= 3 && Array.isArray(parsed.readingProgress)) {
            for (const item of parsed.readingProgress) {
                const itemId = typeof item === 'number' ? item : item.item_id;
                const completedAt = typeof item === 'object' ? item.completed_at : null;

                const existing = await database.getFirstAsync<{ item_id: number }>(
                    `SELECT item_id FROM reading_progress WHERE item_id = ?`,
                    [itemId]
                );

                if (existing) {
                    skippedReadingItems++;
                    continue;
                }

                if (completedAt) {
                    await database.runAsync(
                        `INSERT INTO reading_progress (item_id, completed_at) VALUES (?, ?)`,
                        [itemId, completedAt]
                    );
                } else {
                    await database.runAsync(
                        `INSERT INTO reading_progress (item_id) VALUES (?)`,
                        [itemId]
                    );
                }
                importedReadingItems++;
            }
        }

        // 3. Named themes (v5). A theme already here by name gains the members.
        if (Array.isArray(parsed.themes)) {
            for (const theme of parsed.themes as BackupTheme[]) {
                const name = typeof theme?.name === 'string' ? theme.name.trim() : '';
                const members = (Array.isArray(theme?.members) ? theme.members : [])
                    .filter(member => entryIds.has(member.entry_id) && member.field);
                if (!name || members.length === 0) continue;

                const existing = await database.getFirstAsync<{ id: number }>(
                    `SELECT id FROM themes WHERE name = ?`, [name]
                );
                const themeId = existing?.id ?? (await database.runAsync(
                    `INSERT INTO themes (name, created_at, updated_at)
                     VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))`,
                    [name, theme.created_at ?? null, theme.updated_at ?? null]
                )).lastInsertRowId;

                for (const member of members) {
                    await database.runAsync(
                        `INSERT OR IGNORE INTO theme_members (theme_id, entry_id, field) VALUES (?, ?, ?)`,
                        [themeId, entryIds.get(member.entry_id)!, member.field]
                    );
                }
            }
        }

        // 4. The reader's history with findings (v6). One whose entry or practice didn't come across is dropped.
        const localKey = (key: string): string | null => {
            const [kind, id] = key.split(':');
            const map = kind === 'entry' ? entryIds : kind === 'action' ? actionIds : kind === 'topic' ? topicIds : null;
            if (!map) return key;
            const local = map.get(Number(id));
            return local === undefined ? null : `${kind}:${local}`;
        };
        const localId = (map: Map<number, number>, id: number | null) => (id == null ? null : map.get(id));

        if (Array.isArray(parsed.observations)) {
            for (const observation of parsed.observations as BackupObservation[]) {
                if (typeof observation?.detector !== 'string' || typeof observation.dedupe_key !== 'string') continue;
                const key = localKey(observation.dedupe_key);
                if (!key) continue;

                const existing = await database.getFirstAsync<{ id: number }>(
                    `SELECT id FROM observations WHERE detector = ? AND dedupe_key = ?`,
                    [observation.detector, key]
                );
                const history = [
                    observation.shown_at ?? null, observation.shown_count ?? 0, observation.opened_at ?? null,
                    observation.followed_at ?? null, observation.dismissed_at ?? null, observation.feedback ?? null,
                ];
                // What this phone already knows stands; the backup fills in what it doesn't.
                if (existing) {
                    await database.runAsync(
                        `UPDATE observations SET
                            shown_at = COALESCE(shown_at, ?), shown_count = MAX(shown_count, ?),
                            opened_at = COALESCE(opened_at, ?), followed_at = COALESCE(followed_at, ?),
                            dismissed_at = COALESCE(dismissed_at, ?), feedback = COALESCE(feedback, ?)
                         WHERE id = ?`,
                        [...history, existing.id]
                    );
                    continue;
                }

                const evidence = (Array.isArray(observation.evidence) ? observation.evidence : []).map(item => ({
                    ...item,
                    entry_id: localId(entryIds, item.entry_id),
                    action_item_id: localId(actionIds, item.action_item_id),
                }));
                if (typeof observation.payload !== 'string' || evidence.length === 0
                    || evidence.some(item => item.entry_id === undefined || item.action_item_id === undefined)) continue;

                const inserted = await database.runAsync(
                    `INSERT INTO observations (
                        detector, dedupe_key, payload, confidence, created_at,
                        shown_at, shown_count, opened_at, followed_at, dismissed_at, feedback, retracted_at
                    ) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        observation.detector, key, observation.payload, observation.confidence ?? 0,
                        observation.created_at ?? null, ...history, observation.retracted_at ?? null,
                    ]
                );
                for (const item of evidence) {
                    await database.runAsync(
                        `INSERT INTO observation_evidence (observation_id, kind, entry_id, field, verse_id, action_item_id, sort_order)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            inserted.lastInsertRowId, item.kind, item.entry_id ?? null, item.field ?? null,
                            item.verse_id ?? null, item.action_item_id ?? null, item.sort_order ?? 0,
                        ]
                    );
                }
            }
        }

        return {
            counts: { importedEntries, skippedEntries, importedReadingItems, skippedReadingItems },
            actionIds,
        };
    });

    await importGrove(parsed.grove, actionIds);
    await importPlanStart(parsed.planStart);
    return counts;
};

/** Where they said they are in the plan, unless this phone already has an answer of its own. */
async function importPlanStart(saved: unknown): Promise<void> {
    const start = saved as { id?: unknown; setAt?: unknown } | null | undefined;
    if (typeof start?.id !== 'number' || typeof start.setAt !== 'string') return;
    try {
        if (!(await getPlanStart())) await setPlanStart(start.id, start.setAt);
    } catch (error) {
        console.error('Failed to restore the plan start:', error);
    }
}

/** Each practice keeps its tree and its marked anniversaries; a tree this phone already gave stands. */
async function importGrove(grove: Partial<BackupGrove> | undefined, actionIds: Map<number, number>): Promise<void> {
    if (!grove || typeof grove !== 'object') return;
    try {
        if (grove.species && typeof grove.species === 'object') {
            const restored: Record<string, number> = {};
            for (const [id, species] of Object.entries(grove.species)) {
                const local = actionIds.get(Number(id));
                if (local !== undefined && typeof species === 'number') restored[local] = species;
            }
            const mine = await readStored<Record<string, number>>(STORAGE_KEYS.GROVE_SPECIES, {});
            await AsyncStorage.setItem(STORAGE_KEYS.GROVE_SPECIES, JSON.stringify({ ...restored, ...mine }));
        }
        if (Array.isArray(grove.moments)) {
            const marked = new Set(await readStored<string[]>(STORAGE_KEYS.GROVE_MOMENTS, []));
            for (const key of grove.moments) {
                if (typeof key !== 'string') continue;
                const [id, mark] = key.split(':');
                const local = actionIds.get(Number(id));
                if (local !== undefined && mark) marked.add(`${local}:${mark}`);
            }
            await AsyncStorage.setItem(STORAGE_KEYS.GROVE_MOMENTS, JSON.stringify([...marked]));
        }
    } catch (error) {
        console.error('Failed to restore trees:', error);
    }
}
