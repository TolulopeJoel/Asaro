import React, { useMemo } from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { openBibleReferenceFromTag } from '../utils/bibleUtils';

interface HyperlinkedTextProps extends TextProps {
    text: string;
    linkStyle?: TextStyle;
}

export const HyperlinkedText: React.FC<HyperlinkedTextProps> = ({
    text,
    style,
    linkStyle,
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
        <Text style={style} {...props}>
            {parts.map((part, index) => {
                if (part.isLink) {
                    return (
                        <Text
                            key={index}
                            style={[
                                styles.link,
                                { color: colors.accent },
                                linkStyle
                            ]}
                            onPress={() => openBibleReferenceFromTag(part.text)}
                            suppressHighlighting={true}
                        >
                            {part.text}
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
