import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    InputAccessoryView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ALL_BIBLE_BOOKS, BibleBook } from '../data/bibleBooks';
import { Ionicons } from '@expo/vector-icons';

const CHIP_THRESHOLD = 30;

/**
 * Phase flow:
 *
 *   book → chapter → suffix ──→ Done
 *                         ├──→ :Verse → verse → verse-suffix ──→ Done
 *                         │                             └──→ –Range → end-chapter → end-verse
 *                         └──→ –Range → end-chapter (no verse = Done, has verse → end-verse)
 *
 * The key difference from a wizard: every tap/input immediately updates the
 * TextInput via onPreview so the user sees the reference being built in real time.
 * onSelect is only called once — at the very end.
 */
type Phase =
    | 'book'
    | 'chapter'
    | 'suffix'
    | 'verse'
    | 'verse-suffix'
    | 'end-chapter'
    | 'end-verse';

interface BibleReferencePickerProps {
    visible: boolean;
    query?: string;
    onPreview: (partialRef: string) => void;
    onSelect: (finalRef: string) => void;
    onDismiss: () => void;
    onInteraction?: () => void;
    floating?: boolean; // If true, wraps in a transparent Modal + KeyboardAvoidingView
}

export const BibleReferencePicker: React.FC<BibleReferencePickerProps> = ({
    visible,
    query = '',
    onPreview,
    onSelect,
    onDismiss,
    onInteraction,
    floating = false,
}) => {
    const { colors } = useTheme();

    const [phase, setPhase] = useState<Phase>('book');
    const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
    const [startChapter, setStartChapter] = useState<number | null>(null);
    const [startVerse, setStartVerse] = useState('');
    const [endChapter, setEndChapter] = useState<number | null>(null);
    const [chapterInput, setChapterInput] = useState('');
    const [verseInput, setVerseInput] = useState('');

    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const verseInputRef = useRef<TextInput>(null);
    const chapterInputRef = useRef<TextInput>(null);

    const resetState = () => {
        setPhase('book');
        setSelectedBook(null);
        setStartChapter(null);
        setStartVerse('');
        setEndChapter(null);
        setChapterInput('');
        setVerseInput('');
    };

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 1 : 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();
        if (!visible) {
            setTimeout(() => { resetState(); fadeAnim.setValue(1); }, 200);
        }
    }, [visible, slideAnim, fadeAnim]);

    const filteredBooks = useMemo(() => {
        if (!query.trim()) return ALL_BIBLE_BOOKS;
        const q = query.toLowerCase();
        return ALL_BIBLE_BOOKS.filter(b =>
            b.name.toLowerCase().startsWith(q) ||
            b.abbrv.toLowerCase().startsWith(q)
        );
    }, [query]);

    const morph = (fn: () => void) => {
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        setTimeout(fn, 100);
    };

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleBookSelect = (book: BibleBook) => {
        onInteraction?.();
        onPreview(book.name); // "@Rom" → "Romans" live in TextInput
        morph(() => { setSelectedBook(book); setPhase('chapter'); });
    };

    const handleChapterSelect = (ch: number) => {
        onInteraction?.();
        onPreview(`${selectedBook!.name} ${ch}`); // "Romans" → "Romans 5"
        morph(() => { setStartChapter(ch); setChapterInput(''); setPhase('suffix'); });
    };

    const handleDone = () => {
        const book = selectedBook!.name;
        const sc = startChapter!;
        // verse-suffix Done also reaches here
        onSelect(startVerse ? `${book} ${sc}:${startVerse}` : `${book} ${sc}`);
        resetState();
    };

    const handleAddVerse = () => {
        onInteraction?.();
        onPreview(`${selectedBook!.name} ${startChapter!}:`); // "Romans 5" → "Romans 5:"
        morph(() => { setVerseInput(''); setPhase('verse'); });
    };

    const handleAddRange = () => {
        onInteraction?.();
        const book = selectedBook!.name;
        const sc = startChapter!;
        const sv = startVerse;
        // "Romans 5" → "Romans 5–"  or  "Romans 5:3" → "Romans 5:3–"
        onPreview(sv ? `${book} ${sc}:${sv}-` : `${book} ${sc}-`);
        morph(() => { setChapterInput(''); setPhase('end-chapter'); });
    };

    // Live: fires on every keystroke in the verse input
    const handleVerseInputChange = (v: string) => {
        setVerseInput(v);
        onPreview(`${selectedBook!.name} ${startChapter!}:${v}`); // "Romans 5:" → "Romans 5:3"
    };

    const handleVerseConfirm = () => {
        if (!verseInput.trim()) return;
        morph(() => { setStartVerse(verseInput); setVerseInput(''); setPhase('verse-suffix'); });
    };

    const handleEndChapterSelect = (ch: number) => {
        onInteraction?.();
        const book = selectedBook!.name;
        const sc = startChapter!;
        const sv = startVerse;

        if (!sv) {
            // Pure chapter range — we're done: "Romans 5–6"
            onSelect(`${book} ${sc}-${ch}`);
            resetState();
        } else {
            // Has start verse — need end verse: "Romans 13:12–14:"
            onPreview(`${book} ${sc}:${sv}-${ch}:`);
            morph(() => { setEndChapter(ch); setVerseInput(''); setPhase('end-verse'); });
        }
    };

    // Live: fires on every keystroke in the end-verse input
    const handleEndVerseInputChange = (v: string) => {
        setVerseInput(v);
        const book = selectedBook!.name;
        const sc = startChapter!;
        const sv = startVerse;
        const ec = endChapter ?? sc;
        // "Romans 5:1–7" or "Romans 13:12–14:1"
        onPreview(ec === sc ? `${book} ${sc}:${sv}-${v}` : `${book} ${sc}:${sv}-${ec}:${v}`);
    };

    const handleEndVerseConfirm = () => {
        if (!verseInput.trim()) return;
        const book = selectedBook!.name;
        const sc = startChapter!;
        const sv = startVerse;
        const ec = endChapter ?? sc;
        const ref = ec === sc
            ? `${book} ${sc}:${sv}-${verseInput}`
            : `${book} ${sc}:${sv}-${ec}:${verseInput}`;
        onSelect(ref);
        resetState();
    };

    // ── Back navigation ───────────────────────────────────────────────────────

    const goBack = () => {
        onInteraction?.();
        const book = selectedBook?.name ?? '';
        const sc = startChapter;
        const sv = startVerse;

        morph(() => {
            switch (phase) {
                case 'chapter':
                    // Don't touch text — user can select different book and it'll overwrite
                    setPhase('book');
                    setSelectedBook(null);
                    break;
                case 'suffix':
                    onPreview(book); // "Romans 5" → "Romans"
                    setPhase('chapter');
                    setStartChapter(null);
                    break;
                case 'verse':
                    onPreview(`${book} ${sc}`); // "Romans 5:" → "Romans 5"
                    setVerseInput('');
                    setPhase('suffix');
                    break;
                case 'verse-suffix':
                    // Restore verse input so user can edit it
                    onPreview(`${book} ${sc}:${sv}`); // stays the same
                    setVerseInput(sv);
                    setStartVerse('');
                    setPhase('verse');
                    break;
                case 'end-chapter':
                    setChapterInput('');
                    if (sv) {
                        onPreview(`${book} ${sc}:${sv}`); // "Romans 5:3–" → "Romans 5:3"
                        setPhase('verse-suffix');
                    } else {
                        onPreview(`${book} ${sc}`); // "Romans 5–" → "Romans 5"
                        setPhase('suffix');
                    }
                    break;
                case 'end-verse':
                    onPreview(`${book} ${sc}:${sv}-`); // "Romans 13:12–14:1" → "Romans 13:12–"
                    setEndChapter(null);
                    setVerseInput('');
                    setPhase('end-chapter');
                    break;
            }
        });
    };

    // ── Shared sub-components ─────────────────────────────────────────────────

    const BackPill = ({ label }: { label: string }) => (
        <TouchableOpacity
            onPressIn={() => onInteraction?.()}
            onPress={goBack}
            style={[styles.pill, styles.backPill, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
        >
            <Ionicons name="chevron-back" size={14} color={colors.primary} />
            <Text style={[styles.pillText, { color: colors.primary, fontWeight: '700' }]}>{label}</Text>
        </TouchableOpacity>
    );

    const ActionPill = ({ label, onPress }: { label: string; onPress: () => void }) => (
        <TouchableOpacity
            onPressIn={() => onInteraction?.()}
            onPress={onPress}
            style={[styles.pill, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
            <Text style={[styles.pillText, { color: colors.text }]}>{label}</Text>
        </TouchableOpacity>
    );

    /**
     * A number input that calls onChange on every keystroke (for live preview)
     * and onSubmit when user confirms.
     */
    const LiveNumberInput = ({
        inputRef,
        value,
        onChange,
        placeholder,
        onSubmit,
        confirmIcon = 'checkmark',
        min,
    }: {
        inputRef: React.RefObject<TextInput | null>;
        value: string;
        onChange: (v: string) => void;
        placeholder: string;
        onSubmit: () => void;
        confirmIcon?: string;
        min?: number;
    }) => (
        <View style={styles.inputWrapper}>
            <TextInput
                ref={inputRef}
                style={[styles.numberInput, { color: colors.text, borderColor: colors.border }]}
                placeholder={placeholder}
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={value}
                onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
                onSubmitEditing={() => {
                    if (min && parseInt(value, 10) < min) return;
                    onSubmit();
                }}
                returnKeyType="done"
                maxLength={3}
                autoFocus
            />
            <TouchableOpacity
                onPressIn={() => onInteraction?.()}
                onPress={() => {
                    if (min && parseInt(value, 10) < min) return;
                    onSubmit();
                }}
                style={[styles.pill, {
                    backgroundColor: value ? colors.primary : colors.background,
                    borderColor: value ? colors.primary : colors.border,
                }]}
            >
                <Ionicons name={confirmIcon as any} size={14} color={value ? '#fff' : colors.textTertiary} />
            </TouchableOpacity>
        </View>
    );

    const ChapterPills = ({
        book,
        onChapterSelect,
        min,
    }: {
        book: BibleBook;
        onChapterSelect: (ch: number) => void;
        min?: number;
    }) => {
        if (book.chapters <= CHIP_THRESHOLD) {
            const allChapters = Array.from({ length: book.chapters }, (_, i) => i + 1);
            const chaptersToShow = min ? allChapters.filter(ch => ch >= min) : allChapters;
            return (
                <>
                    {chaptersToShow.map((ch) => (
                        <TouchableOpacity
                            key={ch}
                            onPressIn={() => onInteraction?.()}
                            onPress={() => onChapterSelect(ch)}
                            style={[styles.pill, { backgroundColor: colors.background, borderColor: colors.border }]}
                        >
                            <Text style={[styles.pillText, { color: colors.text }]}>{ch}</Text>
                        </TouchableOpacity>
                    ))}
                </>
            );
        }
        // Long book (Psalms etc.) — number input, no live preview until confirmed
        return (
            <LiveNumberInput
                inputRef={chapterInputRef}
                value={chapterInput}
                onChange={setChapterInput}
                placeholder={min ? `${min}–${book.chapters}` : `1–${book.chapters}`}
                onSubmit={() => {
                    const ch = parseInt(chapterInput, 10);
                    if (ch >= (min || 1) && ch <= book.chapters) onChapterSelect(ch);
                }}
                min={min}
                confirmIcon="arrow-forward"
            />
        );
    };

    // ── Phase content ─────────────────────────────────────────────────────────

    const renderContent = () => {
        if (!selectedBook && phase !== 'book') return null;
        const book = selectedBook!;
        const sc = startChapter!;

        switch (phase) {
            case 'book':
                return filteredBooks.length === 0
                    ? <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No matching book</Text>
                    : filteredBooks.map((b) => (
                        <TouchableOpacity
                            key={b.name}
                            onPressIn={() => onInteraction?.()}
                            onPress={() => handleBookSelect(b)}
                            style={[styles.pill, { backgroundColor: colors.background, borderColor: colors.border }]}
                        >
                            <Text style={[styles.pillText, { color: colors.text }]}>{b.name}</Text>
                        </TouchableOpacity>
                    ));

            case 'chapter':
                return (
                    <>
                        <BackPill label={book.abbrv} />
                        <ChapterPills book={book} onChapterSelect={handleChapterSelect} />
                    </>
                );

            case 'suffix':
                return (
                    <>
                        <BackPill label={`${book.abbrv} ${sc}`} />
                        <ActionPill label=": Verse" onPress={handleAddVerse} />
                        <ActionPill label="– Range" onPress={handleAddRange} />
                        <ActionPill label="Done ✓" onPress={handleDone} />
                    </>
                );

            case 'verse':
                return (
                    <>
                        <BackPill label={`${book.abbrv} ${sc}:`} />
                        <LiveNumberInput
                            inputRef={verseInputRef}
                            value={verseInput}
                            onChange={handleVerseInputChange}
                            placeholder="verse"
                            onSubmit={handleVerseConfirm}
                        />
                    </>
                );

            case 'verse-suffix':
                return (
                    <>
                        <BackPill label={`${book.abbrv} ${sc}:${startVerse}`} />
                        <ActionPill label="– Range" onPress={handleAddRange} />
                        <ActionPill label="Done ✓" onPress={handleDone} />
                    </>
                );

            case 'end-chapter':
                return (
                    <>
                        <BackPill label={startVerse ? `${book.abbrv} ${sc}:${startVerse}–` : `${book.abbrv} ${sc}–`} />
                        <ChapterPills book={book} onChapterSelect={handleEndChapterSelect} min={sc} />
                    </>
                );

            case 'end-verse':
                {
                    const ec = endChapter ?? sc;
                    const minVerse = (ec === sc) ? parseInt(startVerse, 10) : undefined;
                    return (
                        <>
                            <BackPill label={`${book.abbrv} ${sc}:${startVerse}–${ec}:`} />
                            <LiveNumberInput
                                inputRef={verseInputRef}
                                value={verseInput}
                                onChange={handleEndVerseInputChange}
                                placeholder="verse"
                                onSubmit={handleEndVerseConfirm}
                                min={minVerse}
                            />
                        </>
                    );
                }
        }
    };

    if (!visible) return null;

    const content = (
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
                        {renderContent()}
                    </ScrollView>
                </Animated.View>
            </View>
        </Animated.View>
    );

    if (floating) {
        if (Platform.OS === 'ios') {
            return (
                <InputAccessoryView nativeID="bible-picker">
                    {content}
                </InputAccessoryView>
            );
        }
        return content;
    }

    return content;
};

const styles = StyleSheet.create({
    ribbonContainer: {
        width: '100%',
        zIndex: 1000,
        backgroundColor: 'transparent',
    },
    ribbon: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        borderRadius: 26,
        borderWidth: 1,
        overflow: 'hidden',
        /* High-end subtle glassmorphism */
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        marginHorizontal: 12,
        marginBottom: Platform.OS === 'ios' ? 8 : 12,
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
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.xs,
    },
    numberInput: {
        fontSize: Typography.size.sm,
        fontWeight: '500',
        width: 64,
        height: 36,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 14,
        letterSpacing: 0.1,
    },
});

BibleReferencePicker.displayName = 'BibleReferencePicker';
