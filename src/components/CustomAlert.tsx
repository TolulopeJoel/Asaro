import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { ScalePressable } from './ScalePressable';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const CustomAlert: React.FC = () => {
    const { colors } = useTheme();
    const { visible, alertOptions, hideAlert } = useAlert();

    if (!alertOptions || !visible) return null;

    const { title, message, buttons, cancelable = true, icon, iconBackground, iconColor } = alertOptions;

    const handleBackdropPress = () => {
        if (cancelable) hideAlert();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleBackdropPress}
            statusBarTranslucent
        >
            <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
                <View
                    style={[
                        styles.alertCard,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.cardBorder,
                            shadowColor: colors.textPrimary,
                        },
                    ]}
                >
                    {/* Optional header icon */}
                    {icon && (
                        <View style={[styles.iconWrap, { backgroundColor: iconBackground ?? (colors.accent + '15') }]}>
                            <Ionicons name={icon as any} size={28} color={iconColor ?? colors.accent} />
                        </View>
                    )}

                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

                    <View style={styles.buttonContainer}>
                        {buttons && buttons.length > 0 ? (
                            buttons.map((btn, index) => {
                                const isCancel = btn.style === 'cancel';
                                const isDestructive = btn.style === 'destructive';
                                const bgColor = isDestructive
                                    ? '#FF3B30'
                                    : isCancel
                                        ? colors.backgroundSubtle
                                        : colors.accent;
                                const textColor = isDestructive || !isCancel
                                    ? colors.buttonPrimaryText
                                    : colors.textSecondary;
                                return (
                                    <ScalePressable
                                        key={index}
                                        style={[styles.pillButton, { backgroundColor: bgColor }]}
                                        onPress={() => {
                                            hideAlert();
                                            if (btn.onPress) btn.onPress();
                                        }}
                                    >
                                        {btn.icon && (
                                            <Ionicons name={btn.icon as any} size={18} color={textColor} />
                                        )}
                                        <Text style={[styles.pillText, { color: textColor, fontWeight: isCancel ? '600' : '700' }]}>
                                            {btn.text}
                                        </Text>
                                    </ScalePressable>
                                );
                            })
                        ) : (
                            <ScalePressable
                                style={[styles.pillButton, { backgroundColor: colors.accent }]}
                                onPress={hideAlert}
                            >
                                <Text style={[styles.pillText, { color: colors.buttonPrimaryText, fontWeight: '700' }]}>OK</Text>
                            </ScalePressable>
                        )}
                    </View>
                </View>
            </Pressable>
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
        alignItems: 'center',
        gap: 10,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 12,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: Typography.size.xxl,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    message: {
        fontSize: Typography.size.md,
        lineHeight: 22,
        textAlign: 'center',
        opacity: 0.85,
        marginBottom: 6,
    },
    buttonContainer: {
        gap: Spacing.sm,
        width: '100%',
    },
    pillButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16,
        width: '100%',
    },
    pillText: {
        fontSize: 16,
        letterSpacing: 0.1,
    },
});
