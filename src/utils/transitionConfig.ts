import { Easing } from 'react-native';

/**
 * Shared transition configuration for consistent animations across the app
 */

// Modal animation timing
export const MODAL_DURATION = 250; // milliseconds

// Modal easing curve
export const MODAL_EASING = Easing.out(Easing.cubic);

// Modal animation helpers
export const BACKDROP_OPACITY = 0.4;
