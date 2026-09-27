/** Join codes and the fixed document ids of the groups model (design/GROUPS.md#data-model). */

/** No 0/O, 1/I/L: a code is read aloud and copied by hand. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function generateCode(random: () => number = Math.random): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        const at = Math.min(CODE_ALPHABET.length - 1, Math.floor(random() * CODE_ALPHABET.length));
        code += CODE_ALPHABET[at];
    }
    return code;
}

/** What the reader typed, as a code: upper case, spaces and dashes dropped. */
export function normaliseCode(input: string): string {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isCode(code: string): boolean {
    return code.length === CODE_LENGTH && [...code].every(c => CODE_ALPHABET.includes(c));
}

/** Every document a person writes starts with their uid, which is what the rules check. */
export const readingId = (uid: string, entryId: number) => `${uid}_${entryId}`;
export const practiceId = (uid: string, itemId: number) => `${uid}_${itemId}`;
export const milestoneId = (uid: string, key: string) => `${uid}_${key}`;
export const weekDocId = (uid: string, weekKey: string) => `${uid}_${weekKey}`;
/** One thing brought per person per week, so bringing another replaces it. */
export const shareId = (uid: string, weekKey: string) => `${uid}_${weekKey}`;
/** One nudge per sender per week. */
export const nudgeId = (fromUid: string, weekKey: string) => `${fromUid}_${weekKey}`;

/** The item id back out of a practice doc id, or null if it is not one of `uid`'s. */
export function practiceItemId(uid: string, docId: string): number | null {
    const prefix = `${uid}_`;
    if (!docId.startsWith(prefix)) return null;
    const id = Number(docId.slice(prefix.length));
    return Number.isInteger(id) ? id : null;
}
