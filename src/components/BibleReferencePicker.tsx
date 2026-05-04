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

type Phase =
    | 'book'
    | 'chapter'
    | 'suffix'
    | 'verse'
    | 'verse-suffix'
    | 'range-type'
    | 'end-chapter'
    | 'end-verse';

interface BibleReferencePickerProps {
    visible: boolean;
    query?: string;
    onPreview: (partialRef: string) => void;
    onSelect: (finalRef: string) => void;
    onDismiss: () => void;
    onInteraction?: () => void;
    floating?: boolean;
}

// ── Sub-components defined OUTSIDE BibleReferencePicker ───────────────────
// This is critical: defining them inside would cause React to see a new
// component type on every render, forcing unmount/remount and keyboard cycles.

const BackPill = ({
    label,
    onPress,
    onInteraction,
    colors,
}: {
    label: string;
    onPress: () => void;
    onInteraction?: () => void;
    colors: any;
}) => (
    <TouchableOpacity
        onPressIn={() => onInteraction?.()}
        onPress={onPress}
        style={[styles.pill, styles.backPill, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
    >
        <Ionicons name="chevron-back" size={14} color={colors.primary} />
        <Text style={[styles.pillText, { color: colors.primary, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
);

const ActionPill = ({
    label,
    onPress,
    onInteraction,
    colors,
}: {
    label: string;
    onPress: () => void;
    onInteraction?: () => void;
    colors: any;
}) => (
    <TouchableOpacity
        onPressIn={() => onInteraction?.()}
        onPress={onPress}
        style={[styles.pill, { backgroundColor: colors.background, borderColor: colors.border }]}
    >
        <Text style={[styles.pillText, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
);

const LiveNumberInput = ({
    inputRef,
    value,
    onChange,
    placeholder,
    onSubmit,
    confirmIcon = 'checkmark',
    min,
    onInteraction,
    onInvalid,
    colors,
}: {
    inputRef: React.RefObject<TextInput | null>;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    onSubmit: () => void;
    confirmIcon?: string;
    min?: number;
    onInteraction?: () => void;
    onInvalid?: () => void;
    colors: any;
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
                const val = parseInt(value, 10);
                if ((min && val <= min) || !value) {
                    onInvalid?.();
                    return;
                }
                onSubmit();
            }}
            returnKeyType="done"
            maxLength={3}
            autoFocus
        />
        <TouchableOpacity
            onPressIn={() => onInteraction?.()}
            onPress={() => {
                const val = parseInt(value, 10);
                if ((min && val <= min) || !value) {
                    onInvalid?.();
                    return;
                }
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
    chapterInput,
    setChapterInput,
    chapterInputRef,
    onInteraction,
    onInvalid,
    colors,
    placeholder,
}: {
    book: BibleBook;
    onChapterSelect: (ch: number) => void;
    min?: number;
    chapterInput: string;
    setChapterInput: (v: string) => void;
    chapterInputRef: React.RefObject<TextInput | null>;
    onInteraction?: () => void;
    onInvalid?: () => void;
    colors: any;
    placeholder?: string;
}) => {
    if (book.chapters <= CHIP_THRESHOLD) {
        const allChapters = Array.from({ length: book.chapters }, (_, i) => i + 1);
        const chaptersToShow = min ? allChapters.filter(ch => ch > min) : allChapters;
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

    // Long book (Psalms etc.) — number input
    return (
        <LiveNumberInput
            inputRef={chapterInputRef}
            value={chapterInput}
            onChange={setChapterInput}
            placeholder={min ? `${min + 1}–${book.chapters}` : `1–${book.chapters}`}
            onSubmit={() => {
                const ch = parseInt(chapterInput, 10);
                if (ch >= (min || 1) && ch <= book.chapters) {
                    onChapterSelect(ch);
                } else {
                    onInvalid?.();
                }
            }}
            min={min}
            confirmIcon="arrow-forward"
            onInteraction={onInteraction}
            onInvalid={onInvalid}
            colors={colors}
        />
    );
};

// ── Main component ─────────────────────────────────────────────────────────

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
    const shakeAnim = useRef(new Animated.Value(0)).current;
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
        return ALL_BIBLE_BOOKS.filter(b => {
            const name = b.name.toLowerCase();
            const abbrv = b.abbrv.toLowerCase();

            // Match if any part of the name starts with the query
            // (e.g., "c" matches "Chronicles" in "1 Chronicles")
            if (name.split(/\s+/).some(word => word.startsWith(q))) return true;

            // Match if the abbreviation starts with the query
            if (abbrv.startsWith(q)) return true;

            // Match if abbreviation without leading number starts with the query
            // (e.g., "c" matches "1Chr")
            if (abbrv.replace(/^[1-3]/, '').startsWith(q)) return true;

            return false;
        });
    }, [query]);

    const morph = (fn: () => void) => {
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        setTimeout(fn, 100);
    };

    const shake = () => {
        shakeAnim.setValue(0);
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleBookSelect = (book: BibleBook) => {
        onInteraction?.();
        onPreview(book.name);
        morph(() => { setSelectedBook(book); setPhase('chapter'); });
    };

    const handleChapterSelect = (ch: number) => {
        onInteraction?.();
        onPreview(`${selectedBook!.name} ${ch}`);
        morph(() => { setStartChapter(ch); setChapterInput(''); setPhase('suffix'); });
    };

    const handleDone = () => {
        const book = selectedBook!.name;
        const sc = startChapter!;
        onSelect(startVerse ? `${book} ${sc}:${startVerse}` : `${book} ${sc}`);
        resetState();
    };

    const handleAddVerse = () => {
        onInteraction?.();
        onPreview(`${selectedBook!.name} ${startChapter!}:`);
        morph(() => { setVerseInput(''); setPhase('verse'); });
    };

    const handleAddRange = () => {
        onInteraction?.();
        if (!startVerse) {
            handleRangeToChapter();
        } else {
            morph(() => { setPhase('range-type'); });
        }
    };

    const handleRangeToChapter = () => {
        onInteraction?.();
        const book = selectedBook!.name;
        const sc = startChapter!;
        const sv = startVerse;
        onPreview(sv ? `${book} ${sc}:${sv}-` : `${book} ${sc}-`);
        morph(() => { setChapterInput(''); setPhase('end-chapter'); });
    };

    const handleRangeToVerse = () => {
        onInteraction?.();
        const book = selectedBook!.name;
        const sc = startChapter!;
        let sv = startVerse;
        if (!sv) {
            sv = '1';
            setStartVerse('1');
        }
        onPreview(`${book} ${sc}:${sv}-`);
        morph(() => { setEndChapter(null); setVerseInput(''); setPhase('end-verse'); });
    };

    const handleVerseInputChange = (v: string) => {
        setVerseInput(v);
        onPreview(`${selectedBook!.name} ${startChapter!}:${v}`);
    };

    const handleVerseConfirm = () => {
        if (!verseInput.trim()) {
            shake();
            return;
        }
        morph(() => { setStartVerse(verseInput); setVerseInput(''); setPhase('verse-suffix'); });
    };

    const handleEndChapterSelect = (ch: number) => {
        onInteraction?.();
        const book = selectedBook!.name;
        const sc = startChapter!;
        const sv = startVerse;

        if (!sv) {
            onSelect(`${book} ${sc}-${ch}`);
            resetState();
        } else {
            onPreview(`${book} ${sc}:${sv}-${ch}:`);
            morph(() => { setEndChapter(ch); setVerseInput(''); setPhase('end-verse'); });
        }
    };

    const handleEndVerseInputChange = (v: string) => {
        setVerseInput(v);
        const book = selectedBook!.name;
        const sc = startChapter!;
        const sv = startVerse;
        onPreview(endChapter ? `${book} ${sc}:${sv}-${endChapter}:${v}` : `${book} ${sc}:${sv}-${v}`);
    };

    const handleEndVerseConfirm = () => {
        if (!verseInput.trim()) {
            shake();
            return;
        }
        const book = selectedBook!.name;
        const sc = startChapter!;
        const sv = startVerse;
        const ref = endChapter
            ? `${book} ${sc}:${sv}-${endChapter}:${verseInput}`
            : `${book} ${sc}:${sv}-${verseInput}`;
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
                    setPhase('book');
                    setSelectedBook(null);
                    break;
                case 'suffix':
                    onPreview(book);
                    setPhase('chapter');
                    setStartChapter(null);
                    break;
                case 'verse':
                    onPreview(`${book} ${sc}`);
                    setVerseInput('');
                    setPhase('suffix');
                    break;
                case 'verse-suffix':
                    onPreview(`${book} ${sc}:${sv}`);
                    setVerseInput(sv);
                    setStartVerse('');
                    setPhase('verse');
                    break;
                case 'range-type':
                    if (sv) {
                        onPreview(`${book} ${sc}:${sv}`);
                        setPhase('verse-suffix');
                    } else {
                        onPreview(`${book} ${sc}`);
                        setPhase('suffix');
                    }
                    break;
                case 'end-chapter':
                    setChapterInput('');
                    if (sv) {
                        onPreview(`${book} ${sc}:${sv}`);
                        setPhase('verse-suffix');
                    } else {
                        onPreview(`${book} ${sc}`);
                        setPhase('suffix');
                    }
                    break;
                case 'end-verse':
                    onPreview(`${book} ${sc}:${sv}-`);
                    if (endChapter) {
                        setPhase('end-chapter');
                        setEndChapter(null);
                    } else {
                        setPhase('range-type');
                    }
                    setVerseInput('');
                    break;
            }
        });
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
                        <BackPill
                            label={book.abbrv}
                            onPress={goBack}
                            onInteraction={onInteraction}
                            colors={colors}
                        />
                        <ChapterPills
                            book={book}
                            onChapterSelect={handleChapterSelect}
                            chapterInput={chapterInput}
                            setChapterInput={setChapterInput}
                            chapterInputRef={chapterInputRef}
                            onInteraction={onInteraction}
                            onInvalid={shake}
                            colors={colors}
                            placeholder="Ch?"
                        />
                    </>
                );

            case 'suffix':
                return (
                    <>
                        <BackPill
                            label={`${book.abbrv} ${sc}`}
                            onPress={goBack}
                            onInteraction={onInteraction}
                            colors={colors}
                        />
                        <ActionPill label="Verse" onPress={handleAddVerse} onInteraction={onInteraction} colors={colors} />
                        <ActionPill label="To" onPress={handleAddRange} onInteraction={onInteraction} colors={colors} />
                        <ActionPill label="Done ✓" onPress={handleDone} onInteraction={onInteraction} colors={colors} />
                    </>
                );

            case 'verse':
                return (
                    <>
                        <BackPill
                            label={`${book.abbrv} ${sc}:`}
                            onPress={goBack}
                            onInteraction={onInteraction}
                            colors={colors}
                        />
                        <LiveNumberInput
                            inputRef={verseInputRef}
                            value={verseInput}
                            onChange={handleVerseInputChange}
                            placeholder="verse"
                            onSubmit={handleVerseConfirm}
                            onInteraction={onInteraction}
                            onInvalid={shake}
                            colors={colors}
                        />
                    </>
                );

            case 'verse-suffix':
                return (
                    <>
                        <BackPill
                            label={`${book.abbrv} ${sc}:${startVerse}`}
                            onPress={goBack}
                            onInteraction={onInteraction}
                            colors={colors}
                        />
                        <ActionPill label="To" onPress={handleAddRange} onInteraction={onInteraction} colors={colors} />
                        <ActionPill label="Done" onPress={handleDone} onInteraction={onInteraction} colors={colors} />
                    </>
                );

            case 'range-type':
                return (
                    <>
                        <BackPill
                            label={startVerse ? `${book.abbrv} ${sc}:${startVerse}` : `${book.abbrv} ${sc}`}
                            onPress={goBack}
                            onInteraction={onInteraction}
                            colors={colors}
                        />
                        <ActionPill label="Chapter what?" onPress={handleRangeToChapter} onInteraction={onInteraction} colors={colors} />
                        <ActionPill label="Verse what?" onPress={handleRangeToVerse} onInteraction={onInteraction} colors={colors} />
                    </>
                );

            case 'end-chapter':
                return (
                    <>
                        <BackPill
                            label={startVerse ? `${book.abbrv} ${sc}:${startVerse}–` : `${book.abbrv} ${sc}–`}
                            onPress={goBack}
                            onInteraction={onInteraction}
                            colors={colors}
                        />
                        <ChapterPills
                            book={book}
                            onChapterSelect={handleEndChapterSelect}
                            min={sc}
                            chapterInput={chapterInput}
                            setChapterInput={setChapterInput}
                            chapterInputRef={chapterInputRef}
                            onInteraction={onInteraction}
                            onInvalid={shake}
                            colors={colors}
                            placeholder="Ch?"
                        />
                    </>
                );

            case 'end-verse': {
                const minVerse = (!endChapter) ? parseInt(startVerse, 10) : undefined;
                return (
                    <>
                        <BackPill
                            label={endChapter ? `${book.abbrv} ${sc}:${startVerse}–${endChapter}:` : `${book.abbrv} ${sc}:${startVerse}–`}
                            onPress={goBack}
                            onInteraction={onInteraction}
                            colors={colors}
                        />
                        <LiveNumberInput
                            inputRef={verseInputRef}
                            value={verseInput}
                            onChange={handleEndVerseInputChange}
                            placeholder="Verse what?"
                            onSubmit={handleEndVerseConfirm}
                            min={minVerse}
                            onInteraction={onInteraction}
                            onInvalid={shake}
                            colors={colors}
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
                    transform: [
                        { translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                        { translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) },
                    ],
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
