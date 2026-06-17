import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, LucideIcon } from 'lucide-react-native';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from '@react-native-firebase/auth';
import { getFirestore, doc, setDoc } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAlert } from '@/src/context/AlertContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { Button } from '@/src/components/Button';
import { ScalePressable } from '@/src/components/ScalePressable';
import Animated, {
    useAnimatedStyle,
    withTiming,
    interpolateColor,
    useSharedValue
} from 'react-native-reanimated';
import React from 'react';

const GenderOption = ({
    selected,
    onPress,
    label,
    icon,
    colors
}: {
    selected: boolean;
    onPress: () => void;
    label: string;
    icon: LucideIcon;
    colors: any;
}) => {
    const progress = useSharedValue(selected ? 1 : 0);

    React.useEffect(() => {
        progress.value = withTiming(selected ? 1 : 0, { duration: 250 });
    }, [selected]);

    const animatedStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            progress.value,
            [0, 1],
            [colors.cardBackground, colors.accentSecondaryLight + '40'] // Subtle accent background
        );
        const borderColor = interpolateColor(
            progress.value,
            [0, 1],
            [colors.borderSubtle, colors.accent]
        );

        return {
            backgroundColor,
            borderColor,
        };
    });

    return (
        <ScalePressable
            onPress={onPress}
            style={{ flex: 1 }}
        >
            <Animated.View style={[styles.genderOption, animatedStyle]}>
                <View style={[
                    styles.genderIconWrapper,
                    { backgroundColor: selected ? colors.accent + '15' : colors.cardHover }
                ]}>
                    {React.createElement(icon, {
                        size: 32,
                        color: selected ? colors.accent : colors.textTertiary,
                        strokeWidth: 2
                    })}
                </View>
                <Text style={[
                    styles.genderLabel,
                    { color: selected ? colors.textPrimary : colors.textSecondary }
                ]}>
                    {label}
                </Text>
            </Animated.View>
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

                showAlert({ title: 'Success', message: 'Account created successfully!' });
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
                        {isSignUp ? 'Ready to get serious? No more hiding.' : "Welcome back. Let's see what you've been up to."}
                    </Text>

                    <View style={styles.form}>
                        <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.borderSubtle }]}>
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

                        <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.borderSubtle }]}>
                            <Lock size={20} color={colors.textPrimary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary }]}
                                placeholder="Password"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: Spacing.sm }}>
                                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>
                                    {showPassword ? "HIDE" : "SHOW"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {isSignUp && (
                            <>
                                <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.borderSubtle }]}>
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

                                <View style={styles.genderContainer}>
                                    <GenderOption
                                        selected={gender === 'm'}
                                        onPress={() => setGender('m')}
                                        label="Gentleman"
                                        icon={User}
                                        colors={colors}
                                    />
                                    <GenderOption
                                        selected={gender === 'f'}
                                        onPress={() => setGender('f')}
                                        label="Lady"
                                        icon={User}
                                        colors={colors}
                                    />
                                </View>
                            </>
                        )}

                        <Button
                            label={isSignUp ? 'Create Account' : 'Sign In'}
                            variant="primary"
                            size="lg"
                            onPress={handleAuth}
                            loading={loading}
                            fullWidth
                            style={{ marginVertical: Spacing.md }}
                        />

                        <Button
                            label={isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create One"}
                            variant="ghost"
                            onPress={() => setIsSignUp(!isSignUp)}
                            fullWidth
                        />
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
        paddingHorizontal: Spacing.layout.screenPadding,
        paddingTop: Spacing.xxxl,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1.5,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        opacity: 0.6,
        marginBottom: Spacing.xxxl,
    },
    form: {
        gap: Spacing.lg,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Platform.OS === 'ios' ? Spacing.sm : 0,
        borderRadius: Spacing.borderRadius.lg,
        borderWidth: 1,
    },
    inputIcon: {
        marginRight: Spacing.md,
        opacity: 0.5,
    },
    input: {
        flex: 1,
        fontSize: Typography.size.lg,
        height: 56,
        fontWeight: '500',
    },
    genderContainer: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.xs,
    },
    genderOption: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xl,
        borderRadius: Spacing.borderRadius.xl,
        borderWidth: 2,
        gap: Spacing.md,
        minHeight: 140,
    },
    genderIconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    genderLabel: {
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
        letterSpacing: 0.2,
    },
});
