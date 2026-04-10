import { Linking } from 'react-native';
import { ALL_BIBLE_BOOKS } from '../data/bibleBooks';

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
 * Opens a Bible reference from a string (e.g. "John 3:16" or "Gen 1:1-3").
 */
export const openBibleReferenceFromTag = async (refString: string) => {
    // Basic parsing: "Book Chapter:Verse-Verse" or "Book Chapter:Verse" or "Book Chapter"
    // This is much simpler because we know the string is a valid reference from the picker
    const match = refString.match(/^(.+?)\s+(\d+)(?::(\d+[a-z]?))?(?:\s*[-–]\s*(?:(\d+):)?(\d+[a-z]?))?$/i);

    if (!match) {
        // Fallback for very simple cases or if parsing fails
        const spaceIndex = refString.lastIndexOf(' ');
        if (spaceIndex > 0) {
            const bookName = refString.substring(0, spaceIndex);
            await openBibleReference(bookName);
        }
        return;
    }

    const [_, bookName, c1, v1, c2, v2] = match;

    const chapter1 = parseInt(c1, 10);
    const verse1 = v1 ? parseInt(v1, 10) : undefined;

    let chapter2 = c2 ? parseInt(c2, 10) : (v2 ? chapter1 : undefined);
    let verse2Val = v2 ? parseInt(v2, 10) : undefined;

    await openBibleReference(bookName, chapter1, verse1, chapter2, verse2Val);
};

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
