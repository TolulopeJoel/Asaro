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
import { renderObservation } from './render';
import { detectCommitments, loadCommitments, rankCommitments } from './detectors/commitment';
import {
    DETECTORS,
    getObservation,
    getPendingObservations,
    getRecentObservations,
    markShown,
    recordFeedback,
    recordObservation,
    surfaceOf,
} from './observation';

/**
 * Whether to put a finding back into the queue on this run.
 *
 * Off, and it should stay off unless you are deliberately re-testing.
 *
 * Re-arming was needed once, when every observation was already marked shown
 * and both surfaces had nothing to draw. It then became the bug: it cleared
 * `shown_at` and `followed_at` on the most recent finding, which is always the
 * one just engaged with — so a card that had been read stayed pending on Home
 * and never reached the archive, every reload, for ever.
 *
 * Leave it false to watch the real behaviour. Flip it for one run to force a
 * card back, then turn it off again.
 */
const REARM = false;

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

        /*
         * `markFollowed` is fired on the way out to jw.org and nothing awaits
         * it, so a missing column would surface as a silent unhandled
         * rejection at exactly the moment nobody is looking at the console.
         */
        const columns = await withDatabase(async db =>
            (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(observations)`)).map(c => c.name),
        );
        for (const column of ['shown_count', 'followed_at']) {
            check(columns.includes(column), `observations.${column} exists`);
        }

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
    say('\nRe-arming for a look');
    try {
        const ids = await detectConvergence();
        ok('convergences recorded', `${ids.length}`);

        const open = await loadCommitments();
        const worth = rankCommitments(open);
        ok('standing commitments', `${open.length} total, ${worth.length} worth handing back`);
        const commitmentIds = await detectCommitments();
        ok('commitments recorded', `${commitmentIds.length}`);

        /*
         * Re-arm ONE finding per surface, not all of them.
         *
         * Clearing everything looked right and quietly broke the thing it was
         * meant to help test: pending means "not yet seen" and the archive
         * means "seen", so wiping `shown_at` across the board emptied the
         * Echoes tab on every reload. Leaving the rest alone gives both a
         * card to draw and a history to list.
         */
        if (REARM) {
            const rearmed: string[] = [];
            for (const surface of ['home', 'afterSave'] as const) {
                const forSurface = DETECTORS.filter(d => surfaceOf(d) === surface);
                /*
                 * The LEAST recently touched, not the most. Picking the newest
                 * meant repeatedly resurrecting whatever the reader had just
                 * dealt with, which is the opposite of cycling through.
                 */
                const target = await withDatabase(async db =>
                    db.getFirstAsync<{ id: number; detector: string }>(
                        `SELECT id, detector FROM observations
                          WHERE detector IN (${forSurface.map(() => '?').join(',')})
                          ORDER BY COALESCE(shown_at, created_at) ASC
                          LIMIT 1`,
                        forSurface as unknown as any[],
                    ),
                );
                if (!target) continue;
                await withDatabase(db =>
                    db.runAsync(
                        `UPDATE observations
                            SET shown_at = NULL, opened_at = NULL, dismissed_at = NULL,
                                feedback = NULL, followed_at = NULL
                          WHERE id = ?`,
                        [target.id],
                    ),
                );
                rearmed.push(`${surface}:${target.detector}`);
            }
            ok('re-armed', rearmed.join(', ') || 'nothing to re-arm');
        } else {
            ok('not re-arming', 'set REARM = true in smokeTest.ts to force a card back');
        }

        // Safe to clear regardless: these only decide WHEN Home may speak,
        // and hold no record of what the reader has done.
        await AsyncStorage.multiRemove(['insight_last_detection', 'insight_last_shown']);
        ok('pacing throttles cleared');

        /*
         * What each surface would actually draw, so a quiet screen can be told
         * apart from a broken one without hunting through the app.
         */
        for (const surface of ['home', 'afterSave'] as const) {
            const pending = await getPendingObservations(3, surface);
            const legible = pending.map(renderObservation).filter(Boolean);
            if (legible.length === 0) {
                say(`      ${surface.padEnd(9)} → nothing`);
                continue;
            }
            say(`      ${surface.padEnd(9)} → ${legible.length} waiting`);
            for (const r of legible) say(`                    ${r!.kind}: ${r!.subject.slice(0, 46)}`);
        }
        const engaged = await withDatabase(db =>
            db.getAllAsync<any>(
                `SELECT detector, dedupe_key, shown_count,
                        followed_at IS NOT NULL AS followed,
                        feedback, dismissed_at IS NOT NULL AS dismissed
                   FROM observations
                  WHERE followed_at IS NOT NULL OR feedback IS NOT NULL OR dismissed_at IS NOT NULL`,
            ),
        );
        if (engaged.length > 0) {
            say('\n  What you have engaged with:');
            for (const row of engaged) {
                const marks = [
                    row.followed ? 'read it' : null,
                    row.feedback === 0 ? "said that's not it" : row.feedback === 1 ? 'agreed' : null,
                    row.dismissed ? 'dismissed' : null,
                ].filter(Boolean);
                say(`    ${String(row.dedupe_key).padEnd(22)} shown ${row.shown_count}\u00d7 \u00b7 ${marks.join(', ')}`);
            }
        }

        const archive = await getRecentObservations(5);
        say(`      archive   \u2192 ${archive.length} in Echoes \u203a Noticed`);
        say('\n  Home shows the first; the save screen shows the other.');
    } catch (error: any) {
        bad('re-arming threw', error?.message);
    }

    unloadGraph();
    say('\n────────────────────────────────────────────────────────\n');
    return out.join('\n');
}
