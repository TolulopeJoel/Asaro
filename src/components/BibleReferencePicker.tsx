import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    InputAccessoryView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Spacing } from '../theme/spacing';
import { ALL_BIBLE_BOOKS, BibleBook } from '../data/bibleBooks';
import { ChevronLeft, Check, ArrowRight, X } from 'lucide-react-native';
import { Text, textStyle } from './ui';

const CHIP_THRESHOLD = 30;

/** The band runs in Colossal's gutter; it sits under Colossal-width text. */
const PICKER_GUTTER = Spacing.layout.screenPaddingTight;

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
        style={[styles.pill, styles.backPill, { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
    >
        <ChevronLeft size={14} color={colors.textInverse} />
        <Text variant="cell" tone="inverse">{label}</Text>
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
        style={[styles.pill, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}
    >
        <Text variant="cell">{label}</Text>
    </TouchableOpacity>
);

/** The blank the writer types into — `.co-pill.field`, dashed and in ochre. */
const LiveNumberInput = ({
    inputRef,
    value,
    onChange,
    placeholder,
    onSubmit,
    confirmIcon = Check,
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
    confirmIcon?: any;
    min?: number;
    onInteraction?: () => void;
    onInvalid?: () => void;
    colors: any;
}) => {
    const { style: themeStyle } = useTheme();
    return (
    <View style={styles.inputWrapper}>
        <TextInput
            ref={inputRef}
            style={[styles.numberInput, textStyle(themeStyle, 'cell'), { color: colors.accent, borderColor: colors.accent }]}
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
                backgroundColor: value ? colors.accent : colors.backgroundElevated,
                borderColor: value ? colors.accent : colors.border,
            }]}
        >
            {React.createElement(confirmIcon, { size: 14, color: value ? colors.textInverse : colors.textTertiary })}
        </TouchableOpacity>
    </View>
    );
};

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
                        style={[styles.pill, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}
                    >
                        <Text variant="cell">{ch}</Text>
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
            confirmIcon={ArrowRight}
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
                    ? <Text variant="body" tone="tertiary" style={styles.emptyText}>No matching book</Text>
                    : filteredBooks.map((b) => (
                        <TouchableOpacity
                            key={b.name}
                            onPressIn={() => onInteraction?.()}
                            onPress={() => handleBookSelect(b)}
                            style={[styles.pill, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}
                        >
                            <Text variant="cell">{b.name}</Text>
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

    /** What the band is asking for right now. */
    const prompt = (() => {
        const book = selectedBook?.name ?? '';
        switch (phase) {
            case 'book': return 'Which book?';
            case 'chapter': return book ? `Which chapter of ${book}?` : 'Which chapter?';
            case 'suffix': return 'A verse, or leave it at the chapter?';
            case 'verse': return 'Which verse?';
            case 'verse-suffix': return 'A range, or leave it there?';
            case 'range-type': return 'Range to a chapter, or to a verse?';
            case 'end-chapter': return 'Up to which chapter?';
            case 'end-verse': return 'Up to which verse?';
            default: return 'Which book?';
        }
    })();

    /** The one line of guidance the mockup carries, on the chapter phase. */
    const helper = phase === 'chapter' && selectedBook
        ? `${selectedBook.name} has ${selectedBook.chapters} chapters — type a number or keep scrolling.`
        : null;

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
            <View style={[styles.ribbon, { backgroundColor: colors.backgroundElevated, borderTopColor: colors.border }]}>
                {/*
                 * The band says what it is asking for before it offers the
                 * pills. design/all-screens.html #refpicker puts that prompt in
                 * a `.co-label` above the row — without it the strip is a line
                 * of numbers with no stated question, which is exactly what it
                 * used to be.
                 */}
                <View style={styles.promptRow}>
                    <Text variant="label" style={styles.prompt} numberOfLines={1}>{prompt}</Text>
                    <TouchableOpacity
                        onPress={onDismiss}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel="Close reference picker"
                    >
                        <X size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                <Animated.View style={{ opacity: fadeAnim }}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="always"
                        contentContainerStyle={styles.scrollContent}
                    >
                        {renderContent()}
                    </ScrollView>
                </Animated.View>

                {helper && (
                    <Text variant="bodySmall" style={styles.helper}>{helper}</Text>
                )}
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
    /**
     * A band across the foot of the screen, not a floating ribbon.
     *
     * The mockup seats it on its own ground with a hairline along the top —
     * the boundary between writing and picking. The old version floated a
     * rounded, shadowed pill over the text, which is the one thing the design
     * note for this screen says not to do: it pulls the eye off the sentence.
     */
    ribbon: {
        borderTopWidth: Spacing.border.hairline,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    promptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: PICKER_GUTTER,
        marginBottom: Spacing.md,
    },
    prompt: { flex: 1 },
    scrollContent: {
        alignItems: 'center',
        paddingHorizontal: PICKER_GUTTER,
        gap: Spacing.sm,
    },
    helper: {
        marginTop: Spacing.md,
        paddingHorizontal: PICKER_GUTTER,
    },
    /** `.co-pill` / `.cl-pill` — square, 44 tall, named by its border. */
    pill: {
        paddingHorizontal: 15,
        height: Spacing.touchTarget,
        borderWidth: Spacing.border.hairline,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: Spacing.touchTarget,
    },
    backPill: {
        flexDirection: 'row',
        paddingLeft: 10,
        gap: 2,
    },
    emptyText: { paddingHorizontal: Spacing.md },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    /** `.co-pill.field` — dashed and in the accent, so it reads as a blank. */
    numberInput: {
        width: 92,
        height: Spacing.touchTarget,
        borderWidth: Spacing.border.hairline,
        borderStyle: 'dashed',
        paddingHorizontal: Spacing.md,
        textAlign: 'center',
    },
});

BibleReferencePicker.displayName = 'BibleReferencePicker';
