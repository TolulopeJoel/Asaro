/**
 * A practice page's conversation, one beat at a time: the sibling explains
 * (Got it for the next), asks them to do something (it moves on once they
 * have), and ends. The page's own button waits for the end.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import type { ReflectionAnswers } from '../ReflectionForm';
import type { Beat } from '../../onboarding/practiceEntry';
import { ScalePressable } from '../ScalePressable';
import { Text } from '../ui';
import { CoachLine } from './CoachLine';

export function CoachSequence({ beats, at, onAdvance, answers }: {
    beats: Beat[];
    at: number;
    onAdvance: () => void;
    /** What a `do` beat checks. */
    answers?: ReflectionAnswers;
}) {
    const beat = beats[Math.min(at, beats.length - 1)];
    const doneNow = beat.kind === 'do' && !!answers && beat.done(answers);

    useEffect(() => {
        if (doneNow) onAdvance();
    }, [doneNow, onAdvance]);

    return (
        <CoachLine line={beat.line} action={beat.action}>
            {beat.kind === 'tell' && (
                <ScalePressable onPress={onAdvance} accessibilityRole="button" style={styles.gotIt} hitSlop={8}>
                    <Text variant="label" tone="accent">Got it</Text>
                </ScalePressable>
            )}
        </CoachLine>
    );
}

const styles = StyleSheet.create({
    gotIt: { alignSelf: 'flex-end' },
});
