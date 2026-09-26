import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '../theme/spacing';
import { Asaro, AsaroAction, AsaroMood, Card, Text } from './ui';

/**
 * The return-after-absence moment.
 *
 * Every notification the app sends promises this — "if I don't see you, I'll
 * check up on you" — and until now Home looked identical whether you had been
 * away one day or two months. This is the app keeping its word.
 *
 * It appears only after a real gap, and it never scolds. The voice throughout
 * the app teases and then softens ("But, I care!"), so the longer the absence
 * the *gentler* this gets: a few days earns a cheeky point, a month earns an
 * open door. Guilt is Duolingo's mechanic; it is not the right one for an app
 * about someone's spiritual life.
 */

/** Below this, being away is just a normal gap. Saying anything would nag. */
const QUIET_THRESHOLD = 3;

interface Tier {
    minDays: number;
    /** What Àṣàrò does on arrival. Warmer the longer you have been gone. */
    action: AsaroAction;
    /**
     * How he holds his face afterwards. The longest absences get `sincere`:
     * "no lecture" and "genuinely fine" are not said with a smirk.
     */
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

export function WelcomeBack({ daysAway }: { daysAway: number | null }) {
    const tier = tierForDays(daysAway);
    if (!tier) return null;

    return (
        <Card>
            <View style={styles.row}>
                <Asaro size={74} action={tier.action} mood={tier.mood} label="Àṣàrò" />

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
