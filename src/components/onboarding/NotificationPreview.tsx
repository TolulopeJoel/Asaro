/**
 * The notification ask's evidence: real reminders landing one after another,
 * at the times they would come for the sleep time just chosen.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PREVIEW_REMINDERS, clockLabel, readSleepTime, reminderTimesFor, type SleepTime } from '../../utils/notifications';
import { useTheme } from '../../theme/ThemeContext';
import { Spacing } from '../../theme/spacing';
import { Asaro, Text } from '../ui';
import { Flip } from './Flip';

const SLOTS = ['Midday', 'Evening', 'Late', 'Final'];
const EVERY_MS = 2800;

export function NotificationPreview() {
    const { colors } = useTheme();
    const [sleep, setSleep] = useState<SleepTime>({ hour: 22, minute: 0 });
    const [tick, setTick] = useState(0);

    useEffect(() => {
        readSleepTime().then((s) => { if (s) setSleep(s); }).catch(() => {});
        const id = setInterval(() => setTick((t) => t + 1), EVERY_MS);
        return () => clearInterval(id);
    }, []);

    // Only the slots this sleep time keeps, each with the line written for it.
    const times = reminderTimesFor(sleep);
    const shown = SLOTS
        .map((name, i) => ({ name, line: PREVIEW_REMINDERS[i], at: times.find((t) => t.name === name) }))
        .filter((n) => n.at);
    const n = shown[tick % shown.length];

    return (
        <Flip flipKey={n.name} delay={600} stretch>
            <View style={[styles.note, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.head}>
                    <Asaro size={24} />
                    <Text variant="meta" tone="secondary">Àṣàrò · {clockLabel(n.at!.totalMin)}</Text>
                </View>
                <Text variant="reference">{n.line.title}</Text>
                <Text variant="bodySmall">{n.line.body}</Text>
            </View>
        </Flip>
    );
}

const styles = StyleSheet.create({
    note: { padding: Spacing.lg, gap: Spacing.xs, borderWidth: Spacing.border.hairline, minHeight: 116 },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
});
