export type OnboardingStep = 'character' | 'name' | 'sleep-time' | 'permissions' | 'battery-optimization';

// Set once by the root guard before it routes anywhere; empty means this launch isn't onboarding.
let steps: OnboardingStep[] = [];

export function setOnboardingSteps(next: OnboardingStep[]) {
    steps = next;
}

/** "Step 2 of 4", or null when the screen isn't part of this run's onboarding. */
export function onboardingStepLabel(step: OnboardingStep): string | null {
    const i = steps.indexOf(step);
    return i < 0 ? null : `Step ${i + 1} of ${steps.length}`;
}
