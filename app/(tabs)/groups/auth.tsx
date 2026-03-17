import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/theme/ThemeContext';
import { Spacing } from '@/src/theme/spacing';
import { Typography } from '@/src/theme/typography';
import { Button } from '@/src/components/Button';
import Animated, {
    useAnimatedStyle,
    withSpring,
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
    icon: any;
    colors: any;
}) => {
    const scale = useSharedValue(1);
    const progress = useSharedValue(selected ? 1 : 0);

    React.useEffect(() => {
        scale.value = withSpring(selected ? 1.05 : 1);
        progress.value = withTiming(selected ? 1 : 0, { duration: 250 });
    }, [selected]);

    const animatedStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            progress.value,
            [0, 1],
            [colors.cardBackground, colors.accentSecondaryLight]
        );
        const borderColor = interpolateColor(
            progress.value,
            [0, 1],
            [colors.borderSubtle, colors.accent]
        );

        return {
            backgroundColor,
            borderColor,
            transform: [{ scale: scale.value }],
        };
    });

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={{ flex: 1 }}
        >
            <Animated.View style={[styles.genderOption, animatedStyle]}>
                <View style={styles.genderIconContainer}>
                    <Ionicons
                        name={icon}
                        size={22}
                        color={selected ? colors.accent : colors.textTertiary}
                    />
                    {selected && (
                        <Animated.View style={styles.checkIndicator}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                        </Animated.View>
                    )}
                </View>
                <Text style={[
                    styles.genderLabel,
                    { color: selected ? colors.textPrimary : colors.textSecondary }
                ]}>
                    {label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [gender, setGender] = useState<'m' | 'f' | null>(null);
    const [loading, setLoading] = useState(false);
    const { colors } = useTheme();
    const router = useRouter();

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        if (isSignUp && (!gender || password !== confirmPassword)) {
            if (!gender) Alert.alert('Error', 'Please select if you are a Gentleman or a Lady');
            else Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            if (isSignUp) {
                const userCredential = await auth().createUserWithEmailAndPassword(email, password);

                // Update profile from local onboarding data
                const localName = await AsyncStorage.getItem('user_name');
                const localGender = await AsyncStorage.getItem('user_gender');

                if (userCredential.user) {
                    const profileUpdates: any = {};
                    if (localName) {
                        await userCredential.user.updateProfile({ displayName: localName });
                        profileUpdates.displayName = localName;
                    }

                    // Use the gender selected on the sign up form
                    const finalGender = gender || localGender;
                    if (finalGender) {
                        profileUpdates.gender = finalGender;
                    }

                    if (Object.keys(profileUpdates).length > 0) {
                        await firestore()
                            .collection('users')
                            .doc(userCredential.user.uid)
                            .set(profileUpdates, { merge: true });
                    }
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
                            <>
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

                                <View style={styles.genderContainer}>
                                    <GenderOption
                                        selected={gender === 'm'}
                                        onPress={() => setGender('m')}
                                        label="Gentleman"
                                        icon="man-outline"
                                        colors={colors}
                                    />
                                    <GenderOption
                                        selected={gender === 'f'}
                                        onPress={() => setGender('f')}
                                        label="Lady"
                                        icon="woman-outline"
                                        colors={colors}
                                    />
                                </View>
                            </>
                        )}

                        <Button
                            label={isSignUp ? 'Create Account' : 'Sign In'}
                            variant="primary"
                            onPress={handleAuth}
                            loading={loading}
                            fullWidth
                            style={{ marginVertical: Spacing.md }}
                        />

                        <Button
                            label={isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
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
    genderContainer: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.xs,
    },
    genderOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderRadius: Spacing.borderRadius.md,
        borderWidth: 1.5,
    },
    genderIconContainer: {
        position: 'relative',
    },
    checkIndicator: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: 'white',
        borderRadius: 10,
    },
    genderLabel: {
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
    },
});
