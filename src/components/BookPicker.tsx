import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ALL_BIBLE_BOOKS, BibleBook, NEW_TESTAMENT_BOOKS, OLD_TESTAMENT_BOOKS } from '../data/bibleBooks';

interface BookPickerProps {
    selectedBook?: BibleBook;
    onBookSelect: (book: BibleBook) => void;
    placeholder?: string;
}

export const BookPicker: React.FC<BookPickerProps> = ({
    selectedBook,
    onBookSelect,
    placeholder = 'Choose a book to begin...'
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const getFilteredBooks = (books: BibleBook[]): BibleBook[] => {
        if (searchQuery.trim()) {
            return books.filter(book =>
                book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                book.abbrv.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return books;
    };

    const renderSectionHeader = (title: string, subtitle: string) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
            <View style={styles.sectionLine} />
        </View>
    );

    const renderBookGrid = (books: BibleBook[], isNewTestament = false) => {
        return (
            <View style={[
                styles.booksGrid,
                isNewTestament && styles.newTestamentGrid
            ]}>
                {books.map(book => {
                    const isSelected = selectedBook?.name === book.name;

                    return (
                        <TouchableOpacity
                            key={book.name}
                            style={[
                                styles.bookCard,
                                isSelected && styles.bookCardSelected,
                            ]}
                            onPress={() => onBookSelect(book)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.bookAbbreviation,
                                isSelected && styles.bookAbbreviationSelected
                            ]}>
                                {book.abbrv}
                            </Text>
                            <Text style={[
                                styles.chapterCount,
                                isSelected && styles.chapterCountSelected
                            ]}>
                                {book.chapters}
                            </Text>
                            {isSelected && <View style={styles.selectedDot} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderSearchResults = () => {
        const filteredBooks = getFilteredBooks(ALL_BIBLE_BOOKS);

        if (filteredBooks.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No books found</Text>
                    <Text style={styles.emptyStateSubtext}>
                        Try a different search term
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.searchResults}>
                <View style={styles.searchResultsGrid}>
                    {filteredBooks.map(book => {
                        const isSelected = selectedBook?.name === book.name;

                        return (
                            <TouchableOpacity
                                key={book.name}
                                style={[
                                    styles.bookCard,
                                    styles.searchResultCard,
                                    isSelected && styles.bookCardSelected,
                                ]}
                                onPress={() => onBookSelect(book)}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.bookAbbreviation,
                                    isSelected && styles.bookAbbreviationSelected
                                ]}>
                                    {book.abbrv}
                                </Text>
                                <Text style={[
                                    styles.chapterCount,
                                    isSelected && styles.chapterCountSelected
                                ]}>
                                    {book.chapters}
                                </Text>
                                <Text style={styles.testamentBadge}>
                                    {book.testament === 'Old' ? 'HA' : 'GK'}
                                </Text>
                                {isSelected && <View style={styles.selectedDot} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderContent = () => {
        if (searchQuery.trim()) {
            return renderSearchResults();
        }

        const filteredOT = getFilteredBooks(OLD_TESTAMENT_BOOKS);
        const filteredNT = getFilteredBooks(NEW_TESTAMENT_BOOKS);

        return (
            <View style={styles.booksContainer}>
                {/* Old Testament Section */}
                {renderSectionHeader('Hebrew-Aramic Scriptures', '39 books')}
                {renderBookGrid(filteredOT, false)}

                {/* New Testament Section */}
                {renderSectionHeader('Christian Greek Scriptures', '27 books')}
                {renderBookGrid(filteredNT, true)}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {!selectedBook && (
                <Text style={styles.placeholder}>{placeholder}</Text>
            )}

            <TextInput
                style={styles.searchInput}
                placeholder="Search books..."
                placeholderTextColor="#a39b90"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {renderContent()}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 400,
    },
    placeholder: {
        fontSize: 15,
        color: '#a39b90',
        textAlign: 'center',
        marginBottom: 20,
        fontWeight: '400',
        letterSpacing: 0.3,
    },
    searchInput: {
        backgroundColor: '#fefefe',
        borderWidth: 1,
        borderColor: '#f0ede8',
        borderRadius: 2,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#3d3528',
        marginBottom: 24,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    booksContainer: {
        flex: 1,
    },
    sectionHeader: {
        marginBottom: 16,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '400',
        color: '#6b5b47',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#a39b90',
        fontWeight: '300',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    sectionLine: {
        height: 1,
        backgroundColor: '#f0ede8',
        width: 40,
    },
    booksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    newTestamentGrid: {
        paddingTop: 12,
    },
    bookCard: {
        width: '31%',
        aspectRatio: 1.2,
        backgroundColor: '#fefefe',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#f0ede8',
        marginBottom: 8,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    bookCardSelected: {
        backgroundColor: '#f5f2ed',
        borderRadius: 7,
        borderColor: '#d6d3ce',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    searchResultCard: {
        paddingTop: 8,
    },
    bookAbbreviation: {
        fontSize: 13,
        fontWeight: '500',
        color: '#3d3528',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    bookAbbreviationSelected: {
        color: '#6b5b47',
        fontWeight: '600',
    },
    chapterCount: {
        fontSize: 11,
        color: '#a39b90',
        fontWeight: '300',
        letterSpacing: 0.3,
    },
    chapterCountSelected: {
        color: '#8b7355',
        fontWeight: '400',
    },
    selectedDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#8b7355',
    },
    testamentBadge: {
        position: 'absolute',
        top: 4,
        left: 4,
        fontSize: 8,
        color: '#8b8075',
        backgroundColor: '#f0ede8',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 2,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    searchResults: {
        flex: 1,
    },
    searchResultsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#756b5e',
        fontWeight: '400',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    emptyStateSubtext: {
        fontSize: 13,
        color: '#a39b90',
        fontWeight: '300',
        letterSpacing: 0.3,
    },
});