/**
 * BERT WordPiece tokenizer — the input half of on-device embeddings.
 *
 * MiniLM expects exactly what bert-base-uncased produces, and Hugging Face's
 * tokenizer is a Rust binary we can't run here, so this reimplements the same
 * pipeline in TS. It is verified byte-for-byte against the real tokenizer's
 * output in scripts/thought-echoes/verify-tokenizer.mjs — if you touch this
 * file, re-run that.
 *
 * Pipeline, in order (matches BertNormalizer + BertPreTokenizer + WordPiece):
 *   clean text → space out CJK → strip accents → lowercase
 *   → split on whitespace → split off punctuation
 *   → greedy longest-match WordPiece with ## continuations
 */

export const CLS_TOKEN = '[CLS]';
export const SEP_TOKEN = '[SEP]';
export const PAD_TOKEN = '[PAD]';
export const UNK_TOKEN = '[UNK]';

/** Words longer than this become [UNK] outright — the same cap HF uses. */
const MAX_CHARS_PER_WORD = 100;

export interface Encoded {
    ids: number[];
    attentionMask: number[];
}

// ─── normalisation ────────────────────────────────────────────────────────────

/** Control characters vanish; every flavour of whitespace becomes a plain space. */
function cleanText(text: string): string {
    let out = '';
    for (const ch of text) {
        const code = ch.codePointAt(0)!;
        if (code === 0 || code === 0xfffd) continue;
        if (ch === '\t' || ch === '\n' || ch === '\r') {
            out += ' ';
            continue;
        }
        // Cc and Cf, minus the whitespace handled above.
        if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
        if (/\p{Cf}/u.test(ch)) continue;
        out += ch;
    }
    return out;
}

function isCJK(code: number): boolean {
    return (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0x20000 && code <= 0x2a6df) ||
        (code >= 0x2a700 && code <= 0x2b73f) ||
        (code >= 0x2b740 && code <= 0x2b81f) ||
        (code >= 0x2b820 && code <= 0x2ceaf) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0x2f800 && code <= 0x2fa1f)
    );
}

/** Each CJK character is its own token, so pad them with spaces. */
function spaceCJK(text: string): string {
    let out = '';
    for (const ch of text) {
        const code = ch.codePointAt(0)!;
        out += isCJK(code) ? ` ${ch} ` : ch;
    }
    return out;
}

/**
 * Decompose then drop combining marks: "café" → "cafe".
 *
 * The model's config leaves strip_accents unset, which in BertNormalizer means
 * "follow lowercase" — and lowercase is on, so accents do get stripped.
 */
function stripAccents(text: string): string {
    return text.normalize('NFD').replace(/\p{M}/gu, '');
}

function isPunctuation(ch: string): boolean {
    const code = ch.codePointAt(0)!;
    // BERT treats all ASCII non-alphanumerics as punctuation, not just the
    // Unicode P categories.
    if (
        (code >= 33 && code <= 47) ||
        (code >= 58 && code <= 64) ||
        (code >= 91 && code <= 96) ||
        (code >= 123 && code <= 126)
    ) {
        return true;
    }
    return /\p{P}|\p{S}/u.test(ch) && !/\p{L}|\p{N}/u.test(ch);
}

/** Whitespace split, then break punctuation out into standalone pieces. */
function preTokenize(text: string): string[] {
    const pieces: string[] = [];
    for (const chunk of text.split(/\s+/)) {
        if (!chunk) continue;
        let current = '';
        for (const ch of chunk) {
            if (isPunctuation(ch)) {
                if (current) {
                    pieces.push(current);
                    current = '';
                }
                pieces.push(ch);
            } else {
                current += ch;
            }
        }
        if (current) pieces.push(current);
    }
    return pieces;
}

// ─── the tokenizer ────────────────────────────────────────────────────────────

export class WordPieceTokenizer {
    private vocab: Record<string, number>;
    readonly clsId: number;
    readonly sepId: number;
    readonly padId: number;
    readonly unkId: number;

    constructor(vocab: Record<string, number>) {
        this.vocab = vocab;
        this.clsId = vocab[CLS_TOKEN];
        this.sepId = vocab[SEP_TOKEN];
        this.padId = vocab[PAD_TOKEN];
        this.unkId = vocab[UNK_TOKEN];

        if ([this.clsId, this.sepId, this.padId, this.unkId].some(id => id === undefined)) {
            throw new Error('vocab is missing one of [CLS] [SEP] [PAD] [UNK]');
        }
    }

    /** Greedy longest-match-first over one whitespace-free piece. */
    private wordPiece(word: string): number[] {
        if (word.length > MAX_CHARS_PER_WORD) return [this.unkId];

        const out: number[] = [];
        let start = 0;

        while (start < word.length) {
            let end = word.length;
            let matched: number | undefined;

            while (start < end) {
                const candidate = start === 0 ? word.slice(start, end) : `##${word.slice(start, end)}`;
                const id = this.vocab[candidate];
                if (id !== undefined) {
                    matched = id;
                    break;
                }
                end -= 1;
            }

            // One unmatchable span makes the whole word unknown, as in BERT —
            // not just the offending piece.
            if (matched === undefined) return [this.unkId];

            out.push(matched);
            start = end;
        }

        return out;
    }

    /** Token ids for one string, wrapped in [CLS] … [SEP]. */
    encode(text: string, maxLength = 256): number[] {
        const normalized = stripAccents(spaceCJK(cleanText(text))).toLowerCase();

        const ids: number[] = [this.clsId];
        for (const piece of preTokenize(normalized)) {
            for (const id of this.wordPiece(piece)) {
                // Leave room for the closing [SEP].
                if (ids.length >= maxLength - 1) break;
                ids.push(id);
            }
            if (ids.length >= maxLength - 1) break;
        }
        ids.push(this.sepId);

        return ids;
    }

    /** Encode a batch, padded to the longest member, with attention masks. */
    encodeBatch(texts: string[], maxLength = 256): Encoded[] {
        const encoded = texts.map(t => this.encode(t, maxLength));
        const width = Math.max(1, ...encoded.map(e => e.length));

        return encoded.map(ids => {
            const padding = width - ids.length;
            return {
                ids: [...ids, ...Array(padding).fill(this.padId)],
                attentionMask: [...Array(ids.length).fill(1), ...Array(padding).fill(0)],
            };
        });
    }
}
