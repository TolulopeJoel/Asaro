// src/components/TextArea.tsx
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

interface TextAreaProps {
    value: string;
    onChange: (text: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

// export const TextArea: React.FC<TextAreaProps> = ({
//     value,
//     onChange,
//     placeholder,
//     disabled = false,
// }) => {
//     const [isFocused, setIsFocused] = useState(false);
//     const hasContent = value.trim().length > 0;

//     return (
//         <View style={styles.container}>
//             <TextInput
//                 style={[
//                     styles.input,
//                     isFocused && styles.inputFocused,
//                     hasContent && styles.inputWithContent,
//                     disabled && styles.disabledInput,
//                 ]}
//                 placeholder={placeholder}
//                 placeholderTextColor="#a39081"
//                 value={value}
//                 onChangeText={onChange}
//                 multiline
//                 textAlignVertical="top"
//                 editable={!disabled}
//                 onFocus={() => setIsFocused(true)}
//                 onBlur={() => setIsFocused(false)}
//                 scrollEnabled={false} // Let the parent ScrollView handle scrolling
//             />

//             {/* Subtle content indicator - just a gentle visual cue */}
//             {hasContent && !isFocused && (
//                 <View style={styles.contentIndicator} />
//             )}
//         </View>
//     );
// };


const TextArea: React.FC<{
    label: string;
    value: string;
    onChange: (text: string) => void;
    placeholder?: string;
    multiline?: boolean;
    disabled?: boolean;
    isAnswered?: boolean;
}> = ({
    value,
    onChange,
    placeholder,
    disabled = false,
    isAnswered = false,
}) => {
        return (
            <View style={textAreaStyles.container}>
                <View style={[
                    textAreaStyles.inputContainer,
                    isAnswered && textAreaStyles.inputContainerAnswered,
                    disabled && textAreaStyles.inputContainerDisabled,
                ]}>
                    <TextInput
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
                </View>
            </View>
        );
    };
const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    input: {
        borderWidth: 1,
        borderColor: '#e8e0d8', // subtle earth tone border
        borderRadius: 2, // minimal rounded corners
        padding: 20,
        fontSize: 16,
        color: '#3c3530', // warm dark text
        backgroundColor: '#fefbf7', // warm off-white background
        minHeight: 120, // generous space for reflection
        lineHeight: 24, // comfortable reading
        fontWeight: '400',
        // Remove default TextInput styling
        includeFontPadding: false,
        textAlignVertical: 'top',
    },
    inputFocused: {
        borderColor: '#8b7355', // gentle focus color
        backgroundColor: '#ffffff', // slightly brighter when active
    },
    inputWithContent: {
        backgroundColor: '#fcf9f4', // very subtle tint when content exists
    },
    disabledInput: {
        backgroundColor: '#f5f1eb',
        color: '#a39081',
        borderColor: '#e8e0d8',
    },
    contentIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#c4b5a0', // very subtle indicator
    },
});

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
        right: 12,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#8b7355',
    },
});

export { TextArea };
