import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Platform, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { BibleReferencePicker } from '../components/BibleReferencePicker';

interface RefPickerConfig {
    query?: string;
    onPreview: (partialRef: string) => void;
    onSelect: (finalRef: string) => void;
    onDismiss: () => void;
    onInteraction?: () => void;
}

interface RefPickerContextType {
    showPicker: (config: RefPickerConfig) => void;
    hidePicker: () => void;
    updateQuery: (query: string) => void;
    isVisible: boolean;
}

const RefPickerContext = createContext<RefPickerContextType>({
    showPicker: () => { },
    hidePicker: () => { },
    updateQuery: () => { },
    isVisible: false,
});

export const useRefPicker = () => useContext(RefPickerContext);

export const RefPickerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<RefPickerConfig | null>(null);
    const [visible, setVisible] = useState(false);

    const showPicker = useCallback((newConfig: RefPickerConfig) => {
        setConfig(newConfig);
        setVisible(true);
    }, []);

    const hidePicker = useCallback(() => {
        setVisible(false);
    }, []);

    const updateQuery = useCallback((query: string) => {
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
        <RefPickerContext.Provider value={{ showPicker, hidePicker, updateQuery, isVisible: visible }}>
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
