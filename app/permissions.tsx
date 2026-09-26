import { requestNotificationPermissions, openNotificationSettings, hasNotificationPermissions } from '@/src/utils/notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { useAlert } from '@/src/context/AlertContext';
import { Asaro, Hero, Screen, Text, ThemedButton } from '@/src/components/ui';

export default function PermissionsScreen() {
    const router = useRouter();
    const { colors } = useTheme();
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

    /*
     * design/all-screens.html #perms, the `.cl` slot. Cloth states the ask on
     * its band and gathers the three promises into one `.cl-panel` separated by
     * hairlines.
     */
    return (
        <Screen edges={[]}>
            <Hero ownsTopInset topPadding={64}>
                <Text variant="label" tone="onHero" style={styles.heroStep}>Step 3 of 3</Text>
                <Text variant="display" tone="onBand">Can I Check{'\n'}Up On You? 😏</Text>
            </Hero>

            <View style={styles.clothBody}>
                {/* On ecru, not the band: the rim is tuned for this ground. */}
                <View style={styles.intro}>
                    <Asaro size={74} action="smug" label="Àṣàrò" />
                    <Text variant="sub" style={styles.introText}>
                        One nudge a day, at a time you choose, and nothing after your sleep hour.
                    </Text>
                </View>

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
    /** The band's eyebrow: `margin:0 0 10px`. */
    heroStep: { marginBottom: 10 },

    /** `.cl-body{padding-top:30px; gap:18px}` */
    clothBody: {
        flex: 1,
        paddingTop: Spacing.xxl - 2,
        paddingHorizontal: Spacing.layout.screenPadding,
        gap: Spacing.layout.cardPadding,
    },
    intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    introText: { flex: 1 },
    clothPanel: { padding: Spacing.layout.cardPadding },
    clothPanelLabel: { marginBottom: 7 },
    /** `.cl-hr{margin:9px 0}` between the promises. */
    clothHr: { height: Spacing.border.hairline, marginVertical: 9 },
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
