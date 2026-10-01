import React, { useRef } from 'react';
import { StyleSheet, Text, TextInput, type NativeSyntheticEvent, type TextInputProps, type TextInputSelectionChangeEventData } from 'react-native';
import { MAX_FONT_SCALE } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';

type Segment = { text: string; kind: 'plain' | 'reference' | 'pending' };
type Span = { start: number; end: number };

const REFERENCE = /\[\[(.+?)\]\]/g;

const referenceSpans = (text: string): Span[] =>
    Array.from(text.matchAll(REFERENCE), m => ({ start: m.index!, end: m.index! + m[0].length }));

/** Plain runs, whole `[[references]]`, and the reference still being picked (`pendingFrom` to the end). */
function segments(text: string, pendingFrom: number): Segment[] {
    const end = pendingFrom >= 0 && pendingFrom < text.length ? pendingFrom : text.length;
    const out: Segment[] = [];
    let at = 0;
    for (const span of referenceSpans(text.slice(0, end))) {
        if (span.start > at) out.push({ text: text.slice(at, span.start), kind: 'plain' });
        out.push({ text: text.slice(span.start, span.end), kind: 'reference' });
        at = span.end;
    }
    if (end > at) out.push({ text: text.slice(at, end), kind: 'plain' });
    if (end < text.length) out.push({ text: text.slice(end), kind: 'pending' });
    return out;
}

/**
 * Keeps references whole: an edit that cuts into one removes all of it, and typing
 * inside one lands after it. Returns the text to keep and where the cursor goes, or null.
 */
function keepReferencesWhole(prev: string, next: string): { text: string; cursor: number } | null {
    let p = 0;
    while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
    let q = 0;
    while (q < prev.length - p && q < next.length - p && prev[prev.length - 1 - q] === next[next.length - 1 - q]) q++;
    const removed = { start: p, end: prev.length - q };
    const inserted = next.slice(p, next.length - q);
    const spans = referenceSpans(prev);

    if (removed.end > removed.start && !inserted) {
        const cut = spans.filter(s => s.start < removed.end && s.end > removed.start);
        if (!cut.length) return null;
        const start = Math.min(removed.start, cut[0].start);
        const end = Math.max(removed.end, cut[cut.length - 1].end);
        return { text: prev.slice(0, start) + prev.slice(end), cursor: start };
    }
    if (removed.end === removed.start && inserted) {
        const inside = spans.find(s => p > s.start && p < s.end);
        if (!inside) return null;
        return {
            text: prev.slice(0, inside.end) + inserted + prev.slice(inside.end),
            cursor: inside.end + inserted.length,
        };
    }
    return null;
}

/** A TextInput that shows `[[references]]` as tags the cursor can't get inside. */
export function ReferenceInput({
    text,
    pendingFrom = -1,
    style,
    ref,
    onChangeText,
    onSelectionChange,
    ...props
}: TextInputProps & { text: string; pendingFrom?: number; ref?: React.Ref<TextInput> }) {
    const { colors } = useTheme();
    const input = useRef<TextInput | null>(null);
    const setInput = (node: TextInput | null) => {
        input.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.RefObject<TextInput | null>).current = node;
    };
    const latest = useRef(text);
    latest.current = text;
    // A correction is on its way to the native text; selection events until then describe the old text.
    const correcting = useRef(false);
    const moveCursor = (at: number) => setTimeout(() => {
        correcting.current = false;
        const to = Math.min(at, latest.current.length);
        input.current?.setSelection(to, to);
    }, 30);

    // Android keeps stale lines when styled text is replaced mid-composition and draws from the
    // wrong offset; changing letter spacing in the same update makes it lay the text out afresh.
    const shown = useRef({ text, pendingFrom, flip: false });
    if (shown.current.text !== text || shown.current.pendingFrom !== pendingFrom) {
        shown.current = { text, pendingFrom, flip: !shown.current.flip };
    }
    const letterSpacing = (StyleSheet.flatten(style)?.letterSpacing ?? 0) + (shown.current.flip ? 0.01 : 0);

    const handleChange = (next: string) => {
        const kept = keepReferencesWhole(text, next);
        onChangeText?.(kept ? kept.text : next);
        if (kept) {
            correcting.current = true;
            moveCursor(kept.cursor);
        }
    };

    const handleSelection = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        onSelectionChange?.(e);
        const { start, end } = e.nativeEvent.selection;
        if (start !== end || correcting.current) return;
        const inside = referenceSpans(text).find(s => start > s.start && start < s.end);
        if (inside) moveCursor(start - inside.start < inside.end - start ? inside.start : inside.end);
    };

    const tag = { color: colors.accentDark, backgroundColor: `${colors.accent}2e` };
    const picking = { color: colors.textPrimary, backgroundColor: colors.accent };
    const hidden = { color: 'transparent' };

    return (
        <TextInput
            ref={setInput}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            {...props}
            style={[style, { letterSpacing }]}
            onChangeText={handleChange}
            onSelectionChange={handleSelection}
        >
            {segments(text, pendingFrom).map((part, index) => {
                if (part.kind === 'plain') {
                    return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={index}>{part.text}</Text>;
                }
                if (part.kind === 'pending') {
                    return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={index} style={picking}>{part.text}</Text>;
                }
                // The brackets stay in the text but draw nothing: they are the tag's padding.
                return (
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={index} style={tag}>
                        <Text style={hidden}>[[</Text>
                        {part.text.slice(2, -2)}
                        <Text style={hidden}>]]</Text>
                    </Text>
                );
            })}
        </TextInput>
    );
}
