import React from 'react';
import {
    Modal,
    ModalProps,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

interface AnimatedModalProps extends Omit<ModalProps, 'animationType'> {
    visible: boolean;
    onRequestClose: () => void;
    children: React.ReactNode;
}

/**
 * Simple modal with no animations
 */
export const AnimatedModal: React.FC<AnimatedModalProps> = ({
    visible,
    onRequestClose,
    children,
    ...modalProps
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent
            animationType="none"
            onRequestClose={onRequestClose}
            {...modalProps}
        >
            <View style={styles.container}>
                {/* Backdrop */}
                <View style={styles.backdrop}>
                    <TouchableOpacity
                        style={styles.backdropTouchable}
                        activeOpacity={1}
                        onPress={onRequestClose}
                    />
                </View>

                {/* Modal content */}
                <View style={styles.modalContent}>
                    {children}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdropTouchable: {
        flex: 1,
    },
    modalContent: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
