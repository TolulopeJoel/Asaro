/**
 * One entry, read back.
 *
 * design/all-screens.html #entrydetail draws it in both styles. It opens over
 * Home, over Book detail and over a theme, which makes it the most-reached
 * surface in the app.
 *
 * Confirmation and receipt are one element. Cloth puts the reference in the
 * band with the timestamp under it and Colossal spends its giant on the same
 * reference, which retires the rounded date chip the built version carried: a
 * chip is how you label something inside a screen, and this is the screen.
 *
 * The rule down the left of each answer is `accentSecondary` — indigo in
 * Cloth, white in Colossal — not the accent. Six ochre rules down one page
 * would spend the accent on structure and leave nothing for the share
 * affordance and the reminder.
 *
 * The per-answer share icon stays beside its question and the bar at the foot
 * acts on the whole entry: you share *an answer*, you delete *an entry*.
 *
 * It owns its own <Screen> and its own action bar, because the Cloth band has
 * to reach the top of the display (<Hero ownsTopInset>) and the bar has to sit
 * on the foot — neither of which a caller can supply from outside.
 */
import { JournalEntry } from '@/src/data/database';
import { shareReflectionToGroup } from '@/src/services/groupActivityService';
import { getDaysDifference, getLocalMidnight } from '@/src/utils/dateUtils';
import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Share2, Bell, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { Spacing } from '../theme/spacing';
import { ScalePressable } from './ScalePressable';
import { HyperlinkedText } from './HyperlinkedText';
import { CardFAB } from './CardFAB';
import { Hero, Screen, Text, textStyle } from './ui';

interface JournalEntryDetailProps {
    entry: JournalEntry;
    onEdit?: (entry: JournalEntry) => void;
    onDelete?: () => void;
    onClose?: () => void;
    /** Sharing the whole entry, from the bar. Absent where there is nowhere to share to. */
    onShare?: () => void;
    isSharing?: boolean;
    isDeleting?: boolean;
    /** True when the app's tab bar sits below this screen rather than a modal edge. */
    aboveTabBar?: boolean;
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
    onShare,
    isSharing = false,
    isDeleting = false,
    aboveTabBar = false,
}) => {
    const { colors, isLockedIn, style: themeStyle } = useTheme();
    const { showAlert } = useAlert();
    const [isSharingAnswer, setIsSharingAnswer] = useState(false);

    const formatDate = (dateString: string): string => {
        // SQLite local time string 'YYYY-MM-DD HH:MM:SS' needs 'T' for reliable JS parsing
        const date = new Date(dateString.replace(' ', 'T'));
        const dateLocal = getLocalMidnight(date);
        const nowLocal = getLocalMidnight();
        const diffDays = getDaysDifference(nowLocal, dateLocal);

        const timeString = date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        let datePart = '';
        if (diffDays === 0) datePart = 'today';
        else if (diffDays === 1) datePart = 'yesterday';
        else if (diffDays === 2) datePart = 'the day before yesterday';
        else if (diffDays < 7) datePart = `${Math.abs(diffDays)} days ago`;
        else {
            const day = dateLocal.getDate();
            const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                day === 2 || day === 22 ? 'nd' :
                    day === 3 || day === 23 ? 'rd' : 'th';

            datePart = `${day}${suffix}, ` + dateLocal.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            });
        }

        return `${datePart} at ${timeString}`;
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
                        setIsSharingAnswer(true);
                        try {
                            const success = await shareReflectionToGroup(entry, reflectionText.trim(), REFLECTION_QUESTIONS[questionIndex]);
                            if (success) {
                                showAlert({ title: 'Success', message: 'Reflection shared to your group!' });
                            } else {
                                showAlert({ title: 'Notice', message: 'Could not share reflection. Make sure you are in a group.' });
                            }
                        } catch {
                            showAlert({ title: 'Error', message: 'An error occurred while sharing.' });
                        } finally {
                            setIsSharingAnswer(false);
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

    /** Running answer copy, in the design system's `body` face for the style. */
    const bodyFace = [textStyle(themeStyle, 'body'), { color: colors.textPrimary }];

    /** The question, and the one thing you can do to this answer alone. */
    const blockHead = (questionIndex: number, onSharePress?: () => void) => (
        <View style={styles.blockHead}>
            <Text variant="label" style={styles.question}>
                {REFLECTION_QUESTIONS[questionIndex]}
            </Text>
            {onSharePress && (
                <ScalePressable
                    onPress={onSharePress}
                    disabled={isSharingAnswer}
                    hitSlop={Spacing.sm}
                    accessibilityRole="button"
                    accessibilityLabel="Share this answer with your group"
                >
                    <Share2 size={16} color={colors.textTertiary} strokeWidth={1.9} />
                </ScalePressable>
            )}
        </View>
    );

    const renderReflection = (reflection: string | undefined, questionIndex: number) => {
        const rule = { borderLeftColor: colors.accentSecondary };

        if (questionIndex === ACTION_QUESTION_INDEX) {
            if (!entry.action_items || entry.action_items.length === 0) return null;

            const validActions = entry.action_items.filter(
                item => item.action.trim() || item.motivation.trim()
            );
            if (validActions.length === 0) return null;

            return (
                <View key={questionIndex} style={[styles.block, rule]}>
                    {blockHead(questionIndex, handleShareActionItems)}
                    {validActions.map((item, i) => (
                        <View
                            key={i}
                            style={[
                                styles.answer,
                                // More than one commitment came out of this answer:
                                // a hairline between them, not a box around each.
                                i > 0 && styles.nextAction,
                                i > 0 && { borderTopColor: colors.border },
                            ]}
                        >
                            {item.action.trim() ? (
                                <Text variant="subtitle">{item.action.trim()}</Text>
                            ) : null}
                            {item.motivation.trim() ? (
                                <HyperlinkedText
                                    style={[
                                        textStyle(themeStyle, 'sub'),
                                        styles.motivation,
                                        { color: colors.textSecondary },
                                    ]}
                                    text={item.motivation.trim()}
                                />
                            ) : null}
                        </View>
                    ))}
                </View>
            );
        }

        if (questionIndex === STUDY_FURTHER_INDEX) {
            if (!entry.study_further || !entry.study_further.trim()) return null;

            const paragraphs = entry.study_further.trim().split('\n\n').filter(p => p.trim());
            const reminder = entry.study_further_reminder;

            return (
                <View key={questionIndex} style={[styles.block, rule]}>
                    {blockHead(questionIndex)}
                    <View style={styles.answer}>
                        {paragraphs.map((paragraph, pIndex) => (
                            <HyperlinkedText key={pIndex} style={bodyFace} text={paragraph.trim()} />
                        ))}
                    </View>
                    {reminder && new Date(reminder) > new Date() && (
                        <View
                            style={[
                                styles.reminder,
                                { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                            ]}
                        >
                            <Bell size={13} color={colors.textSecondary} strokeWidth={1.9} />
                            <Text variant="label" tone="secondary">
                                {`Reminder set for ${new Date(reminder).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`}
                            </Text>
                        </View>
                    )}
                </View>
            );
        }

        const actualReflection = questionIndex === 5 ? entry.notes : reflection;
        if (!actualReflection || !actualReflection.trim()) return null;

        const paragraphs = actualReflection.trim().split('\n\n').filter(p => p.trim());

        return (
            <View key={questionIndex} style={[styles.block, rule]}>
                {blockHead(questionIndex, () => handleShareReflection(actualReflection, questionIndex))}
                <View style={styles.answer}>
                    {paragraphs.map((paragraph, pIndex) => (
                        <HyperlinkedText key={pIndex} style={bodyFace} text={paragraph.trim()} />
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

    const reference = `${entry.book_name} ${formatChapterAndVerses()}`.trim();
    const when = formatDate(entry.created_at);

    const close = onClose && (
        <ScalePressable
            onPress={onClose}
            hitSlop={Spacing.md}
            accessibilityRole="button"
            accessibilityLabel="Close"
        >
            <X
                size={19}
                color={isLockedIn ? colors.textTertiary : colors.textOnHero}
                strokeWidth={1.9}
            />
        </ScalePressable>
    );

    return (
        <Screen edges={isLockedIn ? ['top'] : []}>
            {isLockedIn ? (
                <View style={styles.colossalTop}>
                    <Text variant="tab" style={styles.mark}>{when}</Text>
                    {close}
                </View>
            ) : (
                <Hero ownsTopInset>
                    <View style={styles.bandTop}>
                        <Text variant="display" tone="onBand" style={styles.bandTitle}>
                            {reference}
                        </Text>
                        {close}
                    </View>
                    <Text variant="sub" tone="onHero" style={styles.bandSub}>{when}</Text>
                </Hero>
            )}

            <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingHorizontal: isLockedIn
                            ? Spacing.layout.screenPaddingTight
                            : Spacing.layout.screenPadding,
                    },
                ]}
            >
                {isLockedIn && (
                    <>
                        <Text variant="display">{reference}</Text>
                        <View style={[styles.rule, { backgroundColor: colors.border }]} />
                    </>
                )}

                {hasReflections ? (
                    [
                        entry.reflection_1,
                        entry.reflection_2,
                        entry.reflection_3,
                        entry.reflection_4,
                        entry.study_further,
                        entry.notes,
                    ].map((reflection, index) => renderReflection(reflection, index))
                ) : (
                    /* The rule goes quiet rather than away: an entry with
                       nothing in it is still an entry. */
                    <View style={[styles.block, styles.empty, { borderLeftColor: colors.border }]}>
                        <Text variant="quote" tone="tertiary">awaiting your reflection</Text>
                    </View>
                )}
            </ScrollView>

            <CardFAB
                onShare={onShare}
                onEdit={onEdit && (() => onEdit(entry))}
                onDelete={onDelete}
                isSharing={isSharing}
                isDeleting={isDeleting}
                aboveTabBar={aboveTabBar}
            />
        </Screen>
    );
};

const styles = StyleSheet.create({
    /** `.cl-top` — the title takes the row and the way out sits hard right. */
    bandTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    bandTitle: { flex: 1 },
    /** `.cl-hsub{margin:8px 0 0}` */
    bandSub: { marginTop: Spacing.sm },
    /** `.co-top` — the timestamp is the mark on this screen. */
    colossalTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.sm,
    },
    mark: { flex: 1 },

    scroll: { flex: 1 },
    content: {
        paddingTop: Spacing.layout.cardPadding,
        paddingBottom: Spacing.xxl,
        gap: Spacing.xl - 2,
    },
    /** `.co-hr` under the Colossal head. */
    rule: { height: Spacing.border.hairline, marginTop: Spacing.lg },

    /*
     * Each answer hangs off a 3px rule. `borderLeftColor` is supplied per
     * block so the empty state can take the hairline colour instead.
     */
    block: { borderLeftWidth: 3, paddingLeft: Spacing.lg - 1 },
    blockHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    question: { flex: 1 },
    answer: { marginTop: Spacing.md - 1, gap: Spacing.md },
    nextAction: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: Spacing.border.hairline },
    motivation: { marginTop: Spacing.sm - 1 },
    /** A square box on a hairline, not a rounded chip. */
    reminder: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 7,
        marginTop: Spacing.md - 1,
        paddingHorizontal: Spacing.md - 1,
        paddingVertical: Spacing.sm - 1,
        borderWidth: Spacing.border.hairline,
    },
    empty: { paddingVertical: Spacing.xxxl },
});
