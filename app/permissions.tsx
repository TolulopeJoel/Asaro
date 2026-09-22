import { requestNotificationPermissions, openNotificationSettings, hasNotificationPermissions } from '@/src/utils/notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { useAlert } from '@/src/context/AlertContext';
import { Hero, Screen, Text, ThemedButton } from '@/src/components/ui';

export default function PermissionsScreen() {
    const router = useRouter();
    const { colors, isLockedIn } = useTheme();
    const { showAlert } = useAlert();
    const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'denied'>('undetermined');

    const checkPermissions = async () => {
        const hasPermission = await hasNotificationPermissions();
        if (hasPermission) {
            router.replace('/');
        }
    };

    useEffect(() => {
        checkPermissions();

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                checkPermissions();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const handleRequestPermission = async () => {
        const granted = await requestNotificationPermissions();
        if (granted) {
            router.replace('/');
        } else {
            setPermissionStatus('denied');
            showAlert({
                title: 'Can I Check Up On You? 😏',
                message: 'Hi, I\'m Àṣàrò. I will disturb you small if you miss your Bible reading. I won\'t let your phone rest\n\nBut, I care! If I don\'t see you, I\'ll check up on you to make sure your relationship with Jehovah is intact 😌',
                buttons: [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => openNotificationSettings() }
                ]
            });
        }
    };

    const handleOpenSettings = () => {
        openNotificationSettings();
    };

    /** What a reminder will and won't be — the mockup's three rows. */
    const PROMISES = [
        'A reminder for the day\u2019s reading',
        'Follow-ups for actions you set yourself',
        'Nothing else. No marketing, ever.',
    ];

    if (isLockedIn) {
        /*
         * design/all-screens.html #perms, the `.co` slot.
         *
         * No colossal element here — the design's own note says a permission
         * ask should not shout, so the button carries the weight. This is the
         * third screen in the set to use none, which is the "at most one, not
         * always one" rule working rather than failing.
         */
        return (
            <Screen>
                <View style={styles.colossalTop}>
                    <Text variant="tab">Permissions</Text>
                    <Text variant="tab">3 of 3</Text>
                </View>

                <View style={styles.colossalBody}>
                    <Text variant="display">Can I Check Up On You? 😏</Text>
                    <Text variant="sub" style={styles.colossalSub}>
                        One nudge a day, at a time you choose, and nothing after your sleep hour.
                    </Text>

                    <View style={[styles.rule, { backgroundColor: colors.border }]} />

                    <Text variant="label">What you&apos;ll get</Text>
                    {PROMISES.map(promise => (
                        <View key={promise} style={[styles.colossalRow, { borderBottomColor: colors.border }]}>
                            <Text variant="reference" style={styles.promise}>{promise}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.colossalFooter}>
                    <ThemedButton label="Allow Notifications" variant="accent" block onPress={handleRequestPermission} />
                    {permissionStatus === 'denied' && (
                        <ThemedButton label="Open Settings" variant="secondary" block onPress={handleOpenSettings} />
                    )}
                </View>
            </Screen>
        );
    }

    /*
     * design/all-screens.html #perms, the `.cl` slot. Cloth states the ask on
     * its band and gathers the three promises into one `.cl-panel` separated by
     * hairlines — the same three lines Colossal sets as bare rows.
     */
    return (
        <Screen>
            <Hero style={styles.clothHero}>
                <Text variant="label" tone="onHero" style={styles.heroStep}>Step 3 of 3</Text>
                <Text variant="display" tone="onBand">Can I Check{'\n'}Up On You? 😏</Text>
            </Hero>

            <View style={styles.clothBody}>
                <Text variant="sub">
                    One nudge a day, at a time you choose, and nothing after your sleep hour.
                </Text>

                <View style={[styles.clothPanel, { backgroundColor: colors.backgroundSubtle }]}>
                    <Text variant="label" style={styles.clothPanelLabel}>What you&apos;ll get</Text>
                    {PROMISES.map((promise, i) => (
                        <View key={promise}>
                            {i > 0 && <View style={[styles.clothHr, { backgroundColor: colors.border }]} />}
                            <Text variant="body">{promise}</Text>
                        </View>
                    ))}
                </View>

                <ThemedButton label="Allow Notifications" variant="accent" block onPress={handleRequestPermission} />
                {permissionStatus === 'denied' && (
                    <ThemedButton label="Open Settings" variant="secondary" block onPress={handleOpenSettings} />
                )}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    heroStep: { marginBottom: Spacing.sm },

    // ── Colossal ──────────────────────────────────────────────────────────
    /** `.cl-hero{padding-top:64px}` on this screen. */
    clothHero: { paddingTop: 64 },
    /** `.cl-body{padding-top:30px; gap:18px}` */
    clothBody: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    clothPanel: { padding: Spacing.layout.cardPadding },
    clothPanelLabel: { marginBottom: 7 },
    /** `.cl-hr{margin:9px 0}` between the promises. */
    clothHr: { height: Spacing.border.hairline, marginVertical: 9 },
    colossalTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.lg,
    },
    colossalBody: {
        flex: 1,
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingTop: Spacing.xxl + 12,
    },
    colossalSub: { marginTop: Spacing.layout.cardPadding },
    /** `.co-hr` */
    rule: { height: Spacing.border.hairline, marginVertical: Spacing.xl + 2 },
    colossalRow: {
        paddingVertical: Spacing.md + 3,
        borderBottomWidth: Spacing.border.hairline,
    },
    /** The mockup lightens these rows' weight: a promise, not a heading. */
    promise: { fontWeight: '500' },
    colossalFooter: {
        paddingHorizontal: Spacing.layout.screenPaddingTight,
        paddingBottom: Spacing.layout.tabBarPadding,
        gap: 10,
    },
    heroTitle: {},
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    circle: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: Spacing.borderRadius.round,
    },
    content: {
        flex: 1,
        padding: Spacing.layout.screenPadding,
        justifyContent: 'space-between',
        paddingTop: Spacing.layout.screenPadding,
    },
    header: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: Spacing.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: { textAlign: 'center', marginBottom: Spacing.sm },
    description: { textAlign: 'center', opacity: 0.7 },
    footer: {
        paddingTop: Spacing.xxl,
        gap: Spacing.lg,
    },
    button: {
        flexDirection: 'row',
        paddingVertical: 20,
        borderRadius: Spacing.borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    secondaryButton: {
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        width: '100%',
    },
});
