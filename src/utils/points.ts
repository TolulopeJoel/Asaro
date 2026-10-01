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

/** The prose before the first point, or one point with whatever was written after it. */
export interface AnswerBlock {
    text: string;
    point: boolean;
}

/**
 * An answer as it reads back, markers left out. Prose before the first point is one block;
 * after that, every point starts a block and prose written after it belongs to it, as its
 * next paragraph. With no points, the blocks are the answer's paragraphs.
 */
export function answerBlocks(text: string): AnswerBlock[] {
    const lines = text.trim().split('\n');
    if (!lines.some(line => POINT.test(line))) {
        return text.trim().split('\n\n').map(p => p.trim()).filter(Boolean).map(p => ({ text: p, point: false }));
    }
    const blocks: { paragraphs: string[][]; point: boolean }[] = [];
    let paragraph: string[] | null = null;
    for (const line of lines) {
        if (POINT.test(line)) {
            const point = line.replace(POINT, '').trim();
            paragraph = point ? [point] : null;
            if (paragraph) blocks.push({ paragraphs: [paragraph], point: true });
        } else if (!line.trim()) {
            paragraph = null;
        } else if (paragraph) {
            paragraph.push(line.trim());
        } else {
            paragraph = [line.trim()];
            const last = blocks[blocks.length - 1];
            if (last) last.paragraphs.push(paragraph);
            else blocks.push({ paragraphs: [paragraph], point: false });
        }
    }
    return blocks.map(block => ({ text: block.paragraphs.map(p => p.join('\n')).join('\n\n'), point: block.point }));
}
