// src/data/bibleBooks.ts

export interface BibleBook {
    name: string;
    abbrv: string
    chapters: number;
}

export const HEBREW_BOOKS: BibleBook[] = [
    { name: 'Genesis', abbrv: 'Gen', chapters: 50 },
    { name: 'Exodus', abbrv: 'Exod', chapters: 40 },
    { name: 'Leviticus', abbrv: 'Lev', chapters: 27 },
    { name: 'Numbers', abbrv: 'Num', chapters: 36 },
    { name: 'Deuteronomy', abbrv: 'Deut', chapters: 34 },
    { name: 'Joshua', abbrv: 'Josh', chapters: 24 },
    { name: 'Judges', abbrv: 'Judg', chapters: 21 },
    { name: 'Ruth', abbrv: 'Ruth', chapters: 4 },
    { name: '1 Samuel', abbrv: '1Sam', chapters: 31 },
    { name: '2 Samuel', abbrv: '2Sam', chapters: 24 },
    { name: '1 Kings', abbrv: '1Ki', chapters: 22 },
    { name: '2 Kings', abbrv: '2Ki', chapters: 25 },
    { name: '1 Chronicles', abbrv: '1Chr', chapters: 29 },
    { name: '2 Chronicles', abbrv: '2Chr', chapters: 36 },
    { name: 'Ezra', abbrv: 'Ezra', chapters: 10 },
    { name: 'Nehemiah', abbrv: 'Neh', chapters: 13 },
    { name: 'Esther', abbrv: 'Esth', chapters: 10 },
    { name: 'Job', abbrv: 'Job', chapters: 42 },
    { name: 'Psalms', abbrv: 'Ps', chapters: 150 },
    { name: 'Proverbs', abbrv: 'Prov', chapters: 31 },
    { name: 'Ecclesiastes', abbrv: 'Eccl', chapters: 12 },
    { name: 'Song of Solomon', abbrv: 'Song', chapters: 8 },
    { name: 'Isaiah', abbrv: 'Isa', chapters: 66 },
    { name: 'Jeremiah', abbrv: 'Jer', chapters: 52 },
    { name: 'Lamentations', abbrv: 'Lam', chapters: 5 },
    { name: 'Ezekiel', abbrv: 'Ezek', chapters: 48 },
    { name: 'Daniel', abbrv: 'Dan', chapters: 12 },
    { name: 'Hosea', abbrv: 'Hos', chapters: 14 },
    { name: 'Joel', abbrv: 'Joel', chapters: 3 },
    { name: 'Amos', abbrv: 'Amos', chapters: 9 },
    { name: 'Obadiah', abbrv: 'Obad', chapters: 1 },
    { name: 'Jonah', abbrv: 'Jonah', chapters: 4 },
    { name: 'Micah', abbrv: 'Mic', chapters: 7 },
    { name: 'Nahum', abbrv: 'Nah', chapters: 3 },
    { name: 'Habakkuk', abbrv: 'Hab', chapters: 3 },
    { name: 'Zephaniah', abbrv: 'Zeph', chapters: 3 },
    { name: 'Haggai', abbrv: 'Hag', chapters: 2 },
    { name: 'Zechariah', abbrv: 'Zech', chapters: 14 },
    { name: 'Malachi', abbrv: 'Mal', chapters: 4 },
];

export const GREEK_BOOKS: BibleBook[] = [
    { name: 'Matthew', abbrv: 'Matt', chapters: 28 },
    { name: 'Mark', abbrv: 'Mark', chapters: 16 },
    { name: 'Luke', abbrv: 'Luke', chapters: 24 },
    { name: 'John', abbrv: 'John', chapters: 21 },
    { name: 'Acts', abbrv: 'Acts', chapters: 28 },
    { name: 'Romans', abbrv: 'Rom', chapters: 16 },
    { name: '1 Corinthians', abbrv: '1Cor', chapters: 16 },
    { name: '2 Corinthians', abbrv: '2Cor', chapters: 13 },
    { name: 'Galatians', abbrv: 'Gal', chapters: 6 },
    { name: 'Ephesians', abbrv: 'Eph', chapters: 6 },
    { name: 'Philippians', abbrv: 'Phil', chapters: 4 },
    { name: 'Colossians', abbrv: 'Col', chapters: 4 },
    { name: '1 Thessalonians', abbrv: '1Thess', chapters: 5 },
    { name: '2 Thessalonians', abbrv: '2Thess', chapters: 3 },
    { name: '1 Timothy', abbrv: '1Tim', chapters: 6 },
    { name: '2 Timothy', abbrv: '2Tim', chapters: 4 },
    { name: 'Titus', abbrv: 'Titus', chapters: 3 },
    { name: 'Philemon', abbrv: 'Phlm', chapters: 1 },
    { name: 'Hebrews', abbrv: 'Heb', chapters: 13 },
    { name: 'James', abbrv: 'Jas', chapters: 5 },
    { name: '1 Peter', abbrv: '1Pet', chapters: 5 },
    { name: '2 Peter', abbrv: '2Pet', chapters: 3 },
    { name: '1 John', abbrv: '1John', chapters: 5 },
    { name: '2 John', abbrv: '2John', chapters: 1 },
    { name: '3 John', abbrv: '3John', chapters: 1 },
    { name: 'Jude', abbrv: 'Jude', chapters: 1 },
    { name: 'Revelation', abbrv: 'Rev', chapters: 22 },
];

export const ALL_BIBLE_BOOKS: BibleBook[] = [
    ...HEBREW_BOOKS, ...GREEK_BOOKS
];

// Helper functions
export const getBookByName = (name: string): BibleBook | undefined => {
    return ALL_BIBLE_BOOKS.find(book => book.name === name);
};

export const getBookChapterCount = (bookName: string): number => {
    const book = getBookByName(bookName);
    return book ? book.chapters : 0;
};

// Generate array of chapter numbers for a book
export const getChapterNumbers = (bookName: string): number[] => {
    const chapterCount = getBookChapterCount(bookName);
    return Array.from({ length: chapterCount }, (_, i) => i + 1);
};
