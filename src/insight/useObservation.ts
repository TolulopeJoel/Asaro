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
import {
    StoredObservation,
    getPendingObservations,
    markDismissed,
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
    /** Mark it seen and opened — the reader is looking at the receipts. */
    open: () => Promise<void>;
    /** "Not now." Distinct from a verdict: the finding may still be true. */
    dismiss: () => Promise<void>;
    /** "That's not it", or agreement. The only ground truth this app gets. */
    verdict: (agreed: boolean) => Promise<void>;
}

export function useObservation(enabled: boolean): ObservationSlot {
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
                if ((await millisSince(LAST_RUN_KEY)) > DETECT_EVERY_MS) {
                    /*
                     * Sequential, not parallel. Both write to the same table
                     * through one SQLite connection, and the whole pass is a
                     * few hundred milliseconds on a journal of any realistic
                     * size — there is nothing to win by interleaving them.
                     */
                    await detectConvergence();
                    await detectCommitments();
                    await stamp(LAST_RUN_KEY);
                }

                // Still inside the quiet period — say nothing at all.
                if ((await millisSince(LAST_SHOWN_KEY)) < QUIET_PERIOD_MS) return;

                const pending = await getPendingObservations(5);
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
                    await markShown(candidate.id);
                    await stamp(LAST_SHOWN_KEY);
                    return;
                }
            } catch {
                // A noticing is never important enough to interrupt Home.
            }
        })();
    }, [enabled]);

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

    const verdict = useCallback(
        async (agreed: boolean) => {
            if (observation) await recordFeedback(observation.id, agreed);
            clear();
        },
        [observation, clear],
    );

    return { observation, rendered, open, dismiss, verdict };
}
