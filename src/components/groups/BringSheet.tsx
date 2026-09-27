/** Bring one thing: pick one of this week's answers to show one group, or take back the one brought. */
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { useTheme } from '../../theme/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { Spacing } from '../../theme/spacing';
import { useFootPadding } from '../../hooks/useScreenInsets';
import { QUESTION_LABELS, isQuestionId } from '../../data/questions';
import { removeShare, shareAnswer, weekAnswers } from '../../groups/publish';
import { Share, WeekAnswer } from '../../groups/model';
import { ScalePressable } from '../ScalePressable';
import { Hero, Screen, Text, ThemedButton } from '../ui';

const keyOf = (a: Pick<WeekAnswer, 'entryId' | 'questionId'>) => `${a.entryId}:${a.questionId}`;

export function BringSheet({ visible, groupId, groupName, weekKey, current, onClose }: {
    visible: boolean;
    groupId: string;
    groupName: string;
    /** The week the open window shows. */
    weekKey: string;
    /** What the reader already brought this week, if anything. */
    current: Share | null;
    onClose: () => void;
}) {
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const footPadding = useFootPadding();
    const [answers, setAnswers] = useState<WeekAnswer[] | null>(null);
    const [picked, setPicked] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setPicked(null);
        setAnswers(null);
        weekAnswers(weekKey).then(setAnswers).catch(() => setAnswers([]));
    }, [visible, weekKey]);

    const chosen = answers?.find(a => keyOf(a) === picked) ?? null;

    const bring = async () => {
        if (!chosen || busy) return;
        setBusy(true);
        try {
            const id = await shareAnswer(chosen.entryId, chosen.questionId, chosen.text, { target: groupId, weekKey });
            if (!id) showAlert({ title: 'Not brought', message: 'That answer could not be brought. Check you are signed in.' });
            else onClose();
        } finally {
            setBusy(false);
        }
    };

    const takeBack = async () => {
        if (!current || busy) return;
        setBusy(true);
        try {
            await removeShare(groupId, current.id);
            onClose();
        } finally {
            setBusy(false);
        }
    };

    const currentLabel = current && isQuestionId(current.questionId) ? QUESTION_LABELS[current.questionId] : '';

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <Screen edges={[]}>
                <Hero ownsTopInset>
                    <View style={styles.top}>
                        <Text variant="label" style={styles.flex} numberOfLines={1}>{groupName}</Text>
                        <ScalePressable onPress={onClose} hitSlop={Spacing.md} accessibilityRole="button" accessibilityLabel="Close">
                            <X size={18} color={colors.accent} strokeWidth={1.9} />
                        </ScalePressable>
                    </View>
                    <Text variant="display" tone="onBand" style={styles.title}>Bring one thing</Text>
                    <Text variant="sub" tone="onHero" style={styles.heroSub}>Only this group will see it. You can take it back.</Text>
                </Hero>

                <ScrollView contentContainerStyle={[styles.body, { paddingBottom: footPadding }]}>
                    {current && (
                        <View style={[styles.panel, { backgroundColor: colors.backgroundSubtle }]}>
                            <Text variant="label">You brought</Text>
                            <Text variant="meta" tone="secondary">{[currentLabel, current.passage].filter(Boolean).join(' · ')}</Text>
                            <Text variant="quote">{current.text}</Text>
                            <ThemedButton label="Take it back" variant="secondary" onPress={takeBack} disabled={busy} style={styles.takeBack} />
                        </View>
                    )}

                    {answers === null ? null : answers.length === 0 ? (
                        <Text variant="sub">No answers written this week yet. Write one, then bring it here.</Text>
                    ) : (
                        <>
                            {current && <Text variant="label" style={styles.or}>Or bring another instead</Text>}
                            {answers.map(answer => {
                                const on = keyOf(answer) === picked;
                                return (
                                    <ScalePressable
                                        key={keyOf(answer)}
                                        onPress={() => setPicked(keyOf(answer))}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: on }}
                                        style={[
                                            styles.pick,
                                            { borderColor: on ? colors.accent : colors.border },
                                            on && { backgroundColor: colors.backgroundSubtle },
                                        ]}
                                    >
                                        <Text variant="meta" tone="secondary" style={styles.tag}>{`${answer.label} · ${answer.passage}`}</Text>
                                        <Text variant="quote" numberOfLines={6}>{answer.text}</Text>
                                    </ScalePressable>
                                );
                            })}
                            <ThemedButton
                                label={busy ? 'Bringing…' : 'Bring this'}
                                block
                                disabled={!chosen || busy}
                                onPress={bring}
                                style={styles.bring}
                            />
                        </>
                    )}
                </ScrollView>
            </Screen>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
    /** `.cl-htitle{margin-top:14px}` */
    title: { marginTop: 14 },
    heroSub: { marginTop: Spacing.sm },
    /** `.cl-body.tight{gap:12px}` */
    body: {
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.layout.cardPadding + 4,
        gap: Spacing.md,
    },
    panel: { padding: Spacing.layout.cardPadding, gap: Spacing.sm },
    takeBack: { alignSelf: 'flex-start', marginTop: Spacing.xs },
    or: { marginTop: Spacing.sm },
    /** `.pick{border:1px solid; padding:14px 16px}` */
    pick: { borderWidth: Spacing.border.hairline, paddingVertical: 14, paddingHorizontal: Spacing.lg },
    tag: { marginBottom: 6 },
    bring: { marginTop: 6 },
});
