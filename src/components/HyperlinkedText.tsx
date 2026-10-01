import React, { useMemo } from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { MAX_FONT_SCALE } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { openBibleReferenceFromTag } from '../utils/bibleUtils';
import { referenceTag } from './ReferenceInput';

interface HyperlinkedTextProps extends TextProps {
    text: string;
    linkStyle?: TextStyle;
    /** Show references as tags, as the writing box does. Off where a reference is already its own chip. */
    asTags?: boolean;
}

export const HyperlinkedText: React.FC<HyperlinkedTextProps> = ({
    text,
    style,
    linkStyle,
    asTags = true,
    ...props
}) => {
    const { colors } = useTheme();

    const parts = useMemo(() => {
        if (!text) return [];

        // Matches [[Reference]]
        const regex = /\[\[(.+?)\]\]/g;
        const result = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add plain text before match
            if (match.index > lastIndex) {
                result.push({
                    text: text.substring(lastIndex, match.index),
                    isLink: false
                });
            }

            // Add matched Bible reference (the text inside brackets)
            result.push({
                text: match[1],
                isLink: true,
            });

            lastIndex = regex.lastIndex;
        }

        // Add remaining plain text
        if (lastIndex < text.length) {
            result.push({
                text: text.substring(lastIndex),
                isLink: false
            });
        }

        return result;
    }, [text]);

    if (!text) return null;

    return (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={style} {...props}>
            {parts.map((part, index) => {
                if (part.isLink) {
                    return (
                        <Text
                            maxFontSizeMultiplier={MAX_FONT_SCALE}
                            key={index}
                            style={[
                                asTags ? referenceTag(colors) : [styles.link, { color: colors.accent }],
                                linkStyle
                            ]}
                            onPress={() => openBibleReferenceFromTag(part.text)}
                            suppressHighlighting={true}
                        >
                            {/* Narrow no-break spaces pad the tag, and a no-break space keeps it on one line. */}
                            {asTags ? `\u202F${part.text.replace(/ /g, '\u00A0')}\u202F` : part.text}
                        </Text>
                    );
                }
                return <React.Fragment key={index}>{part.text}</React.Fragment>;
            })}
        </Text>
    );
};

const styles = StyleSheet.create({
    link: {
        fontWeight: '700',
    },
});
