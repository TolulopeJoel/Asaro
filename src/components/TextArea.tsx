import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const { height: screenHeight } = Dimensions.get('window');

const TextArea: React.FC<{
    label: string;
    value: string;
    onChange: (text: string) => void;
    placeholder?: string;
    multiline?: boolean;
    disabled?: boolean;
    isAnswered?: boolean;
}> = ({
    label,
    value,
    onChange,
    placeholder,
    disabled = false,
    isAnswered = false,
}) => {
        const { colors, isDark } = useTheme();
        const [isExpanded, setIsExpanded] = useState(false);
        const [tempValue, setTempValue] = useState('');
        const regularTextInputRef = useRef<TextInput>(null);
        const expandedTextInputRef = useRef<TextInput>(null);

        // Sync temp value with actual value when modal opens
        useEffect(() => {
            if (isExpanded) {
                setTempValue(value);
            }
        }, [isExpanded, value]);

        const handleExpand = () => {
            if (!disabled) {
                setTempValue(value);
                setIsExpanded(true);
            }
        };

        const handleSave = () => {
            onChange(tempValue);
            setIsExpanded(false);

            // Return focus to original TextArea after a brief delay
            setTimeout(() => {
                regularTextInputRef.current?.focus();
            }, 300);
        };

        const handleCancel = () => {
            setIsExpanded(false);
            // Return focus to original TextArea after a brief delay
            setTimeout(() => {
                regularTextInputRef.current?.focus();
            }, 300);
        };

        const handleTempChange = (text: string) => {
            setTempValue(text);
        };

        return (
            <>
                {/* Regular TextArea */}
                <View style={textAreaStyles.container}>
                    <View style={[
                        textAreaStyles.inputContainer,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        isAnswered && { borderColor: colors.border, backgroundColor: colors.background },
                        disabled && { backgroundColor: colors.background },
                    ]}>
                        <TextInput
                            ref={regularTextInputRef}
                            style={[
                                textAreaStyles.input,
                                { color: colors.text },
                                disabled && { color: colors.textSecondary },
                            ]}
                            placeholder={placeholder}
                            placeholderTextColor={colors.textTertiary}
                            value={value}
                            onChangeText={onChange}
                            multiline={true}
                            numberOfLines={5}
                            textAlignVertical="top"
                            editable={!disabled}
                        />
                        {isAnswered && <View style={[textAreaStyles.answeredIndicator, { backgroundColor: colors.primary }]} />}

                        {/* Expand button */}
                        {!disabled && (
                            <TouchableOpacity
                                style={[textAreaStyles.expandButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                                onPress={handleExpand}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                activeOpacity={0.7}
                            >
                                <View style={textAreaStyles.expandIcon}>
                                    <View style={[textAreaStyles.expandIconInner, { borderColor: colors.textSecondary }]} />
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Full-screen Modal */}
                <Modal
                    visible={isExpanded}
                    animationType="slide"
                    presentationStyle="fullScreen"
                    statusBarTranslucent={true}
                >
                    <StatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />
                    <SafeAreaView style={[fullScreenStyles.container, { backgroundColor: colors.background }]}>
                        <KeyboardAvoidingView
                            style={fullScreenStyles.keyboardView}
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            keyboardVerticalOffset={0}
                        >
                            <View style={fullScreenStyles.content}>
                                <TouchableOpacity
                                    style={fullScreenStyles.cancelButton}
                                    onPress={handleCancel}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                >
                                    <Text style={[fullScreenStyles.cancelText, { color: colors.textTertiary }]}>Don't Save</Text>
                                </TouchableOpacity>

                                {label && (
                                    <View style={fullScreenStyles.labelContainer}>
                                        <Text style={[fullScreenStyles.label, { color: colors.textSecondary }]}>{label}</Text>
                                    </View>
                                )}

                                <TextInput
                                    ref={expandedTextInputRef}
                                    style={[fullScreenStyles.textInput, { color: colors.text }]}
                                    placeholder={placeholder || "..."}
                                    placeholderTextColor={colors.textTertiary}
                                    value={tempValue}
                                    onChangeText={handleTempChange}
                                    multiline={true}
                                    textAlignVertical="top"
                                    autoFocus={true}
                                    blurOnSubmit={false}
                                    returnKeyType="default"
                                />

                                <TouchableOpacity
                                    style={fullScreenStyles.saveButton}
                                    onPress={handleSave}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                >
                                    <Text style={[fullScreenStyles.saveText, { color: colors.textSecondary }]}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </Modal>
            </>
        );
    };

const textAreaStyles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    inputContainer: {
        borderRadius: 16, // Softened from 7
        borderWidth: 1,
        position: 'relative',
    },
    inputContainerAnswered: {
        // Colors handled in component
    },
    inputContainerDisabled: {
        // Colors handled in component
    },
    input: {
        padding: 20,
        paddingRight: 20, // Make room for expand button
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
        letterSpacing: 0.1,
        minHeight: 150,
    },
    inputDisabled: {
        // Colors handled in component
    },
    answeredIndicator: {
        position: 'absolute',
        top: 12,
        right: 48, // Adjust position to not overlap with expand button
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    expandButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16, // Softened from 14
        borderWidth: 1,
    },
    expandIcon: {
        width: 14,
        height: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    expandIconInner: {
        width: 10,
        height: 10,
        borderWidth: 1.5,
        borderRadius: 3,
        backgroundColor: 'transparent',
    },
});

const fullScreenStyles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: (StatusBar.currentHeight || 2),
    },
    keyboardView: {
        flex: 1,
    },
    labelContainer: {
        paddingTop: 20,
        paddingBottom: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    cancelButton: {},
    cancelText: {
        fontSize: 15,
        fontWeight: '400',
        letterSpacing: 0.1,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    saveButton: {
        alignSelf: 'flex-end',
        paddingHorizontal: 20,
    },
    saveText: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 28,
        letterSpacing: 0.1,
        backgroundColor: 'transparent',
        textAlignVertical: 'top',
    },
});

export { TextArea };
