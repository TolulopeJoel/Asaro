/**
 * Keeps a screen's foot above the keyboard.
 *
 * The app draws edge to edge (android/gradle.properties `edgeToEdgeEnabled`),
 * and an edge-to-edge window is NOT resized for the keyboard: `adjustResize`
 * does nothing, so the keyboard simply covers the bottom of the screen. This
 * pads the bottom by the keyboard's height instead, but only when the window
 * really did stay full height, so a phone that still resizes is never
 * adjusted twice: doing both makes the foot of the screen bounce.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

/** How far the keyboard reaches into a full-height window; 0 while it is closed or the window shrank for it. */
export function useKeyboardInset(): number {
    const [inset, setInset] = useState(0);
    const closedHeight = useRef(Dimensions.get('window').height);

    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const show = Keyboard.addListener('keyboardDidShow', e => {
            const shrunk = closedHeight.current - Dimensions.get('window').height;
            // The window already gave up (most of) the keyboard's height: nothing to add.
            setInset(shrunk > e.endCoordinates.height / 2 ? 0 : Math.round(e.endCoordinates.height));
        });
        const hide = Keyboard.addListener('keyboardDidHide', () => {
            setInset(0);
            closedHeight.current = Dimensions.get('window').height;
        });
        return () => { show.remove(); hide.remove(); };
    }, []);

    return inset;
}

/** Whether the keyboard is up, however the window made room for it. */
export function useKeyboardShown(): boolean {
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
        return () => { show.remove(); hide.remove(); };
    }, []);
    return shown;
}

export function KeyboardSafe({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
    const inset = useKeyboardInset();
    if (Platform.OS === 'ios') {
        return <KeyboardAvoidingView style={style} behavior="padding">{children}</KeyboardAvoidingView>;
    }
    return <View style={[style, { paddingBottom: inset }]}>{children}</View>;
}
