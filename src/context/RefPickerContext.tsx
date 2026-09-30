import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { Platform, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { BibleReferencePicker, type PickerPhase } from '../components/BibleReferencePicker';

interface RefPickerConfig {
    query?: string;
    onPreview: (partialRef: string) => void;
    onSelect: (finalRef: string) => void;
    onDismiss: () => void;
    onInteraction?: () => void;
}

interface RefPickerContextType {
    /** Opens the picker for a field and returns its owner token. Pass the token back to keep ownership. */
    showPicker: (config: RefPickerConfig, owner?: number) => number;
    /** With a token, hides only if that field still owns the picker. */
    hidePicker: (owner?: number) => void;
    updateQuery: (query: string, owner?: number) => void;
    isVisible: boolean;
    /** The step the open picker is on; null while it is closed. */
    phase: PickerPhase | null;
}

const RefPickerContext = createContext<RefPickerContextType>({
    showPicker: () => 0,
    hidePicker: () => { },
    updateQuery: () => { },
    isVisible: false,
    phase: null,
});

export const useRefPicker = () => useContext(RefPickerContext);

export const RefPickerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<RefPickerConfig | null>(null);
    const [visible, setVisible] = useState(false);
    const [phase, setPhase] = useState<PickerPhase | null>(null);

    const owner = useRef(0);
    const lastToken = useRef(0);

    const showPicker = useCallback((newConfig: RefPickerConfig, token?: number) => {
        owner.current = token || ++lastToken.current;
        setConfig(newConfig);
        setVisible(true);
        return owner.current;
    }, []);

    const hidePicker = useCallback((token?: number) => {
        if (token !== undefined && token !== owner.current) return;
        setVisible(false);
    }, []);

    const updateQuery = useCallback((query: string, token?: number) => {
        if (token !== undefined && token !== owner.current) return;
        setConfig(prev => prev ? { ...prev, query } : null);
    }, []);

    const handleDismiss = useCallback(() => {
        setVisible(false);
        if (config?.onDismiss) {
            config.onDismiss();
        }
    }, [config]);

    const handleSelect = useCallback((finalRef: string) => {
        setVisible(false);
        if (config?.onSelect) {
            config.onSelect(finalRef);
        }
    }, [config]);

    return (
        <RefPickerContext.Provider value={{ showPicker, hidePicker, updateQuery, isVisible: visible, phase }}>
            {children}

            {/*
              * Root-level portal for the inline reference picker.
              *
              * This one keeps `padding` on both platforms, and is the only
              * KeyboardAvoidingView in the app that does — do not put it on
              * KEYBOARD_BEHAVIOR. Every other one is getting a writing surface
              * out of the keyboard's way; this one is riding on top of it. The
              * strip has to sit against the top of the keyboard while the
              * writer types, because picking a reference is book, then
              * chapter, then verse — three taps with the keyboard up. Lose the
              * lift and each one costs a dismiss and a re-focus.
              */}
            <KeyboardAvoidingView
                behavior="padding"
                pointerEvents="box-none"
                style={Platform.OS === 'android' ? styles.androidPortalContainer : styles.iosPortalContainer}
            >
                <BibleReferencePicker
                    visible={visible}
                    query={config?.query || ''}
                    onPreview={config?.onPreview || (() => { })}
                    onSelect={handleSelect}
                    onDismiss={handleDismiss}
                    onInteraction={config?.onInteraction}
                    floating={true}
                    onPhaseChange={setPhase}
                />
            </KeyboardAvoidingView>
        </RefPickerContext.Provider>
    );
};

const styles = StyleSheet.create({
    androidPortalContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        // ensure touches can pass through the transparent bounds if needed
    },
    iosPortalContainer: {
        // on iOS, InputAccessoryView doesn't demand a container positioned anywhere in particular,
        // as it manages its own windowing internally. But we still wrap it so layout is clean.
        display: 'none', // We can optionally hide the wrapper since InputAccessoryView is standalone
    }
});
