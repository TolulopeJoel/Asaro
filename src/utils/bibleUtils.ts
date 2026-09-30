import { Linking } from 'react-native';
import { ALL_BIBLE_BOOKS } from '../data/bibleBooks';
import { bookNameFromNumber, bookNumberOf, chapterOf, parseReference, verseOf } from '../bible/ref';

/**
 * Opens a Bible reference on JW.ORG using the finder API.
 * Format: BBCCCVVV-BBCCCVVV
 * BB: Book number (01 to 66)
 * CCC: Chapter number (001 to 150)
 * VVV: Verse number (001 to 999)
 */
export const openBibleReference = async (
    bookName: string,
    chapterStart?: number,
    verseStart?: number | string,
    chapterEnd?: number,
    verseEnd?: number | string
) => {
    const bookIndex = ALL_BIBLE_BOOKS.findIndex(b => b.name === bookName) + 1;
    if (bookIndex === 0) return;

    const pad = (num: number | string | undefined | null, size: number) => {
        if (num === undefined || num === null || num === '') return '000';
        // Strip any non-digit characters (like 'a' or 'b' in the verse)
        const cleanedNum = num.toString().replace(/\D/g, '');
        return cleanedNum.padStart(size, '0');
    };

    const bb = bookIndex.toString().padStart(2, '0');
    const ccc1 = pad(chapterStart, 3);
    const vvv1 = pad(verseStart, 3);

    let url = `https://www.jw.org/finder?srcid=jwlshare&wtlocale=E&prefer=bible&bible=${bb}${ccc1}${vvv1}`;

    if (chapterEnd || verseEnd) {
        const ccc2 = pad(chapterEnd || chapterStart, 3);
        const vvv2 = pad(verseEnd, 3);
        url += `-${bb}${ccc2}${vvv2}`;
    }

    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            console.warn("Cannot open URL:", url);
        }
    } catch (error) {
        console.error("Error opening Bible reference:", error);
    }
};

/**
 * Opens a Bible reference from a string (e.g. "John 3:16", "Genesis 12-15").
 * Parsed by `parseReference`, so a tap opens exactly what the insight graph reads.
 */
export const openBibleReferenceFromTag = async (refString: string) => {
    const range = parseReference(refString);
    if (!range) {
        // A bare book, as a typed `@Gen ` leaves it: open its first chapter.
        const book = resolveBookName(refString.trim().replace(/^@/, ''));
        if (book) await openBibleReference(book, 1);
        return;
    }

    const bookName = bookNameFromNumber(bookNumberOf(range.start));
    const [c1, v1] = [chapterOf(range.start), verseOf(range.start)];
    const [c2, v2] = [chapterOf(range.end), verseOf(range.end)];

    // Verse 0 at the start means whole chapters, the same BBCCC000 form a single chapter uses.
    if (v1 === 0) {
        await openBibleReference(bookName, c1, undefined, c2 !== c1 ? c2 : undefined);
    } else if (range.end === range.start) {
        await openBibleReference(bookName, c1, v1);
    } else {
        await openBibleReference(bookName, c1, v1, c2, v2);
    }
};

/** Collapse "1 John" to "1john", so typed and abbreviated forms compare equal. */
const bookKey = (text: string) => text.toLowerCase().replace(/\s+/g, '');

/** The full book name for a typed name or abbreviation ("gen", "1 John", "Song"), or null. */
export const resolveBookName = (typed: string): string | null => {
    const key = bookKey(typed);
    if (!key) return null;
    const book = ALL_BIBLE_BOOKS.find(b => bookKey(b.name) === key || bookKey(b.abbrv) === key);
    return book ? book.name : null;
};

/** Whether more typing could still make this a book name ("1 ", "Song o"). */
export const couldBeBookName = (typed: string): boolean => {
    const q = typed.toLowerCase().replace(/\s+/g, ' ').trimStart();
    return !!q && ALL_BIBLE_BOOKS.some(b => b.name.toLowerCase().startsWith(q));
};

/**
 * A reference typed after `@`, in canonical form ("gen 3" → "Genesis 3"), or
 * null if its book isn't one. A trailing ":" or "-" left by the picker's preview is dropped.
 */
export const resolveTypedReference = (typed: string): string | null => {
    const text = typed.trim().replace(/\s*[:\-–]$/, '');
    const match = text.match(/^(.+?)(?:\s+(\d+(?::\d+[a-z]?)?(?:\s*[-–]\s*(?:\d+:)?\d+[a-z]?)?))?$/i);
    if (!match) return null;
    const book = resolveBookName(match[1]);
    if (!book) return null;
    return match[2] ? `${book} ${match[2]}` : book;
};

/**
 * An `@` at the end of the text, not inside a word, and whatever has been typed
 * after it. A bare `@` opens the picker too, so typing it visibly does something.
 */
export const findAtTrigger = (text: string): { startIndex: number; query: string } | null => {
    const match = text.match(/(?:^|[^\w@])@(\w*)$/);
    if (!match) return null;
    return { startIndex: text.length - match[1].length - 1, query: match[1] };
};

/**
 * What has been typed since the `@` at `startIndex`, without the `@`. After a
 * picker preview the `@` is already replaced, so it is stripped only if present.
 */
export const typedSince = (text: string, startIndex: number): string =>
    text.slice(startIndex).replace(/^@/, '');

/** The typed text as the picker's book filter reads it: "1 Jo" → "1Jo", matching "1John". */
export const pickerQuery = (typed: string): string => typed.replace(/^([1-3])\s+/, '$1');

/**
 * Parses text and returns an array of parts (plain text and tagged references).
 * Useful for rendering styled content inside a TextInput.
 */
export const getBibleStyledParts = (text: string) => {
    if (!text) return [];

    const regex = /\[\[(.+?)\]\]/g;
    const result: { text: string; isReference: boolean; refContent?: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add plain text before match
        if (match.index > lastIndex) {
            result.push({
                text: text.substring(lastIndex, match.index),
                isReference: false
            });
        }

        // Add matched Bible reference
        result.push({
            text: match[0],
            isReference: true,
            refContent: match[1]
        });

        lastIndex = regex.lastIndex;
    }

    // Add remaining plain text
    if (lastIndex < text.length) {
        result.push({
            text: text.substring(lastIndex),
            isReference: false
        });
    }

    return result;
};
