import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Animated,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ALL_BIBLE_BOOKS, BibleBook, getChapterNumbers } from '../data/bibleBooks';
import { ScalePressable } from './ScalePressable';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChapterRange {
    start: number;
    end?: number;
}

interface VerseRange {
    start: string;
    end: string;
}

export interface BibleReferencePickerProps {
    visible: boolean;
    query?: string;           // letters typed after @, used to pre-filter books
    onSelect: (reference: string) => void;
    onDismiss: () => void;
}

// ─── Reference formatter ──────────────────────────────────────────────────────

function formatReference(book: BibleBook, chapters: ChapterRange, verses: VerseRange | null): string {
    const { start, end } = chapters;
    const hasRange = end !== undefined && end !== start;

    if (!verses) {
        return hasRange ? `${book.name} ${start}–${end}` : `${book.name} ${start}`;
    }

    const { start: vs, end: ve } = verses;
    if (hasRange) {
        const sp = vs ? `:${vs}` : '';
        const ep = ve ? `:${ve}` : '';
        return `${book.name} ${start}${sp}–${end}${ep}`;
    }
    if (vs && ve) return `${book.name} ${start}:${vs}–${ve}`;
    if (vs) return `${book.name} ${start}:${vs}`;
    return `${book.name} ${start}`;
}

// ─── Chapter step ─────────────────────────────────────────────────────────────

function ChapterStep({
    book,
    onBack,
    onConfirm,
}: {
    book: BibleBook;
    onBack: () => void;
    onConfirm: (ref: string) => void;
}) {
    const { colors } = useTheme();
    const [sel, setSel] = useState<ChapterRange>({ start: 0 });
    const [specifyVerses, setSpecifyVerses] = useState(false);
    const [startVerse, setStartVerse] = useState('');
    const [endVerse, setEndVerse] = useState('');

    const chapters = getChapterNumbers(book.name);
    const hasSelection = sel.start > 0;
    const hasRange = !!(sel.end && sel.end !== sel.start);

    const handleChapterPress = (ch: number) => {
        if (sel.start === 0) { setSel({ start: ch }); return; }
        if (sel.start === ch && !sel.end) { setSel({ start: 0 }); return; }
        const inRange = ch >= sel.start && ch <= (sel.end ?? sel.start);
        if (inRange) { setSel({ start: ch }); return; }
        if (ch < sel.start) { setSel({ start: ch, end: sel.end ?? sel.start }); return; }
        setSel({ start: sel.start, end: ch });
    };

    const isInSel = (ch: number) => {
        if (sel.start === 0) return false;
        return ch >= sel.start && ch <= (sel.end ?? sel.start);
    };

    const getLabel = () => {
        if (!hasSelection) return '';
        const { start, end } = sel;
        if (!end || end === start) {
            const vStr = specifyVerses && startVerse ? `:${startVerse}${endVerse ? `–${endVerse}` : ''}` : '';
            return `${book.name} ${start}${vStr}`;
        }
        if (specifyVerses) {
            const s = startVerse ? `:${startVerse}` : '';
            const e = endVerse ? `:${endVerse}` : '';
            return `${book.name} ${start}${s}–${end}${e}`;
        }
        return `${book.name} ${start}–${end}`;
    };

    const handleInsert = () => {
        const verses: VerseRange | null = specifyVerses ? { start: startVerse, end: endVerse } : null;
        onConfirm(formatReference(book, sel, verses));
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Back + book name row */}
            <View style={panelStyles.chapterHeader}>
                <TouchableOpacity onPress={onBack} style={panelStyles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                    <Text style={[panelStyles.backText, { color: colors.textSecondary }]}>books</Text>
                </TouchableOpacity>
                <Text style={[panelStyles.bookLabel, { color: colors.textPrimary }]}>{book.name}</Text>
            </View>

            {/* Chapter grid – scrollable */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={panelStyles.chapterScroll}
                contentContainerStyle={panelStyles.chaptersGrid}
                keyboardShouldPersistTaps="always"
            >
                {chapters.map((ch) => {
                    const selected = isInSel(ch);
                    const isStart = sel.start === ch;
                    const isEnd = sel.end === ch;
                    const isMiddle = selected && !isStart && !isEnd && hasRange;
                    let r = {};
                    if (hasRange) {
                        if (isStart) r = { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderTopRightRadius: 2, borderBottomRightRadius: 2 };
                        else if (isEnd) r = { borderTopLeftRadius: 2, borderBottomLeftRadius: 2, borderTopRightRadius: 8, borderBottomRightRadius: 8 };
                        else if (isMiddle) r = { borderRadius: 2 };
                    }
                    return (
                        <ScalePressable
                            key={ch}
                            style={[
                                panelStyles.chBtn,
                                { backgroundColor: colors.cardBackground, borderColor: colors.border + '60' },
                                selected && { backgroundColor: colors.accent + '18', borderColor: colors.accent },
                                r,
                                isMiddle && panelStyles.chBtnMiddle,
                            ] as any}
                            onPress={() => handleChapterPress(ch)}
                        >
                            <Text style={[panelStyles.chBtnText, { color: selected ? colors.textPrimary : colors.textSecondary }, selected && { fontWeight: '700' }]}>
                                {ch}
                            </Text>
                        </ScalePressable>
                    );
                })}
            </ScrollView>

            {/* Verse toggle + verse inputs row */}
            {hasSelection && (
                <View style={panelStyles.verseRow}>
                    <TouchableOpacity style={panelStyles.verseToggle} onPress={() => setSpecifyVerses(v => !v)}>
                        <View style={[panelStyles.checkbox, { borderColor: colors.border }, specifyVerses && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                            {specifyVerses && <Ionicons name="checkmark" size={11} color={colors.buttonPrimaryText} />}
                        </View>
                        <Text style={[panelStyles.verseToggleText, { color: colors.textTertiary }]}>verses</Text>
                    </TouchableOpacity>

                    {specifyVerses && (
                        <View style={panelStyles.verseInputsRow}>
                            <TextInput
                                style={[panelStyles.verseInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
                                value={startVerse}
                                onChangeText={setStartVerse}
                                keyboardType="numeric"
                                placeholder={hasRange ? 'from' : 'v.'}
                                placeholderTextColor={colors.textTertiary}
                            />
                            <Text style={[{ color: colors.textTertiary, fontSize: 12 }]}>–</Text>
                            <TextInput
                                style={[panelStyles.verseInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
                                value={endVerse}
                                onChangeText={setEndVerse}
                                keyboardType="numeric"
                                placeholder="to"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>
                    )}

                    {hasSelection && (
                        <ScalePressable
                            style={[panelStyles.insertBtn, { backgroundColor: colors.accent }]}
                            onPress={handleInsert}
                        >
                            <Text style={[panelStyles.insertBtnText, { color: colors.buttonPrimaryText }]}>Insert</Text>
                        </ScalePressable>
                    )}
                </View>
            )}
        </View>
    );
}

// ─── Main inline picker ───────────────────────────────────────────────────────

export const BibleReferencePicker: React.FC<BibleReferencePickerProps> = ({
    visible,
    query = '',
    onSelect,
    onDismiss,
}) => {
    const { colors } = useTheme();
    const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
    const slideAnim = useRef(new Animated.Value(0)).current;

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
            }, 200);
        }
    }, [visible]);

    // Filter books by the letters typed after @
    const filteredBooks = useMemo(() => {
        if (!query.trim()) return ALL_BIBLE_BOOKS;
        const q = query.toLowerCase();
        return ALL_BIBLE_BOOKS.filter(b =>
            b.name.toLowerCase().startsWith(q) ||
            b.abbrv.toLowerCase().startsWith(q)
        );
    }, [query]);

    const handleSelect = (ref: string) => {
        setSelectedBook(null);
        onSelect(ref);
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                panelStyles.panel,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                    shadowColor: '#000',
                    opacity: slideAnim,
                    transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
                },
            ]}
        >
            {/* Dismiss strip */}
            <View style={panelStyles.panelHeader}>
                <Text style={[panelStyles.panelHint, { color: colors.textTertiary }]}>
                    {selectedBook ? `${selectedBook.name} — tap chapters` : 'Reference a passage'}
                </Text>
                <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
            </View>

            {!selectedBook ? (
                /* ── Book list (no search bar — filtered by @query) ── */
                <ScrollView
                    style={{ maxHeight: 200 }}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                >
                    {filteredBooks.length === 0 ? (
                        <Text style={[panelStyles.emptyText, { color: colors.textTertiary }]}>No matching book</Text>
                    ) : (
                        filteredBooks.map((item, index) => (
                            <ScalePressable
                                key={item.name}
                                style={[panelStyles.bookRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border + '40' }]}
                                onPress={() => setSelectedBook(item)}
                            >
                                <Text style={[panelStyles.bookName, { color: colors.textPrimary }]}>{item.name}</Text>
                                <Text style={[panelStyles.bookChapters, { color: colors.textTertiary }]}>{item.chapters} ch</Text>
                            </ScalePressable>
                        ))
                    )}
                </ScrollView>
            ) : (
                /* ── Chapter picker ── */
                <View style={{ maxHeight: 280 }}>
                    <ChapterStep
                        book={selectedBook}
                        onBack={() => setSelectedBook(null)}
                        onConfirm={handleSelect}
                    />
                </View>
            )}
        </Animated.View>
    );
};

BibleReferencePicker.displayName = 'BibleReferencePicker';

// ─── Styles ───────────────────────────────────────────────────────────────────

const panelStyles = StyleSheet.create({
    panel: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 1000,
        marginTop: 4,
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    panelHint: {
        fontSize: Typography.size.xs,
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    bookRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    bookName: {
        fontSize: Typography.size.md,
        fontWeight: '500',
    },
    bookChapters: {
        fontSize: Typography.size.xs,
        fontWeight: '400',
    },
    emptyText: {
        fontSize: Typography.size.sm,
        fontWeight: '400',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    // Chapter step
    chapterHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xs,
        gap: Spacing.sm,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    backText: {
        fontSize: Typography.size.xs,
        fontWeight: '500',
    },
    bookLabel: {
        fontSize: Typography.size.md,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    chapterScroll: {
        flexGrow: 0,
    },
    chaptersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    chBtn: {
        width: 40,
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chBtnMiddle: {
        marginLeft: -3,
        marginRight: -3,
    },
    chBtnText: {
        fontSize: 13,
        fontWeight: '500',
    },
    // Verse row
    verseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    verseToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    verseToggleText: {
        fontSize: Typography.size.xs,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    verseInputsRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    verseInput: {
        width: 44,
        height: 32,
        borderWidth: 1,
        borderRadius: 6,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '600',
    },
    insertBtn: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 7,
        borderRadius: Spacing.borderRadius.sm,
        marginLeft: 'auto',
    },
    insertBtnText: {
        fontSize: Typography.size.sm,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
