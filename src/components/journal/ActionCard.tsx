import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';
import { EnhancedActionItem, JournalEntry, getEntryById } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { HyperlinkedText } from '../HyperlinkedText';
import { formatDate, getDynamicCardStyle } from './JournalCardHelpers';

interface ActionCardProps {
    item: EnhancedActionItem;
    onEntryPress: (entry: JournalEntry) => void;
    handleTogglePin: (item: EnhancedActionItem) => void;
}

export const ActionCard = React.memo(({ item, onEntryPress, handleTogglePin }: ActionCardProps) => {
    const { colors } = useTheme();
    const dynamic = getDynamicCardStyle(item.action);
    return (
        <View style={styles.bookCardWrapper}>
            <View style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, marginBottom: 0, padding: dynamic.padding }]}>
                <View style={[styles.entryHeader, { marginBottom: 12 }]}>
                    <View style={styles.entryHeaderLeft}>
                        <Text style={[styles.entryDate, { color: colors.textTertiary }]}>{formatDate(item.created_at)}</Text>
                        <ScalePressable onPress={async () => {
                            try {
                                const entry = await getEntryById(item.entry_id!);
                                if (entry) onEntryPress(entry);
                            } catch (e) {
                                console.error(e);
                            }
                        }}>
                            <View style={[styles.refBadge, { backgroundColor: colors.accent + '12' }]}>
                                <Text style={[styles.entryScripture, { color: colors.accent }]}>
                                    {item.book_name} {item.chapter_start}{item.chapter_end && item.chapter_end !== item.chapter_start ? `-${item.chapter_end}` : ''}
                                </Text>
                            </View>
                        </ScalePressable>
                    </View>
                    <TouchableOpacity
                        onPress={() => handleTogglePin(item)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{ marginLeft: 'auto' }}
                    >
                        <Svg width="18" height="18" viewBox="0 0 24 24" fill={item.is_pinned ? colors.accent : 'none'} stroke={item.is_pinned ? colors.accent : colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: '30deg' }] }}>
                            <Path d="M12 17v5" />
                            <Path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                        </Svg>
                    </TouchableOpacity>
                </View>
                <HyperlinkedText
                    style={[styles.entryPreview, { color: colors.textPrimary, fontWeight: '600', fontSize: dynamic.fontSize, lineHeight: dynamic.lineHeight, marginBottom: item.motivation ? 8 : 0 }]}
                    text={item.action}
                />
                {item.motivation ? (
                    <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border + '30' }}>
                        <HyperlinkedText
                            style={[styles.entryPreview, { color: colors.textSecondary, fontStyle: 'italic', marginBottom: 0, fontSize: Math.max(13, dynamic.fontSize - 2) }]}
                            text={item.motivation}
                        />
                    </View>
                ) : null}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    bookCardWrapper: {
        marginBottom: 12,
    },
    entryCard: {
        borderRadius: 16,
        borderWidth: 1,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    entryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    entryDate: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    refBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    entryScripture: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    entryPreview: {
        fontSize: 16,
        lineHeight: 26,
        fontWeight: '500',
        letterSpacing: -0.1,
    },
});
