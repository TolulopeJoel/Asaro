import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { BibleBook } from '../../data/bibleBooks';
import { ChapterRange, VerseRange } from '../../hooks/useEntryHooks';
import { savedNote } from '../../data/savedNotes';
import { ReflectionAnswers, ReflectionForm } from '../ReflectionForm';
import { ScalePressable } from '../ScalePressable';
import { BookPicker } from '../BookPicker';
import { ChapterPicker } from '../ChapterPicker';
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
 * design/all-screens.html #books.
 */
export const BookStep = React.memo(({ selectedBook, onBookSelect, onExit }: BookStepProps) => {
    const { colors, style: themeStyle } = useTheme();
    const [query, setQuery] = useState('');
    const gutter = Spacing.layout.screenPadding;

    const filterField = (
        <TextInput
            style={[
                styles.input,
                textStyle(themeStyle, 'body'),
                { backgroundColor: colors.textInverse + '1A', borderColor: colors.textInverse + '47', color: colors.textInverse },
            ]}
            value={query}
            onChangeText={setQuery}
            placeholder={`Filter ${TOTAL_BOOKS} books…`}
            placeholderTextColor={colors.textOnHero}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Filter books"
        />
    );

    /*
     * design/all-screens.html #books, the `.cl` slot. Cloth names the screen
     * on its band and puts the filter there with it — the query is already
     * legible in the field you typed it into.
     */
    return (
        <View style={styles.stepContainer}>
            <Hero ownsTopInset>
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
});

interface ChapterStepProps {
    selectedBook?: BibleBook;
    selectedChapters?: ChapterRange;
    onChapterSelect: (chapters: ChapterRange) => void;
    onVerseRangeChange: (verses: VerseRange | null) => void;
    onBack: () => void;
    /** Leave the entry entirely — Cloth's `.cl-top` close button. */
    onExit: () => void;
    onContinue: () => void;
    canContinue: boolean;
}

/**
 * Which chapters.
 *
 * design/all-screens.html #chapters. Cloth puts the book itself on a full
 * `.cl-hero` band (with a Back AND a Close button, since the mockup draws
 * both) and states the current selection as a `.cl-panel` summary with a
 * Clear button, ahead of the grid rather than above it.
 */
export const ChapterStep = React.memo(({
    selectedBook,
    selectedChapters,
    onChapterSelect,
    onVerseRangeChange,
    onBack,
    onExit,
    onContinue,
    canContinue
}: ChapterStepProps) => {
    const { colors } = useTheme();
    const gutter = Spacing.layout.screenPadding;

    const start = selectedChapters?.start ?? 0;
    const end = selectedChapters?.end || start;
    const picked = start > 0;
    const range = end !== start ? formatRange(`${start}-${end}`) : `${start}`;
    const count = picked ? end - start + 1 : 0;
    const clearSelection = () => onChapterSelect({ start: 0 });

    return (
        <View style={styles.stepContainer}>
            <Hero ownsTopInset>
                <View style={styles.clothChapterTop}>
                    <ScalePressable
                        onPress={onBack}
                        accessibilityRole="button"
                        accessibilityLabel="Back to books"
                        hitSlop={Spacing.md}
                        style={styles.backArrow}
                    >
                        <ChevronLeft size={20} color={colors.accent} strokeWidth={1.9} />
                    </ScalePressable>
                    <ScalePressable
                        onPress={onExit}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                        hitSlop={Spacing.md}
                    >
                        <X size={19} color={colors.accent} strokeWidth={1.9} />
                    </ScalePressable>
                </View>
                <Text variant="display" tone="onBand" style={styles.clothHeroTitle}>
                    {selectedBook?.name ?? 'Chapters'}
                </Text>
                {selectedBook && (
                    <Text variant="sub" tone="onHero" style={styles.clothHeroSub}>
                        {`${selectedBook.chapters} chapters`}
                    </Text>
                )}
            </Hero>

            <View style={[styles.clothBody, { paddingHorizontal: gutter }]}>
                {picked && selectedBook && (
                    <View style={[styles.clothSummary, { backgroundColor: colors.backgroundSubtle }]}>
                        <Text variant="title" numberOfLines={1} style={styles.clothSummaryText}>
                            {`${count === 1 ? 'Chapter' : 'Chapters'} ${range}`}
                        </Text>
                        <ThemedButton
                            label="Clear"
                            variant="secondary"
                            style={styles.clothClearButton}
                            onPress={clearSelection}
                        />
                    </View>
                )}

                <ScrollView
                    style={styles.list}
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
            </View>

            <View style={[styles.stepFooter, { paddingHorizontal: gutter }]}>
                <ThemedButton
                    label={picked && selectedBook ? `Use ${selectedBook.name} ${range}` : 'Pick a chapter'}
                    variant="primary"
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
    /** Leave the entry entirely — the top bar's close button. */
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
    /** How many of the questions came back with something in them. */
    answerCount: number;
    onDone: () => void;
    onShare: () => void;
    /**
     * Something you committed to before, if there is one.
     *
     * Sits between the entry you just recorded and the way out — after the
     * confirmation, so it reads as what came back rather than as another step,
     * and above the actions so leaving is never blocked by it.
     */
    observation?: React.ReactNode;
    /**
     * The saved entry's id, used to pick what he says when there is no card.
     *
     * A seed rather than the line itself, so the choosing stays in one place
     * with the words it chooses between. See `savedNotes.ts`.
     */
    noteSeed?: number;
}

/**
 * The last step of the wizard, and the only screen the app gives you for free.
 *
 * design/all-screens.html #saved. Confirmation and receipt are one element,
 * not two: a tick inside a ring says "done" and nothing else, while the
 * passage and the date say done *and* what was done. Cloth puts both in the
 * band — the wizard runs bandless while you write, so the band returning is
 * itself the signal that you have arrived somewhere.
 *
 * No second large element. The count of answers is a fact about the form
 * rather than about the reader, so it rides in the supporting line and never
 * takes a size of its own.
 *
 * There is no close button. The two ways out are the two controls at the foot,
 * and neither of them loses the entry.
 */
export const SummaryStep = React.memo(({
    selectionSummary,
    formattedDate,
    answerCount,
    onDone,
    onShare,
    observation,
    noteSeed,
}: SummaryStepProps) => {
    const meta = `${spell(answerCount)} ${answerCount === 1 ? 'answer' : 'answers'} · ${formattedDate}`;

    return (
        <View style={styles.stepContainer}>
            <Hero ownsTopInset>
                <Text variant="label">Recorded</Text>
                <Text variant="display" tone="onBand" style={styles.savedTitle}>
                    {selectionSummary}
                </Text>
                <Text variant="sub" tone="onHero" style={styles.savedMeta}>{meta}</Text>
            </Hero>

            <ScrollView
                key="step-summary"
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.savedContent,
                    { paddingHorizontal: Spacing.layout.screenPadding },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/*
                  * The card if there is one, and a word from him if there is
                  * not. Never both — two voices over one moment is the thing
                  * §6 warns about, and having no card is the condition rather
                  * than a coincidence.
                  */}
                {observation ?? (
                    <Text variant="body" tone="secondary" style={styles.savedNote}>
                        {savedNote(noteSeed)}
                    </Text>
                )}
            </ScrollView>

            <View
                style={[
                    styles.savedFooter,
                    { paddingHorizontal: Spacing.layout.screenPadding },
                ]}
            >
                <ThemedButton label="Check in Library" block onPress={onDone} />
                <ScalePressable
                    style={styles.shareLink}
                    onPress={onShare}
                    accessibilityRole="button"
                >
                    <Text variant="button" tone="tertiary">Share this reflection</Text>
                </ScalePressable>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    stepContainer: {
        flex: 1,
    },

    // ── the picker screens ────────────────────────────────────────────────
    /** `.co-top` — a mark, and the way out. */
    // The mockup hangs the arrow into the gutter so the glyph, not its box,
    // lines up with what sits below it.
    backArrow: { marginLeft: -6 },
    mark: { flex: 1 },
    /** Cloth's band: the title and its close button, then the filter under them. */
    clothHeroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    clothHeroField: { marginTop: Spacing.layout.cardPadding },
    input: {
        borderWidth: Spacing.border.hairline,
        paddingHorizontal: Spacing.md + 2,
        paddingVertical: Spacing.md + 2,
    },
    list: { flex: 1 },
    stepFooter: {
        paddingTop: Spacing.md + 2,
        paddingBottom: Spacing.layout.tabBarPadding,
    },
    /*
     * `.cl-top{display:flex; justify-content:space-between}` — ChapterStep's
     * band carries two bare icon buttons with nothing between them, so (unlike
     * BookStep's title+close, which spreads via the title's own flex:1) this
     * needs the justification stated explicitly.
     */
    clothChapterTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    /** `.cl-htitle{margin-top:8px}` on this screen. */
    clothHeroTitle: { marginTop: Spacing.sm },
    /** `.cl-hsub{margin:8px 0 0}` */
    clothHeroSub: { marginTop: Spacing.sm },
    clothBody: { flex: 1, paddingTop: Spacing.layout.cardPadding },
    /** `.cl-panel` summary: background block, name left, Clear pinned right. */
    clothSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md + 3,
        marginBottom: Spacing.lg,
    },
    clothSummaryText: { flex: 1 },
    /* Sits where a card would, so the screen keeps its shape either way. */
    savedNote: { paddingTop: Spacing.sm },
    clothClearButton: { marginLeft: 'auto' },
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
    /** `.cl-htitle` and `.co-h.lg` sit 10px under the label above them. */
    savedTitle: { marginTop: 10 },
    /** `.cl-hsub{margin:8px 0 0}` */
    savedMeta: { marginTop: Spacing.sm },
    savedContent: {
        paddingTop: Spacing.xl - 2,
        paddingBottom: Spacing.xl,
    },
    /** `.co-hr` between the passage and what came back. */
    savedFooter: {
        alignItems: 'center',
        gap: Spacing.xs + 2,
        paddingTop: Spacing.xl - 4,
        paddingBottom: Spacing.layout.tabBarPadding,
    },
    shareLink: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
});