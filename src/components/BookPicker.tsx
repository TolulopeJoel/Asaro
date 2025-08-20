import React, { useState } from 'react';
import {
    FlatList,
    Modal,
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

type TestamentFilter = 'All' | 'Old' | 'New';

export const BookPicker: React.FC<BookPickerProps> = ({
    selectedBook,
    onBookSelect,
    placeholder = 'Select a book...'
}) => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [testamentFilter, setTestamentFilter] = useState<TestamentFilter>('All');

    const getFilteredBooks = (): BibleBook[] => {
        let books: BibleBook[] = [];

        switch (testamentFilter) {
            case 'Old':
                books = OLD_TESTAMENT_BOOKS;
                break;
            case 'New':
                books = NEW_TESTAMENT_BOOKS;
                break;
            default:
                books = ALL_BIBLE_BOOKS;
        }

        if (searchQuery.trim()) {
            return books.filter(book =>
                book.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return books;
    };

    const handleBookSelect = (book: BibleBook) => {
        onBookSelect(book);
        setIsModalVisible(false);
        setSearchQuery('');
    };

    const renderTestamentFilter = () => (
        <View style={styles.filterContainer}>
            {(['All', 'Old', 'New'] as TestamentFilter[]).map((filter) => (
                <TouchableOpacity
                    key={filter}
                    style={[
                        styles.filterButton,
                        testamentFilter === filter && styles.filterButtonActive
                    ]}
                    onPress={() => setTestamentFilter(filter)}
                >
                    <Text style={[
                        styles.filterButtonText,
                        testamentFilter === filter && styles.filterButtonTextActive
                    ]}>
                        {filter === 'All' ? 'All Books' : `${filter} Testament`}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderBookItem = ({ item }: { item: BibleBook }) => (
        <TouchableOpacity
            style={styles.bookItem}
            onPress={() => handleBookSelect(item)}
        >
            <View style={styles.bookItemContent}>
                <Text style={styles.bookName}>{item.name}</Text>
                <Text style={styles.chapterCount}>{item.chapters} chapters</Text>
            </View>
            <Text style={styles.testament}>{item.testament}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.selector}
                onPress={() => setIsModalVisible(true)}
            >
                <Text style={[
                    styles.selectorText,
                    !selectedBook && styles.placeholderText
                ]}>
                    {selectedBook ? selectedBook.name : placeholder}
                </Text>
                <Text style={styles.arrow}>▼</Text>
            </TouchableOpacity>

            <Modal
                visible={isModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Bible Book</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setIsModalVisible(false)}
                        >
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search books..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    {renderTestamentFilter()}

                    <FlatList
                        data={getFilteredBooks()}
                        renderItem={renderBookItem}
                        keyExtractor={(item) => item.name}
                        style={styles.booksList}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    selector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    selectorText: {
        fontSize: 16,
        color: '#212529',
    },
    placeholderText: {
        color: '#6c757d',
    },
    arrow: {
        fontSize: 12,
        color: '#6c757d',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#212529',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        color: '#6c757d',
    },
    searchInput: {
        margin: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 8,
        gap: 8,
    },
    filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    filterButtonActive: {
        backgroundColor: '#007bff',
        borderColor: '#007bff',
    },
    filterButtonText: {
        fontSize: 14,
        color: '#6c757d',
        fontWeight: '500',
    },
    filterButtonTextActive: {
        color: '#ffffff',
    },
    booksList: {
        flex: 1,
    },
    bookItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f8f9fa',
    },
    bookItemContent: {
        flex: 1,
    },
    bookName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#212529',
        marginBottom: 2,
    },
    chapterCount: {
        fontSize: 14,
        color: '#6c757d',
    },
    testament: {
        fontSize: 12,
        color: '#6c757d',
        backgroundColor: '#f8f9fa',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
});