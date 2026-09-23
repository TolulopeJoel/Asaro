/**
 * Deciding which clusters are worth calling themes, and in what order.
 *
 * clusterThemes answers "what groups together". That is not the same question
 * as "what is worth showing someone", and three things went wrong in the gap
 * between them:
 *
 *   Everything clustered. The merge threshold is a percentile of the corpus's
 *   own similarities, so it always cuts somewhere — write about a hundred
 *   unrelated things and you still get "themes". `cohesion` was computed for
 *   every cluster and then used for nothing but breaking ties in the sort. It
 *   is now a floor: a group no tighter than two of your entries picked at
 *   random is not a pattern, it is the threshold doing its job on noise.
 *
 *   The reading plan looked like a personality. Read Job for a week and those
 *   entries share vocabulary, imagery and mood, so they cluster hard — but
 *   that is a fact about the plan, not about the reader. Themes' own empty
 *   state warns about exactly this ("mostly describe the reading plan rather
 *   than you"). One book plus one week is the signature, and neither half
 *   alone is damning: Job across six months is real engagement, and a week
 *   spanning many books is a real preoccupation.
 *
 *   Nothing ever got old. Ranking was entryCount first, so a large dead theme
 *   from eight months ago outranked a live one forever. "Four times this
 *   month" is worth more of your attention than "four times ever".
 *
 * Deliberately separate from clustering.ts, which is a line-by-line port of
 * themes.py and is checked against it by scripts/verify-clustering.mjs. None
 * of this belongs in that port — it needs `bookName` and `createdAt`, which
 * the generic Embedded shape does not carry — and keeping it out means the
 * parity check keeps meaning what it says.
 */

import { Cluster } from './clustering';
import { StoredEmbedding } from '../data/embeddingRepository';

export interface ThemeQualityOptions {
    /**
     * How far above ambient similarity a cluster must sit, in standard
     * deviations, to count as a theme at all.
     *
     * Measured against the corpus rather than a fixed cosine, because how
     * similar any two of someone's entries look depends entirely on how
     * varied their writing is. 1.0 keeps groups that are clearly tighter than
     * chance and drops the rest.
     */
    cohesionZFloor?: number;
    /** Share of members from a single book above which a cluster looks like one reading. */
    bookConcentration?: number;
    /** Days a cluster must span to be more than one reading session. */
    minSpanDays?: number;
    /** What a suspected reading-plan artifact's rank is multiplied by. */
    artifactPenalty?: number;
    /** Days for a theme's recency weight to fall halfway to the floor. */
    recencyHalfLifeDays?: number;
    /** The least a theme's rank can be scaled by for being old. */
    recencyFloor?: number;
}

const DEFAULTS: Required<ThemeQualityOptions> = {
    cohesionZFloor: 1,
    bookConcentration: 0.8,
    minSpanDays: 14,
    /*
     * Demoted, not dropped. A plan artifact is still writing the person did,
     * and the signature catches real themes by accident often enough that
     * hiding them would be the worse error — someone who reads Job for a week
     * and is genuinely shaken by it wrote a real theme. Ranking it below
     * everything that recurs across books says the same thing without
     * deciding on their behalf that it never happened.
     */
    artifactPenalty: 0.4,
    recencyHalfLifeDays: 90,
    /*
     * Never below half. Recency is a tilt, not a cliff: a theme you returned
     * to nine times last year should still outrank one you touched twice last
     * week, and a floor keeps size the dominant term.
     */
    recencyFloor: 0.5,
};

export interface RankedTheme {
    cluster: Cluster<StoredEmbedding>;
    /** What this was ranked by. Higher is more worth reading. */
    score: number;
    /** Reads as one book over a few days — probably the plan, not the person. */
    isPlanArtifact: boolean;
    /** Days between this cluster's earliest and latest entry. */
    spanDays: number;
    /** Days since its most recent entry. */
    daysSinceLatest: number;
}

function dot(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

/**
 * Mean and spread of similarity between two items picked at random.
 *
 * This is the yardstick the cohesion floor is measured against, so a biased
 * sample moves the floor and silently changes which themes exist. Every pair
 * is used when there are few enough to afford; past that it samples with a
 * small seeded generator.
 *
 * Seeded, not Math.random, because the same journal has to produce the same
 * themes twice — a list that reshuffles on every open reads as the app
 * changing its mind. An earlier version walked the pairs with a fixed stride
 * to get that determinism without a generator, which looked neat and was
 * wrong: advancing one index by 1 and the other by a constant makes the gap
 * between them move in steps of 2, so it only ever compared items an odd
 * distance apart and never saw half the pairs at all.
 */
function ambientSimilarity(items: StoredEmbedding[], samples = 4000): { mean: number; std: number } {
    const n = items.length;
    if (n < 2) return { mean: 0, std: 0 };

    const totalPairs = (n * (n - 1)) / 2;
    const values: number[] = [];

    if (totalPairs <= samples) {
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) values.push(dot(items[i].vector, items[j].vector));
        }
    } else {
        let seed = 0x2f6e2b1;
        const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
        for (let k = 0; k < samples; k++) {
            const i = next() % n;
            let j = next() % n;
            if (i === j) j = (j + 1) % n;
            values.push(dot(items[i].vector, items[j].vector));
        }
    }

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
    return { mean, std: Math.sqrt(variance) };
}

const DAY_MS = 86_400_000;

function timesOf(cluster: Cluster<StoredEmbedding>): number[] {
    return cluster.members
        .map(m => new Date(m.createdAt).getTime())
        .filter(t => Number.isFinite(t));
}

/** The share of members belonging to whichever book is most represented. */
function dominantBookShare(cluster: Cluster<StoredEmbedding>): number {
    const counts = new Map<string, number>();
    let total = 0;

    for (const member of cluster.members) {
        if (!member.bookName) continue;
        counts.set(member.bookName, (counts.get(member.bookName) ?? 0) + 1);
        total++;
    }

    if (total === 0) return 0;
    return Math.max(...counts.values()) / total;
}

/**
 * Drop the clusters that are not themes, and order what remains.
 *
 * Returns richer objects than it takes so a caller can say *why* something
 * ranked where it did — the UI does not use that yet, but a ranking nobody
 * can interrogate is one nobody can fix.
 *
 * `now` is injectable so the recency maths can be tested without the clock.
 */
export function rankThemes(
    clusters: Cluster<StoredEmbedding>[],
    items: StoredEmbedding[],
    options: ThemeQualityOptions = {},
    now: number = Date.now(),
): RankedTheme[] {
    const config = { ...DEFAULTS, ...options };
    const ambient = ambientSimilarity(items);
    const floor = ambient.mean + config.cohesionZFloor * ambient.std;

    const ranked: RankedTheme[] = [];

    for (const cluster of clusters) {
        // Not tighter than two entries picked at random — not a pattern.
        if (cluster.cohesion < floor) continue;

        const times = timesOf(cluster);
        const spanDays = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / DAY_MS : 0;
        const daysSinceLatest = times.length > 0 ? Math.max(0, (now - Math.max(...times)) / DAY_MS) : 0;

        const isPlanArtifact =
            dominantBookShare(cluster) >= config.bookConcentration && spanDays <= config.minSpanDays;

        const decay = Math.pow(0.5, daysSinceLatest / config.recencyHalfLifeDays);
        const recency = config.recencyFloor + (1 - config.recencyFloor) * decay;

        const score =
            cluster.entryCount * recency * (isPlanArtifact ? config.artifactPenalty : 1);

        ranked.push({ cluster, score, isPlanArtifact, spanDays, daysSinceLatest });
    }

    // Cohesion breaks ties, as it did before — tighter is better at equal size.
    ranked.sort((a, b) => b.score - a.score || b.cluster.cohesion - a.cluster.cohesion);
    return ranked;
}
