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

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatChapterRange = (): string => {
        if (!entry.chapter_start) return '';

        if (entry.chapter_end && entry.chapter_end !== entry.chapter_start) {
            return `${entry.chapter_start}-${entry.chapter_end}`;
        }
        return entry.chapter_start.toString();
    };

    const getVerseRange = (): string => {
        if (!entry.verse_start) return '';

        if (entry.verse_end && entry.verse_end !== entry.verse_start) {
            return `:${entry.verse_start}-${entry.verse_end}`;
        }
        return entry.verse_start ? `:${entry.verse_start}` : '';
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Entry',
            'Are you sure you want to delete this journal entry? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            const success = deleteJournalEntry(entry.id!);
                            if (success) {
                                Alert.alert('Deleted', 'Your journal entry has been deleted.', [
                                    { text: 'OK', onPress: onDelete }
                                ]);
                            } else {
                                throw new Error('Failed to delete entry');
                            }
                        } catch (error) {
                            console.error('Error deleting entry:', error);
                            Alert.alert('Error', 'Failed to delete the entry. Please try again.');
                            setIsDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    const handleShare = async () => {
        try {
            const reference = `${entry.book_name} ${formatChapterRange()}${getVerseRange()}`;
            const studyDate = formatDate(entry.date_created);

            let content = `Bible Reading (${reference}) for`;
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
                title: `Bible Study - ${reference}`,
            });
        } catch (error) {
            console.error("Error sharing entry:", error);
            Alert.alert("Error", "Failed to share this entry.");
        }
    };

    const renderReflection = (reflection: string | undefined, questionIndex: number) => {
        if (!reflection || !reflection.trim()) return null;

        return (
            <View key={questionIndex} style={styles.reflectionContainer}>
                <Text style={styles.questionText}>{REFLECTION_QUESTIONS[questionIndex]}</Text>
                <Text style={styles.answerText}>{reflection.trim()}</Text>
            </View>
        );
    };

    const getAnsweredCount = (): number => {
        return [
            entry.reflection_1,
            entry.reflection_2,
            entry.reflection_3,
            entry.reflection_4,
            entry.reflection_5,
        ].filter(r => r && r.trim().length > 0).length;
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.title}>
                        {entry.book_name} {formatChapterRange()}{getVerseRange()}
                    </Text>
                    <Text style={styles.studyDate}>{formatDate(entry.date_created)}</Text>
                    <View style={styles.metaContainer}>
                        <Text style={styles.metaText}>
                            {getAnsweredCount()}/5 questions answered
                        </Text>
                        {entry.created_at !== entry.updated_at && (
                            <Text style={styles.metaText}>
                                • Last updated {formatDate(entry.updated_at || entry.created_at!)}
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.shareButton]}
                    onPress={handleShare}
                >
                    <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>

                {onEdit && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.editButton]}
                        onPress={() => onEdit(entry)}
                    >
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={handleDelete}
                    disabled={isDeleting}
                >
                    <Text style={styles.deleteButtonText}>
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Reflections */}
            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Reflections</Text>

                {[
                    entry.reflection_1,
                    entry.reflection_2,
                    entry.reflection_3,
                    entry.reflection_4,
                    entry.reflection_5,
                ].map((reflection, index) => renderReflection(reflection, index))}

                {getAnsweredCount() === 0 && (
                    <View style={styles.noReflectionsContainer}>
                        <Text style={styles.noReflectionsText}>
                            No reflection questions were answered for this entry.
                        </Text>
                    </View>
                )}

                {/* Additional Notes */}
                {entry.notes && entry.notes.trim() && (
                    <View style={styles.notesContainer}>
                        <Text style={styles.sectionTitle}>Additional Notes</Text>
                        <Text style={styles.notesText}>{entry.notes.trim()}</Text>
                    </View>
                )}

                {/* Entry Metadata */}
                <View style={styles.metadataContainer}>
                    <Text style={styles.metadataTitle}>Entry Information</Text>
                    <Text style={styles.metadataText}>Entry ID: {entry.id}</Text>
                    <Text style={styles.metadataText}>
                        Created: {formatDate(entry.created_at || entry.date_created)}
                    </Text>
                    {entry.updated_at && entry.created_at !== entry.updated_at && (
                        <Text style={styles.metadataText}>
                            Last Modified: {formatDate(entry.updated_at)}
                        </Text>
                    )}
                </View>
            </View>

            {/* Close button if in modal */}
            {onClose && (
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        backgroundColor: '#f8f9fa',
        paddingVertical: 24,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerContent: {
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1f2937',
        textAlign: 'center',
        marginBottom: 8,
    },
    studyDate: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 12,
    },
    metaContainer: {
        alignItems: 'center',
    },
    metaText: {
        fontSize: 14,
        color: '#9ca3af',
    },
    actionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    shareButton: {
        backgroundColor: '#10b981',
    },
    shareButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    editButton: {
        backgroundColor: '#3b82f6',
    },
    editButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    deleteButton: {
        backgroundColor: '#ef4444',
    },
    deleteButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    content: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 16,
    },
    reflectionContainer: {
        marginBottom: 24,
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
    },
    questionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        lineHeight: 24,
    },
    answerText: {
        fontSize: 16,
        color: '#4b5563',
        lineHeight: 24,
    },
    noReflectionsContainer: {
        padding: 20,
        alignItems: 'center',
    },
    noReflectionsText: {
        fontSize: 16,
        color: '#9ca3af',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    notesContainer: {
        marginTop: 32,
        padding: 16,
        backgroundColor: '#fff7ed',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    notesText: {
        fontSize: 16,
        color: '#4b5563',
        lineHeight: 24,
    },
    metadataContainer: {
        marginTop: 32,
        padding: 16,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    metadataTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 8,
    },
    metadataText: {
        fontSize: 12,
        color: '#9ca3af',
        marginBottom: 4,
    },
    closeButton: {
        margin: 20,
        paddingVertical: 16,
        backgroundColor: '#6b7280',
        borderRadius: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});