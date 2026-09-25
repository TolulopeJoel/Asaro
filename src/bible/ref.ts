/**
 * Verse identity: one number that names any verse in the Bible.
 *
 * `BBCCCVVV` is the addressing the app already speaks — `openBibleReference`
 * builds exactly this for jw.org. This promotes it from a string built at the
 * edge to a number used throughout, so the graph, the detectors and the deep
 * links cannot drift apart.
 *
 * Numeric rather than padded string because the graph sorts, binary-searches
 * and range-scans millions of these. The largest id is Revelation 22:21 →
 * 66_022_021, inside a Uint32 and an exact JS integer.
 *
 * Book numbers are 1-based indexes into `ALL_BIBLE_BOOKS`, the same basis
 * `openBibleReference` uses. A deliberate coupling: the day the two disagree,
 * every deep link opens the wrong passage. `verify-bible-graph.mjs` pins it.
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
 * Book number for a book's full name, or 0 if it isn't one. Zero rather than
 * undefined so callers compare without a null check and still produce an id
 * matching nothing, which is the safe failure.
 */
export function bookNumberFromName(name: string): number {
    return ALL_BIBLE_BOOKS.findIndex(book => book.name === name) + 1;
}

export function bookNameFromNumber(bookNumber: number): string {
    return ALL_BIBLE_BOOKS[bookNumber - 1]?.name ?? '';
}

/**
 * Inclusive id bounds covering every verse of one chapter. Scanning this range
 * over the sorted verse table turns "the chapter they read" into "the verses
 * the graph knows about in it", with no per-chapter verse-count table to ship.
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

/** A citation as the writer made it: one verse, or the span they pointed at. */
export interface CitedRange {
    start: VerseId;
    end: VerseId;
}

/**
 * Parse the `[[...]]` citations the writer left in their own answers.
 *
 * Deliberately narrower than a general reference parser — these come from the
 * app's own picker, so the shape is known, and anything that does not match is
 * DROPPED rather than guessed at. A misparsed citation would put a verse the
 * reader never chose into the evidence for a claim about them.
 *
 * Returns the whole SPAN, not its first verse. Keeping only the head destroys
 * the signal: `Jeremiah 10:1-16` means the passage about idols, while verse 1
 * is an opener that connects to nothing.
 */
export function parseReference(text: string): CitedRange | null {
    // The trailing letter in "Exodus 20:5a" must stay supported:
    // `openBibleReferenceFromTag` accepts it, so a stricter pattern here drops
    // those citations SILENTLY from the one channel recording what the reader
    // chose rather than what the plan assigned.
    const match = text
        .trim()
        .match(/^(.+?)\s+(\d+)(?::(\d+)[a-z]?)?(?:\s*[-–]\s*(?:(\d+):)?(\d+)[a-z]?)?$/i);
    if (!match) return null;

    const book = bookNumberFromName(match[1].trim());
    if (book === 0) return null;

    const chapter = Number(match[2]);
    if (!Number.isFinite(chapter) || chapter < 1) return null;

    const verse = match[3] ? Number(match[3]) : undefined;
    const tailChapter = match[4] ? Number(match[4]) : undefined;
    const tail = match[5] ? Number(match[5]) : undefined;

    // With no verse, a trailing number is a CHAPTER: "Genesis 12-15" is four
    // chapters, not verses 12 to 15.
    if (verse === undefined) {
        return {
            start: verseId(book, chapter, 0),
            end: verseId(book, tail ?? chapter, 999),
        };
    }

    if (tail === undefined) {
        const only = verseId(book, chapter, verse);
        return { start: only, end: only };
    }

    return {
        start: verseId(book, chapter, verse),
        end: verseId(book, tailChapter ?? chapter, tail),
    };
}

/** Every `[[...]]` citation in a block of answer text, in order, deduped. */
export function citationsIn(text: string): CitedRange[] {
    const found: CitedRange[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(/\[\[(.+?)\]\]/g)) {
        const range = parseReference(match[1]);
        if (!range) continue;
        const key = `${range.start}:${range.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(range);
    }

    return found;
}
