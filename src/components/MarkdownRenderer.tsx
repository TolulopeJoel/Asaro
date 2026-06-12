import React from 'react';
import { StyleSheet, Text, View, Linking } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ScalePressable } from './ScalePressable';

interface MarkdownRendererProps {
    content: string;
    accentColor?: string;
    onReferencePress?: (reference: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, accentColor, onReferencePress }) => {
    const { colors } = useTheme();
    const tint = accentColor || colors.accent;

    if (!content) return null;

    const lines = content.split('\n');

    const renderLine = (line: string, index: number) => {
        const trimmed = line.trim();

        // ── Divider ──
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            return <View key={index} style={[styles.divider, { backgroundColor: colors.border }]} />;
        }

        // ── Headers ──
        if (line.startsWith('# ')) {
            return <Text key={index} style={[styles.h1, { color: colors.textPrimary }]}>{parseInline(line.substring(2))}</Text>;
        }
        if (line.startsWith('## ')) {
            return <Text key={index} style={[styles.h2, { color: colors.textPrimary }]}>{parseInline(line.substring(3))}</Text>;
        }
        if (line.startsWith('### ')) {
            return <Text key={index} style={[styles.h3, { color: colors.textPrimary }]}>{parseInline(line.substring(4))}</Text>;
        }

        // ── List items ──
        if (trimmed.startsWith('- ')) {
            const indent = line.search(/\S/);
            return (
                <View key={index} style={[styles.listItem, { marginLeft: indent * 10 }]}>
                    <Text style={[styles.bullet, { color: tint }]}>•</Text>
                    <Text style={[styles.p, { color: colors.textSecondary, flex: 1 }]}>
                        {parseInline(trimmed.substring(2))}
                    </Text>
                </View>
            );
        }

        // Plain paragraph or empty
        if (trimmed === '') return <View key={index} style={{ height: 8 }} />;

        return (
            <Text key={index} style={[styles.p, { color: colors.textSecondary }]}>
                {parseInline(line)}
            </Text>
        );
    };

    const parseInline = (text: string) => {
        const parts: (string | React.ReactNode)[] = [];
        let lastIndex = 0;

        // Unified regex for Bold, Reference, Markdown Link, and Auto-link
        const regex = /((?:\*\*|__)(.*?)(?:\*\*|__))|(\[\[(.*?)\]\])|(\[(.*?)\]\((.*?)\))|(https?:\/\/[^\s]+|www\.[^\s]+)/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            // Push text before match
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }

            if (match[2]) {
                // Bold (Group 2)
                parts.push(<Text key={match.index} style={styles.bold}>{match[2]}</Text>);
            } else if (match[4]) {
                // Bible Reference (Group 4)
                const ref = match[4];
                parts.push(
                    <ScalePressable
                        key={match.index}
                        style={[styles.refBadge, { backgroundColor: tint + '12' }]}
                        onPress={() => onReferencePress?.(ref)}
                    >
                        <Text style={[styles.refText, { color: tint }]}>{ref}</Text>
                    </ScalePressable>
                );
            } else if (match[6] && match[7]) {
                // Markdown Link [title](url)
                const title = match[6];
                const url = match[7];
                parts.push(
                    <Text
                        key={match.index}
                        style={[styles.link, { color: tint }]}
                        onPress={() => Linking.openURL(url)}
                    >
                        {title}
                    </Text>
                );
            } else if (match[8]) {
                // Auto-link
                const url = match[8];
                const cleanUrl = url.startsWith('www.') ? `https://${url}` : url;
                parts.push(
                    <Text
                        key={match.index}
                        style={[styles.link, { color: tint }]}
                        onPress={() => Linking.openURL(cleanUrl)}
                    >
                        {url}
                    </Text>
                );
            }

            lastIndex = regex.lastIndex;
        }

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
    container: { gap: 4 },
    h1: { fontSize: 26, fontWeight: '800', marginTop: 12, marginBottom: 8, letterSpacing: -0.5 },
    h2: { fontSize: 20, fontWeight: '700', marginTop: 8, marginBottom: 4 },
    h3: { fontSize: 18, fontWeight: '600', marginTop: 6 },
    p: { fontSize: 16, lineHeight: 24, marginBottom: 4 },
    bold: { fontWeight: '700' },
    link: { textDecorationLine: 'underline', fontWeight: '600' },
    listItem: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 },
    bullet: { fontSize: 18, marginRight: 8, marginTop: -2 },
    divider: { height: 1.5, marginVertical: 16, width: '100%', opacity: 0.6 },
    refBadge: {
        paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
        marginHorizontal: 2, marginBottom: -3,
    },
    refText: { fontSize: 14, fontWeight: '700' },
});
