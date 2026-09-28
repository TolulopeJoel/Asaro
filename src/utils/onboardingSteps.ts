import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../storage/storageKeys';

export type OnboardingStep = 'character' | 'name' | 'sleep-time' | 'permissions' | 'battery-optimization';

// Set once by the root guard before it routes anywhere; empty means this launch isn't onboarding.
let steps: OnboardingStep[] = [];

/** Starts a new user's onboarding, on disk too, so an app killed midway picks it back up. */
export async function setOnboardingSteps(next: OnboardingStep[]): Promise<void> {
    steps = next;
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_STEPS, JSON.stringify(next));
    } catch (error) {
        console.error('Failed to save onboarding steps:', error);
    }
}

/** Picks up an onboarding a restart cut short. False when none was under way. */
export async function resumeOnboardingSteps(): Promise<boolean> {
    try {
        const saved = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_STEPS)) ?? 'null');
        if (!Array.isArray(saved) || saved.length === 0) return false;
        steps = saved;
        return true;
    } catch {
        return false;
    }
}

/** Onboarding is over: the next launch is an ordinary one. */
export async function endOnboardingRun(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_STEPS);
    } catch (error) {
        console.error('Failed to clear onboarding steps:', error);
    }
}

/** "Step 2 of 4", or null when the screen isn't part of this run's onboarding. */
export function onboardingStepLabel(step: OnboardingStep): string | null {
    const i = steps.indexOf(step);
    return i < 0 ? null : `Step ${i + 1} of ${steps.length}`;
}

/** Whether this launch began as a new user's onboarding. */
export function isOnboardingRun(): boolean {
    return steps.length > 0;
}
