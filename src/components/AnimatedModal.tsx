import React, { useEffect, useRef } from 'react';
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
    const screenHeight = Dimensions.get('window').height;
    const translateY = useRef(new Animated.Value(screenHeight)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let animation: Animated.CompositeAnimation | null = null;
        
        if (visible) {
            // Animate in
            animation = Animated.parallel([
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
            ]);
            animation.start();
        } else {
            // Animate out
            animation = Animated.parallel([
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
            ]);
            animation.start();
        }
        
        return () => {
            if (animation) {
                animation.stop();
            }
        };
    }, [visible, screenHeight, translateY, backdropOpacity]);

    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent
            onRequestClose={onRequestClose}
            {...modalProps}
        >
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
                    styles.modalContainer,
                    {
                        transform: [{ translateY }],
                    },
                ]}
            >
                {children}
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
    },
    backdropTouchable: {
        flex: 1,
    },
    modalContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        backgroundColor: 'transparent',
    },
});
