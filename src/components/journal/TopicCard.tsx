import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bell, CheckCircle2, Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { JournalEntry } from '../../data/database';
import { ScalePressable } from '../ScalePressable';
import { HyperlinkedText } from '../HyperlinkedText';
import { formatDate, getDynamicCardStyle } from './JournalCardHelpers';

interface TopicCardProps {
    item: JournalEntry;
    onEntryPress: (entry: JournalEntry) => void;
    handleToggleTopic: (item: JournalEntry) => void;
}

export const TopicCard = React.memo(({ item, onEntryPress, handleToggleTopic }: TopicCardProps) => {
    const { colors } = useTheme();
    const dynamic = getDynamicCardStyle(item.study_further || '');
    const isCompleted = !!item.study_completed;

    return (
        <View style={styles.bookCardWrapper}>
            <View style={[
                styles.entryCard,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.cardBorder,
                    marginBottom: 0,
                    padding: dynamic.padding,
                    opacity: isCompleted ? 0.6 : 1
                }
            ]}>
                <View style={[styles.entryHeader, { marginBottom: 12 }]}>
                    <View style={styles.entryHeaderLeft}>
                        <Text style={[styles.entryDate, { color: colors.textTertiary }]}>{formatDate(item.created_at)}</Text>
                        <ScalePressable onPress={() => onEntryPress(item)}>
                            <View style={[styles.refBadge, { backgroundColor: colors.accentSecondary + '15' }]}>
                                <Text style={[styles.entryScripture, { color: colors.accentSecondary + 'A5' }]}>
                                    {item.book_name} {item.chapter_start}{item.chapter_end && item.chapter_end !== item.chapter_start ? `-${item.chapter_end}` : ''}
                                </Text>
                            </View>
                        </ScalePressable>
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.topicContentContainer}>
                            <HyperlinkedText
                                style={[
                                    styles.entryPreview,
                                    {
                                        color: colors.textPrimary,
                                        fontWeight: '600',
                                        fontSize: dynamic.fontSize,
                                        lineHeight: dynamic.lineHeight,
                                        marginBottom: item.study_further_reminder ? 8 : 0,
                                        textDecorationLine: isCompleted ? 'line-through' : 'none',
                                    }
                                ]}
                                text={item.study_further || ''}
                            />
                            {isCompleted && (
                                <View style={[styles.strikeThroughLine, { backgroundColor: colors.textPrimary, opacity: 0.4 }]} />
                            )}
                        </View>
                        {item.study_further_reminder && new Date(item.study_further_reminder) > new Date() ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, backgroundColor: colors.backgroundSubtle, borderColor: colors.border, alignSelf: 'flex-start', marginTop: 8, gap: 4 }}>
                                <Bell size={12} color={colors.textSecondary} />
                                <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textSecondary }}>
                                    {new Date(item.study_further_reminder).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <ScalePressable
                        onPress={() => handleToggleTopic(item)}
                        style={[
                            styles.checkCircle,
                            {
                                borderColor: isCompleted ? colors.accentSecondary : colors.border,
                                backgroundColor: isCompleted ? colors.accentSecondary + '20' : colors.backgroundSubtle + '40'
                            }
                        ]}
                    >
                        {isCompleted ? (
                            <CheckCircle2 size={14} color={colors.accentSecondary} />
                        ) : (
                            <Check size={14} color={colors.textTertiary} />
                        )}
                    </ScalePressable>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    bookCardWrapper: {
        marginBottom: 12,
    },
    entryCard: {
        borderRadius: 12,
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
        borderRadius: 8,
    },
    entryScripture: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    entryPreview: {
        fontSize: 16,
        lineHeight: 26,
        fontWeight: '500',
        letterSpacing: -0.1,
    },
    topicContentContainer: {
        position: 'relative',
        alignSelf: 'flex-start',
    },
    strikeThroughLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: 1.5,
        borderRadius: 1,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
