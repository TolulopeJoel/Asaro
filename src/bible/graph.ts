/**
 * The Bible's cross-reference graph, in memory.
 *
 * ~341,000 references from the Treasury of Scripture Knowledge, compiled by
 * scripts/build-bible-graph.mjs into a packed CSR structure and bundled with
 * the app. Source data is CC BY openbible.info.
 *
 * This is the one piece of knowledge in Àṣàrò that the reader does not
 * already have. Everything else the app knows, it learned from them — what
 * they wrote, when, about which chapter. The graph knows which passages
 * illuminate each other, which nobody holds in their head, and that is what
 * lets a detector say something true that its reader could not have worked
 * out. It costs 3MB and no model, which is why it is the tier that reaches
 * every device rather than the tier that needs 6GB of RAM.
 *
 * Nothing here holds scripture text. The graph is verse ids and edges; the
 * words stay on jw.org, in the reader's own translation.
 *
 * Layout, all little-endian:
 *
 *   magic u32 · version u32 · verseCount u32 (V) · edgeCount u32 (E)
 *   verses  u32[V]      sorted verse ids — the ordinal space
 *   offsets u32[V + 1]  adjacency start per ordinal
 *   targets u32[E]      neighbour ORDINALS, sorted within each list
 *   weights u8[E]       vote counts, clamped to a byte
 *
 * Neighbours are stored as ordinals rather than verse ids so a traversal
 * never has to search: scoring walks ordinals and only converts back to ids
 * when it has an answer to show someone.
 */

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import { VerseId, chapterSpanBounds } from './ref';

const MAGIC = 0x46525841; // "AXRF"
const FORMAT_VERSION = 1;
const HEADER_BYTES = 16;

export interface BibleGraph {
    readonly verseCount: number;
    readonly edgeCount: number;

    /** Ordinal for a verse id, or -1 when the graph has no edges for it. */
    ordinalOf(id: VerseId): number;
    verseAt(ordinal: number): VerseId;

    /** How many references touch this verse. Used to discount famous passages. */
    degree(ordinal: number): number;

    /** Neighbour ordinals for one verse. A view, not a copy — do not mutate. */
    neighbours(ordinal: number): Uint32Array;
    /** Vote weights, index-aligned with `neighbours`. */
    weights(ordinal: number): Uint8Array;

    /**
     * Ordinals for every verse the graph knows about in a chapter span.
     *
     * The journal records chapters, not verses, so this is how "what they
     * read" becomes "what the graph can reason about".
     */
    ordinalsInChapters(bookName: string, chapterStart: number, chapterEnd?: number): number[];

    /** Ordinals for every verse the graph knows between two ids, inclusive. */
    ordinalsBetween(lo: VerseId, hi: VerseId): number[];
}

class PackedGraph implements BibleGraph {
    private readonly verses: Uint32Array;
    private readonly offsets: Uint32Array;
    private readonly targets: Uint32Array;
    private readonly voteWeights: Uint8Array;

    constructor(bytes: Uint8Array) {
        /*
         * Copied into a fresh buffer rather than viewed in place. A Uint8Array
         * handed back by the file layer carries no alignment guarantee, and a
         * Uint32Array view onto an odd byteOffset throws — on some devices and
         * not others, which is the worst kind of bug to find later.
         */
        const aligned = new Uint8Array(bytes.length);
        aligned.set(bytes);
        const view = new DataView(aligned.buffer);

        const magic = view.getUint32(0, true);
        if (magic !== MAGIC) {
            throw new Error('xrefs.bin is not a cross-reference graph');
        }

        const version = view.getUint32(4, true);
        if (version !== FORMAT_VERSION) {
            throw new Error(
                `xrefs.bin is format v${version}, this build reads v${FORMAT_VERSION}. Rebuild the asset.`,
            );
        }

        const verseCount = view.getUint32(8, true);
        const edgeCount = view.getUint32(12, true);

        let at = HEADER_BYTES;
        this.verses = new Uint32Array(aligned.buffer, at, verseCount);
        at += verseCount * 4;
        this.offsets = new Uint32Array(aligned.buffer, at, verseCount + 1);
        at += (verseCount + 1) * 4;
        this.targets = new Uint32Array(aligned.buffer, at, edgeCount);
        at += edgeCount * 4;
        this.voteWeights = new Uint8Array(aligned.buffer, at, edgeCount);
    }

    get verseCount(): number {
        return this.verses.length;
    }

    get edgeCount(): number {
        return this.targets.length;
    }

    ordinalOf(id: VerseId): number {
        let low = 0;
        let high = this.verses.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const value = this.verses[mid];
            if (value === id) return mid;
            if (value < id) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }

    verseAt(ordinal: number): VerseId {
        return this.verses[ordinal];
    }

    degree(ordinal: number): number {
        return this.offsets[ordinal + 1] - this.offsets[ordinal];
    }

    neighbours(ordinal: number): Uint32Array {
        return this.targets.subarray(this.offsets[ordinal], this.offsets[ordinal + 1]);
    }

    weights(ordinal: number): Uint8Array {
        return this.voteWeights.subarray(this.offsets[ordinal], this.offsets[ordinal + 1]);
    }

    /** First index whose verse id is >= `id`. */
    private lowerBound(id: VerseId): number {
        let low = 0;
        let high = this.verses.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (this.verses[mid] < id) low = mid + 1;
            else high = mid;
        }
        return low;
    }

    ordinalsBetween(lo: VerseId, hi: VerseId): number[] {
        const out: number[] = [];
        for (let i = this.lowerBound(lo); i < this.verses.length && this.verses[i] <= hi; i++) {
            out.push(i);
        }
        return out;
    }

    ordinalsInChapters(bookName: string, chapterStart: number, chapterEnd?: number): number[] {
        const bounds = chapterSpanBounds(bookName, chapterStart, chapterEnd);
        if (!bounds) return [];
        return this.ordinalsBetween(bounds[0], bounds[1]);
    }
}

/**
 * Decode the packed asset.
 *
 * Separate from `loadGraph` so the verifier exercises this exact code against
 * the exact bytes that ship, rather than a second decoder written to agree
 * with it. Two decoders drift; one gets tested.
 */
export function decodeGraph(bytes: Uint8Array): BibleGraph {
    return new PackedGraph(bytes);
}

let loaded: BibleGraph | null = null;
let loading: Promise<BibleGraph> | null = null;

/**
 * Load the graph, once per session.
 *
 * Concurrent callers share one promise rather than each decoding 3MB — the
 * detectors all want it at the same moment, right after the journal loads.
 */
export async function loadGraph(): Promise<BibleGraph> {
    if (loaded) return loaded;
    if (loading) return loading;

    loading = (async () => {
        /*
         * `require` rather than an import: Metro resolves bundled assets
         * through the module registry, and `Asset.fromModule` takes that
         * registry handle. An ESM import of a .bin has no such handle, so
         * this is the supported form rather than a leftover.
         */
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const asset = Asset.fromModule(require('../../assets/bible/xrefs.bin'));
        await asset.downloadAsync();

        const uri = asset.localUri ?? asset.uri;
        const bytes = await new File(uri).bytes();

        loaded = decodeGraph(bytes);
        return loaded;
    })();

    try {
        return await loading;
    } finally {
        loading = null;
    }
}

/** Drop the graph. Mirrors `embedder.unload()` — don't hold 3MB behind a closed tab. */
export function unloadGraph(): void {
    loaded = null;
}
