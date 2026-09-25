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
import { detectAbsence, diagnoseAbsence, loadAbsenceEntries } from './detectors/absence';
import { detectStudy, loadTopics, qualifyingTopics, rankTopics } from './detectors/study';
import { detectMilestones, loadBookTallies } from './detectors/milestone';
import {
    DETECTORS,
    getObservation,
    getPendingObservations,
    getRecentObservations,
    markShown,
    recordFeedback,
    recordObservation,
    surfaceOf,
    DetectorName,
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

/**
 * Force ONE named detector's finding back, regardless of the rotation above.
 *
 * `REARM` picks the least recently touched row per surface, which is right for
 * cycling through everything and useless when you want to look at one specific
 * detector — on the save screen it is as likely to hand back a commitment as
 * the thing you just built.
 *
 * It exists because a finding is marked shown the instant `useObservation`
 * SELECTS it, not when anyone looks at it. Reaching the summary step of the
 * entry wizard is enough to spend one, so a detector resting thirty days can
 * be burned by a screen nobody read. Until that is settled, testing needs a
 * way to put a specific card back.
 *
 * Set to null once you have seen what you came to see.
 */
const REARM_DETECTOR: DetectorName | null = null;

/**
 * Put a milestone card on screen without having reached one.
 *
 * `milestone` is the only detector that cannot be tested by waiting. The
 * others eventually fire on a journal that simply grows: a commitment ages
 * into range, a topic passes three weeks, an imbalance widens. A milestone
 * needs a book actually finished or a quarter of the plan actually crossed,
 * and its anti-backfill guards mean even a reader with four completed books
 * sees nothing unless they closed one this week. Correct, and untestable.
 *
 * So this records a synthetic one. It is keyed `preview:…` rather than
 * `book:Ruth`, and that matters more than it looks: dedupe keys are how a
 * milestone is offered exactly once ever, so previewing under a real key
 * would burn it — the day the reader genuinely finished Ruth, the card would
 * be silently skipped as already seen.
 *
 * Set back to null when you have seen it. The row stays behind, which is
 * harmless — `preview:` collides with nothing — but it will keep reappearing
 * in the pending queue until it is dismissed like any other card.
 */
const PREVIEW_MILESTONE: 'shortBook' | 'longBook' | 'planHalf' | 'planDone' | null = 'shortBook';

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
         * Milestones report the shelf as well as the finding, because a
         * detector that is correctly silent and one that cannot see the books
         * at all look identical from outside — and its guards are built to be
         * silent almost always.
         */
        const tallies = await loadBookTallies();
        const finished = tallies.filter(b => b.total > 0 && b.worked >= b.total);
        ok(
            'books finished',
            `${finished.length} of ${tallies.length}${finished.length ? ` — ${finished.map(b => b.name).join(', ')}` : ''}`,
        );
        const milestoneIds = await detectMilestones(0);
        ok('milestones recorded', `${milestoneIds.length}`);

        if (PREVIEW_MILESTONE) {
            const previews = {
                shortBook: { kind: 'book', book: 'Ruth', chapters: 4 },
                longBook: { kind: 'book', book: 'Genesis', chapters: 50 },
                planHalf: { kind: 'plan', mark: 50 },
                planDone: { kind: 'plan', mark: 100 },
            } as const;
            await recordObservation({
                detector: 'milestone',
                dedupeKey: `preview:${PREVIEW_MILESTONE}`,
                claim: previews[PREVIEW_MILESTONE],
                confidence: 0.99,
                evidence: [],
            });
            ok(
                'preview milestone armed',
                `${PREVIEW_MILESTONE} — save an entry to see it; set PREVIEW_MILESTONE = null when done`,
            );
        }

        /*
         * Study reports how many topics it is holding as well as how many it
         * will offer, because those numbers diverge by design: the detector
         * may be sitting on a dozen and hand back exactly one. Seeing only the
         * one would look like a detector that had barely found anything.
         */
        const topics = await loadTopics();
        const openTopics = qualifyingTopics(topics);
        const dated = openTopics.filter(topic => topic.reminderPassed).length;
        ok(
            'study topics',
            `${topics.length} open, ${openTopics.length} old enough${dated ? `, ${dated} with a date that passed` : ''}, offering ${rankTopics(topics).length}`,
        );
        const studyIds = await detectStudy();
        ok('study recorded', `${studyIds.length}`);

        /*
         * Absence reports its counts even when it declines to fire. A detector
         * that is silent because the journal is balanced and one that is silent
         * because it is reading the wrong column look identical from outside,
         * and this is the surface where that difference would otherwise hide.
         */
        const answered = await loadAbsenceEntries();
        const tally = { jehovah: 0, message: 0, apply: 0, others: 0 };
        for (const entry of answered) for (const key of entry.answered) tally[key] += 1;
        ok(
            'questions answered',
            `Jehovah ${tally.jehovah} · message ${tally.message} · apply ${tally.apply} · others ${tally.others} (of ${answered.length})`,
        );
        const gap = diagnoseAbsence(answered);
        ok(
            'widest gap',
            gap.blocked
                ? `none — ${gap.blocked}`
                : `${gap.poorKey} ${gap.poorCount} vs ${gap.richKey} ${gap.richCount} (ratio ${gap.ratio?.toFixed(2)})`,
        );
        const absenceIds = await detectAbsence();
        ok('absences recorded', `${absenceIds.length}`);

        /*
         * What is actually in the table, per detector. "afterSave → nothing"
         * has two completely different causes — no row was ever written, or a
         * row exists but the pending query will not return it — and they are
         * indistinguishable from the surface probe alone.
         */
        const stored = await withDatabase(db =>
            db.getAllAsync<any>(
                `SELECT detector, COUNT(*) AS n,
                        SUM(CASE WHEN shown_at IS NULL THEN 1 ELSE 0 END) AS unshown,
                        SUM(CASE WHEN feedback = 0 THEN 1 ELSE 0 END) AS rejected,
                        SUM(CASE WHEN dismissed_at IS NOT NULL THEN 1 ELSE 0 END) AS dismissed
                   FROM observations GROUP BY detector`,
            ),
        );
        say('\n  Rows in the table:');
        if (stored.length === 0) say('    (none)');
        for (const row of stored) {
            say(`    ${String(row.detector).padEnd(12)} ${row.n} total · ${row.unshown} never shown · ${row.rejected} rejected · ${row.dismissed} dismissed`);
        }

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

        if (REARM_DETECTOR) {
            const forced = await withDatabase(db =>
                db.runAsync(
                    `UPDATE observations
                        SET shown_at = NULL, opened_at = NULL, dismissed_at = NULL,
                            feedback = NULL, followed_at = NULL
                      WHERE detector = ?`,
                    [REARM_DETECTOR],
                ),
            );
            ok(
                `forced ${REARM_DETECTOR} back`,
                `${forced.changes} row(s) — set REARM_DETECTOR = null when done`,
            );
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
