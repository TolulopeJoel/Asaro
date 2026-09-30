import { requireOptionalNativeModule } from 'expo-modules-core';

const DpcBridge = requireOptionalNativeModule<{ entrySaved(): boolean }>('DpcBridge');

/**
 * Tells Tolu's DPC that a new entry exists; the phone stays locked after 07:00 until it hears this.
 * Does nothing where the module or the DPC is missing, and never throws into the save.
 */
export function tellDpcEntrySaved(): void {
    try {
        DpcBridge?.entrySaved();
    } catch {
        // The entry is saved either way; the DPC's 12:00 release covers a missed signal.
    }
}
