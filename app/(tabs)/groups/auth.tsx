import React, { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from '@react-native-firebase/auth';
import { getFirestore, doc, setDoc } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { ScalePressable } from '@/src/components/ScalePressable';
import { ClothMark, Hero, Screen, Text, ThemedButton } from '@/src/components/ui';
import { KEYBOARD_BEHAVIOR } from '@/src/utils/keyboard';

/**
 * Which of the two the reader is, as a cell.
 *
 * design/all-screens.html #auth. This was a 140px card carrying a 64px round
 * icon well, a 2px border and a colour cross-fade — the tallest control in the
 * app for the smallest question on the screen. It is the chapter picker's cell
 * instead: 46px, square, and marked the same way a chosen chapter is, so the
 * one new control here is one the reader has already met.
 */
const RoleCell = ({
    selected,
    onPress,
    label,
}: {
    selected: boolean;
    onPress: () => void;
    label: string;
}) => {
    const { colors } = useTheme();
    const woven = selected;

    return (
        <ScalePressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
                styles.roleCell,
                { backgroundColor: colors.backgroundElevated, borderColor: colors.border },
                selected && {
                    backgroundColor: woven ? colors.backgroundElevated : colors.textPrimary,
                    borderColor: woven ? colors.accent : colors.textPrimary,
                },
            ]}
        >
            {woven && <ClothMark />}
            <Text variant="cell" tone={selected && !woven ? 'inverse' : 'primary'}>
                {label}
            </Text>
        </ScalePressable>
    );
};

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [gender, setGender] = useState<'m' | 'f' | null>(null);
    const [loading, setLoading] = useState(false);
    const { colors } = useTheme();
    const { showAlert } = useAlert();
    const router = useRouter();

    const handleAuth = async () => {
        if (!email || !password) {
            showAlert({ title: 'Error', message: 'Please enter email and password' });
            return;
        }

        if (isSignUp && (!gender || password !== confirmPassword)) {
            if (!gender) showAlert({ title: 'Error', message: 'Please select if you are a Gentleman or a Lady' });
            else showAlert({ title: 'Error', message: 'Passwords do not match' });
            return;
        }

        setLoading(true);
        try {
            const authInstance = getAuth();
            const db = getFirestore();
            if (isSignUp) {
                const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);

                // Update profile from local onboarding data
                const localName = await AsyncStorage.getItem('user_name');
                const localGender = await AsyncStorage.getItem('user_gender');

                if (userCredential.user) {
                    const profileUpdates: any = {};
                    if (localName) {
                        await updateProfile(userCredential.user, { displayName: localName });
                        profileUpdates.displayName = localName;
                    }

                    // Use the gender selected on the sign up form
                    const finalGender = gender || localGender;
                    if (finalGender) {
                        profileUpdates.gender = finalGender;
                    }

                    if (Object.keys(profileUpdates).length > 0) {
                        await setDoc(
                            doc(db, 'users', userCredential.user.uid),
                            profileUpdates,
                            { merge: true }
                        );
                    }
                }

                showAlert({ title: 'Account created', message: 'You are in.' });
            } else {
                await signInWithEmailAndPassword(authInstance, email, password);
            }
            router.back();
        } catch (error: any) {
            console.error(error);
            showAlert({ title: 'Auth Error', message: error.message || 'An error occurred during authentication' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Screen edges={[]}>
            {/*
              * design/all-screens.html #auth. The band is the whole state
              * indicator — "Welcome Back" or "Create Account" — so there is no
              * segmented control above the form: the two modes are not two
              * places, and the link at the foot already moves between them.
              */}
            <Hero ownsTopInset>
                <Text variant="display" tone="onBand">
                    {isSignUp ? 'Create\nAccount' : 'Welcome\nBack'}
                </Text>
            </Hero>
            <KeyboardAvoidingView
                behavior={KEYBOARD_BEHAVIOR}
                style={{ flex: 1 }}
            >
                <View style={styles.content}>
                    <Text variant="body" tone="secondary" style={styles.subtitle}>
                        {isSignUp ? 'Ready to get serious? No more hiding.' : "Welcome back. Let's see what you've been up to."}
                    </Text>

                    <View style={styles.form}>
                        <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                            <Mail size={20} color={colors.textPrimary} style={styles.inputIcon} />
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

                        <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                            <Lock size={20} color={colors.textPrimary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary }]}
                                placeholder="Password"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            {/*
                              * A word, not an eye. An eye glyph has to be drawn
                              * twice — open and struck through — and still reads
                              * as a toggle you have to guess at; the word names
                              * the state a tap produces.
                              */}
                            <ScalePressable
                                onPress={() => setShowPassword(!showPassword)}
                                hitSlop={Spacing.md}
                                accessibilityRole="button"
                            >
                                <Text variant="label" tone="secondary">
                                    {showPassword ? 'Hide' : 'Show'}
                                </Text>
                            </ScalePressable>
                        </View>

                        {isSignUp && (
                            <>
                                <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                                    <Lock size={20} color={colors.textPrimary} style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { color: colors.textPrimary }]}
                                        placeholder="Confirm Password"
                                        placeholderTextColor={colors.textMuted}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                </View>

                                <View style={styles.roleRow}>
                                    <RoleCell selected={gender === 'm'} onPress={() => setGender('m')} label="Gentleman" />
                                    <RoleCell selected={gender === 'f'} onPress={() => setGender('f')} label="Lady" />
                                </View>
                            </>
                        )}

                        <ThemedButton
                            label={isSignUp ? 'Create Account' : 'Sign In'}
                            block
                            loading={loading}
                            onPress={handleAuth}
                            style={styles.submit}
                        />

                        <ScalePressable
                            onPress={() => setIsSignUp(!isSignUp)}
                            accessibilityRole="button"
                            style={styles.switchMode}
                        >
                            <Text variant="button" tone="tertiary">
                                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create One"}
                            </Text>
                        </ScalePressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.xxxl,
    },
    title: { marginBottom: Spacing.xs },
    subtitle: { opacity: 0.6, marginBottom: Spacing.xxxl },
    form: {
        gap: Spacing.lg,
    },
    /*
     * `.cl-input` / `.co-input` with the padding moved onto the wrapper, so
     * the glyph sits inside the same hairline as the text rather than beside
     * a line of its own. The build had a third input treatment here — its own
     * radius, its own border colour — in an app that had settled on one.
     */
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md + 2,
        borderWidth: Spacing.border.hairline,
    },
    inputIcon: { marginRight: Spacing.md },
    input: {
        flex: 1,
        fontSize: Typography.size.lg,
        height: 52,
    },
    roleRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    /** The chapter picker's cell, to the pixel. */
    roleCell: {
        flex: 1,
        height: Spacing.touchTarget + 2,
        overflow: 'hidden',
        borderWidth: Spacing.border.hairline,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submit: { marginTop: Spacing.sm },
    switchMode: {
        alignSelf: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
});
