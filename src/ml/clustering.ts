/**
 * Theme clustering over entry embeddings.
 *
 * A port of scripts/thought-echoes/themes.py, the reference implementation. The
 * two must agree; scripts/verify-clustering.mjs checks that they do.
 *
 * Two deliberate choices carried over:
 *
 *   **Centering.** Every answer to one prompt points the same way ("Jehovah is
 *   loving"), so raw cosine mostly measures how strongly each answer expresses
 *   that shared idea. Subtracting the field's mean vector leaves what each
 *   answer is actually about; without it every theme restates the question.
 *
 *   **No generated labels.** Clusters are named by the person who wrote them.
 *   A model guessing could be wrong in ways nobody can hotfix. (themeNames.ts
 *   suggests a provisional label, which is extractive rather than invented,
 *   never persisted, and always beaten by a saved name — the rule here is that
 *   nothing invents an interpretation and stores it as though a person meant
 *   it.)
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

/** Unrolled for Hermes, which has no JIT; still summed strictly left to right. */
function dot(a: Float32Array, b: Float32Array): number {
    const length = a.length;
    const whole = length - (length % 8);
    let sum = 0;
    let i = 0;
    for (; i < whole; i += 8) {
        sum += a[i] * b[i];
        sum += a[i + 1] * b[i + 1];
        sum += a[i + 2] * b[i + 2];
        sum += a[i + 3] * b[i + 3];
        sum += a[i + 4] * b[i + 4];
        sum += a[i + 5] * b[i + 5];
        sum += a[i + 6] * b[i + 6];
        sum += a[i + 7] * b[i + 7];
    }
    for (; i < length; i++) sum += a[i] * b[i];
    return sum;
}

/**
 * Subtract each field's mean vector and renormalise. Returns NEW vectors — the
 * inputs stay untouched so the stored embeddings remain reusable, since
 * similar-entry lookup wants the uncentered ones.
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
    const values = new Float64Array((n * (n - 1)) / 2);
    let k = 0;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) values[k++] = sims[i * n + j];
    }
    if (values.length === 0) return 1;
    values.sort();
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
 * Average-linkage (UPGMA) agglomerative clustering, roughly O(n²): group
 * similarities are updated by the Lance–Williams rule and each row caches its
 * best neighbour. For 1,400 answers it takes ~1 s on V8 and ~20 s on Hermes,
 * almost all of it the n²·384 similarity matrix; the merge loop is under 1 s.
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

    // Upper triangle holds group-to-group similarity as merges happen; the
    // lower triangle keeps the raw pairs for cohesion.
    const upper = (i: number, j: number) => (i < j ? i * n + j : j * n + i);

    // A group lives on the row of its lowest index, so rows in order are groups
    // in the order the pairwise scan saw them, and ties break the same way.
    const groups: number[][] = items.map((_, i) => [i]);
    const alive: number[] = items.map((_, i) => i);
    const bestJ = new Int32Array(n).fill(-1);
    const bestS = new Float64Array(n).fill(-Infinity);

    const rescan = (pos: number) => {
        const i = alive[pos];
        let score = -Infinity;
        let j = -1;
        for (let q = pos + 1; q < alive.length; q++) {
            const k = alive[q];
            const value = sims[i * n + k];
            if (value > score) {
                score = value;
                j = k;
            }
        }
        bestS[i] = score;
        bestJ[i] = j;
    };
    for (let p = 0; p < n; p++) rescan(p);

    while (alive.length > 1) {
        let best = -Infinity;
        let a = -1;
        for (const i of alive) {
            if (bestS[i] > best) {
                best = bestS[i];
                a = i;
            }
        }

        if (best < threshold) break;
        const b = bestJ[a];

        const sizeA = groups[a].length;
        const sizeB = groups[b].length;
        for (const c of alive) {
            if (c === a || c === b) continue;
            sims[upper(a, c)] =
                (sizeA * sims[upper(a, c)] + sizeB * sims[upper(b, c)]) / (sizeA + sizeB);
        }
        groups[a] = groups[a].concat(groups[b]);
        alive.splice(alive.indexOf(b), 1);

        // Only rows that could see a or b need their best neighbour revisited.
        for (let p = 0; p < alive.length && alive[p] < b; p++) {
            const i = alive[p];
            if (i === a || bestJ[i] === b || bestJ[i] === a) {
                rescan(p);
            } else if (i < a) {
                const value = sims[i * n + a];
                if (value > bestS[i] || (value === bestS[i] && a < bestJ[i])) {
                    bestS[i] = value;
                    bestJ[i] = a;
                }
            }
        }
    }

    const clusters: Cluster<T>[] = [];

    for (const root of alive) {
        const group = groups[root];
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
                const x = group[i];
                const y = group[j];
                total += x > y ? sims[x * n + y] : sims[y * n + x];
                pairs += 1;
            }
        }

        clusters.push({ members, cohesion: pairs ? total / pairs : 0, entryCount });
    }

    clusters.sort((a, b) => b.entryCount - a.entryCount || b.cohesion - a.cohesion);
    return clusters;
}

/**
 * The members that best represent a cluster, most central first — a few lines
 * under an unnamed theme, so the person has something concrete to react to.
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
