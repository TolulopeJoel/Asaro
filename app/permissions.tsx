import { requestNotificationPermissions, openNotificationSettings, hasNotificationPermissions } from '@/src/utils/notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    AppState,
    View,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ArrowRight } from 'lucide-react-native';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useAlert } from '@/src/context/AlertContext';
import { Text } from '@/src/components/ui';
import { Hero, Screen } from '@/src/components/ui';

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

    return (
        <Screen>
            <Hero>
                <Text variant="label" style={styles.heroStep}>Step 3 of 3</Text>
                <Text variant="display" tone="inverse" style={styles.heroTitle}>Stay Connected</Text>
            </Hero>


            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(225, 143, 67, 0.1)' }]}>
                        <Bell size={Typography.size.display} color={colors.primary} />
                    </View>
                </View>

                <View style={styles.textContainer}>

                    <Text variant="body" tone="secondary" style={styles.description}>
                        Àṣàrò helps you stay consistent with your Bible reading through{" "}
                        <Text style={{ textDecorationLine: 'line-through' }}>
                            friendly
                        </Text>{" "}
                        daily reminders.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <ScalePressable
                        style={[styles.button, { backgroundColor: colors.textPrimary }]}
                        onPress={handleRequestPermission}
                    >
                        <Text variant="body" tone="inverse">Allow Notifications</Text>
                        <ArrowRight size={Typography.size.lg} color={colors.background} style={{ marginLeft: Spacing.sm }} />
                    </ScalePressable>

                    {permissionStatus === 'denied' && (
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleOpenSettings}
                        >
                            <Text variant="body" tone="secondary">
                                Open Settings
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    heroStep: { color: '#a9b6c9', marginBottom: Spacing.sm },
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
