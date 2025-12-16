import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ScalePressable } from './ScalePressable';
import { TextArea } from './TextArea';

export interface ReflectionAnswers {
  reflection1: string;
  reflection2: string;
  reflection3: string;
  reflection4: string;
  notes: string;
}

interface ReflectionFormProps {
  initialAnswers?: ReflectionAnswers;
  onAnswersChange?: (answers: ReflectionAnswers) => void;
  onSave?: (answers: ReflectionAnswers) => void;
  disabled?: boolean;
  saveButtonText?: string;
}

export const ReflectionForm: React.FC<ReflectionFormProps> = ({
  initialAnswers,
  onAnswersChange,
  onSave,
  disabled = false,
  saveButtonText = 'Save It',
}) => {
  const { colors } = useTheme();
  const [answers, setAnswers] = useState<ReflectionAnswers>({
    reflection1: initialAnswers?.reflection1 || '',
    reflection2: initialAnswers?.reflection2 || '',
    reflection3: initialAnswers?.reflection3 || '',
    reflection4: initialAnswers?.reflection4 || '',
    notes: initialAnswers?.notes || '',
  });

  // Animation values
  const saveButtonScale = useRef(new Animated.Value(0)).current;
  const saveButtonOpacity = useRef(new Animated.Value(0)).current;
  const questionAnims = useRef(REFLECTION_QUESTIONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (onAnswersChange) {
      onAnswersChange(answers);
    }
  }, [answers, onAnswersChange]);

  // Staggered entrance animation for questions
  useEffect(() => {
    const animations = questionAnims.map((anim, index) => {
      return Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      });
    });

    const staggerAnimation = Animated.stagger(100, animations);
    staggerAnimation.start();
    
    return () => {
      staggerAnimation.stop();
      animations.forEach(anim => anim.stop());
    };
  }, [questionAnims]);

  const updateAnswer = (questionId: keyof ReflectionAnswers, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const hasContent = Object.values(answers).some(answer => answer.trim().length > 0);

  // Animate save button based on content presence
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(saveButtonScale, {
        toValue: hasContent ? 1 : 0,
        useNativeDriver: true,
        friction: 6,
        tension: 50,
      }),
      Animated.timing(saveButtonOpacity, {
        toValue: hasContent ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    
    return () => {
      animation.stop();
    };
  }, [hasContent, saveButtonScale, saveButtonOpacity]);

  const handleSave = () => {
    if (!hasContent) return;

    if (onSave) {
      onSave(answers);
    }
  };

  const handleClear = () => {
    if (!hasContent) return;

    Alert.alert(
      'Re-write',
      'This will clear everything you\'ve written. Are you sure? 👀',
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            const emptyAnswers = {
              reflection1: '',
              reflection2: '',
              reflection3: '',
              reflection4: '',
              notes: '',
            };
            setAnswers(emptyAnswers);
          },
        },
      ]
    );
  };

  const renderQuestion = (questionData: ReflectionQuestion, index: number) => {
    const { id, question, placeholder } = questionData;
    const value = answers[id];
    const anim = questionAnims[index];

    return (
      <Animated.View
        key={id}
        style={[
          styles.questionContainer,
          {
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.questionHeader}>
          <Text style={[styles.questionNumber, { backgroundColor: colors.badge, color: colors.primary }]}>{index + 1}</Text>
          <View style={styles.questionTitleContainer}>
            <Text style={[styles.questionTitle, { color: colors.text }]}>{question}</Text>
          </View>
        </View>

        <TextArea
          label={question}
          value={value}
          placeholder={placeholder}
          onChange={(text) => updateAnswer(id, text)}
          disabled={disabled}
          isAnswered={value.trim().length > 0}
        />
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.questionsContainer}>
        {REFLECTION_QUESTIONS.map((question, index) =>
          renderQuestion(question, index)
        )}

        <View style={styles.notesContainer}>
          <View style={styles.notesHeader}>
            <Text style={[styles.notesTitle, { color: colors.textSecondary }]}>Additional Thoughts</Text>
            <Text style={[styles.notesSubtitle, { color: colors.textTertiary }]}>Optional</Text>
          </View>
          <TextArea
            label=""
            value={answers.notes}
            placeholder="Any other insights, questions, or reflections..."
            onChange={(text) => updateAnswer('notes', text)}
            disabled={disabled}
            isAnswered={answers.notes.trim().length > 0}
          />
        </View>
      </View>

      {!disabled && (
        <View style={styles.actionsContainer}>
          <ScalePressable
            style={[styles.clearButton, { borderColor: colors.border }]}
            onPress={handleClear}
          >
            <Text style={[styles.clearButtonText, { color: colors.textSecondary }]}>Start Over</Text>
          </ScalePressable>

          <Animated.View
            style={{
              flex: 1,
              transform: [{ scale: saveButtonScale }],
              opacity: saveButtonOpacity,
            }}
          >
            <ScalePressable
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={!hasContent}
            >
              <Text style={[styles.saveButtonText, { color: colors.buttonPrimaryText }]}>{saveButtonText}</Text>
            </ScalePressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

interface ReflectionQuestion {
  id: keyof ReflectionAnswers;
  question: string;
  placeholder: string;
}

const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'reflection1',
    question: 'What does this tell me about Jehovah?',
    placeholder: '',
  },
  {
    id: 'reflection2',
    question: 'How does this section of the Scriptures contribute to the Bible’s message?',
    placeholder: '',
  },
  {
    id: 'reflection3',
    question: 'How can I realistically apply this in my life?',
    placeholder: 'Think of specific, practical applications...',
  },
  {
    id: 'reflection4',
    question: 'How can I use these verses to help others?',
    placeholder: '',
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  questionsContainer: {
    // Removed paddingHorizontal since parent handles it
  },
  questionContainer: {
    marginBottom: 40,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  questionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 16,
    marginTop: 2,
    overflow: 'hidden',
  },
  questionTitleContainer: {
    flex: 1,
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  notesContainer: {
    marginTop: 20,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
    marginRight: 8,
  },
  notesSubtitle: {
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingVertical: 32,
    gap: 16,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 16, // Softened from 2
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  saveButton: {
    width: '100%', // Ensure it fills the Animated.View
    paddingVertical: 18,
    borderRadius: 16, // Softened from 2
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});