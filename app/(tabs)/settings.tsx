import { useTheme } from '@/src/theme/ThemeContext';
import { sendTestNotification } from '@/src/utils/notifications';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Settings() {
    const { colors, theme, setTheme } = useTheme();

    const handleTestNotification = async () => {
        try {
            await sendTestNotification();
            Alert.alert('Success', 'Notification sent! Check your notification center if you don\'t see it immediately.');
        } catch (error) {
            Alert.alert('Error', 'Failed to send notification. Please check permissions.');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Stack.Screen options={{ title: 'Settings' }} />
            <ScrollView style={styles.scrollView}>
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.themeSelector}>
                            {(['light', 'dark', 'system'] as const).map((mode) => (
                                <TouchableOpacity
                                    key={mode}
                                    style={[
                                        styles.themeOption,
                                        {
                                            backgroundColor: theme === mode ? colors.accent : 'transparent',
                                            borderColor: colors.border
                                        }
                                    ]}
                                    onPress={() => setTheme(mode)}
                                >
                                    <Text style={[
                                        styles.themeOptionText,
                                        { color: theme === mode ? colors.buttonPrimaryText : colors.textPrimary }
                                    ]}>
                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.cardText, { color: colors.textSecondary }]}>
                            Test if notifications are working correctly on your device.
                        </Text>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.accent }]}
                            onPress={handleTestNotification}
                        >
                            <Text style={styles.buttonText}>Test Notification</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
                    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.row}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>App Name</Text>
                            <Text style={[styles.value, { color: colors.textSecondary }]}>Àṣàrò</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <View style={styles.row}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>Version</Text>
                            <Text style={[styles.value, { color: colors.textSecondary }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardText: {
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    label: {
        fontSize: 16,
    },
    value: {
        fontSize: 16,
    },
    divider: {
        height: 1,
        marginVertical: 8,
    },
    themeSelector: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0', // This might need theming too if visible
        borderRadius: 8,
        padding: 4,
        gap: 4,
    },
    themeOption: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    themeOptionText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
