import { JournalEntry, deleteJournalEntry, shareReflectionToGroup } from '@/src/data/database';
import { getDaysDifference, getLocalMidnight } from '@/src/utils/dateUtils';
import React, { useState, useMemo } from 'react';
import {
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Share2, Bell, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { Spacing } from '../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../theme/typography';
import { ScalePressable } from './ScalePressable';
import { HyperlinkedText } from './HyperlinkedText';

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
    'What would I like to study further?',
    'Additional Thoughts',
];

const ACTION_QUESTION_INDEX = 2;
const STUDY_FURTHER_INDEX = 4;

export const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({
    entry,
    onEdit,
    onDelete,
    onClose,
}) => {
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const [isSharing, setIsSharing] = useState(false);

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const dateLocal = getLocalMidnight(date);
        const nowLocal = getLocalMidnight();
        const diffDays = getDaysDifference(nowLocal, dateLocal);

        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays === 2) return 'the day before yesterday';
        if (diffDays < 7) return `${Math.abs(diffDays)} days ago`;

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

        if (!hasChapterRange && hasVerses) {
            let result = entry.chapter_start.toString();
            if (entry.verse_start) {
                result += `:${entry.verse_start}`;
                if (entry.verse_end && entry.verse_end !== entry.verse_start) {
                    result += `–${entry.verse_end}`;
                }
            }
            return result;
        }

        if (hasChapterRange && hasVerses) {
            let result = entry.chapter_start.toString();
            if (entry.verse_start) {
                result += `:${entry.verse_start}`;
            }
            result += `–${entry.chapter_end}`;
            if (entry.verse_end) {
                result += `:${entry.verse_end}`;
            }
            return result;
        }

        if (hasChapterRange) {
            return `${entry.chapter_start}–${entry.chapter_end}`;
        }

        return entry.chapter_start.toString();
    };

    const handleShareReflection = (reflectionText: string, questionIndex: number) => {
        showAlert({
            title: 'Share with Group',
            message: 'Share this specific reflection to your group feed?',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Share',
                    onPress: async () => {
                        setIsSharing(true);
                        try {
                            const success = await shareReflectionToGroup(entry, reflectionText.trim(), REFLECTION_QUESTIONS[questionIndex]);
                            if (success) {
                                showAlert({ title: 'Success', message: 'Reflection shared to your group!' });
                            } else {
                                showAlert({ title: 'Notice', message: 'Could not share reflection. Make sure you are in a group.' });
                            }
                        } catch (e) {
                            showAlert({ title: 'Error', message: 'An error occurred while sharing.' });
                        } finally {
                            setIsSharing(false);
                        }
                    }
                }
            ]
        });
    };

    const handleShareActionItems = () => {
        if (!entry.action_items || entry.action_items.length === 0) return;
        let content = '';
        entry.action_items.forEach((item) => {
            if (item.action.trim()) {
                content += `* ${item.action.trim()}\n\n`;
                if (item.motivation.trim()) {
                    content += `motivation:\n\n${item.motivation.trim()}\n\n`;
                }
            } else if (item.motivation.trim()) {
                content += `motivation:\n\n${item.motivation.trim()}\n\n`;
            }
        });
        if (content.trim()) {
            handleShareReflection(content, ACTION_QUESTION_INDEX);
        }
    };

    const renderReflection = (reflection: string | undefined, questionIndex: number) => {
        if (questionIndex === ACTION_QUESTION_INDEX) {
            if (!entry.action_items || entry.action_items.length === 0) return null;
            const hasContent = entry.action_items.some(item => item.action.trim() || item.motivation.trim());
            if (!hasContent) return null;

            const validActions = (entry.action_items || []).filter(
                item => item.action.trim() || item.motivation.trim()
            );
            const isSingleAction = validActions.length === 1;

            return (
                <View key={questionIndex} style={[styles.reflectionCard, { borderLeftColor: colors.accentSecondary }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md }}>
                        <Text style={[styles.questionText, { color: colors.accent, flex: 1, marginBottom: 0 }]}>{REFLECTION_QUESTIONS[questionIndex]}</Text>
                        <ScalePressable onPress={handleShareActionItems} style={{ padding: Spacing.sm, marginTop: -Spacing.sm, marginRight: -Spacing.sm }}>
                            <Share2 size={20} color={colors.textTertiary} />
                        </ScalePressable>
                    </View>
                    <View style={styles.answerContainer}>
                        {validActions.map((item, i) => (
                            <View
                                key={i}
                                style={[
                                    !isSingleAction && styles.actionItemCard,
                                    !isSingleAction && { backgroundColor: colors.cardBackground, borderColor: colors.border }
                                ]}
                            >
                                {item.action.trim() ? (
                                    <HyperlinkedText
                                        style={[styles.actionText, { color: colors.textPrimary }]}
                                        text={item.action.trim()}
                                    />
                                ) : null}
                                {item.motivation.trim() ? (
                                    <View style={styles.motivationRow}>
                                        <HyperlinkedText
                                            style={[styles.motivationText, { color: colors.textSecondary }]}
                                            text={item.motivation.trim()}
                                        />
                                    </View>
                                ) : null}
                            </View>
                        ))}
                    </View>
                </View>
            );
        }

        if (questionIndex === STUDY_FURTHER_INDEX) {
            if (!entry.study_further || !entry.study_further.trim()) return null;

            const paragraphs = entry.study_further.trim().split('\n\n').filter(p => p.trim());

            return (
                <View key={questionIndex} style={[styles.reflectionCard, { borderLeftColor: colors.accentSecondary }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md }}>
                        <Text style={[styles.questionText, { color: colors.accent, flex: 1, marginBottom: 0 }]}>{REFLECTION_QUESTIONS[questionIndex]}</Text>
                    </View>
                    <View style={styles.answerContainer}>
                        {paragraphs.map((paragraph, pIndex) => (
                            <HyperlinkedText key={pIndex} style={[
                                styles.answerText,
                                { color: colors.textPrimary },
                                pIndex > 0 && styles.answerParagraph
                            ]} text={paragraph.trim()} />
                        ))}
                    </View>
                    {entry.study_further_reminder && new Date(entry.study_further_reminder) > new Date() && (
                        <View style={[styles.reminderChip, { backgroundColor: colors.backgroundSubtle, borderColor: colors.border }]}>
                            <Bell size={14} color={colors.textSecondary} />
                            <Text style={[styles.reminderChipText, { color: colors.textSecondary }]}>
                                Reminder set for {new Date(entry.study_further_reminder).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </Text>
                        </View>
                    )}
                </View>
            );
        }

        const actualReflection = (questionIndex === 5) ? entry.notes : reflection;
        if (!actualReflection || !actualReflection.trim()) return null;

        const paragraphs = actualReflection.trim().split('\n\n').filter(p => p.trim());

        return (
            <View key={questionIndex} style={[styles.reflectionCard, { borderLeftColor: colors.accentSecondary }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md }}>
                    <Text style={[styles.questionText, { color: colors.accent, flex: 1, marginBottom: 0 }]}>{REFLECTION_QUESTIONS[questionIndex]}</Text>
                    <ScalePressable onPress={() => handleShareReflection(actualReflection, questionIndex)} style={{ padding: Spacing.sm, marginTop: -Spacing.sm, marginRight: -Spacing.sm }}>
                        <Share2 size={20} color={colors.textTertiary} />
                    </ScalePressable>
                </View>
                <View style={styles.answerContainer}>
                    {paragraphs.map((paragraph, pIndex) => (
                        <HyperlinkedText key={pIndex} style={[
                            styles.answerText,
                            { color: colors.textPrimary },
                            pIndex > 0 && styles.answerParagraph
                        ]} text={paragraph.trim()} />
                    ))}
                </View>
            </View>
        );
    };

    const hasReflections = useMemo(() => {
        const textReflections = [
            entry.reflection_1,
            entry.reflection_2,
            entry.reflection_4,
            entry.study_further,
            entry.notes,
        ].filter(r => r && r.trim().length > 0);
        const hasActions = entry.action_items?.some(
            item => item.action.trim() || item.motivation.trim()
        );
        return textReflections.length > 0 || !!hasActions;
    }, [entry.reflection_1, entry.reflection_2, entry.reflection_4, entry.study_further, entry.action_items, entry.notes]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Hero Header */}
                <View style={[styles.heroHeader, { backgroundColor: colors.background }]}>
                    <View style={styles.topRow}>
                        <View style={[styles.dateChip, { backgroundColor: colors.badge, borderColor: colors.badgeBorder }]}>
                            <Text style={[styles.dateText, { color: colors.badgeText }]}>{formatDate(entry.created_at)}</Text>
                        </View>

                        {onClose && (
                            <ScalePressable style={[styles.closeButton, { backgroundColor: colors.backgroundSubtle }]} onPress={onClose}>
                                <X size={20} color={colors.textSecondary} />
                            </ScalePressable>
                        )}
                    </View>

                    <Text style={[styles.reference, { color: colors.textPrimary }]}>
                        {entry.book_name}{' '}
                        <Text style={[styles.verseReference, { color: colors.textPrimary }]}>
                            {formatChapterAndVerses()}
                        </Text>
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
                                entry.study_further,
                                entry.notes,
                            ].map((reflection, index) => renderReflection(reflection, index))}
                        </View>
                    ) : (
                        <View style={[styles.emptyState, { borderLeftColor: colors.border }]}>
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>awaiting your reflection</Text>
                        </View>
                    )}
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
        paddingTop: Spacing.md,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg + Spacing.xs,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateChip: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: Spacing.borderRadius.sm,
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
        marginBottom: Spacing.xxl,
    },
    verseReference: {
        fontWeight: Typography.weight.medium,
        letterSpacing: Typography.letterSpacing.normal,
    },
    contentSection: {
        paddingHorizontal: Spacing.lg + Spacing.xs,
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
        padding: Spacing.md,
        paddingLeft: Spacing.lg,
        borderWidth: 1,
    },
    actionText: {
        fontSize: Typography.size.lg - 1,
        lineHeight: Typography.lineHeight.xl,
        fontWeight: Typography.weight.semibold,
        letterSpacing: Typography.letterSpacing.normal,
    },
    motivationRow: {
        flexDirection: 'row',
        marginTop: Spacing.sm,
        gap: 8,
        alignItems: 'flex-start',
    },
    motivationText: {
        flex: 1,
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
    bottomSpacer: {
        height: 160, // Increased to account for the floating bar plus some breathing room
    },
    reminderChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: Spacing.borderRadius.round,
        borderWidth: 1,
        alignSelf: 'flex-start',
        marginTop: Spacing.sm,
        gap: Spacing.xs,
    },
    reminderChipText: {
        fontSize: Typography.size.xs + 1,
        fontWeight: Typography.weight.medium,
    },
});