import React from 'react';
import { StyleSheet, View, Modal, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { ScalePressable } from './ScalePressable';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { Text } from './ui';

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
                            {React.createElement(icon, { size: 28, color: iconColor ?? colors.accent })}
                        </View>
                    )}

                    {/*
                      * `title`, not `display`.
                      *
                      * An alert floats over a screen that has already spent its
                      * one colossal element, and `display` is 40px `.co-h.lg` in
                      * Colossal — a second giant on top of the first, which is
                      * the one rule the style does not bend. `.co-h.md` is the
                      * heading step below it.
                      */}
                    <Text variant="title" style={styles.title}>{title}</Text>
                    <Text variant="body" tone="secondary" style={styles.message}>{message}</Text>

                    <View style={styles.buttonContainer}>
                        {buttons && buttons.length > 0 ? (
                            buttons.map((btn, index) => {
                                const isCancel = btn.style === 'cancel';
                                const isDestructive = btn.style === 'destructive';
                                const bgColor = isDestructive
                                    ? colors.danger
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
                                            React.createElement(btn.icon, { size: 18, color: textColor })
                                        )}
                                        <Text variant="button" style={{ color: textColor }}>
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
                                <Text variant="button" tone="inverse">OK</Text>
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
        borderRadius: Spacing.borderRadius.lg,
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
        borderRadius: Spacing.borderRadius.round,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: { textAlign: 'center' },
    message: { textAlign: 'center', opacity: 0.85, marginBottom: 6 },
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
        borderRadius: Spacing.borderRadius.lg,
        width: '100%',
    },
    pillText: {
        fontSize: Typography.size.lg,
        letterSpacing: 0.1,
    },
});
