/**
 * Phase 0 on a real device, against a real journal.
 *
 * Everything in Phase 0 is verified in Node except the two things Node cannot
 * reach: whether the bundled graph asset actually resolves and decodes on
 * Android, and whether the v10 migration lands on a database that has been
 * accumulating since v1. Both only fail on a device, so this runs there.
 *
 * It also does something the scripts cannot: walks the graph from the entries
 * the reader has actually written. That is the first real signal about whether
 * the convergence detector is worth building — if a genuine journal produces
 * no shared ground, Phase 1's premise is wrong and better to know now.
 *
 * `__DEV__` only. Writes one observation and deletes it again, so it leaves
 * the journal exactly as it found it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { withDatabase } from '../data/db';
import { loadGraph, unloadGraph } from '../bible/graph';
import { formatVerseId } from '../bible/ref';
import { detectConvergence, findConvergence, loadSeedEntries } from './detectors/convergence';
import {
    getObservation,
    getPendingObservations,
    markShown,
    recordFeedback,
    recordObservation,
} from './observation';

export async function runPhase0SmokeTest(): Promise<string> {
    const out: string[] = [];
    const say = (line: string) => out.push(line);
    const ok = (label: string, detail = '') => say(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
    const bad = (label: string, detail = '') => say(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    const check = (passed: boolean, label: string, detail = '') => {
        if (passed) ok(label, detail);
        else bad(label, detail);
    };

    say('\n─── Phase 0 smoke test ─────────────────────────────────');

    // ── the migration ────────────────────────────────────────────────────────
    say('\nDatabase');
    let entryCount = 0;
    try {
        const version = await withDatabase(async db =>
            (await db.getFirstAsync<any>('PRAGMA user_version'))?.user_version,
        );
        check(version >= 10, 'schema is v10 or later', `v${version}`);

        const tables = await withDatabase(async db =>
            db.getAllAsync<{ name: string }>(
                `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('observations','observation_evidence')`,
            ),
        );
        check(tables.length === 2, 'observation tables exist', tables.map(t => t.name).join(',') || 'none');

        entryCount = await withDatabase(async db =>
            (await db.getFirstAsync<any>('SELECT COUNT(*) n FROM journal_entries'))?.n ?? 0,
        );
        ok('journal readable', `${entryCount} entries`);
    } catch (error: any) {
        bad('database check threw', error?.message);
    }

    // ── the asset ────────────────────────────────────────────────────────────
    say('\nCross-reference graph');
    let graph;
    try {
        const started = Date.now();
        graph = await loadGraph();
        const ms = Date.now() - started;

        ok('asset resolved and decoded', `${ms}ms`);
        check(
            graph.verseCount > 25_000,
            'verse table loaded',
            `${graph.verseCount.toLocaleString()} verses`,
        );
        ok('edges loaded', `${graph.edgeCount.toLocaleString()}`);

        // A verse whose connections are well known, as a sanity check that the
        // bytes survived the trip rather than merely being the right length.
        const john3_16 = graph.ordinalOf(43_003_016);
        check(
            john3_16 >= 0,
            'John 3:16 is present',
            john3_16 >= 0 ? `${graph.degree(john3_16)} references` : 'asset is wrong or corrupt',
        );
    } catch (error: any) {
        bad('graph failed to load', error?.message);
        say('\n(Everything below needs the graph. Stopping.)');
        return out.join('\n');
    }

    // ── the observation round-trip ───────────────────────────────────────────
    say('\nObservations');
    try {
        const id = await recordObservation({
            detector: 'convergence',
            dedupeKey: '__smoketest__',
            claim: { note: 'smoke test' },
            confidence: 0.01,
            evidence: [{ kind: 'verse', verseId: 35_002_003 }],
        });
        ok('recorded', `id ${id}`);

        const again = await recordObservation({
            detector: 'convergence',
            dedupeKey: '__smoketest__',
            claim: { note: 'smoke test, rediscovered' },
            confidence: 0.02,
            evidence: [{ kind: 'verse', verseId: 35_002_003 }],
        });
        check(again === id, 'rediscovery updates rather than duplicates');

        const read = await getObservation(id);
        check(read?.evidence.length === 1, 'evidence round-trips');

        await markShown(id);
        await recordFeedback(id, false);
        const pending = await getPendingObservations(50);
        check(!pending.some(o => o.id === id), '"that\'s not it" is respected');

        await withDatabase(db => db.runAsync('DELETE FROM observations WHERE dedupe_key = ?', ['__smoketest__']));
        ok('cleaned up after itself');
    } catch (error: any) {
        bad('observation round-trip threw', error?.message);
    }

    // ── the detector itself ──────────────────────────────────────────────────
    say('\nConvergence, on your journal');
    try {
        const entries = await loadSeedEntries();
        ok('entries loaded', `${entries.length}`);

        const cited = entries.reduce((n, e) => n + e.citations.length, 0);
        ok('citations parsed', `${cited}`);

        if (entries.length === 0) {
            say('  (no entries yet — nothing to walk)');
        } else {
            const started = Date.now();
            const candidates = findConvergence(entries, graph);
            const ms = Date.now() - started;
            ok('detector ran', `${ms}ms`);

            if (candidates.length === 0) {
                say('\n  Nothing cleared the gates yet.');
                say('  (4+ entries, 2+ books, 45+ days apart, all reaching one passage)');

                // Show what it would find with the gates relaxed, so a silent
                // result can be told apart from a broken one.
                const loose = findConvergence(entries, graph, {
                    minEntries: 2,
                    minBooks: 1,
                    minSpanDays: 0,
                    maxCandidates: 5,
                });
                if (loose.length > 0) {
                    say('\n  With the gates off, it would have offered:');
                    for (const c of loose) {
                        say(
                            `    ${formatVerseId(c.hubVerseId).padEnd(20)} ` +
                                `${String(c.entryIds.length).padStart(2)} entries · ` +
                                `${c.bookNames.length} books · ${Math.round(c.spanDays)}d · ` +
                                `plan ${c.planShape.toFixed(2)}`,
                        );
                    }
                    say('\n  ↑ Gates are working. These are real but too thin to claim.');
                } else {
                    say('  Nothing even with the gates off — worth a look.');
                }
            } else {
                say('\n  Passages your entries converge on, that you have not written about:\n');
                for (const c of candidates) {
                    say(
                        `    ${formatVerseId(c.hubVerseId).padEnd(20)} ` +
                            `${String(c.entryIds.length).padStart(2)} entries · ` +
                            `${String(Math.round(c.spanDays)).padStart(3)}d · ` +
                            `plan ${c.planShape.toFixed(2)} · deg ${String(c.hubDegree).padStart(3)} · ` +
                            `score ${c.score.toFixed(3)}`,
                    );
                    say(`      ${c.bookNames.join(', ')}`);
                }
                say('\n  ↑ plan 1.00 = you read these straight through, so it is the schedule.');
                say('    plan 0.00 = you arrived here out of order, so it is yours.');
            }
        }
    } catch (error: any) {
        bad('convergence threw', error?.message);
    }

    // ── make it visible ──────────────────────────────────────────────────────
    say('\nRecording, and clearing the pacing throttles');
    try {
        const ids = await detectConvergence();
        ok('observations recorded', `${ids.length}`);

        /*
         * Home shows at most one noticing every three days and only re-runs
         * detection daily. Both are right in use and useless while building,
         * so the dev harness resets them — the next Home visit will show a
         * card if there is one.
         */
        await AsyncStorage.multiRemove(['insight_last_detection', 'insight_last_shown']);
        ok('throttles cleared — open Home to see the card');
    } catch (error: any) {
        bad('recording threw', error?.message);
    }

    unloadGraph();
    say('\n────────────────────────────────────────────────────────\n');
    return out.join('\n');
}
