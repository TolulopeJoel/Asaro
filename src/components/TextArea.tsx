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
                        isAnswered && textAreaStyles.inputContainerAnswered,
                        disabled && textAreaStyles.inputContainerDisabled,
                    ]}>
                        <TextInput
                            ref={regularTextInputRef}
                            style={[
                                textAreaStyles.input,
                                disabled && textAreaStyles.inputDisabled,
                            ]}
                            placeholder={placeholder}
                            placeholderTextColor="#a39b90"
                            value={value}
                            onChangeText={onChange}
                            multiline={true}
                            numberOfLines={5}
                            textAlignVertical="top"
                            editable={!disabled}
                        />
                        {isAnswered && <View style={textAreaStyles.answeredIndicator} />}

                        {/* Expand button */}
                        {!disabled && (
                            <TouchableOpacity
                                style={textAreaStyles.expandButton}
                                onPress={handleExpand}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <View style={textAreaStyles.expandIcon} />
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
                    <StatusBar backgroundColor="#fefbf7" barStyle="dark-content" />
                    <SafeAreaView style={fullScreenStyles.container}>
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
                                    <Text style={fullScreenStyles.cancelText}>× Cancel</Text>
                                </TouchableOpacity>

                                {label && (
                                    <View style={fullScreenStyles.labelContainer}>
                                        <Text style={fullScreenStyles.label}>{label}</Text>
                                    </View>
                                )}

                                <TextInput
                                    ref={expandedTextInputRef}
                                    style={fullScreenStyles.textInput}
                                    placeholder={placeholder || "Begin writing..."}
                                    placeholderTextColor="#a39b90"
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
                                    <Text style={fullScreenStyles.saveText}>Save</Text>
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
        backgroundColor: '#fefefe',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#f0ede8',
        position: 'relative',
    },
    inputContainerAnswered: {
        borderColor: '#d6d3ce',
        backgroundColor: '#faf9f7',
    },
    inputContainerDisabled: {
        backgroundColor: '#f5f3f0',
    },
    input: {
        padding: 20,
        paddingRight: 50, // Make room for expand button
        fontSize: 15,
        color: '#3d3528',
        fontWeight: '400',
        lineHeight: 22,
        letterSpacing: 0.1,
        minHeight: 120,
    },
    inputDisabled: {
        color: '#8b8075',
    },
    answeredIndicator: {
        position: 'absolute',
        top: 12,
        right: 40, // Adjust position to not overlap with expand button
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#8b7355',
    },
    expandButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    expandIcon: {
        width: 12,
        height: 12,
        borderWidth: 1.5,
        borderColor: '#8b7355',
        borderRadius: 1,
        backgroundColor: 'transparent',
    },
});

const fullScreenStyles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: (StatusBar.currentHeight || 2),
        backgroundColor: '#fefbf7', // Same warm off-white as regular input
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
        color: '#8b8075',
        fontWeight: '400',
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    cancelButton: {},
    cancelText: {
        fontSize: 14,
        color: '#a39b90',
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
        fontSize: 14,
        color: '#8b8075',
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        color: '#3d3528',
        fontWeight: '400',
        lineHeight: 26,
        letterSpacing: 0.1,
        backgroundColor: 'transparent',
        textAlignVertical: 'top',
    },
});

export { TextArea };
