/**
 * The writing surface — one question at a time. design/all-screens.html #entry:
 * a question number, the question, the answer between two rules, and a
 * five-step progress bar. The screen people spend the most time on gets the
 * least decoration, and asks one thing rather than showing five.
 *
 * The step is named in a `.cl-label` rather than enlarged, so the question
 * itself carries the page.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { Spacing } from '../theme/spacing';
import { TextArea } from './TextArea';
import { ActionItemPair, ActionItemsInput } from './ActionItemsInput';
import { Button } from './Button';
import { ScalePressable } from './ScalePressable';
import { Text as UIText, ThemedButton } from './ui';
import { ClothMark } from './ui/Cloth';
import { REFLECTION_QUESTIONS, ReflectionQuestion, isAnswered } from '../data/questions';
import { useFootPadding } from '../hooks/useScreenInsets';

export interface ReflectionAnswers {
  reflection1: string;
  reflection2: string;
  actionItems: ActionItemPair[];
  reflection4: string;
  studyFurther?: string;
  studyFurtherReminder?: string;
  notes: string;
}

interface ReflectionFormProps {
  initialAnswers?: ReflectionAnswers;
  onAnswersChange?: (answers: ReflectionAnswers) => void;
  onSave?: (answers: ReflectionAnswers) => void;
  disabled?: boolean;
  saveButtonText?: string;
  /** What is being reflected on — the `.co-mark` at the top of the screen. */
  reference: string;
  /** Leave the entry. */
  onExit: () => void;
  /** Step back off the first question, to the passage you chose. */
  onChangePassage: () => void;
  /** Throw the draft away. Absent when editing an entry that already exists. */
  onDiscard?: () => void;
}

export const ReflectionForm: React.FC<ReflectionFormProps> = React.memo(({
  initialAnswers,
  onAnswersChange,
  onSave,
  disabled = false,
  saveButtonText = 'Save It',
  reference,
  onExit,
  onChangePassage,
  onDiscard,
}) => {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [answers, setAnswers] = useState<ReflectionAnswers>({
    reflection1: initialAnswers?.reflection1 || '',
    reflection2: initialAnswers?.reflection2 || '',
    actionItems: initialAnswers?.actionItems || [{ action: '', motivation: '' }],
    reflection4: initialAnswers?.reflection4 || '',
    studyFurther: initialAnswers?.studyFurther || '',
    studyFurtherReminder: initialAnswers?.studyFurtherReminder || undefined,
    notes: initialAnswers?.notes || '',
  });

  /**
   * Which page you are on: 0–4 are the five questions, 5 is the notes. Notes
   * carries no number — the mockup's label says "of five questions", and notes
   * are not a sixth.
   */
  const [page, setPage] = useState(0);
  const isNotes = page === REFLECTION_QUESTIONS.length;
  const current = REFLECTION_QUESTIONS[page];

  const [trackWidth, setTrackWidth] = useState(0);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time'>('date');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Answers not yet handed to the parent, for the flush below.
  const pending = useRef(false);
  const latestAnswers = useRef(answers);
  latestAnswers.current = answers;
  const onAnswersChangeRef = useRef(onAnswersChange);
  onAnswersChangeRef.current = onAnswersChange;

  useEffect(() => {
    if (onAnswersChange) {
      // Debounce the callback to avoid excessive parent re-renders
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      pending.current = true;
      debounceTimer.current = setTimeout(() => {
        pending.current = false;
        onAnswersChange(answers);
      }, 150);

      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    }
  }, [answers, onAnswersChange]);

  const flushAnswers = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!pending.current) return;
    pending.current = false;
    onAnswersChangeRef.current?.(latestAnswers.current);
  }, []);

  // Typing still inside the debounce reaches the parent when the form closes.
  useEffect(() => flushAnswers, [flushAnswers]);

  const updateAnswer = (questionId: keyof ReflectionAnswers, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const hasPrimaryContent = (() => {
    const { reflection1, reflection2, reflection4, notes, actionItems } = answers;
    const hasText = [reflection1, reflection2, reflection4, notes].some(t => t.trim().length > 0);
    // An action item only counts if the action itself is filled (motivation alone is not enough)
    const hasActions = actionItems.some(item => item.action.trim().length > 0);
    return hasText || hasActions;
  })();

  /** Whether a given question (not necessarily the current one) has an answer on it. */
  const isQuestionAnswered = (q: ReflectionQuestion) => isAnswered(answers, q.id);

  // Whether this page is answered — decides "Skip" or "Next". Plain const:
  // `isQuestionAnswered` is redefined every render anyway, so memoizing adds a
  // dependency-array footgun for nothing.
  const answeredHere = isNotes ? answers.notes.trim().length > 0 : isQuestionAnswered(current);

  // What the progress bar tracks. `page` alone counts a skipped question as
  // progress just for moving past it. Notes are excluded on both sides of the
  // ratio, for the same reason the label says "of five": they are not a sixth
  // question, and counting them left a finished entry showing 83%.
  const answeredCount = REFLECTION_QUESTIONS.filter(isQuestionAnswered).length;

  // The question you just left, still blank. Going back to it is as likely as
  // moving on, so the two buttons share the width instead of ranking.
  const backLeads = page > 0 && !isQuestionAnswered(REFLECTION_QUESTIONS[page - 1]);

  const handleSave = () => {
    if (!hasPrimaryContent) return;

    // Check for motivation filled without a corresponding action
    const incompleteItem = answers.actionItems.find(
      item => item.motivation.trim().length > 0 && item.action.trim().length === 0
    );
    if (incompleteItem) {
      showAlert({
        title: 'Missing Action',
        message: 'You\'ve added a "Motivated by" note but haven\'t written the action you want to take. Please add the action, or clear the motivation.'
      });
      return;
    }

    // Delivered first, like every way out below.
    flushAnswers();
    if (onSave) {
      onSave(answers);
    }
  };

  // Every way out delivers the answers first, so the unmount flush never re-sends them after a save or discard.
  const leaveTo = (next?: () => void) => () => {
    flushAnswers();
    next?.();
  };
  const changePassage = leaveTo(onChangePassage);
  const goBack = () => (page === 0 ? changePassage() : setPage(p => p - 1));

  // The hardware back button means what the on-screen Back means.
  const pageRef = useRef(page);
  pageRef.current = page;
  const changePassageRef = useRef(changePassage);
  changePassageRef.current = changePassage;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pageRef.current > 0) setPage(p => p - 1);
      else changePassageRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);
  const goForward = () => setPage(p => Math.min(p + 1, REFLECTION_QUESTIONS.length));

  const gutter = Spacing.layout.screenPadding;
  const footPadding = useFootPadding();

  return (
    <View style={styles.container}>
      {/* ── .co-top: what you're reflecting on, and the way out ────────── */}
      <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
        <UIText variant="tab" numberOfLines={1} style={styles.mark}>{reference}</UIText>
        <ScalePressable
          onPress={leaveTo(onExit)}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={Spacing.md}
        >
          <X size={19} color={colors.textTertiary} strokeWidth={1.9} />
        </ScalePressable>
      </View>

      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        {/* ── the step you're on ─────────────────────────────────────────── */}
        {isNotes ? null : (
          <UIText variant="label">{`Question ${page + 1} of ${REFLECTION_QUESTIONS.length}`}</UIText>
        )}

        <UIText variant={isNotes ? 'display' : 'title'} style={styles.question}>
          {isNotes ? 'Anything else?' : current.question}
        </UIText>

        {/* ── the answer ─────────────────────────────────────────────────── */}
        <View style={styles.answer}>
          {!isNotes && current.isActionList ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <ActionItemsInput
                label={current.question}
                items={answers.actionItems}
                onChange={(items) => setAnswers(prev => ({ ...prev, actionItems: items }))}
                disabled={disabled}
              />
            </ScrollView>
          ) : (
            <TextArea
              // One field per question, not one reused: without the key React
              // keeps the same TextArea and native input across pages, so the
              // previous answer lingers and the expand-modal state carries.
              key={isNotes ? 'notes' : current.id}
              bare
              label={isNotes ? 'Additional thoughts' : current.question}
              value={isNotes
                ? answers.notes
                : (answers[current.id as keyof ReflectionAnswers] as string) || ''}
              placeholder={isNotes
                ? 'Any other insights, questions, or reflections...'
                : current.placeholder}
              onChange={(text) => updateAnswer(isNotes ? 'notes' : (current.id as keyof ReflectionAnswers), text)}
              disabled={disabled}
              isAnswered={answeredHere}
            />
          )}
        </View>

        {/* The study-further reminder belongs to its own question only. */}
        {!isNotes && current.id === 'studyFurther' && answeredHere && !disabled && (
          <View style={styles.reminderContainer}>
            <UIText variant="bodySmall" tone="secondary">Remind me at:</UIText>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={answers.studyFurtherReminder ? new Date(answers.studyFurtherReminder) : new Date(Date.now() + 24 * 60 * 60 * 1000)}
                mode="datetime"
                display="default"
                onChange={(event, selectedDate) => {
                  if (selectedDate) updateAnswer('studyFurtherReminder', selectedDate.toISOString());
                }}
              />
            ) : (
              <View style={styles.androidPickerRow}>
                <Button
                  variant="secondary"
                  label={answers.studyFurtherReminder ? new Date(answers.studyFurtherReminder).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Set Reminder"}
                  onPress={() => { setAndroidPickerMode('date'); setShowAndroidPicker(true); }}
                  fullWidth={false}
                />
                {showAndroidPicker && (
                  <DateTimePicker
                    value={answers.studyFurtherReminder ? new Date(answers.studyFurtherReminder) : new Date(Date.now() + 24 * 60 * 60 * 1000)}
                    mode={androidPickerMode}
                    is24Hour={false}
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowAndroidPicker(false);
                      if (event.type === 'dismissed') return;

                      if (selectedDate) {
                        updateAnswer('studyFurtherReminder', selectedDate.toISOString());
                        if (androidPickerMode === 'date') {
                          setAndroidPickerMode('time');
                          setShowAndroidPicker(true);
                        }
                      }
                    }}
                  />
                )}
              </View>
            )}
          </View>
        )}

        {/* ── where you are ──────────────────────────────────────────────── */}
        {/* The woven strip fills as you go — the motif doing a job rather
          * than decorating. Fills by `answeredCount`, not `page`: paging past a
          * skipped question should not read as ground covered. */}
        <View
          style={[styles.clothProgress, { backgroundColor: colors.border }]}
          onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <View
            style={[
              styles.clothProgressFill,
              { width: trackWidth * (answeredCount / REFLECTION_QUESTIONS.length) },
            ]}
          >
            {/* The weave is drawn at full track width and clipped by the fill.
                Sized to the fill instead, its SVG measures once — at zero, on
                the first question — and never paints again. */}
            <View style={{ width: trackWidth, height: 10 }}>
              <ClothMark />
            </View>
          </View>
        </View>
      </View>

      {/* ── the two things you can do next ───────────────────────────────── */}
      {!disabled && (
        <View style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: footPadding }]}>
          <View style={styles.footerButtons}>
            {/* `block` as well as the flex: the flex sizes ThemedButton's
                wrapper, `block` is what makes the button inside fill it. */}
            <ThemedButton
              variant="secondary"
              label="Back"
              onPress={goBack}
              accessibilityHint={page === 0 ? 'Change the passage' : 'Previous question'}
              block={backLeads}
              style={backLeads ? styles.grow : undefined}
            />
            {isNotes ? (
              <ThemedButton
                label={saveButtonText}
                onPress={handleSave}
                disabled={!hasPrimaryContent}
                block
                style={styles.grow}
              />
            ) : (
              <ThemedButton
                variant="secondary"
                label={answeredHere ? 'Next' : 'Skip'}
                onPress={goForward}
                block
                style={styles.grow}
              />
            )}
          </View>
          {onDiscard && (
            <ScalePressable onPress={leaveTo(onDiscard)} style={styles.discard}>
              <UIText variant="meta" tone="tertiary">Discard draft</UIText>
            </ScalePressable>
          )}
        </View>
      )}
    </View>
  );
});

ReflectionForm.displayName = 'ReflectionForm';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  // The mockup hangs the arrow into the gutter, so the glyph lines up with
  // the text below it rather than its own box.
  mark: { flex: 1 },

  body: {
    flex: 1,
    paddingTop: Spacing.xl + 2,
  },
  question: { marginVertical: Spacing.xl },
  answer: { flex: 1 },

  /** One 10px band that fills as you go. */
  clothProgress: { height: 10, marginTop: Spacing.layout.cardPadding, overflow: 'hidden' },
  clothProgressFill: { height: 10, overflow: 'hidden' },

  footer: {
    paddingTop: Spacing.xl - 4,
    gap: Spacing.md,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  grow: { flex: 1 },
  discard: { alignItems: 'center', paddingVertical: Spacing.xs },

  reminderContainer: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  androidPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
