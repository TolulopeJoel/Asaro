/**
 * Verse identity: one number that names any verse in the Bible.
 *
 * `BBCCCVVV` is not a new invention here — it is already the addressing the
 * app speaks. `openBibleReference` builds exactly this to hand jw.org a
 * passage, book number first, then chapter, then verse, each zero-padded.
 * This module only promotes it from a string built at the edge to a number
 * used throughout, so the cross-reference graph, the detectors and the deep
 * links all key on the same thing and cannot drift apart.
 *
 * Numeric rather than the padded string because the graph needs to sort,
 * binary-search and range-scan millions of these. The largest possible id is
 * Revelation 22:21 → 66_022_021, comfortably inside a Uint32 and inside an
 * exact JS integer, so arrays of them stay typed and cheap.
 *
 * Book numbers are 1-based indexes into `ALL_BIBLE_BOOKS`, which is the same
 * basis `openBibleReference` uses (`findIndex(...) + 1`). That is a real
 * coupling and a deliberate one: the day those two disagree, every deep link
 * in the app silently opens the wrong passage, so they must read from one
 * list. `verify-bible-graph.mjs` pins it.
 */

import { ALL_BIBLE_BOOKS } from '../data/bibleBooks';

/** A verse addressed as BBCCCVVV. Verse 0 means "the whole chapter". */
export type VerseId = number;

const BOOK_SCALE = 1_000_000;
const CHAPTER_SCALE = 1_000;

/** Highest book number, i.e. Revelation. */
export const BOOK_COUNT = ALL_BIBLE_BOOKS.length;

export function verseId(bookNumber: number, chapter: number, verse: number = 0): VerseId {
    return bookNumber * BOOK_SCALE + chapter * CHAPTER_SCALE + verse;
}

export function bookNumberOf(id: VerseId): number {
    return Math.floor(id / BOOK_SCALE);
}

export function chapterOf(id: VerseId): number {
    return Math.floor((id % BOOK_SCALE) / CHAPTER_SCALE);
}

export function verseOf(id: VerseId): number {
    return id % CHAPTER_SCALE;
}

/**
 * Book number for a book's full name, or 0 if it isn't one.
 *
 * Zero rather than undefined so callers can compare without a null check and
 * still produce an id that matches nothing, which is the safe failure here.
 */
export function bookNumberFromName(name: string): number {
    return ALL_BIBLE_BOOKS.findIndex(book => book.name === name) + 1;
}

export function bookNameFromNumber(bookNumber: number): string {
    return ALL_BIBLE_BOOKS[bookNumber - 1]?.name ?? '';
}

/**
 * Inclusive id bounds covering every verse of one chapter.
 *
 * The graph stores verses, but a reader engages with chapters — the journal
 * records `chapter_start`/`chapter_end`, not verses. Scanning this range over
 * the sorted verse table turns "the chapter they read" into "the verses the
 * graph knows about in it" without needing a table of verse counts per
 * chapter, which the app does not have and would otherwise have to ship.
 */
export function chapterBounds(bookNumber: number, chapter: number): [VerseId, VerseId] {
    return [verseId(bookNumber, chapter, 0), verseId(bookNumber, chapter, CHAPTER_SCALE - 1)];
}

/** Ids for a chapter span, as the journal records one (`chapter_end` optional). */
export function chapterSpanBounds(
    bookName: string,
    chapterStart: number,
    chapterEnd?: number,
): [VerseId, VerseId] | null {
    const book = bookNumberFromName(bookName);
    if (book === 0) return null;
    const last = chapterEnd && chapterEnd >= chapterStart ? chapterEnd : chapterStart;
    return [chapterBounds(book, chapterStart)[0], chapterBounds(book, last)[1]];
}

/** "Genesis 12:1", or "Genesis 12" when the id names a whole chapter. */
export function formatVerseId(id: VerseId): string {
    const name = bookNameFromNumber(bookNumberOf(id));
    if (!name) return '';
    const verse = verseOf(id);
    return verse === 0
        ? `${name} ${chapterOf(id)}`
        : `${name} ${chapterOf(id)}:${verse}`;
}

/**
 * Parse the `[[...]]` citations the writer left in their own answers.
 *
 * Deliberately narrower than a general reference parser: these strings come
 * from the app's own reference picker, so the shape is known. Anything that
 * doesn't match is dropped rather than guessed at — a misparsed citation
 * would put a verse the reader never chose into the evidence for a claim
 * about them, which is the one failure this whole feature cannot afford.
 *
 * Returns the first verse of a range. The range's head is what the reader
 * reached for; the tail is how far they kept reading.
 */
export function parseReference(text: string): VerseId | null {
    const match = text
        .trim()
        .match(/^(.+?)\s+(\d+)(?::(\d+))?(?:\s*[-–]\s*(?:\d+:)?\d+)?$/);
    if (!match) return null;

    const book = bookNumberFromName(match[1].trim());
    if (book === 0) return null;

    const chapter = Number(match[2]);
    if (!Number.isFinite(chapter) || chapter < 1) return null;

    return verseId(book, chapter, match[3] ? Number(match[3]) : 0);
}

/** Every `[[...]]` citation in a block of answer text, in order, deduped. */
export function citationsIn(text: string): VerseId[] {
    const found: VerseId[] = [];
    for (const match of text.matchAll(/\[\[(.+?)\]\]/g)) {
        const id = parseReference(match[1]);
        if (id !== null && !found.includes(id)) found.push(id);
    }
    return found;
}
