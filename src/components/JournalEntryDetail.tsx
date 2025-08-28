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

interface JournalEntryDetailProps {
    entry: JournalEntry;
    onEdit?: (entry: JournalEntry) => void;
    onDelete?: () => void;
    onClose?: () => void;
}

const REFLECTION_QUESTIONS = [
    'What does this tell me about Jehovah God?',
    'How does this section of the Scriptures contribute to the Bible\'s message?',
    'How can I apply this in my life?',
    'How can I use these verses to help others?',
    'What is one thing I want to remember from this study?',
];

export const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({
    entry,
    onEdit,
    onDelete,
    onClose,
}) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays === 1) return 'the day before yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        const day = date.getDate();
        const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
            day === 2 || day === 22 ? 'nd' :
                day === 3 || day === 23 ? 'rd' : 'th';

        return ` ${day}${suffix}, ` + date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });
    };

    const formatChapterRange = (): string => {
        if (!entry.chapter_start) return '';
        if (entry.chapter_end && entry.chapter_end !== entry.chapter_start) {
            return `${entry.chapter_start}—${entry.chapter_end}`;
        }
        return entry.chapter_start.toString();
    };

    const getVerseRange = (): string => {
        if (!entry.verse_start) return '';
        if (entry.verse_end && entry.verse_end !== entry.verse_start) {
            return `:${entry.verse_start}—${entry.verse_end}`;
        }
        return entry.verse_start ? `:${entry.verse_start}` : '';
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
                            if (success) {
                                onDelete?.();
                            } else {
                                throw new Error('Failed to delete entry');
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
            const reference = `${entry.book_name} ${formatChapterRange()}${getVerseRange()}`;
            const studyDate = formatDate(entry.date_created);

            let content = `Bible Reading (${reference}) for `;
            content += `${studyDate}\n\n`;

            const reflections = [
                entry.reflection_1,
                entry.reflection_2,
                entry.reflection_3,
                entry.reflection_4,
                entry.reflection_5,
            ];

            reflections.forEach((reflection, index) => {
                if (reflection && reflection.trim()) {
                    content += `Q${index + 1}. ${REFLECTION_QUESTIONS[index]}\n\n`;
                    content += `× ${reflection.trim()}\n\n`;
                }
            });

            if (entry.notes && entry.notes.trim()) {
                content += `Additional Thoughts\n`;
                content += `× ${entry.notes.trim()}\n\n`;
            }
            content += `🫶 Created with Àṣàrò`;

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
            <View key={questionIndex} style={styles.reflectionContainer}>
                <View style={styles.questionContainer}>
                    <View style={styles.questionMark} />
                    <Text style={styles.questionText}>{REFLECTION_QUESTIONS[questionIndex]}</Text>
                </View>
                <View style={styles.answerContainer}>
                    {paragraphs.map((paragraph, pIndex) => (
                        <Text key={pIndex} style={[
                            styles.answerText,
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
        entry.reflection_5,
    ].filter(r => r && r.trim().length > 0);

    const hasReflections = getAnsweredReflections().length > 0;

    return (
        <View style={styles.container}>
            {/* Header with share button */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.headerOrnament} />
                    <Text style={styles.reference}>
                        {entry.book_name} {formatChapterRange()}{getVerseRange()}
                    </Text>
                    <Text style={styles.studyDate}>{formatDate(entry.date_created)}</Text>
                </View>

                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleShare}
                    disabled={isSharing}
                >
                    <Text style={styles.shareButtonText}>
                        {isSharing ? 'sharing' : 'share'}
                    </Text>
                    <View style={styles.shareButtonUnderline} />
                </TouchableOpacity>
            </View>

            {/* Sacred reading space */}
            <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
            >
                {hasReflections ? (
                    [
                        entry.reflection_1,
                        entry.reflection_2,
                        entry.reflection_3,
                        entry.reflection_4,
                        entry.reflection_5,
                    ].map((reflection, index) => renderReflection(reflection, index))
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyOrnament} />
                        <Text style={styles.emptyText}>awaiting contemplation</Text>
                        <View style={styles.emptyOrnament} />
                    </View>
                )}

                {/* Personal notes */}
                {entry.notes && entry.notes.trim() && (
                    <View>
                        <View style={styles.questionContainer}>
                            <View style={styles.questionMark} />
                            <Text style={styles.questionText}>Additional thoughts</Text>
                        </View>
                        <Text style={styles.notesText}>{entry.notes.trim()}</Text>
                    </View>
                )}

                {/* Bottom actions */}
                <View style={styles.bottomActions}>
                    {onEdit && (
                        <TouchableOpacity
                            style={styles.bottomActionButton}
                            onPress={() => onEdit(entry)}
                        >
                            <Text style={styles.bottomActionText}>EDIT</Text>
                            <View style={styles.bottomActionUnderline} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.bottomActionButton}
                        onPress={handleDelete}
                        disabled={isDeleting}
                    >
                        <Text style={[styles.bottomActionText, styles.deleteText]}>
                            {isDeleting ? 'removing' : 'DELETE'}
                        </Text>
                        <View style={[styles.bottomActionUnderline, styles.deleteUnderline]} />
                    </TouchableOpacity>
                </View>

                <View style={styles.contentSpacer} />
            </ScrollView>

            {/* Whisper close */}
            {onClose && (
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e7dfd2',
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 56,
        backgroundColor: '#d4a5a5',
        position: 'relative',
    },
    headerContent: {
        alignItems: 'center',
    },
    headerOrnament: {
        width: 3,
        height: 3,
        backgroundColor: '#8b6b6b',
        borderRadius: 1.5,
        marginBottom: 20,
        opacity: 0.8,
     },
    reference: {
        fontSize: 24,
        fontWeight: '300',
        color: '#3d2828',
        textAlign: 'center',
        letterSpacing: -0.3,
        marginBottom: 12,
        lineHeight: 32,
     },
     studyDate: {
        fontSize: 12,
        color: '#6b4a4a',
        textAlign: 'center',
        fontWeight: '300',
        letterSpacing: 1.2,
        marginBottom: 32,
     },
    shareButton: {
        position: 'absolute',
        top: 56,
        right: 16,
        alignItems: 'center',
        paddingVertical: 8,
    },
    shareButtonText: {
        fontSize: 11,
        color: '#6b4a4a',
        fontWeight: '300',
        letterSpacing: 1.2,
        marginBottom: 6,
     },
    shareButtonUnderline: {
        width: 20,
        height: 1,
        backgroundColor: '#8b6b6b',
        opacity: 0.6,
     },
    scrollContent: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 24,
    },
    reflectionContainer: {
        marginBottom: 40,
    },
    questionContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    questionMark: {
        width: 3,
        height: 3,
        backgroundColor: '#b8a896',
        borderRadius: 1.5,
        marginTop: 8,
        marginRight: 16,
        opacity: 0.8,
    },
    questionText: {
        fontSize: 14,
        fontWeight: '300',
        color: '#756b5e',
        lineHeight: 22,
        letterSpacing: 0.2,
        flex: 1,
    },
    answerContainer: {
        marginLeft: 6,
    },
    answerText: {
        fontSize: 15,
        color: '#2a241f',
        lineHeight: 26,
        fontWeight: '300',
        letterSpacing: 0.1,
    },
    answerParagraph: {
        marginTop: 16,
    },
    emptyState: {
        paddingVertical: 120,
        alignItems: 'center',
    },
    emptyOrnament: {
        width: 1,
        height: 8,
        backgroundColor: '#c4b8a8',
        opacity: 0.3,
        marginVertical: 16,
    },
    emptyText: {
        fontSize: 14,
        color: '#a89c8f',
        fontWeight: '300',
        letterSpacing: 0.8,
        fontStyle: 'italic',
    },
    notesText: {
        fontSize: 16,
        color: '#2a241f',
        lineHeight: 26,
        fontWeight: '300',
        letterSpacing: 0.1,
        marginLeft: 19,
    },
    bottomActions: {
        marginTop: 20,
        paddingTop: 32,
        paddingLeft: 16,
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#e8e3dd',
        gap: 32,
    },
    bottomActionButton: {
        paddingVertical: 8,
    },
    bottomActionText: {
        fontSize: 12,
        color: '#8a7f73',
        fontWeight: '300',
        letterSpacing: 1,
        marginBottom: 8,
    },
    bottomActionUnderline: {
        width: 32,
        height: 1,
        backgroundColor: '#c4b8a8',
        opacity: 0.3,
    },
    deleteText: {
        color: '#a08b7d',
    },
    deleteUnderline: {
        backgroundColor: '#b59d8f',
        opacity: 0.4,
    },
    contentSpacer: {
        height: 48,
    },
    closeButton: {
        position: 'absolute',
        top: 56,
        left: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        fontSize: 18,
        color: '#6b4a4a',
        fontWeight: '100',
        opacity: 0.8,
    },
});