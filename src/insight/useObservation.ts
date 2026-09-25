/**
 * The one noticing Home is currently willing to show, if there is one.
 *
 * Pacing lives here rather than in the card: it is a decision about the
 * reader's attention, not about any particular finding. Two conservative rules
 * — one card at a time, and one new noticing every few days. Scarcity is what
 * makes a card read as attention rather than analytics.
 *
 * Detection is throttled separately. It walks the whole journal against a
 * ~597,000-edge graph, and nothing about a convergence changes between two app
 * opens on the same morning.
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
     * The card is on screen. Must be called by whatever renders it — nothing
     * else marks a finding shown, so a surface that forgets it will re-offer
     * the same card for ever.
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
                    // Sequential, not parallel: they share one SQLite
                    // connection and the whole pass is a few hundred ms.
                    await detectConvergence();
                    // Milestones are the only detector needing something from
                    // outside the journal — the plan's own progress.
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

                // The quiet period is Home's alone. A card after saving is
                // already rate-limited by the act of writing an entry.
                if (surface === 'home' && (await millisSince(LAST_SHOWN_KEY)) < QUIET_PERIOD_MS) return;

                const pending = await getPendingObservations(5, surface);
                if (!mounted.current) return;

                // The first one this build can phrase: a finding from a newer
                // build is skipped rather than shown blank.
                for (const candidate of pending) {
                    const words = renderObservation(candidate);
                    if (!words) continue;
                    setObservation(candidate);
                    setRendered(words);
                    // Selected, not shown — `seen()` stamps, called on mount.
                    return;
                }
            } catch {
                // A noticing is never important enough to interrupt Home.
            }
        })();
    }, [enabled, surface]);

    /**
     * Record that the reader was actually shown this. Stamped on the card's
     * mount, never where the candidate is selected — selection only means the
     * screen loaded, and switching tabs would spend a finding nobody saw.
     *
     * `shown_at` does four jobs: gates re-offering, orders the rotation, starts
     * a recurring detector's rest, and files the row in the archive. A
     * convergence stamped but never rendered ends up under "You've not read
     * these" — the app telling someone off for ignoring a card it never showed.
     *
     * Mount is still not the same as visible; a card below the fold counts.
     * Closing that needs viewport tracking.
     *
     * Idempotent per finding, so a re-render cannot inflate `shown_count`.
     */
    const stamped = useRef<number | null>(null);
    const seen = useCallback(async () => {
        if (!observation || stamped.current === observation.id) return;
        stamped.current = observation.id;
        await markShown(observation.id);
        // Home's quiet period starts on showing, not selection — otherwise a
        // card that never appeared silences Home for three days.
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
