import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { useRefPicker } from '../context/RefPickerContext';
import { couldBeBookName, findAtTrigger, pickerQuery, resolveTypedReference, typedSince } from '../utils/bibleUtils';

/**
 * Encapsulates all `@` trigger detection, live preview, reference selection,
 * and dismiss logic for Bible references inside a text field.
 *
 * ### Modes
 * - **'context'** – Opens the root-level picker via `RefPickerContext`.
 *   Use this for text fields that are NOT inside a native `<Modal>`.
 * - **'local'** – Returns `pickerProps` to drive a `<BibleReferencePicker>`
 *   rendered locally inside a native `<Modal>` (which blocks the root picker).
 */
export function useBibleRefPicker({
    getValue,
    setValue,
    getInputRef,
    mode,
}: {
    /** Returns the current text value of the field. Must be stable (use a ref or inline fn). */
    getValue: () => string;
    /** Updates the text value of the field. */
    setValue: (text: string) => void;
    /** Returns the TextInput ref so the hook can re-focus after picker interactions. */
    getInputRef: () => TextInput | null;
    /** 'context' = use root RefPickerContext; 'local' = return self-contained pickerProps. */
    mode: 'context' | 'local';
}) {
    const { showPicker, hidePicker, updateQuery } = useRefPicker();

    // Character index of the `@` that opened the picker. -1 when closed.
    const [refStartIndex, setRefStartIndex] = useState(-1);
    const [refQuery, setRefQuery] = useState('');
    // Used only in 'local' mode.
    const [pickerVisible, setPickerVisible] = useState(false);

    // Keep stable refs so callbacks passed to showPicker() don't go stale.
    const refStartIndexRef = useRef(-1);
    const getValueRef = useRef(getValue);
    getValueRef.current = getValue;
    const setValueRef = useRef(setValue);
    setValueRef.current = setValue;
    const getInputRefRef = useRef(getInputRef);
    getInputRefRef.current = getInputRef;
    // Owner token from the root picker, so this field only ever closes its own.
    const pickerToken = useRef<number | undefined>(undefined);

    // A picker left open would write into this field after it has gone.
    useEffect(() => () => {
        if (mode === 'context' && pickerToken.current !== undefined) hidePicker(pickerToken.current);
    }, [mode, hidePicker]);

    // ─── Helpers ──────────────────────────────────────────────────────────────

    const refocusInput = useCallback(() => {
        setTimeout(() => getInputRefRef.current()?.focus(), 50);
    }, []);

    const openPicker = useCallback(
        (query: string, startIdx: number) => {
            setRefStartIndex(startIdx);
            setRefQuery(query);
            refStartIndexRef.current = startIdx;

            if (mode === 'local') {
                setPickerVisible(true);
                return;
            }

            pickerToken.current = showPicker({
                query,
                onPreview: (partial) => {
                    const si = refStartIndexRef.current;
                    if (si < 0) return;
                    setValueRef.current(getValueRef.current().slice(0, si) + partial);
                },
                onSelect: (ref) => {
                    const si = refStartIndexRef.current;
                    setValueRef.current(
                        getValueRef.current().slice(0, si >= 0 ? si : 0) + `[[${ref}]] `
                    );
                    refStartIndexRef.current = -1;
                    setRefStartIndex(-1);
                    setRefQuery('');
                    setTimeout(() => getInputRefRef.current()?.focus(), 50);
                },
                onDismiss: () => {
                    refStartIndexRef.current = -1;
                    setRefStartIndex(-1);
                    setRefQuery('');
                    getInputRefRef.current()?.focus();
                },
                onInteraction: () => getInputRefRef.current()?.focus(),
            }, pickerToken.current);
        },
        [mode, showPicker]
    );

    const closePicker = useCallback(() => {
        refStartIndexRef.current = -1;
        setRefStartIndex(-1);
        setRefQuery('');
        if (mode === 'local') {
            setPickerVisible(false);
        } else {
            hidePicker(pickerToken.current);
        }
    }, [mode, hidePicker]);

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Drop-in replacement for a TextInput's `onChangeText`.
     * Detects `@` triggers, keeps the picker in sync, and delegates updates
     * to `setValue`.
     */
    const handleTextChange = useCallback(
        (text: string) => {
            // Through the ref, never the captured prop: this callback is memoized
            // for the life of the field, so a captured `setValue` would keep
            // writing to whatever answer the field was pointed at on first render.
            setValueRef.current(text);

            const si = refStartIndexRef.current;

            // Already tracking a reference in progress
            if (si >= 0) {
                if (text.length <= si) {
                    // User deleted back past the @
                    closePicker();
                    return;
                }
                const typed = typedSince(text, si);
                if (text.endsWith(' ')) {
                    // A space finishes a real book; "@1 " may still become "1 John"; anything else is just an @.
                    const ref = resolveTypedReference(typed);
                    if (ref) {
                        handleSelect(ref);
                        return;
                    }
                    if (!couldBeBookName(typed)) {
                        closePicker();
                        return;
                    }
                }
                const newQuery = pickerQuery(typed);
                setRefQuery(newQuery);
                if (mode === 'context') updateQuery(newQuery, pickerToken.current);
                return;
            }

            const trigger = findAtTrigger(text);
            if (trigger) {
                openPicker(pickerQuery(trigger.query), trigger.startIndex);
            } else if (mode === 'context') {
                if (pickerToken.current !== undefined) hidePicker(pickerToken.current);
            } else {
                setPickerVisible(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mode, openPicker, closePicker, showPicker, hidePicker]
    );

    /** Preview handler — call `onPreview` from `<BibleReferencePicker>` in 'local' mode. */
    const handlePreview = useCallback((partial: string) => {
        const si = refStartIndexRef.current;
        if (si < 0) return;
        setValueRef.current(getValueRef.current().slice(0, si) + partial);
    }, []);

    /** Select handler — call `onSelect` from `<BibleReferencePicker>` in 'local' mode. */
    const handleSelect = useCallback((ref: string) => {
        const si = refStartIndexRef.current;
        setValueRef.current(
            getValueRef.current().slice(0, si >= 0 ? si : 0) + `[[${ref}]] `
        );
        refStartIndexRef.current = -1;
        setRefStartIndex(-1);
        setRefQuery('');
        if (mode === 'context') hidePicker(pickerToken.current);
        else setPickerVisible(false);
        setTimeout(() => getInputRefRef.current()?.focus(), 50);
    }, [mode, hidePicker]);

    /** Dismiss handler — call `onDismiss` from `<BibleReferencePicker>` in 'local' mode. */
    const handleDismiss = useCallback(() => {
        closePicker();
        refocusInput();
    }, [closePicker, refocusInput]);

    /**
     * Pass to `<BibleReferencePicker onInteraction>` in 'local' mode so each
     * tap in the picker keeps the keyboard / focus alive.
     */
    const handleInteraction = useCallback(() => {
        refocusInput();
    }, [refocusInput]);

    /**
     * Props to spread directly onto `<BibleReferencePicker>` when in 'local' mode.
     * In 'context' mode these are unused (pass nothing to BibleReferencePicker).
     */
    const pickerProps = {
        visible: pickerVisible,
        query: refQuery,
        onPreview: handlePreview,
        onSelect: handleSelect,
        onDismiss: handleDismiss,
        onInteraction: handleInteraction,
    };

    return {
        handleTextChange,
        /** For 'local' mode only — spread onto <BibleReferencePicker> */
        pickerProps,
        /** Raw access if you need it */
        refStartIndex,
    };
}
