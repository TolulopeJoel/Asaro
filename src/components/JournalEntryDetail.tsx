import { JournalEntry, deleteJournalEntry } from '@/src/data/database';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface JournalEntryDetailProps {
    entry: JournalEntry;
    onEdit?: (entry: JournalEntry) => void;
    onDelete?: () => void;
    onClose?: () => void;
}

const REFLECTION_QUESTIONS = [
    'What does this tell me about Jehovah?',
    'How does this section of the Scriptures contribute to the Bible’s message?',
    'How can I realistically apply this in my life?',
    'How can I use these verses to help others?',
    'What is one thing I want to remember from this study?',
];

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
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays === 2) return 'the day before yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        const day = date.getDate();
        const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
            day === 2 || day === 22 ? 'nd' :
                day === 3 || day === 23 ? 'rd' : 'th';

        return `${day}${suffix}, ` + date.toLocaleDateString('en-US', {
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
                            const success = deleteJournalEntry(entry.id!);
                            if (!success) {
                                throw new Error('Failed to delete entry');
                            } else {
                                onDelete?.();
                            }
                        } catch (error) {
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
                if (reflection && reflection.trim()) {
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

    const renderReflection = (reflection: string | undefined, questionIndex: number) => {
        if (!reflection || !reflection.trim()) return null;

        const paragraphs = reflection.trim().split('\n\n').filter(p => p.trim());

        return (
            <View key={questionIndex} style={styles.reflectionCard}>
                <Text style={[styles.questionText, { color: colors.primary }]}>{REFLECTION_QUESTIONS[questionIndex]}</Text>
                <View style={styles.answerContainer}>
                    {paragraphs.map((paragraph, pIndex) => (
                        <Text key={pIndex} style={[
                            styles.answerText,
                            { color: colors.text },
                            pIndex > 0 && styles.answerParagraph
                        ]}>
                            {paragraph.trim()}
                        </Text>
                    ))}
                </View>
            </View>
        );
    };

    const getAnsweredReflections = () => [
        entry.reflection_1,
        entry.reflection_2,
        entry.reflection_3,
        entry.reflection_4,
    ].filter(r => r && r.trim().length > 0);

    const hasReflections = getAnsweredReflections().length > 0;

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
                        <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onPress={onClose}>
                            <View style={styles.closeIconContainer}>
                                <View style={[styles.closeIcon, { backgroundColor: colors.primary }]} />
                                <View style={[styles.closeIcon, styles.closeIconCross, { backgroundColor: colors.primary }]} />
                            </View>
                        </TouchableOpacity>
                    )}

                    <View style={[styles.dateChip, { backgroundColor: colors.badge, borderColor: colors.badgeBorder }]}>
                        <Text style={[styles.dateText, { color: colors.primary }]}>{formatDate(entry.created_at)}</Text>
                    </View>

                    <Text style={[styles.reference, { color: colors.text }]}>
                        {entry.book_name}
                    </Text>
                    <Text style={[styles.verseReference, { color: colors.primary }]}>
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
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>awaiting your reflection</Text>
                        </View>
                    )}

                    {/* Notes with unique design */}
                    {entry.notes && entry.notes.trim() && (
                        <View style={styles.notesSection}>
                            <Text style={[styles.notesTitle, { color: colors.primary }]}>Additional Thoughts</Text>
                            <Text style={[styles.notesText, { color: colors.text }]}>{entry.notes.trim()}</Text>
                        </View>
                    )}
                </View>

                {/* Floating Action Bar */}
                <View style={styles.floatingActions}>
                    <TouchableOpacity
                        style={styles.shareFloatingButton}
                        onPress={handleShare}
                        disabled={isSharing}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.shareFloatingText}>
                            {isSharing ? '↗ sharing' : '↗ share'}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.actionDivider} />

                    {onEdit && (
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => onEdit(entry)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.iconButtonText}>edit</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={handleDelete}
                        disabled={isDeleting}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.iconButtonText, styles.deleteIconText]}>
                            {isDeleting ? 'deleting' : 'delete'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff9f5',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 50,
    },
    heroHeader: {
        paddingTop: 70,
        paddingBottom: 0,
        paddingHorizontal: 24,
        backgroundColor: '#fff9f5',
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: 56,
        right: 24,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#e8ddd5',
    },
    closeIcon: {
        width: 2,
        height: 16,
        backgroundColor: '#8b7355',
    },
    closeIconContainer: {
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIconCross: {
        position: 'absolute',
        transform: [{ rotate: '90deg' }],
    },
    headerOrnamentTop: {
        width: 40,
        height: 2,
        backgroundColor: '#8b6b6b',
        marginBottom: 24,
        opacity: 0.3,
        borderRadius: 1,
    },
    dateChip: {
        alignSelf: 'flex-start',
        backgroundColor: '#f0e8e0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e8ddd5',
    },
    dateText: {
        fontSize: 11,
        color: '#8b7355',
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    reference: {
        fontSize: 32,
        fontWeight: '600',
        color: '#2d1a1a',
        letterSpacing: -0.8,
        lineHeight: 38,
        marginBottom: 8,
    },
    verseReference: {
        fontSize: 20,
        fontWeight: '500',
        color: '#c68a7c',
        marginBottom: 32,
        letterSpacing: 0.2,
    },
    headerOrnamentBottom: {
        width: 60,
        height: 1,
        backgroundColor: '#8b6b6b',
        marginTop: 24,
        opacity: 0.25,
    },
    contentSection: {
        paddingHorizontal: 20,
        paddingTop: 28,
    },
    reflectionsContainer: {
        gap: 28,
    },
    reflectionCard: {
        paddingLeft: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#d48b7d',
        paddingBottom: 8,
    },
    questionSidebar: {
        alignItems: 'center',
        paddingTop: 4,
    },
    questionNumberCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e8e3dd',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#d6d3ce',
    },
    questionNumberText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8b7355',
    },
    questionLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#f0ede8',
        marginTop: 12,
        minHeight: 20,
    },
    reflectionContent: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f0ede8',
        shadowColor: '#8b7355',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    questionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#8b7355',
        lineHeight: 20,
        letterSpacing: 0.3,
        marginBottom: 12,
    },
    answerContainer: {
        gap: 14,
    },
    answerText: {
        fontSize: 15,
        color: '#3d3528',
        lineHeight: 24,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    answerParagraph: {
        marginTop: 0,
    },
    emptyState: {
        paddingVertical: 80,
        paddingLeft: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#e8e3dd',
    },
    emptyCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#e8e3dd',
        borderStyle: 'dashed',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 14,
        color: '#a39b90',
        fontWeight: '400',
        letterSpacing: 0.8,
        fontStyle: 'italic',
    },
    notesSection: {
        marginTop: 40,
        paddingLeft: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#d4a5a5',
    },
    notesBorder: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: '#d4a5a5',
        borderRadius: 2,
        opacity: 0.6,
    },
    notesContent: {
        marginLeft: 20,
        backgroundColor: '#faf9f7',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f0ede8',
    },
    notesHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    notesDotPattern: {
        flexDirection: 'row',
        gap: 3,
    },
    notesDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#d4a5a5',
        opacity: 0.5,
    },
    notesTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#8b7355',
        letterSpacing: 0.3,
        marginBottom: 12,
    },
    notesText: {
        fontSize: 15,
        color: '#3d3528',
        lineHeight: 24,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    floatingActions: {
        marginHorizontal: 20,
        marginTop: 40,
        backgroundColor: '#faf9f7',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: '#e8e3dd',
        shadowColor: '#8b7355',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    shareFloatingButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f0ede8',
        borderRadius: 12,
        alignItems: 'center',
    },
    shareFloatingText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6b5b47',
        letterSpacing: 0.3,
    },
    actionDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#e8e3dd',
        marginHorizontal: 8,
    },
    iconButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    iconButtonText: {
        fontSize: 13,
        fontWeight: '400',
        color: '#8b8075',
        letterSpacing: 0.3,
    },
    deleteIconText: {
        color: '#a08b7d',
    },
    bottomSpacer: {
        height: 40,
    },
});