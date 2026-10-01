import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';
import { MAX_FONT_SCALE } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { getBibleStyledParts } from '../utils/bibleUtils';

/** Where each `[[reference]]` sits; changes only when one is added, removed or moved. */
const referenceLayout = (text: string) =>
    Array.from(text.matchAll(/\[\[(.+?)\]\]/g), m => `${m.index}:${m[0].length}`).join(',');

/** A TextInput that shows `[[references]]` in the accent colour. */
export function ReferenceInput({ text, style, ref, ...props }: TextInputProps & { text: string; ref?: React.Ref<TextInput> }) {
    const { colors } = useTheme();

    // Android keeps stale lines after a reference span is added or removed and draws the text
    // from the wrong offset; any letter-spacing change makes it lay the text out again.
    const [nudged, setNudged] = useState(false);
    const layout = referenceLayout(text);
    useEffect(() => {
        const t = setTimeout(() => setNudged(n => !n), 60);
        return () => clearTimeout(t);
    }, [layout]);
    const letterSpacing = (StyleSheet.flatten(style)?.letterSpacing ?? 0) + (nudged ? 0.01 : 0);

    return (
        <TextInput ref={ref} maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} style={[style, { letterSpacing }]}>
            {getBibleStyledParts(text).map((part, index) => (
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={index} style={part.isReference ? { color: colors.accent } : undefined}>
                    {part.text}
                </Text>
            ))}
        </TextInput>
    );
}
