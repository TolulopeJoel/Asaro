import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    ModalProps,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { BACKDROP_OPACITY, MODAL_DURATION, MODAL_EASING } from '../utils/transitionConfig';

interface AnimatedModalProps extends Omit<ModalProps, 'animationType'> {
    visible: boolean;
    onRequestClose: () => void;
    children: React.ReactNode;
}

/**
 * Custom animated modal with bottom-up sheet animation and backdrop fade
 */
export const AnimatedModal: React.FC<AnimatedModalProps> = ({
    visible,
    onRequestClose,
    children,
    ...modalProps
}) => {
    const [showModal, setShowModal] = useState(visible);
    const screenHeight = Dimensions.get('window').height;
    const translateY = useRef(new Animated.Value(screenHeight)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            // Animate in
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: MODAL_DURATION,
                    easing: MODAL_EASING,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: BACKDROP_OPACITY,
                    duration: MODAL_DURATION,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Animate out
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: screenHeight,
                    duration: MODAL_DURATION,
                    easing: MODAL_EASING,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: MODAL_DURATION,
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                if (finished) {
                    setShowModal(false);
                }
            });
        }
    }, [visible, screenHeight, translateY, backdropOpacity]);

    return (
        <Modal
            visible={showModal}
            transparent
            statusBarTranslucent
            onRequestClose={onRequestClose}
            {...modalProps}
        >
            <View style={styles.container}>
                {/* Backdrop */}
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    <TouchableOpacity
                        style={styles.backdropTouchable}
                        activeOpacity={1}
                        onPress={onRequestClose}
                    />
                </Animated.View>

                {/* Modal content */}
                <Animated.View
                    style={[
                        styles.modalContent,
                        {
                            transform: [{ translateY }],
                        },
                    ]}
                >
                    {children}
                </Animated.View>
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
        backgroundColor: '#000',
    },
    backdropTouchable: {
        flex: 1,
    },
    modalContent: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
