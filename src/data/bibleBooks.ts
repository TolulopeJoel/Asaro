// src/data/bibleBooks.ts

export interface BibleBook {
    name: string;
    abbrv: string
    chapters: number;
    testament: 'Old' | 'New';
}

export const OLD_TESTAMENT_BOOKS: BibleBook[] = [
    { name: 'Genesis', abbrv: 'Gen', chapters: 50, testament: 'Old' },
    { name: 'Exodus', abbrv: 'Exod', chapters: 40, testament: 'Old' },
    { name: 'Leviticus', abbrv: 'Lev', chapters: 27, testament: 'Old' },
    { name: 'Numbers', abbrv: 'Num', chapters: 36, testament: 'Old' },
    { name: 'Deuteronomy', abbrv: 'Deut', chapters: 34, testament: 'Old' },
    { name: 'Joshua', abbrv: 'Josh', chapters: 24, testament: 'Old' },
    { name: 'Judges', abbrv: 'Judg', chapters: 21, testament: 'Old' },
    { name: 'Ruth', abbrv: 'Ruth', chapters: 4, testament: 'Old' },
    { name: '1 Samuel', abbrv: '1Sam', chapters: 31, testament: 'Old' },
    { name: '2 Samuel', abbrv: '2Sam', chapters: 24, testament: 'Old' },
    { name: '1 Kings', abbrv: '1Ki', chapters: 22, testament: 'Old' },
    { name: '2 Kings', abbrv: '2Ki', chapters: 25, testament: 'Old' },
    { name: '1 Chronicles', abbrv: '1Chr', chapters: 29, testament: 'Old' },
    { name: '2 Chronicles', abbrv: '2Chr', chapters: 36, testament: 'Old' },
    { name: 'Ezra', abbrv: 'Ezra', chapters: 10, testament: 'Old' },
    { name: 'Nehemiah', abbrv: 'Neh', chapters: 13, testament: 'Old' },
    { name: 'Esther', abbrv: 'Esth', chapters: 10, testament: 'Old' },
    { name: 'Job', abbrv: 'Job', chapters: 42, testament: 'Old' },
    { name: 'Psalms', abbrv: 'Ps', chapters: 150, testament: 'Old' },
    { name: 'Proverbs', abbrv: 'Prov', chapters: 31, testament: 'Old' },
    { name: 'Ecclesiastes', abbrv: 'Eccl', chapters: 12, testament: 'Old' },
    { name: 'Song of Solomon', abbrv: 'Song', chapters: 8, testament: 'Old' },
    { name: 'Isaiah', abbrv: 'Isa', chapters: 66, testament: 'Old' },
    { name: 'Jeremiah', abbrv: 'Jer', chapters: 52, testament: 'Old' },
    { name: 'Lamentations', abbrv: 'Lam', chapters: 5, testament: 'Old' },
    { name: 'Ezekiel', abbrv: 'Ezek', chapters: 48, testament: 'Old' },
    { name: 'Daniel', abbrv: 'Dan', chapters: 12, testament: 'Old' },
    { name: 'Hosea', abbrv: 'Hos', chapters: 14, testament: 'Old' },
    { name: 'Joel', abbrv: 'Joel', chapters: 3, testament: 'Old' },
    { name: 'Amos', abbrv: 'Amos', chapters: 9, testament: 'Old' },
    { name: 'Obadiah', abbrv: 'Obad', chapters: 1, testament: 'Old' },
    { name: 'Jonah', abbrv: 'Jonah', chapters: 4, testament: 'Old' },
    { name: 'Micah', abbrv: 'Mic', chapters: 7, testament: 'Old' },
    { name: 'Nahum', abbrv: 'Nah', chapters: 3, testament: 'Old' },
    { name: 'Habakkuk', abbrv: 'Hab', chapters: 3, testament: 'Old' },
    { name: 'Zephaniah', abbrv: 'Zeph', chapters: 3, testament: 'Old' },
    { name: 'Haggai', abbrv: 'Hag', chapters: 2, testament: 'Old' },
    { name: 'Zechariah', abbrv: 'Zech', chapters: 14, testament: 'Old' },
    { name: 'Malachi', abbrv: 'Mal', chapters: 4, testament: 'Old' },
  ];
  
  export const NEW_TESTAMENT_BOOKS: BibleBook[] = [
    { name: 'Matthew', abbrv: 'Matt', chapters: 28, testament: 'New' },
    { name: 'Mark', abbrv: 'Mark', chapters: 16, testament: 'New' },
    { name: 'Luke', abbrv: 'Luke', chapters: 24, testament: 'New' },
    { name: 'John', abbrv: 'John', chapters: 21, testament: 'New' },
    { name: 'Acts', abbrv: 'Acts', chapters: 28, testament: 'New' },
    { name: 'Romans', abbrv: 'Rom', chapters: 16, testament: 'New' },
    { name: '1 Corinthians', abbrv: '1Cor', chapters: 16, testament: 'New' },
    { name: '2 Corinthians', abbrv: '2Cor', chapters: 13, testament: 'New' },
    { name: 'Galatians', abbrv: 'Gal', chapters: 6, testament: 'New' },
    { name: 'Ephesians', abbrv: 'Eph', chapters: 6, testament: 'New' },
    { name: 'Philippians', abbrv: 'Phil', chapters: 4, testament: 'New' },
    { name: 'Colossians', abbrv: 'Col', chapters: 4, testament: 'New' },
    { name: '1 Thessalonians', abbrv: '1Thess', chapters: 5, testament: 'New' },
    { name: '2 Thessalonians', abbrv: '2Thess', chapters: 3, testament: 'New' },
    { name: '1 Timothy', abbrv: '1Tim', chapters: 6, testament: 'New' },
    { name: '2 Timothy', abbrv: '2Tim', chapters: 4, testament: 'New' },
    { name: 'Titus', abbrv: 'Titus', chapters: 3, testament: 'New' },
    { name: 'Philemon', abbrv: 'Phlm', chapters: 1, testament: 'New' },
    { name: 'Hebrews', abbrv: 'Heb', chapters: 13, testament: 'New' },
    { name: 'James', abbrv: 'Jas', chapters: 5, testament: 'New' },
    { name: '1 Peter', abbrv: '1Pet', chapters: 5, testament: 'New' },
    { name: '2 Peter', abbrv: '2Pet', chapters: 3, testament: 'New' },
    { name: '1 John', abbrv: '1John', chapters: 5, testament: 'New' },
    { name: '2 John', abbrv: '2John', chapters: 1, testament: 'New' },
    { name: '3 John', abbrv: '3John', chapters: 1, testament: 'New' },
    { name: 'Jude', abbrv: 'Jude', chapters: 1, testament: 'New' },
    { name: 'Revelation', abbrv: 'Rev', chapters: 22, testament: 'New' },
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