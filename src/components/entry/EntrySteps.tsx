import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft, Trash2, Check, Share2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { BibleBook } from '../../data/bibleBooks';
import { ChapterRange, VerseRange } from '../../hooks/useEntryHooks';
import { ReflectionAnswers, ReflectionForm } from '../ReflectionForm';
import { ScalePressable } from '../ScalePressable';
import { BookPicker } from '../BookPicker';
import { ChapterPicker } from '../ChapterPicker';
import { Confetti, ConfettiRef } from '../Confetti';
import { Text } from '../ui';

interface BookStepProps {
    selectedBook?: BibleBook;
    onBookSelect: (book: BibleBook) => void;
}

export const BookStep = React.memo(({ selectedBook, onBookSelect }: BookStepProps) => {
    const { colors } = useTheme();
    return (
        <View style={styles.stepContainer}>
            <ScrollView key="step-book" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.stepContent}>
                    <View style={styles.header}>
                        <Text variant="label" tone="tertiary">PASSAGE</Text>
                        <Text variant="display">What book?</Text>
                    </View>
                    <View style={styles.contentArea}>
                        <BookPicker selectedBook={selectedBook} onBookSelect={onBookSelect} />
                    </View>
                </View>
            </ScrollView>
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

export const ChapterStep = React.memo(({
    selectedBook,
    selectedChapters,
    onChapterSelect,
    onVerseRangeChange,
    onBack,
    onContinue,
    canContinue
}: ChapterStepProps) => {
    const { colors } = useTheme();
    return (
        <View style={styles.stepContainer}>
            <ScrollView key="step-chapter" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.stepContent}>
                    <View style={styles.header}>
                        <Text variant="label" tone="tertiary">PASSAGE</Text>
                        <Text variant="display">What part?</Text>
                    </View>
                    <View style={styles.contentArea}>
                        <ChapterPicker
                            selectedBook={selectedBook}
                            selectedChapters={selectedChapters}
                            onChapterSelect={onChapterSelect}
                            onVerseRangeChange={onVerseRangeChange}
                            allowRange={true}
                        />
                    </View>
                    <View style={styles.navigationContainer}>
                        <ScalePressable
                            style={[styles.backButton, { borderColor: colors.border }]}
                            onPress={onBack}
                        >
                            <Text variant="body" tone="secondary" style={styles.backButtonText}>Change book</Text>
                        </ScalePressable>

                        <ScalePressable
                            style={[
                                styles.continueButton,
                                { backgroundColor: colors.accent },
                                !canContinue && styles.continueButtonDisabled,
                            ]}
                            onPress={onContinue}
                            disabled={!canContinue}
                        >
                            <Text variant="body" tone="inverse" style={styles.continueButtonText}>Reflect</Text>
                        </ScalePressable>
                    </View>
                </View>
            </ScrollView>
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
    selectedChapters?: ChapterRange;
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
    selectedChapters,
    saveButtonText
}: ReflectionStepProps) => {
    const { colors } = useTheme();
    return (
        <View style={styles.stepContainer}>
            <ScrollView key="step-reflection" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.stepContent}>
                    <View style={styles.header}>
                        <Text variant="label" tone="tertiary">REFLECTING ON</Text>
                        <Text variant="display" numberOfLines={2}>{selectionSummary}</Text>
                    </View>
                    {!isEditMode && (
                        <Text variant="body" tone="secondary" style={styles.stepDescription}>
                            Consider these questions to get the most out of your reading:
                        </Text>
                    )}
                    <View style={styles.contentArea}>
                        <ReflectionForm
                            initialAnswers={reflectionAnswers}
                            onAnswersChange={onAnswersChange}
                            onSave={onSave}
                            disabled={false}
                            saveButtonText={saveButtonText || (isEditMode ? 'Update entry' : 'Record it')}
                        />
                    </View>

                    <View style={[styles.reflectionFooter, { borderTopColor: colors.border + '40' }]}>
                        <ScalePressable
                            style={styles.footerNavButton}
                            onPress={onBack}
                        >
                            <ChevronLeft size={14} color={colors.textTertiary} />
                            <Text variant="bodySmall" tone="tertiary">
                                {`Change chapter${selectedChapters?.end && selectedChapters.end !== selectedChapters.start ? 's' : ''}`}
                            </Text>
                        </ScalePressable>

                        {!isEditMode && reflectionAnswers && (
                            <>
                                <View style={[styles.footerDivider, { backgroundColor: colors.border }]} />
                                <ScalePressable
                                    style={styles.footerDiscardButton}
                                    onPress={onDiscard}
                                >
                                    <Trash2 size={13} color={colors.danger} />
                                    <Text variant="bodySmall" tone="danger">
                                        Discard draft
                                    </Text>
                                </ScalePressable>
                            </>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
});

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
                            <Text variant="label" tone="tertiary">READ</Text>
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
    stepDescription: { textAlign: 'center', marginBottom: Spacing.md },
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
        borderWidth: 1,
        borderRadius: Spacing.borderRadius.lg,
    },
    backButtonText: { textAlign: 'center' },
    continueButton: {
        flex: 1,
        paddingVertical: Spacing.layout.cardPadding,
        paddingHorizontal: Spacing.layout.screenPadding,
        borderRadius: Spacing.borderRadius.lg,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    continueButtonDisabled: {
        shadowOpacity: 0,
        display: 'none',
    },
    continueButtonText: { textAlign: 'center' },
    reflectionFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.lg,
        marginTop: Spacing.xl,
        paddingTop: Spacing.lg,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    footerNavButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: Spacing.sm,
    },
    footerDivider: {
        width: 1,
        height: 14,
        opacity: 0.4,
    },
    footerDiscardButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: Spacing.sm,
    },
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
    entryCardPassage: { textAlign: 'center' },
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