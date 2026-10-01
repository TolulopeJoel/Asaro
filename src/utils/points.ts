/**
 * Points inside an answer: a line that starts with a marker and a space. Only the start of
 * a line counts, so "Genesis 12-15" mid-sentence stays prose. Spec: design/answer-lists.html.
 */
export const POINT = /^([-*•–—]) /;

/** Where each line-start marker character sits. */
export function markerPositions(text: string): number[] {
    return Array.from(text.matchAll(/(^|\n)[-*•–—] /g), m => m.index! + m[1].length);
}

/**
 * What Return does on a point: starts the next line with the same marker, or, on a line
 * that is only a marker, removes it and ends the list. `next` is `prev` with "\n" typed at
 * `at`. Returns the text to keep, or null when the line isn't a point.
 */
export function continuePoint(prev: string, at: number): string | null {
    const lineStart = prev.lastIndexOf('\n', at - 1) + 1;
    const marker = prev.slice(lineStart, at).match(POINT);
    if (!marker) return null;
    const restOfLine = prev.slice(at, prev.indexOf('\n', at) === -1 ? prev.length : prev.indexOf('\n', at));
    if (prev.slice(lineStart, at) === marker[0] && !restOfLine.trim()) {
        return prev.slice(0, lineStart) + prev.slice(at);
    }
    return `${prev.slice(0, at)}\n${marker[1]} ${prev.slice(at)}`;
}

/**
 * An answer as it reads back. With no points it is its paragraphs, as written. With points,
 * every point is a block and so is each paragraph of prose around them, markers left out.
 */
export function answerBlocks(text: string): { blocks: string[]; points: boolean } {
    const trimmed = text.trim();
    const lines = trimmed.split('\n');
    if (!lines.some(line => POINT.test(line))) {
        return { blocks: trimmed.split('\n\n').map(p => p.trim()).filter(Boolean), points: false };
    }
    const blocks: string[] = [];
    let prose: string[] = [];
    const flush = () => {
        if (prose.length) blocks.push(prose.join('\n'));
        prose = [];
    };
    for (const line of lines) {
        if (POINT.test(line)) {
            flush();
            const point = line.replace(POINT, '').trim();
            if (point) blocks.push(point);
        } else if (!line.trim()) {
            flush();
        } else {
            prose.push(line.trim());
        }
    }
    flush();
    return { blocks, points: true };
}
