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
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const { colors } = useTheme();
    const router = useRouter();

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        if (isSignUp && password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
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
                <View style={styles.content}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {isSignUp ? 'Start your accountability journey.' : 'Sign in to see your groups.'}
                    </Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary }]}
                                placeholder="Email Address"
                                placeholderTextColor={colors.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary }]}
                                placeholder="Password"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        {isSignUp && (
                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: colors.textPrimary }]}
                                    placeholder="Confirm Password"
                                    placeholderTextColor={colors.textMuted}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />
                            </View>
                        )}

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
                            <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                                <Text style={{ color: colors.accent, fontWeight: Typography.weight.bold }}>
                                    {isSignUp ? 'Sign In' : 'Sign Up'}
                                </Text>
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
        gap: Spacing.lg,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Platform.OS === 'ios' ? Spacing.md : 0,
        borderRadius: Spacing.borderRadius.md,
        backgroundColor: '#f5f5f5', // TODO: use theme gray
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputIcon: {
        marginRight: Spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: Typography.size.md,
        height: 50,
    },
    primaryButton: {
        paddingVertical: 18,
        borderRadius: Spacing.borderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.xl,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    buttonText: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
        letterSpacing: 1,
    },
    toggleButton: {
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    toggleText: {
        fontSize: Typography.size.sm,
    },
});
