import { JournalEntry, deleteJournalEntry, shareReflectionToGroup } from '@/src/data/database';
import { getDaysDifference, getLocalMidnight } from '@/src/utils/dateUtils';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ScalePressable } from './ScalePressable';

interface JournalEntryDetailProps {
    entry: JournalEntry;
    onEdit?: (entry: JournalEntry) => void;
    onDelete?: () => void;
    onClose?: () => void;
}

const REFLECTION_QUESTIONS = [
    'What does this tell me about Jehovah?',
    'How does this section of the Scriptures contribute to the Bible\'s message?',
    'How can I realistically apply this in my life?',
    'How can I use these verses to help others?',
];

const ACTION_QUESTION_INDEX = 2;

export const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({
    entry,
    onEdit,
    onDelete,
    onClose,
}) => {
    const { colors } = useTheme();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const dateLocal = getLocalMidnight(date);
        const nowLocal = getLocalMidnight();
        const diffDays = getDaysDifference(nowLocal, dateLocal);

        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays === 2) return 'the day before yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        const day = dateLocal.getDate();
        const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
            day === 2 || day === 22 ? 'nd' :
                day === 3 || day === 23 ? 'rd' : 'th';

        return `${day}${suffix}, ` + dateLocal.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });
    };

    const formatChapterAndVerses = (): string => {
        if (!entry.chapter_start) return '';

        const hasChapterRange = entry.chapter_end && entry.chapter_end !== entry.chapter_start;
        const hasVerses = entry.verse_start || entry.verse_end;

        // Single chapter with verses: "3:16" or "3:16–20"
        if (!hasChapterRange && hasVerses) {
            let result = entry.chapter_start.toString();
            if (entry.verse_start) {
                result += `:${entry.verse_start} `;
                if (entry.verse_end && entry.verse_end !== entry.verse_start) {
                    result += `–${entry.verse_end} `;
                }
            }
            return result;
        }

        // Chapter range with verses: "3:16–5:20"
        if (hasChapterRange && hasVerses) {
            let result = entry.chapter_start.toString();
            if (entry.verse_start) {
                result += `:${entry.verse_start} `;
            }
            result += `–${entry.chapter_end} `;
            if (entry.verse_end) {
                result += `:${entry.verse_end} `;
            }
            return result;
        }

        // Chapter range without verses: "3–5"
        if (hasChapterRange) {
            return `${entry.chapter_start}–${entry.chapter_end} `;
        }

        // Single chapter without verses: "3"
        return entry.chapter_start.toString();
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Entry',
            'Are you sure you want to delete this entry? This action cannot be undone.',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await deleteJournalEntry(entry.id!);
                            onDelete?.();
                        } catch {
                            setIsDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    const handleShare = async () => {
        setIsSharing(true);
        try {
            const reference = `${entry.book_name} ${formatChapterAndVerses()} `;
            const studyDate = formatDate(entry.created_at);

            let content = `Bible Reading(${reference}) for `;
            content += `${studyDate}\n\n`;

            const reflections = [
                entry.reflection_1,
                entry.reflection_2,
                entry.reflection_3,
                entry.reflection_4,
            ];

            reflections.forEach((reflection, index) => {
                if (index === ACTION_QUESTION_INDEX) {
                    // Format action items
                    if (entry.action_items && entry.action_items.length > 0) {
                        content += `Q${index + 1}. ${REFLECTION_QUESTIONS[index]} \n\n`;
                        entry.action_items.forEach((item) => {
                            if (item.action.trim()) {
                                content += `→ ${item.action.trim()}`;
                                if (item.motivation.trim()) {
                                    content += ` (motivated by: ${item.motivation.trim()})`;
                                }
                                content += '\n';
                            }
                        });
                        content += '\n';
                    }
                } else if (reflection && reflection.trim()) {
                    content += `Q${index + 1}. ${REFLECTION_QUESTIONS[index]} \n\n`;
                    content += `${reflection.trim()} \n\n`;
                }
            });

            if (entry.notes && entry.notes.trim()) {
                content += `Additional Thoughts\n`;
                content += `${entry.notes.trim()} \n\n`;
            }
            content += `🫶 Created with Àṣàrò`;

            await Share.share({
                message: content,
                title: reference,
            });
        } catch (error) {
            console.error("Error sharing entry:", error);
        } finally {
            setIsSharing(false);
        }
    };

    const handleShareReflection = (reflectionText: string, questionIndex: number) => {
        Alert.alert(
            'Share with Group',
            'Share this specific reflection to your group feed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Share',
                    onPress: async () => {
                        setIsSharing(true);
                        try {
                            const success = await shareReflectionToGroup(entry, reflectionText.trim(), REFLECTION_QUESTIONS[questionIndex]);
                            if (success) {
                                Alert.alert('Success', 'Reflection shared to your group!');
                            } else {
                                Alert.alert('Notice', 'Could not share reflection. Make sure you are in a group.');
                            }
                        } catch (e) {
                            Alert.alert('Error', 'An error occurred while sharing.');
                        } finally {
                            setIsSharing(false);
                        }
                    }
                }
            ]
        );
    };

    const handleShareActionItems = () => {
        if (!entry.action_items || entry.action_items.length === 0) return;
        let content = '';
        entry.action_items.forEach((item) => {
            if (item.action.trim()) {
                content += `→ ${item.action.trim()}`;
                if (item.motivation.trim()) {
                    content += ` (motivation: ${item.motivation.trim()})`;
                }
                content += '\n';
            }
        });
        if (content.trim()) {
            handleShareReflection(content, ACTION_QUESTION_INDEX);
        }
    };

    const renderReflection = (reflection: string | undefined, questionIndex: number) => {
        // For Q3, render action items instead
        if (questionIndex === ACTION_QUESTION_INDEX) {
            if (!entry.action_items || entry.action_items.length === 0) return null;
            const hasContent = entry.action_items.some(item => item.action.trim() || item.motivation.trim());
            if (!hasContent) return null;

            return (
                <View key={questionIndex} style={[styles.reflectionCard, { borderLeftColor: colors.accentSecondary }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md }}>
                        <Text style={[styles.questionText, { color: colors.accent, flex: 1, marginBottom: 0 }]}>{REFLECTION_QUESTIONS[questionIndex]}</Text>
                        <ScalePressable onPress={handleShareActionItems} style={{ padding: Spacing.sm, marginTop: -Spacing.sm, marginRight: -Spacing.sm }}>
                            <Ionicons name="share-social-outline" size={20} color={colors.textTertiary} />
                        </ScalePressable>
                    </View>
                    <View style={styles.answerContainer}>
                        {entry.action_items.map((item, i) => (
                            (item.action.trim() || item.motivation.trim()) ? (
                                <View key={i} style={[styles.actionItemCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                    {item.action.trim() ? (
                                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                                            → {item.action.trim()}
                                        </Text>
                                    ) : null}
                                    {item.motivation.trim() ? (
                                        <Text style={[styles.motivationText, { color: colors.textSecondary }]}>
                                            {item.motivation.trim()}
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null
                        ))}
                    </View>
                </View>
            );
        }

        if (!reflection || !reflection.trim()) return null;

        const paragraphs = reflection.trim().split('\n\n').filter(p => p.trim());

        return (
            <View key={questionIndex} style={[styles.reflectionCard, { borderLeftColor: colors.accentSecondary }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md }}>
                    <Text style={[styles.questionText, { color: colors.accent, flex: 1, marginBottom: 0 }]}>{REFLECTION_QUESTIONS[questionIndex]}</Text>
                    <ScalePressable onPress={() => handleShareReflection(reflection, questionIndex)} style={{ padding: Spacing.sm, marginTop: -Spacing.sm, marginRight: -Spacing.sm }}>
                        <Ionicons name="share-social-outline" size={20} color={colors.textTertiary} />
                    </ScalePressable>
                </View>
                <View style={styles.answerContainer}>
                    {paragraphs.map((paragraph, pIndex) => (
                        <Text key={pIndex} style={[
                            styles.answerText,
                            { color: colors.textPrimary },
                            pIndex > 0 && styles.answerParagraph
                        ]}>
                            {paragraph.trim()}
                        </Text>
                    ))}
                </View>
            </View>
        );
    };

    const hasReflections = (() => {
        const textReflections = [
            entry.reflection_1,
            entry.reflection_2,
            entry.reflection_4,
        ].filter(r => r && r.trim().length > 0);
        const hasActions = entry.action_items && entry.action_items.some(
            item => item.action.trim() || item.motivation.trim()
        );
        return textReflections.length > 0 || !!hasActions;
    })();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Hero Header */}
                <View style={[styles.heroHeader, { backgroundColor: colors.background }]}>
                    {onClose && (
                        <ScalePressable style={[styles.closeButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onPress={onClose}>
                            <Ionicons name="close" size={20} color={colors.textPrimary} />
                        </ScalePressable>
                    )}

                    <View style={[styles.dateChip, { backgroundColor: colors.badge, borderColor: colors.badgeBorder }]}>
                        <Text style={[styles.dateText, { color: colors.badgeText }]}>{formatDate(entry.created_at)}</Text>
                    </View>

                    <Text style={[styles.reference, { color: colors.textPrimary }]}>
                        {entry.book_name}
                    </Text>
                    <Text style={[styles.verseReference, { color: colors.accent }]}>
                        {formatChapterAndVerses()}
                    </Text>
                </View>

                {/* Content */}
                <View style={styles.contentSection}>
                    {hasReflections ? (
                        <View style={styles.reflectionsContainer}>
                            {[
                                entry.reflection_1,
                                entry.reflection_2,
                                entry.reflection_3,
                                entry.reflection_4,
                            ].map((reflection, index) => renderReflection(reflection, index))}
                        </View>
                    ) : (
                        <View style={[styles.emptyState, { borderLeftColor: colors.border }]}>
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>awaiting your reflection</Text>
                        </View>
                    )}

                    {/* Notes with unique design */}
                    {entry.notes && entry.notes.trim() && (
                        <View style={[styles.notesSection, { borderLeftColor: colors.accentSecondary }]}>
                            <Text style={[styles.notesTitle, { color: colors.accent }]}>Additional Thoughts</Text>
                            <View style={[styles.notesContent, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.notesText, { color: colors.textPrimary }]}>{entry.notes.trim()}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Floating Action Bar */}
                <View style={[styles.floatingActions, { backgroundColor: colors.cardBackground, borderColor: colors.border, shadowColor: colors.accent }]}>
                    <ScalePressable
                        style={[styles.shareFloatingButton, { backgroundColor: colors.backgroundSubtle }]}
                        onPress={handleShare}
                        disabled={isSharing}
                    >
                        <Text style={[styles.shareFloatingText, { color: colors.textSecondary }]}>
                            {isSharing ? '↗ sharing' : '↗ share'}
                        </Text>
                    </ScalePressable>

                    <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

                    {onEdit && (
                        <ScalePressable
                            style={styles.iconButton}
                            onPress={() => onEdit(entry)}
                        >
                            <Text style={[styles.iconButtonText, { color: colors.textSecondary }]}>edit</Text>
                        </ScalePressable>
                    )}

                    <ScalePressable
                        style={styles.iconButton}
                        onPress={handleDelete}
                        disabled={isDeleting}
                    >
                        <Text style={[styles.iconButtonText, { color: colors.textTertiary }]}>
                            {isDeleting ? 'deleting' : 'delete'}
                        </Text>
                    </ScalePressable>
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: Spacing.xxxl + Spacing.sm,
    },
    heroHeader: {
        paddingBottom: 0,
        paddingHorizontal: Spacing.layout.screenPadding,
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: 56,
        right: Spacing.layout.screenPadding,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderRadius: 18,
        borderWidth: 1.5,
    },
    dateChip: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: Spacing.borderRadius.sm,
        marginBottom: Spacing.lg + Spacing.xs,
        borderWidth: 1,
    },
    dateText: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.wider,
        textTransform: 'uppercase',
    },
    reference: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.tight,
        lineHeight: Typography.lineHeight.xxxl + 6,
        marginBottom: Spacing.sm,
    },
    verseReference: {
        fontSize: Typography.size.xl,
        fontWeight: Typography.weight.medium,
        marginBottom: Spacing.xxl,
        letterSpacing: Typography.letterSpacing.normal,
    },
    contentSection: {
        paddingHorizontal: Spacing.lg + Spacing.xs,
        paddingTop: Spacing.xxl + Spacing.xs,
    },
    reflectionsContainer: {
        gap: Spacing.xxl + Spacing.xs,
    },
    reflectionCard: {
        paddingLeft: Spacing.lg,
        borderLeftWidth: 3,
        paddingBottom: Spacing.sm,
    },
    questionText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
        lineHeight: Typography.lineHeight.lg + 4,
        letterSpacing: Typography.letterSpacing.normal,
        marginBottom: Spacing.md,
    },
    answerContainer: {
        gap: Spacing.md + 2,
    },
    answerText: {
        fontSize: Typography.size.lg - 1,
        lineHeight: Typography.lineHeight.xl,
        fontWeight: Typography.weight.regular,
        letterSpacing: Typography.letterSpacing.normal,
    },
    answerParagraph: {
        marginTop: 0,
    },
    actionItemCard: {
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
    },
    actionText: {
        fontSize: Typography.size.lg - 1,
        lineHeight: Typography.lineHeight.xl,
        fontWeight: Typography.weight.medium,
        letterSpacing: Typography.letterSpacing.normal,
    },
    motivationText: {
        fontSize: Typography.size.md,
        lineHeight: Typography.lineHeight.lg,
        fontWeight: Typography.weight.regular,
        letterSpacing: Typography.letterSpacing.normal,
        marginTop: Spacing.xs,
        fontStyle: 'italic',
    },
    emptyState: {
        paddingVertical: Spacing.xxxl + Spacing.xxl,
        paddingLeft: Spacing.lg,
        borderLeftWidth: 3,
    },
    emptyText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.regular,
        letterSpacing: Typography.letterSpacing.wider,
        fontStyle: 'italic',
    },
    notesSection: {
        marginTop: Spacing.xxxl,
        paddingLeft: Spacing.lg,
        borderLeftWidth: 3,
    },
    notesContent: {
        marginLeft: Spacing.lg + Spacing.xs,
        borderRadius: Spacing.borderRadius.md,
        padding: Spacing.lg + Spacing.xs,
        borderWidth: 1,
    },
    notesTitle: {
        fontSize: Typography.size.sm + 1,
        fontWeight: Typography.weight.medium,
        letterSpacing: Typography.letterSpacing.normal,
        marginBottom: Spacing.md,
    },
    notesText: {
        fontSize: Typography.size.lg - 1,
        lineHeight: Typography.lineHeight.xl,
        fontWeight: Typography.weight.regular,
        letterSpacing: Typography.letterSpacing.normal,
    },
    floatingActions: {
        marginHorizontal: Spacing.lg + Spacing.xs,
        marginTop: Spacing.xxxl,
        borderRadius: Spacing.borderRadius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.xs + 2,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: Spacing.sm,
        elevation: 3,
    },
    shareFloatingButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: Spacing.borderRadius.md,
        alignItems: 'center',
    },
    shareFloatingText: {
        fontSize: Typography.size.sm + 1,
        fontWeight: Typography.weight.medium,
        letterSpacing: Typography.letterSpacing.normal,
    },
    actionDivider: {
        width: 1,
        height: Spacing.lg + Spacing.xs,
        marginHorizontal: Spacing.sm,
    },
    iconButton: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
    },
    iconButtonText: {
        fontSize: Typography.size.sm + 1,
        fontWeight: Typography.weight.regular,
        letterSpacing: Typography.letterSpacing.normal,
    },
    bottomSpacer: {
        height: Spacing.xxxl,
    },
});