/**
 * The walk around Home after the practice entry: the screen dims except one
 * real element at a time, and the chosen sibling says what it is. It ends by
 * sending them off to do their real first reading. No skip, by decision.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { useAsaroLook } from '../../storage/asaroLook';
import { measureTarget, type CoachTarget, type Rect } from '../../onboarding/coachTargets';
import { PRACTICE_BOOK, PRACTICE_CHAPTERS } from '../../onboarding/practiceEntry';
import { ThemedButton, type AsaroAction } from '../ui';
import { CoachLine } from './CoachLine';

interface Stop { target: CoachTarget | null; action: AsaroAction; line: string }

function stops(other: string): Stop[] {
    return [
        { target: 'reading', action: 'point', line: 'This is today’s reading. Read it in your Bible first, then tap Begin reflection and we’ll talk about it.' },
        { target: 'add', action: 'nod', line: 'Read something that isn’t on the plan? Write about it here, any day.' },
        { target: 'week', action: 'smug', line: 'Your week. Every day you reflect fills one. Tap it and I’ll show you your record.' },
        { target: 'progress', action: 'point', line: 'How far you’ve gone through the whole Bible. Tap it to see your land.' },
        { target: 'settings', action: 'sideEye', line: `Your sleep time lives here. And if you ever want my ${other} instead… it’s here too. Don’t try it.` },
        { target: 'tab-library', action: 'nod', line: 'Everything you write ends up here. Search it, find your themes.' },
        { target: 'tab-groups', action: 'smug', line: 'And when you’re ready, bring your people.' },
        {
            target: null,
            action: 'wave',
            line: `Now it’s your turn. Go and read ${PRACTICE_BOOK} ${PRACTICE_CHAPTERS.start}–${PRACTICE_CHAPTERS.end}. I’ll be here.`,
        },
    ];
}

/** Space kept around the spotlit element. */
const PAD = 8;
const DIM = 'rgba(15, 20, 30, 0.72)';

export function HomeWalk({ visible, onDone, reveal }: {
    visible: boolean;
    onDone: () => void;
    /** Scroll a target into view if it needs it, resolving once it has moved. */
    reveal: (target: CoachTarget, rect: Rect) => Promise<void>;
}) {
    const { colors } = useTheme();
    const { width: W, height: H } = useWindowDimensions();
    const look = useAsaroLook();
    const all = useMemo(() => stops(look === 'female' ? 'brother' : 'sister'), [look]);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const stop = all[index];

    // Find this stop's element, bring it into view, then measure it where it landed.
    const locate = useCallback(async (i: number): Promise<void> => {
        const target = all[i]?.target;
        if (!target) { setRect(null); return; }
        const first = await measureTarget(target);
        if (!first) {
            // Not on this Home (no plan yet, say): go straight past it.
            if (i < all.length - 1) setIndex(i + 1);
            return;
        }
        await reveal(target, first);
        setRect((await measureTarget(target)) ?? first);
    }, [all, reveal]);

    useEffect(() => {
        if (visible) void locate(index);
    }, [visible, index, locate]);

    const last = index === all.length - 1;
    const next = () => {
        if (last) {
            onDone();
            return;
        }
        setRect(null);
        setIndex(index + 1);
    };

    // The bubble sits on whichever side of the element has the room.
    const hole = rect && {
        x: Math.max(0, rect.x - PAD),
        y: Math.max(0, rect.y - PAD),
        w: Math.min(W, rect.width + PAD * 2),
        h: rect.height + PAD * 2,
    };
    const below = !hole || hole.y + hole.h / 2 < H / 2;

    return (
        <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={() => {}}>
            {hole ? (
                <>
                    <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
                    <View style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
                    <View style={[styles.dim, { top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
                    <View style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
                    <View
                        pointerEvents="none"
                        style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h, borderColor: colors.accent }]}
                    />
                </>
            ) : (
                <View style={[styles.dim, StyleSheet.absoluteFill]} />
            )}

            {(rect || !stop.target) && (
                <View
                    style={[
                        styles.bubble,
                        { backgroundColor: colors.background },
                        !hole
                            ? { top: H / 2 - 110 }
                            : below
                                ? { top: Math.min(hole.y + hole.h + Spacing.lg, H - 220) }
                                : { bottom: Math.min(H - hole.y + Spacing.lg, H - 220) },
                    ]}
                >
                    <CoachLine key={index} line={stop.line} action={stop.action} />
                    <ThemedButton label={last ? 'Okay, let me start' : 'Next'} block onPress={next} />
                </View>
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    dim: { position: 'absolute', backgroundColor: DIM },
    ring: { position: 'absolute', borderWidth: 2 },
    bubble: {
        position: 'absolute',
        left: Spacing.layout.screenPadding,
        right: Spacing.layout.screenPadding,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
});
