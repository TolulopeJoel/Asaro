import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { Button } from './Button';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const CustomAlert: React.FC = () => {
    const { colors } = useTheme();
    const { visible, alertOptions, hideAlert } = useAlert();

    // Use shared state from context
    if (!alertOptions || !visible) return null;

    const { title, message, buttons, cancelable = true } = alertOptions;

    const handleBackdropPress = () => {
        if (cancelable) {
            hideAlert();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleBackdropPress}
            statusBarTranslucent
        >
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={handleBackdropPress}
            >
                <View
                    style={[
                        styles.alertCard,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.cardBorder,
                            shadowColor: colors.textPrimary
                        }
                    ]}
                >
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

                    <View style={styles.buttonContainer}>
                        {buttons && buttons.length > 0 ? (
                            buttons.map((btn, index) => (
                                <Button
                                    key={index}
                                    label={btn.text}
                                    variant={btn.style === 'destructive' ? 'danger' : btn.style === 'cancel' ? 'outline' : 'primary'}
                                    onPress={() => {
                                        hideAlert();
                                        if (btn.onPress) btn.onPress();
                                    }}
                                    style={styles.button}
                                />
                            ))
                        ) : (
                            <Button label="OK" onPress={hideAlert} style={styles.button} />
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    alertCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 28,
        padding: Spacing.xl,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    title: {
        fontSize: Typography.size.xxl,
        fontWeight: '800',
        marginBottom: Spacing.sm,
        textAlign: 'center',
        letterSpacing: -1,
    },
    message: {
        fontSize: Typography.size.md,
        lineHeight: 20,
        marginBottom: Spacing.xl,
        textAlign: 'center',
        opacity: 0.9,
    },
    buttonContainer: {
        gap: Spacing.sm,
    },
    button: {
        width: '100%',
    },
});
