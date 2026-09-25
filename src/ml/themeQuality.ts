/**
 * Deciding which clusters are worth calling themes, and in what order.
 * `clusterThemes` answers "what groups together", which is not the same
 * question. Three gates close the gap:
 *
 *   **Cohesion floor.** The merge threshold is a percentile of the corpus's
 *   own similarities, so it always cuts somewhere — a hundred unrelated
 *   entries still produce "themes". A group no tighter than two entries picked
 *   at random is the threshold working on noise, not a pattern.
 *
 *   **Plan artifacts.** Read one book for a week and those entries share
 *   vocabulary, imagery and mood, so they cluster hard — a fact about the plan,
 *   not the reader. One book PLUS one week is the signature; neither half alone
 *   is damning, since one book across six months is real engagement and one
 *   week across many books is a real preoccupation.
 *
 *   **Recency.** "Four times this month" is worth more attention than "four
 *   times ever", so size cannot rank alone.
 *
 * Deliberately separate from clustering.ts, which is a line-by-line port of
 * themes.py checked by scripts/verify-clustering.mjs. This needs `bookName` and
 * `createdAt`, which the generic Embedded shape does not carry, and keeping it
 * out is what lets the parity check keep meaning what it says.
 */

import { Cluster } from './clustering';
import { StoredEmbedding } from '../data/embeddingRepository';

export interface ThemeQualityOptions {
    /**
     * How far above ambient similarity a cluster must sit, in standard
     * deviations. Measured against the corpus rather than a fixed cosine:
     * how similar any two entries look depends on how varied the writing is.
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
    // Demoted, not dropped: the signature catches real themes by accident
    // often enough that hiding them would be the worse error.
    artifactPenalty: 0.4,
    recencyHalfLifeDays: 90,
    // Never below half. Recency is a tilt, not a cliff — nine returns last
    // year should still outrank two last week.
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
 * Mean and spread of similarity between two items picked at random — the
 * yardstick the cohesion floor is measured against, so a biased sample moves
 * the floor and silently changes which themes exist. Every pair when there are
 * few enough to afford, otherwise a seeded sample.
 *
 * Seeded, not `Math.random`: the same journal must produce the same themes
 * twice. Do not swap the generator for a fixed stride — stepping one index by 1
 * and the other by a constant only ever compares items an odd distance apart
 * and never sees half the pairs.
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
 * Drop the clusters that are not themes, and order what remains. Returns richer
 * objects than it takes so a caller can say *why* something ranked where it
 * did — `spanDays` is the theme card's headline, not debug detail.
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

/**
 * How long a theme has been running, phrased the way the UI says it.
 *
 * Returns null below a month, which is the point rather than an edge case:
 * "across 8 months" is evidence a thought outlived the passage that prompted
 * it, and rounding a fortnight up to "1 month" spends that credibility on
 * noise. Callers that must say something supply their own words for the null.
 *
 * Shared, so the list and the detail view cannot drift into two vocabularies.
 */
export function spanLabel(spanDays: number): string | null {
    const months = spanDays / 30.4;
    if (months < 1) return null;
    if (months < 2) return 'across a month';
    if (months < 12) return `across ${Math.round(months)} months`;
    const years = months / 12;
    return years < 2 ? 'across a year' : `across ${Math.round(years)} years`;
}
