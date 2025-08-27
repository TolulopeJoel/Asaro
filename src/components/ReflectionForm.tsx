import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { TextArea } from './TextArea';

export interface ReflectionAnswers {
  reflection1: string;
  reflection2: string;
  reflection3: string;
  reflection4: string;
  reflection5: string;
  notes: string;
}

interface ReflectionFormProps {
  initialAnswers?: ReflectionAnswers;
  onAnswersChange?: (answers: ReflectionAnswers) => void;
  onSave?: (answers: ReflectionAnswers) => void;
  disabled?: boolean;
}

interface ReflectionQuestion {
  id: keyof ReflectionAnswers;
  question: string;
  placeholder: string;
}

const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 'reflection1',
    question: 'What does this tell me about Jehovah God?',
    placeholder: '',
  },
  {
    id: 'reflection2',
    question: 'How does this section of the Scriptures contribute to the Bible\'s message?',
    placeholder: '',
  },
  {
    id: 'reflection3',
    question: 'How can I apply this in my life?',
    placeholder: 'Think of specific, practical applications...',
  },
  {
    id: 'reflection4',
    question: 'How can I use these verses to help others?',
    placeholder: '',
  },
  {
    id: 'reflection5',
    question: 'What do I want to remember?',
    placeholder: '',
  },
];

export const ReflectionForm: React.FC<ReflectionFormProps> = ({
  initialAnswers,
  onAnswersChange,
  onSave,
  disabled = false,
}) => {
  const [answers, setAnswers] = useState<ReflectionAnswers>({
    reflection1: initialAnswers?.reflection1 || '',
    reflection2: initialAnswers?.reflection2 || '',
    reflection3: initialAnswers?.reflection3 || '',
    reflection4: initialAnswers?.reflection4 || '',
    reflection5: initialAnswers?.reflection5 || '',
    notes: initialAnswers?.notes || '',
  });

  useEffect(() => {
    if (onAnswersChange) {
      onAnswersChange(answers);
    }
  }, [answers, onAnswersChange]);

  const updateAnswer = (questionId: keyof ReflectionAnswers, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSave = () => {
    const hasContent = Object.values(answers).some(answer => answer.trim().length > 0);

    if (!hasContent) {
      Alert.alert(
        'Nothing yet?',
        'Jot down even a quick thought before saving.',
        [{ text: 'Keep Writing' }]
      );
      return;
    }

    if (onSave) {
      onSave(answers);
    }
  };

  const handleClear = () => {
    const hasContent = Object.values(answers).some(answer => answer.trim().length > 0);

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
              reflection5: '',
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

    return (
      <View key={id} style={styles.questionContainer}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionNumber}>{index + 1}</Text>
          <View style={styles.questionTitleContainer}>
            <Text style={styles.questionTitle}>{question}</Text>
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
      </View>
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
            <Text style={styles.notesTitle}>Additional Thoughts</Text>
            <Text style={styles.notesSubtitle}>Optional</Text>
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
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
          >
            <Text style={styles.clearButtonText}>Start Over</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save It</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

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
    backgroundColor: '#e8e3dd',
    color: '#8b7355',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 16,
    marginTop: 2,
  },
  questionTitleContainer: {
    flex: 1,
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#3d3528',
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
    color: '#6b5b47',
    letterSpacing: 0.2,
    marginRight: 8,
  },
  notesSubtitle: {
    fontSize: 12,
    color: '#a39b90',
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
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d6d3ce',
    borderRadius: 2,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#8b8075',
    letterSpacing: 0.3,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#6b5b47',
    borderRadius: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fefefe',
    letterSpacing: 0.3,
  },
});