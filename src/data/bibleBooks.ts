// src/data/bibleBooks.ts

export interface BibleBook {
    name: string;
    chapters: number;
    testament: 'Old' | 'New';
}

export const OLD_TESTAMENT_BOOKS: BibleBook[] = [
    { name: 'Genesis', chapters: 50, testament: 'Old' },
    { name: 'Exodus', chapters: 40, testament: 'Old' },
    { name: 'Leviticus', chapters: 27, testament: 'Old' },
    { name: 'Numbers', chapters: 36, testament: 'Old' },
    { name: 'Deuteronomy', chapters: 34, testament: 'Old' },
    { name: 'Joshua', chapters: 24, testament: 'Old' },
    { name: 'Judges', chapters: 21, testament: 'Old' },
    { name: 'Ruth', chapters: 4, testament: 'Old' },
    { name: '1 Samuel', chapters: 31, testament: 'Old' },
    { name: '2 Samuel', chapters: 24, testament: 'Old' },
    { name: '1 Kings', chapters: 22, testament: 'Old' },
    { name: '2 Kings', chapters: 25, testament: 'Old' },
    { name: '1 Chronicles', chapters: 29, testament: 'Old' },
    { name: '2 Chronicles', chapters: 36, testament: 'Old' },
    { name: 'Ezra', chapters: 10, testament: 'Old' },
    { name: 'Nehemiah', chapters: 13, testament: 'Old' },
    { name: 'Esther', chapters: 10, testament: 'Old' },
    { name: 'Job', chapters: 42, testament: 'Old' },
    { name: 'Psalms', chapters: 150, testament: 'Old' },
    { name: 'Proverbs', chapters: 31, testament: 'Old' },
    { name: 'Ecclesiastes', chapters: 12, testament: 'Old' },
    { name: 'Song of Solomon', chapters: 8, testament: 'Old' },
    { name: 'Isaiah', chapters: 66, testament: 'Old' },
    { name: 'Jeremiah', chapters: 52, testament: 'Old' },
    { name: 'Lamentations', chapters: 5, testament: 'Old' },
    { name: 'Ezekiel', chapters: 48, testament: 'Old' },
    { name: 'Daniel', chapters: 12, testament: 'Old' },
    { name: 'Hosea', chapters: 14, testament: 'Old' },
    { name: 'Joel', chapters: 3, testament: 'Old' },
    { name: 'Amos', chapters: 9, testament: 'Old' },
    { name: 'Obadiah', chapters: 1, testament: 'Old' },
    { name: 'Jonah', chapters: 4, testament: 'Old' },
    { name: 'Micah', chapters: 7, testament: 'Old' },
    { name: 'Nahum', chapters: 3, testament: 'Old' },
    { name: 'Habakkuk', chapters: 3, testament: 'Old' },
    { name: 'Zephaniah', chapters: 3, testament: 'Old' },
    { name: 'Haggai', chapters: 2, testament: 'Old' },
    { name: 'Zechariah', chapters: 14, testament: 'Old' },
    { name: 'Malachi', chapters: 4, testament: 'Old' },
];

export const NEW_TESTAMENT_BOOKS: BibleBook[] = [
    { name: 'Matthew', chapters: 28, testament: 'New' },
    { name: 'Mark', chapters: 16, testament: 'New' },
    { name: 'Luke', chapters: 24, testament: 'New' },
    { name: 'John', chapters: 21, testament: 'New' },
    { name: 'Acts', chapters: 28, testament: 'New' },
    { name: 'Romans', chapters: 16, testament: 'New' },
    { name: '1 Corinthians', chapters: 16, testament: 'New' },
    { name: '2 Corinthians', chapters: 13, testament: 'New' },
    { name: 'Galatians', chapters: 6, testament: 'New' },
    { name: 'Ephesians', chapters: 6, testament: 'New' },
    { name: 'Philippians', chapters: 4, testament: 'New' },
    { name: 'Colossians', chapters: 4, testament: 'New' },
    { name: '1 Thessalonians', chapters: 5, testament: 'New' },
    { name: '2 Thessalonians', chapters: 3, testament: 'New' },
    { name: '1 Timothy', chapters: 6, testament: 'New' },
    { name: '2 Timothy', chapters: 4, testament: 'New' },
    { name: 'Titus', chapters: 3, testament: 'New' },
    { name: 'Philemon', chapters: 1, testament: 'New' },
    { name: 'Hebrews', chapters: 13, testament: 'New' },
    { name: 'James', chapters: 5, testament: 'New' },
    { name: '1 Peter', chapters: 5, testament: 'New' },
    { name: '2 Peter', chapters: 3, testament: 'New' },
    { name: '1 John', chapters: 5, testament: 'New' },
    { name: '2 John', chapters: 1, testament: 'New' },
    { name: '3 John', chapters: 1, testament: 'New' },
    { name: 'Jude', chapters: 1, testament: 'New' },
    { name: 'Revelation', chapters: 22, testament: 'New' },
];

export const ALL_BIBLE_BOOKS: BibleBook[] = [
    ...OLD_TESTAMENT_BOOKS,
    ...NEW_TESTAMENT_BOOKS
];

// Helper functions
export const getBookByName = (name: string): BibleBook | undefined => {
    return ALL_BIBLE_BOOKS.find(book => book.name === name);
};

export const getBookChapterCount = (bookName: string): number => {
    const book = getBookByName(bookName);
    return book ? book.chapters : 0;
};

export const getBooksByTestament = (testament: 'Old' | 'New'): BibleBook[] => {
    return ALL_BIBLE_BOOKS.filter(book => book.testament === testament);
};

// Generate array of chapter numbers for a book
export const getChapterNumbers = (bookName: string): number[] => {
    const chapterCount = getBookChapterCount(bookName);
    return Array.from({ length: chapterCount }, (_, i) => i + 1);
};