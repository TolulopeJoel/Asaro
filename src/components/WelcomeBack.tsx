import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '../theme/spacing';
import { Asaro, AsaroAction, AsaroMood, Card, Text } from './ui';
import { performanceMs } from './ui/Asaro';

/**
 * The return-after-absence card. It appears only after a real gap and never
 * scolds: the longer the absence, the gentler he gets. See
 * design/ASARO-CHARACTER.md §4.
 */

/** After his reaction, how long he holds before looking at the reading. */
const PAUSE_MS = 1000;
/** Down and a little right: the reading starts under the card and runs past his face. */
const AT_READING = { x: 0.35, y: 0.95 };

/** Below this, a gap is normal and he says nothing. */
const QUIET_THRESHOLD = 3;

interface Tier {
    minDays: number;
    /** What he does on arrival; warmer the longer the gap. */
    action: AsaroAction;
    /** How he holds his face afterwards: `sincere` for the longest gaps. */
    mood: AsaroMood;
    heading: string;
    body: string;
}

const TIERS: Tier[] = [
    {
        minDays: 30,
        action: 'wave',
        mood: 'sincere',
        heading: 'There you are.',
        body: 'It has been a while, and that is genuinely fine. Nothing here expired. Pick up wherever you like — today is a good place.',
    },
    {
        minDays: 14,
        action: 'nod',
        mood: 'sincere',
        heading: 'You came back.',
        body: 'Two weeks is two weeks. No lecture from me — the plan kept your place, and it is still warm.',
    },
    {
        minDays: 7,
        action: 'shrug',
        mood: 'knowing',
        heading: 'A whole week o.',
        body: 'I noticed. I always notice. But you are here now, so let us not waste it talking about it.',
    },
    {
        minDays: QUIET_THRESHOLD,
        action: 'point',
        mood: 'knowing',
        heading: 'Ehen. You are back.',
        body: 'A few days off, nothing serious. Today is still today — start here.',
    },
];

export function tierForDays(days: number | null): Tier | null {
    if (days === null || days < QUIET_THRESHOLD) return null;
    return TIERS.find((t) => days >= t.minDays) ?? null;
}

export function WelcomeBack({ daysAway, readingBelow = false }: {
    daysAway: number | null;
    /** Whether there is a reading under the card for him to look down at. */
    readingBelow?: boolean;
}) {
    const tier = tierForDays(daysAway);
    const action = tier?.action;
    const [lookingDown, setLookingDown] = useState(false);

    useEffect(() => {
        setLookingDown(false);
        if (!action || !readingBelow) return;
        const id = setTimeout(() => setLookingDown(true), performanceMs(action) + PAUSE_MS);
        return () => clearTimeout(id);
    }, [action, readingBelow]);

    if (!tier) return null;

    return (
        <Card>
            <View style={styles.row}>
                <Asaro
                    size={74} action={tier.action} mood={tier.mood} label="Àṣàrò"
                    lookAt={lookingDown ? AT_READING : undefined}
                />

                <View style={styles.copy}>
                    <Text variant="subtitle">{tier.heading}</Text>
                    <Text variant="bodySmall" tone="secondary">{tier.body}</Text>
                    <Text variant="caption">{daysAway} days since your last entry</Text>
                </View>
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md + 2 },
    copy: { flex: 1, gap: Spacing.xs },
});
