import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ALL_BIBLE_BOOKS, BibleBook } from '../data/bibleBooks';
import { Ionicons } from '@expo/vector-icons';

interface BibleReferencePickerProps {
    visible: boolean;
    query?: string;
    onSelect: (ref: string) => void;
    onDismiss: () => void;
    onInteraction?: () => void;
}

/**
 * A minimalist horizontal suggestion ribbon for Bible references.
 * Phase 1: Book chips (filtered by @query)
 * Phase 2: Chapter chips (shown after book selection)
 * Tapping a chapter completes the reference.
 * Long-pressing a chapter adds a colon for verse entry.
 */
export const BibleReferencePicker: React.FC<BibleReferencePickerProps> = ({
    visible,
    query = '',
    onSelect,
    onDismiss,
    onInteraction,
}) => {
    const { colors } = useTheme();
    const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 1 : 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();

        if (!visible) {
            setTimeout(() => {
                setSelectedBook(null);
                fadeAnim.setValue(1);
            }, 200);
        }
    }, [visible, slideAnim, fadeAnim]);

    // Filter books by the letters typed after @
    const filteredBooks = useMemo(() => {
        if (!query.trim()) return ALL_BIBLE_BOOKS;
        const q = query.toLowerCase();
        return ALL_BIBLE_BOOKS.filter(b =>
            b.name.toLowerCase().startsWith(q) ||
            b.abbrv.toLowerCase().startsWith(q)
        );
    }, [query]);

    const handleBookSelect = (book: BibleBook) => {
        // Morph animation: fade out, switch, fade in
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();

        setTimeout(() => setSelectedBook(book), 100);
    };

    const handleChapterSelect = (chapter: number, includeColon: boolean = false) => {
        onInteraction?.();
        const ref = `${selectedBook?.name} ${chapter}${includeColon ? ':' : ''}`;
        onSelect(ref);
        setSelectedBook(null);
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.ribbonContainer,
                {
                    opacity: slideAnim,
                    transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                },
            ]}
        >
            <View style={[styles.ribbon, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                {/* Close button - always visible on the left */}
                <TouchableOpacity
                    onPress={onDismiss}
                    style={[styles.closeBtn, { borderRightColor: colors.border }]}
                >
                    <Ionicons name="close" size={18} color={colors.textTertiary} />
                </TouchableOpacity>

                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="always"
                        contentContainerStyle={styles.scrollContent}
                    >
                        {!selectedBook ? (
                            // Phase 1: Book Suggestions
                            filteredBooks.length === 0 ? (
                                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No matching book</Text>
                            ) : (
                                filteredBooks.map((book) => (
                                    <TouchableOpacity
                                        key={book.name}
                                        onPressIn={() => onInteraction?.()}
                                        onPress={() => handleBookSelect(book)}
                                        style={[styles.pill, { backgroundColor: colors.background, borderColor: colors.border }]}
                                    >
                                        <Text style={[styles.pillText, { color: colors.text }]}>{book.name}</Text>
                                    </TouchableOpacity>
                                ))
                            )
                        ) : (
                            // Phase 2: Chapter Suggestions
                            <>
                                <TouchableOpacity
                                    onPressIn={() => onInteraction?.()}
                                    onPress={() => setSelectedBook(null)}
                                    style={[styles.pill, styles.backPill, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                                >
                                    <Ionicons name="chevron-back" size={14} color={colors.primary} />
                                    <Text style={[styles.pillText, { color: colors.primary, fontWeight: '700' }]}>{selectedBook.abbrv}</Text>
                                </TouchableOpacity>

                                {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((ch) => (
                                    <TouchableOpacity
                                        key={ch}
                                        onPressIn={() => onInteraction?.()}
                                        onPress={() => handleChapterSelect(ch)}
                                        onLongPress={() => handleChapterSelect(ch, true)}
                                        delayLongPress={250}
                                        style={[styles.pill, { backgroundColor: colors.background, borderColor: colors.border }]}
                                    >
                                        <Text style={[styles.pillText, { color: colors.text }]}>{ch}</Text>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                    </ScrollView>
                </Animated.View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    ribbonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingBottom: Platform.OS === 'ios' ? 8 : 4, // Safety padding
    },
    ribbon: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 26,
        borderWidth: 1,
        overflow: 'hidden',
        // Premium shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    closeBtn: {
        width: 44,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
    },
    scrollContent: {
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        gap: Spacing.xs,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 44,
    },
    backPill: {
        flexDirection: 'row',
        paddingLeft: 10,
        gap: 2,
    },
    pillText: {
        fontSize: Typography.size.sm,
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    emptyText: {
        fontSize: Typography.size.xs,
        fontWeight: '500',
        paddingHorizontal: Spacing.md,
    },
});

BibleReferencePicker.displayName = 'BibleReferencePicker';
