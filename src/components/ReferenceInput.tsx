import React, { useRef } from 'react';
import { StyleSheet, Text, TextInput, type NativeSyntheticEvent, type TextInputProps, type TextInputSelectionChangeEventData } from 'react-native';
import { MAX_FONT_SCALE } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { continuePoint, markerPositions } from '../utils/points';

type Segment = { text: string; kind: 'plain' | 'reference' | 'pending' | 'marker' };
type Span = { start: number; end: number };

const REFERENCE = /\[\[(.+?)\]\]/g;
const CLOSING = /^[,.;:!?)]$/;

/** A reference tag's colours, shared by the writing box and the read-back. */
export const referenceTag = (colors: { accent: string; accentDark: string }) =>
    ({ color: colors.accentDark, backgroundColor: `${colors.accent}2e` });

const referenceSpans = (text: string): Span[] =>
    Array.from(text.matchAll(REFERENCE), m => ({ start: m.index!, end: m.index! + m[0].length }));

/**
 * Plain runs, whole `[[references]]`, point markers when `lists` is on, and the reference
 * still being picked (`pendingFrom` to the end).
 */
function segments(text: string, pendingFrom: number, lists: boolean): Segment[] {
    const end = pendingFrom >= 0 && pendingFrom < text.length ? pendingFrom : text.length;
    const head = text.slice(0, end);
    const marks: (Span & { kind: Segment['kind'] })[] = [
        ...referenceSpans(head).map(span => ({ ...span, kind: 'reference' as const })),
        ...(lists ? markerPositions(head).map(at => ({ start: at, end: at + 1, kind: 'marker' as const })) : []),
    ].sort((x, y) => x.start - y.start);
    const out: Segment[] = [];
    let at = 0;
    for (const mark of marks) {
        if (mark.start < at) continue;
        if (mark.start > at) out.push({ text: text.slice(at, mark.start), kind: 'plain' });
        out.push({ text: text.slice(mark.start, mark.end), kind: mark.kind });
        at = mark.end;
    }
    if (end > at) out.push({ text: text.slice(at, end), kind: 'plain' });
    if (end < text.length) out.push({ text: text.slice(end), kind: 'pending' });
    return out;
}

/** Where `next` first differs from `prev`, and what was removed and typed there. */
function editBetween(prev: string, next: string) {
    let p = 0;
    while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
    let q = 0;
    while (q < prev.length - p && q < next.length - p && prev[prev.length - 1 - q] === next[next.length - 1 - q]) q++;
    return { at: p, removedEnd: prev.length - q, inserted: next.slice(p, next.length - q) };
}

/**
 * Keeps references whole: an edit that cuts into one removes all of it, typing inside one
 * lands after it, and punctuation typed after one takes the place of the space that follows it.
 * Returns the text to keep, where the cursor belongs and where the raw edit left it, or null.
 */
function adjustForReferences(prev: string, next: string): { text: string; cursor: number; nativeCursor: number } | null {
    const { at: p, removedEnd, inserted } = editBetween(prev, next);
    const removed = { start: p, end: removedEnd };
    const spans = referenceSpans(prev);

    if (removed.end > removed.start && !inserted) {
        const cut = spans.filter(s => s.start < removed.end && s.end > removed.start);
        if (!cut.length) return null;
        const start = Math.min(removed.start, cut[0].start);
        const end = Math.max(removed.end, cut[cut.length - 1].end);
        return { text: prev.slice(0, start) + prev.slice(end), cursor: start, nativeCursor: p };
    }
    if (removed.end === removed.start && inserted) {
        if (CLOSING.test(inserted) && prev[p - 1] === ' ' && spans.some(s => s.end === p - 1)) {
            return { text: prev.slice(0, p - 1) + inserted + prev.slice(p), cursor: p, nativeCursor: p + 1 };
        }
        const inside = spans.find(s => p > s.start && p < s.end);
        if (!inside) return null;
        return {
            text: prev.slice(0, inside.end) + inserted + prev.slice(inside.end),
            cursor: inside.end + inserted.length,
            nativeCursor: p + inserted.length,
        };
    }
    return null;
}

/**
 * A TextInput that shows `[[references]]` as tags the cursor can't get inside. With `lists`,
 * a line starting with a marker is a point and Return carries the marker on.
 */
export function ReferenceInput({
    text,
    pendingFrom = -1,
    lists = false,
    style,
    ref,
    onChangeText,
    onSelectionChange,
    ...props
}: TextInputProps & { text: string; pendingFrom?: number; lists?: boolean; ref?: React.Ref<TextInput> }) {
    const { colors } = useTheme();
    const input = useRef<TextInput | null>(null);
    const setInput = (node: TextInput | null) => {
        input.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.RefObject<TextInput | null>).current = node;
    };
    const latest = useRef(text);
    latest.current = text;
    // Selection events right after a correction still describe the uncorrected text.
    const correcting = useRef(0);
    const moveCursor = (at: number, after = 0) => setTimeout(() => {
        const to = Math.min(at, latest.current.length);
        input.current?.setSelection(to, to);
    }, after);

    // Android keeps stale lines when styled text is replaced mid-composition and draws from the
    // wrong offset; changing letter spacing in the same update makes it lay the text out afresh.
    const shown = useRef({ text, pendingFrom, flip: false });
    if (shown.current.text !== text || shown.current.pendingFrom !== pendingFrom) {
        shown.current = { text, pendingFrom, flip: !shown.current.flip };
    }
    const letterSpacing = (StyleSheet.flatten(style)?.letterSpacing ?? 0) + (shown.current.flip ? 0.01 : 0);

    const handleChange = (next: string) => {
        if (lists) {
            const edit = editBetween(text, next);
            const carried = edit.inserted === '\n' && edit.removedEnd === edit.at ? continuePoint(text, edit.at) : null;
            // The cursor already lands right: native keeps its distance from the end.
            if (carried !== null) {
                onChangeText?.(carried);
                return;
            }
        }
        const kept = adjustForReferences(text, next);
        onChangeText?.(kept ? kept.text : next);
        if (!kept) return;
        correcting.current = Date.now();
        // Native keeps the cursor's distance from the end; move it only when that lands it wrong.
        if (kept.text.length - (next.length - kept.nativeCursor) !== kept.cursor) moveCursor(kept.cursor, 150);
    };

    const handleSelection = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        onSelectionChange?.(e);
        const { start, end } = e.nativeEvent.selection;
        if (start !== end || Date.now() - correcting.current < 200) return;
        const inside = referenceSpans(text).find(s => start > s.start && start < s.end);
        if (inside) moveCursor(start - inside.start < inside.end - start ? inside.start : inside.end);
    };

    const tag = referenceTag(colors);
    const picking = { color: colors.textPrimary, backgroundColor: colors.accent };
    const marker = { color: colors.accent };
    // Fully transparent counts as no colour on Android and falls back to the ink; 1/255 draws nothing.
    const hidden = { color: `${colors.accent}01`, letterSpacing: -2.5 };

    return (
        <TextInput
            ref={setInput}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            {...props}
            style={[style, { letterSpacing }]}
            onChangeText={handleChange}
            onSelectionChange={handleSelection}
        >
            {segments(text, pendingFrom, lists).map((part, index) => {
                if (part.kind === 'plain') {
                    return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={index}>{part.text}</Text>;
                }
                if (part.kind === 'pending') {
                    return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={index} style={picking}>{part.text}</Text>;
                }
                if (part.kind === 'marker') {
                    return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={index} style={marker}>{part.text}</Text>;
                }
                // The brackets stay in the text but draw nothing: they are the tag's padding.
                return [
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={`${index}[`} style={[tag, hidden]}>[[</Text>,
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={index} style={tag}>{part.text.slice(2, -2)}</Text>,
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={`${index}]`} style={[tag, hidden]}>]]</Text>,
                ];
            })}
        </TextInput>
    );
}
