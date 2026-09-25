/**
 * The one noticing Home is currently willing to show, if there is one.
 *
 * Pacing lives here rather than in the card, because it is a decision about
 * the reader's attention rather than about any particular finding. Two rules,
 * both deliberately conservative:
 *
 *   At most one card at a time. The detector will happily return several and
 *   the graph will keep producing more; a feed of them would turn a noticing
 *   into a nag, and the value of this feature is that it speaks rarely.
 *
 *   At most one new noticing every few days. Scarcity is what makes a card
 *   read as attention rather than analytics.
 *
 * Phase 6 replaces the interval with a ranker trained on the columns
 * `observation.ts` has been filling in since Phase 0 — which is why the
 * instrumentation shipped before the model that needs it.
 *
 * Detection itself is throttled separately: it walks the whole journal against
 * a 597,000-edge graph, which is fast but not free, and nothing about a
 * convergence changes between two app opens on the same morning.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { detectConvergence } from './detectors/convergence';
import { detectCommitments } from './detectors/commitment';
import { detectStudy } from './detectors/study';
import { detectMilestones } from './detectors/milestone';
import { getReadingProgress } from '../data/readingRepository';
import { READING_PLAN_DATA } from '../data/readingPlanData';
import { detectAbsence } from './detectors/absence';
import {
    StoredObservation,
    Surface,
    getPendingObservations,
    markDismissed,
    markFollowed,
    markOpened,
    markShown,
    recordFeedback,
} from './observation';
import { RenderedObservation, renderObservation } from './render';

const LAST_RUN_KEY = 'insight_last_detection';
const LAST_SHOWN_KEY = 'insight_last_shown';

const DAY_MS = 86_400_000;
/** How often the detectors re-walk the journal. */
const DETECT_EVERY_MS = DAY_MS;
/** How long a shown card's silence lasts before another may appear. */
const QUIET_PERIOD_MS = 3 * DAY_MS;

async function millisSince(key: string): Promise<number> {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return Number.POSITIVE_INFINITY;
        const at = Number(raw);
        return Number.isFinite(at) ? Date.now() - at : Number.POSITIVE_INFINITY;
    } catch {
        return Number.POSITIVE_INFINITY;
    }
}

const stamp = (key: string) => AsyncStorage.setItem(key, String(Date.now())).catch(() => {});

export interface ObservationSlot {
    observation: StoredObservation | null;
    rendered: RenderedObservation | null;
    /**
     * The card is on screen. Must be called by whatever renders it.
     *
     * Not optional and not automatic: nothing else marks a finding shown, so a
     * surface that forgets this will re-offer the same card for ever.
     */
    seen: () => Promise<void>;
    /** Mark it seen and opened — the reader is looking at the receipts. */
    open: () => Promise<void>;
    /** "Not now." Distinct from a verdict: the finding may still be true. */
    dismiss: () => Promise<void>;
    /** "That's not it", or agreement. The only ground truth this app gets. */
    verdict: (agreed: boolean) => Promise<void>;
    /** The reader tapped through to the passage this offered. */
    follow: () => Promise<void>;
}

/**
 * @param surface which placement's findings to draw from — see `surfaceOf`.
 *   Home and the save screen each pull their own, so a commitment never
 *   competes with a discovery for the same slot.
 */
export function useObservation(enabled: boolean, surface: Surface = 'home'): ObservationSlot {
    const [observation, setObservation] = useState<StoredObservation | null>(null);
    const [rendered, setRendered] = useState<RenderedObservation | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!enabled) return;

        (async () => {
            try {
                if (surface === 'home' && (await millisSince(LAST_RUN_KEY)) > DETECT_EVERY_MS) {
                    /*
                     * Sequential, not parallel. Both write to the same table
                     * through one SQLite connection, and the whole pass is a
                     * few hundred milliseconds on a journal of any realistic
                     * size — there is nothing to win by interleaving them.
                     */
                    await detectConvergence();
                    /*
                     * Milestones need the plan's own progress, which lives
                     * outside the journal — every other detector here reads
                     * only what the reader wrote, so this is the one that has
                     * to be handed something.
                     */
                    const done = await getReadingProgress();
                    const planPercent = READING_PLAN_DATA.length
                        ? (done.length / READING_PLAN_DATA.length) * 100
                        : 0;
                    await detectMilestones(planPercent);
                    await detectCommitments();
                    await detectStudy();
                    await detectAbsence();
                    await stamp(LAST_RUN_KEY);
                }

                /*
                 * The quiet period is Home's, not everything's. A card shown
                 * after saving an entry is already rate-limited by the act of
                 * writing one — nobody writes three a day — and making it wait
                 * on Home's timer would mean a reader who journals daily sees
                 * one a fortnight for no reason either surface cares about.
                 */
                if (surface === 'home' && (await millisSince(LAST_SHOWN_KEY)) < QUIET_PERIOD_MS) return;

                const pending = await getPendingObservations(5, surface);
                if (!mounted.current) return;

                /*
                 * The first one this build can actually phrase. A finding from
                 * a newer build whose detector this version has no words for
                 * is skipped rather than shown as a blank.
                 */
                for (const candidate of pending) {
                    const words = renderObservation(candidate);
                    if (!words) continue;
                    setObservation(candidate);
                    setRendered(words);
                    /*
                     * Selected, not shown. `seen()` does the stamping, and the
                     * card calls it when it mounts — see below for why the
                     * difference is worth a callback.
                     */
                    return;
                }
            } catch {
                // A noticing is never important enough to interrupt Home.
            }
        })();
    }, [enabled, surface]);

    /**
     * Record that the reader was actually shown this.
     *
     * Stamping used to happen where the candidate is chosen, a few lines up,
     * which quietly meant "the screen finished loading" rather than "a person
     * saw it". Home enables this hook the moment stats arrive and the wizard
     * enables it on reaching the summary step, so switching tabs or backing
     * out of a draft was enough to spend a finding nobody had laid eyes on.
     *
     * That is more than a wasted card, because `shown_at` is doing four jobs
     * at once: it decides whether a finding may be offered again, orders the
     * rotation, starts a recurring detector's rest, and — the one that bites —
     * puts the row in the archive. A convergence stamped but never rendered
     * turns up under "You've not read these. What are you doing?", which is
     * the app telling somebody off for ignoring a card it never showed them.
     *
     * Mount is not the same as visible; a card below the fold still counts.
     * Closing that last gap needs viewport tracking, which is a great deal of
     * machinery for the remainder — this fixes the part that was actually
     * wrong.
     *
     * Idempotent per finding, so a re-render cannot inflate `shown_count`.
     */
    const stamped = useRef<number | null>(null);
    const seen = useCallback(async () => {
        if (!observation || stamped.current === observation.id) return;
        stamped.current = observation.id;
        await markShown(observation.id);
        /*
         * Home's quiet period starts when something is shown, so it belongs
         * here too — begun on selection it would silence Home for three days
         * over a card that never appeared.
         */
        if (surface === 'home') await stamp(LAST_SHOWN_KEY);
    }, [observation, surface]);

    const clear = useCallback(() => {
        if (!mounted.current) return;
        setObservation(null);
        setRendered(null);
    }, []);

    const open = useCallback(async () => {
        if (observation) await markOpened(observation.id);
    }, [observation]);

    const dismiss = useCallback(async () => {
        if (observation) await markDismissed(observation.id);
        clear();
    }, [observation, clear]);

    const follow = useCallback(async () => {
        if (observation) await markFollowed(observation.id);
    }, [observation]);

    const verdict = useCallback(
        async (agreed: boolean) => {
            if (observation) await recordFeedback(observation.id, agreed);
            clear();
        },
        [observation, clear],
    );

    return { observation, rendered, seen, open, dismiss, verdict, follow };
}
