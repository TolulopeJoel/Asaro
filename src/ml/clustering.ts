/**
 * Theme clustering over entry embeddings.
 *
 * Ported from scripts/thought-echoes/themes.py, which is the reference
 * implementation — the Python version is where the approach was validated
 * against real entries, and the two must agree. scripts/verify-clustering.mjs
 * checks that they do.
 *
 * Two deliberate choices carried over from the experiments:
 *
 *   Centering. Every answer to one prompt points the same way ("Jehovah is
 *   loving"), so raw cosine mostly measures how strongly each answer expresses
 *   that shared idea. Subtracting the field's mean vector removes the common
 *   direction and leaves what each answer is actually about. Without this,
 *   every theme comes out as a restatement of the question.
 *
 *   No generated labels. Clusters are named by the person who wrote them.
 *   A model guessing names would be worse, could be wrong in ways nobody can
 *   hotfix, and naming your own recurring thought is the point of the app.
 *   themeNames.ts does put a provisional label on an unnamed cluster, which
 *   is not a walk-back of this: it extracts words the person already wrote
 *   rather than inventing a description, it is never persisted, and a saved
 *   name always beats it. The rule this module cares about — that nothing
 *   invents an interpretation and stores it as though a person meant it —
 *   still holds.
 */

export interface Embedded {
    /** Journal entry this text came from. */
    entryId: number;
    /** Which prompt: 'reflection_1' … 'action'. Centering is per-field. */
    field: string;
    text: string;
    /** Unit-length embedding. */
    vector: Float32Array;
}

export interface Cluster<T extends Embedded = Embedded> {
    members: T[];
    /** Mean pairwise similarity inside the cluster. Higher = tighter. */
    cohesion: number;
    /** Distinct entries, which is what "size" means to a reader. */
    entryCount: number;
}

// ─── vector helpers ───────────────────────────────────────────────────────────

function dot(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

/**
 * Subtract each field's mean vector and renormalise.
 *
 * Returns new vectors; the inputs are untouched so the stored embeddings stay
 * reusable for other purposes (similar-entry lookup, for instance, wants the
 * uncentered ones).
 */
export function centerWithinFields<T extends Embedded>(items: T[]): T[] {
    const byField = new Map<string, T[]>();
    for (const item of items) {
        const bucket = byField.get(item.field);
        if (bucket) bucket.push(item);
        else byField.set(item.field, [item]);
    }

    const out: T[] = [];

    for (const [, group] of byField) {
        // A field with one member has no meaningful mean to subtract.
        if (group.length < 2) {
            out.push(...group);
            continue;
        }

        const dims = group[0].vector.length;
        const mean = new Float32Array(dims);
        for (const item of group) {
            for (let i = 0; i < dims; i++) mean[i] += item.vector[i];
        }
        for (let i = 0; i < dims; i++) mean[i] /= group.length;

        for (const item of group) {
            const centered = new Float32Array(dims);
            for (let i = 0; i < dims; i++) centered[i] = item.vector[i] - mean[i];

            let norm = Math.sqrt(dot(centered, centered));
            if (norm < 1e-9) norm = 1e-9;
            for (let i = 0; i < dims; i++) centered[i] /= norm;

            out.push({ ...item, vector: centered });
        }
    }

    return out;
}

function similarityMatrix(items: Embedded[]): Float64Array {
    const n = items.length;
    const sims = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            const value = dot(items[i].vector, items[j].vector);
            sims[i * n + j] = value;
            sims[j * n + i] = value;
        }
    }
    return sims;
}

/** Value below which `grain` percent of pairs fall. Drives the merge cutoff. */
function percentileOfPairs(sims: Float64Array, n: number, grain: number): number {
    const values: number[] = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) values.push(sims[i * n + j]);
    }
    if (values.length === 0) return 1;
    values.sort((a, b) => a - b);
    const idx = Math.min(values.length - 1, Math.max(0, Math.floor((grain / 100) * values.length)));
    return values[idx];
}

// ─── clustering ───────────────────────────────────────────────────────────────

export interface ClusterOptions {
    /**
     * 0-100. Lower merges into fewer, broader themes; higher splits into more,
     * tighter ones. The threshold is taken from this corpus's own distribution
     * rather than a fixed cosine value, so it adapts to how varied the writing
     * is.
     */
    grain?: number;
    /** Minimum distinct ENTRIES for a group to count as a theme. */
    minEntries?: number;
}

/**
 * Average-linkage agglomerative clustering.
 *
 * Written out rather than pulled from a library: a heavy journal is a few
 * thousand answers, the naive merge loop handles that in well under a second,
 * and it keeps the dependency list empty.
 */
export function clusterThemes<T extends Embedded>(
    items: T[],
    options: ClusterOptions = {},
): Cluster<T>[] {
    const { grain = 85, minEntries = 3 } = options;
    const n = items.length;
    if (n < 2) return [];

    const sims = similarityMatrix(items);
    const threshold = percentileOfPairs(sims, n, grain);

    let groups: number[][] = items.map((_, i) => [i]);

    const averageBetween = (a: number[], b: number[]): number => {
        let total = 0;
        for (const i of a) for (const j of b) total += sims[i * n + j];
        return total / (a.length * b.length);
    };

    while (groups.length > 1) {
        let best = -Infinity;
        let bestA = -1;
        let bestB = -1;

        for (let a = 0; a < groups.length; a++) {
            for (let b = a + 1; b < groups.length; b++) {
                const score = averageBetween(groups[a], groups[b]);
                if (score > best) {
                    best = score;
                    bestA = a;
                    bestB = b;
                }
            }
        }

        if (best < threshold) break;
        groups[bestA] = groups[bestA].concat(groups[bestB]);
        groups.splice(bestB, 1);
    }

    const clusters: Cluster<T>[] = [];

    for (const group of groups) {
        const members = group.map(i => items[i]);
        const entryCount = new Set(members.map(m => m.entryId)).size;

        // Counting entries rather than answers: reflection_1 and reflection_3
        // of one entry are two vectors but a single thought, and a "theme" of
        // one entry talking to itself is not a theme.
        if (entryCount < minEntries) continue;

        let total = 0;
        let pairs = 0;
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                total += sims[group[i] * n + group[j]];
                pairs += 1;
            }
        }

        clusters.push({ members, cohesion: pairs ? total / pairs : 0, entryCount });
    }

    clusters.sort((a, b) => b.entryCount - a.entryCount || b.cohesion - a.cohesion);
    return clusters;
}

/**
 * The members that best represent a cluster, most central first.
 *
 * Used to show a few lines under an unnamed theme so the person has something
 * concrete to react to when naming it.
 */
export function representatives<T extends Embedded>(cluster: Cluster<T>, count = 3): T[] {
    const { members } = cluster;
    if (members.length <= count) return [...members];

    const scored = members.map(member => {
        let total = 0;
        for (const other of members) {
            if (other !== member) total += dot(member.vector, other.vector);
        }
        return { member, centrality: total / (members.length - 1) };
    });

    scored.sort((a, b) => b.centrality - a.centrality);
    return scored.slice(0, count).map(s => s.member);
}
