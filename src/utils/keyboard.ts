/**
 * What to hand `<KeyboardAvoidingView behavior>`, per platform.
 *
 * Android needs nothing here, and asking for something makes it worse. With
 * `windowSoftInputMode="adjustResize"` the window is already short by the
 * keyboard's height before React renders; `behavior="height"` then subtracts
 * that height a second time, from a container that has already lost it. The
 * two measurements arrive from different places and settle against each other,
 * and anything anchored to the foot of the screen shakes while they do. This
 * was watched on a device: the save screen's two buttons bounced, and stopped
 * the moment Android was given no behaviour.
 *
 * iOS does not resize its window, so it still needs the padding.
 *
 *     <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
 *
 * The exception is the reference picker, which is not avoiding the keyboard
 * but riding on top of it — see `RefPickerContext`, which keeps its own
 * `behavior="padding"` on both platforms and says why.
 */
import { Platform } from 'react-native';

export const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? ('padding' as const) : undefined;
