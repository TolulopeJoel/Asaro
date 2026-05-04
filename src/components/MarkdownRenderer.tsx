import React from 'react';
import { StyleSheet, Text, View, Linking } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Typography } from '../theme/typography';
import { ScalePressable } from './ScalePressable';

interface MarkdownRendererProps {
    content: string;
    onReferencePress?: (reference: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onReferencePress }) => {
    const { colors } = useTheme();

    if (!content) return null;

    // Split content by lines
    const lines = content.split('\n');

    const renderLine = (line: string, index: number) => {
        // Headers
        if (line.startsWith('# ')) {
            return <Text key={index} style={[styles.h1, { color: colors.textPrimary }]}>{line.substring(2)}</Text>;
        }
        if (line.startsWith('## ')) {
            return <Text key={index} style={[styles.h2, { color: colors.textPrimary }]}>{line.substring(3)}</Text>;
        }
        if (line.startsWith('### ')) {
            return <Text key={index} style={[styles.h3, { color: colors.textPrimary }]}>{line.substring(4)}</Text>;
        }

        // Parse inline elements (links and references)
        return (
            <Text key={index} style={[styles.p, { color: colors.textSecondary }]}>
                {parseInline(line)}
            </Text>
        );
    };

    const parseInline = (text: string) => {
        const parts = [];
        let lastIndex = 0;

        // Regex for [[Reference]] and [Link](url)
        const regex = /\[\[(.*?)\]\]|\[(.*?)\]\((.*?)\)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Push text before match
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }

            if (match[1]) {
                // Bible Reference [[Ref]]
                const ref = match[1];
                parts.push(
                    <ScalePressable 
                        key={match.index} 
                        style={[styles.refBadge, { backgroundColor: colors.accent + '15' }]}
                        onPress={() => onReferencePress?.(ref)}
                    >
                        <Text style={[styles.refText, { color: colors.accent }]}>{ref}</Text>
                    </ScalePressable>
                );
            } else if (match[2] && match[3]) {
                // Link [Title](URL)
                const title = match[2];
                const url = match[3];
                parts.push(
                    <Text 
                        key={match.index} 
                        style={[styles.link, { color: colors.accent }]}
                        onPress={() => Linking.openURL(url)}
                    >
                        {title}
                    </Text>
                );
            }

            lastIndex = regex.lastIndex;
        }

        // Push remaining text
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return parts;
    };

    return (
        <View style={styles.container}>
            {lines.map(renderLine)}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 8,
    },
    h1: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 16,
        marginBottom: 8,
    },
    h2: {
        fontSize: 20,
        fontWeight: '700',
        marginTop: 12,
        marginBottom: 4,
    },
    h3: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 8,
    },
    p: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 4,
    },
    link: {
        textDecorationLine: 'underline',
        fontWeight: '500',
    },
    refBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        marginHorizontal: 2,
        // Align badge with text baseline
        marginBottom: -4,
    },
    refText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
