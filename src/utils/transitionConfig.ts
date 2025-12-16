import { Easing } from 'react-native';

/**
 * Shared transition configuration for consistent animations across the app
 */

// Transition timing
export const TRANSITION_DURATION = 250; // milliseconds
export const MODAL_DURATION = 250; // milliseconds

// Easing curves
export const EASING = Easing.inOut(Easing.ease);
export const MODAL_EASING = Easing.out(Easing.cubic);

// Stack navigation transition specs
export const transitionSpec = {
    open: {
        animation: 'timing' as const,
        config: {
            duration: TRANSITION_DURATION,
            easing: EASING,
        },
    },
    close: {
        animation: 'timing' as const,
        config: {
            duration: TRANSITION_DURATION,
            easing: EASING,
        },
    },
};

// Card style interpolator for slide + fade effect
export const cardStyleInterpolator = ({ current, layouts }: any) => {
    return {
        cardStyle: {
            transform: [
                {
                    translateX: current.progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [layouts.screen.width, 0],
                    }),
                },
            ],
            opacity: current.progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.5, 0.85, 1],
            }),
        },
    };
};

// Modal animation helpers
export const BACKDROP_OPACITY = 0.4;

export const getBackdropStyle = (progress: any) => ({
    opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, BACKDROP_OPACITY],
    }),
});

export const getModalStyle = (progress: any, screenHeight: number) => ({
    transform: [
        {
            translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [screenHeight, 0],
            }),
        },
    ],
});
