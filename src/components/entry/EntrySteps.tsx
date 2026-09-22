import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { BibleBook } from '../../data/bibleBooks';
import { ChapterRange, VerseRange } from '../../hooks/useEntryHooks';
import { ReflectionAnswers, ReflectionForm } from '../ReflectionForm';
import { ScalePressable } from '../ScalePressable';
import { BookPicker, countMatches } from '../BookPicker';
import { ChapterPicker } from '../ChapterPicker';
import { Confetti, ConfettiRef } from '../Confetti';
import { Hero, Text, ThemedButton, textStyle } from '../ui';
import { formatRange, spell } from '../../utils/reference';

/** The canon, for the picker's "N of 66 books match". */
const TOTAL_BOOKS = 66;

interface BookStepProps {
    selectedBook?: BibleBook;
    onBookSelect: (book: BibleBook) => void;
    /** Leave the entry — the `.co-top` close button. */
    onExit: () => void;
}

/**
 * Choose a book.
 *
 * design/all-screens.html #books. There is no count worth enlarging on a
 * picker, so the giant slot goes to what you have typed — which doubles as
 * feedback that the filter is live. With the field empty it shows nothing:
 * the style allows a screen zero colossal elements, never two.
 */
export const BookStep = React.memo(({ selectedBook, onBookSelect, onExit }: BookStepProps) => {
    const { colors, style: themeStyle, isLockedIn } = useTheme();
    const [query, setQuery] = useState('');
    const gutter = isLockedIn ? Spacing.layout.screenPaddingTight : Spacing.layout.screenPadding;
    const matches = countMatches(query);

    const filterField = (
        <TextInput
            style={[
                styles.input,
                textStyle(themeStyle, 'body'),
                isLockedIn
                    ? { backgroundColor: colors.searchBackground, borderColor: colors.border, color: colors.textPrimary }
                    : { backgroundColor: colors.textInverse + '1A', borderColor: colors.textInverse + '47', color: colors.textInverse },
            ]}
            value={query}
            onChangeText={setQuery}
            placeholder={`Filter ${TOTAL_BOOKS} books…`}
            placeholderTextColor={isLockedIn ? colors.textTertiary : colors.textOnHero}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Filter books"
        />
    );

    if (!isLockedIn) {
        /*
         * design/all-screens.html #books, the `.cl` slot. Cloth names the
         * screen on its band and puts the filter there with it — there is no
         * giant, because Cloth has no colossal slot to spend and the query is
         * already legible in the field you typed it into.
         */
        return (
            <View style={styles.stepContainer}>
                <Hero>
                    <View style={styles.clothHeroTop}>
                        <Text variant="display" tone="onBand" style={styles.mark}>Choose a book</Text>
                        <ScalePressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Close" hitSlop={Spacing.md}>
                            <X size={19} color={colors.accent} strokeWidth={1.9} />
                        </ScalePressable>
                    </View>
                    <View style={styles.clothHeroField}>{filterField}</View>
                </Hero>
                <View style={[styles.list, { paddingHorizontal: gutter, paddingTop: Spacing.xl - 4 }]}>
                    <BookPicker selectedBook={selectedBook} onBookSelect={onBookSelect} query={query} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.stepContainer}>
            <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
                <Text variant="tab" style={styles.mark}>Choose a book</Text>
                <ScalePressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Close" hitSlop={Spacing.md}>
                    <X size={19} color={colors.textTertiary} strokeWidth={1.9} />
                </ScalePressable>
            </View>

            {query.trim().length > 0 && (
                <View style={[styles.giant, { paddingHorizontal: gutter }]}>
                    <Text variant="heroSmall" tone="accent" numberOfLines={1} adjustsFontSizeToFit>
                        {query.trim()}
                    </Text>
                    <Text variant="label" style={styles.giantLabel}>
                        {`${matches} of ${TOTAL_BOOKS} books match`}
                    </Text>
                </View>
            )}

            <View style={[styles.filter, { paddingHorizontal: gutter }]}>{filterField}</View>

            <View style={[styles.list, { paddingHorizontal: gutter }]}>
                <BookPicker selectedBook={selectedBook} onBookSelect={onBookSelect} query={query} />
            </View>
        </View>
    );
});

interface ChapterStepProps {
    selectedBook?: BibleBook;
    selectedChapters?: ChapterRange;
    onChapterSelect: (chapters: ChapterRange) => void;
    onVerseRangeChange: (verses: VerseRange | null) => void;
    onBack: () => void;
    onContinue: () => void;
    canContinue: boolean;
}

/**
 * Which chapters.
 *
 * design/all-screens.html #chapters: the range you have picked is the screen's
 * colossal element, the grid sits under it, and the one action at the foot
 * names what it will do — "Use Genesis 12–15" rather than "Continue".
 */
export const ChapterStep = React.memo(({
    selectedBook,
    selectedChapters,
    onChapterSelect,
    onVerseRangeChange,
    onBack,
    onContinue,
    canContinue
}: ChapterStepProps) => {
    const { colors, isLockedIn } = useTheme();
    const gutter = isLockedIn ? Spacing.layout.screenPaddingTight : Spacing.layout.screenPadding;

    const start = selectedChapters?.start ?? 0;
    const end = selectedChapters?.end || start;
    const picked = start > 0;
    const range = end !== start ? formatRange(`${start}-${end}`) : `${start}`;
    const count = picked ? end - start + 1 : 0;

    return (
        <View style={styles.stepContainer}>
            <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
                <ScalePressable
                    onPress={onBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back to books"
                    hitSlop={Spacing.md}
                    style={styles.backArrow}
                >
                    <ChevronLeft size={20} color={colors.textTertiary} strokeWidth={2} />
                </ScalePressable>
                <Text variant="tab" numberOfLines={1} style={styles.mark}>
                    {selectedBook ? `${selectedBook.name} · ${selectedBook.chapters} chapters` : 'Chapters'}
                </Text>
            </View>

            {picked && (
                <View style={[styles.giant, { paddingHorizontal: gutter }]}>
                    <Text variant="heroSmall" numberOfLines={1} adjustsFontSizeToFit>{range}</Text>
                    <Text variant="label" style={styles.giantLabel}>
                        {`${spell(count)} ${count === 1 ? 'chapter' : 'chapters'} selected`}
                    </Text>
                </View>
            )}

            <ScrollView
                style={styles.list}
                contentContainerStyle={[styles.gridScroll, { paddingHorizontal: gutter }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <ChapterPicker
                    selectedBook={selectedBook}
                    selectedChapters={selectedChapters}
                    onChapterSelect={onChapterSelect}
                    onVerseRangeChange={onVerseRangeChange}
                    allowRange={true}
                />
            </ScrollView>

            <View style={[styles.stepFooter, { paddingHorizontal: gutter }]}>
                <ThemedButton
                    label={picked && selectedBook ? `Use ${selectedBook.name} ${range}` : 'Pick a chapter'}
                    variant="accent"
                    block
                    disabled={!canContinue}
                    onPress={onContinue}
                />
            </View>
        </View>
    );
});

interface ReflectionStepProps {
    selectionSummary: string;
    reflectionAnswers?: ReflectionAnswers;
    onAnswersChange: (answers: ReflectionAnswers) => void;
    onSave: (answers: ReflectionAnswers) => void;
    isEditMode: boolean;
    onBack: () => void;
    onDiscard: () => void;
    /** Leave the entry entirely — the `.co-top` close button. */
    onExit: () => void;
    saveButtonText?: string;
}

export const ReflectionStep = React.memo(({
    selectionSummary,
    reflectionAnswers,
    onAnswersChange,
    onSave,
    isEditMode,
    onBack,
    onDiscard,
    onExit,
    saveButtonText
}: ReflectionStepProps) => (
    /*
     * The writing surface owns the whole screen.
     *
     * design/all-screens.html #entry gives it its own `.co-top` and its own
     * footer — there is no step header and no outer scroll, because the answer
     * band is the thing that scrolls. So this step is a frame and nothing more.
     */
    <View style={styles.stepContainer}>
        <ReflectionForm
            initialAnswers={reflectionAnswers}
            onAnswersChange={onAnswersChange}
            onSave={onSave}
            disabled={false}
            saveButtonText={saveButtonText || (isEditMode ? 'Update entry' : 'Record it')}
            reference={selectionSummary}
            onExit={onExit}
            onChangePassage={onBack}
            onDiscard={!isEditMode && reflectionAnswers ? onDiscard : undefined}
        />
    </View>
));

interface SummaryStepProps {
    selectionSummary: string;
    formattedDate: string;
    onDone: () => void;
    onShare: () => void;
}

export const SummaryStep = React.memo(({
    selectionSummary,
    formattedDate,
    onDone,
    onShare,
}: SummaryStepProps) => {
    const { colors } = useTheme();
    const confettiRef = useRef<ConfettiRef>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            confettiRef.current?.start();
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.stepContainer}>
            <Confetti ref={confettiRef} />
            <ScrollView key="step-summary" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.stepContent, styles.summaryContent]}>
                    <View style={styles.successHero}>
                        <View style={[styles.successRing, { borderColor: colors.accent + '30' }]}>
                            <View style={[styles.successIconOuter, { backgroundColor: colors.accent + '18' }]}>
                                <Check size={38} color={colors.accent} />
                            </View>
                        </View>
                        <Text variant="display">Recorded</Text>
                        <Text variant="body" tone="secondary" style={styles.successSubtitle}>
                            Your reflection has been saved.
                        </Text>
                    </View>

                    <View style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border + '50' }]}>
                        <View style={[styles.entryCardRule, { backgroundColor: colors.accent + '40' }]} />
                        <View style={styles.entryCardBody}>
                            <Text variant="label">Read</Text>
                            <Text variant="display" style={styles.entryCardPassage}>{selectionSummary}</Text>
                            <View style={[styles.entryCardSeparator, { backgroundColor: colors.border + '60' }]} />
                            <Text variant="bodySmall" tone="secondary" style={styles.entryCardDate}>{formattedDate}</Text>
                        </View>
                        <View style={[styles.entryCardRule, { backgroundColor: colors.accent + '40' }]} />
                    </View>

                    <View style={styles.summaryActions}>
                        <ScalePressable
                            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                            onPress={onDone}
                        >
                            <Text variant="body" tone="inverse" style={styles.primaryButtonText}>Check in Library</Text>
                        </ScalePressable>

                        <ScalePressable
                            style={styles.shareLink}
                            onPress={onShare}
                        >
                            <Text variant="bodySmall" tone="tertiary">Share this reflection</Text>
                        </ScalePressable>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    stepContainer: {
        flex: 1,
    },

    // ── the picker screens ────────────────────────────────────────────────
    /** `.co-top` — a mark, and the way out. */
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingTop: Spacing.lg,
    },
    // The mockup hangs the arrow into the gutter so the glyph, not its box,
    // lines up with what sits below it.
    backArrow: { marginLeft: -6 },
    mark: { flex: 1 },
    giant: { paddingTop: Spacing.xl + 2 },
    /** Cloth's band: the title and its close button, then the filter under them. */
    clothHeroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    clothHeroField: { marginTop: Spacing.layout.cardPadding },
    /** `.co-giantl` sits 10px under its numeral. */
    giantLabel: { marginTop: 10 },
    filter: { paddingTop: Spacing.xl - 2, paddingBottom: Spacing.layout.cardPadding },
    input: {
        borderWidth: Spacing.border.hairline,
        paddingHorizontal: Spacing.md + 2,
        paddingVertical: Spacing.md + 2,
    },
    list: { flex: 1 },
    gridScroll: { paddingTop: Spacing.xl - 2, paddingBottom: Spacing.xl },
    stepFooter: {
        paddingTop: Spacing.md + 2,
        paddingBottom: Spacing.layout.tabBarPadding,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingBottom: Spacing.xxxl,
    },
    stepContent: {
        flex: 1,
        paddingTop: Spacing.layout.screenPadding,
    },
    header: {
        marginBottom: Spacing.xl,
        gap: 4,
    },
    contentArea: {
        flex: 1,
        minHeight: 200,
    },
    navigationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 40,
        gap: Spacing.lg,
    },
    backButton: {
        flex: 1,
        paddingVertical: Spacing.layout.cardPadding,
        paddingHorizontal: Spacing.layout.screenPadding,
        backgroundColor: 'transparent',
        borderWidth: Spacing.border.hairline,
    },
    backButtonText: { textAlign: 'center' },
    continueButton: {
        flex: 1,
        paddingVertical: Spacing.layout.cardPadding,
        paddingHorizontal: Spacing.layout.screenPadding,
        ...Spacing.elevation.none,
    },
    continueButtonDisabled: {
        display: 'none',
    },
    continueButtonText: { textAlign: 'center' },
    summaryContent: {
        justifyContent: 'center',
        gap: Spacing.xxxl,
        minHeight: 400,
    },
    summaryActions: {
        gap: Spacing.lg,
        alignItems: 'center',
    },
    successHero: {
        alignItems: 'center',
        gap: Spacing.md,
    },
    successRing: {
        width: 112,
        height: 112,
        borderRadius: Spacing.borderRadius.round,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    successIconOuter: {
        width: 80,
        height: 80,
        borderRadius: Spacing.borderRadius.round,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successSubtitle: { opacity: 0.6 },
    entryCard: {
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
    },
    entryCardRule: {
        height: 3,
        width: '100%',
    },
    entryCardBody: {
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    entryCardPassage: {},
    entryCardSeparator: {
        width: 32,
        height: 1,
        marginVertical: Spacing.xs,
        opacity: 0.5,
    },
    entryCardDate: { opacity: 0.55 },
    primaryButton: {
        width: '100%',
        paddingVertical: 20,
        paddingHorizontal: Spacing.xxl,
        borderRadius: Spacing.borderRadius.lg,
    },
    primaryButtonText: { textAlign: 'center' },
    shareLink: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
});