import { requestNotificationPermissions, openNotificationSettings, hasNotificationPermissions } from '@/src/utils/notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Text, View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '@/src/theme/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function PermissionsScreen() {
    const router = useRouter();
    const { colors } = useTheme();
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
        }
    };

    const handleOpenSettings = () => {
        openNotificationSettings();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Decorative background elements */}
            <View style={[styles.circle, { backgroundColor: colors.primary, opacity: 0.05, top: -50, left: -50 }]} />
            <View style={[styles.circle, { backgroundColor: colors.primary, opacity: 0.03, bottom: 50, right: -100, width: 300, height: 300, borderRadius: 150 }]} />

            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(225, 143, 67, 0.1)' }]}>
                        <Ionicons name="notifications" size={48} color={colors.primary} />
                    </View>
                </View>

                <View style={styles.textContainer}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        Stay Connected
                    </Text>

                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        Àṣàrò helps you stay consistent with your Bible reading through friendly daily reminders.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                        onPress={handleRequestPermission}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>Allow Notifications</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>

                    {permissionStatus === 'denied' && (
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleOpenSettings}
                        >
                            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                                Open Settings
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    circle: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
    },
    content: {
        flex: 1,
        padding: 32,
        justifyContent: 'space-between',
    },
    header: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        padding: 24,
        borderRadius: 32,
    },
    textContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
        opacity: 0.8,
    },
    footer: {
        paddingTop: 32,
        gap: 16,
    },
    button: {
        flexDirection: 'row',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    secondaryButton: {
        paddingVertical: 16,
        alignItems: 'center',
        width: '100%',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
