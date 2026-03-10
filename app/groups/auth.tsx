import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import auth from '@react-native-firebase/auth';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const { colors } = useTheme();
    const router = useRouter();

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            if (isSignUp) {
                const userCredential = await auth().createUserWithEmailAndPassword(email, password);

                // Update display name if we have a local one
                const localName = await AsyncStorage.getItem('user_name');
                if (localName && userCredential.user) {
                    await userCredential.user.updateProfile({ displayName: localName });
                }

                Alert.alert('Success', 'Account created successfully!');
            } else {
                await auth().signInWithEmailAndPassword(email, password);
            }
            router.back();
        } catch (error: any) {
            console.error(error);
            Alert.alert('Auth Error', error.message || 'An error occurred during authentication');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {isSignUp ? 'Start your accountability journey.' : 'Sign in to see your groups.'}
                    </Text>

                    <View style={styles.form}>
                        <View style={[styles.inputGroup]}>
                            <Text style={[styles.label, { color: colors.textTertiary }]}>EMAIL</Text>
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                                placeholder="you@example.com"
                                placeholderTextColor={colors.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={[styles.inputGroup]}>
                            <Text style={[styles.label, { color: colors.textTertiary }]}>PASSWORD</Text>
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                                placeholder="min 6 characters"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <ScalePressable
                            style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 }]}
                            onPress={handleAuth}
                            disabled={loading}
                        >
                            <Text style={[styles.buttonText, { color: colors.background }]}>
                                {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                            </Text>
                        </ScalePressable>

                        <TouchableOpacity
                            onPress={() => setIsSignUp(!isSignUp)}
                            style={styles.toggleButton}
                        >
                            <Text style={[styles.toggleText, { color: colors.accent }]}>
                                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: Spacing.md,
    },
    backButton: {
        padding: Spacing.sm,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xxl,
    },
    title: {
        fontSize: Typography.size.xxxl,
        fontWeight: Typography.weight.bold,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: Typography.size.md,
        marginBottom: Spacing.xxxl,
    },
    form: {
        gap: Spacing.xxl,
    },
    inputGroup: {
        gap: Spacing.xs,
    },
    label: {
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.bold,
        letterSpacing: 1,
    },
    input: {
        fontSize: Typography.size.lg,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
    },
    primaryButton: {
        paddingVertical: 18,
        borderRadius: Spacing.borderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    buttonText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
    },
    toggleButton: {
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    toggleText: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
    },
});
