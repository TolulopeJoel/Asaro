import { JournalEntry, getEntriesByBook, getJournalEntries, getTotalEntryCount, searchEntries } from '@/src/data/database';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface JournalEntryListProps {
    onEntryPress: (entry: JournalEntry) => void;
    filterBook?: string;
}

type SortOption = 'newest' | 'oldest' | 'book';

export const JournalEntryList: React.FC<JournalEntryListProps> = ({
    onEntryPress,
    filterBook,
}) => {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [totalCount, setTotalCount] = useState(0);

    // Load entries
    const loadEntries = useCallback(async () => {
        try {
            let loadedEntries: JournalEntry[] = [];

            if (searchQuery.trim()) {
                // Search mode
                loadedEntries = searchEntries(searchQuery.trim());
            } else if (filterBook) {
                // Filter by specific book
                loadedEntries = getEntriesByBook(filterBook);
            } else {
                // Load all entries
                loadedEntries = getJournalEntries(100, 0); // Load first 100 entries
            }

            // Apply sorting
            switch (sortBy) {
                case 'oldest':
                    loadedEntries.sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
                    break;
                case 'book':
                    loadedEntries.sort((a, b) => {
                        const bookComparison = a.book_name.localeCompare(b.book_name);
                        if (bookComparison !== 0) return bookComparison;
                        return (a.chapter_start || 0) - (b.chapter_start || 0);
                    });
                    break;
                case 'newest':
                default:
                    loadedEntries.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
                    break;
            }

            setEntries(loadedEntries);
            setTotalCount(getTotalEntryCount());
        } catch (error) {
            console.error('Error loading entries:', error);
            setEntries([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [searchQuery, filterBook, sortBy]);

    // Initial load and reload when dependencies change
    useEffect(() => {
        setLoading(true);
        loadEntries();
    }, [loadEntries]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadEntries();
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatChapterRange = (entry: JournalEntry): string => {
        if (!entry.chapter_start) return '';

        if (entry.chapter_end && entry.chapter_end !== entry.chapter_start) {
            return `${entry.chapter_start}-${entry.chapter_end}`;
        }
        return entry.chapter_start.toString();
    };

    const getPreviewText = (entry: JournalEntry): string => {
        // Get the first non-empty reflection as preview
        const reflections = [
            entry.reflection_1,
            entry.reflection_2,
            entry.reflection_3,
            entry.reflection_4,
            entry.reflection_5,
        ].filter(r => r && r.trim().length > 0);

        if (reflections.length > 0) {
            const preview = reflections[0]!.trim();
            return preview.length > 120 ? `${preview.substring(0, 120)}...` : preview;
        }

        return entry.notes?.trim().substring(0, 120) + '...' || 'No content available';
    };

    const getAnsweredCount = (entry: JournalEntry): number => {
        return [
            entry.reflection_1,
            entry.reflection_2,
            entry.reflection_3,
            entry.reflection_4,
            entry.reflection_5,
        ].filter(r => r && r.trim().length > 0).length;
    };

    const renderSortButtons = () => (
        <View style={styles.sortContainer}>
            {[
                { key: 'newest', label: 'Newest' },
                { key: 'oldest', label: 'Oldest' },
                { key: 'book', label: 'By Book' },
            ].map(({ key, label }) => (
                <TouchableOpacity
                    key={key}
                    style={[
                        styles.sortButton,
                        sortBy === key && styles.sortButtonActive,
                    ]}
                    onPress={() => setSortBy(key as SortOption)}
                >
                    <Text style={[
                        styles.sortButtonText,
                        sortBy === key && styles.sortButtonTextActive,
                    ]}>
                        {label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                    {entries.length} of {totalCount} entries
                    {filterBook && ` in ${filterBook}`}
                    {searchQuery && ` matching "${searchQuery}"`}
                </Text>
            </View>

            <TextInput
                style={styles.searchInput}
                placeholder="Search your reflections..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
            />

            {renderSortButtons()}
        </View>
    );

    const renderEntry = ({ item }: { item: JournalEntry }) => (
        <TouchableOpacity
            style={styles.entryCard}
            onPress={() => onEntryPress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.entryHeader}>
                <View style={styles.entryTitleContainer}>
                    <Text style={styles.entryTitle}>
                        {item.book_name} {formatChapterRange(item)}
                    </Text>
                    <Text style={styles.entryDate}>
                        {formatDate(item.date_created)}
                    </Text>
                </View>
                <View style={styles.entryMeta}>
                    <Text style={styles.answerCount}>
                        {getAnsweredCount(item)}/5 answered
                    </Text>
                </View>
            </View>

            <Text style={styles.entryPreview} numberOfLines={3}>
                {getPreviewText(item)}
            </Text>

            <View style={styles.entryFooter}>
                <Text style={styles.entryFooterText}>
                    Created {formatDate(item.created_at || item.date_created)}
                </Text>
                <Text style={styles.readMore}>Tap to read →</Text>
            </View>
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matching entries' : 'No journal entries yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
                {searchQuery
                    ? `Try searching for different terms`
                    : 'Start your Bible study journey by creating your first reflection'
                }
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Loading your journal entries...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={entries}
                renderItem={renderEntry}
                keyExtractor={(item) => item.id!.toString()}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#007bff']}
                        tintColor="#007bff"
                    />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={entries.length === 0 ? styles.emptyList : undefined}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    headerContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    statsContainer: {
        marginBottom: 16,
    },
    statsText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    searchInput: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e9ecef',
        marginBottom: 16,
    },
    sortContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    sortButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        alignItems: 'center',
    },
    sortButtonActive: {
        backgroundColor: '#007bff',
        borderColor: '#007bff',
    },
    sortButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
    },
    sortButtonTextActive: {
        color: '#ffffff',
    },
    entryCard: {
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 16,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    entryTitleContainer: {
        flex: 1,
    },
    entryTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    entryDate: {
        fontSize: 14,
        color: '#6b7280',
    },
    entryMeta: {
        alignItems: 'flex-end',
    },
    answerCount: {
        fontSize: 12,
        color: '#059669',
        backgroundColor: '#d1fae5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    entryPreview: {
        fontSize: 14,
        color: '#4b5563',
        lineHeight: 20,
        marginBottom: 12,
    },
    entryFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    entryFooterText: {
        fontSize: 12,
        color: '#9ca3af',
    },
    readMore: {
        fontSize: 12,
        color: '#007bff',
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#4b5563',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 24,
    },
    emptyList: {
        flexGrow: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 12,
    },
});