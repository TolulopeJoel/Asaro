/**
 * On-device sentence embeddings — the engine behind Themes.
 *
 * Runs bge-small-en-v1.5 (quantized, ~34MB) through ONNX Runtime. Nothing is
 * sent anywhere: a person's reflections never leave the phone, which is the
 * whole reason this is local rather than an API call.
 *
 * It replaced all-MiniLM-L6-v2, which scored around 42 on MTEB's clustering
 * task against this model's ~47-49. Clustering is the only score that matters
 * here — Themes groups writing, it never retrieves against a query — and the
 * swap was close to free: same BERT vocabulary (the bundled vocab.json maps
 * all 30,522 tokens to identical ids, so wordpiece.ts is untouched), same 384
 * dimensions, so nothing about how vectors are stored had to change. The one
 * real difference is pooling, below.
 *
 * The model is downloaded on first use rather than bundled, so the install
 * stays small and people who never open Themes never pay for it.
 *
 * The maths here mirrors scripts/thought-echoes/echoes.py exactly — same model
 * file, same CLS pooling, same normalisation — so the Python experiments are
 * a valid reference for what this produces. Change one, change the other, or
 * the harness stops predicting what the app will do.
 */

import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import {
    documentDirectory,
    getInfoAsync,
    makeDirectoryAsync,
    createDownloadResumable,
    deleteAsync,
    moveAsync,
    readDirectoryAsync,
} from 'expo-file-system/legacy';

import { WordPieceTokenizer } from './wordpiece';

const MODEL_URL =
    'https://huggingface.co/Xenova/bge-small-en-v1.5/resolve/main/onnx/model_quantized.onnx';

const MODEL_DIR = `${documentDirectory}models/`;
const MODEL_PATH = `${MODEL_DIR}bge-small-en-v1.5-quantized.onnx`;
/**
 * Where bytes land while they are still arriving.
 *
 * The download writes here and is renamed onto MODEL_PATH only once it has
 * completed, so a file at MODEL_PATH always means a whole file. Downloading
 * straight to MODEL_PATH is what made a broken download indistinguishable
 * from a finished one.
 */
const MODEL_PART_PATH = `${MODEL_PATH}.part`;

/** The model's output width. Vectors are stored at this size. */
export const EMBEDDING_DIMS = 384;

/**
 * Answers longer than this are truncated. 256 tokens is roughly 180 words,
 * which covers all but the longest journal entries, and the cost of attention
 * grows quadratically so raising it is not free.
 */
const MAX_TOKENS = 256;

/** Batch size chosen to keep peak memory modest on low-end Android. */
const BATCH_SIZE = 8;

export type DownloadProgress = (fraction: number) => void;

let session: InferenceSession | null = null;
let tokenizer: WordPieceTokenizer | null = null;
let loading: Promise<void> | null = null;

export async function isModelDownloaded(): Promise<boolean> {
    const info = await getInfoAsync(MODEL_PATH);
    return info.exists && (info.size ?? 0) > 1_000_000;
}

/**
 * Fetch the model if it isn't cached. Safe to call repeatedly.
 *
 * Interrupting this — losing signal, turning the radio off, backgrounding the
 * app — used to poison the install permanently. The download wrote straight to
 * MODEL_PATH as bytes arrived, and `isModelDownloaded` only asks whether that
 * file is over 1MB, against a model of ~34MB. A download cut off anywhere past
 * the first megabyte therefore left a file that every later call read as
 * "already downloaded": `downloadModel` returned without fetching a byte,
 * `InferenceSession.create` choked on the truncated ONNX, and the same error
 * came back no matter how many times you retried or how good the connection
 * was, because nothing ever went back for the rest of the file.
 *
 * Two things stop that. Bytes land on MODEL_PART_PATH and are renamed onto
 * MODEL_PATH only after the transfer is verified complete, so a file at
 * MODEL_PATH always means a whole file rather than however much arrived. And
 * completeness is judged against the length the server advertised, not a
 * 1MB floor that a partial file clears trivially.
 */
export async function downloadModel(onProgress?: DownloadProgress): Promise<void> {
    if (await isModelDownloaded()) return;

    const dir = await getInfoAsync(MODEL_DIR);
    if (!dir.exists) await makeDirectoryAsync(MODEL_DIR, { intermediates: true });

    // Whatever a previous attempt left behind is of no use: resuming is not
    // wired up, so this restarts from zero regardless.
    await deleteAsync(MODEL_PART_PATH, { idempotent: true });

    /** What the server said the body would be, as reported by the last progress tick. */
    let expectedBytes = 0;

    try {
        const download = createDownloadResumable(MODEL_URL, MODEL_PART_PATH, {}, progress => {
            if (progress.totalBytesExpectedToWrite > 0) {
                expectedBytes = progress.totalBytesExpectedToWrite;
            }
            if (!onProgress || !progress.totalBytesExpectedToWrite) return;
            onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
        });

        await download.downloadAsync();

        /*
         * `downloadAsync` resolving is not proof of a complete body — a
         * connection dropped mid-transfer can settle it with only part of the
         * file written — so check the bytes on disk against the advertised
         * length before trusting it.
         */
        const part = await getInfoAsync(MODEL_PART_PATH);
        const written = part.exists ? (part.size ?? 0) : 0;
        const short = expectedBytes > 0 ? written < expectedBytes : written < 1_000_000;
        if (short) throw new Error('Model download did not complete');

        await moveAsync({ from: MODEL_PART_PATH, to: MODEL_PATH });
        await deleteSupersededModels();
    } catch (error) {
        await deleteAsync(MODEL_PART_PATH, { idempotent: true });
        throw error;
    }
}

/**
 * Remove model files left by a previous version of the app.
 *
 * Changing MODEL_URL changes MODEL_PATH with it, so the file the old build
 * downloaded is simply never opened again — it just sits in the documents
 * directory taking up its full size for the life of the install. Anyone
 * upgrading from all-MiniLM-L6-v2 would be carrying 23MB of it. Swept by
 * listing the directory rather than by naming the old file, so the next swap
 * cleans up after itself without anyone remembering to add a case here.
 *
 * Best-effort: a model that downloaded fine should not fail because tidying
 * up afterwards did.
 */
async function deleteSupersededModels(): Promise<void> {
    try {
        const keep = [MODEL_PATH, MODEL_PART_PATH].map(path => path.split('/').pop());
        for (const name of await readDirectoryAsync(MODEL_DIR)) {
            if (!name.endsWith('.onnx') || keep.includes(name)) continue;
            await deleteAsync(`${MODEL_DIR}${name}`, { idempotent: true });
        }
    } catch {
        // Nothing here is worth surfacing to a reader.
    }
}

/** Load the session and vocabulary. Concurrent callers share one load. */
export async function ensureReady(onProgress?: DownloadProgress): Promise<void> {
    if (session && tokenizer) return;
    if (loading) return loading;

    loading = (async () => {
        await downloadModel(onProgress);

        // Required lazily: the vocabulary is ~500KB of JSON and there is no
        // reason to parse it during app startup.
        const vocab = require('../../assets/models/vocab.json') as Record<string, number>;
        tokenizer = new WordPieceTokenizer(vocab);

        try {
            session = await InferenceSession.create(MODEL_PATH);
        } catch (error) {
            /*
             * The file is on disk and passed for downloaded, and ONNX still
             * can't read it — so it is damaged, and no retry that trusts it
             * will ever get further than this line. Throwing it away is what
             * turns the next attempt into a real download instead of another
             * identical failure: downloads predating the .part handling above
             * (and anything truncated by a full disk or a half-written file)
             * heal here rather than stranding Themes for good.
             */
            tokenizer = null;
            await deleteAsync(MODEL_PATH, { idempotent: true });
            throw error;
        }
    })();

    try {
        await loading;
    } finally {
        loading = null;
    }
}

/** Free the session. Worth calling when Themes closes — it holds real memory. */
export function unload(): void {
    session = null;
    tokenizer = null;
}

/**
 * Embed texts into unit-length vectors.
 *
 * Takes the [CLS] vector and L2-normalises it, which is what
 * sentence-transformers does for this model and what makes a dot product a
 * cosine similarity.
 *
 * CLS, not mean. bge-small-en-v1.5 ships `pooling_mode_cls_token: true` and
 * was trained with its sentence meaning gathered into that one position;
 * mean-pooling it — correct for the MiniLM this replaced — produces vectors
 * that still look plausible, still normalise, still cluster into *something*,
 * and are quietly wrong. There is no error to catch, so the rule is simply
 * that pooling belongs to the model: read it off the model's own
 * 1_Pooling/config.json rather than inheriting whatever the last one used.
 */
export async function embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    await ensureReady();
    if (!session || !tokenizer) throw new Error('Embedder failed to initialise');

    const out: Float32Array[] = [];

    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
        const batch = texts.slice(start, start + BATCH_SIZE);
        const encoded = tokenizer.encodeBatch(batch, MAX_TOKENS);
        const rows = encoded.length;
        const width = encoded[0].ids.length;

        const ids = BigInt64Array.from(encoded.flatMap(e => e.ids.map(BigInt)));
        const mask = BigInt64Array.from(encoded.flatMap(e => e.attentionMask.map(BigInt)));

        const feeds: Record<string, Tensor> = {
            input_ids: new Tensor('int64', ids, [rows, width]),
            attention_mask: new Tensor('int64', mask, [rows, width]),
        };
        // Some exports of this model omit token_type_ids; only send it if the
        // graph declares it, or the run is rejected.
        if (session.inputNames.includes('token_type_ids')) {
            feeds.token_type_ids = new Tensor(
                'int64',
                new BigInt64Array(rows * width),
                [rows, width],
            );
        }

        const results = await session.run(feeds);

        /*
         * By name where the export provides it. Picking outputNames[0] blind
         * is fine until a build happens to put `pooler_output` first — that is
         * a [batch, 384] tensor, so reading position 0 of a sequence that
         * isn't there would hand back a plausible-looking wrong answer rather
         * than failing. The dimension check below is the backstop.
         */
        const outputName = session.outputNames.includes('last_hidden_state')
            ? 'last_hidden_state'
            : session.outputNames[0];
        const output = results[outputName];

        if (output.dims.length !== 3 || output.dims[2] !== EMBEDDING_DIMS) {
            throw new Error(
                `Expected [batch, tokens, ${EMBEDDING_DIMS}] from '${outputName}', got [${output.dims.join(', ')}]`,
            );
        }

        const hidden = output.data as Float32Array;

        for (let r = 0; r < rows; r++) {
            const pooled = new Float32Array(EMBEDDING_DIMS);

            // [CLS] is always token 0 — see WordPieceTokenizer.encode.
            const offset = r * width * EMBEDDING_DIMS;
            let norm = 0;
            for (let d = 0; d < EMBEDDING_DIMS; d++) {
                pooled[d] = hidden[offset + d];
                norm += pooled[d] * pooled[d];
            }
            norm = Math.sqrt(norm) || 1e-9;
            for (let d = 0; d < EMBEDDING_DIMS; d++) pooled[d] /= norm;

            out.push(pooled);
        }
    }

    return out;
}

// ─── storage helpers ──────────────────────────────────────────────────────────

/** Pack a vector for a SQLite BLOB column. */
export function vectorToBytes(vector: Float32Array): Uint8Array {
    return new Uint8Array(vector.buffer.slice(0));
}

/** Unpack a vector stored by {@link vectorToBytes}. */
export function bytesToVector(bytes: Uint8Array): Float32Array {
    // The stored buffer may be a view into a larger one, so copy before casting.
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return new Float32Array(copy.buffer);
}
